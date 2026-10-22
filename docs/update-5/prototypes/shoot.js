// Prototype harness (scratch only, never touches the repo): loads the real game read-only, injects a prototype stylesheet and
// small DOM mocks, and screenshots the run screen at iPhone 15 Pro size (393x852, 3x).
// Usage: node shoot.js <which> [outdir]     which = hourglass | moonglass | sigil
const path = require('path');
const fs = require('fs');
const { launch } = require('/home/user/Brick-Rng/tests/lib.js');
const which = process.argv[2] || 'hourglass';
const out = process.argv[3] || path.join(__dirname, 'shots');
fs.mkdirSync(out, { recursive: true });

async function setup(page, board) {
  await page.evaluate((board) => {
    BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 9; BR.Storage.data.settings.sound = false; BR.Storage.data.settings.music = false; BR.App.applySettings();
    const P = BR.Progress; ['skin', 'pop', 'board', 'fuse'].forEach((t) => P.equip('default', t));
    if (board) { const inst = P.keep({ itemId: board, shine: 'plain', seed: 3, counter: null }); P.equip(inst.uid, 'board'); }
    BR.Skins.apply();
    __app.startRun({ mode: 'rush', boosts: {} });
  }, board || null);
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 10000 });
  await page.evaluate(() => { BR.Run.engine.fuse = 19; });
  await page.waitForTimeout(400);
}
async function skin(page, cls, cssFile) {
  await page.addStyleTag({ content: fs.readFileSync(path.join(__dirname, cssFile), 'utf8') });
  await page.evaluate((cls) => {
    document.querySelectorAll('[data-skin-host]').forEach((el) => { Array.from(el.classList).filter((c) => /^skin-/.test(c)).forEach((c) => el.classList.remove(c)); el.classList.add(cls); });
  }, cls);
  await page.waitForTimeout(250);
}
/** Brick records with their row / column, from the real board view. */
const cellsJS = `Array.from(BR.Run.view.bricks.values()).map((rec) => ({ r: rec.r, c: rec.c, el: rec.el }))`;

async function shot(page, name, clip) {
  const file = path.join(out, name + '.png');
  await page.screenshot({ path: file, clip });
  console.log(file);
  return file;
}
async function boardClip(page) {
  return page.evaluate(() => { const b = document.getElementById('board').getBoundingClientRect(); return { x: b.left - 6, y: b.top - 6, width: b.width + 12, height: b.height + 12 }; });
}

/* --------------------------------------------------------------- per-colour readability: mean colour of each brick's centre,
   then the smallest colour difference (CIE76 Delta E in Lab) between two different brick colours, for normal vision and two
   simulated colour-vision deficiencies (Machado 2009, severity 1). */
async function readability(page, label) {
  const buf = await page.screenshot();
  const res = await page.evaluate(async ({ b64, cells }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const k = img.width / innerWidth;
    const view = BR.Run.view, f = view.field.getBoundingClientRect(), cell = view.cell;
    const recs = Array.from(view.bricks.values()).filter((r) => !r.el.classList.contains('fusebrick'));
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const toLab = ([r, gg, b]) => {
      let R = lin(r), G = lin(gg), B = lin(b);
      let X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
      const fx = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      return [116 * fx(Y) - 16, 500 * (fx(X) - fx(Y)), 200 * (fx(Y) - fx(Z))];
    };
    const M = { deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]], protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]] };
    const unlin = (v) => { v = Math.max(0, Math.min(1, v)); return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
    const sim = (rgb, m) => { const L = rgb.map(lin); return m.map((row) => unlin(row[0] * L[0] + row[1] * L[1] + row[2] * L[2])); };
    const samples = recs.map((rec) => {
      const x0 = Math.round((f.left + rec.c * cell + cell * 0.3) * k), y0 = Math.round((f.top + rec.r * cell + cell * 0.3) * k), w = Math.round(cell * 0.4 * k);
      const d = g.getImageData(x0, y0, w, w).data; let R = 0, G = 0, B = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
      return { col: +rec.el.dataset.c, rgb: [R / n, G / n, B / n] };
    });
    const de = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const out = {};
    for (const mode of ['normal', 'deutan', 'protan']) {
      let min = 1e9, pair = null;
      const lab = samples.map((s) => ({ col: s.col, lab: toLab(mode === 'normal' ? s.rgb : sim(s.rgb, M[mode])) }));
      for (let i = 0; i < lab.length; i++) for (let j = i + 1; j < lab.length; j++) if (lab[i].col !== lab[j].col) { const v = de(lab[i].lab, lab[j].lab); if (v < min) { min = v; pair = [lab[i].col, lab[j].col]; } }
      out[mode] = { min: +min.toFixed(1), pair: pair && pair.map((p) => BR.PALETTE[p].name).join('/') };
    }
    return out;
  }, { b64: buf.toString('base64') });
  console.log('readability', label, JSON.stringify(res)); if (typeof window === 'undefined') {}
  return res;
}

(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 3 });
  const report = {};
  if (which === 'baseline') {
    await setup(page);
    report.classic = await readability(page, 'classic');
    for (const id of ['f_galaxy', 'f_phoenix', 'f_neon', 'f_glass', 'f_heart', 'f_lantern']) {
      await page.evaluate((id) => { const P = BR.Progress; const inst = P.keep({ itemId: id, shine: 'plain', seed: 3, counter: null }); P.equip(inst.uid, 'skin'); BR.Skins.apply(); }, id);
      await page.waitForTimeout(300);
      report[id] = await readability(page, id);
    }
  }
  if (which === 'hourglass') {
    await setup(page);
    await skin(page, 'skin-hourglass', 'hourglass.css');
    await shot(page, 'hourglass_idle_full');
    const clip = await boardClip(page);
    await shot(page, 'hourglass_idle_board', clip);
    report.idle = await readability(page, 'hourglass idle');
    // stage-up flip: every hourglass turns over, in a wave from the top-left corner (frame at t ms)
    for (const t of [140, 300, 460]) {
      await page.evaluate(({ t, js }) => {
        const cells = eval(js), D = 26, DUR = 420, ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
        cells.forEach(({ r, c, el }) => {
          const d = el.querySelector('.deco'); if (!d || el.classList.contains('fusebrick')) return;
          const k = Math.max(0, Math.min(1, (t - (r + c) * D) / DUR)), e = ease(k);
          d.style.transform = `rotate(${(e * 180).toFixed(1)}deg) scale(${(1 + 0.08 * Math.sin(k * Math.PI)).toFixed(3)})`;
        });
      }, { t, js: cellsJS });
      await shot(page, 'hourglass_flip_' + t, clip);
    }
    await page.evaluate(({ js }) => eval(js).forEach(({ el }) => { const d = el.querySelector('.deco'); if (d) d.style.transform = ''; }), { js: cellsJS });
    // Rush: time stops
    await page.evaluate(() => BR.Run.el.classList.add('rushing'));
    await page.waitForTimeout(200);
    await shot(page, 'hourglass_rush_board', clip);
    report.rush = await readability(page, 'hourglass rush');
    await page.evaluate(() => BR.Run.el.classList.remove('rushing'));
    // shape hints (colour-blind setting) still read through the glass
    await page.evaluate(() => document.documentElement.classList.add('shapes'));
    await page.addStyleTag({ content: 'html.shapes .skin-hourglass .stud{z-index:2;width:30%;height:30%;top:50%}' });
    await page.waitForTimeout(200);
    await shot(page, 'hourglass_shapes_board', clip);
    await page.evaluate(() => document.documentElement.classList.remove('shapes'));
    // zoom: 3x3 bricks at full device resolution
    const z = await page.evaluate(() => { const f = document.getElementById('field').getBoundingClientRect(), c = BR.Run.view.cell; return { x: f.left, y: f.top, width: c * 3, height: c * 3 }; });
    await shot(page, 'hourglass_zoom', z);
  }
  if (which === 'moonglass') {
    await setup(page);
    await skin(page, 'skin-moonglass', 'moonglass.css');
    // in the build, BoardView._place() would write these two numbers with the transform it already writes
    await page.evaluate((js) => eval(js).forEach(({ r, c, el }) => { el.style.setProperty('--r', r); el.style.setProperty('--c', c); }), cellsJS);
    const clip = await boardClip(page);
    await shot(page, 'moonglass_idle_full');
    await shot(page, 'moonglass_idle_board', clip);
    report.idle = await readability(page, 'moonglass idle');
    await page.evaluate(() => BR.Run.el.classList.add('rushing', 'mg-full'));
    await page.waitForTimeout(300);
    await shot(page, 'moonglass_rush_full');
    await shot(page, 'moonglass_rush_board', clip);
    report.rush = await readability(page, 'moonglass rush');
    const z = await page.evaluate(() => { const f = document.getElementById('field').getBoundingClientRect(), c = BR.Run.view.cell; return { x: f.left + c * 2, y: f.top + c * 2, width: c * 4, height: c * 3 }; });
    await shot(page, 'moonglass_rush_zoom', z);
  }
  if (which === 'sigil') {
    await setup(page);
    await skin(page, 'skin-sigil', 'sigil.css');
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'sigil.js'), 'utf8') });
    const clip = await boardClip(page);
    await shot(page, 'sigil_idle_board', clip);
    report.idle = await readability(page, 'sigil idle');
    const z = await page.evaluate(() => { const f = document.getElementById('field').getBoundingClientRect(), c = BR.Run.view.cell; return { x: f.left, y: f.top, width: c * 4, height: c * 2 }; });
    await shot(page, 'sigil_zoom', z);
    // a big pop: the spell circle around the biggest group, frozen at its brightest frame
    await page.evaluate(() => window.__sigilCast && window.__sigilCast());
    await page.waitForTimeout(120);
    await shot(page, 'sigil_cast_full');
    // Rush: the rune ring around the board counts down the eight seconds
    await page.evaluate(() => { document.querySelectorAll('.pz-cast,.pz-pillar').forEach((n) => n.remove()); document.querySelectorAll('#field .hl').forEach((n) => n.classList.remove('hl')); document.getElementById('field').classList.remove('has-hl'); BR.Run.el.classList.add('rushing'); window.__sigilRush && window.__sigilRush(5); });
    await page.waitForTimeout(150);
    await shot(page, 'sigil_rush_full');
  }
  if (which === 'seven') {
    // all seven colours on one board (a late-stage board), for the readability check: each brick gets a colour from a fixed
    // pattern, so every colour sits next to every other colour somewhere
    await setup(page);
    const recolor = () => page.evaluate((js) => eval(js).forEach(({ r, c, el }) => { el.dataset.c = String((r * 3 + c * 2 + (r % 2) * c) % 7); el.style.setProperty('--r', r); el.style.setProperty('--c', c); }), cellsJS);
    await recolor();
    const clip = await boardClip(page);
    report.classic = await readability(page, 'classic 7');
    for (const id of ['f_lantern', 'f_neon', 'f_galaxy']) {
      await page.evaluate((id) => { const P = BR.Progress; const inst = P.keep({ itemId: id, shine: 'plain', seed: 3, counter: null }); P.equip(inst.uid, 'skin'); BR.Skins.apply(); }, id);
      await page.waitForTimeout(300);
      report[id] = await readability(page, id + ' 7');
    }
    for (const [cls, css] of [['skin-hourglass', 'hourglass.css'], ['skin-moonglass', 'moonglass.css'], ['skin-sigil', 'sigil.css']]) {
      await skin(page, cls, css);
      report[cls] = await readability(page, cls + ' 7');
      await shot(page, cls.replace('skin-', '') + '_7colors_board', clip);
      await page.evaluate(() => BR.Run.el.classList.add('rushing', 'mg-full'));
      await page.waitForTimeout(250);
      report[cls + ' rush'] = await readability(page, cls + ' rush 7');
      await shot(page, cls.replace('skin-', '') + '_7colors_rush_board', clip);
      await page.evaluate(() => BR.Run.el.classList.remove('rushing', 'mg-full'));
    }
  }
  fs.writeFileSync(path.join(out, which + '_report.json'), JSON.stringify(report, null, 1));
  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  if (real.length) console.log('errors', real);
  await browser.close();
})();
