// The run screen in each state, Chill's round clear and out of moves, at one size.
// Usage: node runstates.js <sizeKey> [mode] [dsf]   mode: '' | insets | large
// Shots: $AUDIT_OUT/shots/run-<tag>-*.png; geometry: $AUDIT_OUT/run-<tag>.json
const { launch, player, audit, wait, SIZES, INSETS, SHOTS, OUT, path, fs } = require('./lib');
const [KEY = 's393', MODE = '', DSF = '2'] = process.argv.slice(2);
const [W, H] = SIZES[KEY];
const land = W > H;
const tag = KEY + (MODE ? '-' + MODE : '');
const touch = (page, type, x, y) => page.__cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const cell = (page, r, c) => page.evaluate(({ r, c }) => { BR.Run.view._rc = null; return BR.Run.view.pagePoint(r, c); }, { r, c });
async function tap(page, r, c) { const p = await cell(page, r, c); await touch(page, 'touchStart', p.x, p.y); await touch(page, 'touchEnd', p.x, p.y); }
async function setBoard(page, rows) {
  await page.evaluate((rows) => {
    const e = BR.Run.engine, B = e.board;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const ch = rows[r][c]; if (ch === '*') continue; const b = B.grid[r][c]; b.color = +ch; delete b.fb; }
    B.version++; BR.Run.view.syncTo(B); BR.Run.clearHover();
  }, rows);
}
const BIG = ['00001111', '00001111', '22223333', '22223333', '44440000', '44440000', '11112222', '11112222'];
const idle = (page) => page.waitForFunction(() => !BR.Run.busy, null, { timeout: 10000 }).catch(() => {});
async function startRun(page, mode) {
  await page.evaluate((mode) => {
    while (BR.Back.depth) BR.Back.closeTop();   // (a tip card left open from boot would sit over the run)
    if (BR.Run.resultsEl) BR.Run.closeResults();
    BR.Storage.clearRun(); BR.Router.go('home', { instant: true });
    __app.startRun({ mode, boosts: {} });
  }, mode);
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy && BR.Router.current === 'run', null, { timeout: 15000 });
}
(async () => {
  const ins = MODE === 'insets' ? (land ? INSETS.land : INSETS.port) : [0, 0, 0, 0];
  const { browser, page, errors } = await launch({ width: W, height: H, dsf: +DSF, insets: MODE === 'insets' ? ins : null });
  await player(page, { large: MODE === 'large', runs: 12 });
  const found = {};
  const shot = async (n) => { found[n] = await audit(page, ins); await page.screenshot({ path: path.join(SHOTS, `run-${tag}-${n}.png`) }); };
  const geo = () => page.evaluate(() => { const o = {}; for (const id of ['btnPause', 'score', 'bestLine', 'fuse', 'stageStrip', 'boardWrap', 'rushBar', 'powerups', 'msgBand', 'chillbar']) { const e = document.getElementById(id); if (!e) continue; const r = e.getBoundingClientRect(); o[id] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; } o.vh = innerHeight; o.vw = innerWidth; return o; });

  await startRun(page, 'rush');
  await wait(page, 700);
  await shot('start');
  found.geoStart = await geo();
  // mid-run: a big score, a hint, a combo
  await setBoard(page, BIG);
  const p = await cell(page, 0, 0); await touch(page, 'touchStart', p.x, p.y); await wait(page, 300);
  await shot('press');
  await touch(page, 'touchEnd', p.x, p.y); await wait(page, 350);
  await shot('pop');
  await idle(page); await wait(page, 900);
  await page.evaluate(() => { const e = BR.Run.engine; e.score = 1234567; BR.Run.setScore(e.score, false); BR.Run.bestRefresh(e.score); BR.Run.setCombo(5, 2.5, 8); });
  await wait(page, 400); await shot('bigscore');
  found.geoBig = await geo();
  // Rush: fill the meter and pop 8
  await page.evaluate(() => { BR.Run.engine.rush.meter = 99; });
  await setBoard(page, BIG); await tap(page, 2, 0); await wait(page, 700); await shot('rush-banner');
  await idle(page); await wait(page, 1400); await shot('rush');
  // stage wipe: put the stage one pop from its goal
  await page.evaluate(() => { const e = BR.Run.engine; e.rush.active = false; e.rush.left = 0; e.rush.meter = 0; BR.Run.el.classList.remove('rushing'); e.stageScore = e.goal - 10; });
  await setBoard(page, BIG); await tap(page, 4, 0); await wait(page, 1300); await shot('stage-wipe');
  await idle(page); await wait(page, 1200);
  // Last Spark
  await page.evaluate(() => { const e = BR.Run.engine; e.sparkUsed = false; e.fuse = 0.05; });
  await wait(page, 700); await shot('last-spark');
  await page.evaluate(() => { const e = BR.Run.engine; e.spark = 0; e.fuse = 20; BR.Run.sparkEnd(false); });
  await wait(page, 500);
  // pause
  await page.evaluate(() => BR.Run.pause()); await wait(page, 900); await shot('pause');
  found.pauseSheet = await page.evaluate(() => { const s = document.querySelector('.sheet.on'); const r = s.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), innerHeight]; });
  await page.evaluate(() => { while (BR.Back.depth) BR.Back.closeTop(); }); await wait(page, 500);
  // results (fuse out)
  await page.evaluate(() => { BR.Run.engine.fuse = 0.01; BR.Run.engine.sparkUsed = true; });
  await page.waitForFunction(() => BR.Run.resultsEl, null, { timeout: 15000 }).catch(() => {});
  await wait(page, 4200); await shot('results');
  found.results = await page.evaluate(() => { const r = BR.Run.resultsEl; const sc = r.querySelector('.res-scroll, .scroll') || r; const act = r.querySelector('.res-actions, .actions'); return { sh: sc.scrollHeight, ch: sc.clientHeight, actions: act ? act.getBoundingClientRect().toJSON() : null }; });
  await page.evaluate(() => { const r = BR.Run.resultsEl; const sc = [...r.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible') || r; sc.scrollTop = 99999; });
  await wait(page, 600); await shot('results-end');

  // Chill: round clear and out of moves
  await startRun(page, 'chill'); await wait(page, 800); await shot('chill-start');
  found.geoChill = await geo();
  await page.evaluate(() => { const e = BR.Run.engine; e.stageScore = e.goal - 5; });
  await setBoard(page, BIG); await tap(page, 0, 0); await wait(page, 1000); await shot('chill-clear');
  await idle(page); await wait(page, 2500); await shot('chill-next');
  await page.evaluate(() => { const e = BR.Run.engine; e.movesLeft = 1; e.stageScore = 0; BR.Run.hudChill(false); });
  await setBoard(page, ['01010101', '10101010', '01010101', '10101010', '01010101', '10101010', '01010101', '1010103*'.replace('*', '3')]);
  await tap(page, 7, 6); await wait(page, 900); await shot('chill-out');
  await page.waitForFunction(() => BR.Run.resultsEl, null, { timeout: 15000 }).catch(() => {});
  await wait(page, 4200); await shot('chill-results');
  fs.writeFileSync(path.join(OUT, `run-${tag}.json`), JSON.stringify({ tag, W, H, errors, found }, null, 1));
  console.log(tag, 'errors', errors.length, errors.slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.error(tag, e); process.exit(1); });
