/* Reasons to come back, all on the device (no server, no accounts):
   - Streak: a 7-day ring on Home. One finished run a day lights a day. Day 3 pays Coins, day 7 pays Coins and a Golden Chest,
     then the ring starts again. One missed day per week is forgiven by a shield, and a broken streak loses only the week in
     progress (the weeks already completed stay). Missing a day never takes away anything the player already has.
   - Run goals: one small goal per Rush run ("Make a Line Blast"), chosen from what the player has not done lately and harder
     with level. Hitting it pays a few Coins.
   - Records: best score, stage, biggest pop and more, plus the last 20 runs.
   - Next goal: the nearest thing in reach, shown under the score on the results.
   Pure logic over Storage, so it runs in Node tests. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});
  const P = () => BR.Storage.data.profile;
  const fmt = (n) => (BR.fmt ? BR.fmt(n) : String(n));
  const save = () => BR.Storage.save();

  /** Whole days from one day key to another (2026-10-21 to 2026-10-23 is 2). */
  const dayDiff = (a, b) => {
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  };
  BR.dayDiff = dayDiff;

  /* ------------------------------------------------------------------ streak */
  const blank = () => ({ ring: 0, weeks: 0, last: '', shield: 1, best: 0 });
  const get = () => { const p = P(); if (!p.streak || typeof p.streak !== 'object') p.streak = blank(); return p.streak; };

  BR.Streak = {
    LEN: 7,
    /** What the ring looks like today: days lit, whether today is already played, what the next prize is. */
    status(today = BR.dayKey()) {
      const s = get(), C = BR.CFG.streak;
      const playedToday = s.last === today;
      const gap = s.last ? dayDiff(s.last, today) : 0;
      // a ring that has not been continued in time is shown as starting over (it restarts when the next run finishes)
      const alive = !s.last || playedToday || gap === 1 || (gap === 2 && s.shield > 0);
      let ring = alive ? s.ring : 0;
      if (ring >= this.LEN && !playedToday) ring = 0;           // a finished week starts a new one
      const next = ring < 3 ? 3 : ring < this.LEN ? this.LEN : 3;
      return { ring, playedToday, alive, shield: s.shield > 0, weeks: s.weeks, best: s.best, next, nextPrize: next === 3 ? { coins: C.day3 } : { coins: C.day7Coins, chest: C.day7Chest }, daysToNext: Math.max(0, next - ring) };
    },
    /** Called when a run finishes. Advances the ring once per day and pays the prize. Returns null when today was already counted. */
    advance(today = BR.dayKey()) {
      const s = get(), C = BR.CFG.streak;
      if (s.last === today) return null;
      const out = { shielded: false, broken: false, lost: 0, coins: 0, chest: null };
      if (s.ring >= this.LEN) { s.ring = 0; s.weeks++; s.shield = 1; }
      const gap = s.last ? dayDiff(s.last, today) : 1;
      if (gap <= 1) s.ring++;
      else if (gap === 2 && s.shield > 0) { s.shield--; s.ring++; out.shielded = true; }
      else { out.broken = s.ring > 0; out.lost = s.ring; s.ring = 1; s.shield = 1; }
      s.last = today;
      if (s.ring === 3) out.coins = C.day3;
      if (s.ring === this.LEN) { out.coins = C.day7Coins; out.chest = C.day7Chest; }
      s.best = Math.max(s.best, s.weeks * this.LEN + s.ring);
      if (out.coins) BR.Progress.earn(out.coins);
      if (out.chest) out.chestPaid = BR.Progress.addChest(out.chest, 1);
      out.ring = s.ring; out.weeks = s.weeks;
      save();
      return out;
    },
  };

  /* ------------------------------------------------------------------ run goals */
  // test(summary) is true once the goal is met. min* keep the early goals gentle; reward grows with the ask.
  const GOALS = [
    { id: 'power', text: 'Use a power-up', reward: 10, test: (s) => s.powerUsed >= 1, minLevel: 1, maxLevel: 12 },
    { id: 'big8', text: 'Pop 8 or more bricks at once', reward: 10, test: (s) => s.biggest >= 8, minLevel: 1, maxLevel: 8 },
    { id: 'rush', text: 'Start Rush Mode', reward: 15, test: (s) => s.rushes >= 1, minLevel: 2, maxLevel: 99 },
    { id: 'line', text: 'Make a Line Blast', reward: 15, test: (s) => s.lineBlasts >= 1, minLevel: 3, maxLevel: 99 },
    { id: 'chain', text: 'Chain 4 big pops in a row', reward: 15, test: (s) => s.maxCombo >= 4, minLevel: 4, maxLevel: 99 },
    { id: 'big12', text: 'Pop 12 or more bricks at once', reward: 15, test: (s) => s.biggest >= 12, minLevel: 5, maxLevel: 99 },
    { id: 'defuse', text: 'Defuse a Fuse brick', reward: 20, test: (s) => (s.defused || 0) >= 1, minLevel: 6, maxLevel: 99, minStage: 4 },
    { id: 'rush2', text: 'Start Rush Mode twice', reward: 20, test: (s) => s.rushes >= 2, minLevel: 7, maxLevel: 99 },
    { id: 'stage', stage: true, reward: 20, minLevel: 3, maxLevel: 99 },
  ];
  BR.GOALS = GOALS;

  BR.Goals = {
    /** Pick this run's goal. `rng` is any object with next() in [0,1). Avoids the last few goals; the stage goal asks for your usual stage. */
    pick(rng = { next: Math.random }) {
      const p = P(), level = p.level, best = Math.max(BR.Storage.data.bestStage.rush || 0, 0);
      const hist = (p.goalHist = Array.isArray(p.goalHist) ? p.goalHist : []);
      let pool = GOALS.filter((g) => level >= g.minLevel && level <= g.maxLevel && !(g.minStage && best < g.minStage - 1) && !hist.includes(g.id));
      if (!pool.length) pool = GOALS.filter((g) => level >= g.minLevel && level <= g.maxLevel);
      const g = pool[Math.floor(rng.next() * pool.length) % pool.length];
      const goal = { id: g.id, reward: g.reward, done: false };
      if (g.stage) { goal.target = Math.max(3, Math.min(best + (best >= 8 ? 0 : 1), 10)); goal.text = `Reach stage ${goal.target}`; }
      else goal.text = g.text;
      hist.push(g.id); while (hist.length > 3) hist.shift();
      save();
      return goal;
    },
    /** Is the goal met by this (running or finished) summary? */
    met(goal, sum) {
      if (!goal) return false;
      if (goal.id === 'stage') return sum.stage >= goal.target;
      const g = GOALS.find((x) => x.id === goal.id);
      return !!g && g.test(sum);
    },
  };

  /* ------------------------------------------------------------------ records */
  BR.Records = {
    /** Update after a finished run. Returns which records this run broke. */
    update(sum, mode) {
      const p = P(), rec = (p.records = p.records && typeof p.records === 'object' ? p.records : { maxLines: 0, maxRushes: 0, history: [] });
      const broke = [];
      if ((sum.lineBlasts || 0) > (rec.maxLines || 0)) { rec.maxLines = sum.lineBlasts; if (sum.lineBlasts >= 2) broke.push('Line Blasts in a run'); }
      if ((sum.rushes || 0) > (rec.maxRushes || 0)) { rec.maxRushes = sum.rushes; }
      if (mode === 'rush') { rec.history = (rec.history || []).concat([sum.score]).slice(-20); }
      save();
      return broke;
    },
    list() {
      const st = BR.Storage.data, p = P(), rec = p.records || {};
      return {
        bestScore: st.best.rush || 0, bestStage: st.bestStage.rush || 0, biggestPop: p.stats.maxGroup || 0, bestCombo: p.stats.bestCombo || 0,
        maxLines: rec.maxLines || 0, maxRushes: rec.maxRushes || 0, runs: st.runs || 0, history: (rec.history || []).slice(-20),
      };
    },
  };

  /* ------------------------------------------------------------------ the next thing in reach */
  /** One line for the results: the closest reward or record the player could reach next. `ctx` = { stage, score, isBest }. */
  BR.nextGoal = function (ctx) {
    const P_ = BR.Progress, cand = [];
    // coins to the cheapest chest that can still give something
    const chests = BR.CHEST_ORDER.map((id) => ({ id, c: BR.CHESTS[id], st: P_.chestStatus(id) })).filter((x) => !x.st.complete && x.c.cost != null).sort((a, b) => a.c.cost - b.c.cost);
    if (chests.length && P_.chestCount(chests[0].id) === 0) {
      const need = chests[0].c.cost - P_.coins;
      if (need > 0) cand.push({ near: need / Math.max(40, chests[0].c.cost), text: `${fmt(need)} more Coins opens a ${chests[0].c.name}` });
    }
    // Pop Pass: the next milestone (a chest or an item) and how many levels away it is
    for (let t = P_.level; t < P_.level + 6; t++) {
      const r = BR.passReward(t);
      if (r.kind !== 'coins') { const away = t + 1 - P_.level; cand.push({ near: away / 6 + 0.05, text: `${away} level${away > 1 ? 's' : ''} to ${BR.rewardLabel(r)} on the Pop Pass` }); break; }
    }
    // the stage record
    const bs = BR.Storage.data.bestStage.rush || 0;
    if (ctx && ctx.stage >= bs - 1 && ctx.stage > 0) cand.push({ near: 0.3, text: `Stage ${ctx.stage + 1} would be a new record` });
    // the streak
    const ss = BR.Streak.status();
    if (ss.playedToday && ss.ring > 0 && ss.ring < BR.Streak.LEN) cand.push({ near: ss.daysToNext / 7 + 0.1, text: `${ss.daysToNext} more day${ss.daysToNext > 1 ? 's' : ''} to the next streak prize` });
    if (!cand.length) return '';
    cand.sort((a, b) => a.near - b.near);
    return cand[0].text;
  };
})();
