// Persistent key/value storage on IndexedDB, with an in-memory fallback.
// Keys are namespaced: "<gameId>:<key>" for games, "_studio:<key>" for the launcher.
// Values must be JSON-safe so they survive export/import.

const DB_NAME = 'offline-game-studio';
const STORE = 'kv';

let dbPromise = null;
let memory = null; // Map used when IndexedDB is unavailable

function openDB() {
  if (memory) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      let req;
      try {
        req = indexedDB.open(DB_NAME, 1);
      } catch (err) {
        reject(err);
        return;
      }
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => {
        const db = req.result;
        // iOS can drop the connection while the app is backgrounded; reopen next time.
        db.onclose = () => { dbPromise = null; };
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    }).catch((err) => {
      console.warn('[save] IndexedDB unavailable, using memory storage', err);
      memory = new Map();
      return null;
    });
  }
  return dbPromise;
}

async function run(mode, fn, retry = true) {
  const db = await openDB();
  if (!db) {
    const out = fn(null);
    return typeof out === 'function' ? out() : out?.result;
  }
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const out = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(typeof out === 'function' ? out() : out?.result);
      t.onerror = t.onabort = () => reject(t.error);
    });
  } catch (err) {
    if (!retry) throw err;
    dbPromise = null; // stale connection — reopen once
    return run(mode, fn, false);
  }
}

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export const store = {
  get: (key) => run('readonly', (s) => (s ? s.get(key) : { result: memory.get(key) })),
  set: (key, value) => run('readwrite', (s) => {
    const v = clone(value);
    if (!s) { memory.set(key, v); return undefined; }
    s.put(v, key);
    return undefined;
  }),
  del: (key) => run('readwrite', (s) => {
    if (!s) { memory.delete(key); return undefined; }
    s.delete(key);
    return undefined;
  }),
  keys: () => run('readonly', (s) => (s ? s.getAllKeys() : { result: [...memory.keys()] })),

  /** @returns {Promise<Record<string, any>>} */
  entries: () => run('readonly', (s) => {
    if (!s) return { result: Object.fromEntries(memory) };
    const keys = s.getAllKeys();
    const vals = s.getAll();
    return () => Object.fromEntries(keys.result.map((k, i) => [k, vals.result[i]]));
  }),
  setMany: (obj) => run('readwrite', (s) => {
    for (const [k, v] of Object.entries(obj)) {
      if (!s) memory.set(k, clone(v));
      else s.put(clone(v), k);
    }
    return undefined;
  }),
  clearAll: () => run('readwrite', (s) => {
    if (!s) memory.clear();
    else s.clear();
    return undefined;
  }),
};

/** A save API scoped to one game. `run` is the reserved key for an in-progress run. */
export function gameSave(gameId) {
  const k = (key) => `${gameId}:${key}`;
  return {
    get: (key) => store.get(k(key)),
    set: (key, value) => store.set(k(key), value),
    clear: (key) => store.del(k(key)),
    /** Update a numeric high score; resolves to the (possibly new) best. */
    async best(key, value, higherIsBetter = true) {
      const prev = await store.get(k(key));
      const better = prev == null || (higherIsBetter ? value > prev : value < prev);
      if (better) await store.set(k(key), value);
      return better ? value : prev;
    },
  };
}
