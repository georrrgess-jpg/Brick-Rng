/* Persistence (schema v3): settings, scores, profile (level, XP, Coins, chests, items, missions).
   Migrates Update 1 (Shardfall v2) saves. Every localStorage access is guarded. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});
  const KEY = 'poprush.v3';
  const RUN_KEY = 'poprush.run';
  const V2_KEY = 'shardfall.v2';

  const prefersReduced = (() => { try { return G.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  const defaults = () => ({
    v: 3,
    best: { rush: 0, daily: 0, chill: 0 },
    bestStage: { rush: 0, daily: 0, chill: 0 },
    runs: 0,
    seenTutorial: false,
    lastDay: '',
    installNudged: false,
    settings: { sound: true, music: true, haptics: true, shake: true, shapes: false, reduced: prefersReduced, perf: 'auto' },
    daily: { day: '', score: 0, stage: 0 },
    profile: {
      level: 1, xp: 0, coins: BR.CFG ? BR.CFG.startCoins : 200,
      chests: { brick: 1, pop: 0, board: 0, fuse: 0, golden: 0 }, // one welcome chest so the opening is easy to find
      vault: [], // { uid, itemId, shine, seed, counter }
      loadout: { skin: 'default', pop: 'default', board: 'default', fuse: 'default' },
      seq: 0, opened: 0, passTier: 0,
      missions: { day: '', list: [], rerolls: 0, week: '', weekly: null },
      trophies: {},
      stats: { runs: 0, bricks: 0, rushes: 0, bigPops: 0, powerups: 0, lineBlasts: 0, stages: 0, coinsEarned: 0, chests: 0, dailyRuns: 0, bestCombo: 0, maxGroup: 0, defused: 0 },
    },
  });

  function read(key) {
    try { const raw = G.localStorage && G.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function deepMerge(base, over) {
    if (!over || typeof over !== 'object') return base;
    for (const k of Object.keys(over)) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && over[k] && typeof over[k] === 'object') deepMerge(base[k], over[k]);
      else base[k] = over[k];
    }
    return base;
  }

  const SHINE_MAP = { matte: 'plain', gloss: 'glossy', holo: 'holo', prism: 'prism' };
  const COUNTER_MAP = { 'Bricks popped': 'Bricks popped', 'Biggest group': 'Biggest pop', 'Rounds cleared': 'Stages reached' };
  const TYPE_MAP = { facet: 'skin', burst: 'pop', arena: 'board' };

  /** Update 1 -> Update 2: Shards become Coins, unopened Geodes become Coins, items keep their ids. */
  function migrateV2(old) {
    const d = defaults();
    d.best.rush = 0; d.best.chill = old.best || 0;
    d.runs = old.runs || 0;
    d.seenTutorial = !!old.seenTutorial;
    d.lastDay = old.lastDay || '';
    Object.assign(d.settings, old.settings || {});
    const op = old.profile || {};
    const pr = d.profile;
    pr.level = op.level || 1;
    pr.xp = Math.min(op.xp || 0, BR.xpForLevel(pr.level) - 1);
    const g = op.geodes || {};
    pr.coins = (op.shards || 0) + (g.normal || 0) * 300 + (g.series || 0) * 600 + BR.CFG.startCoins;
    pr.chests = { brick: 0, pop: 0, board: 0, fuse: 0, golden: 0 };
    pr.vault = (op.vault || []).filter((i) => BR.itemById[i.itemId]).map((i) => ({
      uid: i.uid, itemId: i.itemId, shine: SHINE_MAP[i.finish] || 'plain', seed: i.seed || 0,
      counter: i.tracker ? { stat: COUNTER_MAP[i.tracker.stat] || i.tracker.stat, value: i.tracker.value || 0 } : null,
    }));
    pr.seq = op.seq || 0;
    pr.opened = op.opened || 0;
    const lo = op.loadout || {};
    for (const k of Object.keys(lo)) { const t = TYPE_MAP[k]; if (t) pr.loadout[t] = lo[k] === 'default' || pr.vault.some((i) => i.uid === lo[k]) ? lo[k] : 'default'; }
    pr.passTier = Math.max(0, pr.level - 1); // tiers below the current level count as claimed
    return d;
  }

  function load() {
    const d = defaults();
    const cur = read(KEY);
    if (cur) return deepMerge(d, cur);
    const v2 = read(V2_KEY);
    if (v2 && BR.itemById) return migrateV2(v2);
    return d;
  }

  let data = load();
  let timer = 0;

  BR.Storage = {
    get data() { return data; },
    save() { try { G.localStorage && G.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } },
    /** Coalesce rapid saves (called a lot during play). */
    saveSoon() { clearTimeout(timer); timer = setTimeout(() => this.save(), 400); },
    reset() { data = defaults(); this.save(); this.clearRun(); },
    saveRun(snap) { try { G.localStorage && G.localStorage.setItem(RUN_KEY, JSON.stringify(snap)); } catch (e) { /* ignore */ } },
    loadRun() { return read(RUN_KEY); },
    clearRun() { try { G.localStorage && G.localStorage.removeItem(RUN_KEY); } catch (e) { /* ignore */ } },
    _defaults: defaults,
    _migrateV2: migrateV2,
  };
})();
