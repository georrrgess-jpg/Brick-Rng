// Midnight (the default board): a violet night sky with a crescent moon and drifting wisps above, a quiet town skyline below.
const { S, mulberry32, n, url } = require('./lib');

function top() {
  const W = 480, H = 120, rnd = mulberry32(101);
  let b = '';
  const cols = ['#ffffff', '#d8e0ff', '#fff0d8', '#c8b8ff'];
  for (let i = 0; i < 34; i++) b += S.circ(Math.round(rnd() * 480), Math.round(rnd() * 108), +(0.5 + rnd() * rnd() * 1.3).toFixed(1), cols[i % 4], { 'fill-opacity': +(0.4 + rnd() * 0.6).toFixed(2) });
  [[40, 24, 4], [180, 16, 3.2], [270, 62, 3.6], [96, 74, 3]].forEach(([x, y, r]) => { b += S.star4(x, y, r, '#fff', { 'fill-opacity': 0.9 }); });
  return S.svg(W, H, b);
}

// the moon is its own picture (one moon, however wide the screen is); the sky tile repeats, the moon does not
function moon() {
  const W = 150, H = 120;
  const defs = S.rg('mh', [[0, '#d8ccff', 0.34], [0.3, '#9a86ff', 0.12], [1, '#9a86ff', 0]]) + S.rg('mc', [[0, '#fffdf0'], [0.7, '#f3e9d2'], [1, '#d9c9a8']], 0.4, 0.4, 0.7)
    + `<mask id='mm'><rect width='150' height='120' fill='#fff'/><circle cx='82' cy='37' r='17' fill='#000'/></mask>`;
  let b = S.circ(75, 44, 72, 'url(#mh)');
  b += S.circ(75, 44, 20, 'url(#mc)', { mask: 'url(#mm)' });
  b += S.circ(67, 48, 2.4, '#c8b894', { 'fill-opacity': 0.45, mask: 'url(#mm)' }) + S.circ(71, 38, 1.6, '#c8b894', { 'fill-opacity': 0.4, mask: 'url(#mm)' });
  return S.svg(W, H, b, defs);
}

function wisps() {
  const W = 480, H = 120;
  const defs = S.lg('ws', [[0, '#c9b8ff', 0], [0.5, '#c9b8ff', 0.2], [1, '#c9b8ff', 0]], 0, 0, 1, 0);
  let b = '';
  [[40, 34, 90, 5], [190, 58, 120, 6], [330, 22, 80, 4], [420, 74, 100, 5], [110, 92, 70, 4]].forEach(([x, y, rx, ry]) => { [-W, 0, W].forEach((dx) => { b += S.ell(x + dx, y, rx, ry, 'url(#ws)'); }); });
  return S.svg(W, H, b, defs);
}

function skyline() {
  const W = 480, H = 200;
  const defs = S.lg('fr', [[0, '#3a1d6c', 0], [1, '#3a1d6c', 0.5]]) + S.lg('gr', [[0, '#0b0620', 0], [1, '#0b0620', 0.95]]);
  let b = '';
  const row = (y0, hMin, hMax, col, rim, wMin, wMax, win, winCol, seed, roofs) => {
    const r2 = mulberry32(seed); let x = -4, s = '';
    while (x < W) {
      const w = Math.round(wMin + r2() * (wMax - wMin)), h = Math.round(hMin + r2() * (hMax - hMin)), kind = r2();
      s += S.rect(x, y0 - h, w, h + 30, col);
      if (roofs && kind < 0.35) s += S.poly([[x - 2, y0 - h + 1], [x + w / 2, y0 - h - 12 - r2() * 8], [x + w + 2, y0 - h + 1]], col);
      else if (kind < 0.5) s += S.rect(x + w * 0.65, y0 - h - 9, 3, 9, col);
      s += S.rect(x, y0 - h, w, 1.2, rim, { 'fill-opacity': 0.5 });
      for (let wy = y0 - h + 7; wy < y0 - 5; wy += 10) for (let wx = x + 4; wx < x + w - 5; wx += 7) if (r2() < win) s += S.rect(wx, wy, 2.8, 3.8, winCol[(r2() * winCol.length) | 0], { 'fill-opacity': 0.9 });
      x += w + Math.round(r2() * 2);
    }
    return s;
  };
  b += S.rect(0, 70, W, 130, 'url(#fr)');
  b += row(176, 28, 62, '#241150', '#8a6ad8', 16, 32, 0.1, ['#ffd88a', '#ffb0d0'], 41, true);
  // a clock tower with a lit face
  b += S.rect(60, 86, 18, 100, '#1a0d3c') + S.poly([[58, 86], [69, 62], [80, 86]], '#1a0d3c') + S.circ(69, 98, 6, '#ffe6a8') + S.circ(69, 98, 6, 'none', { stroke: '#1a0d3c', 'stroke-width': 1 }) + S.line(69, 98, 69, 94, '#1a0d3c', 1) + S.line(69, 98, 72, 99, '#1a0d3c', 1);
  b += row(190, 20, 52, '#0e0726', '#6a4ab8', 18, 36, 0.16, ['#ffd88a', '#ffd88a', '#ffb0d0'], 57, true);
  b += S.rect(0, 188, W, 12, 'url(#gr)');
  return S.svg(W, H, b, defs);
}

function stars() {
  const W = 240, H = 112, rnd = mulberry32(13);
  let b = '';
  [[20, 28], [70, 78], [120, 20], [168, 62], [206, 36], [230, 94]].forEach(([x, y], i) => {
    const r = 1.1 + rnd() * 1;
    b += S.circ(x, y, r * 2.8, '#cfd8ff', { 'fill-opacity': 0.12 }) + S.circ(x, y, r, '#fff') + (i % 2 ? S.star4(x, y, r * 3.6, '#fff', { 'fill-opacity': 0.85 }) : '');
  });
  return S.svg(W, H, b);
}

module.exports = build;
module.exports.parts = { top, moon, wisps, skyline, stars };
function build() {
  const T = url(top()), M = url(moon()), Wi = url(wisps()), Sk = url(skyline()), St = url(stars());
  return `/* ================================================================ Midnight (the default board)
   The original night sky, finished: violet sky glowing pink at the horizon, a crescent moon with a soft halo, scattered stars that
   twinkle, thin wisps of cloud drifting past, and a quiet town skyline with a clock tower and lit windows. */
.board-classic {
  --u4-top: ${T} repeat-x 50% 0 / auto var(--u4-th);
  --u4-moonx: 76%;
  --u4-moon: ${M} no-repeat var(--u4-moonx) 0 / auto var(--u4-th);
  --u4-wisps-img: ${Wi};
  --u4-wisps: var(--u4-wisps-img) repeat-x 0 0 / 480px var(--u4-th);
  --u4-stars-img: ${St};
  --u4-town: ${Sk} repeat-x 50% 100% / auto var(--u4-bh);
  --u4-sky: radial-gradient(ellipse 46% 16% at 70% 7%, rgba(150, 120, 255, 0.2), transparent 72%), radial-gradient(ellipse 90% 22% at 50% 100%, rgba(255, 90, 160, 0.36), transparent 76%), linear-gradient(180deg, #0b0722 0%, #160c3a 32%, #26124f 60%, #3b1a62 82%, #55226e 100%);
  --a-bg-run: var(--u4-moon), var(--u4-top), var(--u4-town), var(--u4-sky);
  --a-bg: var(--u4-moon), var(--u4-top), var(--u4-wisps), var(--u4-town), var(--u4-sky);
  --a-board: linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 30%), linear-gradient(180deg, #17122e, #0e0a20);
  --a-frame: rgba(255, 255, 255, 0.18);
  --a-glow: rgba(140, 110, 255, 0.2);
}
.board-classic .run-active .bg::before { display: block; left: 0; top: 0; width: calc(100% + 480px); height: var(--u4-th); background: var(--u4-wisps-img) repeat-x 0 0 / 480px 100%; will-change: transform; animation: u4Drift 150s linear infinite; }
.board-classic .run-active .bg .scene-fx { display: block; height: var(--u4-th); background-image: var(--u4-stars-img); background-size: auto 100%; background-position: 50% 0; animation: u4Twinkle 4.2s ease-in-out infinite; }
.board-classic .run-active .bg .scene-fx.b { display: none; }

/* badges, previews and the reveal: a brighter sky and a more see-through board so the scene still reads at 56px */
:is(.bdg-scene, .hero-board, .mini-board).board-classic { --u4-sky: radial-gradient(ellipse 60% 40% at 80% 20%, rgba(200, 170, 255, 0.5), transparent 70%), linear-gradient(180deg, #1b1058 0%, #3d1d82 50%, #8a2f96 100%); --a-board: linear-gradient(180deg, rgba(18, 12, 42, 0.8), rgba(9, 6, 24, 0.88)); }
`;
}
