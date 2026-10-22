/* Daily and weekly missions: generated from the date (so they are stable all day), tracked after each run,
   paid out automatically when completed. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});
  const M = () => BR.Storage.data.profile.missions;

  /* Four tiers of ask, chosen from the player's skill rating (the tile director's, kept on the device) so a mission is a real ask for a
     casual player and for a sharp one (tests/balance.js checks the hit rates). A brand-new player starts at the gentlest tier. */
  const T = {
    bricks: { type: 'sum', text: (n) => `Pop ${n} bricks`, targets: [150, 250, 400, 600], reward: [25, 30, 40, 45], get: (s) => s.bricks },
    color: { type: 'sum', text: (n, m) => `Pop ${n} ${BR.COLOR_NAMES[m.color]} bricks`, targets: [30, 45, 60, 80], reward: [30, 35, 40, 45], get: (s, m) => s.colors[m.color] || 0 },
    stage: { type: 'max', text: (n) => `Reach stage ${n}`, targets: [4, 6, 8, 9], reward: [30, 40, 50, 55], get: (s, m, mode) => (mode === 'chill' ? 0 : s.stage) },
    rushRun: { type: 'max', text: (n) => `Trigger Rush Mode ${n} times in one run`, targets: [2, 3, 4, 5], reward: [40, 50, 60, 65], get: (s) => s.rushes },
    big: { type: 'max', text: (n) => `Pop a group of ${n} or more`, targets: [8, 12, 13, 15], reward: [30, 40, 50, 60], get: (s) => s.biggest },
    power: { type: 'sum', text: (n) => `Use ${n} power-ups`, targets: [3, 6, 10, 14], reward: [30, 35, 45, 50], get: (s) => s.powerUsed },
    defuse: { type: 'sum', text: (n) => `Defuse ${n} Fuse bricks`, targets: [2, 3, 5, 8], reward: [30, 40, 50, 55], get: (s) => s.defused || 0, minBest: 4 },
    runs: { type: 'sum', text: (n) => `Play ${n} runs`, targets: [2, 3, 4, 5], reward: [20, 25, 30, 35], get: () => 1 },
    dailyScore: { type: 'max', text: (n) => `Score ${n.toLocaleString('en-US')} in Daily Rush`, targets: [30000, 60000, 120000, 210000], reward: [40, 50, 60, 70], get: (s, m, mode) => (mode === 'daily' ? s.score : 0) },
  };
  const WEEKLY = {
    weeklyStage: { type: 'max', text: (n) => `Reach stage ${n}`, targets: [6, 8, 9, 10], get: (s, m, mode) => (mode === 'chill' ? 0 : s.stage) },
    weeklyBricks: { type: 'sum', text: (n) => `Pop ${n.toLocaleString('en-US')} bricks`, targets: [1500, 2500, 4000, 6000], get: (s) => s.bricks },
  };
  BR.MISSION_KINDS = T;

  /** 0 to 3 from the skill rating (a new player is at the gentlest tier until they have a few runs behind them). */
  const tierFor = (level, skill) => {
    const s = Number.isFinite(skill) ? skill : 0.4;
    let t = s < 0.35 ? 0 : s < 0.58 ? 1 : s < 0.78 ? 2 : 3;
    if (level < 3) t = 0; else if (level < 6) t = Math.min(t, 1);
    return t;
  };
  BR.missionTier = tierFor;

  function make(kind, rng, level) {
    const t = T[kind], i = tierFor(level, BR.Storage.data.profile.skill);
    const m = { id: kind + '-' + Math.floor(rng.next() * 1e6), kind, target: t.targets[i], progress: 0, reward: t.reward[i], done: false };
    if (kind === 'color') m.color = rng.int(5);
    m.text = t.text(m.target, m);
    return m;
  }

  function eligible() {
    const best = Math.max(BR.Storage.data.bestStage.rush, BR.Storage.data.bestStage.daily);
    return Object.keys(T).filter((k) => !(T[k].minBest && best < T[k].minBest - 1));
  }

  BR.Missions = {
    /** Make sure today's and this week's missions exist. Returns the mission state. */
    ensure() {
      const m = M(), day = BR.dayKey(), week = BR.weekKey(), level = BR.Storage.data.profile.level;
      if (m.day !== day) {
        const rng = BR.makeRng(BR.dailySeed('m' + day));
        const kinds = rng.shuffle(eligible()).slice(0, 3);
        m.day = day; m.rerolls = 0;
        m.list = kinds.map((k) => make(k, rng, level));
        BR.Storage.save();
      }
      // a mission kind that no longer exists (Line Blast missions were removed in Update 5) is swapped for another one, free
      if (m.list.some((x) => !T[x.kind])) {
        const used = new Set(m.list.filter((x) => T[x.kind]).map((x) => x.kind)), rng = BR.makeRng(BR.dailySeed('x' + day));
        const pool = eligible().filter((k) => !used.has(k));
        m.list = m.list.map((x) => (T[x.kind] ? x : make(rng.pick(pool.length ? pool : eligible()), rng, level)));
        BR.Storage.save();
      }
      if (m.week !== week) {
        const rng = BR.makeRng(BR.dailySeed('w' + week));
        const kind = rng.pick(Object.keys(WEEKLY));
        const w = WEEKLY[kind];
        m.week = week;
        const target = w.targets[tierFor(level, BR.Storage.data.profile.skill)];
        m.weekly = { id: kind, kind, text: w.text(target), target, progress: 0, reward: 250, chest: 'golden', done: false };
        BR.Storage.save();
      }
      return m;
    },

    canReroll(i) {
      const m = this.ensure();
      return m.rerolls < 1 && m.list[i] && !m.list[i].done && BR.Progress.coins >= BR.CFG.rerollCost;
    },
    reroll(i) {
      if (!this.canReroll(i)) return false;
      const m = M();
      BR.Progress.spend(BR.CFG.rerollCost);
      m.rerolls++;
      const rng = BR.makeRng(BR.dailySeed('r' + m.day + m.rerolls + i));
      const used = new Set(m.list.map((x) => x.kind));
      const pool = eligible().filter((k) => !used.has(k));
      m.list[i] = make(rng.pick(pool.length ? pool : eligible()), rng, BR.Storage.data.profile.level);
      BR.Storage.save();
      return true;
    },

    /**
     * Apply a finished run. Pays out every mission it completes.
     * Returns [{ mission, before, after, justDone, weekly }] for the results screen.
     */
    applyRun(summary, mode) {
      const m = this.ensure(), out = [];
      const step = (mission, def, weekly) => {
        if (mission.done) return;
        const before = mission.progress;
        const v = def.get(summary, mission, mode);
        if (def.type === 'sum') mission.progress = Math.min(mission.target, mission.progress + v);
        else mission.progress = Math.min(mission.target, Math.max(mission.progress, v));
        let justDone = false;
        if (mission.progress >= mission.target) {
          mission.done = true; justDone = true;
          BR.Progress.earn(mission.reward);
          if (mission.chest) mission.chestCoins = BR.Progress.addChest(mission.chest, 1);
        }
        if (mission.progress !== before || justDone) out.push({ mission, before, after: mission.progress, justDone, weekly: !!weekly });
      };
      m.list.forEach((mi) => step(mi, T[mi.kind], false));
      if (m.weekly) step(m.weekly, WEEKLY[m.weekly.kind], true);
      BR.Storage.save();
      return out;
    },
  };
})();
