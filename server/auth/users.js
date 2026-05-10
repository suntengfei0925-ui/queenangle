const crypto = require("node:crypto");
const { hashPassword } = require("./password");

const WHITELIST_COLLECTION = "owner_whitelist";

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    name: user.displayName,
    isOwner: user.isOwner === true
  };
}

async function ensureWhitelistPerson(localDb, user) {
  const collection = localDb.collection(WHITELIST_COLLECTION);
  const res = await collection.where({ openid: user.id }).limit(1).get();
  const payload = {
    openid: user.id,
    name: user.displayName,
    enabled: user.enabled !== false,
    isOwner: user.isOwner === true,
    remark: "独立网站账号",
    updatedAt: localDb.serverDate()
  };

  if (res.data && res.data[0]) {
    await collection.doc(res.data[0]._id).update({ data: payload });
    return;
  }

  await collection.add({
    data: {
      ...payload,
      createdAt: localDb.serverDate()
    }
  });
}

async function ensureInitialUsers(store, localDb, config) {
  for (const account of config.initialUsers) {
    const existing = store.findUserByUsername(account.username);
    if (existing) {
      await ensureWhitelistPerson(localDb, existing);
      continue;
    }

    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID().replace(/-/g, ""),
      username: account.username,
      displayName: account.displayName,
      passwordHash: hashPassword(account.password),
      isOwner: account.isOwner === true,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      passwordChangedAt: now
    };
    store.createUser(user);
    await ensureWhitelistPerson(localDb, user);
  }
}

module.exports = {
  ensureInitialUsers,
  publicUser
};
