// Returning player: every tab screen (all scroll positions) and every sheet, at one size. Usage: node sweep.js W H [dsf] [tag] [mode]
// mode: '' | large | reduced | smooth
const { launch, shotScroll, returning, wait, SHOTS, path } = require('./u5lib');
const [W, H, DSF = 1, TAG = '', MODE = ''] = process.argv.slice(2);
const pre = `${TAG || W + 'x' + H}`;
(async () => {
  const mobile = +W < 1000;
  const { browser, page, errors } = await launch({ width: +W, height: +H, dsf: +DSF, mobile });
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${pre}-${n}.png`) });
  await returning(page, { chests: { brick: 2, golden: 1 } });
  await page.evaluate((MODE) => {
    const st = BR.Storage.data;
    if (MODE === 'large') st.settings.large = true;
    if (MODE === 'reduced') st.settings.reduced = true;
    if (MODE === 'smooth') st.settings.perf = 'low';
    const y = new Date(Date.now() - 864e5); const k = BR.dayKey(y);
    st.profile.streak = { ring: 2, weeks: 0, last: k, shield: 1, best: 2 };
    BR.App.applySettings(); BR.Storage.save();
  }, MODE);
  // a saved run for the Resume card: start a run, pop one group, Save and leave
  await page.evaluate(() => { BR.Storage.clearRun(); __app.startRun({ mode: 'rush', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.engine && !BR.Run.busy, null, { timeout: 12000 }).catch(() => console.log('run not ready'));
  await wait(page, 600);
  const q = await page.evaluate(() => { const e = BR.Run.engine, v = BR.Run.view; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.n)) best = { r, c, n: p.cells.length }; } return best ? v.pagePoint(best.r, best.c) : null; });
  if (q) { await page.mouse.click(q.x, q.y); await wait(page, 900); }
  await page.evaluate(() => BR.Run.pause()); await wait(page, 600);
  await page.locator('.sheet [data-p="leave"]').click(); await wait(page, 1500);
  await shotScroll(page, pre + '-home');
  await page.evaluate(() => BR.Router.go('shop')); await wait(page, 1500); await shotScroll(page, pre + '-shop');
  await page.evaluate(() => BR.Router.go('collection')); await wait(page, 1800); await shotScroll(page, pre + '-col');
  await page.evaluate(() => { BR.Router.screens.missions.tab = 'daily'; BR.Router.go('missions'); }); await wait(page, 1500); await shotScroll(page, pre + '-mis');
  await page.evaluate(() => { BR.Router.screens.missions.tab = 'pass'; BR.Router.go('home'); }); await wait(page, 300);
  await page.evaluate(() => { BR.Router.go('missions'); }); await wait(page, 1800); await shotScroll(page, pre + '-pass');
  await page.evaluate(() => { BR.Router.screens.missions.tab = 'trophies'; BR.Router.rerender(); }); await wait(page, 900); await shotScroll(page, pre + '-tro');
  await page.evaluate(() => BR.Router.go('profile')); await wait(page, 1500); await shotScroll(page, pre + '-prof');
  // sheets
  const sheet = async (name, fn, ms = 1000) => { await page.evaluate(fn); await wait(page, ms); await shot('sh-' + name); await shotScroll(page, `${pre}-sh-${name}-s`, { sel: '.sheet.on .sheet-body', max: 4 }); await page.evaluate(() => { while (BR.Back.depth) BR.Back.closeTop(); }); await wait(page, 600); };
  await page.evaluate(() => BR.Router.go('home')); await wait(page, 1200);
  await sheet('coins', () => BR.coinSheet());
  await sheet('ready', () => BR.readySheet('rush'));
  await sheet('odds', () => BR.showOdds('brick'));
  await sheet('odds-golden', () => BR.showOdds('golden'));
  await sheet('item', () => { const v = BR.Storage.data.profile.vault.find((x) => BR.itemById[x.itemId].type === 'skin' && x.shine === 'holo') || BR.Storage.data.profile.vault[0]; BR.itemSheet(v.uid, 'skin'); }, 1400);
  await sheet('item-fuse', () => { const v = BR.Storage.data.profile.vault.find((x) => BR.itemById[x.itemId].type === 'fuse'); BR.itemSheet(v.uid, 'fuse'); }, 1400);
  await sheet('locked', () => { const it = BR.ITEMS.find((i) => i.type === 'skin' && i.rarity === 'mythic' && !BR.Progress.owns(i.id)); BR.lockedSheet(it.id); });
  await sheet('reward', () => BR.rewardSheet(9));
  await sheet('trophy', () => BR.trophySheet('stage5'));
  await sheet('savecode', () => BR.saveCodeSheet());
  await sheet('restore', () => BR.restoreSheet());
  await sheet('daily', () => BR.readySheet('daily'));
  await sheet('chill', () => BR.readySheet('chill'));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
