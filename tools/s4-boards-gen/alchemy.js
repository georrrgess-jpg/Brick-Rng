// Alchemy Lab (Epic): a stone laboratory. Shelves of glowing flasks and copper pipes with an alembic coil above, a cauldron bubbling green-gold
// over a fire below. The flasks' glow breathes and bubbles rise. Moments (js/s4-scenes.js): a Line Blast boils the cauldron over, Rush lights
// every flask and glows the pipes, a stage-up sends a drop down the pipe into the cauldron.
const L = require('./lib');
const { S, n, mix, lighten, darken, rngOf, svgc, glowDef, bgPiece, registry, boxCSS, bgTile, url } = L;

const CU = { hi: '#f6b074', base: '#c46a2f', lo: '#6a3010', deep: '#2a1206' };
const EM = '#3dffa0', GOLDG = '#c8ff6a';
const LIQ = ['#3dffa0', '#ffb347', '#ff5fb8', '#4de1ff', '#a47aff', '#c8ff6a', '#ff6a4d'];

/** the four glassware shapes, drawn once with their feet at the origin; the liquid takes `color` through currentColor */
function ware() {
  const hi = (d) => `<path d='${d}' stroke='#fff' stroke-width='1.1' fill='none' opacity='.55' stroke-linecap='round'/>`;
  const liquid = (d) => `<path d='${d}' fill='currentColor'/><path d='${d}' fill='url(#ls)'/>`;
  return `<g id='fr'><path d='M-2.6 -32V-20.5A10.5 10.5 0 1 0 2.6 -20.5V-32Z' fill='#cfe8ff' opacity='.2'/>${liquid('M-10.06 -13A10.5 10.5 0 1 0 10.06 -13Q5 -14.6 0 -13T-10.06 -13Z')}<path d='M-2.6 -32V-20.5A10.5 10.5 0 1 0 2.6 -20.5V-32Z' fill='none' stroke='#dff4ff' stroke-width='.9' opacity='.7'/>${hi('M-8 -7Q-9 -12 -6 -16')}<rect x='-3.3' y='-35.6' width='6.6' height='4.4' rx='1' fill='#8a5a2e'/></g>`
    + `<g id='er'><path d='M-2.4 -34V-22L-11 -2Q-11.6 0 -9 0H9Q11.6 0 11 -2L2.4 -22V-34Z' fill='#cfe8ff' opacity='.2'/>${liquid('M-9.4 -6.4Q-4 -8 0 -6.4T9.4 -6.4L11 -2Q11.6 0 9 0H-9Q-11.6 0 -11 -2Z')}<path d='M-2.4 -34V-22L-11 -2Q-11.6 0 -9 0H9Q11.6 0 11 -2L2.4 -22V-34Z' fill='none' stroke='#dff4ff' stroke-width='.9' opacity='.7'/>${hi('M-4 -26L-9 -6')}<rect x='-3.1' y='-37' width='6.2' height='4' rx='1' fill='#8a5a2e'/></g>`
    + `<g id='tb'><path d='M-4 -34V-4Q-4 0 0 0Q4 0 4 -4V-34Z' fill='#cfe8ff' opacity='.2'/>${liquid('M-4 -18Q0 -19.6 4 -18V-4Q4 0 0 0Q-4 0 -4 -4Z')}<path d='M-4 -34V-4Q-4 0 0 0Q4 0 4 -4V-34' fill='none' stroke='#dff4ff' stroke-width='.9' opacity='.7'/>${hi('M-2.2 -30V-6')}<rect x='-4.4' y='-35.4' width='8.8' height='3' rx='1' fill='#8a5a2e'/></g>`
    + `<g id='bk'><path d='M-8 -22V-2Q-8 0 -6 0H6Q8 0 8 -2V-22Z' fill='#cfe8ff' opacity='.2'/>${liquid('M-8 -11Q-4 -12.6 0 -11T8 -11V-2Q8 0 6 0H-6Q-8 0 -8 -2Z')}<path d='M-8 -22V-2Q-8 0 -6 0H6Q8 0 8 -2V-22M-8 -22L-10 -24' fill='none' stroke='#dff4ff' stroke-width='.9' opacity='.7'/>${hi('M-5.6 -18V-4')}</g>`;
}
const wareDefs = () => S.lg('ls', [[0, '#fff', 0.38], [0.5, '#fff', 0], [1, '#000', 0.4]], 0, 0, 1, 0) + ware();
const flaskUse = (id, x, y, s, c) => `<use href='#${id}' transform='translate(${n(x)} ${n(y)}) scale(${n(s)})' color='${c}'/>`;

/** the flasks' places in the shelf tile (shared by the picture and its glow layers) */
function flasks() {
  const rnd = rngOf(88), out = [];
  [[50, 1], [95, 1]].forEach(([base, row]) => {
    let x = 44 + rnd.between(0, 14);
    while (x < 480) {
      const kinds = ['fr', 'er', 'tb', 'bk'], k = rnd.pick(kinds), s = rnd.between(0.9, 1.18), c = rnd.pick(LIQ);
      out.push({ k, x, y: base, s, c });
      x += 20 + rnd.between(6, 20) + (k === 'tb' ? -4 : 0);
    }
  });
  return out.filter((f) => !(f.y < 60 && ((f.x > 232 && f.x < 288) || (f.x > 34 && f.x < 88) || (f.x > 432 && f.x < 488))));   // leave the alembic and the coils their places
}

function top() {
  const W = 520, H = 100, rnd = rngOf(19);
  const defs = wareDefs() + S.lg('bm', [[0, '#1a110c'], [1, '#0a0605']]) + S.lg('cu', [[0, CU.hi], [0.3, CU.base], [1, CU.lo]]) + S.lg('wd', [[0, '#3a281c'], [1, '#17100b']])
    + glowDef('sm', '#b8a8e0', 0.5, 0.16) + S.lg('br', [[0, '#5a2e12'], [0.5, '#c46a2f'], [1, '#6a3010']], 0, 0, 0, 1)
    + `<g id='cl'>${[0, 1, 2, 3, 4].map((k) => `<path d='M-15 ${k * 7}A15 4.4 0 0 1 15 ${k * 7}' fill='none' stroke='#3a1a08' stroke-width='3'/>`).join('')}${[0, 1, 2, 3, 4].map((k) => `<path d='M-15 ${k * 7}A15 4.4 0 0 0 15 ${k * 7}' fill='none' stroke='url(#cu)' stroke-width='3.2'/><path d='M-14 ${k * 7 + 1.4}A14 3.4 0 0 0 14 ${k * 7 + 1.4}' fill='none' stroke='#ffd9a8' stroke-width='.7' opacity='.7'/>`).join('')}<path d='M15 28V40M-15 0V-10' stroke='url(#cu)' stroke-width='3.2'/></g>`;
  let b = `<rect width='${W}' height='${H}' fill='#140d0a' opacity='0'/>`;
  // beam with hanging herbs
  b += `<rect width='${W}' height='9' fill='url(#bm)'/><rect y='9' width='${W}' height='1.2' fill='#000' opacity='.5'/>`;
  for (let i = 0; i < 9; i++) { const x = 20 + i * 60 + rnd.between(-10, 10), l = rnd.between(8, 16); b += `<path d='M${n(x)} 9v3' stroke='#6a4a28'/><path d='M${n(x - 3)} 12Q${n(x)} ${12 + l} ${n(x + 3)} 12Z' fill='${rnd.pick(['#4a6a2a', '#6a7a30', '#3a5a2a'])}' opacity='.85'/>`; }
  // the copper pipe along the top, with flanges, a valve and a few rivets
  b += `<rect y='13' width='${W}' height='7' fill='url(#cu)'/><rect y='13' width='${W}' height='1.2' fill='#ffe0b8' opacity='.8'/><rect y='19' width='${W}' height='1.2' fill='#2a1206' opacity='.6'/>`;
  for (let x = 40; x < W; x += 86) b += `<rect x='${x - 3}' y='11.5' width='6' height='10' rx='1' fill='url(#cu)'/><rect x='${x - 3}' y='11.5' width='6' height='1' fill='#ffe0b8' opacity='.7'/><circle cx='${x}' cy='16.5' r='1' fill='#2a1206'/>`;
  b += `<rect x='254' y='3' width='2.4' height='10' fill='#6a3010'/><circle cx='255.2' cy='3' r='5.4' fill='none' stroke='url(#cu)' stroke-width='1.6'/><path d='M250 3H260M255.2 -2V8' stroke='url(#cu)' stroke-width='1.2'/>`;
  // coils at both ends and an alembic in the middle
  b += `<use href='#cl' x='60' y='24'/><use href='#cl' x='460' y='24'/>`;
  b += `<path d='M260 20V28' stroke='url(#cu)' stroke-width='3'/><circle cx='260' cy='44' r='15' fill='url(#cu)'/><circle cx='260' cy='44' r='13' fill='#1a0c05'/><circle cx='260' cy='47' r='11' fill='${EM}' opacity='.9'/><ellipse cx='260' cy='36' rx='8.4' ry='2.4' fill='#9fffd0' opacity='.45'/><circle cx='256' cy='41' r='2.4' fill='#fff' opacity='.35'/><circle cx='264' cy='52' r='1.4' fill='#fff' opacity='.5'/><circle cx='258.4' cy='55' r='1' fill='#fff' opacity='.5'/>`;
  b += `<path d='M244 38Q226 30 214 38V60' stroke='url(#cu)' stroke-width='3' fill='none'/><circle cx='214' cy='60' r='2.4' fill='url(#cu)'/>`;
  // two shelves with the flasks, planks as iron-banded oak
  [[50], [95]].forEach(([base]) => { b += `<rect y='${base}' width='${W}' height='5' fill='url(#wd)'/><rect y='${base}' width='${W}' height='.9' fill='#9a7a58' opacity='.7'/><rect y='${base + 5}' width='${W}' height='2' fill='#000' opacity='.4'/>`; for (let x = 20; x < W; x += 110) b += `<rect x='${x}' y='${base - 1}' width='3' height='9' fill='url(#cu)'/>`; });
  flasks().forEach((f) => { b += flaskUse(f.k, f.x, f.y, f.s, f.c); });
  // small things between: a mortar and pestle, a skull, a stack of tomes
  b += `<path d='M312 50h20q0 -9 -10 -9t-10 9z' fill='#3a3028'/><rect x='320' y='34' width='3' height='14' fill='#8a7a64' transform='rotate(18 322 48)'/>`;
  b += `<ellipse cx='392' cy='44' rx='7' ry='6' fill='#e8e0d0'/><rect x='388' y='46' width='8' height='4' fill='#e8e0d0'/><circle cx='389.6' cy='43' r='1.8' fill='#1a1210'/><circle cx='394.4' cy='43' r='1.8' fill='#1a1210'/>`;
  // steam above the coils
  [[60, 10, 12], [460, 10, 10], [260, 22, 9]].forEach(([x, y, r]) => { b += `<circle cx='${x}' cy='${y}' r='${r}' fill='url(#sm)'/>`; });
  return svgc(W, H, b, defs, '');
}
/** halos behind the flasks and the alembic; k is how bright (the resting glow, then Rush) */
function flaskGlow(k) {
  const W = 520, H = 100;
  const defs = LIQ.map((c, i) => glowDef('g' + i, c, 0.7 * k, 0.28 * k)).join('') + glowDef('ge', EM, 0.7 * k, 0.28 * k) + S.lg('pp', [[0, '#ffb070', 0.9], [1, '#ffb070', 0]]);
  let b = '';
  flasks().forEach((f) => { const ci = LIQ.indexOf(f.c); b += `<circle cx='${n(f.x)}' cy='${n(f.y - 12 * f.s)}' r='${n(24 * f.s)}' fill='url(#g${ci})'/>`; });
  b += `<circle cx='260' cy='46' r='30' fill='url(#ge)'/>`;
  if (k > 1) b += `<rect y='12' width='${W}' height='9' fill='url(#pp)' opacity='.8'/><circle cx='60' cy='38' r='22' fill='url(#pp)'/><circle cx='460' cy='38' r='22' fill='url(#pp)'/>`;
  return svgc(W, H, b, defs, '');
}

/** a stone wall of dark bricks */
function wall() {
  const W = 96, H = 48, rnd = rngOf(4);
  let b = `<rect width='${W}' height='${H}' fill='#1d1614'/>`;
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    const x = c * 48 + (r % 2 ? -24 : 0), y = r * 24;
    [0, 48].forEach((dx) => { b += `<rect x='${x + dx + 0.6}' y='${y + 0.6}' width='46.8' height='22.8' fill='${rnd.pick(['#2a201c', '#241b18', '#2e2420', '#201815'])}' rx='1.5'/><rect x='${x + dx + 0.6}' y='${y + 0.6}' width='46.8' height='1' fill='#fff' opacity='.05'/>`; });
  }
  return svgc(W, H, b, '', '');
}

/** the floor: dark flagstones in a loose perspective, lit warm from the middle */
function floor() {
  const W = 520, H = 120, rnd = rngOf(55);
  const defs = S.lg('fl', [[0, '#1a1210'], [1, '#0a0605']]) + S.lg('fd', [[0, '#0a0605', 0], [1, '#0a0605', 0.7]]);
  let b = `<rect y='40' width='${W}' height='80' fill='url(#fl)'/>`;
  [52, 64, 80, 98].forEach((y, i) => { b += `<rect y='${y}' width='${W}' height='1.2' fill='#000' opacity='.6'/>`; let x = rnd.between(0, 40); while (x < W) { b += `<rect x='${n(x)}' y='${y + 1}' width='1.1' height='${[12, 16, 18, 22][i]}' fill='#000' opacity='.5'/>`; x += rnd.between(52, 110) + i * 14; } });
  for (let i = 0; i < 20; i++) b += `<rect x='${n(rnd.between(0, W))}' y='${n(rnd.between(46, 110))}' width='${n(rnd.between(8, 28))}' height='.6' fill='#fff' opacity='.06'/>`;
  b += `<rect y='24' width='${W}' height='24' fill='url(#fd)' opacity='.0'/>`;
  return svgc(W, H, b, defs, '');
}

/** the cauldron on its fire, a copper pipe feeding it, glowing runes, the brew bubbling at the rim */
function cauldron(plain) {
  const W = 168, H = 120;
  const defs = S.lg('ir', [[0, '#4a4440'], [0.35, '#2a2624'], [1, '#0c0a09']], 0, 0, 1, 0) + S.rg('br', [[0, '#f0ffb0'], [0.35, GOLDG], [0.8, '#40c860'], [1, '#14803a']], 0.5, 0.45, 0.6)
    + glowDef('bg', GOLDG, 0.8, 0.3) + glowDef('fr', '#ff9a3a', 0.9, 0.35) + S.lg('cu', [[0, CU.hi], [0.3, CU.base], [1, CU.lo]])
    + S.lg('fl', [[0, '#fff6c0'], [0.4, '#ffb040'], [1, '#e8401a']], 0, 1, 0, 0);
  let b = `<ellipse cx='84' cy='112' rx='70' ry='7' fill='#000' opacity='.5'/>`;
  b += `<ellipse cx='84' cy='104' rx='58' ry='14' fill='url(#fr)'/>`;
  // flames licking up behind the legs
  [[52, 22, 0.9], [66, 28, 1.1], [84, 32, 1.2], [102, 28, 1.05], [116, 22, 0.9]].forEach(([x, h, s]) => { b += `<path d='M${x} 110Q${x - 7 * s} ${110 - h * 0.5} ${x - 2} ${110 - h}Q${x + 2} ${110 - h * 0.5} ${x + 7 * s} ${110 - h * 0.7}Q${x + 8 * s} 108 ${x} 110Z' fill='url(#fl)'/>`; });
  // legs and the pot
  b += `<path d='M46 90L40 112H50L56 96ZM122 90L128 112H118L112 96Z' fill='#16110f'/>`;
  b += `<path d='M22 52Q20 98 84 102Q148 98 146 52Z' fill='url(#ir)'/>`;
  b += `<path d='M30 66Q34 90 60 98' stroke='#8a8480' stroke-width='1.2' fill='none' opacity='.45' stroke-linecap='round'/>`;
  b += `<path d='M22 62Q84 74 146 62' stroke='url(#cu)' stroke-width='5' fill='none'/><path d='M23 60.6Q84 72.6 145 60.6' stroke='#ffe0b8' stroke-width='.9' fill='none' opacity='.7'/>`;
  [[44, 69], [64, 73], [84, 74.4], [104, 73], [124, 69]].forEach(([x, y]) => { b += `<circle cx='${x}' cy='${y}' r='1.5' fill='#ffd9b0'/><circle cx='${x}' cy='${y}' r='.6' fill='#5a2a0e'/>`; });
  // runes on the belly
  [[56, 84, 'M0 -5L4 3H-4Z'], [84, 88, 'M-4 -4H4M0 -4V5M-3 5H3'], [112, 84, 'M0 -5A5 5 0 1 0 .1 -5M0 -2V4']].forEach(([x, y, d]) => { b += `<path d='${d}' transform='translate(${x} ${y})' stroke='${EM}' stroke-width='1.3' fill='none' opacity='.85' stroke-linecap='round'/><path d='${d}' transform='translate(${x} ${y})' stroke='#d8ffe8' stroke-width='.4' fill='none' opacity='.9'/>`; });
  // the rim and the brew
  b += `<ellipse cx='84' cy='50' rx='66' ry='15' fill='url(#ir)'/><ellipse cx='84' cy='50' rx='66' ry='15' fill='none' stroke='#6a645e' stroke-width='1.6'/><ellipse cx='84' cy='50' rx='61' ry='12.4' fill='#06150c'/>`;
  b += `<ellipse cx='84' cy='51' rx='58' ry='11' fill='url(#br)'/>`;
  [[62, 48, 4], [88, 52, 5.4], [108, 47, 3.6], [76, 55, 3], [98, 55, 2.6], [50, 52, 2.4]].forEach(([x, y, r]) => { b += `<circle cx='${x}' cy='${y}' r='${r}' fill='#e8ffb0' opacity='.55'/><circle cx='${x}' cy='${y}' r='${r}' fill='none' stroke='#fff' stroke-width='.9' opacity='.9'/><circle cx='${x - r * 0.3}' cy='${y - r * 0.3}' r='${n(r * 0.28)}' fill='#fff'/>`; });
  // the copper pipe feeding it from the left
  b += `<path d='M0 36H14Q22 36 24 44' stroke='#3a1a08' stroke-width='6' fill='none'/><path d='M0 36H14Q22 36 24 44' stroke='url(#cu)' stroke-width='4.6' fill='none'/><path d='M0 34.4H14Q21 34.4 23 40' stroke='#ffe0b8' stroke-width='.8' fill='none' opacity='.7'/><circle cx='24' cy='46' r='2' fill='${GOLDG}'/>`;
  if (!plain) b += `<circle cx='84' cy='40' r='64' fill='url(#bg)' opacity='.5'/>`;
  return svgc(W, H, b, defs, '');
}

/** a crate of jars, sacks and a scroll on the right */
function props() {
  const W = 132, H = 84;
  const defs = wareDefs() + S.lg('wd', [[0, '#6a4426'], [1, '#2a180a']]) + S.lg('sk', [[0, '#b89a68'], [1, '#6a5030']], 0, 0, 1, 0);
  let b = `<ellipse cx='66' cy='80' rx='58' ry='5' fill='#000' opacity='.45'/>`;
  b += `<path d='M8 78L14 44Q30 36 44 46L50 78Z' fill='url(#sk)'/><path d='M14 44Q30 36 44 46' stroke='#6a5030' stroke-width='3' fill='none'/><path d='M22 56Q30 52 40 58' stroke='#6a5030' stroke-width='1' fill='none' opacity='.7'/>`;
  b += `<rect x='54' y='50' width='62' height='30' fill='url(#wd)'/><rect x='54' y='50' width='62' height='2.4' fill='#c8966a' opacity='.6'/>${[0, 1, 2].map((i) => `<rect x='54' y='${58 + i * 7}' width='62' height='.9' fill='#000' opacity='.5'/>`).join('')}<rect x='54' y='50' width='4' height='30' fill='#c46a2f' opacity='.6'/><rect x='112' y='50' width='4' height='30' fill='#c46a2f' opacity='.6'/>`;
  b += `<use href='#er' transform='translate(66 50) scale(.9)' color='#ff5fb8'/><use href='#fr' transform='translate(84 50) scale(.8)' color='#3dffa0'/><use href='#tb' transform='translate(100 50) scale(.9)' color='#a47aff'/>`;
  b += `<path d='M104 20L124 22L122 50L102 48Z' fill='#e8dcb4'/><path d='M104 20Q100 18 98 22L102 48' fill='#d8c898'/><path d='M108 28H120M108 33H119M108 38H120' stroke='#8a6a3a' stroke-width='.8'/>`;
  return svgc(W, H, b, defs, '');
}

/** the plume that boils over (a moment sprite): foam heaped on the rim and running down the pot, a glowing column of vapour and bubbles above it.
    Same unit scale as the cauldron picture; the rim's centre is at (84, 150) of 168 x 200. */
function plume() {
  const W = 168, H = 200, rnd = rngOf(7);
  const defs = glowDef('p', GOLDG, 0.9, 0.4) + S.rg('b', [[0, '#f8ffd8', 0.95], [0.5, GOLDG, 0.75], [1, '#40c860', 0.7]]) + S.lg('dr', [[0, '#f0ffb0'], [0.6, GOLDG], [1, '#40c860']], 0, 0, 0, 1) + S.lg('cl', [[0, GOLDG, 0], [0.5, GOLDG, 0.38], [1, GOLDG, 0.18]], 0, 0, 0, 1);
  let b = `<ellipse cx='84' cy='150' rx='86' ry='46' fill='url(#p)'/>`;
  b += `<path d='M40 150Q36 60 84 4Q132 60 128 150Z' fill='url(#cl)'/>`;
  // streaks of brew running down the pot from the rim
  [[26, 168, 22], [44, 176, 30], [62, 172, 16], [106, 172, 18], [124, 178, 30], [142, 166, 22]].forEach(([x, y, l]) => { b += `<path d='M${x - 4} 150Q${x - 5} ${y - l * 0.4} ${x - 2.4} ${y}Q${x} ${y + 5} ${x + 2.4} ${y}Q${x + 5} ${y - l * 0.4} ${x + 4} 150Z' fill='url(#dr)'/><path d='M${x - 1.4} 152V${y - 3}' stroke='#fff' stroke-width='1' opacity='.7' stroke-linecap='round'/>`; });
  // foam: a heap of bubbles along the rim, tallest in the middle
  for (let i = 0; i < 26; i++) { const t = i / 25, x = 18 + t * 132, hgt = 20 * Math.sin(t * Math.PI) + 4, y = 150 - rnd.between(0, hgt) - 4, r = rnd.between(5, 11) * (0.7 + Math.sin(t * Math.PI) * 0.5); b += `<circle cx='${n(x)}' cy='${n(y)}' r='${n(r)}' fill='url(#b)'/><circle cx='${n(x - r * 0.3)}' cy='${n(y - r * 0.3)}' r='${n(r * 0.26)}' fill='#fff' opacity='.9'/>`; }
  // bubbles climbing the column
  for (let i = 0; i < 22; i++) { const t = i / 21, y = 128 - t * 120, x = 84 + Math.sin(i * 1.9) * 30 * (0.4 + t) + rnd.between(-6, 6), r = rnd.between(2.4, 7) * (1 - t * 0.4); b += `<circle cx='${n(x)}' cy='${n(y)}' r='${n(r)}' fill='${GOLDG}' opacity='${n(0.25 + (1 - t) * 0.3)}'/><circle cx='${n(x)}' cy='${n(y)}' r='${n(r)}' fill='none' stroke='#f4ffc8' stroke-width='.9' opacity='.9'/><circle cx='${n(x - r * 0.3)}' cy='${n(y - r * 0.3)}' r='${n(r * 0.24)}' fill='#fff'/>`; }
  return svgc(W, H, b, defs, '');
}
/** bubbles and fumes that rise through the whole room (the tile of the moving .scene-fx layer) */
function bubbles() {
  const W = 260, H = 520, rnd = rngOf(23);
  const defs = S.rg('b', [[0, '#fff', 0.1], [0.75, '#c8ff6a', 0.14], [1, '#c8ff6a', 0.55]], 0.5, 0.5, 0.5) + glowDef('v', '#a47aff', 0.5, 0.18);
  let b = '';
  for (let i = 0; i < 20; i++) {
    const x = rnd.between(8, W - 8), y = rnd.between(0, H), r = rnd.between(1.6, 5.4), vio = rnd.chance(0.3);
    [0, -H].concat(y < 20 ? [H] : []).forEach((dy) => { b += vio ? `<circle cx='${n(x)}' cy='${n(y + dy)}' r='${n(r * 3)}' fill='url(#v)'/>` : `<circle cx='${n(x)}' cy='${n(y + dy)}' r='${n(r)}' fill='url(#b)' stroke='#d8ff90' stroke-width='.6' stroke-opacity='.7'/><circle cx='${n(x - r * 0.3)}' cy='${n(y + dy - r * 0.3)}' r='${n(r * 0.26)}' fill='#fff' opacity='.9'/>`; });
  }
  return svgc(W, H, b, defs, '');
}
/** a bright sweep for the flask cascade and a glowing drop (moment sprites) */
function sweep() {
  const W = 200, H = 40;
  const defs = S.lg('s', [[0, '#c8ffd8', 0], [0.5, '#e8ffe0', 0.85], [1, '#c8ffd8', 0]], 0, 0, 1, 0) + S.lg('v', [[0, '#fff', 0], [0.5, '#fff', 1], [1, '#fff', 0]]);
  return svgc(W, H, `<rect width='${W}' height='${H}' fill='url(#s)'/>`, defs, '');
}
function drop() {
  const W = 16, H = 26;
  const defs = glowDef('g', GOLDG, 0.9, 0.35) + S.rg('d', [[0, '#fff'], [0.5, '#e8ffb0'], [1, GOLDG]], 0.4, 0.35, 0.7);
  return svgc(W, H, `<circle cx='8' cy='15' r='8' fill='url(#g)'/><path d='M8 2Q13 11 13 16Q13 22 8 22Q3 22 3 16Q3 11 8 2Z' fill='url(#d)'/><ellipse cx='6.4' cy='16' rx='1.2' ry='2.4' fill='#fff' opacity='.8'/>`, defs, '');
}

function capDraw() {
  const defs = S.lg('cg', [[0, CU.hi], [0.4, CU.base], [1, CU.lo]], 0, 0, 1, 1) + S.rg('rv', [[0, '#ffe8c8'], [0.5, '#c46a2f'], [1, '#4a2008']], 0.36, 0.34, 0.7) + S.rg('gm', [[0, '#d8ffe8'], [0.4, EM], [1, '#0a7a4a']], 0.4, 0.35, 0.7);
  let b = `<path d='M0 44V33A33 33 0 0 1 33 0H44V9H33A24 24 0 0 0 9 33V44Z' fill='url(#cg)'/>`;
  b += `<path d='M0 44V33A33 33 0 0 1 33 0H44' fill='none' stroke='#ffe8c8' stroke-width='.9' opacity='.8'/><path d='M44 9H33A24 24 0 0 0 9 33V44' fill='none' stroke='#2a1206' stroke-width='.9' opacity='.8'/>`;
  b += `<circle cx='12.7' cy='12.7' r='5.2' fill='#2a1206'/><circle cx='12.7' cy='12.7' r='4.2' fill='url(#gm)'/><circle cx='11.6' cy='11.6' r='1' fill='#fff' opacity='.9'/>`;
  [[36, 4.6], [4.6, 36], [24, 8], [8, 24]].forEach(([x, y]) => { b += `<circle cx='${x}' cy='${y}' r='1.7' fill='url(#rv)'/>`; });
  return { defs, body: b };
}

function css() {
  const th = 'var(--s4-th)', bh = 'var(--s4-bh)', K = (v, k) => `calc(${v} * ${k})`;
  const P = {
    cauldron: { fx: -0.1, band: 'bottom', h: K(bh, 0.6), a: 168 / 120, dy: K(bh, 0.03) },
    props: { fx: 0.36, band: 'bottom', h: K(bh, 0.56), a: 132 / 84, dy: K(bh, 0.08) },
    plume: { fx: -0.1, band: 'bottom', h: K(bh, 1.0), a: 168 / 200, dy: K(bh, 0.13) },
  };
  const R = registry('alchemy');
  const svg = { top: top(), glow: flaskGlow(1), lit: flaskGlow(1.7), wall: wall(), floor: floor(), cauldron: cauldron(), props: props(), plume: plume(), bubbles: bubbles(), sweep: sweep(), drop: drop() };
  const ref = {}; Object.keys(svg).forEach((k) => { ref[k] = R.add(k, svg[k]); });
  const caps = L.cornerCaps(R, 'al', capDraw);
  const tTop = bgTile(ref.top, 'top', th), tFloor = bgTile(ref.floor, 'bottom', bh), tGlow = bgTile(ref.glow, 'top', th);
  const fireHalo = 'radial-gradient(ellipse 44% 34% at calc(var(--s4-cx) - var(--s4-cw) * 0.1) 100%, rgba(255, 140, 50, 0.5), rgba(255, 90, 20, 0.14) 55%, transparent 80%)';
  const brewHalo = 'radial-gradient(ellipse 30% 22% at calc(var(--s4-cx) - var(--s4-cw) * 0.1) 94%, rgba(200, 255, 106, 0.3), transparent 80%)';
  const paper = `${ref.wall} repeat 50% 0 / 96px auto`;
  const soot = 'linear-gradient(180deg, rgba(6, 3, 2, 0.8) 0, rgba(6, 3, 2, 0.35) 16%, transparent 34%)';
  const base = 'linear-gradient(180deg, #17100e 0%, #1c1411 50%, #1a110d 100%)';
  const rest = [fireHalo, brewHalo, bgPiece(ref.cauldron, P.cauldron), bgPiece(ref.props, P.props), tFloor, tTop, soot, paper, base];
  const bgList = [fireHalo, brewHalo, bgPiece(ref.cauldron, P.cauldron), bgPiece(ref.props, P.props), tFloor, tGlow, tTop, soot, paper, base];
  const rivets = (c1, c2) => {
    const r = `radial-gradient(circle at 50% 50%, #ffe8d0 0 0.9px, ${c1} 1.7px, ${c2} 2.5px, transparent 3.1px)`;
    return `${r} 0 3px / 24px 8px repeat-x, ${r} 12px calc(100% - 3px) / 24px 8px repeat-x, ${r} 3px 12px / 8px 24px repeat-y, ${r} calc(100% - 3px) 0 / 8px 24px repeat-y`;
  };
  return {
    plate: [16, 9, 6, 0.7],
    vars: `
  --a-bg: ${bgList.join(',\n    ')};
  --a-bg-run: ${rest.join(',\n    ')};
  --a-board: linear-gradient(180deg, #0a1512, #030a08);
  --a-frame: #d9803a;
  --a-glow: rgba(255, 150, 60, 0.3);${R.decls()}`,
    run: `
.board-alchemy .run-active .bg::before { display: block; left: 0; right: 0; top: 0; height: var(--s4-th); background: ${ref.glow} repeat-x 50% 0 / auto 100%; will-change: opacity; animation: s4Glow 2.8s ease-in-out infinite alternate; }
.board-alchemy .run-active .bg .scene-fx { display: block; height: calc(100% + 520px); background-image: ${ref.bubbles}; background-size: 260px 520px; animation: s4Rise 60s linear infinite; }
.board-alchemy .run-active .bg .scene-fx.b { display: none; }
/* moment layers (js/s4-scenes.js): they sit exactly on their static twins and stay invisible until a moment plays */
.board-alchemy .bg .s4x { position: absolute; pointer-events: none; opacity: 0; }
.board-alchemy .bg .s4x.flasklit { left: 0; right: 0; top: 0; height: var(--s4-th); background: ${ref.lit} repeat-x 50% 0 / auto 100%; }
.board-alchemy .bg .s4x.plume { ${boxCSS(P.plume)} background: ${ref.plume} no-repeat center / 100% 100%; transform-origin: 50% 75%; }
.board-alchemy .bg .s4x.sweep { left: 0; top: calc(var(--s4-th) * 0.12); width: 46%; height: calc(var(--s4-th) * 0.62); background: ${ref.sweep} no-repeat center / 100% 100%; }
.board-alchemy .bg .s4x.drop { left: calc(var(--s4-cx) - var(--s4-cw) / 2 - 8px); top: 0; width: 16px; height: 26px; background: ${ref.drop} no-repeat center / 100% 100%; }
`,
    frame: L.frameCSS('board-alchemy', {
      ring: [[1.5, '#1a0c05'], [5, CU.base], [6, '#f6b074'], [8, '#5a2a0e'], [9, 'rgba(61, 255, 160, 0.5)']],
      drop: '0 0 12px rgba(255, 150, 60, 0.25), 0 8px 22px rgba(0, 0, 0, 0.55)',
      tooled: 'inset 0 0 0 1.4px rgba(246, 176, 116, 0.6), inset 0 0 0 3px rgba(0, 0, 0, 0.4)',
      caps: { tl: R.ref('captl'), tr: R.ref('captr'), bl: R.ref('capbl'), br: R.ref('capbr') },
      glow: 'rgba(255, 150, 60, 0.3)',
    }) + `.board-alchemy .board::after { background: ${rivets('#c46a2f', '#5a2a0e')}; }\n`,
  };
}
module.exports = { top, glow: () => flaskGlow(1), lit: () => flaskGlow(1.7), wall, floor, cauldron: () => cauldron(), props, plume, bubbles, sweep, drop, css };
