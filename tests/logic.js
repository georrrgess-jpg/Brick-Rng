// Pure-logic tests: items, live odds, no-duplicate drops, pity, completion, XP/levels, Pass, Coins, chests, missions, migrations.
global.window = global;
const mem = {};
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
for (const f of ['rng', 'config', 'boosters', 'items', 'chests', 'storage', 'pass', 'progress', 'missions', 'retention']) require('../js/' + f + '.js');
const BR = global.BR;
const assert = require('assert');
const P = BR.Progress;

// ---- catalogue
assert.strictEqual(BR.ITEMS.length - BR.DROP_ITEMS.length, 4, 'four pass exclusives (Chrome, Prism Heart, Wisps, Moonglass)');
assert(new Set(BR.ITEMS.map((x) => x.id)).size === BR.ITEMS.length, 'item ids are unique');
for (const t of BR.TYPE_ORDER) for (const r of BR.RARITIES) assert(BR.DROP_ITEMS.some((x) => x.type === t && x.rarity === r.id), `pool exists: ${t}/${r.id}`);
assert(!BR.DROP_ITEMS.some((x) => x.pass));

// ---- live odds sum to 100, and read sensibly
for (const id of ['brick', 'pop', 'board', 'fuse', 'golden']) {
  const rows = BR.chestOdds(id, id === 'golden' ? 'skin' : null, []);
  assert(Math.abs(rows.reduce((a, r) => a + r.pct, 0) - 100) < 1e-9, 'odds sum to 100 for ' + id);
}
const rows = BR.chestOdds('brick', null, []);
assert.deepStrictEqual(rows.map((r) => r.oneIn), [2, 4, 10, 25, 100]);
console.log('sentence:', BR.oddsSentence('brick', null, []), '|', BR.oddsSentence('golden'));

// ---- drop statistics on a fresh collection (the first chest follows the printed odds)
const rng = BR.makeRng(7), N = 60000, tally = {}, shine = {};
for (let i = 0; i < N; i++) {
  const d = BR.rollChest(rng, 'brick', null, []);
  assert.strictEqual(d.type, 'skin'); assert(!BR.itemById[d.itemId].pass);
  tally[d.rarity] = (tally[d.rarity] || 0) + 1; shine[d.shine] = (shine[d.shine] || 0) + 1;
}
const pc = (n) => (n / N) * 100;
assert(Math.abs(pc(tally.common) - 60) < 1 && Math.abs(pc(tally.mythic) - 1) < 0.4 && Math.abs(pc(shine.plain) - 55) < 1.5);
const g = { epic: 0, legendary: 0, mythic: 0, other: 0 };
for (let i = 0; i < N; i++) { const d = BR.rollChest(rng, 'golden', 'pop', []); assert.strictEqual(d.type, 'pop'); g[d.rarity in g ? d.rarity : 'other']++; }
assert.strictEqual(g.other, 0, 'golden is epic or better');
assert(Math.abs(pc(g.epic) - 70) < 1.2 && Math.abs(pc(g.mythic) - 5) < 0.6);
console.log('odds ok', JSON.stringify(Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, +pc(v).toFixed(1)]))));

// ---- no duplicates: opening a chest type until it is complete gives every item exactly once, in any order
for (const [chest, type] of [['brick', 'skin'], ['pop', 'pop'], ['board', 'board'], ['fuse', 'fuse']]) {
  const owned = new Set(), total = BR.chestPool(chest).length, order = [];
  const r = BR.makeRng(99);
  for (let i = 0; i < total; i++) {
    const d = BR.rollChest(r, chest, null, owned);
    assert(d && !owned.has(d.itemId), `no duplicate from ${chest} at chest ${i + 1}`);
    assert.strictEqual(BR.itemById[d.itemId].type, type);
    owned.add(d.itemId); order.push(BR.itemById[d.itemId].rarity);
  }
  assert.strictEqual(BR.rollChest(r, chest, null, owned), null, chest + ' is complete');
  assert(BR.chestComplete(chest, owned));
  assert.strictEqual(BR.oddsSentence(chest, null, owned), 'You own everything in this chest. Nice.');
}
// once the Commons are gone the odds renormalize over what is left
{
  const owned = new Set(BR.chestPool('brick').filter((x) => x.rarity === 'common').map((x) => x.id));
  const live = BR.chestOdds('brick', null, owned);
  assert.strictEqual(live[0].pct, 0); assert(Math.abs(live.reduce((a, r) => a + r.pct, 0) - 100) < 1e-9);
  assert(Math.abs(live[1].pct - (25 / 40) * 100) < 1e-9, 'rare is 25/40 once commons are gone');
}
// forced Epic+ (pity)
{
  const r = BR.makeRng(5);
  for (let i = 0; i < 2000; i++) { const d = BR.rollChest(r, 'brick', null, [], { pity: true }); assert(BR.rarityById[d.rarity].level >= 3, 'pity gives epic or better'); }
}
// golden only offers types with missing Epic+ items
{
  const owned = new Set(BR.DROP_ITEMS.filter((x) => x.type !== 'fuse' && BR.rarityById[x.rarity].golden > 0).map((x) => x.id));
  assert.deepStrictEqual(BR.goldenTypes(owned), ['fuse']);
  for (let i = 0; i < 300; i++) assert.strictEqual(BR.rollChest(BR.makeRng(i + 1), 'golden', 'fuse', owned).type, 'fuse');
  BR.DROP_ITEMS.forEach((x) => owned.add(x.id));
  assert.deepStrictEqual(BR.goldenTypes(owned), []);
}

// ---- Coins and XP
assert.strictEqual(P.coins, 200);
assert(P.spend(50) && P.coins === 150 && !P.spend(1000));
const rc = P.runCoins({ score: 200000, stagesCleared: 5 }, { daily: true, firstOfDay: true });
assert.strictEqual(rc.points, 22); assert.strictEqual(rc.stages, 15); assert.strictEqual(rc.daily, 15); assert.strictEqual(rc.first, 20); assert.strictEqual(rc.total, 72);
assert(P.runCoins({ score: 0, stagesCleared: 0 }).total === 0, 'an empty run pays nothing');
assert(P.runCoins({ score: 450000, stagesCleared: 12 }).total < 4 * P.runCoins({ score: 54000, stagesCleared: 3 }).total, 'sharp players earn well under 4x a casual player');
assert(P.runCoins({ score: 1e9, stagesCleared: 30 }).stages === 28, 'stage bonus is capped');
assert.strictEqual(BR.xpForLevel(1), 500);
let res = P.addXp(499); assert.strictEqual(res.ups.length, 0);
res = P.addXp(1); assert.strictEqual(res.ups.length, 1); assert.strictEqual(P.level, 2);
assert.strictEqual(res.ups[0].tier, 1); assert.strictEqual(res.ups[0].reward.kind, 'coins');
const coinsBefore = P.coins;
P.addXp(1e6);
assert(P.level > 30, 'climbed past the level track'); assert.strictEqual(BR.Storage.data.profile.passTier, P.level - 1);
assert(BR.PASS.length === 30);
// Update 5: the level track pays Coins; the chests and exclusives come from the season track (the same XP fills it), and the old
// exclusives Chrome and Prism Heart are level trophies
assert(BR.PASS.every((r) => r.kind === 'coins'), 'the level track pays Coins only');
P.checkTrophies(); assert(P.owns('f_chrome') && P.owns('f_heart'), 'the level 25 and 30 trophies give Chrome and Prism Heart');
assert(P.owns('b_wisps') && P.owns('f_moonglass'), 'the season track gave its exclusives');
assert(P.chestCount('golden') >= 1 && P.chestCount('fuse') >= 1, 'season chests granted');
assert(P.coins > coinsBefore);

// ---- opening through Progress: inventory first, then Coins; drops are always new; pity; completion
{
  const pr = BR.Storage.data.profile;
  pr.coins = 5000; pr.vault.length = 0; pr.chests = { brick: 1, pop: 0, board: 0, fuse: 0, golden: 0 }; pr.pity = { skin: 0, pop: 0, board: 0, fuse: 0 };
  const d = P.openChest('brick');
  assert(d && P.chestCount('brick') === 0 && pr.coins === 5000, 'inventory chest consumed first, no Coins spent');
  assert(!d.dup && d.counter === undefined);
  P.keep(d); assert.strictEqual(pr.vault.length, 1); P.keep(d); assert.strictEqual(pr.vault.length, 1, 'keep never makes a second copy');
  const before = P.coins; const d2 = P.openChest('board'); assert(d2 && P.coins === before - BR.CHESTS.board.cost, 'paid with Coins when none owned'); P.keep(d2);
  pr.coins = 10; assert.strictEqual(P.openChest('pop'), null, 'cannot open without Coins'); assert(!P.canOpen('pop'));
  const inst = P.keep(d2); P.equip(inst.uid); assert.strictEqual(P.equipped('board').inst.uid, inst.uid);
  assert(!P.sellInstance && !P.tradeUp && !P.canTradeUp, 'selling and Trade-up are gone');
  // open every brick chest until complete: all new, pity fires, then the chest is complete
  pr.coins = 1e6; pr.vault.length = 0; pr.pity.skin = 0;
  const total = BR.chestPool('brick').length; let sinceEpic = 0, maxGap = 0;
  for (let i = 0; i < total; i++) {
    assert(P.canOpen('brick'));
    const x = P.openChest('brick'); assert(x && !P.owns(x.itemId), 'new item every time'); P.keep(x);
    if (BR.rarityById[x.rarity].level >= 3) sinceEpic = 0; else { sinceEpic++; maxGap = Math.max(maxGap, sinceEpic); }
  }
  assert(maxGap <= BR.CFG.pityEvery - 1 || P.chestStatus('brick').pityIn === null, 'pity: never more than 7 chests without an Epic or better while one is left');
  assert(!P.canOpen('brick') && P.chestStatus('brick').complete, 'a complete chest cannot be opened'); assert.strictEqual(P.openChest('brick'), null);
  assert.strictEqual(pr.coins, 1e6 - total * BR.CHESTS.brick.cost, 'every open cost exactly one chest');
  // a Golden Chest with nothing Epic+ left pays Coins
  BR.DROP_ITEMS.forEach((x) => P.keep({ itemId: x.id, shine: 'plain' }));
  const c1 = pr.coins; assert.strictEqual(P.addChest('golden', 1), BR.CFG.goldenFallback); assert.strictEqual(pr.coins, c1 + BR.CFG.goldenFallback); assert.strictEqual(P.chestCount('golden'), 0);
  // pass items you already own pay Coins
  P.keep({ itemId: 'f_chrome', shine: 'plain' }); const c2 = pr.coins; P.grant({ kind: 'item', itemId: 'f_chrome' }); assert.strictEqual(pr.coins, c2 + BR.CFG.goldenFallback / 2);
  pr.vault.length = 0; pr.loadout = { skin: 'default', pop: 'default', board: 'default', fuse: 'default' };
}

// ---- trophies
const pr = BR.Storage.data.profile;
P.trackRun({ bricks: 120, biggest: 9, stagesCleared: 3, rushes: 2, bigPops: 1, powerUsed: 2, lineBlasts: 0, maxCombo: 3, defused: 1 }, 'rush');
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
let mg = BR.Storage.data;
assert.strictEqual(mg.v, 4); assert.strictEqual(mg.best.chill, 12345); assert.strictEqual(mg.runs, 9); assert.strictEqual(mg.settings.sound, false);
assert.strictEqual(mg.profile.level, 6); assert.strictEqual(mg.profile.coins, 480 + 600 + 600 + 200);
assert.strictEqual(mg.profile.vault.length, 2, 'unknown items dropped'); assert.strictEqual(mg.profile.vault[0].shine, 'holo'); assert(!('counter' in mg.profile.vault[0]));
assert.strictEqual(mg.profile.loadout.skin, 'i1'); assert.strictEqual(mg.profile.loadout.board, 'default'); assert.strictEqual(mg.profile.passTier, 5);

// ---- migration from Update 2 (v3): duplicates collapse to one copy, the equipped copy survives, old sell value refunded
for (const k of Object.keys(mem)) delete mem[k];
mem['poprush.v3'] = JSON.stringify({ v: 3, best: { rush: 5000, daily: 0, chill: 0 }, runs: 4, settings: { sound: true },
  profile: { level: 3, xp: 100000, coins: 500, chests: { brick: 1, pop: 0, board: 0, fuse: 0, golden: 0 }, seq: 6, opened: 6, passTier: 2,
    vault: [{ uid: 'a', itemId: 'f_candy', shine: 'plain', seed: 1, counter: null }, { uid: 'b', itemId: 'f_candy', shine: 'holo', seed: 2, counter: { stat: 'Bricks popped', value: 9 } },
      { uid: 'c', itemId: 'f_lava', shine: 'plain', seed: 3, counter: null }, { uid: 'd', itemId: 'f_lava', shine: 'plain', seed: 4, counter: null }, { uid: 'e', itemId: 'b_ember', shine: 'glossy', seed: 0, counter: null }],
    loadout: { skin: 'b', pop: 'default', board: 'default', fuse: 'default' } } });
delete require.cache[require.resolve('../js/storage.js')]; require('../js/storage.js');
mg = BR.Storage.data;
assert.strictEqual(mg.v, 4); assert.strictEqual(mg.profile.vault.length, 3, 'one copy per item');
assert.strictEqual(mg.profile.vault.find((i) => i.itemId === 'f_candy').uid, 'b', 'the equipped copy is kept');
assert.strictEqual(mg.profile.loadout.skin, 'b');
assert.strictEqual(mg.profile.coins, 500 + 40 + 600, 'duplicates refunded: one Common and one Legendary'); assert.deepStrictEqual(mg.notice, { kind: 'dupes', coins: 640 });
assert(mg.profile.xp < BR.xpForLevel(3), 'xp clamped to the new level curve'); assert.deepStrictEqual(mg.profile.pity, { skin: 0, pop: 0, board: 0, fuse: 0 });
assert.strictEqual(mg.profile.chests.brick, 1, 'unopened chests survive'); assert(!('counter' in mg.profile.vault[0]));

// ---- the tile director's skill rating: a new save starts at 0.4; a save from before it starts a little below its best Rush stage;
// a rating already saved is kept
for (const k of Object.keys(mem)) delete mem[k];
delete require.cache[require.resolve('../js/storage.js')]; require('../js/storage.js');
assert.strictEqual(BR.Storage.data.profile.skill, 0.4, 'a new player starts at 0.4');
mem['poprush.v4'] = JSON.stringify({ v: 4, bestStage: { rush: 8, daily: 0, chill: 0 }, profile: { level: 5, coins: 10 } });
delete require.cache[require.resolve('../js/storage.js')]; require('../js/storage.js');
assert.strictEqual(BR.Storage.data.profile.skill, 0.667, 'a returning stage-8 player is seeded from the best stage');
mem['poprush.v4'] = JSON.stringify({ v: 4, bestStage: { rush: 8, daily: 0, chill: 0 }, profile: { level: 5, coins: 10, skill: 0.21 } });
delete require.cache[require.resolve('../js/storage.js')]; require('../js/storage.js');
assert.strictEqual(BR.Storage.data.profile.skill, 0.21, 'a saved rating is kept');

// ---- review fixes: the best Shine survives a duplicate collapse, bad saves are kept aside, nulls cannot wipe defaults
for (const k of Object.keys(mem)) delete mem[k];
mem['poprush.v3'] = JSON.stringify({ v: 3, profile: { level: 2, xp: 0, coins: 0, chests: {}, vault: [{ uid: 'a', itemId: 'f_aurora', shine: 'plain', seed: 1 }, { uid: 'b', itemId: 'f_aurora', shine: 'prism', seed: 2 }, { uid: 'c', itemId: 'f_aurora', shine: 'glossy', seed: 3 }], loadout: {} } });
delete require.cache[require.resolve('../js/storage.js')]; require('../js/storage.js');
mg = BR.Storage.data;
assert.strictEqual(mg.profile.vault.length, 1); assert.strictEqual(mg.profile.vault[0].shine, 'prism', 'the best Shine copy is kept when none is equipped');
for (const k of Object.keys(mem)) delete mem[k];
mem['poprush.v4'] = JSON.stringify({ v: 4, recent: null, settings: null, profile: { level: 9, coins: 77, chests: null } });
delete require.cache[require.resolve('../js/storage.js')]; require('../js/storage.js');
mg = BR.Storage.data;
assert.strictEqual(mg.profile.level, 9); assert(mg.recent && Array.isArray(mg.recent.rush) && mg.settings && typeof mg.settings.sound === 'boolean' && mg.profile.chests && typeof mg.profile.chests.brick === 'number', 'null fields do not wipe the defaults');
for (const k of Object.keys(mem)) delete mem[k];
mem['poprush.v4'] = '{"v":4,"profile":{"level":12,"coins":'; mem['poprush.v3'] = JSON.stringify({ v: 3, profile: { level: 7, vault: [], loadout: {} } });
delete require.cache[require.resolve('../js/storage.js')]; require('../js/storage.js');
assert.strictEqual(mem['poprush.v4.corrupt'], '{"v":4,"profile":{"level":12,"coins":', 'a corrupt save is copied aside before anything older is used');

// ---- review fixes: chests whose pool is finished turn into Coins instead of being stranded
for (const k of Object.keys(mem)) delete mem[k];
delete require.cache[require.resolve('../js/storage.js')]; require('../js/storage.js');
{
  const P = BR.Progress, pr = BR.Storage.data.profile;
  pr.coins = 0; pr.chests = { brick: 0, pop: 0, board: 0, fuse: 0, golden: 0 };
  P.addChest('brick', 2); P.addChest('golden', 2); assert.strictEqual(P.chestCount('brick'), 2); assert.strictEqual(P.chestCount('golden'), 2);
  BR.DROP_ITEMS.filter((i) => i.type === 'skin').forEach((i) => { if (!P.owns(i.id)) P.keep({ itemId: i.id, shine: 'plain', seed: 1 }); });
  assert.strictEqual(P.openableChests(), 2, 'stock of a finished set does not count as openable');
  const coins = P.cashStranded(); assert.strictEqual(coins, 2 * BR.CHESTS.brick.cost); assert.strictEqual(P.chestCount('brick'), 0); assert.strictEqual(P.chestCount('golden'), 2, 'a Golden Chest stays while another type still has Epic or better');
  assert.strictEqual(P.addChest('brick', 1), BR.CHESTS.brick.cost, 'a new chest of a finished set pays its price'); assert.strictEqual(P.chestCount('brick'), 0);
  assert.strictEqual(P.grant({ kind: 'chest', chest: 'brick' }), BR.CHESTS.brick.cost, 'grant reports what was paid instead');
  assert.strictEqual(P.grant({ kind: 'item', itemId: 'f_candy', shine: 'plain' }), BR.CFG.goldenFallback / 2, 'an owned Pass item pays Coins and says so');
  BR.DROP_ITEMS.filter((i) => BR.rarityById[i.rarity].level >= 3).forEach((i) => { if (!P.owns(i.id)) P.keep({ itemId: i.id, shine: 'plain', seed: 1 }); });
  const c2 = P.cashStranded(); assert.strictEqual(c2, 2 * BR.CFG.goldenFallback, 'Golden stock converts once nothing Epic or better is left'); assert.strictEqual(P.chestCount('golden'), 0);
}

// ---- Update 4: streak, run goals, records, the next goal
for (const k of Object.keys(mem)) delete mem[k];
delete require.cache[require.resolve('../js/storage.js')]; require('../js/storage.js');
{
  const P = BR.Progress, pr = BR.Storage.data.profile, S = BR.Streak;
  assert.strictEqual(BR.dayDiff('2026-10-21', '2026-10-23'), 2); assert.strictEqual(BR.dayDiff('2026-12-31', '2027-01-01'), 1); assert.strictEqual(BR.dayDiff('2026-03-07', '2026-03-09'), 2, 'across a clock change');
  pr.coins = 0; pr.chests.golden = 0;
  const day = (n) => BR.dayKey(new Date(2026, 9, 1 + n));      // 2026-10-01 + n
  // a perfect week: day 3 pays 120, day 7 pays 200 and a Golden Chest
  let r = S.advance(day(0)); assert.strictEqual(r.ring, 1); assert.strictEqual(r.coins, 0);
  assert.strictEqual(S.advance(day(0)), null, 'one count per day');
  S.advance(day(1)); r = S.advance(day(2)); assert.strictEqual(r.ring, 3); assert.strictEqual(r.coins, BR.CFG.streak.day3); assert.strictEqual(pr.coins, 120);
  S.advance(day(3)); S.advance(day(4)); S.advance(day(5)); r = S.advance(day(6));
  assert.strictEqual(r.ring, 7); assert.strictEqual(r.coins, BR.CFG.streak.day7Coins); assert.strictEqual(r.chest, 'golden'); assert.strictEqual(pr.coins, 320); assert.strictEqual(P.chestCount('golden'), 1);
  // the next day starts a new week and refills the shield
  r = S.advance(day(7)); assert.strictEqual(r.ring, 1); assert.strictEqual(pr.streak.weeks, 1);
  // one missed day is forgiven, once
  r = S.advance(day(9)); assert.strictEqual(r.shielded, true); assert.strictEqual(r.ring, 2); assert.strictEqual(pr.streak.shield, 0);
  // a second missed day in the same week breaks the week, but the finished week stays and nothing is taken away
  const coinsBefore = pr.coins;
  r = S.advance(day(11)); assert.strictEqual(r.broken, true); assert.strictEqual(r.ring, 1); assert.strictEqual(pr.streak.weeks, 1); assert.strictEqual(pr.coins, coinsBefore);
  // status of a ring nobody continued
  let st = S.status(day(11)); assert.strictEqual(st.ring, 1); assert(st.playedToday);
  st = S.status(day(15)); assert.strictEqual(st.alive, false); assert.strictEqual(st.ring, 0);
  // goals: never the same as the last three, harder with level, the stage goal asks for your usual stage
  pr.level = 1; BR.Storage.data.bestStage.rush = 0;
  const seenG = []; for (let i = 0; i < 12; i++) { const g = BR.Goals.pick({ next: Math.random }); seenG.push(g.id); assert(g.reward >= 10 && g.reward <= 20); }
  for (let i = 3; i < seenG.length; i++) assert(!seenG.slice(i - 3, i).includes(seenG[i]) || new Set(seenG.slice(i - 3, i + 1)).size < 4, 'goals repeat too soon');
  assert(!seenG.includes('defuse') && !seenG.includes('rush2') && !seenG.includes('big12'), 'a level 1 player gets gentle goals');
  pr.level = 10; BR.Storage.data.bestStage.rush = 6; pr.goalHist = [];
  const got = new Set(); for (let i = 0; i < 80; i++) got.add(BR.Goals.pick({ next: Math.random }).id);
  assert(got.has('stage') && got.has('defuse'), 'a level 10 player can get the harder goals');
  const g1 = { id: 'stage', target: 7, text: 'Reach stage 7', reward: 20 };
  assert(!BR.Goals.met(g1, { stage: 6 }) && BR.Goals.met(g1, { stage: 7 }));
  assert(BR.Goals.met({ id: 'line' }, { lineBlasts: 1 }) && !BR.Goals.met({ id: 'line' }, { lineBlasts: 0 }));
  // records
  BR.Records.update({ score: 5000, lineBlasts: 3, rushes: 2 }, 'rush'); BR.Records.update({ score: 9000, lineBlasts: 1, rushes: 1 }, 'rush');
  const rec = BR.Records.list(); assert.strictEqual(rec.maxLines, 3); assert.deepStrictEqual(rec.history, [5000, 9000]);
  for (let i = 0; i < 30; i++) BR.Records.update({ score: i, lineBlasts: 0, rushes: 0 }, 'rush'); assert.strictEqual(BR.Records.list().history.length, 20);
  assert(typeof BR.nextGoal({ stage: 5 }) === 'string');
}
// ---- Update 4: a save code round-trips, and damaged codes are refused without touching anything
{
  const before = JSON.stringify(BR.Storage.data);
  const code = BR.Storage.exportCode();
  assert(/^POPRUSH4\.[0-9a-z]+\.[A-Za-z0-9+/=]+$/.test(code));
  const back = BR.Storage.parseCode(code); assert(back && back.profile.level === BR.Storage.data.profile.level && JSON.stringify(back.profile.vault) === JSON.stringify(BR.Storage.data.profile.vault));
  assert.strictEqual(BR.Storage.parseCode(code.slice(0, -4)), null, 'a cut code is refused');
  assert.strictEqual(BR.Storage.parseCode(code.replace(/\.[0-9a-z]+\./, '.zzzz.')), null, 'a wrong checksum is refused');
  assert.strictEqual(BR.Storage.parseCode('hello'), null); assert.strictEqual(BR.Storage.parseCode(''), null); assert.strictEqual(BR.Storage.parseCode(null), null);
  assert.strictEqual(JSON.stringify(BR.Storage.data), before, 'reading codes changes nothing');
}
console.log('logic tests passed');
