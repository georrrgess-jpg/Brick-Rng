// Moonlit Glade (Rare): a forest clearing at night. A leafy canopy and a sliver of moon above, trunks with glowing bracket fungi down both
// sides, ferns and a fairy ring of glowing mushrooms (teal and pink) below. Fireflies drift; the mushrooms' glow breathes.
const L = require('./lib');
const { S, n, mix, lighten, darken, rngOf, svgc, glowDef, bgPiece, registry, boxCSS, bgTile, url } = L;

const TEAL = '#6bffe0', PINK = '#ff8fd0', FF = '#d9ff7a';

/** the ring of mushrooms: shared by the picture and its glow layer so the two always line up */
function ring() {
  const rnd = rngOf(61), list = [];
  // a fairy ring seen in perspective: an ellipse across the band, bigger and lower at the front, plus a few big ones at the sides
  const N = 17;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.2, front = (Math.sin(a) + 1) / 2;
    const x = 260 + Math.cos(a) * 236 * (0.9 + rnd.f() * 0.15), y = 82 + front * 28 + rnd.between(-3, 3);
    list.push({ x, y, s: 0.5 + front * 0.62 + rnd.between(0, 0.14), hue: rnd.chance(0.58) ? TEAL : PINK, tilt: rnd.between(-10, 10) });
  }
  [[28, 108, 1.5, TEAL, -8], [488, 108, 1.46, PINK, 8], [88, 112, 1.05, PINK, 6], [434, 112, 1.1, TEAL, -6]].forEach(([x, y, s, hue, tilt]) => list.push({ x, y, s, hue, tilt }));
  return list.sort((a, b) => a.y - b.y);
}

/** one mushroom at the origin (bottom of the stem), reused with <use> for every mushroom of its colour */
function mushShape(pink) {
  const id = pink ? 'pk' : 'tl';
  let b = `<ellipse cx='0' cy='1' rx='11' ry='2.4' fill='#000' opacity='.35'/>`;
  b += `<path d='M-2.4 0Q-2 -9 -1.6 -13H2Q2.4 -9 2.6 0Z' fill='url(#st${id})'/>`;
  b += `<path d='M-14 -12.4Q-13 -27 0 -27.6Q13 -27 14 -12.4Q8 -9.4 0 -9.4Q-8 -9.4 -14 -12.4Z' fill='url(#cp${id})'/>`;
  b += `<path d='M-14 -12.4Q-8 -9.4 0 -9.4Q8 -9.4 14 -12.4Q8 -11.2 0 -11.2Q-8 -11.2 -14 -12.4Z' fill='#fff' opacity='.34'/>`;
  b += `<path d='M-12 -15.6Q-9 -24 -2 -26.4' stroke='#fff' stroke-width='1.3' fill='none' opacity='.55' stroke-linecap='round'/>`;
  [[-6, -18, 1.6], [3, -22, 1.3], [8, -16.4, 1.5], [-1, -15.6, 1]].forEach(([dx, dy, r]) => { b += `<circle cx='${dx}' cy='${dy}' r='${r}' fill='#fff' opacity='.7'/>`; });
  return `<g id='${pink ? 'mp' : 'mt'}'>${b}</g>`;
}
const mush = (m) => `<use href='#${m.hue === PINK ? 'mp' : 'mt'}' transform='translate(${Math.round(m.x)} ${Math.round(m.y)}) rotate(${Math.round(m.tilt)}) scale(${n(m.s)})'/>`;
function mushDefs() {
  const d = (id, hi, mid, lo, st) => S.lg('cp' + id, [[0, hi], [0.5, mid], [1, lo]], 0, 0, 0, 1) + S.lg('st' + id, [[0, st], [1, darken(st, 0.4)]], 0, 0, 1, 0);
  return d('tl', '#c8fff2', '#35d8bc', '#0d6a60', '#d8f6ec') + d('pk', '#ffd6ee', '#f060b4', '#7a1f5a', '#fbe4f0') + mushShape(false) + mushShape(true);
}

/** the leaf shape used all over the canopy and ferns */
const LEAF = `<path id='l' d='M0 0C3 -3.4 9 -3.6 14 0C9 3.6 3 3.4 0 0Z'/>`;
const leaf = (x, y, a, s, cls) => `<use href='#l' transform='translate(${n(x)} ${n(y)}) rotate(${n(a)}) scale(${n(s)})' class='${cls}'/>`;
/** a feathery fern frond as one polygon: a curved stem with pointed leaflets that taper toward the tip */
function frond(x, y, ang, len, w, cls, bend = 0.3) {
  const A = (ang * Math.PI) / 180, dx = Math.cos(A), dy = Math.sin(A), nx = -dy, ny = dx;
  const pt = (t) => { const k = Math.sin(t * Math.PI * 0.5) * bend * len * 0.5; return [x + dx * len * t + nx * k, y + dy * len * t + ny * k]; };
  const N = 8, left = [], right = [];
  for (let i = 1; i <= N; i++) {
    const t = i / N, c = pt(t), c0 = pt(t - 0.5 / N), ww = w * (1 - t * 0.85) * (0.75 + 0.25 * Math.sin(t * 3));
    const tipL = [c[0] + nx * ww + dx * 3, c[1] + ny * ww + dy * 3], tipR = [c[0] - nx * ww + dx * 3, c[1] - ny * ww + dy * 3];
    left.push(c0.map((v, j) => v + (j ? ny : nx) * ww * 0.18), tipL); right.push(c0.map((v, j) => v - (j ? ny : nx) * ww * 0.18), tipR);
  }
  const tip = pt(1.04), s0 = pt(0);
  const P = [s0].concat(left, [tip], right.reverse());
  return `<path class='${cls}' d='M${P.map((p) => Math.round(p[0]) + ' ' + Math.round(p[1])).join('L')}Z'/>`;
}

function top() {
  const W = 520, H = 100, rnd = rngOf(11);
  const defs = LEAF + S.rg('bl', [[0, PINK, 0.95], [0.4, PINK, 0.3], [1, PINK, 0]]) + S.lg('hz', [[0, '#04120f', 0.95], [1, '#04120f', 0]]);
  const css = '.a{fill:#12504a}.b{fill:#0d3c3a}.c{fill:#08292b}.d{fill:#04191c}.e{fill:#5fe8d0;opacity:.5}.f{fill:#1f6e5c}';
  let b = '';
  // depth layers, far to near: more and smaller leaves far away, fewer and darker leaves close up
  const layer = (cnt, depth, smin, smax, classes, seed, wob) => {
    const r = rngOf(seed);
    for (let i = 0; i < cnt; i++) {
      const x = r.between(-8, W + 8), t = r.f(), y = Math.pow(t, 1.6) * (depth * (0.55 + 0.45 * Math.abs(Math.sin(x * wob))));
      const s = r.between(smin, smax) / 14, a = 90 + r.between(-70, 70);
      b += [0].concat(x < 24 ? [W] : [], x > W - 24 ? [-W] : []).map((dx) => leaf(x + dx, y, a, s, r.pick(classes))).join('');
    }
  };
  layer(64, 52, 14, 22, ['a', 'b', 'a'], 3, 0.021);
  // trailing vines with fairy-light blossoms
  [[60, 38], [176, 30], [310, 42], [412, 32], [480, 26]].forEach(([x, len]) => {
    b += `<path d='M${x} 8Q${x + 7} ${len * 0.5} ${x + 2} ${len + 8}' stroke='#0d3c3a' stroke-width='1.2' fill='none'/>`;
    for (let k = 1; k < 5; k++) b += leaf(x + 3 * Math.sin(k), 8 + (len * k) / 4.6, 80 + k * 12, 0.5, 'b');
    b += `<circle cx='${x + 2}' cy='${len + 9}' r='7' fill='url(#bl)'/><circle cx='${x + 2}' cy='${len + 9}' r='1.7' fill='#ffd0ea'/>`;
  });
  layer(52, 44, 18, 28, ['b', 'c', 'c'], 5, 0.017);
  layer(26, 30, 26, 38, ['c', 'd', 'd'], 7, 0.013);
  // a pale rim on the leaves that face the moon (the top edge of the near layer)
  for (let i = 0; i < 12; i++) { const x = rnd.between(0, W), y = rnd.between(0, 14); b += leaf(x, y - 1.2, 90 + rnd.between(-60, 60), rnd.between(22, 32) / 14, 'e'); }
  layer(16, 26, 30, 44, ['d'], 9, 0.011);
  b += `<rect width='${W}' height='10' fill='url(#hz)'/>`;
  return svgc(W, H, b, defs, css);
}

/** the moon through a gap in the leaves, and its shafts of light */
function moon() {
  const W = 110, H = 110;
  const defs = glowDef('h', '#bfe8ff', 0.6, 0.18) + S.rg('m', [[0, '#fffff4'], [0.7, '#eaf3e0'], [1, '#c6d6c8']], 0.4, 0.36, 0.7)
    + `<mask id='mk'><rect width='110' height='110' fill='#fff'/><circle cx='64' cy='42' r='19' fill='#000'/></mask>`;
  let b = `<circle cx='54' cy='50' r='54' fill='url(#h)'/>`;
  b += `<circle cx='50' cy='50' r='22' fill='url(#m)' mask='url(#mk)'/>`;
  b += `<circle cx='42' cy='56' r='2.4' fill='#9fb6a4' opacity='.5' mask='url(#mk)'/><circle cx='46' cy='44' r='1.6' fill='#9fb6a4' opacity='.45' mask='url(#mk)'/>`;
  return svgc(W, H, b, defs, '');
}
function shafts() {
  const W = 260, H = 700;
  const defs = S.lg('s', [[0, '#bfe8ff', 0.22], [0.55, '#9fe8e0', 0.08], [1, '#9fe8e0', 0]]);
  let b = '';
  [[40, 18, 120, 96], [92, 14, 190, 120], [150, 20, 250, 150]].forEach(([x, w, x2, w2]) => { b += `<path d='M${x} 0H${x + w}L${x2 + w2} ${H}H${x2}Z' fill='url(#s)'/>`; });
  return svgc(W, H, b, defs, '');
}

/** a tree trunk for the gutters: bark, moss on the lit side, glowing bracket fungi (repeats down the screen) */
function trunk(flip) {
  const W = 30, H = 260, rnd = rngOf(flip ? 23 : 21);
  const defs = S.lg('bk', [[0, '#050d0c'], [0.55, '#14231f'], [1, '#2c4a42']], 0, 0, 1, 0) + glowDef('gt', TEAL, 0.8, 0.25) + glowDef('gp', PINK, 0.8, 0.25);
  let b = `<g${flip ? ` transform='translate(${W} 0) scale(-1 1)'` : ''}>`;
  b += `<rect width='${W}' height='${H}' fill='url(#bk)'/>`;
  for (let i = 0; i < 16; i++) { const x = rnd.between(2, W - 2); let d = `M${n(x)} 0`; for (let y = 0; y < H; y += 26) d += `Q${n(x + rnd.between(-3, 3))} ${y + 13} ${n(x + rnd.between(-1.5, 1.5))} ${y + 26}`; b += `<path d='${d}' stroke='#000' stroke-width='${n(rnd.between(0.7, 1.6))}' fill='none' opacity='${n(rnd.between(0.35, 0.7))}'/>`; }
  for (let i = 0; i < 7; i++) { const x = rnd.between(W * 0.6, W - 1), y0 = rnd.between(0, H); b += `<path d='M${n(x)} ${n(y0)}q${n(rnd.between(1, 3))} 24 ${n(rnd.between(-1, 1))} ${n(rnd.between(30, 60))}' stroke='#6bffe0' stroke-width='.7' fill='none' opacity='.18'/>`; }
  [[34, 20, '#2f7a4a'], [118, 26, '#2a6e46'], [196, 22, '#2f7a4a']].forEach(([y, h, c]) => { b += `<path d='M${W} ${y}Q${W - 11} ${y + 3} ${W - 8} ${y + h / 2}Q${W - 13} ${y + h - 3} ${W} ${y + h}Z' fill='${c}' opacity='.62'/>`; });
  // glowing bracket fungi on the lit edge
  [[62, 1, TEAL, 'gt'], [150, 0.8, PINK, 'gp'], [226, 0.9, TEAL, 'gt']].forEach(([y, s, c, g]) => {
    b += `<circle cx='${W - 4}' cy='${y}' r='${n(15 * s)}' fill='url(#${g})'/><path d='M${W} ${y - 5 * s}Q${W - 9 * s} ${y - 5 * s} ${W - 9 * s} ${y}Q${W - 9 * s} ${y + 4 * s} ${W} ${y + 5 * s}Z' fill='${c}'/><path d='M${W} ${y - 5 * s}Q${W - 9 * s} ${y - 5 * s} ${W - 9 * s} ${y}' stroke='#fff' stroke-width='.8' fill='none' opacity='.7'/>`;
    b += `<path d='M${W} ${y + 5 * s + 4}Q${W - 7 * s} ${y + 5 * s + 4} ${W - 7 * s} ${y + 5 * s + 7}Q${W - 7 * s} ${y + 5 * s + 10} ${W} ${y + 5 * s + 11}Z' fill='${c}' opacity='.8'/>`;
  });
  b += `<rect x='${W - 1.2}' width='1.2' height='${H}' fill='#6bffe0' opacity='.1'/>`;
  return svgc(W, H, b + '</g>', defs, '');
}

/** the forest floor and the ring (a tile that repeats) */
function floor() {
  const W = 520, H = 120, rnd = rngOf(31);
  const defs = LEAF + mushDefs() + S.lg('gr', [[0, '#0b302c'], [1, '#03100d']]) + S.lg('hl', [[0, '#0f3d38'], [1, '#07201d']]);
  const css = '.a{fill:#0f5a46}.b{fill:#0a4235}.c{fill:#06261f}.d{fill:#030f0d}.e{fill:#3bd8b4;opacity:.3}';
  let b = '';
  const ridge = (y0, amp, fill, seed) => { const r = rngOf(seed), pts = []; for (let x = -20; x <= W + 20; x += 52) pts.push([x, y0 + (r.f() - 0.5) * amp]); return `<path d='${L.smooth(pts)}V${H}H-20Z' fill='${fill}'/>`; };
  b += ridge(66, 12, 'url(#hl)', 1) + ridge(82, 12, 'url(#gr)', 2);
  const fern = (x, y, s, cls, fronds) => {
    let f = '';
    for (let k = 0; k < fronds; k++) {
      const a = -90 + (k - (fronds - 1) / 2) * (120 / Math.max(1, fronds - 1)) + rnd.between(-5, 5);
      f += frond(x, y, a, (30 + rnd.between(-5, 9)) * s, 5.5 * s, cls, a > -90 ? 0.5 : -0.5);
    }
    return f;
  };
  [[40, 90, 1, 'b', 5], [150, 94, 1.1, 'b', 5], [262, 88, 0.9, 'b', 5], [372, 94, 1.15, 'b', 5], [488, 90, 1, 'b', 5]].forEach(([x, y, s, c, fr]) => { b += fern(x, y, s, c, fr); });
  // the ring of mushrooms, back to front
  ring().forEach((m) => { b += mush(m); });
  [[96, 104, 1.3, 'a', 5], [210, 108, 1.2, 'a', 4], [330, 106, 1.3, 'a', 5], [440, 108, 1.2, 'a', 4]].forEach(([x, y, s, c, fr]) => { b += fern(x, y, s, c, fr); });
  // grass and fern fronds in front, nearly black, with a pale rim
  b += ridge(108, 8, '#04140f', 3);
  for (let i = 0; i < 46; i++) {
    const x = rnd.between(0, W), h = rnd.between(8, 26), lean = rnd.between(-6, 6);
    b += `<path d='M${n(x)} ${H}Q${n(x + lean * 0.3)} ${n(H - h * 0.6)} ${n(x + lean)} ${n(H - h)}Q${n(x + lean * 0.6 + 1.6)} ${n(H - h * 0.5)} ${n(x + 2.2)} ${H}Z' class='d'/>`;
  }
  [[18, 114, 1.2], [112, 116, 1], [240, 116, 1.1], [352, 114, 1.2], [470, 116, 1]].forEach(([x, y, s]) => { b += fern(x, y, s, 'd', 4); });
  // tiny white flowers and fallen petals
  for (let i = 0; i < 18; i++) b += `<circle cx='${n(rnd.between(0, W))}' cy='${n(rnd.between(92, 116))}' r='${n(rnd.between(0.7, 1.4))}' fill='#e8fff8' opacity='${n(rnd.between(0.4, 0.9))}'/>`;
  return svgc(W, H, b, defs, css);
}

/** the glow under and around every mushroom (the layer whose opacity breathes) */
function glow() {
  const W = 520, H = 120;
  const defs = glowDef('t', TEAL, 0.75, 0.28) + glowDef('p', PINK, 0.75, 0.28);
  let b = '';
  ring().forEach((m) => { const r = 26 * m.s; const g = m.hue === PINK ? 'p' : 't'; b += `<circle cx='${n(m.x)}' cy='${n(m.y - 18 * m.s)}' r='${n(r * 1.5)}' fill='url(#${g})'/><ellipse cx='${n(m.x)}' cy='${n(m.y)}' rx='${n(r * 1.7)}' ry='${n(r * 0.5)}' fill='url(#${g})'/>`; });
  return svgc(W, H, b, defs, '');
}

/** fireflies (the moving layer's tile, wraps vertically) */
function fireflies() {
  const W = 260, H = 520, rnd = rngOf(17);
  const defs = glowDef('y', FF, 0.95, 0.32) + glowDef('t', TEAL, 0.9, 0.3);
  let b = '';
  for (let i = 0; i < 17; i++) {
    const x = rnd.between(8, W - 8), y = rnd.between(0, H), r = rnd.between(1.2, 2.6), g = rnd.chance(0.7) ? 'y' : 't', a = n(rnd.between(0.5, 1));
    [0, -H].concat(y < 20 ? [H] : []).forEach((dy) => { b += `<circle cx='${n(x)}' cy='${n(y + dy)}' r='${n(r * 4.2)}' fill='url(#${g})' opacity='${a}'/><circle cx='${n(x)}' cy='${n(y + dy)}' r='${n(r * 0.6)}' fill='#fffff0'/>`; });
  }
  return svgc(W, H, b, defs, '');
}

/** the mossy stone corner of the frame (top-left) with a tuft of moss and a pair of tiny glowing mushrooms */
function capDraw() {
  const defs = S.lg('cg', [[0, '#8ab8a2'], [0.4, '#4f7e6c'], [1, '#1d3a32']], 0, 0, 1, 1) + glowDef('gg', TEAL, 0.9, 0.3) + S.rg('mc', [[0, '#7fd48a'], [1, '#1f6a3a']], 0.4, 0.3, 0.8);
  let b = `<path d='M0 44V33A33 33 0 0 1 33 0H44V9H33A24 24 0 0 0 9 33V44Z' fill='url(#cg)'/>`;
  b += `<path d='M0 44V33A33 33 0 0 1 33 0H44' fill='none' stroke='#cdeee0' stroke-width='.9' opacity='.6'/><path d='M44 9H33A24 24 0 0 0 9 33V44' fill='none' stroke='#0a1d18' stroke-width='.9' opacity='.8'/>`;
  [[10, 12, 5], [16, 7, 4], [6, 20, 4.4], [24, 5, 3.4], [5, 28, 3.4], [13, 15, 3]].forEach(([x, y, r]) => { b += `<ellipse cx='${x}' cy='${y}' rx='${r}' ry='${n(r * 0.8)}' fill='url(#mc)'/>`; });
  b += `<circle cx='15' cy='11' r='7' fill='url(#gg)'/><path d='M12 13Q12 8 15 8Q18 8 18 13Z' fill='#6bffe0'/><path d='M14.6 13h.8v3h-.8z' fill='#d8f6ec'/><circle cx='15' cy='9.6' r='.6' fill='#fff'/>`;
  b += `<path d='M31 4Q31 .6 33.4 .6Q35.8 .6 35.8 4Z' fill='#ff8fd0'/><path d='M33 4h.8v2.4h-.8z' fill='#fbe4f0'/>`;
  return { defs, body: b };
}

function css() {
  const th = 'var(--s4-th)', bh = 'var(--s4-bh)', K = (v, k) => `calc(${v} * ${k})`;
  const P = {
    moon: { fx: -0.12, band: 'top', h: K(th, 0.95), a: 1, dy: K(th, -0.06) },
    shafts: { fx: -0.02, band: 'top', h: 'calc(var(--s4-free) * 0 + 70%)', a: 260 / 700, dy: '0px' },
  };
  const R = registry('glade');
  const svg = { top: top(), floor: floor(), glow: glow(), moon: moon(), shafts: shafts(), trunkL: trunk(false), trunkR: trunk(true), flies: fireflies() };
  const ref = {}; Object.keys(svg).forEach((k) => { ref[k] = R.add(k, svg[k]); });
  const caps = L.cornerCaps(R, 'gl', capDraw);
  const tTop = bgTile(ref.top, 'top', th), tFloor = bgTile(ref.floor, 'bottom', bh), tGlow = bgTile(ref.glow, 'bottom', bh);
  const trunkL = `${ref.trunkL} repeat-y calc(var(--s4-cx) - var(--s4-cw) / 2 - 15px - 6px + 6px) 0 / 30px auto`;
  const trunkR = `${ref.trunkR} repeat-y calc(var(--s4-cx) + var(--s4-cw) / 2 + 15px - 6px + 6px) 0 / 30px auto`;
  const pMoon = bgPiece(ref.moon, P.moon), pShafts = bgPiece(ref.shafts, P.shafts);
  const mist = 'linear-gradient(0deg, rgba(90, 255, 220, 0.09) 0, rgba(90, 255, 220, 0.03) 18%, transparent 36%)';
  const sky = 'radial-gradient(ellipse 70% 30% at 36% 0%, rgba(150, 220, 255, 0.2), transparent 70%), linear-gradient(180deg, #04141c 0%, #072a30 34%, #0a3a38 62%, #06241f 86%, #031410 100%)';
  return {
    plate: [2, 20, 18, 0.66],
    vars: `
  --a-bg: ${[tGlow, tFloor, trunkL, trunkR, tTop, pMoon, pShafts, mist, sky].join(',\n    ')};
  --a-bg-run: ${[tFloor, trunkL, trunkR, tTop, pMoon, pShafts, mist, sky].join(',\n    ')};
  --a-board: linear-gradient(180deg, #071713, #030b09);
  --a-frame: #7fd4b8;
  --a-glow: rgba(107, 255, 224, 0.3);${R.decls()}`,
    run: `
.board-glade .run-active .bg::before { display: block; left: 0; right: 0; bottom: 0; height: var(--s4-bh); background: ${ref.glow} repeat-x 50% 100% / auto 100%; will-change: opacity; animation: s4Glow 3.4s ease-in-out infinite alternate; }
.board-glade .run-active .bg .scene-fx { display: block; height: calc(100% + 520px); background-image: ${ref.flies}; background-size: 260px 520px; animation: s4Wander 110s linear infinite; }
.board-glade .run-active .bg .scene-fx.b { display: none; }
`,
    frame: L.frameCSS('board-glade', {
      ring: [[1.5, '#04120f'], [5, '#3a5a50'], [6, '#7fb09a'], [8, '#1d3a32'], [9, 'rgba(107, 255, 224, 0.75)']],
      drop: '0 0 14px rgba(107, 255, 224, 0.3), 0 8px 22px rgba(0, 0, 0, 0.55)',
      tooled: 'inset 0 0 0 1.4px rgba(127, 212, 184, 0.55), inset 0 0 0 3px rgba(0, 0, 0, 0.35), inset 0 0 0 4.2px rgba(107, 255, 224, 0.25)',
      caps: { tl: R.ref('captl'), tr: R.ref('captr'), bl: R.ref('capbl'), br: R.ref('capbr') },
      glow: 'rgba(107, 255, 224, 0.3)',
    }),
  };
}
module.exports = { top, moon, shafts, trunk: () => trunk(false), floor, glow, fireflies, css };
