/* localStorage persistence: best score, collection, settings. Every access is guarded. */
(function () {
  const BR = (window.BR = window.BR || {});
  const KEY = 'brickrng.v1';

  const prefersReduced = (() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  })();

  const defaults = () => ({
    best: 0,
    runs: 0,
    seenTutorial: false,
    collection: {}, // coreId -> { count, first }
    settings: { sound: true, shake: true, shapes: true, reduced: prefersReduced },
  });

  let data = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      data = Object.assign(defaults(), parsed, { settings: Object.assign(defaults().settings, parsed.settings || {}) });
    }
  } catch (e) { /* storage unavailable: run in memory */ }

  BR.Storage = {
    get data() { return data; },
    save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } },
    reset() { data = defaults(); this.save(); },
    isNew(coreId) { return !data.collection[coreId]; },
    record(coreId) {
      const e = data.collection[coreId] || (data.collection[coreId] = { count: 0, first: Date.now() });
      e.count++;
      this.save();
    },
    discovered() { return Object.keys(data.collection).length; },
  };
})();
