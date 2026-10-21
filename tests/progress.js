// Pure-logic tests for items, drops, XP, Geodes, Vault and Fusion. Run: node tests/progress.js
global.window = global;
for (const f of ['rng', 'config', 'items', 'storage', 'progress']) require('../js/' + f + '.js');
const BR = global.BR;
const assert = require('assert');

// --- catalogue
assert.strictEqual(BR.ITEMS.length, 18, '18 items in Series 1');
const by = (t) => BR.ITEMS.filter((i) => i.type === t).length;
assert.deepStrictEqual([by('facet'), by('burst'), by('arena')], [8, 5, 5]);
for (const r of BR.RARITIES) assert(BR.ITEMS.some((i) => i.rarity === r.id), 'every rarity has an item: ' + r.id);

// --- odds over a big sample
const rng = BR.makeRng(42);
const N = 60000, tally = {}, fin = {}, types = {}; let trackers = 0;
for (let i = 0; i < N; i++) {
  const d = BR.rollDrop(rng, 'normal');
  tally[d.rarity] = (tally[d.rarity] || 0) + 1; fin[d.finish] = (fin[d.finish] || 0) + 1; types[d.type] = (types[d.type] || 0) + 1;
  if (d.tracker) trackers++;
  assert(BR.itemById[d.itemId] && BR.itemById[d.itemId].rarity === d.rarity);
}
const pct = (n) => ((n / N) * 100).toFixed(1);
console.log('rarity %', Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, pct(v)])));
console.log('finish %', Object.fromEntries(Object.entries(fin).map(([k, v]) => [k, pct(v)])), 'tracker %', pct(trackers), 'types %', Object.fromEntries(Object.entries(types).map(([k, v]) => [k, pct(v)])));
assert(Math.abs(tally.rough / N - 0.6) < 0.01 && Math.abs(tally.celestial / N - 0.01) < 0.004);
assert(Math.abs(trackers / N - 0.1) < 0.01 && Math.abs(fin.matte / N - 0.55) < 0.015);
assert.strictEqual(BR.rollDrop(rng, 'normal', 4).rarity, 'celestial', 'forced rarity works');

// --- XP / levels / Geodes
const P = BR.Progress;
assert.strictEqual(P.geodeCount(), 1, 'welcome Geode');
let res = P.addXp(499); assert.strictEqual(res.ups.length, 0); assert.strictEqual(P.level, 1);
res = P.addXp(1); assert.strictEqual(res.ups.length, 1); assert.strictEqual(P.level, 2); assert.strictEqual(P.geodeCount(), 2);
// climb to level 5: must grant a Series Geode exactly at level 5
P.addXp(1e6);
console.log('level after 1M xp', P.level, 'geodes', JSON.stringify(BR.Storage.data.profile.geodes));
const lv5 = (BR.Storage.data.profile.geodes.series);
assert(lv5 >= 1, 'series geodes granted on every 5th level');

// --- open, keep, dust, equip
const before = P.geodeCount();
const drop = P.openGeode();
assert(drop && P.geodeCount() === before - 1);
const inst = P.keep(drop);
assert(P.owns(drop.itemId) && P.instance(inst.uid));
assert.strictEqual(P.equipped(drop.type).item.id, BR.DEFAULTS[drop.type].id, 'default until equipped');
P.equip(inst.uid); assert.strictEqual(P.equipped(drop.type).inst.uid, inst.uid);
const dup = BR.rollDrop(rng); dup.rarity = 'rough';
assert.strictEqual(P.dust({ rarity: 'polished' }), 25);

// --- fusion
const P2 = BR.Storage.data.profile;
P2.vault.length = 0; P2.loadout = { facet: 'default', burst: 'default', arena: 'default' };
const ids = [];
for (let i = 0; i < 5; i++) ids.push(P.keep({ itemId: 'f_candy', finish: 'matte', seed: i, tracker: null }).uid);
assert(P.canFuse(ids).ok);
assert(!P.canFuse(ids.slice(0, 4)).ok);
const fused = P.fuse(ids);
assert.strictEqual(fused.rarity, 'polished'); assert.strictEqual(P2.vault.length, 1, 'five consumed, one granted');
const mixed = [P.keep({ itemId: 'f_candy', finish: 'matte', seed: 0 }).uid, P.keep({ itemId: 'f_marble', finish: 'matte', seed: 0 }).uid];
assert(!P.canFuse(mixed.concat(['x', 'y', 'z'])).ok);

// --- shards -> geode
P2.shards = 249; assert(!P.buyGeode()); P2.shards = 250; const sg = P2.geodes.series; assert(P.buyGeode() && P2.geodes.series === sg + 1 && P2.shards === 0);

// --- trackers
const t = P.keep({ itemId: 'f_neon', finish: 'gloss', seed: 1, tracker: { stat: 'Bricks popped', value: 0 } });
P.equip(t.uid); P.trackRun({ bricks: 120, biggest: 9, rounds: 3 });
assert.strictEqual(P.instance(t.uid).tracker.value, 120);

// --- storage v1 migration
global.localStorage = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; } };
localStorage.setItem('brickrng.v1', JSON.stringify({ best: 5000, runs: 7, collection: { spark: {}, bomb: {}, midas: {} }, settings: { sound: false } }));
delete require.cache[require.resolve('../js/storage.js')];
require('../js/storage.js');
const m = BR.Storage.data;
assert.strictEqual(m.best, 5000); assert.strictEqual(m.runs, 7); assert.strictEqual(m.profile.shards, 150); assert.strictEqual(m.settings.sound, false);
console.log('progress tests passed');
