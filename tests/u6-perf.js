// Update 6, lag and Performance mode: the Performance mode setting (classes, Graphics greyed out, no background bricks, no looping
// decoration in a run, saved), BR.replay restarts an animation without reading styles, a pop never restyles the bricks it did not
// touch (no :nth-child brick rules), the spent chest reel leaves the page when the reveal starts, the menus behind a chest are
// skipped by rendering, the golden chest picker is never under the chest, and the Coin payout. Usage: node tests/u6-perf.js
const fs = require('fs');
const path = require('path');
const { launch } = require('./lib');

let problems = 0;
const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };

// static: no brick rule picks bricks by their place among their siblings (each pop would restyle the whole board)
const cssDir = path.join(__dirname, '..', 'css');
for (const f of fs.readdirSync(cssDir).filter((x) => x.endsWith('.css'))) {
  const css = fs.readFileSync(path.join(cssDir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const sel of css.split('}').map((r) => r.split('{')[0])) {
    if (/\.brick[^,{]*:(nth-child|nth-last-child|nth-of-type|first-child|last-child)/.test(sel)) ok(false, f, 'brick rule by sibling position:', sel.trim().slice(0, 120));
  }
}

(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  await page.evaluate(() => { const D = BR.Storage.data; D.seenTutorial = true; D.runs = 8; D.settings.sound = false; D.settings.music = false; D.settings.haptics = false; BR.App.applySettings(); });
  await page.waitForTimeout(900);
  await page.evaluate(() => { BR.Coach.markAllSeen(); for (let i = 0; i < 5 && BR.Back.depth; i++) BR.Back.closeTop(); });

  // the Coin payout (Update 6: about 10% more, then every part doubled)
  const coins = await page.evaluate(() => ({ scale: BR.CFG.coin.scale, typical: BR.Progress.runCoins({ score: 54000, stagesCleared: 3 }).total }));
  ok(coins.scale === 32, 'coin scale', coins.scale);
  ok(coins.typical >= 45 && coins.typical <= 50, 'a casual run pays about double Update 5 plus 10% (was 21)', coins.typical);

  // BR.replay: the first call adds the class, a repeat takes it off and puts it back two frames later, never reading styles
  const rp = await page.evaluate(async () => {
    const el = document.createElement('div'); document.body.appendChild(el);
    let reads = 0; const orig = Element.prototype.getAnimations; Element.prototype.getAnimations = function () { reads++; return orig.call(this); };
    BR.replay(el, 'bump'); const first = el.classList.contains('bump');
    BR.replay(el, 'bump'); BR.replay(el, 'bump'); const off = !el.classList.contains('bump');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
    const back = el.classList.contains('bump');
    Element.prototype.getAnimations = orig; el.remove();
    return { first, off, back, reads };
  });
  ok(rp.first && rp.off && rp.back, 'replay restarts the class', JSON.stringify(rp));
  ok(rp.reads === 0, 'replay never reads the animations (a forced style pass)', rp.reads);

  // Performance mode: the setting sheet
  await page.evaluate(() => BR.settingsSheet()); await page.waitForTimeout(600);
  ok(await page.$('[data-set="perfMode"]'), 'Settings has a Performance mode switch');
  await page.evaluate(() => document.querySelector('[data-set="perfMode"]').click()); await page.waitForTimeout(300);
  const pm = await page.evaluate(() => ({ saved: JSON.parse(localStorage.getItem(BR.Storage.KEY || 'poprush.v4') || '{}').settings, set: BR.Storage.data.settings.perfMode, html: document.documentElement.className, low: BR.lowEnd, flag: BR.perfMode,
    seg: [...document.querySelectorAll('[data-perf]')].every((b) => b.disabled), off: document.querySelector('.perf').classList.contains('off'), bg: document.getElementById('bgBricks').childElementCount, budget: BR.fx.budget }));
  ok(pm.set === true && pm.flag && pm.low, 'Performance mode is on and implies low effects', JSON.stringify({ set: pm.set, flag: pm.flag, low: pm.low }));
  ok(/\bperf-mode\b/.test(pm.html) && /\blow-end\b/.test(pm.html), 'html carries perf-mode and low-end', pm.html);
  ok(pm.seg && pm.off, 'the Graphics choice is greyed out while Performance mode is on');
  ok(pm.bg === 0, 'no floating bricks behind the menus', pm.bg);
  ok(pm.budget < 0.6, 'fewer sparks than Smooth', pm.budget);
  ok(!pm.saved || pm.saved.perfMode === true, 'the setting is saved', pm.saved && pm.saved.perfMode);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);

  // a run in Performance mode: nothing decorative loops, the board and the fuse still work
  await page.evaluate(() => { BR.App.startRun({ mode: 'rush', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 }); await page.waitForTimeout(4500);
  const run = await page.evaluate(() => {
    const live = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity);
    const names = live.map((a) => (a.animationName || 'waapi') + ' ' + (a.effect.target ? a.effect.target.className : '')).filter((n) => !/^(hintPulse|hintRing|hintDot)\b/.test(n));
    return { names, bricks: document.querySelectorAll('#field .brick').length, sheen: getComputedStyle(document.querySelector('#field .sheen'), '::before').display };
  });
  ok(run.bricks >= 40, 'the board is there', run.bricks);
  ok(run.names.length === 0, 'no looping decoration in a Performance mode run:', run.names.slice(0, 6).join(', '));
  await page.evaluate(() => { BR.Run.over = true; BR.Run.token++; BR.Router.go('home'); }); await page.waitForTimeout(600);

  // turning it off brings the floating bricks back
  await page.evaluate(() => { BR.Storage.data.settings.perfMode = false; BR.App.applySettings(); });
  const back = await page.evaluate(() => ({ html: document.documentElement.className, bg: document.getElementById('bgBricks').childElementCount }));
  ok(!/\bperf-mode\b/.test(back.html) && back.bg > 0, 'off again: classes and background bricks restored', JSON.stringify(back));

  // a chest: the menus behind are skipped by rendering, and the spent reel leaves the page when the reveal starts
  await page.evaluate(() => { BR.Progress.addChest('brick', 1); BR.Router.go('shop'); }); await page.waitForTimeout(700);
  await page.evaluate(() => { BR.App.openChest('brick'); });
  await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 15000 });
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('screens')).contentVisibility === 'hidden'), 'the menus behind the chest are skipped by rendering');
  const box = await page.locator('.hold').boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.waitForFunction(() => document.querySelector('.reel'), null, { timeout: 30000 }); await page.mouse.up();
  const during = await page.evaluate(() => document.querySelectorAll('.op-reel *').length);
  await page.waitForFunction(() => BR.Openings.current && BR.Openings.current.state === 'reveal', null, { timeout: 30000, polling: 20 });
  const after = await page.evaluate(() => document.querySelectorAll('.op-reel .rc').length);
  ok(during > 300 && after === 0, 'the reel leaves the page at the reveal', during, after);
  await page.waitForFunction(() => document.querySelector('.rv-actions.on'), null, { timeout: 30000 });
  await page.evaluate(() => BR.Openings.current.requestClose(false)); await page.waitForTimeout(900);
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('screens')).contentVisibility !== 'hidden'), 'the menus come back after the chest');

  // the golden chest: before a type is picked, the chest never covers the type picker (phone, small phone, landscape)
  for (const [w, h] of [[393, 852], [360, 640], [844, 390]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(300);
    await page.evaluate(() => { BR.Progress.addChest('golden', 1); BR.App.openChest('golden'); });
    await page.waitForSelector('.opening.on .op-picker button', { timeout: 15000 }); await page.waitForTimeout(1600);
    const g = await page.evaluate(() => {
      const p = document.querySelector('.op-picker').getBoundingClientRect(), c = document.querySelector('.op-chest-wrap').getBoundingClientRect();
      const btns = [...document.querySelectorAll('.op-picker button')].map((b) => { const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(top && b.contains(top)); });
      return { overlap: Math.max(0, Math.min(p.bottom, c.bottom) - Math.max(p.top, c.top)) > 2 && Math.max(0, Math.min(p.right, c.right) - Math.max(p.left, c.left)) > 2, tappable: btns.every(Boolean) };
    });
    ok(g.tappable, `golden picker buttons are all tappable at ${w}x${h}`);
    await page.evaluate(() => BR.Openings.current.requestClose(false)); await page.waitForTimeout(900);
  }

  ok(!errors.length, 'page errors', errors.join(' | '));
  await browser.close();
  console.log(problems ? `u6-perf: ${problems} problem(s)` : 'u6-perf ok');
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
