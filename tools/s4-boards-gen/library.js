// Grand Library (Common): walnut shelves of leather spines, a rolling ladder, a round moon window, a candlelit reading desk, drifting dust.
// Pieces are separate pictures so they can be placed from the board's variables (see lib.js): the shelf tile and the desk tile repeat,
// the window, ladder, candle, open book, ink and quill and the stack of books each appear once.
const L = require('./lib');
const { S, n, mix, lighten, darken, rngOf, svgc, glowDef, bgPiece, registry, boxCSS, bgTile, url } = L;

const WAL = { hi: '#a8703a', base: '#5a3418', lo: '#2c170a' };
const GOLD = '#e8b85a', CANDLE = '#ffcf6b';
const SPINES = ['#6e2233', '#21503d', '#1f3d57', '#8a5a2e', '#4d2c19', '#52182a', '#4f5226', '#3d2252', '#7a3a1c', '#1c4a4e', '#62301e'];
const spineDefs = () => SPINES.map((c, i) => `<linearGradient id='s${i}'><stop offset='0' stop-color='${lighten(c, 0.24)}'/><stop offset='.2' stop-color='${lighten(c, 0.08)}'/><stop offset='.65' stop-color='${c}'/><stop offset='1' stop-color='${darken(c, 0.52)}'/></linearGradient>`).join('');
const CSS = '.g{fill:#e8b85a}.v{fill:#e8b85a;opacity:.55}.p{fill:#e9d8a6;opacity:.82}.d{fill:#000;opacity:.34}.r{fill:#fff;opacity:.18}';

/** one standing book: a shaded spine, gold bands, a label or tooling, a rim light and a contact shadow */
function book(x, base, w, h, ci, rnd, lean) {
  const y = base - h, X = n(x), W = n(w), Y = n(y);
  let b = `<path d='M${X} ${n(base)}V${n(y + 1.5)}Q${X} ${Y} ${n(x + 1.5)} ${Y}H${n(x + w - 1.5)}Q${n(x + w)} ${Y} ${n(x + w)} ${n(y + 1.5)}V${n(base)}Z' fill='url(#s${ci})'/>`;
  if (rnd.chance(0.85)) b += `<path class='g' d='M${X} ${n(y + h * 0.1)}h${W}v1.1h-${W}zM${X} ${n(base - h * 0.13)}h${W}v1.1h-${W}z'/><path class='v' d='M${X} ${n(y + h * 0.1 + 2.2)}h${W}v.5h-${W}zM${X} ${n(base - h * 0.13 - 2)}h${W}v.5h-${W}z'/>`;
  if (rnd.chance(0.6) && w > 8) {
    const ly = y + h * rnd.between(0.26, 0.42), lh = Math.min(10, h * 0.24);
    b += `<rect class='${rnd.chance(0.55) ? 'p' : 'd'}' x='${n(x + w * 0.2)}' y='${n(ly)}' width='${n(w * 0.6)}' height='${n(lh)}'/><path class='g' d='M${n(x + w * 0.3)} ${n(ly + lh * 0.3)}h${n(w * 0.4)}v.6h-${n(w * 0.4)}zM${n(x + w * 0.3)} ${n(ly + lh * 0.62)}h${n(w * 0.4)}v.6h-${n(w * 0.4)}z'/>`;
  } else if (w > 7) b += `<path class='v' d='M${n(x + w * 0.28)} ${n(y + h * 0.3)}h${n(w * 0.44)}v.7h-${n(w * 0.44)}zM${n(x + w * 0.28)} ${n(y + h * 0.42)}h${n(w * 0.44)}v.7h-${n(w * 0.44)}zM${n(x + w * 0.28)} ${n(y + h * 0.54)}h${n(w * 0.44)}v.7h-${n(w * 0.44)}z'/>`;
  b += `<rect class='r' x='${n(x + 0.4)}' y='${n(y + 1.5)}' width='.7' height='${n(h - 3)}'/><rect class='d' x='${X}' y='${n(base - 2.4)}' width='${W}' height='2.4'/>`;
  return lean ? `<g transform='rotate(${n(lean)} ${n(x + (lean > 0 ? 0 : w))} ${n(base)})'>${b}</g>` : b;
}

/** a row of books across the tile; gaps are left for props */
function shelfRow(W, base, maxH, rnd) {
  let x = 4, b = ''; const gaps = [];
  while (x < W - 10) {
    if (rnd.chance(0.075) && x > 50 && x < W - 70) { gaps.push(x); x += 30; continue; }
    const w = Math.round(rnd.between(7, 15)), h = Math.round(maxH * rnd.between(0.7, 1));
    b += book(x, base, Math.min(w, W - 6 - x), h, rnd.int(0, SPINES.length - 1), rnd, rnd.chance(0.07) ? rnd.between(-8, 8) : 0);
    x += w + (rnd.chance(0.1) ? 1.5 : 0);
  }
  return { b, gaps };
}

function prop(kind, x, base) {
  const q = (v) => n(v);
  if (kind === 0) return `<path d='M${q(x - 6)} ${base}h12l-2.5-4h-7z' fill='#8a6420'/><rect x='${q(x - 0.8)}' y='${base - 11}' width='1.6' height='8' fill='#b8862e'/><circle cx='${x}' cy='${base - 18}' r='8' fill='url(#glb)'/><path d='M${q(x - 8)} ${base - 18}h16M${x} ${base - 26}v16' stroke='#e8c070' stroke-width='.6' opacity='.7' fill='none'/><ellipse cx='${q(x - 2.6)}' cy='${base - 21}' rx='2.4' ry='1.5' fill='#fff' opacity='.35'/>`;
  if (kind === 1) return `<rect x='${q(x - 6)}' y='${base - 19}' width='12' height='19' rx='2.6' fill='#cfe8ff' opacity='.14'/><circle cx='${x}' cy='${base - 9.5}' r='9' fill='url(#jar)'/><rect x='${q(x - 5)}' y='${base - 22}' width='10' height='3.4' rx='1' fill='#6a4220'/><circle cx='${x}' cy='${base - 9}' r='2' fill='#fff3c0' opacity='.9'/><rect x='${q(x - 5)}' y='${base - 17}' width='1' height='13' fill='#fff' opacity='.3'/>`;
  return [2, 0, 4].map((ci, i) => `<rect x='${q(x - 12 + i * 1.6)}' y='${q(base - (i + 1) * 6)}' width='${q(24 - i * 3.2)}' height='5.6' rx='.9' fill='url(#s${ci})'/><rect class='g' x='${q(x - 12 + i * 1.6)}' y='${q(base - (i + 1) * 6 + 1.8)}' width='${q(24 - i * 3.2)}' height='.7' opacity='.7'/>`).join('');
}

/** the shelf wall: two rows of books on walnut planks, pilasters at the seam and the middle, a crown with a brass rail */
function top() {
  const W = 520, H = 100, rnd = rngOf(41);
  const defs = spineDefs()
    + S.lg('plank', [[0, '#b27a42'], [0.18, WAL.hi], [0.6, WAL.base], [1, WAL.lo]])
    + S.lg('wall', [[0, '#1c0f07'], [1, '#2c1810']])
    + S.lg('crown', [[0, '#120904'], [0.55, '#3a2010'], [1, '#6a4020']])
    + S.lg('pil', [[0, '#2c170a'], [0.3, '#6e4222'], [0.5, '#8a5a30'], [0.72, '#4a2a14'], [1, '#1d0e05']], 0, 0, 1, 0)
    + S.rg('glb', [[0, '#f5d88a'], [0.55, '#c28a2e'], [1, '#6a4310']], 0.38, 0.32, 0.7)
    + S.rg('jar', [[0, '#fff6c8', 0.95], [0.35, '#ffd870', 0.55], [1, '#ffb040', 0]])
    + S.lg('shade', [[0, '#000', 0.6], [1, '#000', 0]]);
  let b = `<rect width='${W}' height='${H}' fill='url(#wall)'/>`;
  [[10, 52], [58, 96]].forEach(([y0, y1]) => { b += `<rect y='${y0}' width='${W}' height='${y1 - y0}' fill='#0e0703' opacity='.55'/><rect y='${y0}' width='${W}' height='10' fill='url(#shade)'/>`; });
  [[51, 38], [95, 38]].forEach(([base, maxH], r) => {
    const row = shelfRow(W, base, maxH, rngOf(100 + r * 17));
    b += row.b;
    row.gaps.forEach((gx, i) => { b += prop((i + r) % 3, gx + 14, base); });
    b += `<rect y='${base}' width='${W}' height='6' fill='url(#plank)'/><rect y='${base}' width='${W}' height='.9' fill='#d9a46a' opacity='.8'/><rect y='${base + 6}' width='${W}' height='3' fill='#000' opacity='.35'/>`;
    for (let i = 0; i < 22; i++) b += `<rect x='${Math.round(rnd.between(0, W))}' y='${n(base + 1.5 + rnd.between(0, 3))}' width='${Math.round(rnd.between(14, 60))}' height='.5' fill='#2c170a' opacity='.45'/>`;
  });
  const pil = (x) => `<rect x='${x - 8}' width='16' height='${H}' fill='url(#pil)'/><rect x='${x - 9.5}' width='19' height='6' fill='#5a3418'/><rect x='${x - 9.5}' y='6' width='19' height='1' class='g' opacity='.7'/><rect x='${x - 9.5}' y='${H - 8}' width='19' height='8' fill='#3a2010'/><rect x='${x - 9.5}' y='${H - 8}' width='19' height='1' class='g' opacity='.6'/>${[-4, 0, 4].map((o) => `<rect x='${x + o - 0.4}' y='10' width='.8' height='${H - 20}' fill='#000' opacity='.28'/>`).join('')}`;
  b += pil(0) + pil(W) + pil(W / 2);
  b += `<rect width='${W}' height='7' fill='url(#crown)'/><rect y='6' width='${W}' height='1.2' class='g' opacity='.8'/><rect y='7.2' width='${W}' height='1.6' fill='#000' opacity='.4'/>`;
  for (let x = 30; x < W; x += 64) b += `<rect x='${x}' y='7' width='1.6' height='4.5' fill='#b8862e'/><circle cx='${x + 0.8}' cy='11.6' r='1.1' class='g'/>`;
  b += `<rect y='11.4' width='${W}' height='1.5' fill='#caa04a'/><rect y='11.4' width='${W}' height='.5' fill='#fff4c8' opacity='.7'/>`;
  return svgc(W, H, b, defs, CSS);
}

/** the round window onto the moon, with a cold light spilling down the shelves */
function windowP() {
  const W = 84, H = 110;
  const defs = S.rg('sk', [[0, '#3a5a9a'], [0.6, '#16295a'], [1, '#0a1233']], 0.5, 0.3, 0.8)
    + S.rg('mn', [[0, '#fffdf2'], [0.7, '#eee4c8'], [1, '#c9bb98']], 0.38, 0.36, 0.7)
    + glowDef('mh', '#bcd4ff', 0.6, 0.18)
    + S.lg('cone', [[0, '#a8c8ff', 0.3], [1, '#a8c8ff', 0]])
    + S.lg('fr', [[0, '#c28a46'], [0.5, '#6a3f1c'], [1, '#2a150a']], 0, 0, 1, 1)
    + S.lg('br', [[0, '#fff0b0'], [0.4, '#d9a441'], [1, '#6a4a10']], 0, 0, 1, 1);
  let b = `<path d='M24 54L2 110H82L60 54Z' fill='url(#cone)'/>`;
  b += `<circle cx='42' cy='34' r='34' fill='#000' opacity='.35'/>`;
  b += `<circle cx='42' cy='34' r='30' fill='url(#fr)'/><circle cx='42' cy='34' r='25.6' fill='url(#br)'/><circle cx='42' cy='34' r='23.4' fill='url(#sk)'/>`;
  const rnd = rngOf(5);
  for (let i = 0; i < 14; i++) { const a = rnd.between(0, 6.28), r = rnd.between(2, 21); b += `<circle cx='${n(42 + Math.cos(a) * r)}' cy='${n(34 + Math.sin(a) * r)}' r='${n(rnd.between(0.35, 0.9))}' fill='#fff' opacity='${n(rnd.between(0.5, 1))}'/>`; }
  b += `<circle cx='37' cy='29' r='16' fill='url(#mh)'/><circle cx='37' cy='29' r='8.6' fill='url(#mn)'/>`;
  b += `<circle cx='34' cy='27' r='1.9' fill='#b8aa86' opacity='.5'/><circle cx='40.4' cy='32' r='1.4' fill='#b8aa86' opacity='.45'/><circle cx='36' cy='33.6' r='1' fill='#b8aa86' opacity='.4'/>`;
  b += `<path d='M22 42Q30 37 38 41Q46 37 56 42Q64 40 64 46H22Z' fill='#0a1233' opacity='.55'/>`;
  b += `<path d='M42 11V57M19 34H65' stroke='#2a150a' stroke-width='3.2'/><path d='M42 11V57M19 34H65' stroke='#e8b85a' stroke-width='1.3'/><circle cx='42' cy='34' r='3' fill='#e8b85a'/><circle cx='42' cy='34' r='1.2' fill='#fff4c8'/>`;
  b += `<path d='M22 22A24 24 0 0 1 50 11' stroke='#fff' stroke-width='1.4' stroke-linecap='round' fill='none' opacity='.4'/>`;
  b += `<path d='M14 70H70L74 76H10Z' fill='#6a3f1c'/><path d='M14 70H70' stroke='#d9a46a' stroke-width='.9'/>`;
  return svgc(W, H, b, defs, '');
}

/** the rolling ladder (leans on the brass rail) */
function ladder() {
  const W = 30, H = 104;
  const defs = S.lg('rl', [[0, '#c28a46'], [0.4, '#7a4a22'], [1, '#2a150a']], 0, 0, 1, 0);
  let b = `<path d='M9 0L2 104H7.5L14 0Z' fill='url(#rl)'/><path d='M19 0L27 104H21.5L14.6 0Z' fill='url(#rl)'/>`;
  for (let i = 0; i < 8; i++) { const y = 12 + i * 12.4, t = y / 104, xl = 9 - 7 * t, xr = 19 + 8 * t; b += `<rect x='${n(xl)}' y='${n(y)}' width='${n(xr - xl)}' height='2.8' fill='#8a5a30'/><rect x='${n(xl)}' y='${n(y)}' width='${n(xr - xl)}' height='.8' fill='#e0b078'/>`; }
  b += `<path d='M5 0V6M24 0V6' stroke='#e8b85a' stroke-width='2.2'/><path d='M4 -2h22' stroke='#caa04a' stroke-width='2.5'/><circle cx='4.5' cy='101' r='2.6' fill='#2a150a'/><circle cx='25.5' cy='101' r='2.6' fill='#2a150a'/>`;
  return svgc(W, H, b, defs, '');
}

/** the desk: a walnut top in perspective with a moulded front edge */
function desk() {
  const W = 520, H = 120, rnd = rngOf(77);
  const defs = S.lg('top', [[0, '#3a2010'], [0.5, '#5a3418'], [1, '#6e4022']])
    + S.lg('face', [[0, '#40220f'], [1, '#170b04']])
    + S.lg('fade', [[0, '#0a0503', 0], [1, '#0a0503', 0.8]]);
  let b = `<rect y='28' width='${W}' height='10' fill='url(#fade)'/><rect y='38' width='${W}' height='64' fill='url(#top)'/>`;
  [48, 60, 74, 90].forEach((y) => { b += `<rect y='${y}' width='${W}' height='1.1' fill='#1a0b04' opacity='.7'/><rect y='${y + 1.1}' width='${W}' height='.6' fill='#c28a52' opacity='.28'/>`; });
  for (let i = 0; i < 46; i++) { const y = rnd.between(40, 100), w = rnd.between(18, 90), x = rnd.between(0, W - w); b += `<rect x='${n(x)}' y='${n(y)}' width='${n(w)}' height='.5' fill='${rnd.chance(0.5) ? '#1a0b04' : '#c28a52'}' opacity='${n(rnd.between(0.14, 0.4))}'/>`; }
  b += `<rect y='100' width='${W}' height='2.4' fill='#c28a52'/><rect y='100' width='${W}' height='.8' fill='#ffe0a8' opacity='.8'/><rect y='102.4' width='${W}' height='18' fill='url(#face)'/>`;
  for (let x = 12; x < W; x += 130) b += `<rect x='${x}' y='106' width='116' height='10' rx='3' fill='#0e0703' opacity='.6'/><rect x='${x + 0.6}' y='106.6' width='114.8' height='8.8' rx='2.6' fill='none' stroke='#e8b85a' stroke-width='.7' opacity='.55'/>`;
  return svgc(W, H, b, defs, '');
}

/** the candlestick (brass) with a wax candle and a flame */
function candle() {
  const W = 44, H = 96;
  const defs = S.lg('bs', [[0, '#6a4a10'], [0.3, '#f0d070'], [0.55, '#c8982e'], [1, '#4a3008']], 0, 0, 1, 0)
    + S.lg('wx', [[0, '#c8b890'], [0.35, '#fff6dc'], [1, '#a89870']], 0, 0, 1, 0)
    + S.rg('fl', [[0, '#fffbe8'], [0.35, '#ffe27a'], [0.75, '#ff9a2e'], [1, '#e8561a', 0.9]], 0.5, 0.62, 0.55)
    + glowDef('gl', '#ffb84a', 0.85, 0.28);
  let b = `<ellipse cx='22' cy='92' rx='17' ry='3.6' fill='#000' opacity='.42'/>`;
  b += `<path d='M8 90Q8 84 14 83H30Q36 84 36 90Z' fill='url(#bs)'/><path d='M18 83L20 58H24L26 83Z' fill='url(#bs)'/><ellipse cx='22' cy='64' rx='7' ry='2.2' fill='url(#bs)'/><path d='M12 57Q13 64 22 66Q31 64 32 57Z' fill='url(#bs)'/><path d='M10 56H34' stroke='#fff0b0' stroke-width='1.4' opacity='.8' stroke-linecap='round'/>`;
  b += `<path d='M16 56V30Q16 28 18 28H26Q28 28 28 30V56Z' fill='url(#wx)'/><path d='M16 30Q22 33 28 30' stroke='#fff' stroke-width='1.2' fill='none' opacity='.5'/><path d='M18 30Q17 36 18.6 40Q20 36 19.4 31Z' fill='#fff6dc'/><path d='M26 31Q27.2 38 25.6 44Q24.4 38 25 31Z' fill='#e8dcb4'/>`;
  b += `<path d='M22 28V22' stroke='#3a2a1a' stroke-width='1.1'/>`;
  b += `<circle cx='22' cy='18' r='17' fill='url(#gl)'/>`;
  b += `<path d='M22 2Q28 12 27 17Q27 24 22 24Q17 24 17 17Q16 12 22 2Z' fill='url(#fl)'/><path d='M22 9Q25 15 24.4 18.6Q24 22 22 22Q20 22 19.6 18.6Q19 15 22 9Z' fill='#fffbe8' opacity='.9'/>`;
  return svgc(W, H, b, defs, '');
}

/** an open book (slightly in perspective), a red ribbon, page lines */
function openBook() {
  const W = 104, H = 56;
  const defs = S.lg('pgL', [[0, '#e8d9b0'], [0.85, '#fff4d4'], [1, '#d8c490']], 0, 0, 1, 0)
    + S.lg('pgR', [[0, '#d8c490'], [0.15, '#fff4d4'], [1, '#e8d9b0']], 0, 0, 1, 0)
    + S.lg('cv', [[0, '#7a2a3a'], [1, '#3a0e1a']]);
  let b = `<ellipse cx='52' cy='50' rx='46' ry='5.4' fill='#000' opacity='.42'/>`;
  b += `<path d='M4 24L52 30L100 24L100 44L52 50L4 44Z' fill='url(#cv)'/><path d='M4 44L52 50L100 44L100 46.4L52 52.6L4 46.4Z' fill='#2a0912'/>`;
  b += `<path d='M7 20Q30 16 52 26L52 46Q30 38 7 41Z' fill='url(#pgL)'/><path d='M97 20Q74 16 52 26L52 46Q74 38 97 41Z' fill='url(#pgR)'/>`;
  b += `<path d='M7 41Q30 38 52 46Q74 38 97 41' stroke='#a89868' stroke-width='.8' fill='none'/><path d='M7 42.6Q30 39.6 52 47.6Q74 39.6 97 42.6' stroke='#c8b888' stroke-width='.6' fill='none' opacity='.7'/>`;
  for (let i = 0; i < 7; i++) { const t = i / 6, y = 24 + t * 14; b += `<path d='M13 ${n(y - 1.4)}Q30 ${n(y - 5)} 47 ${n(y + 3)}' stroke='#5a4a2a' stroke-width='.7' fill='none' opacity='.55'/><path d='M91 ${n(y - 1.4)}Q74 ${n(y - 5)} 57 ${n(y + 3)}' stroke='#5a4a2a' stroke-width='.7' fill='none' opacity='.55'/>`; }
  b += `<path d='M44 24V6' stroke='none'/><path d='M52 26L53 40L51 40Z' fill='#b02a3a'/><path d='M52 46L56 54L52 51L48 54Z' fill='#d03a4a'/>`;
  b += `<path d='M30 18Q52 22 74 18' stroke='#fff' stroke-width='.8' fill='none' opacity='.0'/>`;
  return svgc(W, H, b, defs, '');
}

/** an inkwell with a feather quill */
function quill() {
  const W = 66, H = 64;
  const defs = S.lg('ink', [[0, '#1a1a2e'], [0.4, '#3a4a78'], [1, '#0a0a18']], 0, 0, 1, 0) + S.lg('fe', [[0, '#fffdf4'], [1, '#d8c9a0']], 0, 0, 1, 0);
  let b = `<ellipse cx='28' cy='58' rx='18' ry='3.4' fill='#000' opacity='.42'/>`;
  b += `<path d='M10 56Q8 44 16 38H40Q48 44 46 56Q28 60 10 56Z' fill='url(#ink)'/><ellipse cx='28' cy='38' rx='12.4' ry='3' fill='#0a0a18'/><ellipse cx='28' cy='37.6' rx='10.4' ry='2' fill='#26346a'/><path d='M14 52Q12 44 18 41' stroke='#aac0ff' stroke-width='1.2' fill='none' opacity='.5' stroke-linecap='round'/><rect x='20' y='34' width='16' height='3' rx='1.4' fill='#8a6a20'/>`;
  b += `<path d='M30 36L58 4' stroke='#e8dcb4' stroke-width='1.6' stroke-linecap='round'/><path d='M36 28C40 14 50 6 61 3C60 14 54 24 44 30Z' fill='url(#fe)'/><path d='M36 28L60 4' stroke='#b8a878' stroke-width='.9'/>`;
  for (let i = 0; i < 7; i++) { const t = (i + 1) / 8, x = 36 + t * 24, y = 28 - t * 24; b += `<path d='M${n(x)} ${n(y)}l${n(-5 - t * 2)} ${n(5 + t)}' stroke='#b8a878' stroke-width='.45' opacity='.8'/>`; }
  return svgc(W, H, b, defs, '');
}

/** a short stack of books with a brass key on top */
function stack() {
  const W = 78, H = 58;
  const rnd = rngOf(9);
  let b = `<ellipse cx='39' cy='54' rx='33' ry='4' fill='#000' opacity='.42'/>`;
  [[0, 2, 64, 13, 0], [1, 0, 58, 12, -2], [2, 4, 62, 12, 3], [3, 5, 50, 10, -1]].reverse().forEach(() => {});
  let y = 52;
  [[2, 66, 12, 0], [0, 58, 11, -3], [4, 62, 11, 2], [5, 48, 9, -1]].forEach(([ci, w, h, dx]) => {
    y -= h; const x = 39 - w / 2 + dx;
    b += `<rect x='${n(x)}' y='${n(y)}' width='${w}' height='${h}' rx='1.6' fill='url(#s${ci})' transform='rotate(0)'/><rect x='${n(x + 2)}' y='${n(y + 2)}' width='${w - 4}' height='${h - 4}' fill='#f2e6c4'/><rect x='${n(x)}' y='${n(y)}' width='${n(w * 0.12)}' height='${h}' rx='1.6' fill='url(#s${ci})'/><rect class='g' x='${n(x + w * 0.04)}' y='${n(y + h * 0.3)}' width='${n(w * 0.08)}' height='1' opacity='.8'/><rect x='${n(x + w * 0.1)}' y='${n(y)}' width='${n(w * 0.9)}' height='1' fill='#fff' opacity='.22'/>`;
  });
  b += `<circle cx='28' cy='${y - 3}' r='3.4' fill='none' stroke='#e8b85a' stroke-width='1.6'/><path d='M31 ${y - 3}H46M42 ${y - 3}v4M45 ${y - 3}v3' stroke='#e8b85a' stroke-width='1.6' stroke-linecap='round'/>`;
  return svgc(W, H, b, spineDefs(), CSS);
}

/** the floating book (a moving layer): an open book on a cushion of light, with sparkles */
function floatBook() {
  const W = 56, H = 44;
  const defs = glowDef('hl', '#ffe9a8', 0.8, 0.25) + S.lg('pg', [[0, '#fff8e0'], [1, '#e8d49c']], 0, 0, 1, 0);
  let b = `<ellipse cx='28' cy='26' rx='26' ry='16' fill='url(#hl)'/>`;
  b += `<path d='M4 26Q16 20 28 28V40Q16 33 4 38Z' fill='#7a2a3a'/><path d='M52 26Q40 20 28 28V40Q40 33 52 38Z' fill='#5a1a2a'/>`;
  b += `<path d='M5 22Q16 16 28 24V36Q16 29 5 34Z' fill='url(#pg)'/><path d='M51 22Q40 16 28 24V36Q40 29 51 34Z' fill='url(#pg)'/>`;
  [0, 1, 2, 3].forEach((i) => { b += `<path d='M9 ${24 + i * 2.6}Q16 ${21 + i * 2.6} 24 ${27 + i * 2.2}M47 ${24 + i * 2.6}Q40 ${21 + i * 2.6} 32 ${27 + i * 2.2}' stroke='#8a6a3a' stroke-width='.6' fill='none' opacity='.6'/>`; });
  b += `<path d='M28 24V37' stroke='#a89060' stroke-width='.8'/>`;
  [[9, 12, 1.4], [46, 9, 1.1], [20, 5, 0.9], [38, 4, 1.2], [52, 20, 0.8]].forEach(([x, y, r]) => { b += `<path d='M${x} ${y - r * 2.2}L${n(x + r * 0.5)} ${y - r * 0.5}L${n(x + r * 2.2)} ${y}L${n(x + r * 0.5)} ${n(y + r * 0.5)}L${x} ${n(y + r * 2.2)}L${n(x - r * 0.5)} ${n(y + r * 0.5)}L${n(x - r * 2.2)} ${y}L${n(x - r * 0.5)} ${n(y - r * 0.5)}Z' fill='#fff6c8'/>`; });
  return svgc(W, H, b, defs, '');
}

/** dust motes in candlelight (the tile for the moving .scene-fx layer, wraps vertically) */
function motes() {
  const W = 260, H = 520, rnd = rngOf(3);
  const defs = glowDef('m', '#ffe9b0', 0.9, 0.3);
  let b = '';
  for (let i = 0; i < 26; i++) {
    const x = rnd.between(6, W - 6), y = rnd.between(0, H), r = rnd.between(1.1, 3.6), a = n(rnd.between(0.18, 0.7));
    [0, -H].concat(y < 20 ? [H] : []).forEach((dy) => { b += `<circle cx='${n(x)}' cy='${n(y + dy)}' r='${n(r * 2.6)}' fill='url(#m)' opacity='${a}'/><circle cx='${n(x)}' cy='${n(y + dy)}' r='${n(r * 0.5)}' fill='#fff6d0' opacity='${n(+a + 0.25)}'/>`; });
  }
  return svgc(W, H, b, defs, '');
}

/** a quiet damask wallpaper: a gold lattice with small flowers (the wall behind the HUD) */
function wallpaper() {
  const W = 64, H = 64;
  let b = `<path d='M0 32L32 0L64 32L32 64Z' fill='none' stroke='#e8b85a' stroke-width='.8' opacity='.14'/><path d='M-32 32L0 0M64 0L96 32M-32 32L0 64M64 64L96 32' stroke='#e8b85a' stroke-width='.8' opacity='.14'/>`;
  const flower = (x, y, o) => `<g transform='translate(${x} ${y})' opacity='${o}' fill='#e8b85a'><circle r='1.4'/>${[0, 90, 180, 270].map((a) => `<ellipse cx='0' cy='-4' rx='1.5' ry='3' transform='rotate(${a})'/>`).join('')}</g>`;
  b += flower(32, 32, 0.2) + flower(0, 0, 0.14) + flower(64, 0, 0.14) + flower(0, 64, 0.14) + flower(64, 64, 0.14);
  b += `<circle cx='16' cy='16' r='1' fill='#e8b85a' opacity='.16'/><circle cx='48' cy='16' r='1' fill='#e8b85a' opacity='.16'/><circle cx='16' cy='48' r='1' fill='#e8b85a' opacity='.16'/><circle cx='48' cy='48' r='1' fill='#e8b85a' opacity='.16'/>`;
  return svgc(W, H, b, '', '');
}
/** a fluted walnut pilaster segment (repeats down the sides of the room) */
function pillar() {
  const W = 12, H = 48;
  const defs = S.lg('pl', [[0, '#1d0e05'], [0.22, '#6e4222'], [0.45, '#9a6232'], [0.7, '#4a2a14'], [1, '#150a04']], 0, 0, 1, 0);
  let b = `<rect width='12' height='48' fill='url(#pl)'/>`;
  [3.6, 6, 8.4].forEach((x) => { b += `<rect x='${x}' width='.8' height='48' fill='#000' opacity='.35'/><rect x='${x + 0.8}' width='.5' height='48' fill='#e0b078' opacity='.18'/>`; });
  b += `<rect y='0' width='12' height='1' fill='#e8b85a' opacity='.5'/><rect y='47' width='12' height='1' fill='#000' opacity='.4'/>`;
  return svgc(W, H, b, defs, '');
}
/** the brass corner of the frame (top-left; mirrored by cornerCaps) */
function capDraw() {
  const defs = S.lg('cg', [[0, '#fff0b0'], [0.35, '#e0aa44'], [0.7, '#9a6a1e'], [1, '#4a3008']], 0, 0, 1, 1) + S.rg('bo', [[0, '#fff8d0'], [0.4, '#e8b85a'], [1, '#6a4a10']], 0.36, 0.34, 0.7);
  let b = `<path d='M0 44V33A33 33 0 0 1 33 0H44V9H33A24 24 0 0 0 9 33V44Z' fill='url(#cg)'/>`;
  b += `<path d='M0 44V33A33 33 0 0 1 33 0H44' fill='none' stroke='#fff6c8' stroke-width='.9' opacity='.8'/><path d='M44 9H33A24 24 0 0 0 9 33V44' fill='none' stroke='#3a2606' stroke-width='.9' opacity='.8'/>`;
  b += `<path d='M5 38Q5 18 18 5' fill='none' stroke='#3a2606' stroke-width='.8' opacity='.5'/><path d='M38 5Q18 5 5 18' fill='none' stroke='#3a2606' stroke-width='.8' opacity='.0'/>`;
  b += `<circle cx='12.7' cy='12.7' r='4.2' fill='url(#bo)'/><circle cx='12.7' cy='12.7' r='1.5' fill='#7a1f2e'/><circle cx='11.9' cy='11.9' r='.6' fill='#ffd0d8'/>`;
  [[36, 4.6], [4.6, 36]].forEach(([x, y]) => { b += `<circle cx='${x}' cy='${y}' r='1.5' fill='#fff0b0' opacity='.9'/><circle cx='${x}' cy='${y}' r='.6' fill='#7a5010'/>`; });
  return { defs, body: b };
}

// ---------------------------------------------------------------------------------------------------------------- css
function css() {
  const th = 'var(--s4-th)', bh = 'var(--s4-bh)', K = (v, k) => `calc(${v} * ${k})`;
  const P = {
    window: { fx: 0.1, band: 'top', h: K(th, 1.05), a: 84 / 110, dy: K(th, 0.04) },
    ladder: { fx: -0.34, band: 'top', h: K(th, 1.0), a: 30 / 104, dy: K(th, 0.06) },
    float: { fx: 0.36, band: 'top', h: K(th, 0.4), a: 56 / 44, dy: K(th, 0.3) },
    candle: { fx: -0.455, band: 'bottom', h: K(bh, 0.86), a: 44 / 96, dy: K(bh, 0.1) },
    book: { fx: -0.15, band: 'bottom', h: K(bh, 0.4), a: 104 / 56, dy: K(bh, 0.08) },
    quill: { fx: 0.2, band: 'bottom', h: K(bh, 0.42), a: 66 / 64, dy: K(bh, 0.08) },
    stack: { fx: 0.42, band: 'bottom', h: K(bh, 0.42), a: 78 / 58, dy: K(bh, 0.09) },
  };
  const R = registry('library');
  const svg = { top: top(), desk: desk(), window: windowP(), ladder: ladder(), float: floatBook(), candle: candle(), book: openBook(), quill: quill(), stack: stack(), motes: motes(), wall: wallpaper(), pillar: pillar() };
  const ref = {}; Object.keys(svg).forEach((k) => { ref[k] = R.add(k, svg[k]); });
  const caps = L.cornerCaps(R, 'lib', capDraw);
  const pil = (s) => `${ref.pillar} repeat-y calc(var(--s4-cx) ${s} var(--s4-cw) / 2 ${s} 6px) 0 / 12px auto`;
  const paper = `${ref.wall} repeat 50% 0 / 64px auto`;
  const tTop = bgTile(ref.top, 'top', th), tDesk = bgTile(ref.desk, 'bottom', bh);
  const pc = (k) => bgPiece(ref[k], P[k]);
  const halo = 'radial-gradient(ellipse 46% 42% at calc(var(--s4-cx) - var(--s4-cw) * 0.455) 96%, rgba(255, 170, 80, 0.55), rgba(255, 130, 50, 0.16) 55%, transparent 80%)';
  const lamp = 'radial-gradient(ellipse 70% 34% at 50% 0%, rgba(255, 190, 110, 0.22), transparent 72%)';
  const moonlight = 'radial-gradient(ellipse 30% 34% at calc(var(--s4-cx) + var(--s4-cw) * 0.1) 0%, rgba(150, 190, 255, 0.2), transparent 70%)';
  const wall = 'linear-gradient(180deg, #1c0f07 0%, #24140a 38%, #1b0f07 70%, #110a05 100%)';
  const warm = 'radial-gradient(ellipse 110% 38% at 50% 100%, rgba(255, 140, 50, 0.16), transparent 75%)';
  const rest = [halo, pc('candle'), pc('book'), pc('quill'), pc('stack'), tDesk, moonlight, pc('window'), pc('ladder'), tTop, lamp, warm, pil('-'), pil('+'), paper, wall];
  const bg = [halo, pc('candle'), pc('book'), pc('quill'), pc('stack'), tDesk, moonlight, pc('window'), pc('ladder'), pc('float'), tTop, lamp, warm, pil('-'), pil('+'), paper, wall];
  return {
    plate: [20, 10, 4, 0.62],
    vars: `
  --a-bg: ${bg.join(',\n    ')};
  --a-bg-run: ${rest.join(',\n    ')};
  --a-board: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.018) 0.7px, transparent 1.1px) 0 0 / 4px 4px, linear-gradient(180deg, #0b1a13, #060e0a);
  --a-frame: #d6a24a;
  --a-glow: rgba(255, 170, 80, 0.3);${R.decls()}`,
    run: `
.board-library .run-active .bg::before { display: block; ${boxCSS(P.float)} background: ${ref.float} no-repeat center / 100% 100%; will-change: transform; animation: s4Bob 5.2s ease-in-out infinite alternate; }
.board-library .run-active .bg .scene-fx { display: block; height: calc(100% + 520px); background-image: ${ref.motes}; background-size: 260px 520px; animation: s4Rise 90s linear infinite; opacity: 0.9; }
.board-library .run-active .bg .scene-fx.b { display: none; }
`,
    frame: L.frameCSS('board-library', {
      ring: [[1.5, '#170b04'], [5, '#5a3418'], [6, '#b8763a'], [8, '#2c170a'], [9, '#e8b85a']],
      tooled: 'inset 0 0 0 1.4px rgba(224, 172, 84, 0.7), inset 0 0 0 3px rgba(0, 0, 0, 0.35), inset 0 0 0 4.4px rgba(224, 172, 84, 0.4)',
      caps: { tl: R.ref('captl'), tr: R.ref('captr'), bl: R.ref('capbl'), br: R.ref('capbr') },
      glow: 'rgba(255, 170, 80, 0.3)',
    }),
  };
}
module.exports = { top, windowP, ladder, desk, candle, openBook, quill, stack, floatBook, motes, GOLD, CANDLE, css };
