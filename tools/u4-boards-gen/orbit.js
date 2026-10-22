// Orbit: a starfield with a little orange moon and a satellite that drifts past, and a big ringed planet rising at the bottom.
const { S, mulberry32, n, url } = require('./lib');

function top() {
  const W = 480, H = 120, rnd = mulberry32(77);
  const defs = S.rg('nb1', [[0, '#8a5cff', 0.3], [1, '#8a5cff', 0]]) + S.rg('nb2', [[0, '#4a8cff', 0.24], [1, '#4a8cff', 0]]) + S.rg('mn', [[0, '#ffe0b0'], [0.55, '#e8964a'], [1, '#8a4a2a']], 0.34, 0.3, 0.8);
  let b = S.ell(120, 40, 120, 40, 'url(#nb1)') + S.ell(390, 70, 110, 34, 'url(#nb2)');
  const cols = ['#ffffff', '#cfe0ff', '#fff0cc', '#b8c8ff'];
  for (let i = 0; i < 40; i++) b += S.circ(Math.round(rnd() * 480), Math.round(rnd() * 104), +(0.5 + rnd() * rnd() * 1.4).toFixed(1), cols[i % 4], { 'fill-opacity': +(0.45 + rnd() * 0.55).toFixed(2) });
  [[48, 20, 4.4], [212, 14, 3.4], [330, 36, 5], [440, 16, 3.6], [150, 46, 3.2]].forEach(([x, y, r]) => { b += S.star4(x, y, r, '#fff', { 'fill-opacity': 0.9 }); });
  b += S.circ(72, 62, 10, 'url(#mn)') + S.circ(72, 62, 14, '#ff9a4a', { 'fill-opacity': 0.12 });
  b += S.path('M64 58a10 10 0 0 1 8-6', 'none', { stroke: '#fff3d8', 'stroke-opacity': 0.6, 'stroke-width': 1.2, 'stroke-linecap': 'round' });
  return S.svg(W, H, b, defs);
}

function planet() {
  const W = 560, H = 250;
  const cx = 380, cy = 236, r = 118;
  const defs = S.rg('bd', [[0, '#a8bcff'], [0.35, '#5a72e0'], [0.75, '#232d8a'], [1, '#0b1048']], 0.32, 0.28, 0.86)
    + S.rg('atm', [[0.72, '#7a9aff', 0.4], [1, '#7a9aff', 0]], 0.5, 0.5, 0.5) + S.lg('rg', [[0, '#c9b8ff'], [0.5, '#f4ecff'], [1, '#a890f0']], 0, 0, 1, 0)
    + S.rg('sh', [[0.5, '#02030c', 0], [1, '#02030c', 0.7]], 0.3, 0.26, 0.9) + `<clipPath id='pc'><circle cx='${cx}' cy='${cy}' r='${r}'/></clipPath>`
    + S.rg('mn2', [[0, '#e8ecff'], [0.6, '#8a98c8'], [1, '#3c4678']], 0.34, 0.3, 0.8);
  const ring = (rx, ry, w, col, op) => (d) => S.stroke(`M${n(cx - rx)} ${cy}A${rx} ${ry} 0 0 ${d} ${n(cx + rx)} ${cy}`, col, w, { 'stroke-opacity': op });
  const rings = [[214, 38, 11, 'url(#rg)', 0.85], [186, 33, 6, '#e6dcff', 0.7], [162, 28, 7, '#b4a0ff', 0.6]];
  let b = S.circ(cx, cy, r * 1.5, 'url(#atm)');
  const rot = `rotate(-16 ${cx} ${cy})`;
  b += S.g(rings.map((q) => ring(...q)(1)).join(''), { transform: rot });           // back half (above the centre line)
  b += S.circ(cx, cy, r, 'url(#bd)');
  b += S.g([[-80, 16, 0.2], [-44, 14, 0.16], [-10, 16, 0.22], [28, 14, 0.18], [66, 16, 0.2]].map(([dy, h, a], i) => S.path(`M${cx - r} ${cy + dy}Q${cx} ${cy + dy + (i % 2 ? 8 : -8)} ${cx + r} ${cy + dy}V${cy + dy + h}Q${cx} ${cy + dy + h + (i % 2 ? 8 : -8)} ${cx - r} ${cy + dy + h}Z`, i % 2 ? '#9a7aff' : '#4ad0e8', { 'fill-opacity': a })).join(''), { 'clip-path': 'url(#pc)' });
  b += S.circ(cx, cy, r, 'url(#sh)');
  b += S.g(rings.map((q) => ring(...q)(0)).join(''), { transform: rot });           // front half
  b += S.circ(cx - 48, cy - 54, 28, '#fff', { 'fill-opacity': 0.08 });
  b += S.circ(236, 118, 11, 'url(#mn2)') + S.circ(236, 118, 11, 'url(#sh)', { 'fill-opacity': 0.7 });
  return S.svg(W, H, b, defs);
}

function satellite() {
  const W = 84, H = 40;
  const defs = S.lg('pn', [[0, '#5aa0ff'], [1, '#1f3c9a']], 0, 0, 1, 1) + S.lg('fo', [[0, '#ffe28a'], [0.5, '#e0a22e'], [1, '#8a5a12']], 0, 0, 1, 1);
  let b = S.line(42, 20, 26, 20, '#9aa6c8', 1.6) + S.line(42, 20, 58, 20, '#9aa6c8', 1.6);
  const panel = (x) => S.rect(x, 12, 24, 16, 'url(#pn)') + S.path(`M${x + 8} 12V28M${x + 16} 12V28M${x} 20H${x + 24}`, 'none', { stroke: '#cfe0ff', 'stroke-width': 0.8, 'stroke-opacity': 0.7 }) + S.rect(x, 12, 24, 16, 'none', { stroke: '#cfe0ff', 'stroke-opacity': 0.6, 'stroke-width': 0.8 });
  b += panel(2) + panel(58);
  b += S.rect(33, 13, 18, 14, 'url(#fo)') + S.rect(33, 13, 18, 3, '#fff3c0', { 'fill-opacity': 0.5 }) + S.line(33, 20, 51, 20, '#5a3a0a', 0.8, { 'stroke-opacity': 0.6 });
  b += S.line(42, 13, 42, 6, '#cfd6ee', 1) + S.path('M35 6Q42 1 49 6Q42 9 35 6Z', '#e8eeff') + S.circ(42, 6.4, 1, '#ff4a3a') + S.circ(42, 34, 1.4, '#7affc9');
  return S.svg(W, H, b, defs);
}

function stars() {
  const W = 240, H = 112, rnd = mulberry32(9);
  let b = '';
  [[22, 30], [74, 70], [118, 22], [160, 84], [200, 44], [232, 96]].forEach(([x, y], i) => {
    const r = 1.2 + rnd() * 1.2;
    b += S.circ(x, y, r * 2.6, '#cfe0ff', { 'fill-opacity': 0.14 }) + S.circ(x, y, r, '#fff') + (i % 2 === 0 ? S.star4(x, y, r * 3.4, '#fff', { 'fill-opacity': 0.85 }) : '');
  });
  return S.svg(W, H, b);
}

module.exports = build;
module.exports.parts = { top, planet, satellite, stars };
function build() {
  const T = url(top()), P = url(planet()), Sat = url(satellite()), St = url(stars());
  return `/* ================================================================ Orbit (Epic)
   A deep-blue starfield with a little orange moon, and a big ringed planet coming up over the bottom edge. A satellite crosses the top
   every so often and the brighter stars twinkle. */
.board-orbit {
  --u4-th: min(112px, 15%); --u4-bh: min(176px, 23%);
  --u4-top: ${T} repeat-x 50% 0 / auto var(--u4-th);
  --u4-planet: ${P} no-repeat 100% 100% / auto var(--u4-bh);
  --u4-sat-img: ${Sat};
  --u4-sat: var(--u4-sat-img) no-repeat 66% 30% / auto min(30px, 4%);
  --u4-stars-img: ${St};
  --u4-sky: radial-gradient(ellipse 70% 24% at 12% 22%, rgba(120, 70, 230, 0.26), transparent 70%), radial-gradient(ellipse 60% 26% at 92% 86%, rgba(70, 120, 255, 0.3), transparent 70%), linear-gradient(180deg, #02030b 0%, #060a1c 30%, #0b1135 62%, #131a52 88%, #1b2266 100%);
  --a-bg-run: var(--u4-top), var(--u4-planet), var(--u4-sky);
  --a-bg: var(--u4-sat), var(--u4-top), var(--u4-planet), var(--u4-sky);
  --a-board: linear-gradient(180deg, rgba(12, 18, 56, 0.9), rgba(5, 8, 30, 0.95));
  --a-frame: #a9bcff;
  --a-glow: rgba(120, 160, 255, 0.4);
}
.board-orbit .run-active .bg { background: var(--a-bg-run); }
.board-orbit .run-active .bg::before { display: block; left: 0; top: 28px; width: 64px; height: 30px; background: var(--u4-sat-img) no-repeat 0 0 / 100% 100%; will-change: transform; animation: u4Orbit 75s linear infinite; }
.board-orbit .run-active .bg .scene-fx { display: block; height: var(--u4-th); background-image: var(--u4-stars-img); background-size: auto 100%; background-position: 50% 0; animation: u4Twinkle 3.6s ease-in-out infinite; }
.board-orbit .run-active .bg .scene-fx.b { display: none; }
.board-orbit .board::after { inset: -30% -18%; border: 1px solid rgba(180, 205, 255, 0.35); border-radius: 50%; transform: rotate(-16deg); box-shadow: 0 0 14px rgba(150, 180, 255, 0.25); }

/* badges, previews and the reveal: a brighter sky and a more see-through board so the scene still reads at 56px */
:is(.bdg-scene, .hero-board, .mini-board).board-orbit { --u4-sky: radial-gradient(ellipse 70% 40% at 20% 20%, rgba(140, 90, 255, 0.4), transparent 70%), linear-gradient(180deg, #0b1038 0%, #1c2680 58%, #3c52cc 100%); --a-board: linear-gradient(180deg, rgba(12, 18, 52, 0.78), rgba(5, 8, 30, 0.86)); }
`;
}
