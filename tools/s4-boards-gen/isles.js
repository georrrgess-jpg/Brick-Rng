// Floating Isles (Legendary): the first light scene. A dawn sky in rose, peach and lavender, far islands with the Moonwick tower, birds;
// below, islands with waterfalls pouring into a sunlit sea of clouds. A dark slate-blue scrim sits behind the HUD so the stage text, score
// and goal stay legible; the dawn shows at the top and bottom of the screen and in the gaps. The islands bob (a DOM layer) and the cloud
// sea drifts (.scene-fx).
const L = require('./lib');
const { S, n, mix, lighten, darken, rngOf, svgc, glowDef, bgPiece, registry, boxCSS, bgTile, url } = L;

const CREAM = '#fff4e6', PEACH = '#ffd0b0', ROSE = '#f4a0b8', LAV = '#b898d8', SKYB = '#8fc8f0';

/** one island: a dome of grass, a rock underside that tapers to a point, trees, and optionally a waterfall off one edge */
function island(cx, top, w, depth, seed, o = {}) {
  const r = rngOf(seed), hw = w / 2;
  let b = '';
  // the rock: a polygon with a ragged taper, lit from below by the dawn
  const pts = [[cx - hw, top], [cx - hw * 0.78, top + depth * 0.36], [cx - hw * 0.5, top + depth * 0.62], [cx - hw * 0.24, top + depth * 0.82], [cx + r.between(-4, 4), top + depth], [cx + hw * 0.22, top + depth * 0.78], [cx + hw * 0.52, top + depth * 0.56], [cx + hw * 0.8, top + depth * 0.32], [cx + hw, top]];
  const rp = L.rough(pts, r, 3);
  b += `<path d='${L.smooth(rp, 0.55)}Z' fill='url(#rk)'/>`;
  b += `<path d='${L.smooth(rp.slice(2, 8), 0.55)}' fill='none' stroke='#ffd0a8' stroke-width='1.1' opacity='.55'/>`;
  for (let i = 0; i < 5; i++) { const x = cx + r.between(-hw * 0.5, hw * 0.5), y = top + r.between(depth * 0.18, depth * 0.55); b += `<path d='M${n(x)} ${n(y)}l${n(r.between(-5, 5))} ${n(r.between(5, 12))}' stroke='#2a1a30' stroke-width='.8' opacity='.5'/>`; }
  // the grass cap
  b += `<path d='M${n(cx - hw)} ${n(top)}Q${n(cx - hw * 0.6)} ${n(top - depth * 0.2)} ${n(cx)} ${n(top - depth * 0.18)}Q${n(cx + hw * 0.6)} ${n(top - depth * 0.2)} ${n(cx + hw)} ${n(top)}Q${n(cx)} ${n(top + depth * 0.16)} ${n(cx - hw)} ${n(top)}Z' fill='url(#gr)'/>`;
  b += `<path d='M${n(cx - hw * 0.9)} ${n(top - 1)}Q${n(cx - hw * 0.5)} ${n(top - depth * 0.2)} ${n(cx)} ${n(top - depth * 0.19)}' stroke='#d8ffc0' stroke-width='.9' fill='none' opacity='.6'/>`;
  // trees and bushes
  const trees = o.trees == null ? Math.max(2, Math.round(w / 22)) : o.trees;
  for (let i = 0; i < trees; i++) {
    const x = cx + r.between(-hw * 0.7, hw * 0.7), th = r.between(7, 14), y = top - depth * 0.1 - r.between(0, 3);
    if (r.chance(0.55)) b += `<path d='M${n(x)} ${n(y)}l${n(-th * 0.32)} ${n(th * 0.9)}h${n(th * 0.64)}z' fill='${r.pick(['#2a8a62', '#1f7a5a', '#3a9a6a'])}'/><rect x='${n(x - 0.5)}' y='${n(y + th * 0.9)}' width='1' height='2' fill='#4a2a2a'/>`;
    else b += `<circle cx='${n(x)}' cy='${n(y + 2)}' r='${n(th * 0.34)}' fill='${r.pick(['#3a9a6a', '#58b878', '#2a8a62'])}'/>`;
  }
  // a waterfall pouring over the left or right rim and falling straight down
  if (o.fall) {
    const side = o.fall, x = cx + side * hw * 0.93, y0 = top - depth * 0.04, len = o.len || 36, dr = side * 1.2;
    b += `<path d='M${n(x - 2.4)} ${n(y0)}Q${n(x - 2.6 + dr)} ${n(y0 + len * 0.5)} ${n(x - 3.4 + dr * 1.6)} ${n(y0 + len)}L${n(x + 3.8 + dr * 1.6)} ${n(y0 + len)}Q${n(x + 2.8 + dr)} ${n(y0 + len * 0.5)} ${n(x + 2.4)} ${n(y0)}Z' fill='url(#fl)'/>`;
    b += `<path d='M${n(x - 0.8)} ${n(y0)}Q${n(x - 0.6 + dr)} ${n(y0 + len * 0.5)} ${n(x + dr * 1.6)} ${n(y0 + len)}' stroke='#fff' stroke-width='1' fill='none' opacity='.9'/><path d='M${n(x + 1)} ${n(y0 + 2)}Q${n(x + 1.2 + dr)} ${n(y0 + len * 0.5)} ${n(x + 1.6 + dr * 1.6)} ${n(y0 + len - 2)}' stroke='#fff' stroke-width='.5' fill='none' opacity='.6'/>`;
    b += `<ellipse cx='${n(x + 0.2 + dr * 1.6)}' cy='${n(y0 + len)}' rx='9' ry='3.2' fill='#fff' opacity='.6'/>`;
  }
  return b;
}
const IDEFS = S.lg('rk', [[0, '#6a4a5e'], [0.55, '#3a2a40'], [1, '#26182c']]) + S.lg('gr', [[0, '#7fe0a0'], [0.6, '#3a9a6a'], [1, '#1f6a50']]) + S.lg('fl', [[0, '#fff', 0.95], [1, '#cfeaff', 0.55]], 0, 0, 0, 1);

/** the sky's cloud puffs: a row of soft overlapping ellipses with a lit top and a shaded belly */
function cloud(x, y, w, h, c1, c2) {
  let b = '';
  const k = Math.max(3, Math.round(w / 14));
  for (let i = 0; i < k; i++) { const t = i / (k - 1), cx = x - w / 2 + t * w, rr = h * (0.55 + 0.45 * Math.sin(t * Math.PI)); b += `<ellipse cx='${n(cx)}' cy='${n(y - rr * 0.25)}' rx='${n(rr * 1.05)}' ry='${n(rr * 0.8)}' fill='${c1}'/>`; }
  b += `<ellipse cx='${n(x)}' cy='${n(y + h * 0.2)}' rx='${n(w * 0.5)}' ry='${n(h * 0.42)}' fill='${c2}'/>`;
  return b;
}

/** the top band: dawn haze, far islands (one carries the Moonwick tower), a fading crescent, birds. Static. */
function far() {
  const W = 520, H = 100, rnd = rngOf(12);
  const defs = IDEFS + S.lg('hz', [[0, '#fff0e0', 0], [1, '#ffd8c0', 0.5]]) + glowDef('mn', '#fff7e0', 0.6, 0.2) + S.lg('fr', [[0, '#8a78b8'], [1, '#5a4a88']]);
  let b = '';
  // faint stars still showing high up
  for (let i = 0; i < 20; i++) b += `<circle cx='${n(rnd.between(0, W))}' cy='${n(rnd.between(2, 40))}' r='${n(rnd.between(0.4, 1))}' fill='#fff' opacity='${n(rnd.between(0.3, 0.8))}'/>`;
  // a pale crescent
  b += `<circle cx='430' cy='30' r='34' fill='url(#mn)'/><circle cx='430' cy='30' r='9' fill='#fffbe8'/><circle cx='92' cy='26' r='10' fill='url(#mn)'/><path d='M92 18A8 8 0 1 0 92 34A6 6 0 1 1 92 18Z' fill='#fff7e6' opacity='.85'/>`;
  // soft clouds
  [[70, 70, 90, 12], [190, 56, 70, 9], [330, 76, 110, 13], [440, 50, 80, 10]].forEach(([x, y, w, h]) => { [-W, 0, W].filter((dx) => x + dx + w / 2 > 0 && x + dx - w / 2 < W).forEach((dx) => { b += `<g opacity='.8'>${cloud(x + dx, y, w, h, '#ffe2d0', '#e8b0c8')}</g>`; }); });
  // far islands in haze: the same islands, small, washed toward the sky; the farthest carries the Moonwick tower
  const haze = (x, top, w, d, seed, op, o) => `<g opacity='${op}'>${island(x, top, w, d, seed, o)}</g>`;
  b += haze(150, 70, 40, 12, 41, 0.42, { trees: 2 }) + haze(250, 84, 56, 16, 42, 0.36, { trees: 3, fall: 1, len: 14 });
  b += haze(380, 68, 66, 19, 43, 0.5, { trees: 2 }) + haze(480, 80, 36, 11, 44, 0.4, { trees: 1 });
  // the tower stands on the 380 island
  b += `<g opacity='.8'><path d='M377 56V38H383V56Z' fill='#4a3a78'/><path d='M375 38L380 28L385 38Z' fill='#3a2a68'/><rect x='379.2' y='43' width='1.6' height='3.2' fill='#ffd88a'/><circle cx='380' cy='27' r='.9' fill='#ffe9a8'/><path d='M375 38H385' stroke='#8a78b8' stroke-width='.8'/></g>`;
  // birds
  [[300, 30, 1], [314, 36, 0.8], [292, 40, 0.7], [210, 22, 0.8]].forEach(([x, y, s]) => { b += `<path d='M${x} ${y}q${3 * s} ${-3 * s} ${6 * s} 0q${3 * s} ${-3 * s} ${6 * s} 0' stroke='#6a5a98' stroke-width='${n(1.1 * s)}' fill='none' stroke-linecap='round'/>`; });
  return svgc(W, H, b, defs, '');
}

/** the bobbing layer: islands with waterfalls above the cloud sea (a piece the width of a tile, placed once) */
function isles(surge) {
  const W = 520, H = 120;
  const defs = IDEFS;
  let b = '';
  if (!surge) {
    b += island(90, 62, 84, 30, 21, { fall: 1, len: 40 });
    b += island(270, 70, 62, 24, 22, { fall: -1, len: 32, trees: 3 });
    b += island(430, 60, 96, 34, 23, { fall: -1, len: 44 });
    b += island(528, 74, 44, 16, 24, { trees: 1 });
  }
  return svgc(W, H, b, defs, '');
}
/** the surge: bright water along the falls, a layer that slides down in the Line Blast (sits on the bobbing layer) */
function falls() {
  const W = 520, H = 120;
  const defs = S.lg('wl', [[0, '#fff', 0], [0.5, '#fff', 0.95], [1, '#fff', 0]], 0, 0, 0, 1);
  let b = '';
  // the same three falls as in isles(): x = cx + side * hw * 0.84 (+ the stream's drift)
  [[90, 1, 84, 62, 30, 40], [270, -1, 62, 70, 24, 32], [430, -1, 96, 60, 34, 44]].forEach(([cx, side, w, top, depth, len]) => {
    const x = cx + side * (w / 2) * 0.93, y0 = top - depth * 0.04, dr = side * 1.2;
    b += `<path d='M${n(x - 3.4)} ${n(y0)}Q${n(x - 3.6 + dr)} ${n(y0 + len * 0.5)} ${n(x - 4.4 + dr * 1.6)} ${n(y0 + len + 6)}L${n(x + 4.8 + dr * 1.6)} ${n(y0 + len + 6)}Q${n(x + 3.8 + dr)} ${n(y0 + len * 0.5)} ${n(x + 3.4)} ${n(y0)}Z' fill='url(#wl)'/>`;
  });
  return svgc(W, H, b, defs, '');
}

/** the cloud sea: three banks of clouds, deep rose at the back to sunlit cream in front (the tile of the drifting layer) */
function sea(layerFront) {
  const W = 520, H = 60, rnd = rngOf(layerFront ? 5 : 6);
  const defs = S.lg('bk', [[0, '#e8a0b8'], [1, '#c07898']]);
  let b = '';
  const bank = (y, h, c1, c2, count, seed, op) => { const r = rngOf(seed); for (let i = 0; i < count; i++) { const x = (i + r.f() * 0.6) * (W / count), w = r.between(70, 130), hh = h * r.between(0.7, 1.15); [-W, 0].filter((dx) => x + dx + w * 0.6 > 0 && x + dx - w * 0.6 < W).forEach((dx) => { b += `<g opacity='${op}'>${cloud(x + dx, y + r.between(-3, 3), w, hh, c1, c2)}</g>`; }); } };
  if (!layerFront) { bank(20, 22, '#f0b0c0', '#c07898', 7, 31, 1); bank(34, 24, '#ffd0b0', '#e098b0', 7, 32, 1); }
  else { bank(44, 26, '#fff0e0', '#f0b8c0', 7, 33, 1); bank(56, 22, '#fffaf0', '#ffd8c8', 7, 34, 1); }
  return svgc(W, H, b, defs, '');
}

/** the base of the cloud sea (static, under the islands): a warm glow and a bank of rose cloud tops */
function seaBase() {
  const W = 520, H = 120;
  const defs = S.lg('g', [[0, '#ffb48a', 0], [0.5, '#ffb48a', 0.5], [1, '#ffe8c0', 0.95]]) + glowDef('s', '#ffe2a8', 0.9, 0.4);
  let b = `<rect y='40' width='${W}' height='80' fill='url(#g)'/><ellipse cx='260' cy='120' rx='260' ry='44' fill='url(#s)'/>`;
  return svgc(W, H, b, defs, '');
}
function rainbow() {
  const W = 400, H = 220;
  const cols = ['#ff7a8a', '#ffb070', '#ffe27a', '#8affa0', '#7ad8ff', '#9a8aff'];
  let b = '';
  cols.forEach((c, i) => { const r = 196 - i * 6; b += `<path d='M${200 - r} 220A${r} ${r} 0 0 1 ${200 + r} 220' fill='none' stroke='${c}' stroke-width='6.4' opacity='.7'/>`; });
  return svgc(W, H, b, '', '');
}
function birds() {
  const W = 120, H = 44, rnd = rngOf(3);
  let b = '';
  [[10, 24, 1.1], [34, 12, 0.9], [52, 30, 1], [78, 16, 0.8], [96, 28, 1], [110, 8, 0.7]].forEach(([x, y, s]) => { b += `<path d='M${x} ${y}q${4 * s} ${-5 * s} ${8 * s} 0q${4 * s} ${-5 * s} ${8 * s} 0' stroke='#fff7e8' stroke-width='${n(1.5 * s)}' fill='none' stroke-linecap='round'/><path d='M${x} ${y}q${4 * s} ${-5 * s} ${8 * s} 0q${4 * s} ${-5 * s} ${8 * s} 0' stroke='#7a6aa8' stroke-width='${n(0.7 * s)}' fill='none' stroke-linecap='round' opacity='.7'/>`; });
  return svgc(W, H, b, '', '');
}

/** a corner of the frame: pale stone with a trailing vine and tiny rose blossoms */
function capDraw() {
  const defs = S.lg('cg', [[0, '#fbf8ff'], [0.4, '#d8d4e6'], [1, '#8a88a8']], 0, 0, 1, 1) + S.rg('lf', [[0, '#a8f0b0'], [1, '#2a8a5a']], 0.4, 0.3, 0.8);
  let b = `<path d='M0 44V33A33 33 0 0 1 33 0H44V9H33A24 24 0 0 0 9 33V44Z' fill='url(#cg)'/>`;
  b += `<path d='M0 44V33A33 33 0 0 1 33 0H44' fill='none' stroke='#fff' stroke-width='.9' opacity='.9'/><path d='M44 9H33A24 24 0 0 0 9 33V44' fill='none' stroke='#4a4868' stroke-width='.9' opacity='.8'/>`;
  b += `<path d='M6 40Q6 18 20 8Q30 3 40 5' stroke='#2a7a52' stroke-width='1.6' fill='none' stroke-linecap='round'/>`;
  [[8, 34, 20], [8, 26, -30], [12, 18, 10], [18, 12, -40], [26, 7, 20], [33, 5, -30], [7, 30, 60], [14, 15, 70]].forEach(([x, y, a]) => { b += `<ellipse cx='${x}' cy='${y}' rx='3.6' ry='1.8' transform='rotate(${a} ${x} ${y})' fill='url(#lf)'/>`; });
  [[11, 22], [23, 9], [6, 36]].forEach(([x, y]) => { b += `<circle cx='${x}' cy='${y}' r='2.3' fill='#ffb8d0'/><circle cx='${x}' cy='${y}' r='.9' fill='#fff0a0'/>`; });
  return { defs, body: b };
}

function css() {
  const th = 'var(--s4-th)', bh = 'var(--s4-bh)', K = (v, k) => `calc(${v} * ${k})`;
  const R = registry('isles');
  const svg = { far: far(), isles: isles(false), falls: falls(), sea: sea(true), seaBack: sea(false), seaBase: seaBase(), rainbow: rainbow(), birds: birds() };
  const ref = {}; Object.keys(svg).forEach((k) => { ref[k] = R.add(k, svg[k]); });
  const caps = L.cornerCaps(R, 'is', capDraw);
  const tFar = bgTile(ref.far, 'top', th);
  const pIsl = bgPiece(ref.isles, { fx: 0, band: 'bottom', h: 'var(--s4-isl)', a: 520 / 120, dy: '0px' });
  const seaH = 'var(--s4-sea)';
  const tSea = `${ref.sea} repeat-x 50% 100% / auto ${seaH}`, tSeaBack = `${ref.seaBack} repeat-x 50% 100% / auto calc(var(--s4-sea) * 1.2)`, tSeaBase = bgTile(ref.seaBase, 'bottom', 'calc(var(--s4-free) * 2)');
  const sunglow = 'radial-gradient(ellipse calc(var(--s4-cw) * 0.8) 34% at 50% 52%, rgba(255, 190, 130, 0.5), rgba(255, 150, 150, 0.14) 55%, transparent 80%)';
  // the scrim: a dark slate-blue wash behind the HUD, from the pause row to the message band, fading out over the dawn at the top and bottom edges
  const scrim = 'linear-gradient(180deg, rgba(20, 22, 58, 0) 0, rgba(20, 22, 58, 0) calc(var(--s4-free) - 8px), rgba(20, 22, 58, 0.9) calc(var(--s4-free) + 28px), rgba(24, 26, 66, 0.88) calc(100% - var(--s4-free) - 80px), rgba(24, 26, 66, 0.9) calc(100% - var(--s4-free) - 4px), rgba(24, 26, 66, 0.35) calc(100% - var(--s4-free) + 10px), rgba(24, 26, 66, 0) calc(100% - var(--s4-free) + 24px))';
  const sky = 'linear-gradient(180deg, #9a8ad8 0%, #e8a0b8 calc(var(--s4-free) * 0.9), #f4a8a8 30%, #ffc8a0 62%, #ffd8b0 86%, #ffe8c8 100%)';
  const stat = ['var(--s4-isles-scrim)', tSea, pIsl, tSeaBack, tSeaBase, tFar, sunglow, sky];
  const runL = ['var(--s4-isles-scrim)', tSeaBack, tSeaBase, tFar, sunglow, sky];
  return {
    plate: [18, 20, 56, 0.72],
    vars: `
  --s4-isles-scrim: ${scrim};
  --s4-sea: calc(var(--s4-free) * 0.55); --s4-isl: calc(var(--s4-free) * 1.8);
  --a-bg: ${stat.join(',\n    ')};
  --a-bg-run: ${runL.join(',\n    ')};
  --a-board: linear-gradient(180deg, #0b1124, #060a18);
  --a-frame: #e8e4f4;
  --a-glow: rgba(255, 190, 140, 0.34);${R.decls()}`,
    run: `
.board-isles .run-active .bg .scene-fx { display: block; left: 0; width: calc(100% + var(--s4-sea) * 8.667); top: auto; bottom: 0; height: var(--s4-sea); background: ${ref.sea} repeat-x 0 100% / auto 100%; will-change: transform; animation: s4Sea 120s linear infinite; }
.board-isles .run-active .bg .scene-fx.b { display: none; }
/* the bobbing islands (one DOM layer made by js/s4-scenes.js, under the cloud sea) with the surge layer on top of the falls */
.board-isles .bg .s4x.isl { left: 0; right: 0; bottom: 0; height: var(--s4-isl); background: ${ref.isles} no-repeat 50% 100% / auto 100%; will-change: transform; animation: s4Bob2 7s ease-in-out infinite alternate; transition: translate 0.8s ease-in-out; }
.board-isles .bg .s4x.isl > i { position: absolute; inset: 0; background: ${ref.falls} no-repeat 50% 100% / auto 100%; opacity: 0; }
.board-isles .bg .s4x.rainbow { left: calc(var(--s4-cx) - var(--s4-cw) * 0.575); width: calc(var(--s4-cw) * 1.15); top: calc(50% - var(--s4-cw) * 0.63); height: calc(var(--s4-cw) * 0.63); background: ${ref.rainbow} no-repeat center bottom / 100% 100%; opacity: 0; }
.board-isles .bg .s4x.rays { width: calc(var(--s4-cw) * 2.4); height: calc(var(--s4-cw) * 2.4); background: repeating-conic-gradient(from 0deg, rgba(255, 240, 200, 0.6) 0 6deg, transparent 6deg 20deg), radial-gradient(circle, rgba(255, 214, 150, 0.6) 0, rgba(255, 190, 140, 0.26) 26%, transparent 52%); -webkit-mask-image: radial-gradient(circle, #000 14%, transparent 64%); mask-image: radial-gradient(circle, #000 14%, transparent 64%); opacity: 0; }
.board-isles .bg .s4x.birds { left: -130px; top: calc(var(--s4-th) * 0.12); width: 120px; height: 44px; background: ${ref.birds} no-repeat center / 100% 100%; opacity: 0; }
`,
    media: `/* on a wide screen the scrim is a soft-edged dark column behind the HUD and the dawn shows on both sides */
@media (min-width: 701px) and (min-height: 561px) {
  .board-isles { --s4-isles-scrim: linear-gradient(90deg, rgba(24, 26, 66, 0) calc(var(--s4-cx) - var(--s4-cw) / 2 - 70px), rgba(22, 24, 62, 0.86) calc(var(--s4-cx) - var(--s4-cw) / 2 - 8px), rgba(22, 24, 62, 0.86) calc(var(--s4-cx) + var(--s4-cw) / 2 + 8px), rgba(24, 26, 66, 0) calc(var(--s4-cx) + var(--s4-cw) / 2 + 70px)); }
}
`,
    frame: L.frameCSS('board-isles', {
      ring: [[1.5, '#4a4868'], [5, '#d8d4e6'], [6, '#ffffff'], [8, '#a8a4bc'], [9, '#6a6888']],
      drop: '0 0 14px rgba(255, 190, 140, 0.3), 0 8px 22px rgba(10, 8, 40, 0.55)',
      tooled: 'inset 0 0 0 1.4px rgba(220, 216, 240, 0.6), inset 0 0 0 2.6px rgba(0, 0, 0, 0.4), inset 0 0 0 3.5px rgba(255, 190, 140, 0.3)',
      caps: { tl: R.ref('captl'), tr: R.ref('captr'), bl: R.ref('capbl'), br: R.ref('capbr') },
      glow: 'rgba(255, 190, 140, 0.34)',
    }),
  };
}
module.exports = { far, isles: () => isles(false), falls, sea: () => sea(true), seaBack: () => sea(false), seaBase, rainbow, birds, css };
