function normalizeForHash(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeForHash);
  }

  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      const item = value[key];
      acc[key] = item === undefined ? null : normalizeForHash(item);
      return acc;
    }, {});
  }

  return value === undefined ? null : value;
}

function stableStringify(value) {
  return JSON.stringify(normalizeForHash(value));
}

function hashSnapshot(snapshot) {
  const text = stableStringify(snapshot);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

module.exports = {
  stableStringify,
  hashSnapshot
};
