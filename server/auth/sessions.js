const crypto = require("node:crypto");
const { publicUser } = require("./users");

const COOKIE_NAME = "qa_sid";

function parseCookies(header) {
  const cookies = {};
  String(header || "").split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index < 0) return;
    const key = decodeURIComponent(part.slice(0, index).trim());
    const value = decodeURIComponent(part.slice(index + 1).trim());
    cookies[key] = value;
  });
  return cookies;
}

function cookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: config.sessionTtlMs
  };
}

function clearCookieOptions(config) {
  const options = cookieOptions(config);
  delete options.maxAge;
  return options;
}

function createSession(store, config, user) {
  const now = new Date();
  const expires = new Date(now.getTime() + config.sessionTtlMs);
  const session = {
    id: crypto.randomBytes(32).toString("base64url"),
    userId: user.id,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString()
  };
  store.createSession(session);
  return session;
}

function attachSession(store, config) {
  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies[COOKIE_NAME];
    if (!sid) return next();

    const session = store.getSession(sid);
    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() < Date.now() || session.user.enabled === false) {
      res.clearCookie(COOKIE_NAME, clearCookieOptions(config));
      return next();
    }

    req.session = session;
    req.user = session.user;
    return next();
  };
}

function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "请先登录"
    });
  }
  return next();
}

function setSessionCookie(res, config, session) {
  res.cookie(COOKIE_NAME, session.id, cookieOptions(config));
}

function clearSessionCookie(res, config) {
  res.clearCookie(COOKIE_NAME, clearCookieOptions(config));
}

function currentUserResponse(req) {
  return {
    ok: true,
    data: {
      authenticated: !!req.user,
      user: publicUser(req.user)
    }
  };
}

module.exports = {
  COOKIE_NAME,
  attachSession,
  clearSessionCookie,
  createSession,
  currentUserResponse,
  requireUser,
  setSessionCookie
};
