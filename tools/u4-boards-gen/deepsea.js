// Deep Sea: light shafts and a rippling surface above, a kelp forest on the seabed below, a brass bolted porthole frame.
const { S, mulberry32, n, wrap, smooth, url } = require('./lib');

const XL = " xmlns:xlink='http://www.w3.org/1999/xlink'";
const svgx = (w, h, body, defs) => S.svg(w, h, body, defs).replace("xmlns='http://www.w3.org/2000/svg'", "xmlns='http://www.w3.org/2000/svg'" + XL);
const use = (id, x, y, sx, sy, fill) => `<use xlink:href='#${id}' transform='translate(${n(x)} ${n(y)}) scale(${sx} ${sy})' fill='${fill}'/>`;

function top() {
  const W = 480, H = 120, rnd = mulberry32(11);
  const defs = S.lg('sf', [[0, '#e2fdff', 0.95], [0.16, '#9fecf8', 0.6], [0.5, '#3cb6dc', 0.14], [1, '#3cb6dc', 0]]) + S.lg('sh', [[0, '#c6f6ff', 0.4], [0.55, '#9fe8f8', 0.12], [1, '#9fe8f8', 0]]) + S.lg('sb', [[0, '#3a86a6'], [1, '#0d3f58']]) + S.rg('ph', [[0, '#ffe9a0', 0.9], [0.5, '#ffd070', 0.3], [1, '#ffd070', 0]])
    + `<g id='fs'>${S.ell(0, 0, 8, 3.2, '#0a4f7c') + S.poly([[7, 0], [13, -3.6], [13, 3.6]], '#0a4f7c') + S.circ(-4.5, -0.6, 0.7, '#7fd6f0')}</g>`
    + `<g id='sub'>${S.poly([[22, -2], [38, -7], [38, 7], [22, 4]], '#0d3f58') + S.line(36, 0, 44, -8, '#1f6a8a', 2) + S.line(36, 0, 44, 8, '#1f6a8a', 2) + S.path('M-24 -3Q-24 -12 -8 -12H14Q30 -12 30 -2Q30 9 14 11H-8Q-24 11 -24 -3Z', 'url(#sb)') + S.path('M-14 -12V-18Q-14 -21 -10 -21H0Q4 -21 4 -18V-12Z', 'url(#sb)') + S.line(-6, -21, -6, -28, '#1f6a8a', 1.6) + S.line(-6, -28, -13, -28, '#1f6a8a', 1.6) + S.path('M-20 -8Q-8 -12 12 -10', 'none', { stroke: '#8fe0f4', 'stroke-opacity': 0.5, 'stroke-width': 1.3 }) + [-14, -3, 8, 19].map((x) => S.circ(x, 0, 6.5, 'url(#ph)') + S.circ(x, 0, 3.6, '#fff2b8') + S.circ(x, 0, 4.4, 'none', { stroke: '#c9a24a', 'stroke-width': 1.3 })).join('')}</g>`;
  let b = '';
  for (let i = 0; i < 6; i++) {
    const x0 = 24 + i * 80 + Math.round((rnd() - 0.5) * 18), w = 16 + Math.round(rnd() * 22), lean = -46 - Math.round(rnd() * 26);
    b += wrap(W, (dx) => S.poly([[x0 + dx, 4], [x0 + w + dx, 4], [x0 + w + lean + 34 + dx, H], [x0 + lean - 6 + dx, H]], 'url(#sh)'));
  }
  const wave = (y0, a) => { let d = `M0 ${y0}Q40 ${y0 + a} 80 ${y0}`; for (let i = 1; i < 6; i++) d += `T${(i + 1) * 80} ${y0}`; return d; };
  b += S.path(`M0 0H480V14Q440 6 400 14T320 14T240 14T160 14T80 14T0 14Z`, 'url(#sf)');
  b += S.stroke(wave(14, 8), '#f0feff', 1.4, { 'stroke-opacity': 0.75 });
  b += S.stroke(wave(22, -6), '#bff4ff', 1, { 'stroke-opacity': 0.4 });
  for (let i = 0; i < 8; i++) b += S.ell(20 + rnd() * 440, 20 + rnd() * 26, 5 + rnd() * 9, 0.9 + rnd() * 0.8, '#e8feff', { 'fill-opacity': +(0.2 + rnd() * 0.3).toFixed(2) });
  for (let i = 0; i < 9; i++) b += `<use xlink:href='#fs' transform='translate(${Math.round(300 + (i % 3) * 26 + rnd() * 10)} ${Math.round(66 + Math.floor(i / 3) * 14 + rnd() * 8)}) scale(${(0.7 + rnd() * 0.35).toFixed(2)})' opacity='.6'/>`;
  b += `<use xlink:href='#sub' transform='translate(224 82) scale(0.95)' opacity='.92'/>`;
  return svgx(W, H, b, defs);
}

function seabed() {
  const W = 480, H = 200, rnd = mulberry32(5);
  const defs = S.lg('far', [[0, '#0c5c88'], [1, '#06304f']]) + S.lg('mid', [[0, '#0a4268'], [1, '#04223a']]) + S.lg('near', [[0, '#04263f'], [1, '#010f1c']]);
  const ridge = (base, amps, fill, ph) => {
    const pts = []; for (let x = -40; x <= W + 40; x += 40) { let y = base; amps.forEach(([a, k, p]) => { y -= a * Math.sin(((x / W) * k + p + ph) * Math.PI * 2); }); pts.push([x, y]); }
    return S.path(`${smooth(pts)}V${H}H-40Z`, fill);
  };
  let b = ridge(150, [[12, 2, 0], [7, 5, 0.3]], 'url(#far)', 0);
  const coral = (x, y, s, col, col2) => {
    let c = '';
    const br = (x0, y0, ang, len, w, depth) => {
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 - Math.sin(ang) * len;
      c += S.line(x0, y0, x1, y1, col, n(w), { 'stroke-linecap': 'round' });
      if (depth > 0) { br(x1, y1, ang + 0.55, len * 0.7, w * 0.8, depth - 1); br(x1, y1, ang - 0.5, len * 0.72, w * 0.8, depth - 1); } else c += S.circ(x1, y1, w * 0.75, col2);
    };
    br(x, y, Math.PI / 2, 15 * s, 3.2 * s, 2);
    return c;
  };
  b += coral(66, 146, 1, '#ff7a64', '#ffd0a8') + coral(86, 150, 0.7, '#ff9a7a', '#ffe3c0') + coral(318, 144, 1.1, '#e86aa8', '#ffc2e0') + coral(340, 150, 0.7, '#ff7a64', '#ffd0a8');
  const fan = (x, y, r) => { let f = ''; for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.12 + (i / 6) * 0.76); f += S.line(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r, '#b17ae6', 1.4); } return f + S.stroke(`M${n(x - r * 0.86)} ${n(y - r * 0.42)}Q${n(x)} ${n(y - r * 1.2)} ${n(x + r * 0.86)} ${n(y - r * 0.42)}`, '#d8b0ff', 1.6); };
  b += fan(420, 152, 22);
  b += ridge(172, [[8, 3, 0.1], [5, 7, 0.5]], 'url(#mid)', 0.2);
  const rock = (x, y, w, h, c1, c2) => S.path(`M${x - w} ${y}Q${n(x - w * 0.7)} ${n(y - h)} ${n(x - w * 0.1)} ${n(y - h * 0.95)}Q${n(x + w * 0.7)} ${n(y - h * 1.05)} ${x + w} ${y}Z`, c1) + S.path(`M${n(x - w * 0.55)} ${n(y - h * 0.55)}Q${n(x - w * 0.1)} ${n(y - h * 0.95)} ${n(x + w * 0.3)} ${n(y - h * 0.8)}Q${n(x - w * 0.1)} ${n(y - h * 0.72)} ${n(x - w * 0.55)} ${n(y - h * 0.55)}Z`, c2, { 'fill-opacity': 0.5 });
  b += rock(200, 178, 34, 24, '#052c48', '#3c86a8') + rock(250, 182, 20, 14, '#04263f', '#3c86a8') + rock(34, 184, 26, 16, '#052c48', '#3c86a8');
  b += ridge(188, [[5, 2, 0.4], [3, 6, 0.1]], 'url(#near)', 0);
  for (let i = 0; i < 22; i++) b += S.circ(Math.round(rnd() * W), Math.round(190 + rnd() * 9), +(0.8 + rnd() * 1.2).toFixed(1), '#1c5878', { 'fill-opacity': 0.8 });
  return svgx(W, H, b, defs);
}

function kelp() {
  const W = 480, H = 200, rnd = mulberry32(23);
  const strand = (h, amp, ph) => {
    const N = 7, L = [], Rr = [];
    for (let i = 0; i <= N; i++) { const t = i / N, x = amp * Math.sin(t * 4.2 + ph) * Math.pow(t, 0.7), y = -h * t, w = 5 * (1 - 0.82 * t) + 0.4; L.push([x - w, y]); Rr.push([x + w, y]); }
    return S.path(`M${L.map((p) => n(p[0]) + ' ' + n(p[1])).join('L')}L${Rr.reverse().map((p) => n(p[0]) + ' ' + n(p[1])).join('L')}Z`, 'inherit').replace(" fill='inherit'", '')
      + [2, 4, 6].map((i, k) => { const t = i / N, x = amp * Math.sin(t * 4.2 + ph) * Math.pow(t, 0.7), y = -h * t, s = k % 2 ? 1 : -1, ln = 16 + k * 3; return `<path d='M${n(x)} ${n(y)}q${n(s * ln * 0.9)} ${n(-ln * 0.2)} ${n(s * ln)} ${n(-ln * 0.95)}q${n(-s * ln * 0.7)} ${n(ln * 0.35)} ${n(-s * ln * 1)} ${n(ln * 0.9)}z'/>`; }).join('');
  };
  const defs = S.lg('kb', [[0, '#0d4f5c'], [1, '#1f7d86', 0.7]]) + S.lg('kf', [[0, '#0f5a3c'], [0.55, '#27a064'], [1, '#5fcf8c', 0.85]])
    + `<g id='k1'>${strand(104, 9, 0.4)}</g><g id='k2'>${strand(78, 7, 1.9)}</g><g id='k3'>${strand(120, 10, 1.0)}</g>`;
  let b = '';
  [[70, 'k1', -1, 0.8], [168, 'k3', -1, 0.76], [290, 'k1', 1, 0.74], [346, 'k3', 1, 0.7], [440, 'k2', -1, 0.8]].forEach(([x, id, sx, sy]) => { b += use(id, x, 198, sx * 0.9, sy, 'url(#kb)'); });
  [[28, 'k2', 1, 1], [100, 'k3', 1, 0.95], [138, 'k1', -1, 0.9], [236, 'k3', -1, 0.85], [262, 'k2', -1, 1], [318, 'k1', -1, 0.95], [392, 'k3', -1, 0.9], [462, 'k1', 1, 0.8]].forEach(([x, id, sx, sy]) => { b += use(id, x, 198, sx, sy, 'url(#kf)'); });
  return svgx(W, H, b, defs);
}

function bubbles() {
  let b = '';
  [[30, 40, 7], [96, 90, 4.5], [170, 60, 10], [222, 130, 5], [60, 190, 9], [140, 230, 5.5], [210, 280, 8], [20, 330, 4.5], [110, 360, 11], [180, 410, 6], [70, 450, 7.5], [235, 480, 4], [140, 500, 5]].forEach(([x, y, r]) => {
    b += S.circ(x, y, r, '#d6f8ff', { 'fill-opacity': 0.1, stroke: '#d6f8ff', 'stroke-opacity': 0.72, 'stroke-width': r > 6 ? 1.4 : 1.1 });
    b += S.circ(x - r * 0.36, y - r * 0.38, r * 0.24, '#ffffff', { 'fill-opacity': 0.85 });
  });
  return S.svg(260, 520, b);
}

module.exports = build;
module.exports.parts = { top, seabed, kelp, bubbles };
function build() {
  const T = url(top()), B = url(seabed()), K = url(kelp()), F = url(bubbles());
  return `/* ================================================================ Deep Sea (Common)
   Looking up through blue water: the sun's light slants down from a rippling surface, a school of small fish far off, and on the
   seabed a kelp forest (it sways) among coral and rocks. The board sits in a bolted brass porthole ring. Bubbles rise. */
.board-deepsea {
  --u4-th: min(112px, 15%); --u4-bh: min(184px, 24%);
  --u4-top: ${T} repeat-x 50% 0 / auto var(--u4-th);
  --u4-bed: ${B} repeat-x 50% 100% / auto var(--u4-bh);
  --u4-kelp-img: ${K};
  --u4-kelp: var(--u4-kelp-img) repeat-x 50% 100% / auto var(--u4-bh);
  --u4-sky: radial-gradient(ellipse 90% 40% at 50% 0%, rgba(110, 225, 245, 0.45), transparent 70%), linear-gradient(180deg, #0f93bd 0%, #0a6f9d 14%, #065482 36%, #04386a 60%, #022444 80%, #011220 100%);
  --a-bg-run: var(--u4-top), var(--u4-bed), var(--u4-sky);
  --a-bg: var(--u4-top), var(--u4-kelp), var(--u4-bed), var(--u4-sky);
  --a-board: linear-gradient(180deg, rgba(2, 23, 43, 0.98), rgba(1, 13, 28, 0.985));
  --a-frame: #d6ad55;
  --a-glow: rgba(70, 200, 245, 0.36);
}
.board-deepsea .run-active .bg { background: var(--a-bg-run); }
.board-deepsea .run-active .bg::before { display: block; left: -24px; right: -24px; bottom: 0; height: var(--u4-bh); background: var(--u4-kelp-img) repeat-x 50% 100% / auto 100%; transform-origin: 50% 100%; will-change: transform; animation: u4Sway 8s ease-in-out infinite alternate; }
.board-deepsea .run-active .bg .scene-fx { display: block; height: calc(100% + 520px); background-image: ${F}; background-size: 260px 520px; animation: u4Rise 22s linear infinite; }
.board-deepsea .run-active .bg .scene-fx.b { display: none; }
/* the porthole: a ring of brass bolts */
.board-deepsea .board::after { background:
    radial-gradient(circle at 50% 50%, #fff2b8 0 0.9px, #d6ad55 1.7px, #6a4c1a 2.5px, transparent 3.1px) 0 3px / 28px 8px repeat-x,
    radial-gradient(circle at 50% 50%, #fff2b8 0 0.9px, #d6ad55 1.7px, #6a4c1a 2.5px, transparent 3.1px) 14px calc(100% - 3px) / 28px 8px repeat-x,
    radial-gradient(circle at 50% 50%, #fff2b8 0 0.9px, #d6ad55 1.7px, #6a4c1a 2.5px, transparent 3.1px) 3px 14px / 8px 28px repeat-y,
    radial-gradient(circle at 50% 50%, #fff2b8 0 0.9px, #d6ad55 1.7px, #6a4c1a 2.5px, transparent 3.1px) calc(100% - 3px) 0 / 8px 28px repeat-y;
  box-shadow: inset 0 0 0 3px rgba(74, 52, 14, 0.7), inset 0 0 16px rgba(110, 225, 245, 0.2); }

/* badges, previews and the reveal: a brighter sky and a more see-through board so the scene still reads at 56px */
:is(.bdg-scene, .hero-board, .mini-board).board-deepsea { --u4-sky: linear-gradient(180deg, #2cc0e6 0%, #1480ba 42%, #08487a 100%); --a-board: linear-gradient(180deg, rgba(2, 30, 54, 0.78), rgba(1, 16, 34, 0.86)); }
`;
}
