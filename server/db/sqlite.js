const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeForJson(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (value && typeof value === "object") {
    return Object.keys(value).reduce((acc, key) => {
      const item = value[key];
      acc[key] = item === undefined ? null : normalizeForJson(item);
      return acc;
    }, {});
  }
  return value === undefined ? null : value;
}

function parseDocument(row) {
  if (!row) return null;
  const data = JSON.parse(row.data_json || "{}");
  return {
    ...data,
    _id: row.id
  };
}

function createSqliteStore(config) {
  ensureDir(path.dirname(config.dbPath));
  const db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_collection
      ON documents(collection);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_owner INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      password_changed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  const statements = {
    getDocuments: db.prepare("SELECT id, data_json, created_at, updated_at FROM documents WHERE collection = ?"),
    getDocument: db.prepare("SELECT id, data_json, created_at, updated_at FROM documents WHERE collection = ? AND id = ?"),
    insertDocument: db.prepare(`
      INSERT INTO documents (id, collection, data_json, created_at, updated_at)
      VALUES (@id, @collection, @data_json, @created_at, @updated_at)
    `),
    updateDocument: db.prepare(`
      UPDATE documents
      SET data_json = @data_json, updated_at = @updated_at
      WHERE collection = @collection AND id = @id
    `),
    deleteExpiredSessions: db.prepare("DELETE FROM sessions WHERE expires_at < ? OR revoked_at IS NOT NULL"),
    getUserByUsername: db.prepare("SELECT * FROM users WHERE username = ?"),
    getUserById: db.prepare("SELECT * FROM users WHERE id = ?"),
    insertUser: db.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, is_owner, enabled, created_at, updated_at, password_changed_at)
      VALUES (@id, @username, @display_name, @password_hash, @is_owner, @enabled, @created_at, @updated_at, @password_changed_at)
    `),
    updateUserPassword: db.prepare(`
      UPDATE users
      SET password_hash = @password_hash, password_changed_at = @password_changed_at, updated_at = @updated_at
      WHERE id = @id
    `),
    insertSession: db.prepare(`
      INSERT INTO sessions (id, user_id, created_at, expires_at)
      VALUES (@id, @user_id, @created_at, @expires_at)
    `),
    getSession: db.prepare(`
      SELECT sessions.*, users.username, users.display_name, users.is_owner, users.enabled
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ?
    `),
    revokeSession: db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?")
  };

  function mapUser(row) {
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      passwordHash: row.password_hash,
      isOwner: row.is_owner === 1,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      passwordChangedAt: row.password_changed_at
    };
  }

  return {
    raw: db,
    close() {
      db.close();
    },
    beginImmediate() {
      db.exec("BEGIN IMMEDIATE");
    },
    commit() {
      db.exec("COMMIT");
    },
    rollback() {
      db.exec("ROLLBACK");
    },
    listDocuments(collection) {
      return statements.getDocuments.all(collection).map(parseDocument);
    },
    getDocument(collection, id) {
      return parseDocument(statements.getDocument.get(collection, id));
    },
    insertDocument(collection, id, data) {
      const now = new Date().toISOString();
      statements.insertDocument.run({
        id,
        collection,
        data_json: JSON.stringify(normalizeForJson(data)),
        created_at: now,
        updated_at: now
      });
    },
    updateDocument(collection, id, data) {
      const existing = this.getDocument(collection, id);
      if (!existing) return 0;
      const next = { ...existing, ...data };
      delete next._id;
      statements.updateDocument.run({
        id,
        collection,
        data_json: JSON.stringify(normalizeForJson(next)),
        updated_at: new Date().toISOString()
      });
      return 1;
    },
    findUserByUsername(username) {
      return mapUser(statements.getUserByUsername.get(username));
    },
    findUserById(id) {
      return mapUser(statements.getUserById.get(id));
    },
    createUser(user) {
      statements.insertUser.run({
        id: user.id,
        username: user.username,
        display_name: user.displayName,
        password_hash: user.passwordHash,
        is_owner: user.isOwner ? 1 : 0,
        enabled: user.enabled === false ? 0 : 1,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        password_changed_at: user.passwordChangedAt || null
      });
    },
    updateUserPassword(id, passwordHash) {
      const now = new Date().toISOString();
      statements.updateUserPassword.run({
        id,
        password_hash: passwordHash,
        password_changed_at: now,
        updated_at: now
      });
    },
    createSession(session) {
      statements.insertSession.run({
        id: session.id,
        user_id: session.userId,
        created_at: session.createdAt,
        expires_at: session.expiresAt
      });
    },
    getSession(id) {
      const row = statements.getSession.get(id);
      if (!row) return null;
      return {
        id: row.id,
        userId: row.user_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        user: {
          id: row.user_id,
          username: row.username,
          displayName: row.display_name,
          isOwner: row.is_owner === 1,
          enabled: row.enabled === 1
        }
      };
    },
    revokeSession(id) {
      statements.revokeSession.run(new Date().toISOString(), id);
    },
    cleanupSessions() {
      statements.deleteExpiredSessions.run(new Date().toISOString());
    }
  };
}

module.exports = {
  createSqliteStore,
  normalizeForJson
};
