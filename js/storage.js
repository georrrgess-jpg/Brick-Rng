/* Persistence (schema v2): settings, best score, profile (level, XP, Geodes, Shards, Vault, loadout).
   Migrates v1 saves. Every localStorage access is guarded, so the game also runs where storage is blocked. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});
  const KEY = 'shardfall.v2';
  const OLD_KEY = 'brickrng.v1';

  const prefersReduced = (() => {
    try { return G.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  })();

  const defaults = () => ({
    v: 2,
    best: 0,
    runs: 0,
    seenTutorial: false,
    lastDay: '',
    settings: { sound: true, shake: true, shapes: false, reduced: prefersReduced },
    profile: {
      level: 1, xp: 0, shards: 0,
      geodes: { normal: 1, series: 0 }, // one welcome Geode so a new player can see the opening
      vault: [], // instances: { uid, itemId, finish, seed, tracker }
      loadout: { facet: 'default', burst: 'default', arena: 'default' },
      seq: 0, opened: 0,
    },
  });

  function read(key) {
    try { const raw = G.localStorage && G.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  function load() {
    const d = defaults();
    const cur = read(KEY);
    if (cur) {
      Object.assign(d, cur);
      d.settings = Object.assign(defaults().settings, cur.settings || {});
      d.profile = Object.assign(defaults().profile, cur.profile || {});
      d.profile.geodes = Object.assign({ normal: 0, series: 0 }, (cur.profile && cur.profile.geodes) || {});
      d.profile.loadout = Object.assign(defaults().profile.loadout, (cur.profile && cur.profile.loadout) || {});
      return d;
    }
    const old = read(OLD_KEY);
    if (old) {
      // v1 -> v2: keep scores and settings; turn each discovered Core into 50 Shards.
      d.best = old.best || 0;
      d.runs = old.runs || 0;
      d.seenTutorial = !!old.seenTutorial;
      d.settings = Object.assign(d.settings, old.settings || {});
      d.profile.shards = 50 * Object.keys(old.collection || {}).length;
    }
    return d;
  }

  let data = load();

  BR.Storage = {
    get data() { return data; },
    save() { try { G.localStorage && G.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } },
    reset() { data = defaults(); this.save(); },
    _defaults: defaults,
  };
})();
