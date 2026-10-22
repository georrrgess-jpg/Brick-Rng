global.window = global;
for (const f of ['rng', 'board', 'config', 'boosters', 'director', 'engine']) require('/home/user/Brick-Rng/js/' + f + '.js');
const BR = global.BR;
for (const [name, sk, rating] of [['casual', { think: 1.8, lock: 0.5, greedy: 0.4 }, 0.46], ['average', { think: 1.2, lock: 0.5, greedy: 0.8 }, 0.76], ['sharp', { think: 0.8, lock: 0.45, greedy: 0.95 }, 0.91]]) {
  let rushT = 0, allT = 0, comboPops = 0, pops = 0, multAt4 = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const e = new BR.Engine({ seed: seed * 7919, mode: 'rush', skill: rating }); const rng = BR.makeRng(seed);
    const adv = (s) => { for (let t = 0; t < s && !e.over; t += 0.05) { const d = Math.min(0.05, s - t); if (e.rush.active) rushT += d; allT += d; e.tick(d); } };
    let g = 0;
    while (!e.over && g++ < 5000 && e.time < 1500) {
      const taps = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p) taps.push(p); }
      adv(e.spark > 0 ? 0.6 : Math.max(0.25, sk.think * (0.6 + rng.next() * 0.8))); if (e.over) break;
      const p = e.spark > 0 || rng.chance(sk.greedy) ? taps.reduce((a, b) => (b.n > a.n ? b : a)) : rng.pick(taps);
      const res = e.commit(p); pops++; if (p.combo > 1) comboPops++; if (p.combo >= 4) multAt4++;
      if (res.stageUp) adv(0.9); adv(sk.lock);
    }
  }
  console.log(name.padEnd(8), 'time in Rush', Math.round(100 * rushT / allT) + '%', '| pops with a combo', Math.round(100 * comboPops / pops) + '%', '| pops at the x4 combo cap', Math.round(100 * multAt4 / pops) + '%');
}
