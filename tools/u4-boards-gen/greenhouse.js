// Greenhouse: a glass roof with hanging baskets above, potted monstera, ferns and flowers on a bench below, sunbeams and pollen.
const { S, mulberry32, n, url } = require('./lib');
const XL = " xmlns:xlink='http://www.w3.org/1999/xlink'";
const svgx = (w, h, body, defs) => S.svg(w, h, body, defs).replace("xmlns='http://www.w3.org/2000/svg'", "xmlns='http://www.w3.org/2000/svg'" + XL);

const heart = (x, y, s, rot, fill) => `<use xlink:href='#hl' transform='translate(${n(x)} ${n(y)}) rotate(${rot}) scale(${s})' fill='${fill}'/>`;

function top() {
  const W = 480, H = 120, rnd = mulberry32(61);
  const defs = S.lg('gl', [[0, '#e8ffd8', 0.34], [1, '#bff0c8', 0.04]]) + S.lg('gs', [[0, '#fff', 0.5], [1, '#fff', 0]], 0, 0, 1, 1)
    + `<path id='hl' d='M0 0C-6 -5 -11 2 0 10C11 2 6 -5 0 0Z'/>`;
  let b = '';
  // panes: three columns of glass between steel mullions, with a sun-glint streak on some
  for (let i = 0; i < 8; i++) { const x = i * 60; b += S.rect(x + 2, 2, 56, 46, 'url(#gl)') + S.rect(x + 2, 52, 56, 46, 'url(#gl)', { 'fill-opacity': 0.7 }); if (i % 3 === 1) b += S.poly([[x + 8, 4], [x + 22, 4], [x + 8 + 20, 46], [x + 8 + 6, 46]], 'url(#gs)'); if (i % 3 === 0) b += S.poly([[x + 30, 54], [x + 40, 54], [x + 28, 96], [x + 20, 96]], 'url(#gs)'); }
  for (let i = 0; i <= 8; i++) b += S.rect(i * 60 - 1.5, 0, 3, 100, '#d8f2dc', { 'fill-opacity': 0.55 }) + S.rect(i * 60 + 0.5, 0, 1.2, 100, '#0a3a22', { 'fill-opacity': 0.5 });
  b += S.rect(0, 47, W, 4, '#d8f2dc', { 'fill-opacity': 0.55 }) + S.rect(0, 50, W, 1.4, '#0a3a22', { 'fill-opacity': 0.5 });
  b += S.rect(0, 0, W, 6, '#dff6e0', { 'fill-opacity': 0.7 }) + S.rect(0, 5, W, 1.6, '#0a3a22', { 'fill-opacity': 0.6 });
  b += S.rect(0, 97, W, 3, '#d8f2dc', { 'fill-opacity': 0.5 });
  // hanging baskets with trailing ivy
  const basket = (x, len) => {
    let c = S.line(x - 12, 6, x, 6 + len, '#8a7a5a', 1.2) + S.line(x + 12, 6, x, 6 + len, '#8a7a5a', 1.2);
    c += S.path(`M${x - 15} ${6 + len + 2}H${x + 15}L${x + 11} ${6 + len + 15}H${x - 11}Z`, '#a8743c') + S.path(`M${x - 13} ${6 + len + 6}H${x + 13}M${x - 12} ${6 + len + 10}H${x + 12}`, 'none', { stroke: '#6a4420', 'stroke-width': 1.1 });
    c += S.ell(x, 6 + len, 17, 6, '#1f8a4a');
    for (let k = 0; k < 7; k++) c += heart(x - 14 + k * 4.6, 6 + len - 2 + (k % 2) * 2, 0.8, rnd() * 60 - 30, k % 2 ? '#34c46a' : '#1f9a52');
    // two trailing vines
    [[-9, 36], [8, 46]].forEach(([dx, drop], v) => {
      const x0 = x + dx, y0 = 6 + len + 14;
      c += S.stroke(`M${x0} ${y0}Q${x0 + (v ? 6 : -6)} ${y0 + drop * 0.5} ${x0 + (v ? -2 : 3)} ${y0 + drop}`, '#18703a', 1.5);
      for (let k = 1; k <= 5; k++) { const t = k / 5.4; c += heart(x0 + (v ? 6 : -6) * 2 * t * (1 - t) * 2 + (k % 2 ? 4 : -4), y0 + drop * t, 0.75 - t * 0.2, (k % 2 ? 1 : -1) * 40 + 180, k % 2 ? '#2fbf62' : '#1f9a52'); }
    });
    return c;
  };
  b += basket(96, 10) + basket(370, 18);
  // ferns drooping in from the frame
  const fern = (x, dir, len) => { let f = S.stroke(`M${x} 4Q${x + dir * len * 0.6} 4 ${x + dir * len} ${len * 0.5}`, '#18703a', 2); for (let k = 1; k < 9; k++) { const t = k / 9, px = x + dir * len * (0.6 * 2 * t * (1 - t) + t * t), py = 4 + len * 0.5 * t * t + 2 * t * (1 - t) * 0; f += S.ell(px, py + 6, 3, 9 - t * 4, k % 2 ? '#2fbf62' : '#1f9a52', { transform: `rotate(${dir * -20 + (k % 2 ? 30 : -30)} ${n(px)} ${n(py)})` }); } return f; };
  b += fern(0, 1, 70) + fern(480, -1, 70) + fern(220, 1, 40);
  return svgx(W, H, b, defs);
}

function bench() {
  const W = 480, H = 200, rnd = mulberry32(14);
  const defs = S.lg('pot', [[0, '#e0804a'], [0.5, '#c4602c'], [1, '#8a3c18']], 0, 0, 1, 0) + S.lg('wd', [[0, '#8a5a34'], [1, '#4a2a14']]) + S.lg('so', [[0, '#3a2616'], [1, '#1a0e08']])
    + S.lg('l1', [[0, '#34c466'], [1, '#0f6a36']], 0, 0, 1, 1) + S.lg('l2', [[0, '#5fe08c'], [1, '#18863f']], 0, 0, 1, 1)
    + `<path id='lf' d='M0 0Q9 -22 0 -44Q-9 -22 0 0Z'/><path id='fl' d='M0 0Q5 -4 10 -1Q5 4 0 0Z'/>`;
  let b = '';
  // glass wall behind: faint mullions
  for (let x = 0; x <= W; x += 60) b += S.rect(x - 1, 50, 2, 150, '#d8f2dc', { 'fill-opacity': 0.12 });
  // plants first, then pots, then the bench
  const monstera = (x, y, s, c1) => {
    let m = '';
    [[-40, 1], [0, 1.15], [38, 0.95], [-16, 0.8], [20, 0.78]].forEach(([a, k], i) => {
      const ex = x + Math.sin((a * Math.PI) / 180) * 62 * k * s, ey = y - Math.cos((a * Math.PI) / 180) * 62 * k * s;
      m += S.line(x, y, ex, ey, '#12602f', 2.2) + `<g transform='translate(${n(ex)} ${n(ey)}) rotate(${a + 8}) scale(${n(s * k * 0.9)})'>${S.path('M0 0C-34 -6 -40 -34 -14 -46C-8 -58 8 -58 14 -46C40 -34 34 -6 0 0Z', i % 2 ? 'url(#l1)' : 'url(#l2)')}${S.path('M0 -2V-44M0 -12L-16 -24M0 -12L16 -24M0 -26L-12 -36M0 -26L12 -36', 'none', { stroke: '#0c4a26', 'stroke-width': 1.2, 'stroke-opacity': 0.6 })}${S.path('M-18 -30L-8 -22M18 -30L8 -22M-14 -42L-6 -36M14 -42L6 -36', 'none', { stroke: '#0a3a20', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-opacity': 0.8 })}</g>`;
    });
    return m;
  };
  const fernP = (x, y, s) => { let f = ''; for (let k = 0; k < 9; k++) { const a = -80 + k * 20, ln = 54 * s * (1 - Math.abs(k - 4) * 0.08); const ex = x + Math.sin((a * Math.PI) / 180) * ln, ey = y - Math.cos((a * Math.PI) / 180) * ln * 0.95; f += S.stroke(`M${x} ${y}Q${n((x + ex) / 2 + (k < 4 ? -6 : 6))} ${n((y + ey) / 2 - 8)} ${n(ex)} ${n(ey + 8 * Math.abs(Math.sin((a * Math.PI) / 360)))}`, '#169050', 1.8); for (let j = 1; j < 7; j++) { const t = j / 7; f += S.ell(x + (ex - x) * t, y + (ey - y) * t - 4 * Math.sin(t * Math.PI), 2.4, 6, j % 2 ? '#2fbf62' : '#1f9a52', { transform: `rotate(${a + (j % 2 ? 50 : -50)} ${n(x + (ex - x) * t)} ${n(y + (ey - y) * t)})` }); } } return f; };
  const flowers = (x, y, cols) => { let f = ''; cols.forEach((c, i) => { const fx = x + (i - (cols.length - 1) / 2) * 15, fy = y - 20 - (i % 2) * 10; f += S.line(fx, y, fx, fy, '#18803f', 1.6); for (let p = 0; p < 6; p++) f += S.ell(fx + Math.cos(p * 1.047) * 4.6, fy + Math.sin(p * 1.047) * 4.6, 3.6, 3.6, c); f += S.circ(fx, fy, 2.6, '#ffe27a'); }); return f; };
  const snake = (x, y) => [[-16, 40], [-6, 52], [6, 46], [16, 34]].map(([dx, h], i) => S.path(`M${x + dx - 6} ${y}Q${x + dx - 4} ${y - h * 0.6} ${x + dx} ${y - h}Q${x + dx + 4} ${y - h * 0.6} ${x + dx + 6} ${y}Z`, i % 2 ? '#1d8a4a' : '#2fb062') + S.path(`M${x + dx - 6} ${y}Q${x + dx - 4} ${y - h * 0.6} ${x + dx} ${y - h}`, 'none', { stroke: '#e6e060', 'stroke-width': 1.2 })).join('');
  b += monstera(70, 150, 0.62) + fernP(196, 152, 0.8) + snake(300, 152) + flowers(398, 152, ['#ff6fb5', '#ffd24a', '#ffffff', '#ff8a5a']) + monstera(448, 152, 0.5);
  const pot = (x, y, w, h) => S.path(`M${x - w / 2} ${y}H${x + w / 2}L${x + w / 2 - 5} ${y + h}H${x - w / 2 + 5}Z`, 'url(#pot)') + S.rect(x - w / 2 - 3, y - 4, w + 6, 8, '#d8723a') + S.rect(x - w / 2 - 3, y - 4, w + 6, 2, '#f2a070');
  b += pot(70, 152, 44, 26) + pot(196, 152, 48, 26) + pot(300, 152, 40, 26) + pot(398, 152, 50, 26) + pot(448, 154, 34, 22);
  b += S.rect(0, 178, W, 8, 'url(#wd)') + S.rect(0, 178, W, 2, '#c8905a') + S.rect(0, 186, W, 14, 'url(#so)');
  for (let i = 0; i < 40; i++) b += S.circ(Math.round(rnd() * W), Math.round(188 + rnd() * 10), +(0.6 + rnd() * 1).toFixed(1), '#5a3a22', { 'fill-opacity': 0.8 });
  // watering can
  b += S.g(S.path('M0 0H22L20 18H2Z', '#5aa0b0') + S.path('M22 4L36 -6L38 -2L22 10Z', '#5aa0b0') + S.path('M0 4Q-12 4 -10 14', 'none', { stroke: '#3a7888', 'stroke-width': 2.6 }) + S.rect(0, 0, 22, 2.4, '#a8e0ea', { 'fill-opacity': 0.8 }), { transform: 'translate(112 160)' });
  return svgx(W, H, b, defs);
}

function beams() {
  const W = 200, H = 400;
  const defs = S.lg('bm', [[0, '#fffbd0', 0.38], [0.6, '#fffbd0', 0.14], [1, '#fffbd0', 0]]);
  let b = S.poly([[120, 0], [170, 0], [60, 400], [-10, 400]], 'url(#bm)') + S.poly([[60, 0], [84, 0], [-6, 300], [-26, 300]], 'url(#bm)', { opacity: 0.8 }) + S.poly([[186, 0], [200, 0], [150, 330], [136, 330]], 'url(#bm)', { opacity: 0.7 });
  return S.svg(W, H, b, defs);
}

function pollen() {
  const W = 260, H = 520, rnd = mulberry32(33);
  const defs = S.rg('pl', [[0, '#fffbc0', 0.95], [0.4, '#f6f080', 0.4], [1, '#f6f080', 0]]);
  let b = '';
  for (let i = 0; i < 16; i++) b += S.circ(Math.round(8 + rnd() * 244), Math.round(10 + (i / 16) * 500 + rnd() * 16), +(3 + rnd() * 5).toFixed(1), 'url(#pl)');
  return S.svg(W, H, b, defs);
}

module.exports = build;
module.exports.parts = { top, bench, beams, pollen };
function build() {
  const T = url(top()), B = url(bench()), M = url(beams()), P = url(pollen());
  return `/* ================================================================ Greenhouse (Legendary)
   Inside a glass house in full sun: panes and steel mullions overhead with hanging baskets of ivy, and below a bench of pots with
   monstera, ferns, a snake plant and flowers. Sunbeams slant through the glass and shimmer; pollen drifts up. */
.board-greenhouse {
  --u4-th: min(112px, 15%); --u4-bh: min(184px, 24%);
  --u4-top: ${T} repeat-x 50% 0 / auto var(--u4-th);
  --u4-bench: ${B} repeat-x 50% 100% / auto var(--u4-bh);
  --u4-beams-img: ${M};
  --u4-beams: var(--u4-beams-img) no-repeat 50% 0 / 100% 100%;
  --u4-sky: radial-gradient(ellipse 90% 26% at 50% 0%, rgba(255, 250, 190, 0.55), transparent 72%), linear-gradient(180deg, #2f8d4e 0%, #1d6d3d 30%, #104b2d 62%, #08301d 100%);
  --a-bg-run: var(--u4-top), var(--u4-bench), var(--u4-sky);
  --a-bg: var(--u4-top), var(--u4-bench), var(--u4-beams), var(--u4-sky);
  --a-board: linear-gradient(180deg, rgba(6, 27, 17, 0.97), rgba(3, 17, 11, 0.98));
  --a-frame: #b7f2a0;
  --a-glow: rgba(170, 255, 130, 0.38);
}
.board-greenhouse .run-active .bg { background: var(--a-bg-run); }
.board-greenhouse .run-active .bg::before { display: block; inset: 0; background: var(--u4-beams-img) no-repeat 50% 0 / 100% 100%; animation: u4Pulse 7s ease-in-out infinite alternate; }
.board-greenhouse .run-active .bg .scene-fx { display: block; height: calc(100% + 520px); background-image: ${P}; background-size: 260px 520px; animation: u4Rise 38s linear infinite; }
.board-greenhouse .run-active .bg .scene-fx.b { display: none; }
/* the roof is bright behind the HUD: lift the small labels and give the numbers a soft shadow so they stay readable */
.board-greenhouse .run-active :is(.score-box .lbl, .fuse-time span, .stage-tag span) { color: #eaffea; text-shadow: 0 1px 2px rgba(0, 40, 20, 0.8); }
.board-greenhouse .run-active :is(.score-box b, .fuse-time b) { text-shadow: 0 1px 3px rgba(0, 40, 20, 0.7); }
/* ivy in the corners of a pale steel frame */
.board-greenhouse .board::after { background: radial-gradient(ellipse 18px 8px at 0 0, #58c77a 0 90%, transparent), radial-gradient(ellipse 8px 18px at 0 0, #3fa05e 0 90%, transparent), radial-gradient(ellipse 18px 8px at 100% 100%, #58c77a 0 90%, transparent), radial-gradient(ellipse 8px 18px at 100% 100%, #3fa05e 0 90%, transparent), radial-gradient(ellipse 14px 7px at 100% 0, #46b86a 0 90%, transparent), radial-gradient(ellipse 14px 7px at 0 100%, #46b86a 0 90%, transparent); box-shadow: inset 0 0 0 3px rgba(14, 56, 34, 0.8), inset 0 0 0 4.5px rgba(200, 255, 190, 0.24); }

/* badges, previews and the reveal: a brighter sky and a more see-through board so the scene still reads at 56px */
:is(.bdg-scene, .hero-board, .mini-board).board-greenhouse { --u4-sky: linear-gradient(180deg, #62cc72 0%, #2fa152 46%, #167038 100%); --a-board: linear-gradient(180deg, rgba(7, 30, 18, 0.78), rgba(3, 17, 11, 0.86)); }
`;
}
