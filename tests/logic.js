// Pure-logic tests: items, odds, drops, XP/levels, Pass, Coins, chests, Trade-up, missions, migration.
global.window = global;
const mem = {};
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
for (const f of ['rng', 'config', 'boosters', 'items', 'chests', 'storage', 'pass', 'progress', 'missions']) require('../js/' + f + '.js');
const BR = global.BR;
const assert = require('assert');
const P = BR.Progress;

// ---- catalogue
assert.strictEqual(BR.ITEMS.length, 30);
assert.strictEqual(BR.DROP_ITEMS.length, 28, '28 chest items, 2 pass exclusives');
for (const t of BR.TYPE_ORDER) for (const r of BR.RARITIES) assert(BR.DROP_ITEMS.some((x) => x.type === t && x.rarity === r.id), `pool exists: ${t}/${r.id}`);
assert(!BR.DROP_ITEMS.some((x) => x.pass));

// ---- odds sum to 100 and read sensibly
for (const id of ['brick', 'pop', 'board', 'fuse', 'golden']) {
  const rows = BR.chestOdds(id, id === 'golden' ? 'skin' : null, []);
  assert(Math.abs(rows.reduce((a, r) => a + r.pct, 0) - 100) < 1e-9, 'odds sum to 100 for ' + id);
}
const rows = BR.chestOdds('brick', null, []);
assert.deepStrictEqual(rows.map((r) => r.oneIn), [2, 4, 10, 25, 100]);
console.log('sentence:', BR.oddsSentence('brick'), '|', BR.oddsSentence('golden'));

// ---- drop statistics
const rng = BR.makeRng(7), N = 60000, tally = {}, shine = {}, types = {}; let counters = 0;
for (let i = 0; i < N; i++) {
  const d = BR.rollChest(rng, 'brick');
  assert.strictEqual(d.type, 'skin'); assert(!BR.itemById[d.itemId].pass);
  tally[d.rarity] = (tally[d.rarity] || 0) + 1; shine[d.shine] = (shine[d.shine] || 0) + 1; if (d.counter) counters++;
}
const pc = (n) => (n / N) * 100;
assert(Math.abs(pc(tally.common) - 60) < 1 && Math.abs(pc(tally.mythic) - 1) < 0.4 && Math.abs(pc(counters) - 10) < 1 && Math.abs(pc(shine.plain) - 55) < 1.5);
const g = { epic: 0, legendary: 0, mythic: 0, other: 0 };
for (let i = 0; i < N; i++) { const d = BR.rollChest(rng, 'golden', 'pop'); assert.strictEqual(d.type, 'pop'); g[d.rarity in g ? d.rarity : 'other']++; }
assert.strictEqual(g.other, 0, 'golden is epic or better');
assert(Math.abs(pc(g.epic) - 70) < 1.2 && Math.abs(pc(g.mythic) - 5) < 0.6);
for (const t of BR.TYPE_ORDER) assert.strictEqual(BR.rollChest(rng, BR.ITEM_TYPES[t].chest, null, 4).rarity, 'mythic');
console.log('odds ok', JSON.stringify(Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, +pc(v).toFixed(1)]))));

// ---- Coins and XP
assert.strictEqual(P.coins, 200);
assert(P.spend(50) && P.coins === 150 && !P.spend(1000));
const rc = P.runCoins({ score: 172000, stagesCleared: 5 }, { daily: true, double: true });
assert.strictEqual(rc.mult, 3); assert.strictEqual(rc.base, 286); assert.strictEqual(rc.stages, 12 * 15);
assert.strictEqual(BR.xpForLevel(1), 400);
let res = P.addXp(399); assert.strictEqual(res.ups.length, 0);
res = P.addXp(1); assert.strictEqual(res.ups.length, 1); assert.strictEqual(P.level, 2);
assert.strictEqual(res.ups[0].tier, 1); assert.strictEqual(res.ups[0].reward.kind, 'coins');
const coinsBefore = P.coins;
P.addXp(1e6);
assert(P.level > 30, 'climbed past the pass'); assert.strictEqual(BR.Storage.data.profile.passTier, P.level - 1);
assert(BR.PASS.length === 30);
assert(P.owns('f_chrome') && P.owns('f_heart'), 'pass exclusives granted');
assert(P.chestCount('golden') >= 1 && P.chestCount('fuse') >= 1, 'pass chests granted');
assert(P.coins > coinsBefore);

// ---- opening
const bricks0 = P.chestCount('brick');
const drop = P.openChest('brick');
assert(drop && P.chestCount('brick') === bricks0 - 1, 'inventory chest consumed first');
const c0 = P.coins; BR.Storage.data.profile.chests.board = 0;
const d2 = P.openChest('board'); assert(d2 && P.coins === c0 - 400, 'paid with Coins when none owned');
BR.Storage.data.profile.coins = 10; BR.Storage.data.profile.chests.pop = 0;
assert.strictEqual(P.openChest('pop'), null, 'cannot open without Coins'); assert(!P.canOpen('pop'));
const inst = P.keep(d2); P.equip(inst.uid); assert.strictEqual(P.equipped('board').inst.uid, inst.uid);
assert.strictEqual(P.sellInstance(inst.uid), 0, 'cannot sell equipped');
P.equip('default', 'board'); assert(P.sellInstance(inst.uid) > 0);

// ---- trade-up
const pr = BR.Storage.data.profile; pr.vault.length = 0; pr.loadout = { skin: 'default', pop: 'default', board: 'default', fuse: 'default' };
const ids = []; for (let i = 0; i < 5; i++) ids.push(P.keep({ itemId: 'f_candy', shine: 'plain', seed: i, counter: null }).uid);
assert(P.canTradeUp(ids).ok);
const fused = P.tradeUp(ids); assert.strictEqual(fused.rarity, 'rare'); assert.strictEqual(fused.type, 'skin'); assert.strictEqual(pr.vault.length, 1);
const mixed = ['a', 'b', 'c', 'd', 'e'];
assert(!P.canTradeUp(mixed).ok);
const mix = [P.keep({ itemId: 'f_candy', shine: 'plain' }).uid, P.keep({ itemId: 'b_ember', shine: 'plain' }).uid, P.keep({ itemId: 'f_slate', shine: 'plain' }).uid, P.keep({ itemId: 'f_candy', shine: 'plain' }).uid, P.keep({ itemId: 'f_slate', shine: 'plain' }).uid];
assert(!P.canTradeUp(mix).ok, 'different types cannot be traded up together');

// ---- counters and trophies
const t = P.keep({ itemId: 'f_neon', shine: 'glossy', seed: 1, counter: { stat: 'Bricks popped', value: 0 } });
P.equip(t.uid); P.trackRun({ bricks: 120, biggest: 9, stagesCleared: 3, rushes: 2, bigPops: 1, powerUsed: 2, lineBlasts: 0, maxCombo: 3, defused: 1 }, 'rush');
assert.strictEqual(P.instance(t.uid).counter.value, 120);
const earned = P.checkTrophies(); assert(earned.some((x) => x.id === 'first_run') && earned.some((x) => x.id === 'first_rush'));
assert(P.checkTrophies().length === 0, 'trophies pay once');

// ---- missions
const m = BR.Missions.ensure();
assert.strictEqual(m.list.length, 3); assert(m.weekly && m.weekly.chest === 'golden');
const again = BR.Missions.ensure(); assert.strictEqual(again.list[0].id, m.list[0].id, 'stable within a day');
const kinds = new Set(m.list.map((x) => x.kind)); assert.strictEqual(kinds.size, 3, 'three different missions');
const summary = { bricks: 5000, colors: [900, 900, 900, 900, 900, 0, 0], stage: 9, rushes: 6, biggest: 14, powerUsed: 12, lineBlasts: 4, defused: 6, score: 500000 };
const coinsB = P.coins;
const ch = BR.Missions.applyRun(summary, 'daily');
assert(ch.length >= 3, 'run completes several missions'); assert(ch.every((x) => x.after <= x.mission.target));
assert(P.coins > coinsB, 'rewards paid');
assert(BR.Missions.applyRun(summary, 'daily').every((x) => !x.justDone), 'no double payout');
pr.coins = 100; const first = m.list.find((x) => !x.done);
if (first) { const idx = m.list.indexOf(first); const k = first.kind; assert(BR.Missions.reroll(idx)); assert(!BR.Missions.canReroll(idx), 'one re-roll per day'); void k; }

// ---- migration from Update 1 (Shardfall v2)
for (const k of Object.keys(mem)) delete mem[k];
mem['shardfall.v2'] = JSON.stringify({ v: 2, best: 12345, runs: 9, seenTutorial: true, settings: { sound: false },
  profile: { level: 6, xp: 100, shards: 480, geodes: { normal: 2, series: 1 }, seq: 3, opened: 5,
    vault: [{ uid: 'i1', itemId: 'f_lava', finish: 'holo', seed: 77, tracker: { stat: 'Rounds cleared', value: 12 } }, { uid: 'i2', itemId: 'b_bolt', finish: 'gloss', seed: 0, tracker: null }, { uid: 'i3', itemId: 'gone_item', finish: 'matte', seed: 0, tracker: null }],
    loadout: { facet: 'i1', burst: 'default', arena: 'i-missing' } } });
delete require.cache[require.resolve('../js/storage.js')]; require('../js/storage.js');
const mg = BR.Storage.data;
assert.strictEqual(mg.v, 3); assert.strictEqual(mg.best.chill, 12345); assert.strictEqual(mg.runs, 9); assert.strictEqual(mg.settings.sound, false);
assert.strictEqual(mg.profile.level, 6); assert.strictEqual(mg.profile.coins, 480 + 600 + 600 + 200);
assert.strictEqual(mg.profile.vault.length, 2, 'unknown items dropped'); assert.strictEqual(mg.profile.vault[0].shine, 'holo'); assert.strictEqual(mg.profile.vault[0].counter.stat, 'Stages reached');
assert.strictEqual(mg.profile.loadout.skin, 'i1'); assert.strictEqual(mg.profile.loadout.board, 'default'); assert.strictEqual(mg.profile.passTier, 5);
console.log('logic tests passed');
