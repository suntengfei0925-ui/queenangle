const path = require("node:path");
const express = require("express");
const { loadConfig } = require("./config");
const { createSqliteStore } = require("./db/sqlite");
const { createLocalDb } = require("./db/localDb");
const { ensureInitialUsers, publicUser } = require("./auth/users");
const { verifyPassword } = require("./auth/password");
const {
  attachSession,
  clearSessionCookie,
  createSession,
  currentUserResponse,
  requireUser,
  setSessionCookie
} = require("./auth/sessions");
const { runWithContext } = require("./runtime");
const { createFileRoutes } = require("./files/routes");
const business = require("./business");

function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
}

function staticHeaders(res, filePath) {
  const fileName = path.basename(filePath);
  if (["index.html", "app.js", "styles.css", "manifest.webmanifest", "sw.js"].includes(fileName)) {
    res.setHeader("Cache-Control", "no-cache");
  }
}

function createLoginLimiter() {
  const attempts = new Map();
  const windowMs = 60 * 1000;
  const maxAttempts = 10;
  return (req, res, next) => {
    const key = `${req.ip}:${String(req.body && req.body.username || "").toLowerCase()}`;
    const now = Date.now();
    const entry = attempts.get(key) || { count: 0, resetAt: now + windowMs };
    if (entry.resetAt < now) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count += 1;
    attempts.set(key, entry);
    if (entry.count > maxAttempts) {
      return res.status(429).json({ ok: false, code: "RATE_LIMITED", message: "登录尝试过于频繁，请稍后再试" });
    }
    return next();
  };
}

async function addAuditLog(localDb, user, action, detail = {}) {
  await localDb.collection("audit_logs").add({
    data: {
      action,
      userId: user && user.id ? user.id : "",
      username: user && user.username ? user.username : "",
      detail,
      createdAt: localDb.serverDate()
    }
  });
}

async function main() {
  const config = loadConfig();
  const store = createSqliteStore(config);
  const localDb = createLocalDb(store);
  await ensureInitialUsers(store, localDb, config);
  store.cleanupSessions();

  const app = express();
  const loginLimiter = createLoginLimiter();
  const files = createFileRoutes({ config, localDb });
  const webDir = path.join(config.rootDir, "web");

  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(express.json({ limit: "1mb" }));
  app.use(attachSession(store, config));

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      data: {
        service: "queenangle-api",
        time: new Date().toISOString()
      }
    });
  });

  app.get("/api/auth/me", (req, res) => {
    res.json(currentUserResponse(req));
  });

  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    const username = String(req.body && req.body.username || "").trim();
    const password = String(req.body && req.body.password || "");
    const user = store.findUserByUsername(username);

    if (!user || user.enabled === false || !verifyPassword(password, user.passwordHash)) {
      await addAuditLog(localDb, user || { username }, "login_failed", { username });
      return res.status(401).json({ ok: false, code: "INVALID_CREDENTIALS", message: "账号或密码不正确" });
    }

    const session = createSession(store, config, user);
    setSessionCookie(res, config, session);
    await addAuditLog(localDb, user, "login_success");
    return res.json({
      ok: true,
      data: {
        user: publicUser(user)
      }
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    if (req.session) {
      store.revokeSession(req.session.id);
    }
    clearSessionCookie(res, config);
    res.json({ ok: true, data: {} });
  });

  app.post("/api/business", requireUser, async (req, res) => {
    const result = await runWithContext({ db: localDb, user: req.user }, () => business.main(req.body || {}));
    const status = result && result.ok === false && result.code === "NO_PERMISSION" ? 403 : 200;
    res.status(status).json(result);
  });

  app.post("/api/files/signatures", requireUser, files.upload.single("file"), files.uploadSignature);
  app.get("/api/files/:id", requireUser, files.sendFile);

  app.use(express.static(webDir, { extensions: ["html"], setHeaders: staticHeaders }));
  app.get("*", (req, res) => {
    res.sendFile(path.join(webDir, "index.html"));
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error(err);
    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      message: err && err.message ? err.message : "系统异常"
    });
  });

  app.listen(config.port, config.host, () => {
    console.log(`QueenAngle API listening on http://${config.host}:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
