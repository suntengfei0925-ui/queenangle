const crypto = require("node:crypto");
const { normalizeForJson } = require("./sqlite");

function createId() {
  return crypto.randomUUID().replace(/-/g, "");
}

function normalizeComparable(value) {
  return normalizeForJson(value);
}

function valuesEqual(left, right) {
  return JSON.stringify(normalizeComparable(left)) === JSON.stringify(normalizeComparable(right));
}

function matchesWhere(document, whereClauses) {
  return whereClauses.every((query) => Object.entries(query || {}).every(([key, expected]) => {
    return valuesEqual(document[key], expected);
  }));
}

function compareValues(left, right) {
  const a = normalizeComparable(left);
  const b = normalizeComparable(right);
  if (a === undefined || a === null) return b === undefined || b === null ? 0 : 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "zh-Hans", { numeric: true });
}

class DocumentRef {
  constructor(store, collection, id) {
    this.store = store;
    this.collection = collection;
    this.id = id;
  }

  async get() {
    const doc = this.store.getDocument(this.collection, this.id);
    if (!doc) {
      const err = new Error("document not found");
      err.code = "DOCUMENT_NOT_FOUND";
      throw err;
    }
    return { data: doc };
  }

  async update({ data } = {}) {
    const updated = this.store.updateDocument(this.collection, this.id, data || {});
    if (!updated) {
      const err = new Error("document not found");
      err.code = "DOCUMENT_NOT_FOUND";
      throw err;
    }
    return { stats: { updated } };
  }
}

class Query {
  constructor(store, collection, options = {}) {
    this.store = store;
    this.collectionName = collection;
    this.whereClauses = options.whereClauses || [];
    this.order = options.order || null;
    this.max = options.max || null;
  }

  collection(name) {
    return new Query(this.store, name);
  }

  doc(id) {
    return new DocumentRef(this.store, this.collectionName, id);
  }

  where(query) {
    return new Query(this.store, this.collectionName, {
      whereClauses: [...this.whereClauses, query || {}],
      order: this.order,
      max: this.max
    });
  }

  orderBy(field, direction = "asc") {
    return new Query(this.store, this.collectionName, {
      whereClauses: this.whereClauses,
      order: { field, direction: String(direction).toLowerCase() === "desc" ? "desc" : "asc" },
      max: this.max
    });
  }

  limit(max) {
    return new Query(this.store, this.collectionName, {
      whereClauses: this.whereClauses,
      order: this.order,
      max: Number(max) > 0 ? Number(max) : null
    });
  }

  async get() {
    let data = this.store.listDocuments(this.collectionName)
      .filter((document) => matchesWhere(document, this.whereClauses));

    if (this.order) {
      const { field, direction } = this.order;
      data = data.sort((a, b) => {
        const result = compareValues(a[field], b[field]);
        return direction === "desc" ? -result : result;
      });
    }

    if (this.max !== null) {
      data = data.slice(0, this.max);
    }

    return { data };
  }

  async add({ data } = {}) {
    const id = createId();
    this.store.insertDocument(this.collectionName, id, data || {});
    return { _id: id };
  }

  async update({ data } = {}) {
    const docs = this.store.listDocuments(this.collectionName)
      .filter((document) => matchesWhere(document, this.whereClauses));
    let updated = 0;
    docs.forEach((document) => {
      updated += this.store.updateDocument(this.collectionName, document._id, data || {});
    });
    return { stats: { updated } };
  }
}

function createMutex() {
  let queue = Promise.resolve();
  return function runExclusive(fn) {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };
}

function createLocalDb(store) {
  const runExclusive = createMutex();
  const localDb = {
    collection(name) {
      return new Query(store, name);
    },
    async createCollection() {
      return {};
    },
    serverDate() {
      return new Date();
    },
    runTransaction(fn) {
      return runExclusive(async () => {
        store.beginImmediate();
        try {
          const result = await fn({
            collection(name) {
              return new Query(store, name);
            }
          });
          store.commit();
          return result;
        } catch (err) {
          store.rollback();
          throw err;
        }
      });
    }
  };

  return localDb;
}

module.exports = {
  createLocalDb,
  createId
};
