// Night Market: strings of paper lanterns above, a row of lit stalls with striped awnings below, in purple dusk.
const { S, mulberry32, n, wrap, url } = require('./lib');
const XL = " xmlns:xlink='http://www.w3.org/1999/xlink'";
const svgx = (w, h, body, defs) => S.svg(w, h, body, defs).replace("xmlns='http://www.w3.org/2000/svg'", "xmlns='http://www.w3.org/2000/svg'" + XL);

const LC = [['#ff4a3a', '#ff9a4a'], ['#ffb02e', '#ffe27a'], ['#ff5fb0', '#ffa0d0'], ['#ff7a2a', '#ffc070'], ['#b86bff', '#e0b0ff']];
// one lantern, drawn around (0,0): cap, ribbed body, tassel; halo behind it. Each colour is a <g> reused by <use>.
function lanternDef(c) {
  const [a, b] = LC[c];
  return `<g id='L${c}'>` + S.circ(0, 3, 34, `url(#hl${c})`)
    + S.rect(-4, -15.5, 8, 3.5, '#3a1a10') + S.ell(0, 0, 11, 13.5, `url(#lg${c})`) + S.ell(0, 0, 5.2, 13.5, 'none', { stroke: '#7a1a10', 'stroke-opacity': 0.55, 'stroke-width': 0.9 })
    + S.line(0, -13.5, 0, 13.5, '#7a1a10', 0.8, { 'stroke-opacity': 0.5 }) + S.rect(-4.5, 12, 9, 3, '#3a1a10') + S.line(0, 15, 0, 22, '#ffd070', 1.1) + S.circ(0, 23, 1.6, '#ffd070') + S.ell(-3.8, -4, 2.2, 4.4, '#fff', { 'fill-opacity': 0.4 }) + '</g>';
}

function top() {
  const W = 480, H = 120;
  let defs = '';
  LC.forEach(([a, b], i) => { defs += S.rg('lg' + i, [[0, '#fff6d0'], [0.35, b], [1, a]], 0.5, 0.45, 0.62); defs += S.rg('hl' + i, [[0, b, 0.6], [0.5, a, 0.2], [1, a, 0]]); defs += lanternDef(i); });
  let b = '';
  // two strings (catenaries) of lanterns; the back one is smaller and dimmer
  const string = (x0, x1, y0, sag, count, scale, alpha, c0) => {
    let s = S.stroke(`M${x0} ${y0}Q${(x0 + x1) / 2} ${y0 + sag * 2} ${x1} ${y0}`, '#2a0e30', 1.6, { 'stroke-opacity': 0.9 });
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count, x = x0 + (x1 - x0) * t, yy = y0 + sag * 4 * t * (1 - t);
      s += `<use xlink:href='#L${(c0 + i) % 5}' transform='translate(${n(x)} ${n(yy + 4 * scale)}) scale(${scale})' opacity='${alpha}'/>`;
    }
    return s;
  };
  b += string(-10, 240, 6, 9, 8, 0.62, 0.7, 2) + string(240, 490, 6, 9, 8, 0.62, 0.7, 0);
  b += string(-10, 240, 4, 24, 7, 1, 1, 0) + string(240, 490, 4, 24, 7, 1, 1, 3);
  return svgx(W, H, b, defs);
}

function stalls() {
  const W = 480, H = 200, rnd = mulberry32(31);
  const defs = S.lg('rf', [[0, '#3a1668', 0], [1, '#2a0f50']]) + S.lg('gr', [[0, '#1a0a35'], [1, '#0c0420']]) + S.rg('pool', [[0, '#ffc070', 0.6], [0.6, '#ff8a40', 0.18], [1, '#ff8a40', 0]])
    + S.lg('wd', [[0, '#4a2418'], [1, '#2a120c']]) + S.rg('lamp', [[0, '#fff2c0'], [0.3, '#ffc060', 0.8], [1, '#ff9030', 0]]);
  let b = '';
  // rooftops far behind
  b += S.path('M0 120L0 98L24 98L34 82L44 98L64 98L64 120ZM80 120V92L96 74L112 92V120ZM132 120V104H170V120ZM196 120V96L210 78L224 96V120ZM250 120V100H294V120ZM316 120V90L332 70L348 90V120ZM372 120V104H410V120ZM426 120V96L440 80L454 96V120Z', '#2a0f52', { 'fill-opacity': 0.8 });
  b += S.path('M0 140V112H480V140Z', 'url(#rf)');
  for (let i = 0; i < 12; i++) b += S.rect(10 + i * 40 + Math.round(rnd() * 14), 100 + Math.round(rnd() * 22), 4, 5, '#ffc070', { 'fill-opacity': 0.55 });
  // three stalls with striped awnings
  const stall = (x, col1, col2, goods) => {
    let s = '';
    s += S.ell(x + 52, 176, 70, 16, 'url(#pool)');
    s += S.rect(x + 4, 120, 4, 60, '#2a120c') + S.rect(x + 96, 120, 4, 60, '#2a120c');
    s += S.rect(x + 8, 126, 88, 40, '#120620', { 'fill-opacity': 0.9 }) + S.rect(x + 8, 126, 88, 40, 'url(#lamp)', { 'fill-opacity': 0.35 });
    s += S.rect(x - 2, 164, 108, 14, 'url(#wd)') + S.rect(x - 2, 164, 108, 2, '#8a5a38');
    // awning: scalloped stripes
    const k = 8, w = 112 / k;
    for (let i = 0; i < k; i++) s += S.path(`M${n(x - 4 + i * w)} 108L${n(x - 4 + (i + 1) * w)} 108L${n(x - 8 + (i + 1) * w * 1.04)} 128A${n(w / 2)} 5 0 0 1 ${n(x - 8 + i * w * 1.04)} 128Z`, i % 2 ? col2 : col1);
    s += S.path(`M${x - 4} 108L${x + 14} 94H${x + 90}L${x + 108} 108Z`, col1, { 'fill-opacity': 1 }) + S.path(`M${x + 14} 94H${x + 90}L${x + 94} 99H${x + 10}Z`, '#fff', { 'fill-opacity': 0.18 });
    s += S.rect(x - 4, 106, 112, 2.4, '#000', { 'fill-opacity': 0.25 });
    s += S.line(x + 52, 128, x + 52, 138, '#ffd070', 1) + S.circ(x + 52, 143, 8, 'url(#lamp)') + S.circ(x + 52, 143, 2.6, '#fff6d0');
    s += goods;
    return s;
  };
  const fruit = (x, c1, c2) => [0, 1, 2, 3].map((i) => S.circ(x + 8 + i * 12 + (i % 2) * 2, 160 - (i % 2) * 6, 6, i % 2 ? c1 : c2)).join('') + S.circ(x + 26, 150, 6, c2) + S.circ(x + 38, 150, 6, c1);
  b += stall(32, '#e8384a', '#fff0d8', fruit(30, '#ffb02e', '#ff7a2a') + S.rect(78, 152, 18, 12, '#6a3a20') + S.circ(87, 150, 5, '#ffe27a'));
  b += stall(184, '#1fb5b0', '#fff0d8', [0, 1, 2, 3, 4].map((i) => S.path(`M${192 + i * 17} 164Q${190 + i * 17} 150 ${200 + i * 17} 150Q${210 + i * 17} 150 ${208 + i * 17} 164Z`, ['#ff5fb0', '#ffb02e', '#b86bff', '#6bffb2', '#ff7a2a'][i])).join(''));
  b += stall(334, '#ff9a2e', '#fff0d8', S.rect(346, 150, 80, 14, '#3a1a10') + [0, 1, 2].map((i) => S.path(`M${356 + i * 24} 150Q${354 + i * 24} 134 ${366 + i * 24} 134Q${378 + i * 24} 134 ${376 + i * 24} 150Z`, '#fff0d8', { 'fill-opacity': 0.85 })).join('') + S.path('M360 130Q352 118 362 110Q372 102 366 92', 'none', { stroke: '#ffe0c0', 'stroke-opacity': 0.4, 'stroke-width': 3, 'stroke-linecap': 'round' }));
  // ground
  b += S.rect(0, 178, W, 22, 'url(#gr)');
  b += S.line(0, 178.5, W, 178.5, '#6a2a70', 1, { 'stroke-opacity': 0.5 });
  return svgx(W, H, b, defs);
}

function lamps() {
  const W = 480, H = 200;
  const defs = S.rg('lp', [[0, '#fff2c0', 0.9], [0.25, '#ffc060', 0.5], [1, '#ff9030', 0]]);
  return S.svg(W, H, [84, 236, 386].map((x) => S.circ(x, 143, 40, 'url(#lp)')).join(''), defs);
}

module.exports = build;
module.exports.parts = { top, stalls, lamps };
function build() {
  const T = url(top()), B = url(stalls()), P = url(lamps());
  return `/* ================================================================ Night Market (Rare)
   Purple dusk over a night market: two strings of paper lanterns across the top (they swing a little), and below a row of stalls
   with scalloped awnings, fruit, flowers and steaming dumplings, each lit by a hanging lamp that breathes. The board is a dark
   plum panel strung with bulbs. */
.board-market {
  --u4-th: min(112px, 15%); --u4-bh: min(176px, 23%);
  --u4-top-img: ${T};
  --u4-top: var(--u4-top-img) repeat-x 50% 0 / auto var(--u4-th);
  --u4-stalls-img: ${B};
  --u4-stalls: var(--u4-stalls-img) repeat-x 50% 100% / auto var(--u4-bh);
  --u4-lamps-img: ${P};
  --u4-lamps: var(--u4-lamps-img) repeat-x 50% 100% / auto var(--u4-bh);
  --u4-sky: radial-gradient(ellipse 80% 22% at 50% 100%, rgba(255, 120, 90, 0.55), transparent 75%), linear-gradient(180deg, #1c0a42 0%, #34125e 34%, #5e1f76 64%, #8c2f7c 86%, #b3416f 100%);
  --a-bg-run: var(--u4-stalls), var(--u4-sky);
  --a-bg: var(--u4-top), var(--u4-lamps), var(--u4-stalls), var(--u4-sky);
  --a-board: linear-gradient(180deg, rgba(30, 11, 54, 0.96), rgba(15, 5, 32, 0.98));
  --a-frame: #f08ad0;
  --a-glow: rgba(255, 110, 200, 0.38);
}
.board-market .run-active .bg { background: var(--a-bg-run); }
.board-market .run-active .bg::after { display: block; left: 0; right: 0; bottom: 0; height: var(--u4-bh); background: var(--u4-lamps-img) repeat-x 50% 100% / auto 100%; animation: u4Pulse 3.2s ease-in-out infinite alternate; }
/* a string of bulbs round the board */
.board-market .board::after { background:
    radial-gradient(circle at 50% 50%, #fff4c8 0 1.4px, #ffc84a 2.1px, rgba(255, 150, 60, 0.5) 3.2px, transparent 4.4px) 0 3px / 20px 9px repeat-x,
    radial-gradient(circle at 50% 50%, #ffe0f4 0 1.4px, #ff8ad8 2.1px, rgba(255, 90, 200, 0.5) 3.2px, transparent 4.4px) 10px calc(100% - 3px) / 20px 9px repeat-x,
    radial-gradient(circle at 50% 50%, #ffe0f4 0 1.4px, #ff8ad8 2.1px, rgba(255, 90, 200, 0.5) 3.2px, transparent 4.4px) 3px 10px / 9px 20px repeat-y,
    radial-gradient(circle at 50% 50%, #fff4c8 0 1.4px, #ffc84a 2.1px, rgba(255, 150, 60, 0.5) 3.2px, transparent 4.4px) calc(100% - 3px) 0 / 9px 20px repeat-y;
  box-shadow: inset 0 0 0 1px rgba(255, 160, 225, 0.3), inset 0 0 20px rgba(255, 110, 200, 0.12); }
.board-market .run-active .bg::before { display: block; left: -30px; right: -30px; top: 0; height: var(--u4-th); background: var(--u4-top-img) repeat-x 50% 0 / auto 100%; transform-origin: 50% -40px; will-change: transform; animation: u4Swing 6.5s ease-in-out infinite alternate; }

/* badges, previews and the reveal: a brighter sky and a more see-through board so the scene still reads at 56px */
:is(.bdg-scene, .hero-board, .mini-board).board-market { --u4-sky: linear-gradient(180deg, #3e166e 0%, #922e92 52%, #ff806e 100%); --a-board: linear-gradient(180deg, rgba(34, 12, 60, 0.78), rgba(16, 5, 34, 0.86)); }
`;
}
