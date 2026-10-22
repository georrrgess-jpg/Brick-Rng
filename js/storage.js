/* Persistence (schema v4): settings, scores, profile (level, XP, Coins, chests, items, missions).
   Migrates Update 1 (Shardfall v2) saves. Every localStorage access is guarded. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});
  const KEY = 'poprush.v4';
  const V3_KEY = 'poprush.v3';
  const RUN_KEY = 'poprush.run';
  const V2_KEY = 'shardfall.v2';

  const prefersReduced = (() => { try { return G.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  const defaults = () => ({
    v: 4,
    best: { rush: 0, daily: 0, chill: 0 },
    bestStage: { rush: 0, daily: 0, chill: 0 },
    runs: 0,
    seenTutorial: false,
    lastDay: '',
    installNudged: false,
    settings: { sound: true, music: true, haptics: true, shake: true, shapes: false, large: false, reduced: prefersReduced, perf: 'auto', musicVol: 0.7, sfxVol: 1 },
    seen: {},                       // coach cards and one-time hints already shown
    recent: { rush: [], daily: [], chill: [] }, // last scores per mode (for the score to beat)
    daily: { day: '', score: 0, stage: 0 },
    profile: {
      name: 'Player',                  // shown on the Profile (stays on this device)
      level: 1, xp: 0, coins: BR.CFG ? BR.CFG.startCoins : 200,
      chests: { brick: 1, pop: 0, board: 0, fuse: 0, golden: 0 }, // one welcome chest so the opening is easy to find
      vault: [], // { uid, itemId, shine, seed }  (one entry per item: chests never give duplicates)
      pity: { skin: 0, pop: 0, board: 0, fuse: 0 }, // chests opened since the last Epic or better, per type
      loadout: { skin: 'default', pop: 'default', board: 'default', fuse: 'default' },
      seq: 0, opened: 0, passTier: 0, passClaimed: 0,
      missions: { day: '', list: [], rerolls: 0, week: '', weekly: null },
      trophies: {},
      streak: { ring: 0, weeks: 0, last: '', shield: 1, best: 0 },   // the daily ring (js/retention.js)
      goalHist: [],                                                // the last run goals, so they do not repeat
      records: { maxLines: 0, maxRushes: 0, history: [] },         // extra personal records and the last 20 Rush scores
      stats: { runs: 0, bricks: 0, rushes: 0, bigPops: 0, powerups: 0, lineBlasts: 0, stages: 0, coinsEarned: 0, chests: 0, dailyRuns: 0, bestCombo: 0, maxGroup: 0, defused: 0 },
    },
  });

  function read(key) {
    try { const raw = G.localStorage && G.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function deepMerge(base, over) {
    if (!over || typeof over !== 'object') return base;
    for (const k of Object.keys(over)) {
      if (over[k] === null && base[k] && typeof base[k] === 'object') continue;   // a null in a hand-edited save must not wipe a default object
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && over[k] && typeof over[k] === 'object') deepMerge(base[k], over[k]);
      else base[k] = over[k];
    }
    return base;
  }

  const SHINE_MAP = { matte: 'plain', gloss: 'glossy', holo: 'holo', prism: 'prism' };
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
    }));
    pr.seq = op.seq || 0;
    pr.opened = op.opened || 0;
    const lo = op.loadout || {};
    for (const k of Object.keys(lo)) { const t = TYPE_MAP[k]; if (t) pr.loadout[t] = lo[k] === 'default' || pr.vault.some((i) => i.uid === lo[k]) ? lo[k] : 'default'; }
    pr.passTier = Math.max(0, pr.level - 1); // tiers below the current level count as claimed
    return normalize(d, 0).data;
  }

  /**
   * Update 3: a chest never gives the same item twice. Collapse any duplicates in an older save into one copy each
   * (the equipped copy wins) and refund their old sell value so nobody loses Coins. Returns { data, refund }.
   */
  function normalize(d, extraRefund) {
    const pr = d.profile;
    const equipped = new Set(Object.values(pr.loadout || {}));
    const seen = new Map(); let refund = extraRefund || 0;
    const vault = [];
    const rank = { prism: 3, holo: 2, glossy: 1 };
    const sorted = (pr.vault || []).map((v, i) => [v, i]).sort((a, b) => ((equipped.has(b[0].uid) ? 100 : 0) + (rank[b[0].shine] || 0)) - ((equipped.has(a[0].uid) ? 100 : 0) + (rank[a[0].shine] || 0)) || a[1] - b[1]).map((x) => x[0]);   // equipped copy first, then the best Shine
    for (const inst of sorted) {
      const item = BR.itemById && BR.itemById[inst.itemId];
      if (!item) continue;
      if (seen.has(inst.itemId)) { refund += BR.rarityById[item.rarity].refund; const keep = seen.get(inst.itemId); for (const k of Object.keys(pr.loadout || {})) if (pr.loadout[k] === inst.uid) pr.loadout[k] = keep.uid; continue; }
      const clean = { uid: inst.uid, itemId: inst.itemId, shine: inst.shine || 'plain', seed: inst.seed || 0 };
      seen.set(inst.itemId, clean); vault.push(clean);
    }
    pr.vault = vault;
    pr.coins = (pr.coins || 0) + refund;
    pr.pity = Object.assign({ skin: 0, pop: 0, board: 0, fuse: 0 }, pr.pity || {});
    if (BR.xpForLevel) pr.xp = Math.min(pr.xp || 0, BR.xpForLevel(pr.level || 1) - 1);
    if (refund > 0) d.notice = { kind: 'dupes', coins: refund };
    d.v = 4;
    return { data: d, refund };
  }

  function load() {
    const d = defaults();
    const cur = read(KEY);
    if (cur) return deepMerge(d, cur);
    // a v4 save that exists but cannot be parsed is kept aside before anything older is tried
    try { const raw = G.localStorage && G.localStorage.getItem(KEY); if (raw) G.localStorage.setItem(KEY + '.corrupt', raw); } catch (e) { /* ignore */ }
    const v3 = read(V3_KEY);
    if (v3 && BR.itemById) return normalize(deepMerge(d, v3), 0).data;
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
    /** A save code: the whole save as one line of text, with a checksum, so progress can be moved or kept safe without an account. */
    exportCode() {
      const json = JSON.stringify(data);
      let h = 2166136261; for (let i = 0; i < json.length; i++) { h ^= json.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      const b64 = G.btoa ? G.btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, 'utf8').toString('base64');
      return 'POPRUSH4.' + h.toString(36) + '.' + b64;
    },
    /** Read a save code. Returns the save, or null when the text is not a whole, valid code (nothing is changed). */
    parseCode(text) {
      try {
        const m = /^POPRUSH4\.([0-9a-z]+)\.([A-Za-z0-9+/=]+)$/.exec(String(text).trim());
        if (!m) return null;
        const json = G.atob ? decodeURIComponent(escape(G.atob(m[2]))) : Buffer.from(m[2], 'base64').toString('utf8');
        let h = 2166136261; for (let i = 0; i < json.length; i++) { h ^= json.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
        if (h.toString(36) !== m[1]) return null;
        const o = JSON.parse(json);
        if (!o || typeof o !== 'object' || !o.profile || typeof o.profile.level !== 'number') return null;
        return deepMerge(defaults(), o);
      } catch (e) { return null; }
    },
    /** Replace the save with a parsed code. */
    restore(save) { data = save; this.save(); this.clearRun(); },
    saveRun(snap) { try { G.localStorage && G.localStorage.setItem(RUN_KEY, JSON.stringify(snap)); } catch (e) { /* ignore */ } },
    loadRun() { return read(RUN_KEY); },
    clearRun() { try { G.localStorage && G.localStorage.removeItem(RUN_KEY); } catch (e) { /* ignore */ } },
    _defaults: defaults,
    _migrateV2: migrateV2,
    _normalize: normalize,
  };
})();
