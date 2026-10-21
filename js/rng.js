/* Seeded PRNG (mulberry32) with small helpers. Classic script: no modules, so the game runs from file://. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  BR.makeRng = function makeRng(seed) {
    let a = (seed >>> 0) || 1;
    const next = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const rng = {
      next,
      int: (n) => Math.floor(next() * n),
      range: (lo, hi) => lo + next() * (hi - lo),
      chance: (p) => next() < p,
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      },
      weighted(items, weightOf) {
        let total = 0;
        for (const it of items) total += weightOf(it);
        let roll = next() * total;
        for (const it of items) {
          roll -= weightOf(it);
          if (roll < 0) return it;
        }
        return items[items.length - 1];
      },
    };
    return rng;
  };
})();
