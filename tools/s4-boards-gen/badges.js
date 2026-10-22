// The badge scene of every Series 4 board: a small picture of the scene itself (not the 3x3 board the older badges all show), a different
// one for each board, drawn in a 100 x 100 box and clipped by css (.s4b in css/s4-scenes.css; the markup comes from js/s4-scenes.js).
const L = require('./lib');
const { S, n, mix, lighten, darken, rngOf, svgc, glowDef } = L;

const SPINE = ['#6e2233', '#21503d', '#1f3d57', '#8a5a2e', '#52182a', '#4f5226', '#3d2252'];

function library() {
  const rnd = rngOf(2);
  const defs = S.lg('w', [[0, '#2c1810'], [1, '#150b06']]) + S.lg('pl', [[0, '#c28a52'], [1, '#5a3418']]) + glowDef('c', '#ffb84a', 0.9, 0.3) + glowDef('m', '#bcd4ff', 0.6, 0.18)
    + S.rg('sk', [[0, '#3a5a9a'], [1, '#0a1233']], 0.5, 0.3, 0.8) + S.lg('dk', [[0, '#6a4020'], [1, '#2a160a']]) + S.rg('fl', [[0, '#fffbe8'], [0.4, '#ffe27a'], [1, '#ff9a2e']], 0.5, 0.6, 0.6);
  let b = `<rect width='100' height='100' fill='url(#w)'/>`;
  [[6, 30], [34, 58]].forEach(([y0, base]) => {
    b += `<rect y='${y0}' width='100' height='${base - y0}' fill='#0e0703' opacity='.5'/>`;
    let x = 2; while (x < 98) { const w = rnd.between(4.5, 8), h = rnd.between(16, 24); b += `<rect x='${n(x)}' y='${n(base - h)}' width='${n(w)}' height='${n(h)}' rx='.8' fill='${rnd.pick(SPINE)}'/><rect x='${n(x)}' y='${n(base - h * 0.84)}' width='${n(w)}' height='.9' fill='#e8b85a' opacity='.8'/><rect x='${n(x + 0.4)}' y='${n(base - h)}' width='.6' height='${n(h)}' fill='#fff' opacity='.2'/>`; x += w + 0.6; }
    b += `<rect y='${base}' width='100' height='3.4' fill='url(#pl)'/>`;
  });
  // the round moon window
  b += `<circle cx='50' cy='28' r='22' fill='url(#m)'/><circle cx='50' cy='28' r='15' fill='#5a3418'/><circle cx='50' cy='28' r='13' fill='#d9a441'/><circle cx='50' cy='28' r='11.6' fill='url(#sk)'/><circle cx='46' cy='25' r='5.2' fill='#fffdf0'/><path d='M50 16.4V39.6M38.4 28H61.6' stroke='#d9a441' stroke-width='1.2'/><circle cx='56' cy='33' r='.7' fill='#fff'/><circle cx='42' cy='34' r='.6' fill='#fff'/>`;
  // the desk, the candle and an open book
  b += `<rect y='72' width='100' height='28' fill='url(#dk)'/><rect y='72' width='100' height='1.6' fill='#d9a46a'/>`;
  b += `<circle cx='20' cy='62' r='22' fill='url(#c)'/><rect x='17.4' y='62' width='5.2' height='20' fill='#fff1d0'/><rect x='14' y='80' width='12' height='3' rx='1' fill='#d9a441'/><path d='M20 46Q24.4 54 23.4 58Q23.4 63 20 63Q16.6 63 16.6 58Q15.6 54 20 46Z' fill='url(#fl)'/>`;
  b += `<path d='M44 88L62 84L80 88L80 94L62 98L44 94Z' fill='#7a2a3a'/><path d='M46 86Q54 82 62 85L62 95Q54 92 46 95Z' fill='#fff4d4'/><path d='M78 86Q70 82 62 85L62 95Q70 92 78 95Z' fill='#f2e6c4'/>`;
  b += `<rect y='94' width='100' height='6' fill='#150b06' opacity='.6'/>`;
  return svgc(100, 100, b, defs, '');
}

function glade() {
  const rnd = rngOf(6);
  const defs = S.lg('s', [[0, '#04141c'], [0.55, '#0a3a38'], [1, '#04140f']]) + glowDef('t', '#6bffe0', 0.85, 0.3) + glowDef('p', '#ff8fd0', 0.85, 0.3) + glowDef('m', '#bfe8ff', 0.6, 0.18)
    + S.lg('ct', [[0, '#c8fff2'], [0.5, '#35d8bc'], [1, '#0d6a60']]) + S.lg('cp', [[0, '#ffd6ee'], [0.5, '#f060b4'], [1, '#7a1f5a']]) + S.lg('sh', [[0, '#bfe8ff', 0.28], [1, '#bfe8ff', 0]]);
  let b = `<rect width='100' height='100' fill='url(#s)'/>`;
  b += `<path d='M30 0H44L70 100H46Z' fill='url(#sh)'/><path d='M52 0H60L92 100H72Z' fill='url(#sh)'/>`;
  b += `<circle cx='62' cy='20' r='20' fill='url(#m)'/><circle cx='62' cy='20' r='9' fill='#fffff0'/><circle cx='66' cy='17' r='8' fill='#06222a'/>`;
  for (let i = 0; i < 26; i++) { const x = rnd.between(0, 100), y = rnd.between(0, 36 * rnd.f()); b += `<ellipse cx='${n(x)}' cy='${n(y)}' rx='${n(rnd.between(5, 10))}' ry='${n(rnd.between(2.4, 4.4))}' transform='rotate(${n(rnd.between(-40, 40))} ${n(x)} ${n(y)})' fill='${rnd.pick(['#0d3c3a', '#08292b', '#04191c', '#12504a'])}'/>`; }
  b += `<path d='M0 0V50Q6 36 12 8L16 0Z M100 0V44Q92 30 88 6L84 0Z' fill='#030f0d'/>`;
  // ferns and the ring of mushrooms
  b += `<path d='M0 100V80Q20 70 50 76Q80 70 100 80V100Z' fill='#06261f'/>`;
  [[10, 84, 1], [88, 86, 0.9], [34, 90, 0.7], [66, 92, 0.8], [50, 82, 0.6]].forEach(([x, y, s], i) => { const g = i % 2 ? 'p' : 't', c = i % 2 ? 'cp' : 'ct'; b += `<circle cx='${x}' cy='${y - 8 * s}' r='${n(18 * s)}' fill='url(#${g})'/><path d='M${x - 2 * s} ${y}Q${x - 1.6 * s} ${y - 8 * s} ${x - 1.2 * s} ${y - 10 * s}H${x + 1.6 * s}Q${x + 2 * s} ${y - 8 * s} ${x + 2.2 * s} ${y}Z' fill='#d8f6ec'/><path d='M${x - 11 * s} ${y - 9 * s}Q${x - 10 * s} ${y - 22 * s} ${x} ${y - 22.6 * s}Q${x + 10 * s} ${y - 22 * s} ${x + 11 * s} ${y - 9 * s}Q${x + 6 * s} ${y - 7 * s} ${x} ${y - 7 * s}Q${x - 6 * s} ${y - 7 * s} ${x - 11 * s} ${y - 9 * s}Z' fill='url(#${c})'/><circle cx='${x - 4 * s}' cy='${y - 14 * s}' r='${n(1.2 * s)}' fill='#fff' opacity='.7'/><circle cx='${x + 3 * s}' cy='${y - 17 * s}' r='${n(1 * s)}' fill='#fff' opacity='.7'/>`; });
  for (let i = 0; i < 9; i++) b += `<circle cx='${n(rnd.between(6, 94))}' cy='${n(rnd.between(30, 78))}' r='1.3' fill='#d9ff7a'/><circle cx='${n(rnd.between(6, 94))}' cy='${n(rnd.between(30, 78))}' r='3.4' fill='#d9ff7a' opacity='.25'/>`;
  return svgc(100, 100, b, defs, '');
}

function alchemy() {
  const rnd = rngOf(8);
  const defs = S.lg('w', [[0, '#1c1411'], [1, '#120c0a']]) + S.lg('cu', [[0, '#f6b074'], [0.3, '#c46a2f'], [1, '#6a3010']]) + S.lg('ir', [[0, '#4a4440'], [0.35, '#2a2624'], [1, '#0c0a09']], 0, 0, 1, 0)
    + S.rg('br', [[0, '#f0ffb0'], [0.4, '#c8ff6a'], [1, '#14803a']], 0.5, 0.45, 0.6) + glowDef('g', '#c8ff6a', 0.8, 0.3) + glowDef('fr', '#ff9a3a', 0.9, 0.35) + S.lg('fl', [[0, '#fff6c0'], [0.4, '#ffb040'], [1, '#e8401a']], 0, 1, 0, 0);
  let b = `<rect width='100' height='100' fill='url(#w)'/>`;
  for (let y = 0; y < 100; y += 12) for (let x = -(y / 12 % 2) * 12; x < 100; x += 24) b += `<rect x='${x + 0.6}' y='${y + 0.6}' width='22.8' height='10.8' rx='1' fill='#2a201c' opacity='.7'/>`;
  b += `<rect y='9' width='100' height='5' fill='url(#cu)'/><rect y='9' width='100' height='.9' fill='#ffe0b8' opacity='.8'/>`;
  b += `<path d='M8 14V22' stroke='url(#cu)' stroke-width='3'/>` + [0, 1, 2, 3].map((k) => `<path d='M-4 ${24 + k * 6}A12 3.4 0 0 0 20 ${24 + k * 6}' fill='none' stroke='url(#cu)' stroke-width='2.4'/>`).join('');
  b += `<rect y='48' width='100' height='3.4' fill='#3a281c'/>`;
  // flasks on the shelf
  [[26, '#3dffa0', 1], [44, '#ff5fb8', 0.9], [60, '#ffb347', 1.05], [78, '#4de1ff', 0.9], [92, '#a47aff', 0.8]].forEach(([x, c, s]) => { b += `<circle cx='${x}' cy='${44 - 6 * s}' r='${n(14 * s)}' fill='${c}' opacity='.25'/><path d='M${x - 2 * s} ${48}V${n(48 - 20 * s)}M${x + 2 * s} 48V${n(48 - 20 * s)}' stroke='#dff4ff' stroke-width='.8'/><circle cx='${x}' cy='${n(48 - 8 * s)}' r='${n(8 * s)}' fill='${c}'/><circle cx='${n(x - 2.6 * s)}' cy='${n(48 - 11 * s)}' r='${n(2 * s)}' fill='#fff' opacity='.5'/><rect x='${n(x - 2.2 * s)}' y='${n(48 - 24 * s)}' width='${n(4.4 * s)}' height='3' fill='#8a5a2e'/>`; });
  // the cauldron over a fire
  b += `<ellipse cx='50' cy='88' rx='38' ry='10' fill='url(#fr)'/>`;
  [[30, 12], [40, 17], [50, 20], [60, 17], [70, 12]].forEach(([x, h]) => { b += `<path d='M${x} 94Q${x - 4} ${94 - h * 0.5} ${x - 1} ${94 - h}Q${x + 1} ${94 - h * 0.5} ${x + 4} ${94 - h * 0.7}Q${x + 5} 92 ${x} 94Z' fill='url(#fl)'/>`; });
  b += `<path d='M26 66Q24 90 50 92Q76 90 74 66Z' fill='url(#ir)'/><path d='M26 66Q50 73 74 66' stroke='url(#cu)' stroke-width='3.4' fill='none'/>`;
  b += `<ellipse cx='50' cy='64' rx='25' ry='7' fill='url(#ir)' stroke='#6a645e' stroke-width='1'/><ellipse cx='50' cy='64.4' rx='22' ry='5.4' fill='url(#br)'/><circle cx='50' cy='52' r='24' fill='url(#g)' opacity='.6'/>`;
  [[42, 63, 2.4], [52, 65, 3], [60, 62, 2]].forEach(([x, y, r]) => { b += `<circle cx='${x}' cy='${y}' r='${r}' fill='#e8ffb0' opacity='.6'/><circle cx='${x}' cy='${y}' r='${r}' fill='none' stroke='#fff' stroke-width='.6'/>`; });
  [[46, 56, 1.8], [54, 52, 2.4], [50, 46, 1.4], [58, 42, 1.8], [44, 40, 1.2]].forEach(([x, y, r]) => { b += `<circle cx='${x}' cy='${y}' r='${r}' fill='#d8ff90' opacity='.7'/>`; });
  return svgc(100, 100, b, defs, '');
}

function observatory() {
  const rnd = rngOf(10);
  const defs = S.lg('d', [[0, '#10224a'], [1, '#08122a']]) + S.lg('br', [[0, '#6a4a14'], [0.28, '#ffe9a8'], [0.55, '#d9a441'], [1, '#2a1c06']], 0, 0, 1, 0) + glowDef('n1', '#ff7ad9', 0.8, 0.3) + glowDef('n2', '#7a8aff', 0.8, 0.3)
    + S.rg('sun', [[0, '#fffbe0'], [0.5, '#ffcf6b'], [1, '#e88a1a']], 0.4, 0.38, 0.7) + glowDef('sg', '#ffd070', 0.8, 0.3) + S.lg('tb', [[0, '#6a4a14'], [0.3, '#ffe9a8'], [0.6, '#d9a441'], [1, '#2a1c06']], 0, 0, 0, 1);
  let b = `<rect width='100' height='100' fill='#050c24'/>`;
  // the sky seen through the slit
  b += `<path d='M40 0H60L66 70H34Z' fill='#0a1640'/><ellipse cx='50' cy='28' rx='20' ry='24' fill='url(#n2)'/><ellipse cx='46' cy='36' rx='14' ry='16' fill='url(#n1)'/>`;
  for (let i = 0; i < 26; i++) b += `<circle cx='${n(rnd.between(34, 66))}' cy='${n(rnd.between(0, 66))}' r='${n(rnd.between(0.3, 0.9))}' fill='#fff' opacity='${n(rnd.between(0.5, 1))}'/>`;
  // the dome around it: panels and ribs
  b += `<path fill-rule='evenodd' d='M0 0H100V100H0Z M40 0H60L66 70H34Z' fill='url(#d)'/>`;
  [-44, -30, -18, 18, 30, 44].forEach((d) => { b += `<path d='M${50 + Math.sign(d) * 11} 0Q${50 + d * 0.6} 30 ${50 + d * 1.2} 72' fill='none' stroke='#000' stroke-width='3.4' opacity='.4'/><path d='M${50 + Math.sign(d) * 11} 0Q${50 + d * 0.6} 30 ${50 + d * 1.2} 72' fill='none' stroke='url(#br)' stroke-width='2.4'/>`; });
  b += `<path d='M40 0L34 70M60 0L66 70' stroke='url(#br)' stroke-width='2.2' fill='none'/><rect y='70' width='100' height='3' fill='url(#br)'/>`;
  b += `<rect y='73' width='100' height='27' fill='#0b1632'/>`;
  // the telescope across the left
  b += `<path d='M10 90L58 54' stroke='#2a1c06' stroke-width='9' stroke-linecap='round'/><path d='M10 90L58 54' stroke='url(#tb)' stroke-width='7' stroke-linecap='round'/><path d='M34 72L40 67' stroke='#ffe9a8' stroke-width='9' opacity='.0'/>`;
  [[24, 80], [38, 69], [52, 58]].forEach(([x, y]) => { b += `<circle cx='${x}' cy='${y}' r='4.4' fill='none' stroke='#ffe9a8' stroke-width='1.2' opacity='.8'/>`; });
  b += `<ellipse cx='60' cy='52.5' rx='3' ry='7' transform='rotate(-37 60 52.5)' fill='#6ad8ff'/><path d='M14 98L22 84M30 98L26 86' stroke='#6a4a14' stroke-width='2.2'/>`;
  // the orrery
  b += `<circle cx='78' cy='84' r='13' fill='url(#sg)'/><ellipse cx='78' cy='84' rx='15' ry='6.4' fill='none' stroke='#d9a441' stroke-width='1.2'/><ellipse cx='78' cy='84' rx='9.4' ry='4' fill='none' stroke='#d9a441' stroke-width='1.2'/><circle cx='78' cy='84' r='3.2' fill='url(#sun)'/><circle cx='91' cy='85' r='2' fill='#ff8a5a'/><circle cx='70' cy='81' r='1.5' fill='#7fb2ff'/><circle cx='83' cy='88' r='1.3' fill='#9fffd0'/>`;
  return svgc(100, 100, b, defs, '');
}

function isles() {
  const rnd = rngOf(12);
  const defs = S.lg('s', [[0, '#9a8ad8'], [0.3, '#e8a0b8'], [0.62, '#ffc8a0'], [1, '#ffe8c8']]) + glowDef('sun', '#fff0c0', 0.95, 0.4) + S.lg('rk', [[0, '#6a4a5e'], [0.55, '#3a2a40'], [1, '#26182c']]) + S.lg('gr', [[0, '#7fe0a0'], [0.6, '#3a9a6a'], [1, '#1f6a50']]) + S.lg('fl', [[0, '#fff', 0.95], [1, '#cfeaff', 0.55]], 0, 0, 0, 1);
  let b = `<rect width='100' height='100' fill='url(#s)'/><circle cx='50' cy='62' r='40' fill='url(#sun)'/><circle cx='50' cy='62' r='12' fill='#fff8e0'/>`;
  for (let i = 0; i < 8; i++) b += `<circle cx='${n(rnd.between(0, 100))}' cy='${n(rnd.between(2, 22))}' r='.7' fill='#fff' opacity='${n(rnd.between(0.4, 0.9))}'/>`;
  const cloud = (x, y, w, c) => `<ellipse cx='${x}' cy='${y}' rx='${w}' ry='${n(w * 0.3)}' fill='${c}'/><ellipse cx='${x - w * 0.4}' cy='${y - w * 0.12}' rx='${n(w * 0.5)}' ry='${n(w * 0.3)}' fill='${c}'/><ellipse cx='${x + w * 0.3}' cy='${y - w * 0.15}' rx='${n(w * 0.5)}' ry='${n(w * 0.34)}' fill='${c}'/>`;
  b += cloud(20, 20, 12, '#ffe2d0') + cloud(78, 14, 10, '#ffd8c8');
  // a far island with the tower
  b += `<path d='M62 46Q72 40 82 46L74 58L68 56Z' fill='#9a78b8'/><path d='M70 42V30H74V42Z' fill='#4a3a78'/><path d='M69 30L72 24L75 30Z' fill='#3a2a68'/><rect x='71.4' y='34' width='1.2' height='2.4' fill='#ffd88a'/>`;
  // the two near islands with a waterfall
  const isle = (cx, top, w, d, fall) => `<path d='M${cx - w / 2} ${top}Q${cx - w * 0.3} ${top + d * 0.6} ${cx - w * 0.08} ${top + d}Q${cx + w * 0.3} ${top + d * 0.7} ${cx + w / 2} ${top}Z' fill='url(#rk)'/><path d='M${cx - w / 2} ${top}Q${cx - w * 0.25} ${top - d * 0.5} ${cx} ${top - d * 0.46}Q${cx + w * 0.25} ${top - d * 0.5} ${cx + w / 2} ${top}Q${cx} ${top + d * 0.2} ${cx - w / 2} ${top}Z' fill='url(#gr)'/><path d='M${cx - w * 0.2} ${top - d * 0.2}l-2 -6l4 0z M${cx + w * 0.1} ${top - d * 0.3}l-2.4 -7l4.8 0z' fill='#1f7a5a'/>${fall ? `<path d='M${cx + w * 0.36} ${top + 2}Q${cx + w * 0.4} ${top + 16} ${cx + w * 0.38} ${top + 30}L${cx + w * 0.38 + 4} ${top + 30}Q${cx + w * 0.44} ${top + 16} ${cx + w * 0.42} ${top + 2}Z' fill='url(#fl)'/>` : ''}`;
  b += isle(28, 56, 40, 20, true) + isle(66, 66, 30, 14, false);
  // the sunlit cloud sea
  b += `<rect y='84' width='100' height='16' fill='#ffd8c0'/>`;
  [[10, 88, 14, '#fff0e0'], [36, 92, 16, '#fffaf0'], [62, 88, 14, '#fff0e0'], [88, 92, 16, '#fffaf0'], [24, 96, 16, '#ffe8d8'], [70, 98, 16, '#ffe8d8']].forEach(([x, y, w, c]) => { b += cloud(x, y, w, c); });
  b += `<ellipse cx='36' cy='86' rx='7' ry='2.4' fill='#fff' opacity='.7'/>`;
  b += `<path d='M44 30q2 -2 4 0q2 -2 4 0' stroke='#6a5a98' stroke-width='.8' fill='none'/><path d='M54 36q1.6 -1.6 3.2 0q1.6 -1.6 3.2 0' stroke='#6a5a98' stroke-width='.7' fill='none'/>`;
  return svgc(100, 100, b, defs, '');
}

function tower() {
  const rnd = rngOf(14);
  const defs = S.lg('s', [[0, '#0a1636'], [0.5, '#0a1534'], [1, '#070c20']]) + glowDef('h', '#cfe0ff', 0.55, 0.16) + S.rg('m', [[0, '#fbfcff'], [0.55, '#dde6f6'], [0.9, '#a9b8d8'], [1, '#8494b8']], 0.4, 0.36, 0.62)
    + S.lg('st', [[0, '#101a3c'], [0.5, '#2f3f72'], [1, '#4a5a8a']], 0, 0, 1, 0) + glowDef('w', '#ffcf6b', 0.9, 0.34) + S.lg('br', [[0, '#7a4a1e'], [0.25, '#e8a458'], [0.5, '#c07830'], [1, '#4a2a0c']], 0, 0, 1, 0);
  let b = `<rect width='100' height='100' fill='url(#s)'/>`;
  for (let i = 0; i < 40; i++) b += `<circle cx='${n(rnd.between(0, 100))}' cy='${n(rnd.between(0, 70))}' r='${n(rnd.between(0.3, 0.9))}' fill='#fff' opacity='${n(rnd.between(0.4, 0.95))}'/>`;
  // the huge moon
  b += `<circle cx='32' cy='30' r='44' fill='url(#h)'/><circle cx='32' cy='30' r='28' fill='url(#m)'/>`;
  [[22, 24, 7, 5], [40, 20, 5, 4], [30, 40, 9, 5], [44, 36, 4, 5]].forEach(([x, y, rx, ry]) => { b += `<ellipse cx='${x}' cy='${y}' rx='${rx}' ry='${ry}' fill='#8f9fc0' opacity='.45'/>`; });
  for (let i = 0; i < 10; i++) { const a = rnd.between(0, 6.28), r = Math.sqrt(rnd.f()) * 24, x = 32 + Math.cos(a) * r, y = 30 + Math.sin(a) * r, cr = rnd.between(1, 3); b += `<circle cx='${n(x)}' cy='${n(y)}' r='${n(cr)}' fill='#7686a8' opacity='.4'/><path d='M${n(x - cr)} ${n(y)}A${n(cr)} ${n(cr)} 0 0 1 ${n(x + cr * 0.6)} ${n(y - cr * 0.8)}' stroke='#fff' stroke-width='.5' fill='none' opacity='.7'/>`; }
  // clouds across the moon
  b += `<ellipse cx='40' cy='44' rx='22' ry='3' fill='#1a2a5a' opacity='.6'/><ellipse cx='20' cy='20' rx='14' ry='2.4' fill='#1a2a5a' opacity='.5'/>`;
  // the tower: a shaft with lit windows, a roof with a bell arch, a balcony
  b += `<path d='M62 100V40H86V100Z' fill='url(#st)'/><path d='M62 100V40' stroke='#000' stroke-width='2' opacity='.4'/><path d='M86 40V100' stroke='#c8d4ee' stroke-width='.8' opacity='.5'/>`;
  b += `<path d='M58 40H90V44H58Z' fill='#5a6a9a'/><path d='M62 40L74 14L86 40Z' fill='#18224a'/><path d='M62 40L74 14' stroke='#8aa0d8' stroke-width='.8'/>`;
  b += `<path d='M68 40V32A6 6 0 0 1 80 32V40Z' fill='#06091c'/><path d='M71 40Q71 34 74 32Q77 34 77 40Z' fill='url(#br)'/><rect x='73.4' y='28' width='1.2' height='4' fill='#7a4a1e'/>`;
  [[48, 1], [58, 1], [68, 1], [78, 0], [88, 0]].forEach(([y, on], i) => { const x = 74; b += on ? `<circle cx='${x}' cy='${y + 3}' r='7' fill='url(#w)'/><path d='M${x - 2.4} ${y + 8}V${y + 2}A2.4 2.4 0 0 1 ${x + 2.4} ${y + 2}V${y + 8}Z' fill='#ffcf6b'/>` : `<path d='M${x - 2.4} ${y + 8}V${y + 2}A2.4 2.4 0 0 1 ${x + 2.4} ${y + 2}V${y + 8}Z' fill='#0a1430' stroke='#6a7aaa' stroke-width='.6'/>`; });
  // the town below
  b += `<rect y='88' width='100' height='12' fill='#070d26'/>`;
  let x = 0; while (x < 100) { const w = rnd.between(6, 11), h = rnd.between(4, 9); b += `<rect x='${n(x)}' y='${n(94 - h)}' width='${n(w)}' height='${n(h + 8)}' fill='#0d1838'/><path d='M${n(x - 0.6)} ${n(94 - h)}L${n(x + w / 2)} ${n(94 - h - 3.4)}L${n(x + w + 0.6)} ${n(94 - h)}Z' fill='#0d1838'/>`; if (rnd.chance(0.7)) b += `<rect x='${n(x + w / 2 - 0.8)}' y='${n(94 - h + 1.4)}' width='1.6' height='2' fill='#ffcf6b'/>`; x += w + 0.4; }
  return svgc(100, 100, b, defs, '');
}

const ART = { library, glade, alchemy, observatory, isles, tower };
const FRAME = { library: '#d6a24a', glade: '#7fd4b8', alchemy: '#d9803a', observatory: '#d9a441', isles: '#e8e4f4', tower: '#9fb4e0' };
const GLOW = { library: 'rgba(255, 170, 80, 0.5)', glade: 'rgba(107, 255, 224, 0.5)', alchemy: 'rgba(255, 150, 60, 0.5)', observatory: 'rgba(127, 178, 255, 0.45)', isles: 'rgba(255, 190, 140, 0.5)', tower: 'rgba(160, 190, 255, 0.5)' };
/** the badge css: one picture per board (a custom property, so it is stored once) and the shared box; sparkles are the only moving part */
function css(boards) {
  let c = `/* ---- badges: the scene itself (markup from js/s4-scenes.js) ---- */
.s4b { position: relative; width: 6.9em; height: 6.9em; border-radius: 1.1em; overflow: hidden; box-shadow: 0 0 0.9em var(--s4b-glow, transparent); }
.s4b-art { position: absolute; inset: 0; background: var(--s4b-art) no-repeat center / 100% 100%; }
.s4b::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 0.15em var(--s4b-frame, #fff), inset 0 0 0 0.3em rgba(0, 0, 0, 0.35); pointer-events: none; }
.s4b-fx { position: absolute; width: 0.5em; height: 0.5em; border-radius: 50%; background: radial-gradient(circle, #fff, rgba(255, 255, 255, 0) 70%); opacity: 0; animation: s4Twinkle 2.6s ease-in-out infinite; }
.s4b-fx.a { left: 22%; top: 30%; } .s4b-fx.b { left: 72%; top: 56%; animation-delay: -1.3s; }
.bdg.still .s4b-fx { display: none; }
html:is(.low-end, .reduced) .s4b-fx { display: none; }
`;
  boards.forEach((b) => { c += `.s4b-${b} { --s4b-art: ${L.url(ART[b]())}; --s4b-frame: ${FRAME[b]}; --s4b-glow: ${GLOW[b]}; }\n`; });
  return c;
}
module.exports = Object.assign({ css }, ART);
