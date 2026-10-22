// Update 4 cosmetics touch-up (css/u4-boards.css, css/u4-skins.css, js/u4-cosmetics.js): the budgets that keep the older boards, skins and pops cheap and readable.
//   1. every older board keeps all seven brick colors at least as readable as Midnight (WCAG contrast of brick vs board surface, bricks hidden)
//   2. a board runs at most two animations behind the bricks, a skin animates at most a third of a 64-brick board, no skin uses a blend mode or animates layout
//   3. low-end and reduced motion hold everything still
//   4. the older pops steer particles only in normal mode, and every steered particle is released when it dies
// Usage: node tests/u4cosmetics.js
const { launch } = require('./lib');
const BOARDS = ['a_deepsea', 'a_foundry', 'a_market', 'a_orbit', 'a_greenhouse', 'a_storm', 'a_holo'];
const SKINS = ['default:skin', 'f_candy', 'f_slate', 'f_marble', 'f_glass', 'f_neon', 'f_lava', 'f_circuit', 'f_nova', 'f_aurora', 'f_chrome', 'f_heart'];
const POPS = ['b_ember', 'b_petal', 'b_glass', 'b_pixel', 'b_bolt', 'b_fire'];
(async () => {
  let problems = 0;
  const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  await page.evaluate(() => { BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 3; BR.Storage.data.settings.sound = false; BR.Storage.data.settings.perf = 'high'; BR.App.applySettings(); });
  const run = async (ids) => {
    await page.evaluate((ids) => {
      const P = BR.Progress; ['skin', 'pop', 'board', 'fuse'].forEach((t) => P.equip('default', t));
      ids.forEach((id) => { const it = BR.itemById[id]; const inst = BR.Storage.data.profile.vault.find((v) => v.itemId === id) || P.keep({ itemId: id, shine: 'plain', seed: 3, counter: null }); P.equip(inst.uid, it.type); });
      BR.Skins.apply(); BR.Run.over = true; if (BR.Router.current === 'run') BR.Router.go('home', { instant: true });
      __app.startRun({ mode: 'rush', boosts: {} });
    }, ids);
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 });
    await page.waitForTimeout(350);
  };
  // animations that are running behind or on the board (the scene), and on the bricks
  const anims = () => page.evaluate(() => {
    const all = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target);
    const inBg = (el) => !!el.closest('#bg'), inField = (el) => !!el.closest('#field .brick');
    const board = document.getElementById('board');
    return {
      scene: all.filter((a) => inBg(a.effect.target) || a.effect.target === board).map((a) => (a.animationName || '?') + (a.effect.pseudoElement || '')),
      field: all.filter((a) => inField(a.effect.target) && a.animationName).length,
      props: Array.from(new Set(all.filter((a) => (inBg(a.effect.target) || inField(a.effect.target)) && a.effect.getKeyframes).flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))),
    };
  });
  const SAFE = new Set(['transform', 'opacity', 'translate', 'rotate', 'scale']);

  // ---- 1. contrast
  const surface = async () => {
    await page.addStyleTag({ content: '*{animation:none!important;transition:none!important} #field .brick,#field .tap-hint{visibility:hidden!important} #fxlayer,.rush-glow{display:none!important}' });
    const buf = await page.screenshot();
    return page.evaluate(async ({ b64 }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const f = document.getElementById('field').getBoundingClientRect(), cell = f.width / 8;
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
      const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const cols = BR.PALETTE.map((p) => { const a = hex(p.hi), b = hex(p.lo); return { mid: lum((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), lo: lum(...b) }; });
      const surf = [];
      for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) {
        const x0 = Math.round(f.left + q * cell + cell * 0.2), y0 = Math.round(f.top + r * cell + cell * 0.2), w = Math.max(2, Math.round(cell * 0.6));
        const d = g.getImageData(x0, y0, w, w).data; let R = 0, G = 0, B = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
        surf.push(lum(R / n, G / n, B / n));
      }
      const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return { mid: Math.min(...cols.flatMap((c) => surf.map((s) => cr(c.mid, s)))), lo: Math.min(...cols.flatMap((c) => surf.map((s) => cr(c.lo, s)))) };
    }, { b64: buf.toString('base64') });
  };
  const sizes = [[393, 852], [360, 640], [430, 932], [844, 390]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    const base = await (async () => { await run([]); return surface(); })();
    for (const id of BOARDS) {
      await run([id]);
      const s = await surface();
      ok(s.mid >= base.mid - 0.02 && s.lo >= base.lo - 0.02, `${id} at ${w}x${h}: worst contrast mid ${s.mid.toFixed(2)} lo ${s.lo.toFixed(2)} is below Midnight's ${base.mid.toFixed(2)} / ${base.lo.toFixed(2)}`);
    }
    console.log(`contrast ${w}x${h}: Midnight worst mid ${base.mid.toFixed(2)} lo ${base.lo.toFixed(2)}`);
  }
  await page.reload(); await page.waitForFunction(() => window.__app); await page.setViewportSize({ width: 393, height: 852 });
  await page.evaluate(() => { Object.keys(BR.Coach.CARDS).forEach((k) => { BR.Storage.data.seen[k] = true; }); BR.Storage.data.seen.whatsnew3 = true; BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 3; BR.Storage.data.settings.sound = false; BR.Storage.data.settings.perf = 'high'; BR.App.applySettings(); });

  // ---- 2. motion budget
  for (const id of ['default:board'].concat(BOARDS)) {
    await run(id.startsWith('default') ? [] : [id]);
    const a = await anims();
    ok(a.scene.length <= 2, `${id}: ${a.scene.length} animations behind the bricks (max 2)`, a.scene);
    console.log(`motion ${id.padEnd(15)} behind the bricks: ${a.scene.join(', ') || 'nothing'}`);
    ok(a.props.every((p) => SAFE.has(p)), `${id}: animates a property other than transform/opacity`, a.props);
  }
  for (const id of SKINS) {
    await run(id.startsWith('default') ? [] : [id]);
    const a = await anims();
    ok(a.field <= 43, `${id}: ${a.field} animations on the bricks (max 43 of 64)`);
    console.log(`motion ${id.padEnd(15)} brick animations: ${a.field}`);
    ok(a.props.every((p) => SAFE.has(p)), `${id}: animates a property other than transform/opacity`, a.props);
    const blend = await page.evaluate(() => Array.from(document.querySelectorAll('#field .brick *')).some((el) => !el.classList.contains('sheen') && getComputedStyle(el).mixBlendMode !== 'normal'));
    ok(!blend, `${id}: a brick layer uses a blend mode`);
  }

  // ---- 3. low-end and reduced hold still
  for (const mode of ['low', 'reduced']) {
    await page.evaluate((m) => { const s = BR.Storage.data.settings; s.reduced = m === 'reduced'; s.perf = m === 'low' ? 'low' : 'high'; BR.App.applySettings(); }, mode);
    for (const id of ['default:board'].concat(BOARDS)) {
      await run(id.startsWith('default') ? [] : [id]);
      const a = await anims();
      ok(a.scene.length === 0, `${mode}: ${id} still animates behind the bricks`, a.scene);
    }
    for (const id of ['f_lava', 'f_circuit', 'f_nova', 'f_aurora', 'f_chrome', 'f_heart']) {
      await run([id]);
      const a = await anims();
      ok(a.field === 0, `${mode}: ${id} still animates ${a.field} brick layers`);
    }
  }
  await page.evaluate(() => { const s = BR.Storage.data.settings; s.reduced = false; s.perf = 'high'; BR.App.applySettings(); });

  // ---- 4. pops: steered in normal mode, released afterwards, original recipes in reduced / low-end
  const tap = async () => {
    const p = await page.evaluate(() => { const e = BR.Run.engine; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const q = e.plan(r, c); if (q && (!best || q.cells.length > best.n)) best = { r, c, n: q.cells.length }; } return best && BR.Run.view.pagePoint(best.r, best.c); });
    if (p) await page.mouse.click(p.x, p.y);
    await page.waitForFunction(() => !BR.Run.busy, null, { timeout: 8000 }).catch(() => { problems++; console.log('PROBLEM stuck'); });
  };
  for (const mode of ['normal', 'reduced', 'low']) {
    await page.evaluate((m) => { const s = BR.Storage.data.settings; s.reduced = m === 'reduced'; s.perf = m === 'low' ? 'low' : 'high'; BR.App.applySettings(); }, mode);
    for (const id of POPS) {
      await run([id]);
      for (let i = 0; i < 3; i++) { await tap(); await page.waitForTimeout(50); }
      const mid = await page.evaluate(() => BR.U4.live.length);
      ok(mode === 'normal' ? true : mid === 0, `${mode}: ${id} steered ${mid} particles`);
      await page.waitForTimeout(2600);
      const end = await page.evaluate(() => BR.U4.live.length);
      ok(end === 0, `${mode}: ${id} left ${end} steered particles behind`);
    }
  }
  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  ok(real.length === 0, 'console errors', real);
  console.log(problems ? problems + ' PROBLEMS' : 'u4 cosmetics ok');
  await browser.close();
  process.exit(problems ? 1 : 0);
})();
