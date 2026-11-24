// Seeded random numbers so runs can be saved/restored exactly and daily puzzles match.

/** mulberry32. The returned function has helpers and a read/write `state` for save files. */
export function createRng(seed = randomSeed()) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + r() * (hi - lo);
  r.int = (lo, hi) => Math.floor(r.range(lo, hi + 1)); // inclusive
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  r.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  Object.defineProperty(r, 'state', {
    get: () => a,
    set: (v) => { a = v >>> 0; },
  });
  return r;
}

/** FNV-1a string hash -> uint32 */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}

/** Local-date key like "2026-11-24" — handy for daily challenges and streaks. */
export function todayKey(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Same seed for everyone on the same day (per game salt). */
export function dailySeed(salt = '') {
  return hashString(`${todayKey()}:${salt}`);
}
