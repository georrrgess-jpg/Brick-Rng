// Observatory (Legendary): inside a brass dome. A slit open to the stars (with shutters), a giant brass telescope across the top-left,
// an orrery below, pale blue star charts on the navy walls, a brass ring frame with a degree scale and a gold marker that moves one notch
// per stage. Layers: .bg background = the sky behind the slit, the room and the floor; .bg::before = the stars drifting past the slit
// (animation 1); .scene-fx = the dome overlay with the slit cut out (static); .bg::after = the planets of the orrery (animation 2).
const L = require('./lib');
const { S, n, mix, lighten, darken, rngOf, svgc, glowDef, bgPiece, registry, boxCSS, bgTile, url } = L;

const NAVY = '#0b1630', BRASS = { hi: '#ffe9a8', base: '#d9a441', lo: '#6a4a14', deep: '#2a1c06' }, CHART = '#7fb2ff';

const brassGrad = (id, dir = [0, 0, 1, 0]) => S.lg(id, [[0, BRASS.lo], [0.28, BRASS.hi], [0.55, BRASS.base], [1, BRASS.deep]], ...dir);

/** the dome wall: navy panels between brass ribs that fan out from the slit, ring beams with rivets, two wall lamps. The slit is cut out. */
function dome() {
  const W = 520, H = 100, rnd = rngOf(14);
  const defs = brassGrad('br') + S.lg('pn', [[0, '#10224a'], [1, '#08122a']]) + S.lg('pn2', [[0, '#0c1b3c'], [1, '#060d20']]) + glowDef('lm', '#ffcf6b', 0.85, 0.3) + S.lg('sh', [[0, '#000', 0.6], [1, '#000', 0]]);
  let b = `<path fill-rule='evenodd' d='M0 0H${W}V${H}H0Z M238 0H282L296 ${H}H224Z' fill='url(#pn)'/>`;
  // ribs fan out from the slit: curved brass bars with rivets
  const ribs = [];
  [60, 112, 170, 236].forEach((d) => { ribs.push(-d, d); });
  ribs.forEach((d) => {
    const x0 = 260 + Math.sign(d) * 28, x1 = 260 + d, cx = 260 + d * 0.62;
    b += `<path d='M${x0} 0Q${cx} 46 ${x1} ${H}' fill='none' stroke='#000' stroke-width='7' opacity='.45'/><path d='M${x0} 0Q${cx} 46 ${x1} ${H}' fill='none' stroke='url(#br)' stroke-width='5'/><path d='M${x0 - 1} 0Q${cx - 1} 46 ${x1 - 1.4} ${H}' fill='none' stroke='#fff6d0' stroke-width='.8' opacity='.7'/>`;
    for (let t = 0.1; t < 1; t += 0.2) { const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, py = 2 * (1 - t) * t * 46 + t * t * H; b += `<circle cx='${n(px)}' cy='${n(py)}' r='1.2' fill='#2a1c06'/><circle cx='${n(px - 0.3)}' cy='${n(py - 0.3)}' r='.5' fill='#fff0b0'/>`; }
  });
  // panel shading: the dome gets darker toward the edges
  b += `<rect width='${W}' height='${H}' fill='url(#pn2)' opacity='.35'/>`;
  // ring beams
  [[17, 5], [83, 6]].forEach(([y, h]) => {
    const hl = 238 - 14 * (y / 100) - 1, hr = 282 + 14 * (y / 100) + 1;   // the beams stop at the slit's edges
    [[0, hl], [hr, W]].forEach(([x0, x1]) => { b += `<rect x='${n(x0)}' y='${y}' width='${n(x1 - x0)}' height='${h}' fill='url(#br)' opacity='.95'/><rect x='${n(x0)}' y='${y}' width='${n(x1 - x0)}' height='.9' fill='#fff6d0' opacity='.7'/><rect x='${n(x0)}' y='${y + h}' width='${n(x1 - x0)}' height='2' fill='#000' opacity='.35'/>`; });
    for (let x = 8; x < W; x += 28) if (x < hl - 2 || x > hr + 2) b += `<circle cx='${x}' cy='${y + h / 2}' r='1.1' fill='#2a1c06'/>`;
  });
  // the seam post
  b += `<rect x='-6' width='12' height='${H}' fill='url(#br)'/><rect x='${W - 6}' width='12' height='${H}' fill='url(#br)'/><rect x='-6' width='1' height='${H}' fill='#fff6d0' opacity='.6'/>`;
  // the slit's trim: brass edges and little rails
  b += `<path d='M238 0L224 ${H}M282 0L296 ${H}' stroke='url(#br)' stroke-width='3.4' fill='none'/><path d='M238 0L224 ${H}M282 0L296 ${H}' stroke='#fff6d0' stroke-width='.7' fill='none' opacity='.7'/>`;
  [[132, 34], [388, 34]].forEach(([x, y]) => { b += `<circle cx='${x}' cy='${y}' r='22' fill='url(#lm)'/><path d='M${x - 5} ${y - 12}h10v9q0 6 -5 6t-5 -6z' fill='#ffe29a'/><path d='M${x - 7} ${y - 12}h14' stroke='url(#br)' stroke-width='2.6'/><path d='M${x} ${y - 12}V${y - 22}' stroke='url(#br)' stroke-width='1.6'/><path d='M${x - 4.4} ${y - 8}v5' stroke='#fff' stroke-width='1' opacity='.7'/>`; });
  b += `<rect width='${W}' height='10' fill='url(#sh)'/>`;
  return svgc(W, H, b, defs, '');
}

/** what the slit opens on: a deep sky with the Milky Way and a bright nebula (which the shutters hide until Rush) */
function sky() {
  const W = 120, H = 100, rnd = rngOf(3);
  const defs = S.lg('bg', [[0, '#050c24'], [1, '#101e4a']]) + glowDef('n1', '#ff7ad9', 0.85, 0.35) + glowDef('n2', '#7a8aff', 0.85, 0.35) + glowDef('n3', '#3de1ff', 0.7, 0.28) + S.lg('mw', [[0, '#cfe0ff', 0], [0.5, '#cfe0ff', 0.28], [1, '#cfe0ff', 0]], 0, 0, 1, 1);
  let b = `<rect width='${W}' height='${H}' fill='url(#bg)'/>`;
  b += `<path d='M20 0L110 100L82 100L0 10Z' fill='url(#mw)'/>`;
  b += `<ellipse cx='60' cy='46' rx='48' ry='30' fill='url(#n2)'/><ellipse cx='48' cy='56' rx='34' ry='22' fill='url(#n1)'/><ellipse cx='72' cy='36' rx='30' ry='18' fill='url(#n3)'/>`;
  for (let i = 0; i < 40; i++) b += `<circle cx='${n(rnd.between(0, W))}' cy='${n(rnd.between(0, H))}' r='${n(rnd.between(0.3, 0.9))}' fill='#fff' opacity='${n(rnd.between(0.4, 1))}'/>`;
  return svgc(W, H, b, defs, '');
}
/** drifting stars for the slit (the tile of the moving layer, wraps horizontally) */
function stars() {
  const W = 260, H = 100, rnd = rngOf(8);
  const defs = glowDef('s', '#cfe0ff', 0.8, 0.3);
  let b = '';
  for (let i = 0; i < 26; i++) {
    const x = rnd.between(0, W), y = rnd.between(2, H - 2), r = rnd.between(0.5, 1.7);
    [0, W, -W].forEach((dx) => { if (x + dx > -6 && x + dx < W + 6) b += `<circle cx='${n(x + dx)}' cy='${n(y)}' r='${n(r * 2.6)}' fill='url(#s)' opacity='${n(rnd.between(0.4, 0.9))}'/><circle cx='${n(x + dx)}' cy='${n(y)}' r='${n(r * 0.7)}' fill='#fff'/>`; });
  }
  return svgc(W, H, b, defs, '');
}

function shutter(left) {
  const W = 44, H = 100;
  const defs = brassGrad('br') + S.lg('pn', [[0, '#15295a'], [1, '#0a1634']], 0, 0, 1, 0);
  let b = `<rect width='${W}' height='${H}' fill='url(#pn)'/>`;
  [24, 52, 78].forEach((y) => { b += `<rect y='${y}' width='${W}' height='3.6' fill='url(#br)'/><rect y='${y}' width='${W}' height='.7' fill='#fff6d0' opacity='.7'/>`; });
  b += `<rect x='${left ? W - 4 : 0}' width='4' height='${H}' fill='url(#br)'/><rect x='${left ? W - 2.2 : 1.4}' y='6' width='.8' height='${H - 12}' fill='#fff6d0' opacity='.6'/>`;
  b += `<circle cx='${left ? W - 11 : 11}' cy='50' r='2.6' fill='url(#br)'/><circle cx='${left ? W - 11 : 11}' cy='50' r='1' fill='#2a1c06'/>`;
  for (let y = 10; y < H; y += 20) b += `<circle cx='${left ? 6 : W - 6}' cy='${y}' r='1' fill='#2a1c06'/>`;
  return svgc(W, H, b, defs, '');
}

/** the telescope: a brass tube (moving sprite) whose pivot is at the bottom-left of its box */
function scope() {
  const W = 140, H = 100;
  const defs = S.lg('tb', [[0, BRASS.lo], [0.3, BRASS.hi], [0.6, BRASS.base], [1, BRASS.deep]], 0, 0, 0, 1) + S.rg('ln', [[0, '#e8ffff'], [0.5, '#6ad8ff'], [1, '#1a5a9a']], 0.4, 0.4, 0.7);
  const A = Math.atan2(-70, 106), cs = Math.cos(A), sn = Math.sin(A), px = 18, py = 82;
  const pt = (t, off) => [px + cs * t - sn * off, py + sn * t + cs * off];
  const tube = (t0, t1, w0, w1, fill) => { const a = pt(t0, -w0), b2 = pt(t1, -w1), c = pt(t1, w1), d = pt(t0, w0); return `<path d='M${n(a[0])} ${n(a[1])}L${n(b2[0])} ${n(b2[1])}L${n(c[0])} ${n(c[1])}L${n(d[0])} ${n(d[1])}Z' fill='${fill}'/>`; };
  let b = '';
  b += tube(-10, 30, 3, 4.4, 'url(#tb)') + tube(30, 118, 4.4, 7.4, 'url(#tb)');
  [34, 60, 86, 112].forEach((t) => { b += tube(t, t + 3.4, (t < 30 ? 4.4 : 4.4 + (t - 30) * 0.034) + 1.4, (t < 30 ? 4.4 : 4.4 + (t - 30) * 0.034) + 1.4, '#e8b85a'); });
  // finder scope on top and the eyepiece
  const f0 = pt(48, -10), f1 = pt(88, -11);
  b += `<path d='M${n(f0[0])} ${n(f0[1])}L${n(f1[0])} ${n(f1[1])}' stroke='url(#tb)' stroke-width='3.4' stroke-linecap='round'/><path d='M${n(f0[0])} ${n(f0[1])}L${n(f1[0])} ${n(f1[1])}' stroke='#fff6d0' stroke-width='.7' opacity='.6'/>`;
  const e = pt(-14, 0), e2 = pt(-22, 0);
  b += `<path d='M${n(e[0])} ${n(e[1])}L${n(e2[0])} ${n(e2[1])}' stroke='#2a1c06' stroke-width='3.4' stroke-linecap='round'/>`;
  // the objective end: a lens that glints
  const o = pt(119, 0);
  b += `<ellipse cx='${n(o[0])}' cy='${n(o[1])}' rx='3.6' ry='8.6' transform='rotate(${n((A * 180) / Math.PI + 0)} ${n(o[0])} ${n(o[1])})' fill='url(#ln)'/>`;
  b += `<circle cx='${n(o[0] - 1)}' cy='${n(o[1] - 2)}' r='1.4' fill='#fff'/>`;
  return svgc(W, H, b, defs, '');
}
/** the telescope's mount (static, under the tube) */
function mount() {
  const W = 44, H = 60;
  const defs = brassGrad('br') + S.lg('wd', [[0, '#3a2a18'], [1, '#150d06']]);
  return svgc(W, H, `<path d='M8 58L18 22H26L36 58Z' fill='url(#wd)'/><path d='M8 58L18 22M36 58L26 22' stroke='url(#br)' stroke-width='2.4'/><rect x='13' y='14' width='18' height='10' rx='2' fill='url(#br)'/><circle cx='22' cy='19' r='4.6' fill='#2a1c06'/><circle cx='22' cy='19' r='3' fill='url(#br)'/><circle cx='21' cy='18' r='1' fill='#fff6d0'/>`, defs, '');
}

/** navy walls with riveted seams and pale blue star charts pinned on them */
function wall() {
  const W = 200, H = 150, rnd = rngOf(6);
  const defs = S.lg('wl', [[0, '#0c1936'], [1, '#08122a']]) + S.lg('br', [[0, BRASS.lo], [0.4, BRASS.hi], [1, BRASS.deep]], 0, 0, 1, 0);
  let b = `<rect width='${W}' height='${H}' fill='url(#wl)'/>`;
  b += `<rect x='-2' width='4' height='${H}' fill='url(#br)' opacity='.7'/><rect x='${W - 2}' width='4' height='${H}' fill='url(#br)' opacity='.7'/>`;
  for (let y = 10; y < H; y += 20) b += `<circle cx='0' cy='${y}' r='1' fill='#2a1c06'/><circle cx='${W}' cy='${y}' r='1' fill='#2a1c06'/>`;
  // a circular star chart and a rectangular one
  b += `<rect x='26' y='24' width='70' height='56' fill='${CHART}' opacity='.1'/><rect x='26' y='24' width='70' height='56' fill='none' stroke='${CHART}' stroke-width='.7' opacity='.3'/><circle cx='61' cy='52' r='21' fill='none' stroke='${CHART}' stroke-width='.6' opacity='.35' stroke-dasharray='2 2'/><circle cx='61' cy='52' r='11' fill='none' stroke='${CHART}' stroke-width='.5' opacity='.3'/>`;
  const pts = [[48, 42], [58, 36], [66, 46], [74, 40], [70, 58], [54, 62], [46, 54]];
  b += `<path d='M${pts.map((p) => p.join(' ')).join('L')}' fill='none' stroke='${CHART}' stroke-width='.6' opacity='.45'/>` + pts.map(([x, y]) => `<circle cx='${x}' cy='${y}' r='1.2' fill='#cfe0ff' opacity='.7'/>`).join('');
  b += `<rect x='116' y='70' width='60' height='44' fill='${CHART}' opacity='.08'/><rect x='116' y='70' width='60' height='44' fill='none' stroke='${CHART}' stroke-width='.7' opacity='.26'/>`;
  for (let i = 0; i < 9; i++) b += `<circle cx='${n(rnd.between(120, 172))}' cy='${n(rnd.between(74, 110))}' r='${n(rnd.between(0.6, 1.3))}' fill='#cfe0ff' opacity='.5'/>`;
  b += `<path d='M122 100Q140 78 170 96' fill='none' stroke='${CHART}' stroke-width='.6' opacity='.4'/>`;
  [[26, 24], [96, 24], [26, 80], [96, 80], [116, 70], [176, 70], [116, 114], [176, 114]].forEach(([x, y]) => { b += `<circle cx='${x}' cy='${y}' r='1.4' fill='#d9a441' opacity='.8'/>`; });
  return svgc(W, H, b, defs, '');
}

/** the floor: dark parquet with a brass inlay ring (a tile that repeats) */
function floor() {
  const W = 520, H = 120, rnd = rngOf(32);
  const defs = S.lg('fl', [[0, '#1a1c30'], [1, '#0a0b18']]) + brassGrad('br') + S.lg('fd', [[0, '#050814', 0], [1, '#050814', 0.7]]);
  let b = `<rect y='44' width='${W}' height='76' fill='url(#fl)'/>`;
  [56, 70, 86, 104].forEach((y, i) => { b += `<rect y='${y}' width='${W}' height='1.1' fill='#000' opacity='.55'/>`; let x = rnd.between(0, 30); while (x < W) { b += `<rect x='${n(x)}' y='${y + 1}' width='1' height='${[13, 15, 17, 16][i]}' fill='#000' opacity='.5'/>`; x += rnd.between(36, 70) + i * 8; } });
  for (let i = 0; i < 18; i++) b += `<rect x='${n(rnd.between(0, W))}' y='${n(rnd.between(48, 112))}' width='${n(rnd.between(10, 40))}' height='.6' fill='#7fb2ff' opacity='.07'/>`;
  b += `<ellipse cx='260' cy='96' rx='238' ry='22' fill='none' stroke='url(#br)' stroke-width='2.2' opacity='.5'/><ellipse cx='260' cy='96' rx='226' ry='19' fill='none' stroke='#d9a441' stroke-width='.6' opacity='.3'/>`;
  return svgc(W, H, b, defs, '');
}

/** the orrery (static part): brass orbit rings in three-quarter view, a column, a base, the sun; planets baked in for the still scene */
function orreryGeom() { return { W: 168, H: 120, cx: 84, cy: 70, ratio: 0.5, radii: [28, 46, 66] }; }
function orrery(planets) {
  const { W, H, cx, cy, ratio, radii } = orreryGeom();
  const defs = brassGrad('br') + S.rg('sun', [[0, '#fffbe0'], [0.5, '#ffcf6b'], [1, '#e88a1a']], 0.4, 0.38, 0.7) + glowDef('sg', '#ffd070', 0.8, 0.3) + S.lg('wd', [[0, '#3a2a18'], [1, '#150d06']]);
  let b = `<ellipse cx='${cx}' cy='108' rx='54' ry='8' fill='#000' opacity='.5'/>`;
  b += `<path d='M52 108Q56 98 66 96H102Q112 98 116 108Z' fill='url(#wd)'/><path d='M52 108Q56 98 66 96H102Q112 98 116 108' fill='none' stroke='url(#br)' stroke-width='1.4'/>`;
  b += `<rect x='80' y='${cy}' width='8' height='28' fill='url(#br)'/>`;
  radii.forEach((r, i) => { b += `<ellipse cx='${cx}' cy='${cy}' rx='${r}' ry='${n(r * ratio)}' fill='none' stroke='#2a1c06' stroke-width='${n(2.6 - i * 0.2)}' opacity='.7'/><ellipse cx='${cx}' cy='${cy}' rx='${r}' ry='${n(r * ratio)}' fill='none' stroke='url(#br)' stroke-width='${n(1.8 - i * 0.2)}'/>`; });
  b += `<ellipse cx='${cx}' cy='${cy}' rx='${radii[2] + 6}' ry='${n((radii[2] + 6) * ratio)}' fill='none' stroke='#d9a441' stroke-width='.6' stroke-dasharray='1 3' opacity='.7'/>`;
  b += `<circle cx='${cx}' cy='${cy}' r='20' fill='url(#sg)'/><circle cx='${cx}' cy='${cy}' r='8.4' fill='url(#sun)'/>`;
  if (planets) b += planetBeads(0, true);
  return svgc(W, H, b, defs, '');
}
const PLANETS = [[28, 20, '#7fb2ff', 5], [46, 150, '#ff8a5a', 6.4], [66, 250, '#ffe08a', 7.6], [66, 70, '#9fffd0', 4.6]];
/** the planets as glowing beads on their orbits at angle a0 (degrees); flat=true draws them squashed like the static ellipse view */
function planetBeads(a0, flat) {
  const { cx, cy, ratio } = orreryGeom();
  return PLANETS.map(([r, a, c, s]) => {
    const t = ((a + a0) * Math.PI) / 180, x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r * (flat ? ratio : 1);
    return `<ellipse cx='${n(x)}' cy='${n(y)}' rx='${n(s * 2.2)}' ry='${n(s * 2.2 * (flat ? ratio : 1))}' fill='${c}' opacity='.28'/><ellipse cx='${n(x)}' cy='${n(y)}' rx='${s}' ry='${n(s * (flat ? ratio : 1))}' fill='${c}'/><ellipse cx='${n(x - s * 0.3)}' cy='${n(y - s * 0.3 * (flat ? ratio : 1))}' rx='${n(s * 0.4)}' ry='${n(s * 0.4 * (flat ? ratio : 1))}' fill='#fff' opacity='.8'/>`;
  }).join('');
}
/** the moving layer: the same planets on circular orbits in a square box (squashed by the layer's own transform) */
function planets() {
  const { W, cx } = orreryGeom(), S2 = 150, off = S2 / 2 - cx;
  const defs = '';
  let b = `<g transform='translate(${off} ${off - 0})'>${PLANETS.map(([r, a, c, s]) => {
    const t = (a * Math.PI) / 180, x = 84 + Math.cos(t) * r, y = 84 + Math.sin(t) * r;
    return `<circle cx='${n(x)}' cy='${n(y)}' r='${n(s * 2.2)}' fill='${c}' opacity='.28'/><circle cx='${n(x)}' cy='${n(y)}' r='${s}' fill='${c}'/><circle cx='${n(x - s * 0.3)}' cy='${n(y - s * 0.3)}' r='${n(s * 0.4)}' fill='#fff' opacity='.8'/>`;
  }).join('')}</g>`;
  return svgc(S2, S2, b, defs, '');
}

/** a brass celestial globe on a stand and a roll of charts */
function globe() {
  const W = 92, H = 96;
  const defs = brassGrad('br') + S.rg('gl', [[0, '#2a4a8a'], [0.6, '#10224a'], [1, '#060d20']], 0.36, 0.3, 0.8) + glowDef('gg', CHART, 0.4, 0.14);
  let b = `<ellipse cx='46' cy='90' rx='34' ry='4.4' fill='#000' opacity='.5'/>`;
  b += `<path d='M24 90L34 74H58L68 90Z' fill='#150d06'/><path d='M24 90L34 74M68 90L58 74' stroke='url(#br)' stroke-width='2'/><rect x='43' y='56' width='6' height='20' fill='url(#br)'/>`;
  b += `<circle cx='46' cy='34' r='30' fill='url(#gg)'/><circle cx='46' cy='34' r='24' fill='url(#gl)'/>`;
  b += `<ellipse cx='46' cy='34' rx='24' ry='8' fill='none' stroke='#cfe0ff' stroke-width='.6' opacity='.4'/><ellipse cx='46' cy='34' rx='10' ry='24' fill='none' stroke='#cfe0ff' stroke-width='.6' opacity='.35'/>`;
  [[36, 24], [52, 20], [58, 36], [40, 44], [30, 36], [48, 30]].forEach(([x, y]) => { b += `<circle cx='${x}' cy='${y}' r='1.2' fill='#fff' opacity='.9'/>`; });
  b += `<path d='M36 24L48 30L52 20M48 30L58 36M40 44L48 30' fill='none' stroke='${CHART}' stroke-width='.6' opacity='.6'/>`;
  b += `<path d='M22 22A27 27 0 0 1 70 22' fill='none' stroke='url(#br)' stroke-width='2.4'/><path d='M22 46A27 27 0 0 0 70 46' fill='none' stroke='url(#br)' stroke-width='2.4'/><path d='M70 22V46M22 22V46' stroke='url(#br)' stroke-width='2.4'/>`;
  b += `<path d='M34 22A24 24 0 0 1 52 12' stroke='#fff' stroke-width='1.2' fill='none' opacity='.45' stroke-linecap='round'/>`;
  return svgc(W, H, b, defs, '');
}
function shoot() {
  const W = 70, H = 8;
  const defs = S.lg('t', [[0, '#cfe8ff', 0], [0.7, '#cfe8ff', 0.5], [1, '#fff', 1]], 0, 0, 1, 0) + glowDef('h', '#fff', 0.9, 0.3);
  return svgc(W, H, `<path d='M0 4L66 3L66 5Z' fill='url(#t)'/><circle cx='64' cy='4' r='4' fill='url(#h)'/><circle cx='65' cy='4' r='1.5' fill='#fff'/>`, defs, '');
}

function capDraw() {
  const defs = brassGrad('cg', [0, 0, 1, 1]) + S.rg('bo', [[0, '#fff8d0'], [0.4, '#d9a441'], [1, '#6a4a10']], 0.36, 0.34, 0.7);
  let b = `<path d='M0 44V33A33 33 0 0 1 33 0H44V9H33A24 24 0 0 0 9 33V44Z' fill='url(#cg)'/>`;
  b += `<path d='M0 44V33A33 33 0 0 1 33 0H44' fill='none' stroke='#fff6d0' stroke-width='.9' opacity='.8'/><path d='M44 9H33A24 24 0 0 0 9 33V44' fill='none' stroke='#2a1c06' stroke-width='.9' opacity='.8'/>`;
  // a little compass star at the corner
  b += `<path d='M12.7 5L14.6 11L20.4 12.7L14.6 14.4L12.7 20.4L10.8 14.4L5 12.7L10.8 11Z' fill='#2a1c06' opacity='.85'/><path d='M12.7 6.6L14 11.4L18.8 12.7L14 14L12.7 18.8L11.4 14L6.6 12.7L11.4 11.4Z' fill='url(#bo)'/><circle cx='12.7' cy='12.7' r='1.2' fill='#7fb2ff'/>`;
  return { defs, body: b };
}

function css() {
  const th = 'var(--s4-th)', bh = 'var(--s4-bh)', K = (v, k) => `calc(${v} * ${k})`;
  const P = {
    sky: { fx: 0, band: 'top', h: th, a: 1.2, dy: '0px' },
    shutL: { fx: -0.0, band: 'top', h: th, a: 0.44, dy: '0px' },
    scope: { fx: -0.27, band: 'top', h: K(th, 0.92), a: 1.4, dy: K(th, 0.0) },
    mount: { fx: -0.27, dx: K(th, -0.478), band: 'top', h: K(th, 0.6), a: 44 / 60, dy: K(th, 0.564) },
    orrery: { fx: 0.12, band: 'bottom', h: K(bh, 0.6), a: 168 / 120, dy: K(bh, 0.04) },
    globe: { fx: -0.36, band: 'bottom', h: K(bh, 0.52), a: 92 / 96, dy: K(bh, 0.06) },
  };
  // the slit is 32 to 56 units wide of a 100-unit-tall tile; the tile's pixel scale is th/100, so a shutter is 12 units (at rest) away from the centre
  const R = registry('observatory');
  const svg = { dome: dome(), sky: sky(), stars: stars(), shutL: shutter(true), shutR: shutter(false), scope: scope(), mount: mount(), wall: wall(), floor: floor(), orrery: orrery(false), orreryStill: orrery(true), planets: planets(), globe: globe(), shoot: shoot() };
  const ref = {}; Object.keys(svg).forEach((k) => { ref[k] = R.add(k, svg[k]); });
  const caps = L.cornerCaps(R, 'ob', capDraw);
  const tDome = bgTile(ref.dome, 'top', th), tFloor = bgTile(ref.floor, 'bottom', bh);
  const wallL = `${ref.wall} repeat 50% 0 / auto 96px`;
  const sShutL = bgPiece(ref.shutL, { fx: 0, band: 'top', h: th, a: 0.44, dx: `calc(${th} * -0.36)` });
  const sShutR = bgPiece(ref.shutR, { fx: 0, band: 'top', h: th, a: 0.44, dx: `calc(${th} * 0.36)` });
  const pSky = bgPiece(ref.sky, P.sky), pStars = bgTile(ref.stars, 'top', th);
  const pMount = bgPiece(ref.mount, P.mount), pScope = bgPiece(ref.scope, P.scope);
  const pOrr = bgPiece(ref.orrery, P.orrery), pOrrS = bgPiece(ref.orreryStill, P.orrery), pGlobe = bgPiece(ref.globe, P.globe);
  const floorGlow = 'radial-gradient(ellipse 40% 26% at calc(var(--s4-cx) + var(--s4-cw) * 0.12) 100%, rgba(255, 207, 107, 0.3), transparent 80%)';
  const base = 'linear-gradient(180deg, #0a1430 0%, #0b1632 50%, #080f26 100%)';
  const wallFade = 'linear-gradient(180deg, rgba(8, 16, 38, 0.7), rgba(8, 16, 38, 0.2) 40%, rgba(8, 16, 38, 0.2) 70%, rgba(8, 16, 38, 0.5))';
  // static scene: the dome overlay above the stars and the sky; in a run the overlay is its own layer (.scene-fx) so the stars can move under it
  const stat = [pScope, pMount, sShutL, sShutR, tDome, pStars, pSky, pGlobe, pOrrS, floorGlow, tFloor, wallFade, wallL, base];
  const run = [pGlobe, pOrr, floorGlow, tFloor, pSky, wallFade, wallL, base];
  return {
    plate: [4, 9, 24, 0.8],
    vars: `
  --a-bg: ${stat.join(',\n    ')};
  --a-bg-run: ${run.join(',\n    ')};
  --a-board: linear-gradient(180deg, #070f22, #03060f);
  --a-frame: #d9a441;
  --a-glow: rgba(127, 178, 255, 0.25);${R.decls()}`,
    run: `
.board-observatory .run-active .bg::before { display: block; left: 0; width: calc(100% + 260px); top: 0; height: var(--s4-th); background: ${ref.stars} repeat-x 0 0 / 260px 100px; will-change: transform; animation: s4Stars 70s linear infinite; }
.board-observatory .run-active .bg .scene-fx { display: block; left: 0; right: 0; top: 0; width: auto; height: var(--s4-th); background: ${pMount}, ${tDome}; animation: none; will-change: auto; }
.board-observatory .run-active .bg .scene-fx.b { display: none; }
.board-observatory .run-active .bg::after { display: block; left: calc(var(--s4-cx) + var(--s4-cw) * 0.12 - var(--s4-bh) * 0.375); bottom: calc(var(--s4-bh) * 0.29 - var(--s4-bh) * 0.375); width: calc(var(--s4-bh) * 0.75); height: calc(var(--s4-bh) * 0.75); background: ${ref.planets} no-repeat center / 100% 100%; transform-origin: 50% 50%; will-change: transform; animation: s4Orbit 46s linear infinite; }
/* moment layers (js/s4-scenes.js) */
.board-observatory .bg .s4x { position: absolute; pointer-events: none; }
.board-observatory .bg .s4x.shutL { ${boxCSS({ fx: 0, band: 'top', h: th, a: 0.44, dx: `calc(${th} * -0.36)` })} background: ${ref.shutL} no-repeat center / 100% 100%; }
.board-observatory .bg .s4x.shutR { ${boxCSS({ fx: 0, band: 'top', h: th, a: 0.44, dx: `calc(${th} * 0.36)` })} background: ${ref.shutR} no-repeat center / 100% 100%; }
.board-observatory .bg .s4x.scope { ${boxCSS(P.scope)} background: ${ref.scope} no-repeat center / 100% 100%; transform-origin: 12.9% 82%; }
.board-observatory .bg .s4x.shoot { left: calc(var(--s4-cx) - var(--s4-th) * 0.2); top: calc(var(--s4-th) * 0.02); width: calc(var(--s4-th) * 0.34); height: calc(var(--s4-th) * 0.06); background: ${ref.shoot} no-repeat center / 100% 100%; opacity: 0; transform-origin: 100% 50%; }
.board-observatory .board-wrap .s4x.notch { position: absolute; top: -9px; left: 19.5px; width: 9px; height: 9px; z-index: 3; pointer-events: none; background: linear-gradient(180deg, #fff6c8, #ffd36b 55%, #b8741c); clip-path: polygon(50% 100%, 0 0, 100% 0); }
`,
    frame: L.frameCSS('board-observatory', {
      ring: [[1.5, '#1a1206'], [5, '#b8862e'], [6, '#ffe9a8'], [8, '#4a3208'], [9, '#7fb2ff']],
      drop: '0 0 12px rgba(127, 178, 255, 0.22), 0 8px 22px rgba(0, 0, 0, 0.55)',
      tooled: 'inset 0 0 0 1.4px rgba(217, 164, 65, 0.65), inset 0 0 0 2.6px rgba(0, 0, 0, 0.4), inset 0 0 0 3.5px rgba(127, 178, 255, 0.3)',
      caps: { tl: R.ref('captl'), tr: R.ref('captr'), bl: R.ref('capbl'), br: R.ref('capbr') },
      glow: 'rgba(127, 178, 255, 0.25)',
      strips: [
        'repeating-linear-gradient(90deg, rgba(42, 28, 6, 0.95) 0 1.4px, transparent 1.4px 30px) 33px 1.5px / calc(100% - 66px) 6px no-repeat', 'repeating-linear-gradient(90deg, rgba(42, 28, 6, 0.8) 0 0.8px, transparent 0.8px 6px) 33px 2.5px / calc(100% - 66px) 3.5px no-repeat',
        'repeating-linear-gradient(90deg, rgba(42, 28, 6, 0.95) 0 1.4px, transparent 1.4px 30px) 33px calc(100% - 7.5px) / calc(100% - 66px) 6px no-repeat', 'repeating-linear-gradient(90deg, rgba(42, 28, 6, 0.8) 0 0.8px, transparent 0.8px 6px) 33px calc(100% - 6px) / calc(100% - 66px) 3.5px no-repeat',
        'repeating-linear-gradient(0deg, rgba(42, 28, 6, 0.95) 0 1.4px, transparent 1.4px 30px) 1.5px 33px / 6px calc(100% - 66px) no-repeat', 'repeating-linear-gradient(0deg, rgba(42, 28, 6, 0.8) 0 0.8px, transparent 0.8px 6px) 2.5px 33px / 3.5px calc(100% - 66px) no-repeat',
        'repeating-linear-gradient(0deg, rgba(42, 28, 6, 0.95) 0 1.4px, transparent 1.4px 30px) calc(100% - 7.5px) 33px / 6px calc(100% - 66px) no-repeat', 'repeating-linear-gradient(0deg, rgba(42, 28, 6, 0.8) 0 0.8px, transparent 0.8px 6px) calc(100% - 6px) 33px / 3.5px calc(100% - 66px) no-repeat',
      ],
    }),
  };
}
module.exports = { dome, sky, stars, shutL: () => shutter(true), scope, mount, wall, floor, orrery: () => orrery(true), planets, globe, shoot, css };
