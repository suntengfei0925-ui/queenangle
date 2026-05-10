const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90;

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index <= 0) return;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });
  return env;
}

function boolValue(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function resolvePath(root, value) {
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function loadConfig() {
  const rootDir = path.resolve(__dirname, "..");
  const fileEnv = readDotEnv(path.join(rootDir, ".env"));
  const env = { ...fileEnv, ...process.env };
  const nodeEnv = env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";

  const sessionSecret = env.SESSION_SECRET || (isProduction ? "" : "local-development-session-secret-change-me");
  if (isProduction && sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production.");
  }

  const initialUsers = [
    {
      username: env.OWNER_USERNAME || (isProduction ? "" : "owner"),
      password: env.OWNER_PASSWORD || (isProduction ? "" : "owner123456"),
      displayName: env.OWNER_NAME || "老板",
      isOwner: true
    },
    {
      username: env.PARTNER_USERNAME || (isProduction ? "" : "partner"),
      password: env.PARTNER_PASSWORD || (isProduction ? "" : "partner123456"),
      displayName: env.PARTNER_NAME || "老板娘",
      isOwner: false
    }
  ].filter((item) => item.username && item.password);

  return {
    rootDir,
    nodeEnv,
    isProduction,
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 3000),
    appOrigin: env.APP_ORIGIN || `http://localhost:${env.PORT || 3000}`,
    sessionSecret,
    dbPath: resolvePath(rootDir, env.DB_PATH || "./data/queenangle.sqlite"),
    uploadDir: resolvePath(rootDir, env.UPLOAD_DIR || "./uploads"),
    cookieSecure: boolValue(env.COOKIE_SECURE, isProduction),
    sessionTtlMs: Number(env.SESSION_TTL_MS || DEFAULT_SESSION_TTL_MS),
    initialUsers
  };
}

module.exports = {
  loadConfig
};
