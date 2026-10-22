// Update 5: the Pop Pass season track (season XP, tiers, rewards), Fizz Hats ownership, streak-week and trophy hats, trophies that give items,
// and saves from older versions starting a fresh season. No browser. Usage: node tests/season.js
const mem = {}; global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
global.window = global;
const R = require('path').resolve(__dirname, '..', 'js') + '/';
for (const f of ['rng', 'config', 'boosters', 'items', 'chests', 'storage', 'pass', 'progress', 'missions', 'retention']) require(R + f + '.js');
const BR = global.BR, assert = require('assert'), P = BR.Progress;
const pr = BR.Storage.data.profile;
assert.strictEqual(pr.season.n, 4); assert(P.ownsHat('h_party')); assert.strictEqual(P.equippedHat(), null);
// a level track that pays Coins only, and a season track that pays the specials
for (let t = 1; t <= 30; t++) assert.strictEqual(BR.levelReward(t).kind, 'coins');
assert.strictEqual(BR.seasonReward(5).kind, 'chest'); assert.strictEqual(BR.seasonReward(30).itemId, 'f_moonglass'); assert.strictEqual(BR.seasonReward(3).hatId, 'h_top');
// season XP fills tiers and pays them (a big gain crosses several tiers)
const need = BR.CFG.season.xpPerTier;
const coins0 = pr.coins; let r = P.addXp(need * 5 + 10);
assert.strictEqual(r.season.tier, 5); assert.strictEqual(r.season.ups.length, 5);
assert(P.ownsHat('h_top') && pr.hats.includes('h_top'), 'tier 3 gave the Top Hat');
assert.strictEqual(P.chestCount('brick'), 2, 'tier 5 gave a Brick Chest (1 welcome chest + 1)');
assert(pr.coins > coins0, 'coin tiers paid');
assert.strictEqual(P.seasonStatus().into, 10);
// level progress is independent of the season (levels came from the same XP, not from tiers)
assert(pr.level >= 1);
// the last tiers give the exclusives; extra XP after tier 30 changes nothing
r = P.addXp(need * 40);
assert.strictEqual(P.seasonStatus().tier, 30); assert(P.seasonStatus().done);
assert(P.owns('b_wisps') && P.owns('f_moonglass'), 'tier 25 and 30 exclusives arrive');
assert(P.ownsHat('h_wizard') && P.ownsHat('h_toque') && P.ownsHat('h_flower') && P.ownsHat('h_propeller') && P.ownsHat('h_pom'));
const t30 = P.addXp(1000).season; assert.strictEqual(t30.ups.length, 0);
// hats: equip, unknown hat refused, a duplicate hat pays Coins
assert(P.equipHat('h_top') && P.equippedHat() === 'h_top'); assert(!P.equipHat('h_crown')); assert(P.equipHat(null) && P.equippedHat() === null);
const c1 = pr.coins; assert.strictEqual(P.grant({ kind: 'hat', hatId: 'h_top' }), 60); assert.strictEqual(pr.coins, c1 + 60);
// streak weeks: the first two give a hat
const day = (n) => { const d = new Date(Date.UTC(2026, 10, 1 + n)); return d.toISOString().slice(0, 10); };
let got = []; for (let i = 0; i < 14; i++) { const o = BR.Streak.advance(day(i)); if (o && o.hat) got.push(o.hat); }
assert.deepStrictEqual(got, ['h_nightcap', 'h_tricorn']);
for (let i = 14; i < 21; i++) BR.Streak.advance(day(i)); assert(!P.ownsHat('h_none'));
// trophies with rewards: level 25 gives Chrome (holo), own 75 items gives the Crown
pr.level = 25; let tr = P.checkTrophies(); assert(P.owns('f_chrome'), 'level 25 trophy gives Chrome'); assert(tr.some((t) => t.id === 'lv25'));
pr.level = 30; P.checkTrophies(); assert(P.owns('f_heart'));
// set trophies: complete the Library set -> Room Complete + the Mortarboard
BR.setItems('library').forEach((x) => P.keep({ itemId: x.id, shine: 'plain', seed: 1 }));
tr = P.checkTrophies(); assert(tr.some((t) => t.id === 'set1') && P.ownsHat('h_mortar'), 'completing a set gives its trophy and the Mortarboard');
// stats: Moonwick skin pops and Last Spark runs
P.equip(P.instance(pr.vault.find((i) => i.itemId === 'f_spellbook').uid).uid, 'skin');
P.trackRun({ bricks: 10, rushes: 0, bigPops: 0, powerUsed: 0, lineBlasts: 0, stagesCleared: 0, defused: 0, maxCombo: 1, biggest: 3, pops: 120, sparkSaves: 1 }, 'rush');
assert.strictEqual(pr.stats.moonwickPops, 120); assert.strictEqual(pr.stats.sparkRuns, 1);
// an old save gets a fresh season 4, the free Party Hat, and keeps its level
for (const k of Object.keys(mem)) delete mem[k];
mem['poprush.v4'] = JSON.stringify({ v: 4, bestStage: { rush: 6 }, profile: { level: 28, xp: 10, coins: 500, passTier: 27, season: { n: 3, xp: 99999, tier: 30 } } });
delete require.cache[require.resolve(R + 'storage.js')]; require(R + 'storage.js');
const old = BR.Storage.data.profile; assert.strictEqual(old.season.n, 4); assert.strictEqual(old.season.tier, 0); assert.strictEqual(old.level, 28); assert(Array.isArray(old.hats));
console.log('season track, hats and trophy rewards ok');
