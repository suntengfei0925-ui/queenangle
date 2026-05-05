const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const res = await db.collection("owner_whitelist")
    .where({ openid: OPENID })
    .limit(1)
    .get();

  const owner = res.data && res.data[0];
  const allowed = !!owner && owner.enabled !== false;
  const name = owner && owner.name ? String(owner.name).trim() : "";
  const isOwner = allowed && owner.isOwner === true;

  return {
    openid: OPENID,
    allowed,
    name,
    isOwner,
    owner: allowed
      ? {
        openid: OPENID,
        name,
        isOwner
      }
      : null
  };
};

