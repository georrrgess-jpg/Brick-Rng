// SVG helpers for the Update 4 board scenes. Everything returns plain strings; scenes become CSS data URIs.
const fs = require('fs');

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const n = (x) => { const v = Math.round(x * 10) / 10; return Object.is(v, -0) ? 0 : v; };
const attrs = (o) => Object.entries(o || {}).map(([k, v]) => ` ${k}='${v}'`).join('');

const S = {
  svg: (w, h, body, defs = '', pre = 'none') => `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' preserveAspectRatio='${pre}'>${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`,
  circ: (cx, cy, r, fill, o) => `<circle cx='${n(cx)}' cy='${n(cy)}' r='${n(r)}' fill='${fill}'${attrs(o)}/>`,
  ell: (cx, cy, rx, ry, fill, o) => `<ellipse cx='${n(cx)}' cy='${n(cy)}' rx='${n(rx)}' ry='${n(ry)}' fill='${fill}'${attrs(o)}/>`,
  rect: (x, y, w, h, fill, o) => `<rect x='${n(x)}' y='${n(y)}' width='${n(w)}' height='${n(h)}' fill='${fill}'${attrs(o)}/>`,
  path: (d, fill, o) => `<path d='${d}' fill='${fill}'${attrs(o)}/>`,
  stroke: (d, color, w, o) => `<path d='${d}' fill='none' stroke='${color}' stroke-width='${w}'${attrs(o)}/>`,
  line: (x1, y1, x2, y2, color, w, o) => `<path d='M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}' fill='none' stroke='${color}' stroke-width='${w}'${attrs(o)}/>`,
  poly: (pts, fill, o) => `<path d='M${pts.map((p) => n(p[0]) + ' ' + n(p[1])).join('L')}Z' fill='${fill}'${attrs(o)}/>`,
  g: (body, o) => `<g${attrs(o)}>${body}</g>`,
  lg: (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id='${id}' x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}'>${stops.map(([o, c, a]) => `<stop offset='${o}' stop-color='${c}'${a != null ? ` stop-opacity='${a}'` : ''}/>`).join('')}</linearGradient>`,
  rg: (id, stops, cx = 0.5, cy = 0.5, r = 0.5, fx, fy) => `<radialGradient id='${id}' cx='${cx}' cy='${cy}' r='${r}'${fx != null ? ` fx='${fx}' fy='${fy}'` : ''}>${stops.map(([o, c, a]) => `<stop offset='${o}' stop-color='${c}'${a != null ? ` stop-opacity='${a}'` : ''}/>`).join('')}</radialGradient>`,
  star4: (cx, cy, r, fill, o) => `<path d='M${n(cx)} ${n(cy - r)}L${n(cx + r * 0.2)} ${n(cy - r * 0.2)}L${n(cx + r)} ${n(cy)}L${n(cx + r * 0.2)} ${n(cy + r * 0.2)}L${n(cx)} ${n(cy + r)}L${n(cx - r * 0.2)} ${n(cy + r * 0.2)}L${n(cx - r)} ${n(cy)}L${n(cx - r * 0.2)} ${n(cy - r * 0.2)}Z' fill='${fill}'${attrs(o)}/>`,
};

/** draw fn(dx) three times (dx = -W, 0, +W) so shapes that cross the tile edge wrap seamlessly when the tile repeats */
const wrap = (W, fn) => fn(-W) + fn(0) + fn(W);

/** Catmull-Rom spline through points -> cubic Bezier path (open). */
function smooth(pts, tension = 0.5) {
  let d = `M${n(pts[0][0])} ${n(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const k = tension / 3;
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d;
}

/** a tapered ribbon along a centre line: points [[x,y]...] and half widths [w...] */
function ribbon(pts, ws) {
  const L = [], Rr = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    L.push([pts[i][0] - dy * ws[i], pts[i][1] + dx * ws[i]]); Rr.push([pts[i][0] + dy * ws[i], pts[i][1] - dx * ws[i]]);
  }
  const all = L.concat(Rr.reverse());
  return smoothClosed(all);
}
function smoothClosed(pts) {
  // simple closed spline: reuse smooth on the loop with wrapped neighbours
  const N = pts.length; let d = `M${n(pts[0][0])} ${n(pts[0][1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d + 'Z';
}

/** percent-encode an SVG for a CSS data URI inside double quotes */
const enc = (s) => s.replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'").replace(/\s+/g, ' ');
const url = (svg) => `url("data:image/svg+xml,${enc(svg)}")`;

module.exports = { S, mulberry32, n, wrap, smooth, ribbon, smoothClosed, enc, url, fs };
