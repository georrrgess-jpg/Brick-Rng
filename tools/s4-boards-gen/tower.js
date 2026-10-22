// Moonwick Tower (Mythic): the board stands on the tower's top balcony. A huge cratered moon fills the upper scene (clouds drift across it),
// slender stone spires flank the board with a column of ten windows (one lights per stage), a bronze bell hangs in an arch, the town's roofs
// with warm windows lie far below (and flicker). The frame is carved stone with a moon-phase engraving.
// Layers: .bg background = sky, stars, spires with dark windows, town; .s4x.moon and .s4x.bell are DOM twins of the static art (moments);
// .scene-fx = the clouds crossing the moon (animation 1); .bg::before = the town's flickering windows (animation 2).
const L = require('./lib');
const { S, n, mix, lighten, darken, rngOf, svgc, glowDef, bgPiece, registry, boxCSS, bgTile, url } = L;

const MID = '#08102a', SILVER = '#e8f0ff', GOLD = '#ffcf6b', RW = 4;

function moon() {
  const W = 200, H = 200, rnd = rngOf(9);
  const defs = glowDef('h', '#cfe0ff', 0.55, 0.16) + S.rg('m', [[0, '#fbfcff'], [0.55, '#dde6f6'], [0.9, '#a9b8d8'], [1, '#8494b8']], 0.4, 0.36, 0.62)
    + S.rg('lb', [[0.7, '#000', 0], [1, '#0a1030', 0.5]]) + S.lg('ph', [[0, '#050a22', 0.78], [0.8, '#050a22', 0.4], [1, '#050a22', 0]], 0, 0, 1, 0);
  let b = `<circle cx='100' cy='100' r='100' fill='url(#h)'/><circle cx='100' cy='100' r='76' fill='url(#m)'/>`;
  // maria: the dark seas
  [[78, 78, 22, 16, -20], [112, 70, 14, 11, 10], [92, 116, 26, 14, 30], [126, 104, 12, 16, 0], [66, 106, 10, 8, 0]].forEach(([x, y, rx, ry, a]) => { b += `<ellipse cx='${x}' cy='${y}' rx='${rx}' ry='${ry}' transform='rotate(${a} ${x} ${y})' fill='#8f9fc0' opacity='.45'/>`; });
  // craters: a shaded bowl with a lit rim
  for (let i = 0; i < 22; i++) {
    const a = rnd.between(0, 6.28), r = Math.sqrt(rnd.f()) * 66, x = 100 + Math.cos(a) * r, y = 100 + Math.sin(a) * r, cr = rnd.between(2, i < 5 ? 9 : 5);
    b += `<circle cx='${n(x)}' cy='${n(y)}' r='${n(cr)}' fill='#7686a8' opacity='.38'/><circle cx='${n(x + cr * 0.12)}' cy='${n(y + cr * 0.14)}' r='${n(cr * 0.82)}' fill='#b4c2de' opacity='.45'/><path d='M${n(x - cr)} ${n(y)}A${n(cr)} ${n(cr)} 0 0 1 ${n(x + cr * 0.6)} ${n(y - cr * 0.8)}' stroke='#fff' stroke-width='.9' fill='none' opacity='.7'/>`;
  }
  b += `<circle cx='100' cy='100' r='76' fill='url(#lb)'/><circle cx='100' cy='100' r='76' fill='url(#ph)' opacity='.6'/>`;
  return svgc(W, H, b, defs, '');
}

/** clouds that cross the moon (the tile of the moving .scene-fx layer, wraps horizontally) */
function clouds() {
  const W = 520, H = 120, rnd = rngOf(15);
  const defs = S.lg('c', [[0, '#9fb4e0', 0.5], [1, '#1a2a5a', 0.65]]) + S.lg('e', [[0, '#e8f0ff', 0], [0.5, '#e8f0ff', 0.4], [1, '#e8f0ff', 0]], 0, 0, 1, 0);
  let b = '';
  const wisp = (x, y, w, h, op) => [-W, 0, W].filter((dx) => x + dx + w / 2 > 0 && x + dx - w / 2 < W).map((dx) => { let s = ''; const k = Math.max(4, Math.round(w / 16)); for (let i = 0; i < k; i++) { const t = i / (k - 1), rr = h * (0.5 + 0.5 * Math.sin(t * Math.PI)); s += `<ellipse cx='${n(x + dx - w / 2 + t * w)}' cy='${n(y - rr * 0.1)}' rx='${n(rr * 1.7)}' ry='${n(rr * 0.7)}' fill='url(#c)' opacity='${op}'/>`; } return s + `<ellipse cx='${n(x + dx)}' cy='${n(y - h * 0.5)}' rx='${n(w * 0.46)}' ry='1' fill='url(#e)' opacity='${op}'/>`; }).join('');
  [[60, 34, 130, 12, 0.85], [200, 62, 160, 14, 0.8], [350, 40, 120, 11, 0.85], [470, 74, 140, 13, 0.75], [120, 92, 150, 12, 0.7], [300, 100, 130, 10, 0.7]].forEach(([x, y, w, h, o]) => { b += wisp(x, y, w, h, o); });
  return svgc(W, H, b, defs, '');
}

/** stars (a tile that repeats across the top) */
function stars() {
  const W = 260, H = 400, rnd = rngOf(27);
  const defs = glowDef('s', '#dce8ff', 0.8, 0.25);
  let b = '';
  for (let i = 0; i < 70; i++) {
    const x = rnd.between(0, W), y = rnd.between(0, H * (0.4 + 0.6 * rnd.f())), r = rnd.between(0.4, 1.3), a = n(rnd.between(0.3, 0.95));
    b += `<circle cx='${n(x)}' cy='${n(y)}' r='${n(r)}' fill='#fff' opacity='${a}'/>`;
    if (r > 1) b += `<circle cx='${n(x)}' cy='${n(y)}' r='${n(r * 3)}' fill='url(#s)' opacity='${a}'/>`;
  }
  return svgc(W, H, b, defs, '');
}

/** a spire strip: a slender stone column with an arched window at every tenth of the screen's height (repeat-y at 10%) */
function spire(flip) {
  const W = 16, H = 90;
  const defs = S.lg('st', [[0, '#101a3c'], [0.5, '#25335e'], [1, '#3a4a7a']], 0, 0, 1, 0) + S.lg('gl', [[0, '#0a1430'], [1, '#050a1c']]);
  let b = `<g${flip ? ` transform='translate(${W} 0) scale(-1 1)'` : ''}>`;
  b += `<rect width='${W}' height='${H}' fill='url(#st)'/>`;
  for (let y = 4; y < H; y += 10) b += `<rect y='${y}' width='${W}' height='.6' fill='#000' opacity='.35'/><rect y='${y + 0.6}' width='${W}' height='.5' fill='#8aa0d8' opacity='.12'/>`;
  b += `<rect x='${W - 1.4}' width='1.4' height='${H}' fill='#c8d4ee' opacity='.35'/><rect x='0' width='1.6' height='${H}' fill='#000' opacity='.4'/>`;
  // the window: a stone surround, a dark pane, a little tracery
  const cx = 10.4, wy = 30, ww = 6.2, wh = 24;
  b += `<path d='M${cx - ww / 2 - 1.2} ${wy + wh}V${wy + 4}A${ww / 2 + 1.2} ${ww / 2 + 1.2} 0 0 1 ${cx + ww / 2 + 1.2} ${wy + 4}V${wy + wh}Z' fill='#6a7aaa'/>`;
  b += `<path d='M${cx - ww / 2} ${wy + wh}V${wy + 4}A${ww / 2} ${ww / 2} 0 0 1 ${cx + ww / 2} ${wy + 4}V${wy + wh}Z' fill='url(#gl)'/>`;
  b += `<path d='M${cx} ${wy + 1}V${wy + wh}M${cx - ww / 2} ${wy + 12}H${cx + ww / 2}' stroke='#2a3a6a' stroke-width='.7'/><path d='M${cx - ww / 2 + 0.8} ${wy + 6}V${wy + wh - 2}' stroke='#8aa8ff' stroke-width='.5' opacity='.5'/>`;
  b += `<rect x='${cx - ww / 2 - 2}' y='${wy + wh}' width='${ww + 4}' height='2.2' fill='#8a9ac8'/>`;
  return svgc(W, H, b + '</g>', defs, '');
}
/** the lit window (the same shape, glowing candle gold; one tile for the left and one for the right) */
function lit(flip) {
  const W = 16, H = 90;
  const defs = S.lg('gl', [[0, '#fff2c0'], [0.5, GOLD], [1, '#e88a2a']]) + glowDef('g', GOLD, 0.8, 0.3);
  let b = `<g${flip ? ` transform='translate(${W} 0) scale(-1 1)'` : ''}>`;
  const cx = 10.4, wy = 30, ww = 6.2, wh = 24;
  b += `<ellipse cx='${cx}' cy='${wy + 14}' rx='13' ry='20' fill='url(#g)'/>`;
  b += `<path d='M${cx - ww / 2} ${wy + wh}V${wy + 4}A${ww / 2} ${ww / 2} 0 0 1 ${cx + ww / 2} ${wy + 4}V${wy + wh}Z' fill='url(#gl)'/>`;
  b += `<path d='M${cx} ${wy + 1}V${wy + wh}M${cx - ww / 2} ${wy + 12}H${cx + ww / 2}' stroke='#7a4a10' stroke-width='.7'/>`;
  return svgc(W, H, b + '</g>', defs, '');
}

/** the town far below: layered roofs with warm windows, chimneys and a church spire (a tile that repeats) */
function townGeom() { return { W: 520, H: 120 }; }
function town(layer) {
  const { W, H } = townGeom(), rnd = rngOf(44), wins = [];
  const defs = S.lg('h', [[0, '#0a1436', 0], [1, '#0a1436', 0.85]]) + S.lg('fg', [[0, '#101a3e', 0.9], [1, '#0a1230']]);
  const roof = (x, base, w, h, col, rim, windows, seed) => {
    const r = rngOf(seed); let s = '';
    s += `<rect x='${n(x)}' y='${n(base - h)}' width='${n(w)}' height='${n(h + 30)}' fill='${col}'/>`;
    const gabled = r.chance(0.75);
    if (gabled) { const rh = r.between(6, 14); s += `<path d='M${n(x - 2)} ${n(base - h)}L${n(x + w / 2)} ${n(base - h - rh)}L${n(x + w + 2)} ${n(base - h)}Z' fill='${col}'/><path d='M${n(x - 2)} ${n(base - h)}L${n(x + w / 2)} ${n(base - h - rh)}' stroke='${rim}' stroke-width='.8' fill='none' opacity='.65'/>`; }
    else s += `<rect x='${n(x)}' y='${n(base - h)}' width='${n(w)}' height='.8' fill='${rim}' opacity='.5'/>`;
    if (r.chance(0.35)) s += `<rect x='${n(x + w * 0.7)}' y='${n(base - h - 12)}' width='3' height='10' fill='${col}'/>`;
    for (let wy = base - h + 5; wy < base - 4; wy += 8) for (let wx = x + 3; wx < x + w - 4; wx += 6) if (r.chance(windows)) wins.push([wx, wy, r.between(0.6, 1)]);
    return s;
  };
  let b = '';
  const row = (base, hmin, hmax, wmin, wmax, col, rim, wp, seed) => { const r = rngOf(seed); let x = -6; while (x < W) { const w = Math.round(r.between(wmin, wmax)), h = Math.round(r.between(hmin, hmax)); b += roof(x, base, w, h, col, rim, wp, seed + x); x += w + Math.round(r.between(0, 2)); } };
  if (layer === 'base') {
    b += `<rect y='30' width='${W}' height='60' fill='url(#h)'/>`;
    row(76, 14, 34, 16, 30, '#12204a', '#5a72b8', 0.12, 3);
    // the church with its spire
    b += `<path d='M236 76V46L248 28L260 46V76Z' fill='#16265a'/><path d='M244 28L248 8L252 28Z' fill='#16265a'/><circle cx='248' cy='6' r='1' fill='#ffe9a8'/><path d='M236 46L248 28L260 46' stroke='#6a82c8' stroke-width='.8' fill='none' opacity='.7'/><circle cx='248' cy='40' r='3' fill='#0a1230'/><circle cx='248' cy='40' r='1.8' fill='${GOLD}' opacity='.8'/>`;
    row(96, 12, 30, 20, 38, '#0d1838', '#4a62a8', 0.14, 7);
    row(120, 10, 34, 24, 44, '#070d26', '#344a8a', 0.12, 11);
    // chimney smoke
    [[96, 52], [330, 60], [440, 56]].forEach(([x, y]) => { b += `<ellipse cx='${x}' cy='${y}' rx='5' ry='9' fill='#7a8cc0' opacity='.16'/><ellipse cx='${x + 5}' cy='${y - 14}' rx='7' ry='10' fill='#7a8cc0' opacity='.1'/>`; });
    // dim windows
    wins.forEach(([x, y, a]) => { b += `<rect class='${a > 0.8 ? 'w2' : 'w1'}' x='${Math.round(x)}' y='${Math.round(y)}' width='3' height='4'/>`; });
    return svgc(W, H, b, defs, '.w1{fill:#ffcf6b;opacity:.5}.w2{fill:#ffcf6b;opacity:.72}');
  }
  // the flicker layer: bright halos at a subset of the same windows (rebuilt with the same random sequence)
  row(76, 14, 34, 16, 30, '#000', '#000', 0.12, 3); row(96, 12, 30, 20, 38, '#000', '#000', 0.14, 7); row(120, 10, 34, 24, 44, '#000', '#000', 0.12, 11);
  const defs2 = glowDef('w', '#ffcf6b', 0.9, 0.32);
  let f = '';
  wins.forEach(([x, y, a], i) => { if (i % 2 === 0) f += `<circle cx='${n(x + 1.3)}' cy='${n(y + 1.7)}' r='6' fill='url(#w)' opacity='${n(a)}'/><rect x='${n(x)}' y='${n(y)}' width='2.6' height='3.4' fill='#fff2c0'/>`; });
  return svgc(W, H, f, defs2, '');
}

/** the arch that holds the bell, a stone arch with a beam (static) */
function arch() {
  const W = 84, H = 70;
  const defs = S.lg('st', [[0, '#3a4a7a'], [0.5, '#25335e'], [1, '#101a3c']], 0, 0, 1, 0) + S.lg('br', [[0, '#8a5a26'], [1, '#2a1808']]);
  let b = `<path d='M0 70V30A42 34 0 0 1 84 30V70H70V32A28 22 0 0 0 14 32V70Z' fill='url(#st)'/>`;
  b += `<path d='M14 32A28 22 0 0 1 70 32' stroke='#c8d4ee' stroke-width='.9' fill='none' opacity='.6'/><path d='M0 30A42 34 0 0 1 84 30' stroke='#8aa0d8' stroke-width='.8' fill='none' opacity='.5'/>`;
  b += `<rect x='8' y='10' width='68' height='5' fill='url(#br)'/><rect x='8' y='10' width='68' height='.9' fill='#e0b078' opacity='.7'/>`;
  [[18, 6], [66, 6]].forEach(([x, y]) => { b += `<circle cx='${x}' cy='${y + 6}' r='1.4' fill='#e8f0ff' opacity='.7'/>`; });
  return svgc(W, H, b, defs, '');
}
/** the bell (a moving sprite, pivot at the top centre) */
function bell() {
  const W = 52, H = 64;
  const defs = S.lg('bz', [[0, '#7a4a1e'], [0.25, '#e8a458'], [0.5, '#c07830'], [1, '#4a2a0c']], 0, 0, 1, 0) + S.lg('br', [[0, '#8a5a26'], [1, '#2a1808']]);
  let b = `<rect x='24.4' y='0' width='3.2' height='10' fill='url(#br)'/><rect x='18' y='8' width='16' height='5' rx='1.6' fill='url(#br)'/>`;
  b += `<path d='M14 54Q14 40 18 30Q20 18 26 14Q32 18 34 30Q38 40 38 54Z' fill='url(#bz)'/><path d='M10 54H42Q42 58 40 58H12Q10 58 10 54Z' fill='url(#bz)'/>`;
  b += `<path d='M18 32Q22 22 26 18' stroke='#fff0c0' stroke-width='1.2' fill='none' opacity='.8' stroke-linecap='round'/><path d='M14 44H38M13 50H39' stroke='#4a2a0c' stroke-width='.8' opacity='.6'/><path d='M14 45H38' stroke='#ffe0a0' stroke-width='.4' opacity='.5'/>`;
  b += `<circle cx='26' cy='59' r='3.4' fill='url(#bz)'/>`;
  return svgc(W, H, b, defs, '');
}
function owl() {
  const W = 40, H = 24;
  return svgc(W, H, `<path d='M20 12Q12 2 2 6Q8 8 10 11Q6 14 3 20Q10 15 16 15L20 20L24 15Q30 15 37 20Q34 14 30 11Q32 8 38 6Q28 2 20 12Z' fill='#06091c'/><circle cx='17.4' cy='11' r='1.2' fill='${GOLD}'/><circle cx='22.6' cy='11' r='1.2' fill='${GOLD}'/>`, '', '');
}
/** the keystone's moon phases (new to full), engraved in the board's top margin */
function phases() {
  const W = 60, H = 8;
  const defs = `<mask id='m'><rect width='10' height='10' fill='#fff'/><circle cx='6.4' cy='5' r='4' fill='#000'/></mask>`;
  let b = '';
  [0, 1, 2, 3, 4].forEach((i) => {
    const cx = 6 + i * 12, cy = 4;
    b += `<circle cx='${cx}' cy='${cy}' r='3' fill='none' stroke='${SILVER}' stroke-width='.7' opacity='.7'/>`;
    if (i === 1) b += `<path d='M${cx - 0.2} ${cy - 3}A3 3 0 1 0 ${cx - 0.2} ${cy + 3}A2 3 0 1 1 ${cx - 0.2} ${cy - 3}Z' fill='${SILVER}' opacity='.85'/>`;
    if (i === 2) b += `<path d='M${cx} ${cy - 3}A3 3 0 0 0 ${cx} ${cy + 3}Z' fill='${SILVER}' opacity='.85'/>`;
    if (i === 3) b += `<path d='M${cx} ${cy - 3}A3 3 0 0 0 ${cx} ${cy + 3}A1.6 3 0 0 0 ${cx} ${cy - 3}Z' fill='${SILVER}' opacity='.85'/><circle cx='${cx}' cy='${cy}' r='3' fill='${SILVER}' opacity='.5'/>`;
    if (i === 4) b += `<circle cx='${cx}' cy='${cy}' r='3' fill='${SILVER}' opacity='.9'/>`;
  });
  return svgc(W, H, b, defs, '');
}
function capDraw(rw, size) {
  const R = 24, c = R + rw;
  const defs = S.lg('cg', [[0, '#5a6a9a'], [0.5, '#34426e'], [1, '#141e44']], 0, 0, 1, 1);
  let b = `<path d='M0 ${size}V${c}A${c} ${c} 0 0 1 ${c} 0H${size}V${rw}H${c}A${R} ${R} 0 0 0 ${rw} ${c}V${size}Z' fill='url(#cg)'/>`;
  b += `<path d='M0 ${size}V${c}A${c} ${c} 0 0 1 ${c} 0H${size}' fill='none' stroke='#e8f0ff' stroke-width='.8' opacity='.8'/>`;
  b += `<circle cx='${(c - R / 1.414 * 0.95).toFixed(1)}' cy='${(c - R / 1.414 * 0.95).toFixed(1)}' r='1.7' fill='#e8f0ff'/><circle cx='${(c - R / 1.414 * 0.95).toFixed(1)}' cy='${(c - R / 1.414 * 0.95).toFixed(1)}' r='.7' fill='#34426e'/>`;
  return { defs, body: b };
}

function css() {
  const th = 'var(--s4-th)', bh = 'var(--s4-bh)', K = (v, k) => `calc(${v} * ${k})`;
  const P = {
    moon: { fx: 'var(--s4-tw-mfx)', band: 'top', h: K(th, 2.1), a: 1, dy: K(th, -0.5) },
    bell: { fx: 'var(--s4-tw-bfx)', band: 'top', h: K(th, 0.62), a: 52 / 64, dy: K(th, 0.12) },
    arch: { fx: 'var(--s4-tw-bfx)', band: 'top', h: K(th, 0.82), a: 84 / 70, dy: '0px' },
  };
  const R = registry('tower');
  const svg = { moon: moon(), clouds: clouds(), stars: stars(), spireL: spire(false), spireR: spire(true), litL: lit(false), litR: lit(true), townBase: town('base'), townLit: town('lit'), arch: arch(), bell: bell(), owl: owl(), phases: phases() };
  const ref = {}; Object.keys(svg).forEach((k) => { ref[k] = R.add(k, svg[k]); });
  const caps = L.cornerCaps(R, 'tw', capDraw, RW);
  const tTown = bgTile(ref.townBase, 'bottom', bh), tStars = `${ref.stars} repeat 0 0 / 260px 400px`;
  const spL = `${ref.spireL} repeat-y calc(var(--s4-cx) - var(--s4-cw) / 2 - ${RW}px - 8px) 0 / 16px 10%`;
  const spR = `${ref.spireR} repeat-y calc(var(--s4-cx) + var(--s4-cw) / 2 + ${RW}px + 8px) 0 / 16px 10%`;
  const pMoon = bgPiece(ref.moon, P.moon), pBell = bgPiece(ref.bell, P.bell), pArch = bgPiece(ref.arch, P.arch);
  const halo = 'radial-gradient(ellipse calc(var(--s4-cw) * 0.7) calc(var(--s4-th) * 1.9) at calc(var(--s4-cx) + var(--s4-cw) * var(--s4-tw-mfx)) calc(var(--s4-th) * 0.45), rgba(170, 200, 255, 0.28), rgba(110, 150, 230, 0.1) 55%, transparent 80%)';
  const warm = 'radial-gradient(ellipse 90% 30% at 50% 100%, rgba(255, 190, 110, 0.14), transparent 75%)';
  const sky = 'linear-gradient(180deg, #0a1636 0%, #0b1a42 30%, #0a1534 62%, #08102a 84%, #070c20 100%)';
  const tClouds = `${ref.clouds} repeat-x 30% calc(var(--s4-th) * 0.1) / 520px 120px`;
  const stat = [pBell, pArch, spL, spR, tTown, tClouds, pMoon, halo, warm, tStars, sky];
  const runL = [pArch, spL, spR, tTown, halo, warm, tStars, sky];
  const litL = `${ref.litL} repeat-y calc(var(--s4-cx) - var(--s4-cw) / 2 - ${RW}px - 8px) 0 / 16px 10%`;
  const litR = `${ref.litR} repeat-y calc(var(--s4-cx) + var(--s4-cw) / 2 + ${RW}px + 8px) 0 / 16px 10%`;
  return {
    plate: [4, 8, 26, 0.7],
    vars: `
  --a-bg: ${stat.join(',\n    ')};
  --a-bg-run: ${runL.join(',\n    ')};
  --a-board: linear-gradient(180deg, #080e24, #04071a);
  --a-frame: #9fb4e0;
  --a-glow: rgba(160, 190, 255, 0.3);
  --s4-tw-mfx: -0.12; --s4-tw-bfx: 0.24;${R.decls()}`,
    media: `:is(.hero-board, .mini-board).board-tower { --s4-tw-mfx: -0.35; --s4-tw-bfx: 0.4; }\n`,
    run: `
.board-tower .run-active .bg::before { display: block; left: 0; right: 0; bottom: 0; height: var(--s4-bh); background: ${ref.townLit} repeat-x 50% 100% / auto 100%; will-change: opacity; animation: s4Flicker 4.6s ease-in-out infinite alternate; }
.board-tower .run-active .bg .scene-fx { display: block; left: 0; width: calc(100% + 520px); top: calc(var(--s4-th) * 0.1); height: 120px; background: ${ref.clouds} repeat-x 0 0 / 520px 120px; will-change: transform; animation: s4Clouds 90s linear infinite; }
.board-tower .run-active .bg .scene-fx.b { display: none; }
/* moment layers (js/s4-scenes.js): the moon and the bell are DOM twins of the static art, the windows light one row per stage */
.board-tower .bg .s4x { position: absolute; pointer-events: none; }
.board-tower .bg .s4x.moon { ${boxCSS(P.moon)} background: ${ref.moon} no-repeat center / 100% 100%; transform-origin: 50% 50%; will-change: auto; }
.board-tower .bg .s4x.bell { ${boxCSS(P.bell)} background: ${ref.bell} no-repeat center / 100% 100%; transform-origin: 50% 3%; }
.board-tower .bg .s4x.win { left: 0; right: 0; height: 10%; opacity: 0; background: ${ref.litL} no-repeat calc(var(--s4-cx) - var(--s4-cw) / 2 - ${RW}px - 8px) 0 / 16px 100%, ${ref.litR} no-repeat calc(var(--s4-cx) + var(--s4-cw) / 2 + ${RW}px + 8px) 0 / 16px 100%; }
.board-tower .bg .s4x.silver { inset: 0; opacity: 0; background: ${litL}, ${litR}, radial-gradient(ellipse calc(var(--s4-cw) * 0.8) calc(var(--s4-th) * 2) at calc(var(--s4-cx) + var(--s4-cw) * var(--s4-tw-mfx)) calc(var(--s4-th) * 0.5), rgba(232, 240, 255, 0.38), rgba(180, 205, 255, 0.12) 60%, transparent 80%); }
.board-tower .bg .s4x.owl { left: -50px; top: calc(var(--s4-th) * 0.28); width: 40px; height: 24px; background: ${ref.owl} no-repeat center / 100% 100%; opacity: 0; }
.board-tower .board-wrap .s4x.beam { position: absolute; z-index: 5; pointer-events: none; opacity: 0; transform-origin: 50% 0; background: linear-gradient(90deg, rgba(232, 240, 255, 0), rgba(232, 240, 255, 0.2) 28%, rgba(255, 255, 255, 0.95) 48.5%, rgba(255, 255, 255, 0.95) 51.5%, rgba(232, 240, 255, 0.2) 72%, rgba(232, 240, 255, 0)); }
`,
    frame: L.frameCSS('board-tower', {
      rw: RW,
      ring: [[1.2, '#0a1226'], [3, '#5a6a9a'], [4, '#e8f0ff']],
      drop: '0 0 12px rgba(160, 190, 255, 0.3), 0 8px 22px rgba(0, 0, 0, 0.55)',
      tooled: 'inset 0 0 0 1.4px rgba(200, 214, 240, 0.6), inset 0 0 0 2.6px rgba(0, 0, 0, 0.4)',
      caps: { tl: R.ref('captl'), tr: R.ref('captr'), bl: R.ref('capbl'), br: R.ref('capbr') },
      boardBg: `${ref.phases} no-repeat 50% 0.3px / 48px 6.4px`,
      glow: 'rgba(160, 190, 255, 0.3)',
    }),
  };
}
module.exports = { moon, clouds, stars, spire: () => spire(false), lit: () => lit(false), town: () => town('base'), townLit: () => town('lit'), arch, bell, owl, phases, css };
