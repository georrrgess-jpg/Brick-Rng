// Every tab screen (all scroll positions) and every sheet at one size, with geometry checks.
// Usage: node sweep.js <sizeKey> [mode] [dsf]   mode: '' | large | insets | perf
// Writes shots to $AUDIT_OUT/shots/<tag>-*.png and the findings to $AUDIT_OUT/sweep-<tag>.json
const { launch, player, closeAll, shotScroll, audit, wait, SIZES, INSETS, SHOTS, OUT, path, fs } = require('./lib');
const [KEY = 's393', MODE = '', DSF = '2'] = process.argv.slice(2);
const [W, H] = SIZES[KEY];
const land = W > H;
const tag = KEY + (MODE ? '-' + MODE : '');
(async () => {
  const ins = MODE === 'insets' ? (land ? INSETS.land : INSETS.port) : [0, 0, 0, 0];
  const { browser, page, errors } = await launch({ width: W, height: H, dsf: +DSF, insets: MODE === 'insets' ? ins : null });
  await player(page, { large: MODE === 'large', perfMode: MODE === 'perf', resume: true });
  const found = {};
  const rec = async (name) => { found[name] = await audit(page, ins); };
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${tag}-${n}.png`) });
  const tab = async (name, fn, ms = 1400) => { await closeAll(page); await page.evaluate(fn); await wait(page, ms); await rec(name); await shotScroll(page, `${tag}-${name}`); };
  await tab('home', () => BR.Router.go('home'));
  await tab('shop', () => BR.Router.go('shop'));
  await tab('col', () => { const C = BR.Router.screens.collection; C.type = 'skin'; C.view = 'items'; BR.Router.go('collection'); });
  await tab('col-hats', () => { BR.Progress.grantHat && BR.Progress.grantHat('h_top'); const C = BR.Router.screens.collection; C.type = 'hat'; BR.Router.rerender(); });
  await tab('tower', () => { const C = BR.Router.screens.collection; C.type = 'skin'; C.view = 'tower'; BR.Router.rerender(); }, 1800);
  await page.evaluate(() => { const C = BR.Router.screens.collection; C.view = 'items'; C.type = 'skin'; });
  await tab('mis', () => { BR.Router.screens.missions.tab = 'daily'; BR.Router.go('missions'); BR.Router.rerender(); });
  await tab('pass', () => { BR.Router.screens.missions.tab = 'pass'; BR.Router.rerender(); }, 1800);
  await tab('tro', () => { BR.Router.screens.missions.tab = 'trophies'; BR.Router.rerender(); });
  await tab('prof', () => BR.Router.go('profile'));
  await page.evaluate(() => BR.Router.go('home')); await wait(page, 900);
  const sheet = async (name, fn, ms = 1100) => {
    await closeAll(page); await wait(page, 600);
    await page.evaluate(fn); await wait(page, ms);
    await rec('sh-' + name);
    await shot('sh-' + name);
    const sc = await page.evaluate(() => { const b = document.querySelector('.sheet.on .sheet-body'); return b ? b.scrollHeight - b.clientHeight : 0; });
    if (sc > 4) { await page.evaluate(() => { const b = document.querySelector('.sheet.on .sheet-body'); b.scrollTop = b.scrollHeight; }); await wait(page, 350); await shot('sh-' + name + '-end'); }
  };
  await sheet('settings', () => BR.settingsSheet());
  await sheet('ready', () => BR.readySheet('rush'));
  await sheet('daily', () => BR.readySheet('daily'));
  await sheet('coins', () => BR.coinSheet());
  await sheet('odds', () => BR.showOdds('brick'));
  await sheet('odds-golden', () => BR.showOdds('golden'));
  await sheet('item', () => { const v = BR.Storage.data.profile.vault.find((x) => BR.itemById[x.itemId].type === 'skin' && x.shine === 'holo') || BR.Storage.data.profile.vault[0]; BR.itemSheet(v.uid, 'skin'); }, 1500);
  await sheet('item-fuse', () => { const v = BR.Storage.data.profile.vault.find((x) => BR.itemById[x.itemId].type === 'fuse'); BR.itemSheet(v.uid, 'fuse'); }, 1500);
  await sheet('locked', () => { const it = BR.ITEMS.find((i) => i.type === 'skin' && i.rarity === 'mythic' && !BR.Progress.owns(i.id)); BR.lockedSheet(it.id); });
  await sheet('spotlight', () => BR.itemSheet(null, null, BR.itemById.f_hourglass), 1500);
  await sheet('hat', () => BR.hatSheet('h_top'));
  await sheet('hat-locked', () => BR.hatLockedSheet('h_pom'));
  await sheet('reward', () => BR.rewardSheet(9));
  await sheet('reward-item', () => { const t = BR.SEASON.find((x) => x.kind === 'item'); BR.rewardSheet(t ? t.tier : 12); });
  await sheet('claim', () => BR.claimSheet(BR.SEASON.slice(2, 8).map((x) => ({ tier: x.tier, reward: BR.seasonReward(x.tier) }))));
  await sheet('trophy', () => BR.trophySheet('stage5'));
  await sheet('savecode', () => BR.saveCodeSheet());
  await sheet('restore', () => BR.restoreSheet());
  await sheet('coach-home', () => BR.Coach.show('home', { force: true }));
  await sheet('coach-pass', () => BR.Coach.show('pass', { force: true }));
  await sheet('whatsnew', () => { const d = BR.Storage.data; d.seen.whatsnew5 = false; BR.Coach.whatsNew(); });
  // confirm dialogs: Reset asks twice
  await closeAll(page); await page.evaluate(() => BR.Router.go('profile')); await wait(page, 1200);
  await page.evaluate(() => { const b = document.querySelector('[data-act="reset"]'); b.scrollIntoView({ block: 'center' }); b.click(); }); await wait(page, 900);
  await rec('sh-reset'); await shot('sh-reset');
  await closeAll(page);
  fs.writeFileSync(path.join(OUT, `sweep-${tag}.json`), JSON.stringify({ tag, W, H, errors, found }, null, 1));
  const n = Object.values(found).reduce((a, x) => a + x.length, 0);
  console.log(tag, 'findings', n, 'errors', errors.length, errors.slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.error(tag, e); process.exit(1); });
