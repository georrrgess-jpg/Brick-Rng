// Hologrid: floating hologram glyphs above (a radar, a wireframe globe, data bars, glyphs), a perspective grid floor below with a scan
// pulse that sweeps toward you. Line Blasts still scan the board (js/skins.js).
const { S, mulberry32, n, url } = require('./lib');

const C = '#5dffd9', C2 = '#a8fff0';
const glow = (d, w, o) => S.stroke(d, C, w * 3.4, Object.assign({ 'stroke-opacity': 0.12, 'stroke-linecap': 'round' }, o)) + S.stroke(d, C, w, Object.assign({ 'stroke-opacity': 0.7, 'stroke-linecap': 'round' }, o));
const circle = (cx, cy, r) => `M${n(cx - r)} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const ellp = (cx, cy, rx, ry) => `M${n(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

function top() {
  const W = 480, H = 120, rnd = mulberry32(21);
  const defs = S.lg('sw', [[0, C, 0.4], [1, C, 0]], 0, 0, 1, 0) + S.rg('hz', [[0, C, 0.22], [1, C, 0]]);
  let b = S.ell(240, 60, 240, 60, 'url(#hz)');
  // radar
  b += glow(circle(386, 46, 27), 1) + glow(circle(386, 46, 18), 0.8) + S.stroke(circle(386, 46, 30), C, 3, { 'stroke-dasharray': '1.2 4.6', 'stroke-opacity': 0.6 });
  b += S.line(356, 46, 416, 46, C, 0.7, { 'stroke-opacity': 0.5 }) + S.line(386, 16, 386, 76, C, 0.7, { 'stroke-opacity': 0.5 });
  b += S.path('M386 46L410 33A28 28 0 0 1 414 46Z', 'url(#sw)') + S.circ(398, 58, 2, C2) + S.circ(374, 38, 1.6, C2) + S.circ(404, 40, 1.4, C2);
  // wireframe globe
  b += glow(circle(100, 56, 24), 1) + glow(ellp(100, 56, 10, 24), 0.8) + glow(ellp(100, 56, 24, 8), 0.8) + glow(ellp(100, 56, 24, 15), 0.7) + glow(ellp(100, 56, 17, 24), 0.7);
  b += S.circ(100, 56, 2, C2);
  // data bars + a baseline
  let bars = ''; [10, 18, 14, 26, 20, 32, 16, 24, 12].forEach((h, i) => { bars += S.rect(210 + i * 8, 62 - h, 5, h, C, { 'fill-opacity': 0.5 }) + S.rect(210 + i * 8, 62 - h, 5, 1.4, C2); });
  b += bars + S.line(206, 64, 284, 64, C, 1, { 'stroke-opacity': 0.7 }) + S.line(206, 70, 250, 70, C, 1, { 'stroke-opacity': 0.4 });
  // glyph clusters: plus signs, chevrons, a hexagon, short lines of code-like dashes
  const plus = (x, y, r) => S.path(`M${x - r} ${y}H${x + r}M${x} ${y - r}V${y + r}`, 'none', { stroke: C2, 'stroke-width': 1, 'stroke-opacity': 0.8 });
  b += plus(30, 28, 4) + plus(160, 20, 3) + plus(320, 24, 3.4) + plus(448, 96, 4) + plus(60, 98, 3) + plus(296, 96, 3);
  b += glow(`M150 76l10 -6l10 6`, 0.9) + glow(`M150 84l10 -6l10 6`, 0.7);
  b += glow(`M${316} 50l10 -6l10 6v12l-10 6l-10 -6z`, 0.9) + S.circ(326, 56, 2.2, C2);
  for (let i = 0; i < 4; i++) b += S.rect(22, 70 + i * 6, 14 + Math.round(rnd() * 26), 2, C, { 'fill-opacity': 0.45 });
  for (let i = 0; i < 3; i++) b += S.rect(430, 20 + i * 7, 10 + Math.round(rnd() * 22), 2, C, { 'fill-opacity': 0.4 });
  b += S.stroke('M100 82V96H206M206 96H300', C, 1, { 'stroke-dasharray': '2 3', 'stroke-opacity': 0.4 });
  return S.svg(W, H, b, defs);
}

function floor() {
  const W = 400, H = 140, y0 = 24, vx = 200;
  const defs = `<linearGradient id='fl' gradientUnits='userSpaceOnUse' x1='0' y1='${y0}' x2='0' y2='${H}'><stop offset='0' stop-color='${C}' stop-opacity='0.05'/><stop offset='0.35' stop-color='${C}' stop-opacity='0.45'/><stop offset='1' stop-color='${C}' stop-opacity='0.95'/></linearGradient>`
    + S.rg('hz', [[0, '#d8fff6', 0.9], [0.3, C, 0.45], [1, C, 0]]) + S.lg('fg', [[0, '#04242c', 0], [1, '#04242c', 0.55]]);
  let b = S.rect(0, y0, W, H - y0, 'url(#fg)');
  for (let i = -14; i <= 14; i++) b += S.line(vx, y0, vx + i * 46, H, 'url(#fl)', i === 0 ? 1.6 : 1.1);
  for (let k = 1; k <= 7; k++) { const y = y0 + (H - y0) * Math.pow(k / 7, 1.9); b += S.line(0, y, W, y, 'url(#fl)', 1 + k * 0.1); }
  b += S.ell(vx, y0, 210, 12, 'url(#hz)') + S.line(0, y0, W, y0, '#d8fff6', 1.4, { 'stroke-opacity': 0.9 });
  return S.svg(W, H, b, defs);
}

module.exports = build;
module.exports.parts = { top, floor };
function build() {
  const T = url(top()), F = url(floor());
  return `/* ================================================================ Hologrid (Mythic)
   A floating hologram in a dark room: a radar, a wireframe globe, data bars and glyphs hover across the top, and below a glowing
   perspective grid runs to the horizon with a scan pulse that sweeps toward you. A faint scan texture and a rare flicker sit on the board
   itself; Line Blasts scan the grid (js/skins.js). */
.board-holo {
  --u4-th: min(112px, 15%); --u4-bh: min(116px, 15%);
  --u4-top: ${T} repeat-x 50% 0 / auto var(--u4-th);
  --u4-floor: ${F} no-repeat 50% 100% / 100% var(--u4-bh);
  --u4-sky: radial-gradient(ellipse 80% 30% at 50% 100%, rgba(40, 255, 200, 0.2), transparent 75%), radial-gradient(ellipse 90% 40% at 50% 38%, rgba(40, 255, 200, 0.12), transparent 72%), linear-gradient(180deg, #02131b 0%, #031e29 52%, #021017 100%);
  --a-bg-run: var(--u4-top), var(--u4-floor), var(--u4-sky);
  --a-bg: var(--u4-top), var(--u4-floor), var(--u4-sky);
  --a-board: linear-gradient(180deg, rgba(2, 22, 28, 0.92), rgba(2, 14, 20, 0.95));
  --a-frame: rgba(93, 255, 217, 0.85);
  --a-glow: rgba(93, 255, 217, 0.5);
}
.board-holo .run-active .bg { background: var(--a-bg-run); }
.board-holo .run-active .bg::before { display: block; left: 0; right: 0; bottom: 0; height: var(--u4-bh); background: linear-gradient(90deg, transparent, #a8fff0 30%, #d8fff6 50%, #a8fff0 70%, transparent) 0 0 / 100% 2px no-repeat; opacity: 0; will-change: transform, opacity; animation: u4Scan 5s cubic-bezier(0.45, 0, 1, 0.8) infinite; }
.board-holo .board { animation: u4Flicker 5s steps(1) infinite; }
.board-holo .board::before { content: ''; position: absolute; inset: 0; z-index: 3; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(93, 255, 217, 0.06) 0 1px, transparent 1px 3px); }
.board-holo .board::after { background: linear-gradient(#5dffd9, #5dffd9) 0 0 / 26px 3px no-repeat, linear-gradient(#5dffd9, #5dffd9) 0 0 / 3px 26px no-repeat, linear-gradient(#5dffd9, #5dffd9) 100% 0 / 26px 3px no-repeat, linear-gradient(#5dffd9, #5dffd9) 100% 0 / 3px 26px no-repeat, linear-gradient(#5dffd9, #5dffd9) 0 100% / 26px 3px no-repeat, linear-gradient(#5dffd9, #5dffd9) 0 100% / 3px 26px no-repeat, linear-gradient(#5dffd9, #5dffd9) 100% 100% / 26px 3px no-repeat, linear-gradient(#5dffd9, #5dffd9) 100% 100% / 3px 26px no-repeat; filter: drop-shadow(0 0 4px #5dffd9); }
html:is(.low-end, .reduced).board-holo .board { animation: none; }
@keyframes u4Flicker { 0%, 92%, 96%, 100% { opacity: 1; } 93% { opacity: 0.86; } 95% { opacity: 0.94; } }
@keyframes u4Scan { 0% { transform: translate3d(0, 15%, 0); opacity: 0; } 12% { opacity: 0.9; } 100% { transform: translate3d(0, 100%, 0); opacity: 0; } }

/* badges, previews and the reveal: a brighter sky and a more see-through board so the scene still reads at 56px */
:is(.bdg-scene, .hero-board, .mini-board).board-holo { --u4-sky: radial-gradient(ellipse 90% 50% at 50% 100%, rgba(70, 255, 215, 0.55), transparent 78%), linear-gradient(180deg, #04323d, #07526a); --a-board: linear-gradient(180deg, rgba(2, 22, 28, 0.74), rgba(2, 14, 20, 0.84)); }
`;
}
