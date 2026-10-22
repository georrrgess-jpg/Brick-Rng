// Helpers for the Series 4 "Moonwick" board scenes. Re-exports the Update 4 SVG helpers (tools/u4-boards-gen/lib.js) and adds
// colour maths, rough edges, glows and the CSS placement helpers every board shares. Everything returns plain strings.
const base = require('../u4-boards-gen/lib');
const { S, mulberry32, n, wrap, smooth, ribbon, smoothClosed, enc, url } = base;

// ---------------------------------------------------------------- colour
const hex2 = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** mix colour a toward b by t (0..1) */
const mix = (a, b, t) => { const A = hex2(a), B = hex2(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#000000', t);

// ---------------------------------------------------------------- random
const rngOf = (seed) => { const r = mulberry32(seed); return { f: r, between: (a, b) => a + (b - a) * r(), int: (a, b) => Math.floor(a + (b - a + 1) * r()), pick: (arr) => arr[Math.floor(r() * arr.length)], chance: (p) => r() < p }; };

// ---------------------------------------------------------------- svg bits
const XL = " xmlns:xlink='http://www.w3.org/1999/xlink'";
/** an svg document with xlink (for <use>) */
const svgx = (w, h, body, defs, pre = 'none') => S.svg(w, h, body, defs, pre).replace("xmlns='http://www.w3.org/2000/svg'", "xmlns='http://www.w3.org/2000/svg'" + XL);
/** an svg with a <style> block (short class names keep the data URI small) */
const svgc = (w, h, body, defs, css, pre = 'none') => svgx(w, h, body, (css ? `<style>${css}</style>` : '') + (defs || ''), pre);
const use = (id, x, y, sx = 1, sy = sx, extra = '') => `<use xlink:href='#${id}' transform='translate(${n(x)} ${n(y)}) scale(${sx} ${sy})'${extra}/>`;
const op = (v) => ({ 'fill-opacity': +(+v).toFixed(2) });
const sop = (v) => ({ 'stroke-opacity': +(+v).toFixed(2) });
/** a soft glow: a radial gradient disc (alpha falls to 0) */
const glowDef = (id, color, a0 = 0.9, mid = 0.3) => S.rg(id, [[0, color, a0], [0.35, color, mid], [1, color, 0]]);
const glowDisc = (id, cx, cy, r) => S.circ(cx, cy, r, `url(#${id})`);
const glowEll = (id, cx, cy, rx, ry) => S.ell(cx, cy, rx, ry, `url(#${id})`);
/** a polygon of straight segments with a little roughness on every vertex */
const rough = (pts, rnd, amt) => pts.map((p) => [p[0] + (rnd.f() - 0.5) * amt, p[1] + (rnd.f() - 0.5) * amt]);
/** a smooth closed blob (circle-ish) with radial noise */
function blob(cx, cy, r, rnd, k = 0.25, N = 9) {
  const pts = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, rr = r * (1 + (rnd.f() - 0.5) * 2 * k); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return smoothClosed(pts);
}
/** a regular polygon / star path */
const starPath = (cx, cy, r1, r2, pts, rot = -Math.PI / 2) => { let d = ''; for (let i = 0; i < pts * 2; i++) { const a = rot + (i * Math.PI) / pts, r = i % 2 ? r2 : r1; d += (i ? 'L' : 'M') + n(cx + Math.cos(a) * r) + ' ' + n(cy + Math.sin(a) * r); } return d + 'Z'; };
const rrect = (x, y, w, h, r, fill, o) => S.path(`M${n(x + r)} ${n(y)}H${n(x + w - r)}Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)}V${n(y + h - r)}Q${n(x + w)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}H${n(x + r)}Q${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - r)}V${n(y + r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}Z`, fill, o);

// ---------------------------------------------------------------- CSS placement
/* Pieces are placed from the board's own CSS variables so the same art works in a run (the centred HUD column, --s4-cw = --bw), in a
   badge, the reveal and the previews (--s4-cw = 100% of the box). fx is the piece centre as a fraction of the column width, h is the
   piece height as a CSS length (usually a multiple of the band height), a its width / height. */
const calcMul = (expr, k) => `calc(${expr} * ${k})`;
function bgPiece(src, spec) {
  const { fx = 0, band = 'top', h, a, dy = '0px', dx = '0px', repeat = 'no-repeat' } = spec;
  const x = `calc(var(--s4-cx) + var(--s4-cw) * ${fx} + ${dx})`;
  const y = band === 'bottom' ? `calc(100% - ${dy})` : dy;
  return `${src} ${repeat} ${x} ${y} / auto ${h}`;
}
/** a registry of the board's pictures: each is written once as a custom property and referenced by var() (the static and the run
    background both use them, and so would a moving layer) */
function registry(board) {
  const m = new Map();
  return {
    add(name, svg) { m.set(name, svg); return `var(--s4-${board}-${name})`; },
    ref: (name) => `var(--s4-${board}-${name})`,
    decls() { return Array.from(m).map(([k, v]) => `\n  --s4-${board}-${k}: ${url(v)};`).join(''); },
    bytes() { return Array.from(m).reduce((a, [, v]) => a + v.length, 0); },
  };
}
/** the same placement as left/top/width/height for a DOM element (a moving layer that sits exactly over its static twin) */
function boxCSS(spec) {
  const { fx = 0, band = 'top', h, a, dy = '0px', dx = '0px' } = spec;
  const w = `calc(${h} * ${a})`;
  return `left: calc(var(--s4-cx) + var(--s4-cw) * ${fx} + ${dx} - ${w} / 2); ${band === 'bottom' ? `bottom: ${dy}` : `top: ${dy}`}; width: ${w}; height: ${h};`;
}
const bgTile = (src, band, h, pos = '50%') => `${src} repeat-x ${pos} ${band === 'bottom' ? '100%' : '0'} / auto ${h}`;

// ---------------------------------------------------------------- the frame
/* The frame is a ring drawn outside the board (box-shadow rings on .board-wrap::before, under the board so the board's own aiming
   ring stays on top), four corner pieces on .board-wrap::after, and tooled lines inside the brick field's margin (.board::after).
   Nothing of it is drawn over the brick field. rw is the ring width (the gutter beside the board on a phone is 12px). */
const RW = 9, CAP = 44, BR = 24;
const capSize = (rw) => BR + rw + 11;
/** four mirrored corner pictures from one top-left drawing in a size x size box (size = 24 + rw + 11 = 44 for the usual 9px ring). draw(rw, size)
    returns { defs, body }. The ring band at the corner is the quarter annulus between radius 24 and 24 + rw around (24 + rw, 24 + rw). */
function cornerCaps(registry, name, draw, rw = RW) {
  const size = capSize(rw), d = draw(rw, size);
  const flips = { tl: '', tr: ` transform='translate(${size} 0) scale(-1 1)'`, bl: ` transform='translate(0 ${size}) scale(1 -1)'`, br: ` transform='translate(${size} ${size}) scale(-1 -1)'` };
  const out = {};
  Object.entries(flips).forEach(([k, t]) => { out[k] = registry.add('cap' + k, svgx(size, size, `<g${t}>${d.body}</g>`, d.defs || '')); });
  return out;
}
/** css for a board's frame: ring = [[spread px, colour], ...] inner to outer, drop = the soft shadow under the ring, tooled = inset box-shadow
    inside the board, caps = { tl, tr, bl, br } references, glow = the board's own outer glow colour, strips = more background layers for the ring */
function frameCSS(cls, { ring, drop = '0 8px 22px rgba(0, 0, 0, 0.55)', tooled, caps, glow = 'var(--a-glow)', rw = RW, strips = [], boardBg = '' }) {
  const shadows = ring.map(([s, c]) => `0 0 0 ${s}px ${c}`).concat([drop]).join(', '), size = capSize(rw);
  let c = `.${cls} .board-wrap::before { content: ''; position: absolute; inset: 0; border-radius: ${BR}px; pointer-events: none; box-shadow: ${shadows}; }\n`;
  if (caps) c += `.${cls} .board-wrap::after { content: ''; position: absolute; inset: -${rw}px; border-radius: ${BR + rw}px; pointer-events: none; background: ${[caps.tl + ` no-repeat left top / ${size}px ${size}px`, caps.tr + ` no-repeat right top / ${size}px ${size}px`, caps.bl + ` no-repeat left bottom / ${size}px ${size}px`, caps.br + ` no-repeat right bottom / ${size}px ${size}px`].concat(strips).join(', ')}; }\n`;
  c += `.${cls} .board { box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.55), 0 0 36px ${glow}, inset 0 2px 0 rgba(255, 255, 255, 0.05), inset 0 0 40px rgba(0, 0, 0, 0.45); }\n`;
  if (tooled || boardBg) c += `.${cls} .board::after { ${tooled ? `box-shadow: ${tooled}; ` : ''}${boardBg ? `background: ${boardBg}; ` : ''}}\n`;
  return c;
}

module.exports = Object.assign({}, base, { cornerCaps, frameCSS, capSize, RW, CAP, BR, svgc, S, mix, lighten, darken, hex2, toHex, rngOf, XL, svgx, use, op, sop, glowDef, glowDisc, glowEll, rough, blob, starPath, rrect, bgPiece, registry, boxCSS, bgTile, calcMul, wrap, smooth, smoothClosed, ribbon, n, url, enc, mulberry32 });
