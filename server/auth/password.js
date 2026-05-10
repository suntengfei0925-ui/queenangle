const bcrypt = require("bcryptjs");

const ROUNDS = 12;

function hashPassword(password) {
  return bcrypt.hashSync(String(password), ROUNDS);
}

function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash) return false;
  return bcrypt.compareSync(String(password), passwordHash);
}

module.exports = {
  hashPassword,
  verifyPassword
};
