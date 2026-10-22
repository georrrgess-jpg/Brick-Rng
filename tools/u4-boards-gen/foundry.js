// Foundry: iron rafters, chains and a hanging lamp above; below a furnace mouth, a crucible pouring molten metal into a mould, an anvil.
const { S, mulberry32, n, wrap, url } = require('./lib');
const XL = " xmlns:xlink='http://www.w3.org/1999/xlink'";
const svgx = (w, h, body, defs) => S.svg(w, h, body, defs).replace("xmlns='http://www.w3.org/2000/svg'", "xmlns='http://www.w3.org/2000/svg'" + XL);

function top() {
  const W = 480, H = 120, rnd = mulberry32(3);
  const defs = S.lg('hz', [[0, '#0a0504', 1], [0.55, '#140a06', 0.7], [1, '#140a06', 0]]) + S.lg('bm', [[0, '#6f5d52'], [0.18, '#3b302a'], [1, '#1b1411']])
    + S.rg('lamp', [[0, '#ffd98a', 0.95], [0.35, '#ff9a3a', 0.5], [1, '#ff6a1a', 0]]) + S.lg('cone', [[0, '#ffb060', 0.32], [1, '#ff8a30', 0]])
    + `<g id='lk'><rect x='-3' y='-5.5' width='6' height='11' rx='3' fill='none' stroke='#8c796c' stroke-width='1.8'/></g>`;
  let b = S.rect(0, 0, W, H, 'url(#hz)');
  // truss: a long beam with a zig-zag lattice under it
  let lat = ''; for (let x = -20; x < W + 40; x += 40) lat += `M${x} 16L${x + 20} 46L${x + 40} 16`;
  b += S.stroke(lat, '#0f0a08', 5);
  b += S.stroke(lat, '#4a3b33', 1.4, { transform: 'translate(-1 -1)', 'stroke-opacity': 0.8 });
  b += S.rect(0, 46, W, 5, '#1d1512') + S.rect(0, 46, W, 1.2, '#6d5a4e');
  b += S.rect(0, 0, W, 17, 'url(#bm)') + S.rect(0, 15, W, 2, '#0a0605');
  for (let x = 8; x < W; x += 16) b += S.circ(x, 8, 1.5, '#9a8678') + S.circ(x + 0.4, 8.4, 0.7, '#2a201a');
  // chain + hook, a hanging work lamp and its light
  const chain = (x, len, hook) => { let c = ''; for (let i = 0, y = 52; y < 52 + len; i++, y += 9) c += `<use xlink:href='#lk' transform='translate(${x} ${y})${i % 2 ? ' scale(.25 1)' : ''}'/>`; if (hook) { const y = 52 + len; c += S.stroke(`M${x} ${y}v6q0 11 -9 11q-8 0 -8 -8`, '#a8958a', 3.4, { 'stroke-linecap': 'round' }); } return c; };
  b += chain(92, 18, true) + chain(368, 24, false);
  b += S.poly([[226, 62], [254, 62], [330, 120], [150, 120]], 'url(#cone)');
  b += S.line(240, 51, 240, 62, '#8c796c', 1.6) + S.path('M222 70Q222 58 240 58Q258 58 258 70Z', '#3d322c') + S.rect(221, 69, 38, 3, '#6d5a4e') + S.ell(240, 73, 12, 4.5, 'url(#lamp)') + S.circ(240, 72, 3.2, '#fff2c0');
  b += S.ell(240, 76, 30, 20, 'url(#lamp)', { opacity: 0.55 });
  // heat shimmer motes
  for (let i = 0; i < 10; i++) b += S.ell(rnd() * W, 62 + rnd() * 50, 8 + rnd() * 18, 0.8, '#ffb070', { 'fill-opacity': 0.1 });
  return svgx(W, H, b, defs);
}

function floor() {
  const W = 480, H = 200, rnd = mulberry32(8);
  const defs = S.lg('fl', [[0, '#2a1a12'], [1, '#0d0705']]) + S.lg('wall', [[0, '#150d09', 0], [0.3, '#150d09', 0.9], [1, '#2c1a10']])
    + S.rg('mouth', [[0, '#fff6c8'], [0.3, '#ffc050'], [0.65, '#ff7a18'], [1, '#b83a08']], 0.5, 0.75, 0.75)
    + S.lg('cru', [[0, '#8a756a'], [0.35, '#4a3c35'], [1, '#1c1512']], 0, 0, 1, 0.2) + S.lg('stream', [[0, '#fff6c8'], [0.4, '#ffc040'], [1, '#ff7a18']])
    + S.lg('mold', [[0, '#3a2c26'], [1, '#151010']]) + S.rg('pool', [[0, '#fff2b0'], [0.5, '#ffa028'], [1, '#e05010', 0]])
    + S.lg('an', [[0, '#7f6b5f'], [0.2, '#2d2420'], [1, '#120d0b']]) + S.lg('vig', [[0, '#ff8a30', 0], [1, '#ff6a10', 0.5]]);
  let b = '';
  // back wall: brick courses with the furnace mouth in an arch
  b += S.rect(0, 70, W, 130, 'url(#wall)');
  for (let y = 98; y < 170; y += 12) b += S.line(0, y, W, y, '#0a0605', 1.2, { 'stroke-opacity': 0.6 });
  for (let r = 0; r < 6; r++) for (let x = (r % 2) * 18; x < W; x += 36) b += S.line(x, 98 + r * 12, x, 110 + r * 12, '#0a0605', 1, { 'stroke-opacity': 0.45 });
  b += `<g transform='translate(38 37) scale(.78)'>`;
  // furnace: an arched mouth full of fire
  b += S.path('M62 150V112Q62 78 118 78Q174 78 174 112V150Z', '#0d0706');
  b += S.path('M70 150V114Q70 86 118 86Q166 86 166 114V150Z', 'url(#mouth)');
  b += S.path('M62 150V112Q62 78 118 78Q174 78 174 112V150H166V114Q166 86 118 86Q70 86 70 114V150Z', '#3a281e');
  b += S.path('M86 150Q92 124 104 132Q112 100 124 126Q134 112 142 150Z', '#ffe9a0', { 'fill-opacity': 0.75 });
  for (let i = 0; i < 9; i++) b += S.rect(60 + (i * 13.6), 76 + Math.abs(i - 4) * 4.4, 7, 9, '#5a4234', { transform: `rotate(${(i - 4) * 12} ${n(63 + i * 13.6)} 100)` });
  b += S.ell(118, 160, 80, 12, 'url(#vig)');
  // crucible in its cradle, tilted, pouring into a mould
  b += S.rect(296, 118, 6, 62, '#171110') + S.rect(364, 118, 6, 62, '#171110') + S.rect(290, 176, 86, 6, '#171110');
  b += S.g(S.path('M-26 -22L26 -22L17 22Q0 28 -17 22Z', 'url(#cru)') + S.ell(0, -22, 26, 6.5, '#2a211d') + S.ell(0, -22, 22, 4.4, '#ff9a2a') + S.ell(0, -22.5, 14, 2.4, '#fff0a8') + S.line(-14, -16, -10, 14, '#b8a498', 1.6, { 'stroke-opacity': 0.5, 'stroke-linecap': 'round' }) + S.rect(-27, -4, 54, 3.6, '#2a211d', { 'fill-opacity': 0.8 }), { transform: 'translate(333 112) rotate(-34)' });
  b += S.path('M303 98Q300 116 302 156H306Q304 120 308 100Z', 'url(#stream)', { opacity: 0.95 });
  b += S.path('M299 100Q295 120 298 156H310Q307 122 311 102Z', '#ff8a20', { 'fill-opacity': 0.25 });
  b += S.path('M276 156H336L330 178H282Z', 'url(#mold)') + S.ell(306, 157, 31, 5, 'url(#pool)') + S.ell(306, 157, 18, 2.6, '#fff2b0');
  // anvil
  b += S.path('M404 150H450L458 144V156L444 160L442 172L452 180H410L418 172L416 160L402 158Z', 'url(#an)');
  b += S.line(406, 151, 452, 150, '#a89488', 1.2, { 'stroke-opacity': 0.8 });
  b += S.rect(424, 128, 5, 22, '#2d2420', { transform: 'rotate(-14 426 150)' }) + S.path('M412 124H442V134H412Z', '#3a2f29', { transform: 'rotate(-14 426 150)' });
  b += '</g>';
  // floor with a molten seam
  b += S.path('M0 178Q120 170 240 178T480 178V200H0Z', 'url(#fl)');
  b += S.stroke('M0 184Q60 181 120 186T240 184T360 186T480 184', '#ff7a18', 2.2, { 'stroke-opacity': 0.9 }) + S.stroke('M0 184Q60 181 120 186T240 184T360 186T480 184', '#ffd070', 0.8);
  b += S.stroke('M20 192Q80 189 140 194', '#ff7a18', 1.4, { 'stroke-opacity': 0.5 }) + S.stroke('M300 193Q380 189 460 193', '#ff7a18', 1.4, { 'stroke-opacity': 0.5 });
  for (let i = 0; i < 16; i++) b += S.circ(Math.round(rnd() * W), Math.round(176 + rnd() * 22), +(0.7 + rnd() * 1.1).toFixed(1), '#ffb050', { 'fill-opacity': +(0.4 + rnd() * 0.5).toFixed(2) });
  return svgx(W, H, b, defs);
}

function glow() {
  // the furnace and the pour breathe: a soft pool of light over both
  const W = 480, H = 200;
  const defs = S.rg('g1', [[0, '#ffb050', 0.8], [0.5, '#ff7a20', 0.28], [1, '#ff6a10', 0]]);
  return S.svg(W, H, S.ell(118, 120, 120, 70, 'url(#g1)') + S.ell(306, 150, 80, 50, 'url(#g1)'), defs);
}

function sparks() {
  const W = 240, H = 520, rnd = mulberry32(17);
  let b = '';
  for (let i = 0; i < 18; i++) {
    const x = Math.round(8 + rnd() * 224), y = Math.round(10 + (i / 18) * 500 + rnd() * 20), s = 0.7 + rnd() * 0.8, c = ['#ffe29a', '#ffb04a', '#ff8a2a', '#fff0c0'][i % 4];
    b += S.circ(x, y, 3.2 * s, c, { 'fill-opacity': 0.18 }) + S.circ(x, y, 1.15 * s, c) + (i % 3 === 0 ? S.line(x, y, x + 1.5, y + 7 * s, c, 0.9, { 'stroke-opacity': 0.6, 'stroke-linecap': 'round' }) : '');
  }
  return S.svg(W, H, b);
}

module.exports = build;
module.exports.parts = { top, floor, glow, sparks };
function build() {
  const T = url(top()), F = url(floor()), G = url(glow()), K = url(sparks());
  return `/* ================================================================ Foundry (Common)
   An iron works at night: riveted rafters with chains and a work lamp above, and below a furnace mouth full of fire, a crucible
   pouring white-hot metal into a mould, an anvil and a molten seam in the floor. The glow breathes and sparks rise. The board is a
   riveted iron frame. */
.board-foundry {
  --u4-th: min(112px, 15%); --u4-bh: min(184px, 24%);
  --u4-top: ${T} repeat-x 50% 0 / auto var(--u4-th);
  --u4-floor: ${F} repeat-x 50% 100% / auto var(--u4-bh);
  --u4-glow-img: ${G};
  --u4-glow: var(--u4-glow-img) repeat-x 50% 100% / auto var(--u4-bh);
  --u4-sky: radial-gradient(ellipse 100% 36% at 50% 104%, rgba(255, 130, 30, 0.7), rgba(255, 90, 20, 0.22) 55%, transparent 78%), linear-gradient(180deg, #1c0e09 0%, #130a07 45%, #1a0c06 78%, #240f06 100%);
  --a-bg-run: var(--u4-top), var(--u4-floor), var(--u4-sky);
  --a-bg: var(--u4-top), var(--u4-glow), var(--u4-floor), var(--u4-sky);
  --a-board: linear-gradient(180deg, rgba(36, 20, 13, 0.96), rgba(15, 7, 4, 0.98));
  --a-frame: #9a7a64;
  --a-glow: rgba(255, 120, 30, 0.42);
}
.board-foundry .run-active .bg { background: var(--a-bg-run); }
.board-foundry .run-active .bg::before { display: block; left: 0; right: 0; bottom: 0; height: var(--u4-bh); background: var(--u4-glow-img) repeat-x 50% 100% / auto 100%; animation: u4Pulse 3.6s ease-in-out infinite alternate; }
.board-foundry .run-active .bg .scene-fx { display: block; height: calc(100% + 520px); background-image: ${K}; background-size: 240px 520px; animation: u4Rise 12s linear infinite; }
.board-foundry .run-active .bg .scene-fx.b { display: none; }
/* a riveted iron frame */
.board-foundry .board::after { background:
    radial-gradient(circle at 50% 50%, #ecd6c2 0 1px, #7a5a46 1.7px, #2a1810 2.5px, transparent 3.1px) 0 3px / 24px 8px repeat-x,
    radial-gradient(circle at 50% 50%, #ecd6c2 0 1px, #7a5a46 1.7px, #2a1810 2.5px, transparent 3.1px) 12px calc(100% - 3px) / 24px 8px repeat-x,
    radial-gradient(circle at 50% 50%, #ecd6c2 0 1px, #7a5a46 1.7px, #2a1810 2.5px, transparent 3.1px) 3px 12px / 8px 24px repeat-y,
    radial-gradient(circle at 50% 50%, #ecd6c2 0 1px, #7a5a46 1.7px, #2a1810 2.5px, transparent 3.1px) calc(100% - 3px) 0 / 8px 24px repeat-y;
  box-shadow: inset 0 0 0 3px rgba(34, 20, 13, 0.9), inset 0 0 0 4.5px rgba(255, 150, 70, 0.36); }

/* badges, previews and the reveal: a brighter sky and a more see-through board so the scene still reads at 56px */
:is(.bdg-scene, .hero-board, .mini-board).board-foundry { --u4-sky: radial-gradient(ellipse 100% 80% at 50% 100%, #ffb24a, rgba(255, 120, 24, 0.75) 48%, transparent 85%), linear-gradient(180deg, #5a2610, #9a4216); --a-board: linear-gradient(180deg, rgba(34, 18, 11, 0.78), rgba(16, 8, 4, 0.86)); }
`;
}
