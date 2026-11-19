// random.js — one seeded generator for the whole game.
// The city, the traffic colours and the crowds all draw from mulberry32 streams
// seeded by the ?seed= parameter (default 7), so a given seed always builds the
// same Vesper Bay and the screenshot scenes are reproducible frame for frame.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngRange(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function rngInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function rngPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function seedFromQuery(search) {
  const raw = new URLSearchParams(search).get('seed');
  const n = raw === null ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 7;
}
