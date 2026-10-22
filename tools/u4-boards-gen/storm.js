// Thunderhead: a ceiling of heavy storm cloud lit from inside, a distant city skyline below, rain, and sheet lightning in the clouds.
const { S, mulberry32, n, url } = require('./lib');

function top() {
  const W = 480, H = 120, rnd = mulberry32(5);
  const defs = S.rg('c1', [[0, '#1d2447'], [0.62, '#2b3560'], [1, '#6572ac']], 0.5, 0.5, 0.52) + S.rg('c2', [[0, '#141a38'], [0.66, '#1f284d'], [1, '#4a5690']], 0.5, 0.5, 0.52)
    + S.rg('c3', [[0, '#0f1430'], [0.7, '#182042'], [1, '#3a4680']], 0.5, 0.5, 0.52) + S.lg('top', [[0, '#0a0e24'], [1, '#141a38']]) + S.rg('fl', [[0, '#dfe8ff', 0.75], [0.5, '#8fa8ff', 0.28], [1, '#8fa8ff', 0]]);
  const puff = (x, y, r, fill) => [0, W, -W].map((dx) => ((dx === W && x < 60) || (dx === -W && x > W - 60) || dx === 0) ? S.circ(x + dx, y, r, fill) : '').join('');
  let b = S.rect(0, 0, W, 24, 'url(#top)');
  for (let i = 0; i < 12; i++) b += puff(i * 40 + rnd() * 30, 24 + rnd() * 22, 26 + rnd() * 16, 'url(#c1)');
  for (let i = 0; i < 10; i++) b += puff(i * 48 + rnd() * 30, 12 + rnd() * 26, 30 + rnd() * 18, 'url(#c2)');
  b += S.ell(60, 52, 90, 26, 'url(#fl)', { opacity: 0.55 }) + S.ell(300, 42, 100, 28, 'url(#fl)', { opacity: 0.45 });
  for (let i = 0; i < 9; i++) b += puff(i * 54 + rnd() * 30, 0 + rnd() * 16, 32 + rnd() * 18, 'url(#c3)');
  b += S.rect(0, 0, W, 10, '#0a0e24');
  return S.svg(W, H, b, defs);
}

function flash() {
  const W = 480, H = 120;
  const defs = S.rg('fl', [[0, '#f0f4ff', 0.95], [0.4, '#a8bcff', 0.4], [1, '#8fa8ff', 0]]);
  return S.svg(W, H, S.ell(80, 46, 90, 34, 'url(#fl)') + S.ell(290, 38, 110, 36, 'url(#fl)') + S.ell(450, 50, 60, 24, 'url(#fl)'), defs);
}

function skyline() {
  const W = 480, H = 200, rnd = mulberry32(19);
  const defs = S.lg('st', [[0, '#05071a', 0], [1, '#05071a', 0.95]]) + S.lg('gl', [[0, '#6c86d8', 0], [0.55, '#6c86d8', 0.2], [1, '#6c86d8', 0.28]]);
  let b = '';
  const row = (y0, hMin, hMax, col, rim, wMin, wMax, win, winCol, seed) => {
    const r2 = mulberry32(seed); let x = -6, s = '';
    while (x < W) {
      const w = Math.round(wMin + r2() * (wMax - wMin)), h = Math.round(hMin + r2() * (hMax - hMin));
      s += S.rect(x, y0 - h, w, h + 40, col) + S.rect(x, y0 - h, w, 1.4, rim, { 'fill-opacity': 0.55 });
      if (r2() < 0.28) s += S.rect(x + w / 2 - 1, y0 - h - 12, 2, 12, col) + S.circ(x + w / 2, y0 - h - 12, 1.6, '#ff4a4a');
      else if (r2() < 0.2) s += S.rect(x + 3, y0 - h - 6, w * 0.4, 6, col);
      for (let wy = y0 - h + 6; wy < y0 - 6; wy += 9) for (let wx = x + 3; wx < x + w - 4; wx += 6) if (r2() < win) s += S.rect(wx, wy, 2.6, 3.4, winCol[(r2() * winCol.length) | 0], { 'fill-opacity': 0.85 });
      x += w + Math.round(r2() * 3);
    }
    return s;
  };
  b += S.rect(0, 80, W, 120, 'url(#gl)');
  b += row(170, 34, 78, '#19234a', '#7a90d8', 14, 30, 0.14, ['#a8c0ff', '#7a90d8'], 3);
  // one tall tower with a spire
  b += S.rect(236, 92, 16, 90, '#141c3e') + S.path('M240 92L244 66L248 92Z', '#141c3e') + S.line(244, 66, 244, 52, '#141c3e', 1.4) + S.circ(244, 52, 2, '#ff4a4a');
  b += row(186, 22, 56, '#090d24', '#5a70b8', 18, 38, 0.2, ['#ffd88a', '#ffd88a', '#bcd0ff'], 8);
  b += S.rect(0, 184, W, 16, 'url(#st)') + S.line(0, 185, W, 185, '#5a70b8', 0.8, { 'stroke-opacity': 0.4 });
  // wet street reflections
  for (let i = 0; i < 22; i++) { const x = Math.round(rnd() * W); b += S.rect(x, 186, 1.6, 6 + Math.round(rnd() * 8), ['#ffd88a', '#bcd0ff'][i % 2], { 'fill-opacity': 0.28 }); }
  return S.svg(W, H, b, defs);
}

function rain() {
  const W = 160, H = 200, rnd = mulberry32(2);
  let b = '';
  for (let i = 0; i < 16; i++) {
    const x = Math.round(rnd() * W), y = Math.round(rnd() * H), L = 20 + Math.round(rnd() * 18), o = +(0.22 + rnd() * 0.28).toFixed(2);
    [-H, 0].forEach((dy) => { b += S.line(x, y + dy, x - L * 0.17, y + dy + L, '#cfdcff', 1, { 'stroke-opacity': o, 'stroke-linecap': 'round' }); });
  }
  return S.svg(W, H, b);
}

module.exports = build;
module.exports.parts = { top, flash, skyline, rain };
function build() {
  const T = url(top()), Fl = url(flash()), Sk = url(skyline()), R = url(rain());
  return `/* ================================================================ Thunderhead (Legendary)
   A storm ceiling of heavy cloud that glows from inside when sheet lightning goes off, a dark city on the horizon with red beacons and lit
   windows, and rain. Lightning moments (js/skins.js) still flash behind the board. The board frame has a pale top highlight. */
.board-storm {
  --u4-th: min(112px, 15%); --u4-bh: min(176px, 23%);
  --u4-top: ${T} repeat-x 50% 0 / auto var(--u4-th);
  --u4-flash-img: ${Fl};
  --u4-flash: var(--u4-flash-img) repeat-x 50% 0 / auto var(--u4-th);
  --u4-city: ${Sk} repeat-x 50% 100% / auto var(--u4-bh);
  --u4-sky: radial-gradient(ellipse 100% 20% at 50% 100%, rgba(110, 140, 230, 0.36), transparent 78%), linear-gradient(180deg, #1c2242 0%, #121832 46%, #0c112a 76%, #111838 100%);
  --a-bg-run: var(--u4-top), var(--u4-city), var(--u4-sky);
  --a-bg: var(--u4-top), var(--u4-flash), var(--u4-city), var(--u4-sky);
  --a-board: linear-gradient(180deg, rgba(12, 17, 38, 0.975), rgba(7, 10, 26, 0.985));
  --a-frame: #bcd0ff;
  --a-glow: rgba(150, 180, 255, 0.36);
}
.board-storm .run-active .bg { background: var(--a-bg-run); }
.board-storm .run-active .bg::before { display: block; left: 0; right: 0; top: 0; height: var(--u4-th); background: var(--u4-flash-img) repeat-x 50% 0 / auto 100%; opacity: 0; animation: u4Sheet 9s linear infinite; }
.board-storm .run-active .bg .scene-fx { display: block; top: -200px; height: calc(100% + 200px); background-image: ${R}; background-size: 160px 200px; animation: u4Rain 0.7s linear infinite; }
.board-storm .run-active .bg .scene-fx.b { display: none; }
.board-storm .board::after { background: linear-gradient(180deg, rgba(200, 220, 255, 0.2), transparent 7%); box-shadow: inset 0 0 0 2px rgba(20, 28, 60, 0.7); }

/* badges, previews and the reveal: a brighter sky and a more see-through board so the scene still reads at 56px */
:is(.bdg-scene, .hero-board, .mini-board).board-storm { --u4-sky: linear-gradient(180deg, #43518a 0%, #28336a 52%, #182046 100%); --a-board: linear-gradient(180deg, rgba(12, 17, 38, 0.8), rgba(7, 10, 26, 0.88)); }
`;
}
