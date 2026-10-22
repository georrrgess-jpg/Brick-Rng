/* Fuse art as data (Update 4, section 5.4). Each fuse cosmetic is a block of TOKENS: rope texture and states, flame colors and
   shape, ember / ash / heat / smoke colors, particle recipe, bomb body, face style and frost tint. js/fuse.js turns the tokens into
   one generated stylesheet (CSS custom properties on `.fuse-xxx`) and into the particle sprites; nothing about a single fuse lives in
   hand-written CSS any more. The same stylesheet dresses the small `.mini-fuse` previews (badges, Collection, the reveal).
   Pure strings and numbers, no DOM: this file also loads in Node. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  /** A CSS url("data:...") for an SVG string (single quotes inside, so the double quotes of url() are safe). */
  const uri = (svg) => 'url("data:image/svg+xml,' + svg.replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'").replace(/\s+/g, ' ').trim() + '")';
  const svg = (inner, defs, vb) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb || '0 0 64 64'}'>${defs ? `<defs>${defs}</defs>` : ''}${inner}</svg>`;
  const stops = (a) => a.map(([o, c, op]) => `<stop offset='${o}' stop-color='${c}'${op != null ? ` stop-opacity='${op}'` : ''}/>`).join('');
  const rg = (id, a, cx, cy, r) => `<radialGradient id='${id}' cx='${cx == null ? 0.34 : cx}' cy='${cy == null ? 0.28 : cy}' r='${r == null ? 0.85 : r}'>${stops(a)}</radialGradient>`;
  const lg = (id, a, x1, y1, x2, y2) => `<linearGradient id='${id}' x1='${x1 || 0}' y1='${y1 || 0}' x2='${x2 || 0}' y2='${y2 == null ? 1 : y2}'>${stops(a)}</linearGradient>`;
  const f1 = (n) => Math.round(n * 10) / 10;

  /* ------------------------------------------------------------------ rope textures (CSS `background` values)
     The rope is revealed, not squashed (see css/fuse.css: a clip scales and its content scales back), so a tile keeps its real size. */
  const shade = 'linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0) 46%, rgba(0,0,0,0.30))';
  const R = {
    /** twisted cord: diagonal bands of two tones */
    twist: (a, b, w = 6, ang = 115) => `${shade}, repeating-linear-gradient(${ang}deg, ${a} 0 ${w}px, ${b} ${w}px ${w * 2}px)`,
    /** thick braided rope: three tones */
    braid: (a, b, c) => `${shade}, repeating-linear-gradient(118deg, ${c} 0 3px, ${a} 3px 6px, ${b} 6px 8px), ${a}`,
    /** thin metal wire: lengthwise strand pattern with a bright top */
    wire: (a, b) => `linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0) 42%, rgba(0,0,0,0.32)), repeating-linear-gradient(90deg, ${a} 0 3px, ${b} 3px 6px)`,
    /** glass tube with a glowing core */
    tube: (a, b, c) => `linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 40%), linear-gradient(90deg, ${a}, ${b} 72%, ${c})`,
    /** peppermint stripes */
    stripes: (a, b, w = 7) => `linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0) 46%, rgba(110,0,40,0.3)), repeating-linear-gradient(-58deg, ${a} 0 ${w}px, ${b} ${w}px ${w * 2}px)`,
    /** copper rod: dark joints every 32px */
    segs: (top, mid, low, dark) => `linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0) 38%), repeating-linear-gradient(90deg, transparent 0 28px, rgba(60,22,6,0.55) 28px 31px, rgba(255,215,170,0.45) 31px 32px), linear-gradient(180deg, ${top} 0, ${mid} 22%, ${low} 58%, ${dark} 100%)`,
    /** frozen: slanted glints over a pale blue gradient */
    ice: (a, b, c) => `repeating-linear-gradient(64deg, rgba(255,255,255,0.75) 0 2px, transparent 2px 9px), linear-gradient(180deg, ${a}, ${b} 55%, ${c})`,
    /** dragon scales */
    scales: (a, b, c, d, e) => `radial-gradient(circle at 50% 120%, ${a} 0 28%, ${b} 30% 52%, ${c} 54% 74%, ${d} 76%) 0 0 / 11px 9px, linear-gradient(180deg, ${e}, ${d})`,
    /** plasma: lengthwise sparks over violet */
    plasma: (a, b, c) => `repeating-linear-gradient(100deg, rgba(255,255,255,0.9) 0 2px, transparent 2px 7px, rgba(255,255,255,0.5) 7px 8px, transparent 8px 15px), linear-gradient(180deg, ${a}, ${b} 50%, ${c})`,
    /** a flat tint over another texture (used for the Low and Critical states of fuses that do not redraw themselves) */
    tint: (c) => `linear-gradient(${c}, ${c})`,
  };
  /** Vine: a wavy stem with four leaves, 44x22 tile. leaf1 / leaf2 are the two greens (autumn colors when it dries). */
  const vineTile = (stem, stemHi, leaf1, leaf2, outline, extra) => uri(svg(
    `<path d='M-2 11C8 8 14 8 22 11S36 14 46 11' fill='none' stroke='${outline}' stroke-width='10' stroke-linecap='round'/><path d='M-2 11C8 8 14 8 22 11S36 14 46 11' fill='none' stroke='${stem}' stroke-width='7.6' stroke-linecap='round'/><path d='M-2 9C8 6 14 6 22 9S36 12 46 9' fill='none' stroke='${stemHi}' stroke-width='1.8' stroke-linecap='round' stroke-opacity='.8'/>` +
    [[8, 8.6, -38, 1.6, leaf1], [20, 13.2, 142, 1.6, leaf2], [31, 9.6, -142, 1.5, leaf1], [42, 12.6, 38, 1.5, leaf2]].map(([x, y, r, s, c]) =>
      `<g transform='translate(${x} ${y}) rotate(${r}) scale(${s})'><path d='M0 0C-1-6 4-9 9-8C9-3 5 1 0 0z' fill='${c}' stroke='${outline}' stroke-width='.7' stroke-linejoin='round'/><path d='M1 -1C4-3 6-5 8-7' stroke='#1b8a45' stroke-width='.8' fill='none'/></g>`).join('') + (extra || ''), '', '0 0 44 22'));
  /** Phoenix: shingled feathers, 48x24 tile. c0 root, c1 mid, c2 tip. */
  const featherTile = (c0, c1, c2) => {
    const one = (tr) => `<g transform='${tr}'><path d='M0 0Q12.6 -6.2 32.8 -2.5Q43.7 0 32.8 2.5Q12.6 6.2 0 0z' fill='url(#ft)' stroke='${c0}' stroke-width='.6' stroke-opacity='.7'/><path d='M1 0H38.6' stroke='${c0}' stroke-width='.7' stroke-opacity='.65'/></g>`;
    const big = (tr) => `<g transform='${tr}'><path d='M0 0Q15 -7.6 39 -3Q52 0 39 3Q15 7.6 0 0z' fill='url(#ft)' stroke='${c0}' stroke-width='.6' stroke-opacity='.7'/><path d='M1 0H46' stroke='${c0}' stroke-width='.7' stroke-opacity='.65'/></g>`;
    const sm = (tr) => `<g transform='${tr}'><path d='M0 0Q9.6 -5.2 25 -2.1Q33.3 0 25 2.1Q9.6 5.2 0 0z' fill='url(#ft)' stroke='${c0}' stroke-width='.6' stroke-opacity='.7'/><path d='M1 0H29.4' stroke='${c0}' stroke-width='.7' stroke-opacity='.65'/></g>`;
    return uri(svg(
      one('translate(-54 4.5) rotate(13)') + one('translate(-38 19.5) rotate(-13)') + big('translate(-47 12) rotate(0)') + sm('translate(-22 7) rotate(9)') + sm('translate(-18 17) rotate(-9)') +
      one('translate(-6 4.5) rotate(13)') + one('translate(10 19.5) rotate(-13)') + big('translate(1 12) rotate(0)') + sm('translate(26 7) rotate(9)') + sm('translate(30 17) rotate(-9)'),
      `<linearGradient id='ft' x1='0' y1='0' x2='1' y2='0'>${stops([[0, c0], [0.55, c1], [1, c2]])}</linearGradient>`, '0 0 48 24'));
  };

  /* ------------------------------------------------------------------ bomb bodies (64x64, drawn per fuse; the face is a separate layer) */
  const GL = lg('gl', [[0, '#fff', 0.7], [1, '#fff', 0]]);
  const gloss = (op) => `<ellipse cx='21.5' cy='22.5' rx='11' ry='6.2' transform='rotate(-34 21.5 22.5)' fill='url(#gl)' opacity='${op == null ? 1 : op}'/>`;
  const shadow = '<ellipse cx="32" cy="61.5" rx="19" ry="2.8" fill="#000" opacity=".3"/>';
  const rim = (c, op) => `<path d='M52 50A24.5 24.5 0 0 1 25 59.5' fill='none' stroke='${c}' stroke-opacity='${op == null ? 0.5 : op}' stroke-width='2' stroke-linecap='round'/>`;
  const BALL = '<circle cx="32" cy="36" r="26"';
  const EGG = 'M32 8C46 8 57 24 57 38C57 52 46 62 32 62C18 62 7 52 7 38C7 24 18 8 32 8Z';

  const BODY = {
    classic: (P, o = {}) => svg(
      shadow + `${BALL} fill='url(#b)' stroke='${P.edge}' stroke-width='2'/>` + rim(P.rim) + gloss(0.9) +
      `<rect x='54' y='29' width='9' height='14' rx='3' fill='url(#cap)' stroke='${P.capEdge}' stroke-width='1.2'/><ellipse cx='60.2' cy='36' rx='1.5' ry='4' fill='#2a1a06' opacity='.7'/>` +
      (o.nt ? '' : `<rect x='22' y='2.5' width='20' height='13' rx='3.5' fill='url(#cap)' stroke='${P.capEdge}' stroke-width='1.5'/><path d='M22.6 7.4h18.8M22.6 11h18.8' stroke='${P.capEdge}' stroke-opacity='.45'/><path d='M25.5 5.2h13' stroke='#fff8c8' stroke-width='1.4' stroke-linecap='round' opacity='.75'/><path d='M23 15.4Q32 19 41 15.4' fill='none' stroke='${P.capEdge}' stroke-width='1.2'/>`),
      GL + rg('b', [[0, P.hi], [0.45, P.mid], [1, P.lo]]) + lg('cap', [[0, '#fff0a0'], [0.5, '#e8b030'], [1, '#a8620a']])),

    rope: (P, o = {}) => svg(
      shadow + `${BALL} fill='url(#b)' stroke='${P.edge}' stroke-width='2'/>` +
      `<clipPath id='c'><circle cx='32' cy='36' r='26'/></clipPath><g clip-path='url(#c)' fill='none' stroke-linecap='round'>` +
      ['M5 25Q32 14 59 25', 'M5 49Q32 60 59 49'].map((d) => `<path d='${d}' stroke='#6a431c' stroke-width='7.6'/><path d='${d}' stroke='#d8b878' stroke-width='6'/><path d='${d}' stroke='#8a6232' stroke-width='6' stroke-dasharray='1.5 2.5' opacity='.85'/><path d='${d}' stroke='#fff3cf' stroke-width='1.2' opacity='.5' transform='translate(0 -1.6)'/>`).join('') + '</g>' +
      rim(P.rim, 0.4) + gloss(0.55) +
      `<rect x='54' y='29' width='9' height='14' rx='3' fill='#d8b878' stroke='#6a431c' stroke-width='1.3'/><path d='M55 32.5h7M55 36h7M55 39.5h7' stroke='#8a6232' stroke-width='1.3'/>` +
      (o.nt ? '' : `<rect x='22' y='3' width='20' height='13' rx='3' fill='#d8b878' stroke='#6a431c' stroke-width='1.5'/><path d='M22.6 6.5h18.8M22.6 9.5h18.8M22.6 12.5h18.8' stroke='#8a6232' stroke-width='1.4'/><path d='M40 4.5Q47 1 49 7M41 7Q46 5 48 10' fill='none' stroke='#d8b878' stroke-width='2.2' stroke-linecap='round'/>`),
      GL + rg('b', [[0, P.hi], [0.45, P.mid], [1, P.lo]])),

    wire: (P, o = {}) => {
      let coils = '';
      for (const y of [15, 19, 23, 49, 53, 57]) {
        const dx = Math.sqrt(Math.max(0, 26 * 26 - (y - 36) * (y - 36))) - 1, bulge = y < 36 ? 5 : 6;
        coils += `<path d='M${f1(32 - dx)} ${y}Q32 ${y + bulge} ${f1(32 + dx)} ${y}' fill='none' stroke='#6a2c10' stroke-width='2.3'/><path d='M${f1(32 - dx + 1)} ${y - 0.7}Q32 ${y + bulge - 0.7} ${f1(32 + dx - 1)} ${y - 0.7}' fill='none' stroke='#ffd9b4' stroke-width='.9' stroke-opacity='.65'/>`;
      }
      return svg(
        shadow + `${BALL} fill='url(#b)' stroke='${P.edge}' stroke-width='2'/>` + `<clipPath id='c'><circle cx='32' cy='36' r='26'/></clipPath><g clip-path='url(#c)'>${coils}</g>` + rim('#ffd9b4', 0.55) + gloss(1) +
        `<ellipse cx='32' cy='36' rx='9' ry='5.5' fill='none'/>` +
        `<rect x='54' y='30' width='9' height='12' rx='2.5' fill='url(#cu)' stroke='#7a3a14' stroke-width='1.2'/><path d='M55 33h7' stroke='#fff0dc' stroke-width='1' opacity='.7'/>` +
        (o.nt ? '' : `<rect x='28' y='7' width='8' height='9' rx='1.5' fill='url(#cu)' stroke='#7a3a14' stroke-width='1.3'/><circle cx='32' cy='4.5' r='4.6' fill='none' stroke='url(#cu)' stroke-width='3'/><circle cx='32' cy='4.5' r='4.6' fill='none' stroke='#7a3a14' stroke-width='.8' opacity='.6'/><ellipse cx='30.6' cy='3.2' rx='1.4' ry='.9' fill='#fff' opacity='.7'/>`),
        GL + rg('b', [[0, P.hi], [0.42, P.mid], [1, P.lo]]) + lg('cu', [[0, '#ffe0c0'], [0.5, '#e8884a'], [1, '#8a3a14']]));
    },

    neon: (P, o = {}) => svg(
      shadow + `${BALL} fill='url(#b)'/>` +
      `<circle cx='32' cy='36' r='25' fill='none' stroke='${P.glow}' stroke-width='6' opacity='.22'/><circle cx='32' cy='36' r='25' fill='none' stroke='${P.glow}' stroke-width='2.6'/><circle cx='32' cy='36' r='24.9' fill='none' stroke='${P.core}' stroke-width='.9' opacity='.85'/>` +
      `<path d='M13 46A21 21 0 0 0 51 46' fill='none' stroke='${P.glow}' stroke-width='1.2' opacity='.45'/><path d='M10 36A22 22 0 0 1 20 17' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' opacity='.5'/>` +
      `<rect x='54' y='30' width='9' height='12' rx='3' fill='#0b1330' stroke='${P.glow}' stroke-width='1.8'/><rect x='56.5' y='33' width='4' height='6' rx='1.5' fill='${P.core}' opacity='.9'/>` +
      (o.nt ? '' : `<rect x='24' y='3' width='16' height='12' rx='4' fill='#0b1330' stroke='${P.glow}' stroke-width='2'/><rect x='28' y='6.4' width='8' height='5.2' rx='2.4' fill='${P.core}'/>`),
      rg('b', [[0, '#1c2f63'], [0.6, '#0a1127'], [1, '#050813']])),

    ice: (P, o = {}) => svg(
      shadow + `${BALL} fill='url(#b)' stroke='#cfeeff' stroke-width='2'/>` +
      `<path d='M10 26L32 36L54 26M10 48L32 36L54 48M32 36V62M32 36V12' fill='none' stroke='#fff' stroke-opacity='.4' stroke-width='1'/><path d='M14 52Q32 66 50 52' fill='none' stroke='#2a7ab8' stroke-opacity='.25' stroke-width='3' stroke-linecap='round'/>` + rim('#ffffff', 0.7) + gloss(1) +
      `<g fill='#fff'><path d='M17 17l1 3.2 3.2 1-3.2 1-1 3.2-1-3.2-3.2-1 3.2-1z' opacity='.9'/></g>` +
      `<path d='M54.6 30.5L63 32.5L62 40L54.6 41.5Z' fill='url(#ig)' stroke='#9fdcff' stroke-width='1.1' stroke-linejoin='round'/>` +
      (o.nt ? '' : `<path d='M21 15L22.4 2L27.6 9L32 0.6L36.4 9L41.6 2L43 15Z' fill='url(#ig)' stroke='#8fd0ff' stroke-width='1.3' stroke-linejoin='round'/><path d='M27 12L28 6M32 12V5M37 12L36 6' stroke='#fff' stroke-width='.9' opacity='.8'/>`),
      GL + rg('b', [[0, '#ffffff'], [0.4, '#c8ecff'], [1, '#5fa8e0']]) + lg('ig', [[0, '#ffffff'], [1, '#9fdcff']])),

    plasma: (P, o = {}) => svg(
      shadow + `${BALL} fill='url(#b)'/>` +
      `<circle cx='32' cy='36' r='25' fill='none' stroke='${P.glow}' stroke-width='5' opacity='.28'/><circle cx='32' cy='36' r='25' fill='none' stroke='${P.glow}' stroke-width='2.2'/>` +
      `<clipPath id='c'><circle cx='32' cy='36' r='25'/></clipPath><g clip-path='url(#c)' fill='none' stroke-linecap='round'><path d='M32 36C40 22 58 28 56 46' stroke='${P.arm}' stroke-width='4' opacity='.4'/><path d='M32 36C40 22 58 28 56 46' stroke='${P.core}' stroke-width='1.2' opacity='.8'/><path d='M32 36C24 50 6 44 8 26' stroke='${P.arm}' stroke-width='4' opacity='.4'/><path d='M32 36C24 50 6 44 8 26' stroke='${P.core}' stroke-width='1.2' opacity='.8'/><path d='M32 36C20 26 22 8 38 8' stroke='${P.arm}' stroke-width='3' opacity='.35'/><path d='M32 36C44 46 42 62 26 62' stroke='${P.arm}' stroke-width='3' opacity='.35'/></g>` +
      `<ellipse cx='32' cy='36' rx='29' ry='8' transform='rotate(-24 32 36)' fill='none' stroke='${P.core}' stroke-width='1.6' opacity='.75'/><circle cx='56.6' cy='27.4' r='2.8' fill='#fff'/><circle cx='56.6' cy='27.4' r='5' fill='${P.glow}' opacity='.45'/>` + gloss(0.7) +
      `<rect x='54' y='30' width='9' height='12' rx='3' fill='url(#mt)' stroke='${P.glow}' stroke-width='1.4'/>` +
      (o.nt ? '' : `<path d='M25 14.5L22.5 9L25 3.5H39L41.5 9L39 14.5Z' fill='url(#mt)' stroke='${P.glow}' stroke-width='1.5' stroke-linejoin='round'/><circle cx='32' cy='9' r='3' fill='${P.core}'/>`),
      GL + rg('b', [[0, '#5a2fb0'], [0.5, '#1d0b45'], [1, '#07021a']]) + lg('mt', [[0, '#e6c8ff'], [1, '#6a2bd9']])),

    candy: (P, o = {}) => {
      let wedges = '';
      for (let i = 0; i < 12; i += 2) {
        const a0 = (i * Math.PI) / 6 - 1.45, a1 = ((i + 1) * Math.PI) / 6 - 1.45;
        wedges += `<path d='M32 36L${f1(32 + 26 * Math.cos(a0))} ${f1(36 + 26 * Math.sin(a0))}A26 26 0 0 1 ${f1(32 + 26 * Math.cos(a1))} ${f1(36 + 26 * Math.sin(a1))}Z' fill='${P.a}'/>`;
      }
      return svg(
        shadow + `${BALL} fill='#fff'/><g clip-path='url(#c)'>${wedges}</g><clipPath id='c'><circle cx='32' cy='36' r='26'/></clipPath>` +
        `<circle cx='32' cy='36' r='16.5' fill='#fff' stroke='${P.ring}' stroke-width='1.6'/><circle cx='32' cy='36' r='19.2' fill='none' stroke='${P.a}' stroke-width='1' opacity='.5'/>` +
        `<circle cx='32' cy='36' r='26' fill='none' stroke='${P.edge}' stroke-width='2'/>` + gloss(0.85) + `<path d='M50 50A24.5 24.5 0 0 1 25 59.5' fill='none' stroke='#c4306f' stroke-opacity='.35' stroke-width='2' stroke-linecap='round'/>` +
        `<rect x='54' y='30' width='9' height='12' rx='3' fill='#fff' stroke='${P.a}' stroke-width='1.6'/><path d='M57 31v10M60 31v10' stroke='${P.a}' stroke-width='1.8'/>` +
        (o.nt ? '' : `<rect x='22.5' y='3' width='19' height='12.5' rx='4' fill='#fff' stroke='#c4306f' stroke-width='1.6'/><path d='M27 3.4v11.8M32 3.4v11.8M37 3.4v11.8' stroke='${P.a}' stroke-width='2.4'/><path d='M24 6h16' stroke='#fff' stroke-width='1' opacity='.7'/>`) +
        (o.nt ? '' : `<path d='M41 6Q47 2 50 7' fill='none' stroke='${P.a}' stroke-width='2.4' stroke-linecap='round'/>`),
        GL);
    },

    vine: (P, o = {}) => svg(
      shadow + `${BALL} fill='url(#b)' stroke='#3fae62' stroke-width='2'/>` +
      `<clipPath id='c'><circle cx='32' cy='36' r='26'/></clipPath><g clip-path='url(#c)'><path d='M4 24C14 17 26 28 36 21S52 15 62 22' fill='none' stroke='#0d5a2c' stroke-width='4.4' stroke-linecap='round'/><path d='M4 24C14 17 26 28 36 21S52 15 62 22' fill='none' stroke='#3fbf68' stroke-width='2.6' stroke-linecap='round'/><path d='M8 52C20 46 32 58 46 50S60 52 62 50' fill='none' stroke='#2a9d54' stroke-width='2.4' stroke-linecap='round'/></g>` +
      `<g fill='#5cf08c' stroke='#0d5a2c' stroke-width='.7'><path d='M16 22C11 16 18 12 23 15C23 19 20 22 16 22z'/><path d='M47 21C52 27 58 25 59 20C55 17 50 18 47 21z'/><path d='M22 53C18 58 22 62 27 60C27 56 25 53 22 53z'/></g>` + rim('#b6ffc4', 0.4) + gloss(0.65) +
      `<rect x='54' y='30' width='9' height='12' rx='3' fill='#2fae5e' stroke='#0d5a2c' stroke-width='1.3'/><path d='M55.5 33.5h6M55.5 38h6' stroke='#b6ffc4' stroke-width='1' opacity='.6'/>` +
      (o.nt ? '' : `<path d='M32 15C18 17 15 3 28 1.5C29 7.5 37 8.5 32 15Z' fill='url(#lf)' stroke='#0d5a2c' stroke-width='1.5' stroke-linejoin='round'/><path d='M31 13C27 10 25 7 26.5 4' stroke='#1b8a45' stroke-width='1' fill='none'/><path d='M33 3C37 -1 44 3 41 8C39.5 10 36.5 9.5 36.5 7.5' fill='none' stroke='#3fae62' stroke-width='1.8' stroke-linecap='round'/>`),
      GL + rg('b', [[0, '#9be8a8'], [0.45, '#2f8148'], [1, '#0e2c1a']]) + lg('lf', [[0, '#b6ffc4'], [1, '#2fae5e']], 0, 0, 1, 1)),

    rod: (P, o = {}) => {
      const arms = [[37.9, 35, 43.8, 31.8, 49.9, 31.8, 55.9, 35.8], [35.2, 38.4, 39.4, 41.9, 43.1, 45.8, 43.4, 52.4], [27.3, 37.7, 24.1, 43, 26.3, 51.1, 24.6, 56.8], [27.5, 30.5, 23, 27.1, 18.8, 23.1, 13.3, 20.9], [31.9, 28, 25.8, 23.7, 24.8, 17.5, 28.3, 10.3], [34.3, 29.5, 36.8, 25, 40.2, 21.1, 46.4, 19.5]]
        .map((p) => { const d = `M32 34L${f1(p[0])} ${f1(p[1])}L${f1(p[2])} ${f1(p[3])}L${f1(p[4])} ${f1(p[5])}L${f1(p[6])} ${f1(p[7])}`; return `<path d='${d}' fill='none' stroke='#8fd0ff' stroke-opacity='.5' stroke-width='3'/><path d='${d}' fill='none' stroke='#fff' stroke-width='1'/>`; }).join('');
      return svg(
        shadow + `${BALL} fill='url(#b)'/>` + `<clipPath id='c'><circle cx='32' cy='36' r='25'/></clipPath><g clip-path='url(#c)'>${arms}</g>` + `<circle cx='32' cy='36' r='26' fill='none' stroke='#5a2a10' stroke-width='3.6'/><circle cx='32' cy='36' r='25' fill='none' stroke='#c2672f' stroke-width='2'/>` + gloss(0.7) +
        `<path d='M10 30A24 24 0 0 1 26 12' fill='none' stroke='#8fd0ff' stroke-width='1.4' opacity='.5'/>` +
        `<rect x='54' y='29' width='9' height='14' rx='2.5' fill='url(#cu)' stroke='#5a2a10' stroke-width='1.3'/><path d='M55 33h7M55 39h7' stroke='#5a2a10' stroke-opacity='.5'/>` +
        (o.nt ? '' : `<path d='M31 15.5L31.6 5.8L28.6 5.8L32 .4L35.4 5.8L32.4 5.8L33 15.5' fill='url(#cu)' stroke='#5a2a10' stroke-width='1'/><path d='M23 17Q32 12.5 41 17L43 20Q32 16 21 20Z' fill='url(#cu)' stroke='#5a2a10' stroke-width='1.1'/>`),
        GL + rg('b', [[0, '#fff'], [0.04, '#fff'], [0.12, '#cfeaff'], [0.34, '#5aa0ff', 0.6], [0.74, '#080e28']], 0.5, 0.52, 0.55) + lg('cu', [[0, '#e8884a'], [0.45, '#ffe2c2'], [1, '#8a4018']], 0, 0, 1, 0));
    },

    phoenix: (P, o = {}) => svg(
      shadow + `<path d='${EGG}' fill='url(#b)' stroke='#ffb02e' stroke-width='2.2'/>` +
      `<clipPath id='c'><path d='${EGG}'/></clipPath><g clip-path='url(#c)' fill='#ffd24a' opacity='.55'>${Array.from({ length: 28 }, (_, i) => { const r = Math.floor(i / 7), c = i % 7; return `<circle cx='${f1(10 + c * 7.4 + (r % 2) * 3.7)}' cy='${f1(48 + r * 6.4 - 12)}' r='1.6'/>`; }).join('')}</g>` +
      `<path d='M33 12L29 22L35 29L28 39L34 47L30 57' fill='none' stroke='#ff6a1a' stroke-opacity='.55' stroke-width='3'/><path d='M33 12L29 22L35 29L28 39L34 47L30 57' fill='none' stroke='#ffd24a' stroke-width='1.1'/><path d='M35 29L43 32L46 39M28 39L20 41L17 48' fill='none' stroke='#ffd24a' stroke-width='.9'/>` +
      rim('#ffd24a', 0.45) + `<ellipse cx='22' cy='25' rx='9' ry='5.2' transform='rotate(-38 22 25)' fill='url(#gl)' opacity='.8'/>` +
      `<rect x='54' y='31' width='9' height='12' rx='3' fill='#e8541c' stroke='#ffb02e' stroke-width='1.3'/><path d='M55.5 34h6M55.5 39h6' stroke='#ffd24a' stroke-width='1' opacity='.7'/>` +
      (o.nt ? '' : `<path d='M32 .6L36.5 10.4L44.6 1.4L41 16L48 12.6L38 26L32 24L26 26L16 12.6L23 16L19.4 1.4L27.5 10.4Z' transform='translate(0 0) scale(1 .62) translate(0 6.5)' fill='url(#cr)' stroke='#e8541c' stroke-width='1.2' stroke-linejoin='round'/>`),
      GL + rg('b', [[0, '#ffb870'], [0.3, '#e8541c'], [0.62, '#8a1608'], [1, '#2a0604']], 0.34, 0.24, 0.9) + lg('cr', [[0, '#fff3b0'], [0.4, '#ffd24a'], [1, '#e8541c']], 0, 0, 0, 1)),

    dragon: (P, o = {}) => svg(
      shadow + `<path d='M32 9C45 9 56 22 56 39C56 53 46 62 32 62C18 62 8 53 8 39C8 22 19 9 32 9Z' fill='url(#b)' stroke='#ffb02e' stroke-width='2.2'/>` +
      `<clipPath id='c'><path d='M32 9C45 9 56 22 56 39C56 53 46 62 32 62C18 62 8 53 8 39C8 22 19 9 32 9Z'/></clipPath><g clip-path='url(#c)'>` +
      Array.from({ length: 6 }, (_, r) => Array.from({ length: 7 }, (_, c) => { const x = 6 + c * 10 + (r % 2) * 5, y = 14 + r * 9; return `<path d='M${x - 5} ${y}A5 5 0 0 0 ${x + 5} ${y}' fill='none' stroke='#2a0604' stroke-opacity='.55' stroke-width='1.6'/><path d='M${x - 4.4} ${y - 1.2}A4.6 4.6 0 0 0 ${x + 4.4} ${y - 1.2}' fill='none' stroke='#ffb85a' stroke-opacity='.55' stroke-width='.9'/>`; }).join('')).join('') + '</g>' +
      rim('#ffd24a', 0.45) + `<ellipse cx='22' cy='24' rx='9.5' ry='5.4' transform='rotate(-38 22 24)' fill='url(#gl)' opacity='.75'/>` +
      `<rect x='53.6' y='31' width='9.4' height='12' rx='3' fill='#c4200f' stroke='#ffb02e' stroke-width='1.4'/><path d='M55 34h6.4M55 39h6.4' stroke='#ffd24a' stroke-width='1' opacity='.7'/>` +
      (o.nt ? '' : `<path d='M15 14L19 .8L25.5 9.5L32 -0.4L38.5 9.5L45 .8L49 14Q32 18.5 15 14Z' fill='#ffd24a' stroke='#b8620a' stroke-width='1.3' stroke-linejoin='round'/><path d='M19 12Q32 15.5 45 12' fill='none' stroke='#fff3b0' stroke-width='1.2' opacity='.7'/><circle cx='32' cy='9.4' r='2' fill='#ff4d2e' stroke='#b8620a' stroke-width='.8'/>`),
      GL + rg('b', [[0, '#ff9a5a'], [0.45, '#d8340c'], [1, '#6e0b08']], 0.34, 0.28, 0.9)),
  };

  /** the eight rune glyphs, 12x12 boxes: carved on the golem's body and cut into the Runechain's stones */
  const RUNES = ['M3 1V11M3 3.4L9 6L3 8.6', 'M2 11L6 1L10 11M3.7 7.4H8.3', 'M6 1V11M6 4L10 1M6 7L10 4', 'M2 1L10 11M10 1L2 11', 'M3 1V11M3 1L9 5L3 9', 'M6 1L10 6L6 11L2 6Z', 'M2 3L6 1L10 3M6 1V11M3 8L6 11L9 8', 'M2 1V11M10 1V11M2 3L10 9'];
  /* ---- Series 4 "Moonwick" bodies. Every body takes (palette, { nt, mini }): nt = no topper (a hat is worn), mini = draw the pieces the live
     bomb makes out of DOM layers (liquid, sand, runes, moon phase) so the small previews are one picture. */
  const PRNG = (seed) => { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const starPath = (cx, cy, R, r, n = 5, rot = -90) => { let d = ''; for (let k = 0; k < n * 2; k++) { const a = ((rot + (k * 180) / n) * Math.PI) / 180, rr = k % 2 ? r : R; d += (k ? 'L' : 'M') + f1(cx + Math.cos(a) * rr) + ' ' + f1(cy + Math.sin(a) * rr); } return d + 'Z'; };
  /** a crescent facing left: outer radius R at (cx, cy), cut by a circle 0.8 R wide shifted right by 0.5 R */
  const moonPath = (cx, cy, R) => { const x = 0.61 * R, y = 0.792 * R; return `M${f1(cx + x)} ${f1(cy - y)}A${f1(R)} ${f1(R)} 0 1 0 ${f1(cx + x)} ${f1(cy + y)}A${f1(R * 0.8)} ${f1(R * 0.8)} 0 1 1 ${f1(cx + x)} ${f1(cy - y)}Z`; };
  const BRASS = lg('br', [[0, '#fff0b0'], [0.42, '#e8b038'], [1, '#8a560e']]);
  const socket = (fill, stroke, bar) => `<rect x='54' y='29' width='9' height='14' rx='3' fill='${fill}' stroke='${stroke}' stroke-width='1.2'/><path d='M55.2 33.2h6.6M55.2 38.8h6.6' stroke='${bar || stroke}' stroke-opacity='.55' stroke-width='1.2'/>`;
  const dot = (x, y, r, c, op) => `<circle cx='${f1(x)}' cy='${f1(y)}' r='${f1(r)}' fill='${c}'${op != null ? ` opacity='${op}'` : ''}/>`;

  Object.assign(BODY, {
    /* Candlewick: a bomb of ivory wax. A melted cap of lighter wax runs down its crown in drips; a brass candle-holder cup (with a handle) sits on top. */
    wax: (P, o = {}) => {
      const cap = 'M0 0H64V14C60 14 57.5 18 53 18C48.5 18 50 11 45 11C40 11 42 24.5 37 24.5C32 24.5 33.5 13 28.5 13C23.5 13 25.5 21 20.5 21C15.5 21 17.5 12 12 12C8.5 12 7.5 15 4 15Z';
      return svg(
        shadow + `${BALL} fill='url(#b)' stroke='${P.edge}' stroke-width='2'/>` +
        `<clipPath id='c'><circle cx='32' cy='36' r='26'/></clipPath><g clip-path='url(#c)'>` +
        `<ellipse cx='32' cy='52' rx='24' ry='13' fill='#ffb85a' opacity='.2'/>` +
        `<path d='${cap}' fill='url(#wx)' stroke='#d9b46c' stroke-width='.9' stroke-linejoin='round'/>` +
        [[12, 11.2], [20.5, 20], [37, 23.5], [53, 17], [28.5, 12.4], [45, 10.4]].map(([x, y]) => dot(x - 0.9, y - 0.4, 0.9, '#fff', 0.85)).join('') +
        `<path d='M5 15.5C8.5 15.5 9 12.6 12 12.6' fill='none' stroke='#fff' stroke-opacity='.6' stroke-width='1' stroke-linecap='round'/></g>` +
        rim(P.rim, 0.5) + gloss(0.75) + socket('url(#br)', '#7a4a0c') +
        (o.nt ? '' : `<path d='M32 8V1.4' stroke='#2a1a0a' stroke-width='1.9' stroke-linecap='round'/><path d='M32 3.2V1.2' stroke='#ffd9a0' stroke-opacity='.55' stroke-width='.8' stroke-linecap='round'/>` +
          `<path d='M23 12.6L24.6 6.6C27 5.6 37 5.6 39.4 6.6L41 12.6Z' fill='url(#br)' stroke='#7a4a0c' stroke-width='1.2' stroke-linejoin='round'/><path d='M25.8 8.6h12.4' stroke='#fff6c0' stroke-width='1.2' stroke-linecap='round' opacity='.7'/>` +
          `<ellipse cx='32' cy='12.8' rx='15.6' ry='3.1' fill='url(#br)' stroke='#7a4a0c' stroke-width='1.1'/><path d='M19 12.6C25 14.4 39 14.4 45 12.6' fill='none' stroke='#fff6c0' stroke-width='.9' stroke-linecap='round' opacity='.55'/>`),
        GL + BRASS + rg('b', [[0, '#fffaf0'], [0.46, '#f2dcac'], [1, '#c9985a']]) + lg('wx', [[0, '#ffffff'], [1, '#fbe8bc']]));
    },

    /* Star Wand: a midnight robe of a bomb, sewn with gold stars and moons, a gold star for a cap. */
    robe: (P, o = {}) => {
      const rows = [[14, 22, 's', 3.1], [50, 21, 'm', 3.6], [9.5, 40, 's', 2.3], [55, 51, 's', 2.5], [18, 56, 'm', 3.3], [45, 57, 's', 2.9], [23, 14.5, 's', 2.1], [41, 14, 's', 2.4], [10.5, 30, 'm', 2.6], [30, 61, 's', 2], [37, 53, 'm', 2.4]];
      return svg(
        shadow + `${BALL} fill='url(#b)' stroke='${P.edge}' stroke-width='2'/>` +
        `<clipPath id='c'><circle cx='32' cy='36' r='26'/></clipPath><g clip-path='url(#c)'>` +
        `<path d='M0 20C14 26 22 24 32 17C42 24 50 26 64 20V0H0Z' fill='#5864d8' opacity='.35'/>` +
        `<circle cx='32' cy='36' r='23.6' fill='none' stroke='#ffd86b' stroke-opacity='.75' stroke-width='.9' stroke-dasharray='1.6 2.2'/>` +
        rows.map(([x, y, t, s]) => (t === 's' ? `<path d='${starPath(x, y, s, s * 0.42)}' fill='#ffe08a'/>` : `<path d='${moonPath(x, y, s)}' fill='#ffd24a'/>`)).join('') +
        dot(26, 62, 0.8, '#fff', 0.8) + dot(58, 38, 0.8, '#fff', 0.8) + dot(7, 48, 0.8, '#fff', 0.8) + dot(36, 8, 0.8, '#fff', 0.8) + `</g>` +
        rim('#8f9cff', 0.55) + gloss(0.7) + socket('url(#gd)', '#6a420a') +
        (o.nt ? '' : `<path d='${starPath(32, 8.6, 8.4, 3.7)}' fill='url(#gd)' stroke='#8a560e' stroke-width='1.1' stroke-linejoin='round'/><path d='M32 3.4L33.4 7.2L37 8.2' fill='none' stroke='#fff8c8' stroke-width='1' stroke-linecap='round' opacity='.8'/>`),
        GL + lg('gd', [[0, '#fff3b0'], [0.5, '#ffc83a'], [1, '#b8720a']]) + rg('b', [[0, '#5a6ad8'], [0.46, '#222a78'], [1, '#080b30']]));
    },

    /* Elixir: a round-bottom flask with a cork. The live bomb draws the liquid behind this glass as a DOM layer (it drops when Fizz drinks). */
    flask: (P, o = {}) => {
      const GLASS = 'M26.4 6.5V17.6A22.6 22.6 0 1 0 37.6 17.6V6.5Z';
      const liquid = o.mini ? `<clipPath id='lc'><path d='${GLASS}'/></clipPath><g clip-path='url(#lc)'><rect x='8' y='34' width='48' height='30' fill='url(#lq)'/><path d='M8 34.6Q20 31.6 32 34.2T56 34.6' fill='none' stroke='#eafff2' stroke-width='1.6' stroke-linecap='round' opacity='.85'/>${dot(24, 46, 2, '#fff', 0.35)}${dot(38, 52, 1.5, '#fff', 0.35)}${dot(30, 41, 1.2, '#fff', 0.4)}</g>` : '';
      return svg(
        shadow + `<path d='${GLASS}' fill='url(#gt)'/>` + liquid +
        `<path d='M17.5 38A15 15 0 0 1 24 24.6' fill='none' stroke='#fff' stroke-width='2.2' stroke-linecap='round' opacity='.7'/><path d='M29.4 9V16' stroke='#fff' stroke-width='1.8' stroke-linecap='round' opacity='.55'/>` +
        `<path d='M48.5 47A17.5 17.5 0 0 1 36 58.6' fill='none' stroke='#fff' stroke-width='1.4' stroke-linecap='round' opacity='.35'/>` +
        `<path d='${GLASS}' fill='none' stroke='#cdeeff' stroke-width='2' stroke-linejoin='round'/><path d='${GLASS}' fill='none' stroke='#5ab0e0' stroke-opacity='.45' stroke-width='3.6' stroke-linejoin='round' transform='translate(0 .4)'/>` +
        `<ellipse cx='32' cy='6.6' rx='8.6' ry='2' fill='none' stroke='#e8f8ff' stroke-width='1.8'/>` +
        socket('url(#br)', '#7a4a0c') +
        (o.nt ? '' : `<path d='M25.6 8.2L26.8 0.6H37.2L38.4 8.2Z' fill='url(#ck)' stroke='#5a3410' stroke-width='1.2' stroke-linejoin='round'/>${dot(29.4, 4, 0.7, '#6a4020', 0.8)}${dot(33.6, 6, 0.8, '#6a4020', 0.8)}${dot(35, 2.6, 0.6, '#6a4020', 0.8)}<path d='M27.6 2.2h5' stroke='#fff0c0' stroke-width='.9' stroke-linecap='round' opacity='.6'/>`),
        GL + BRASS + lg('gt', [[0, '#d8f4ff', 0.16], [1, '#8fd0ff', 0.3]]) + lg('ck', [[0, '#e8b878'], [1, '#a8723a']], 0, 0, 1, 0) + lg('lq', [[0, '#9dffc8'], [0.35, '#34e08a'], [1, '#0a8a4c']]));
    },

    /* Sandglass: two glass bulbs in a brass frame. Sand in the lower bulb; the live bomb adds the falling stream and flips the body in Rush. */
    hourglass: (P, o = {}) => {
      const GLASS = 'M17 8C9.5 14 10.5 27 22.5 32.6C28 35.2 29.6 36.6 29.6 38.4C29.6 40.2 28 41.6 22.5 44.2C10.5 49.8 9.5 53 17 56H47C54.5 53 53.5 49.8 41.5 44.2C36 41.6 34.4 40.2 34.4 38.4C34.4 36.6 36 35.2 41.5 32.6C53.5 27 54.5 14 47 8Z';
      const sand = `<clipPath id='hc'><path d='${GLASS}'/></clipPath><g clip-path='url(#hc)'>` +
        `<path d='M8 62V53.4C16 51.6 24 48 32 43.4C40 48 48 51.6 56 53.4V62Z' fill='url(#sd)'/><path d='M12 52.6C19 51 25.6 47.6 32 43.6' fill='none' stroke='#fff3b8' stroke-width='1' opacity='.7'/>` +
        `<path d='M22 32.4L29.6 38.2H34.4L42 32.4C38.4 34.2 25.6 34.2 22 32.4Z' fill='url(#sd)'/>` +
        (o.mini ? `<path d='M32 38.6V43.4' stroke='#ffe08a' stroke-width='1.2'/>` : '') +
        [[22, 53, 0.6], [28, 56, 0.6], [38, 55, 0.6], [44, 53.6, 0.6], [33, 48, 0.5], [26, 50, 0.5], [40, 50, 0.5]].map(([x, y, r]) => dot(x, y, r, '#a8661a', 0.55)).join('') + `</g>`;
      return svg(
        shadow +
        `<path d='${GLASS}' fill='url(#gt)'/>` + sand +
        `<path d='M14.6 14C13.4 20 16 26 21.5 29' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' opacity='.65'/><path d='M49.4 50.4C50 47.6 47.6 45.6 44.6 44.4' fill='none' stroke='#fff' stroke-width='1.4' stroke-linecap='round' opacity='.4'/>` +
        `<path d='${GLASS}' fill='none' stroke='#d8f0ff' stroke-width='1.6' stroke-linejoin='round'/>` +
        `<rect x='8.4' y='5' width='3.8' height='54' rx='1.6' fill='url(#bv)' stroke='#6a420a' stroke-width='1'/><rect x='51.8' y='5' width='3.8' height='54' rx='1.6' fill='url(#bv)' stroke='#6a420a' stroke-width='1'/>` +
        `<rect x='6' y='1.4' width='52' height='6.8' rx='2.8' fill='url(#br)' stroke='#6a420a' stroke-width='1.3'/><path d='M9.5 3.6h45' stroke='#fff6c0' stroke-width='1.1' stroke-linecap='round' opacity='.7'/>` +
        `<rect x='6' y='56' width='52' height='6.8' rx='2.8' fill='url(#br)' stroke='#6a420a' stroke-width='1.3'/><path d='M9.5 58.2h45' stroke='#fff6c0' stroke-width='1.1' stroke-linecap='round' opacity='.6'/>` +
        socket('url(#br)', '#6a420a'),
        GL + BRASS + lg('bv', [[0, '#e8b038'], [0.5, '#fff0b0'], [1, '#9a6212']], 0, 0, 1, 0) +
        lg('gt', [[0, '#5a78c8', 0.5], [0.5, '#2a3c78', 0.55], [1, '#1c2a5a', 0.55]]) + lg('sd', [[0, '#ffe9a0'], [0.5, '#f1c04a'], [1, '#c48a22']]));
    },

    /* Runechain: a granite golem. Moss on top, eight rune stones round the body (dark until the run lights them), cyan-lit cracks when it panics. */
    golem: (P, o = {}) => {
      const rnd = PRNG(41);
      let facets = '';
      [[10, 22, 26, 12, 30, 28, 14, 34], [36, 10, 54, 20, 50, 34, 34, 28], [8, 44, 24, 40, 30, 56, 12, 58], [38, 44, 56, 42, 52, 56, 40, 60], [22, 28, 38, 30, 34, 46, 18, 44]].forEach((q, i) => {
        facets += `<path d='M${q[0]} ${q[1]}L${q[2]} ${q[3]}L${q[4]} ${q[5]}L${q[6]} ${q[7]}Z' fill='${i % 2 ? '#fff' : '#000'}' opacity='${i % 2 ? 0.07 : 0.1}' stroke='#0e1420' stroke-opacity='.35' stroke-width='.8' stroke-linejoin='round'/>`;
      });
      let speck = '';
      for (let i = 0; i < 46; i++) { const x = 6 + rnd() * 52, y = 10 + rnd() * 52, d = rnd(); speck += dot(x, y, 0.35 + rnd() * 0.65, d < 0.5 ? '#0e1420' : '#d8e4f4', d < 0.5 ? 0.3 : 0.3); }
      const moss = o.nt ? '' :
        `<path d='M17.4 17.4C16 10 24 6.4 28.4 9C31 5.6 38 6 39.6 10C45 8.6 49.4 13 46.2 18.6C41 16.8 38 20.4 32 18.8C26 21.6 21.4 19.4 17.4 17.4Z' fill='url(#ms)' stroke='#2a5a22' stroke-width='1.1' stroke-linejoin='round'/>` +
        `<path d='M24 12C26.4 10.4 29 10.8 30.4 12.4M34.6 11.4C37 10 40 10.8 41.2 13' fill='none' stroke='#d6ff9e' stroke-opacity='.65' stroke-width='1' stroke-linecap='round'/>` +
        `<path d='M33 8.6C32.4 4.4 35.4 1.4 39 2.2C38.6 5.4 36.6 8.2 33 8.6Z' fill='#7fdc5a' stroke='#2a5a22' stroke-width='.9' stroke-linejoin='round'/><path d='M31.6 9.2C29 6.2 26.6 5.6 24.6 6.8C25.6 9.4 28 10.4 31.6 9.2Z' fill='#5cc24a' stroke='#2a5a22' stroke-width='.9' stroke-linejoin='round'/>`;
      const GLYPHS = RUNES;
      const pos = [[32, 20.4], [18.6, 21.4], [45.4, 21.4], [10.2, 34.6], [53.4, 25.4], [14, 50.6], [50.2, 50.4], [32.6, 61]];
      const runes = pos.map(([x, y], i) => `<g transform='translate(${x} ${y}) scale(.46) translate(-6 -6)'><path d='${GLYPHS[i]}' fill='none' stroke='#0a0f18' stroke-opacity='.75' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round' transform='translate(.4 .6)'/><path d='${GLYPHS[i]}' fill='none' stroke='${o.mini && i < 3 ? '#8fecff' : '#56627a'}' stroke-width='${o.mini && i < 3 ? 2.6 : 2.2}' stroke-linecap='round' stroke-linejoin='round'/></g>`).join('');
      return svg(
        shadow + `${BALL} fill='url(#b)' stroke='${P.edge}' stroke-width='2'/>` +
        `<clipPath id='c'><circle cx='32' cy='36' r='26'/></clipPath><g clip-path='url(#c)'>${facets}${speck}<path d='M6 58C20 52 36 62 58 54V64H6Z' fill='#0e1420' opacity='.2'/></g>` +
        `<path d='M13 30L18 27L21 31M44 50L48 46L52 49M30 61L33 57' fill='none' stroke='#0e1420' stroke-opacity='.55' stroke-width='1.1' stroke-linecap='round' stroke-linejoin='round'/>` +
        rim('#aebbd2', 0.42) + gloss(0.5) + runes + socket('url(#mt)', '#2a3446') + moss,
        GL + rg('b', [[0, '#9aa8bc'], [0.5, '#56627a'], [1, '#222a3a']]) + lg('ms', [[0, '#a8f070'], [1, '#3f9a36']]) + lg('mt', [[0, '#c8d4e8'], [1, '#56627a']]));
    },

    /* Moonrise: the moon itself, pale silver with craters. The live bomb draws its phase as shadow layers inside the clipped body (mini: full moon). */
    moon: (P, o = {}) => svg(
      `<circle cx='32' cy='36' r='26' fill='${P.glow}' opacity='.18'/>` + `${BALL} fill='url(#b)' stroke='${P.edge}' stroke-width='1.6'/>` +
      `<clipPath id='c'><circle cx='32' cy='36' r='26'/></clipPath><g clip-path='url(#c)'>` +
      `<path d='M8 30C16 24 20 34 28 30C34 27 34 20 42 22C48 24 54 18 60 24V52C50 48 44 56 34 52C26 49 18 56 6 50Z' fill='#9fb0d6' opacity='.28'/>` +
      [[19, 24, 6], [44, 18, 4.2], [48, 44, 7], [20, 49, 5], [32, 58, 3.4], [10, 40, 3], [34, 14, 2.6]].map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='#aebcdf' opacity='.55'/><path d='M${f1(x - r * 0.8)} ${f1(y + r * 0.5)}A${r} ${r} 0 0 1 ${f1(x + r * 0.5)} ${f1(y - r * 0.8)}' fill='none' stroke='#6b7cab' stroke-opacity='.55' stroke-width='${f1(Math.max(0.8, r * 0.22))}' stroke-linecap='round'/><path d='M${f1(x + r * 0.8)} ${f1(y - r * 0.4)}A${r} ${r} 0 0 1 ${f1(x - r * 0.4)} ${f1(y + r * 0.8)}' fill='none' stroke='#fff' stroke-opacity='.75' stroke-width='.8' stroke-linecap='round'/>`).join('') + `</g>` +
      `<circle cx='32' cy='36' r='25' fill='none' stroke='#fff' stroke-opacity='.35' stroke-width='1.2'/>` + rim('#c8d8ff', 0.5) + gloss(0.7) + socket('url(#sv)', '#5a6a94') +
      '',
      GL + rg('b', [[0, '#ffffff'], [0.5, '#dfe8fb'], [1, '#8fa0cc']]) + lg('sv', [[0, '#f4f8ff'], [1, '#7a8ab4']])),
  });

  /* ---- Series 4 "Moonwick" rope tiles. Each returns a CSS background (an SVG tile, repeated along the rope). The rope box is `h` px tall, so
     every tile is drawn in a box exactly h tall (and a Low and a Critical variant that replace the calm one, see css/fuse.css). */
  const tileBG = (w, h, inner, defs) => `${uri(svg(inner, defs, `0 0 ${w} ${h}`))} repeat-x 0 0 / ${w}px ${h}px`;
  const vg = (id, a, h) => `<linearGradient id='${id}' gradientUnits='userSpaceOnUse' x1='0' y1='0' x2='0' y2='${h}'>${stops(a)}</linearGradient>`;

  /** Candlewick: ivory wax with a waxed cotton wick inside and three drips hanging from its lower edge. c = [light, mid, dark, wick] */
  const waxRope = (c) => {
    const W = 40, H = 16, drip = (x, w, b) => `<path d='M${f1(x - w / 2 - 1.2)} 9C${f1(x - w / 2)} 9.8 ${f1(x - w / 2)} 10.4 ${f1(x - w / 2)} 11V${f1(b - w / 2)}A${f1(w / 2)} ${f1(w / 2)} 0 0 0 ${f1(x + w / 2)} ${f1(b - w / 2)}V11C${f1(x + w / 2)} 10.4 ${f1(x + w / 2)} 9.8 ${f1(x + w / 2 + 1.2)} 9Z' fill='url(#w)' stroke='${c[2]}' stroke-opacity='.45' stroke-width='.6'/>`;
    return tileBG(W, H,
      `<rect x='0' y='0' width='40' height='10' fill='url(#w)'/>` + drip(6.5, 4.4, 15.4) + drip(19, 3.6, 12.6) + drip(31.5, 4.2, 14.4) +
      `<path d='M0 5.4H40' stroke='${c[3]}' stroke-width='2.4' stroke-dasharray='2.6 1.4' opacity='.5'/><path d='M0 4.3H40' stroke='#fff' stroke-opacity='.25' stroke-width='.7'/>` +
      `<path d='M1.5 2H38.5' stroke='#fff' stroke-opacity='.7' stroke-width='1.3' stroke-linecap='round'/>` + [[5.6, 13.4], [18.3, 10.8], [30.6, 12.4]].map(([x, y]) => dot(x, y, 0.8, '#fff', 0.8)).join('') +
      `<path d='M0 9.6H40' stroke='#000' stroke-opacity='.08' stroke-width='1.2'/>`,
      vg('w', [[0, c[0]], [0.5, c[1]], [1, c[2]]], 16));
  };

  /** Star Wand: dark polished wood with a silver band every 32px. band = [top, mid, low, shadow]; glow = the colour the wood warms to beside the band */
  const wandRope = (wood, band, glow) => {
    const W = 32, H = 14;
    return tileBG(W, H,
      `<rect x='0' y='0' width='32' height='14' fill='url(#wd)'/>` +
      `<path d='M0 4.6H21M7 7.8H32M2 10.6H16M20 11.6H26' stroke='#000' stroke-opacity='.22' stroke-width='.9' stroke-linecap='round'/><path d='M3 6H17M12 9.2H26' stroke='#ffd9a8' stroke-opacity='.14' stroke-width='.8' stroke-linecap='round'/>` +
      `<path d='M0 1.4H27' stroke='#fff' stroke-opacity='.32' stroke-width='1.3' stroke-linecap='round'/>` +
      (glow ? `<rect x='12' y='0' width='15' height='14' fill='url(#gw)'/>` : '') +
      `<rect x='26.4' y='0' width='5.6' height='14' fill='url(#bd)'/><path d='M26.4 0V14M32 0V14' stroke='#000' stroke-opacity='.5' stroke-width='.9'/><path d='M28 1.2V12.8' stroke='#fff' stroke-opacity='.75' stroke-width='1' stroke-linecap='round'/>` +
      `<circle cx='29.2' cy='7' r='.9' fill='${band[3]}' opacity='.8'/>`,
      vg('wd', [[0, wood[0]], [0.34, wood[1]], [0.78, wood[2]], [1, wood[3]]], 14) + vg('bd', [[0, band[0]], [0.4, band[1]], [0.78, band[2]], [1, band[3]]], 14) +
      (glow ? `<linearGradient id='gw' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='${glow}' stop-opacity='0'/><stop offset='1' stop-color='${glow}' stop-opacity='.75'/></linearGradient>` : ''));
  };

  /** Elixir: a glass tube full of bubbling liquid. liq = [meniscus, light, mid, deep, dark]; n = how many bubbles */
  const vialRope = (liq, n) => {
    const W = 60, H = 15, B = [[6, 8.4, 2.3], [17, 5.4, 1.5], [26, 9.4, 2.7], [38, 6.4, 1.8], [47, 10, 1.5], [54, 5, 2.2], [11.5, 11.2, 1.1], [32, 11.8, 1], [43, 4, 1.1], [58, 10.6, 1], [22, 3.6, 1]].slice(0, n);
    return tileBG(W, H,
      `<rect x='0' y='0' width='60' height='15' fill='url(#lq)'/>` +
      B.map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='#fff' fill-opacity='.16' stroke='#fff' stroke-opacity='.7' stroke-width='.8'/>${dot(x - r * 0.35, y - r * 0.38, Math.max(0.35, r * 0.28), '#fff', 0.95)}`).join('') +
      `<path d='M2 2.1H58' stroke='#fff' stroke-opacity='.7' stroke-width='1.5' stroke-linecap='round'/><path d='M6 4.1H30' stroke='#fff' stroke-opacity='.28' stroke-width='.9' stroke-linecap='round'/><path d='M2 13H58' stroke='#fff' stroke-opacity='.22' stroke-width='1' stroke-linecap='round'/>` +
      `<path d='M0 .4H60M0 14.6H60' stroke='#021a10' stroke-opacity='.5' stroke-width='.8'/>`,
      vg('lq', [[0, liq[0]], [0.18, liq[1]], [0.5, liq[2]], [0.85, liq[3]], [1, liq[4]]], 15));
  };

  /** Sandglass: a glass channel packed with gold sand. sand = [light, mid, dark]. thin = a dark channel with only a thin stream (Critical). */
  const sandRope = (sand, thin) => {
    const W = 24, H = 14, rnd = PRNG(thin ? 5 : 9);
    let g = '';
    for (let i = 0; i < (thin ? 5 : 22); i++) { const x = rnd() * 24, y = thin ? 5.4 + rnd() * 3.2 : 1.6 + rnd() * 10.8, d = rnd() < 0.5; g += dot(x, y, 0.4 + rnd() * 0.5, d ? sand[2] : '#fff6c8', d ? 0.5 : 0.65); }
    return tileBG(W, H,
      (thin ? `<rect x='0' y='0' width='24' height='14' fill='url(#gl2)'/><rect x='0' y='5' width='24' height='4' fill='url(#sn)'/>` : `<rect x='0' y='0' width='24' height='14' fill='url(#sn)'/>`) + g +
      `<path d='M0 1.4H24' stroke='#fff' stroke-opacity='${thin ? 0.5 : 0.55}' stroke-width='1.2'/><path d='M0 12.8H24' stroke='#fff' stroke-opacity='.25' stroke-width='1'/><path d='M0 .4H24M0 13.6H24' stroke='#08142a' stroke-opacity='.55' stroke-width='.8'/>`,
      vg('sn', [[0, sand[0]], [0.5, sand[1]], [1, sand[2]]], 14) + vg('gl2', [[0, '#274a6a'], [1, '#0b1a2e']], 14));
  };

  /** Runechain: a chain of eight carved slate stones (18px) joined by glowing links. glow = [bright, mid]. */
  const chainRope = (glow, stoneHi) => {
    const W = 208, H = 18;
    let s = '';
    for (let i = 0; i < 8; i++) {
      const x = i * 26;
      s += `<rect x='${x + 12}' y='5.2' width='20' height='7.6' rx='3.8' fill='none' stroke='${glow[1]}' stroke-opacity='.4' stroke-width='3.4'/><rect x='${x + 12}' y='5.2' width='20' height='7.6' rx='3.8' fill='none' stroke='${glow[0]}' stroke-width='1.5'/>` +
        `<rect x='${x}' y='0' width='18' height='18' rx='4.4' fill='url(#st)' stroke='#0b111c' stroke-width='1.1'/><path d='M${x + 3} 1.4H${x + 15}' stroke='${stoneHi}' stroke-opacity='.55' stroke-width='1.1' stroke-linecap='round'/><path d='M${x + 1.2} 4.4V15' stroke='#fff' stroke-opacity='.1' stroke-width='1'/>` +
        `<g transform='translate(${x + 3} 3) scale(1)'><path d='${RUNES[i]}' fill='none' stroke='${glow[1]}' stroke-opacity='.5' stroke-width='3.6' stroke-linecap='round' stroke-linejoin='round'/><path d='${RUNES[i]}' fill='none' stroke='${glow[0]}' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/></g>`;
    }
    return tileBG(W, H, s, lg('st', [[0, '#69758c'], [0.5, '#434e64'], [1, '#222a3a']]));
  };

  /** Moonrise: a ribbon of moonlight. c = [edge, glow, core] */
  const ribbonRope = (c) => {
    const W = 48, H = 10;
    return tileBG(W, H,
      `<rect x='0' y='0' width='48' height='10' fill='url(#rb)'/><path d='M0 5H48' stroke='#fff' stroke-width='1.6' stroke-opacity='.95'/><path d='M0 5H48' stroke='${c[2]}' stroke-width='4' stroke-opacity='.35'/>` +
      `<path d='M0 2.6Q12 .6 24 2.6T48 2.6M0 7.6Q12 9.6 24 7.6T48 7.6' fill='none' stroke='#fff' stroke-opacity='.35' stroke-width='.8'/>` +
      [[6, 3.6, 0.9], [17, 6.6, 0.7], [29, 3, 1], [40, 7, 0.8], [46, 4, 0.6]].map(([x, y, r]) => dot(x, y, r, '#fff', 0.95)).join(''),
      vg('rb', [[0, c[0]], [0.3, c[1]], [0.5, '#ffffff'], [0.72, c[1]], [1, c[0]]], 10));
  };
  /** the flow layers (the dashes that run along a rope): sand grains toward the bomb, stardust toward the flame, bubbles */
  const flowTile = (kind) => {
    if (kind === 'grain') return tileBG(18, 14, `<path d='M1 4.6h4M8 9h3.4M13 3h3.6M4 11.4h3' stroke='#fff6c8' stroke-width='1.5' stroke-linecap='round' opacity='.9'/><path d='M6 6.4h2.4M15 7.6h2.4' stroke='#fff' stroke-width='1' stroke-linecap='round' opacity='.7'/>`);
    if (kind === 'dust') return tileBG(30, 10, `${dot(4, 3, 0.8, '#fff')}${dot(12, 7.4, 0.6, '#e8f0ff')}<path d='${starPath(21, 4.4, 2.2, 0.7, 4)}' fill='#fff'/>${dot(27, 8, 0.7, '#cfe0ff')}${dot(16, 2, 0.5, '#fff')}`);
    return tileBG(30, 15, `<circle cx='5' cy='9' r='1.6' fill='none' stroke='#fff' stroke-opacity='.75' stroke-width='.7'/><circle cx='17' cy='5' r='1.1' fill='none' stroke='#fff' stroke-opacity='.75' stroke-width='.7'/><circle cx='24' cy='10.5' r='1.9' fill='none' stroke='#fff' stroke-opacity='.75' stroke-width='.7'/>${dot(4.5, 8.5, 0.4, '#fff')}${dot(23.4, 9.9, 0.45, '#fff')}`);
  };

  /* ------------------------------------------------------------------ face: the calm face baked in, for the small previews (the run draws its own live one) */
  const faceSVG = (F) => {
    const eye = (cx) => `<ellipse cx='${cx}' cy='${F.ey}' rx='6' ry='7' fill='${F.sclera}' stroke='${F.line}' stroke-width='1.4'/>` +
      (F.slit ? `<ellipse cx='${cx + 0.8}' cy='${F.ey + 0.6}' rx='1.5' ry='5.4' fill='${F.pupil}'/>` : `<ellipse cx='${cx + 0.8}' cy='${F.ey + 0.6}' rx='3.2' ry='4' fill='${F.pupil}'/>`) + `<circle cx='${cx + 2}' cy='${F.ey - 1.4}' r='1.2' fill='#fff'/>`;
    const out = eye(22) + eye(42) + `<path d='M26 ${F.ey + 12.5}Q32 ${F.ey + 17.5} 38 ${F.ey + 12.5}' fill='none' stroke='${F.mouth || F.line}' stroke-width='2.2' stroke-linecap='round'/>` + `<ellipse cx='15' cy='${F.ey + 9}' rx='3.2' ry='2' fill='${F.blush}'/><ellipse cx='49' cy='${F.ey + 9}' rx='3.2' ry='2' fill='${F.blush}'/>`;
    // a face drawn smaller (the hourglass keeps it on its upper bulb): scaled about the eye line
    return F.sc && F.sc !== 1 ? `<g transform='translate(32 ${F.ey}) scale(${F.sc}) translate(-32 -${F.ey})'>${out}</g>` : out;
  };
  /** opts: { nt: no topper (a hat is worn), mini: draw the live bomb's DOM layers into the picture } */
  const bodyURI = (kind, P, faceTok, opts) => {
    let s = BODY[kind](P, opts || {});
    if (faceTok) s = s.replace('</svg>', faceSVG(faceTok) + '</svg>');
    return uri(s);
  };

  /* ------------------------------------------------------------------ flames: tongue + core, 32x40 boxes with the burning end at (16, 28) */
  const FLAME = {
    flame: {
      tongue: 'M16 2C18.5 10 26 14 26 25C26 33 21.5 38 16 38C10.5 38 6 33 6 25C6 19 10 17.5 11 12C12.5 15 14 16.5 15 17C15 11 14 6.5 16 2Z',
      core: 'M16 17C18 22 22 24 22 30C22 34 19.5 36 16 36C12.5 36 10 34 10 30C10 25.5 14 23 16 17Z' },
    plume: {
      tongue: 'M9 37C3 31 4 23 10 18C14 15 13 8 10 2C19 5 26 12 24.5 21C24 25 26 29 28 32C23 30 20.5 32 19 35C17.5 38 12 39 9 37Z',
      core: 'M12 35C9 31 10 27 13 24C15 22 15.5 19 14.5 16C19 19 21.5 24 20 28C19.2 31 18 34 16 36Z' },
    star: {
      tongue: 'M16 4L19.6 21L27 26L19.6 31L16 48L12.4 31L5 26L12.4 21Z',
      core: 'M16 14L18 24L23 26L18 28L16 38L14 28L9 26L14 24Z' },
    spike: {
      tongue: 'M16 5L18.4 17L27 11.5L21.6 20.5L30 23L21.2 26.5L27.5 36L18 31.5L16 44L14 31.5L4.5 36L10.8 26.5L2 23L10.4 20.5L5 11.5L13.6 17Z',
      core: 'M16 16L17.8 23L23 24.5L17.8 26L16 34L14.2 26L9 24.5L14.2 23Z' },
    /** Candlewick: a tall, calm teardrop (the base is blue) */
    candle: {
      tongue: 'M16 0.6C18.6 8.6 23.4 14.4 23.4 22C23.4 28.8 20.4 33.4 16 33.4C11.6 33.4 8.6 28.8 8.6 22C8.6 14.4 13.4 8.6 16 0.6Z',
      core: 'M16 12C17.8 17 20.4 20.6 20.4 25.2C20.4 28.8 18.6 31 16 31C13.4 31 11.6 28.8 11.6 25.2C11.6 20.6 14.2 17 16 12Z' },
    orb: {
      tongue: 'M16 10C23 10 28 16 28 23C28 30 23 36 16 36C9 36 4 30 4 23C4 16 9 10 16 10Z',
      core: 'M16 17C20 17 23 20 23 24C23 28 20 31 16 31C12 31 9 28 9 24C9 20 12 17 16 17Z' },
  };
  /** the tongue's colours from tip to base: three (tip, mid, base) or four (a blue base under a gold middle, for the candle) */
  const tongueStops = (c) => (c.length > 3 ? [[0, c[0]], [0.42, c[1]], [0.76, c[2]], [1, c[3]]] : [[0, c[0]], [0.55, c[1]], [1, c[2]]]);
  /** One flame SVG layer. kind 'tongue' fades from the tip color down to the base color; 'core' is the white-hot heart. */
  const flameURI = (shape, layer, c) => {
    const S = FLAME[shape] || FLAME.flame, id = 'f';
    if (layer === 'tongue') return uri(svg(`<path d='${S.tongue}' fill='url(#${id})'/>`, lg(id, tongueStops(c)), '0 0 32 40'));
    return uri(svg(`<path d='${S.core}' fill='url(#${id})'/>`, lg(id, [[0, c[0]], [1, c[1]]]), '0 0 32 40'));
  };
  /** All three layers in one picture (used by the small previews, which have one spark element). */
  const flameAllURI = (shape, t) => {
    const S = FLAME[shape] || FLAME.flame;
    return uri(svg(`<circle cx='16' cy='25' r='15' fill='url(#h)'/><path d='${S.tongue}' fill='url(#t)'/><path d='${S.core}' fill='url(#k)'/>`,
      `<radialGradient id='h'>${stops([[0, t.halo[0], 0.7], [1, t.halo[0], 0]])}</radialGradient>` + lg('t', tongueStops(t.tongue)) + lg('k', [[0, t.core[0]], [1, t.core[1]]]), '0 0 32 40'));
  };

  /* generic crack lines (the bomb splits open when it panics) and frost (Rush) */
  /** hot = the glow under the cracks, line = the bright line; kind 'drip' draws wax drips running down instead of cracks (Candlewick: it drips more when it panics) */
  const cracksURI = (hot, line, kind) => kind === 'drip' ? uri(svg(
    [[14, 17.4, 9.5], [24, 11.4, 8], [32, 10.2, 19], [41, 11.6, 10], [50, 17.2, 12.5]].map(([x, y, L]) => `<path d='M${f1(x - 2.3)} ${y}V${f1(y + L - 2.3)}A2.3 2.3 0 0 0 ${f1(x + 2.3)} ${f1(y + L - 2.3)}V${y}Z' fill='${hot}' stroke='#a85a08' stroke-opacity='.55' stroke-width='.7'/><path d='M${f1(x - 0.9)} ${f1(y + 1.4)}V${f1(y + L - 3.2)}' stroke='#fff' stroke-opacity='.7' stroke-width='.9' stroke-linecap='round'/>`).join(''))) : uri(svg(`<path d='M33 9L29 19L35 26L28 36L34 44L30 54' fill='none' stroke='${hot}' stroke-opacity='.6' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'/><path d='M33 9L29 19L35 26L28 36L34 44L30 54' fill='none' stroke='${line}' stroke-width='1.2' stroke-linejoin='round'/><path d='M35 26L45 28L49 36M28 36L19 38L15 46M29 19L21 16' fill='none' stroke='${line}' stroke-width='1' stroke-linecap='round'/>`));
  /** frost for the hourglass: icing hanging from the top plate and over the top bulb, a cap on the bottom plate, glints */
  const frostHourURI = (c) => uri(svg(
    `<path d='M5 7.2C5 11.6 7.2 13 9 13S11.6 11 12.4 7.4C13 11.4 14.4 17.6 17 17.6S20.4 12 21.4 8C22.2 10.2 23.2 12 25 12S27.4 10 28 8C28.6 10.8 29.6 14.4 31.4 14.4S34 11 34.8 8C35.8 12.4 37 19 39.8 19S43 12.4 43.8 8C44.4 10.4 45.6 13 47.4 13S50 10.6 50.6 8C51.2 11.4 52.4 15 55 15S59 11.6 59 7.2V4.4H5Z' fill='url(#fr)' stroke='#fff' stroke-width='.8' stroke-linejoin='round'/>` +
    `<path d='M6 58.6C6 56.6 8.4 56.2 10.6 56.6C13.4 55.4 17 55.6 20 56.4H44C47 55.6 50.6 55.4 53.4 56.6C55.6 56.2 58 56.6 58 58.6V59.6H6Z' fill='url(#fr)' stroke='#fff' stroke-width='.7' stroke-linejoin='round'/>` +
    `<path d='M13 22C12.4 28 15.4 31.6 20.4 33.6' fill='none' stroke='#fff' stroke-opacity='.8' stroke-width='1.6' stroke-linecap='round'/>` +
    `<g fill='#fff'><path d='M20 25l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8z'/><path d='M46 48l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z' opacity='.9'/></g>`,
    lg('fr', [[0, '#ffffff'], [1, c]])));
  /** Frost on the bomb in Rush: scalloped icing along the upper-left of the body (rounded drips, never points), a smaller patch low on the right, and glints. */
  const frostBombURI = (c, kind) => {
    if (kind === 'hourglass') return frostHourURI(c);
    const G = kind === 'flask' ? { cx: 32, cy: 39.5, r: 24.2 } : { cx: 32, cy: 36, r: 27.4 };
    const pt = (r, deg) => `${f1(G.cx + r * Math.cos((deg * Math.PI) / 180))} ${f1(G.cy + r * Math.sin((deg * Math.PI) / 180))}`;
    const R0 = G.r;
    // a band hugging the rim from a0 to a1 degrees; its inner edge is a row of rounded scallops of the given depths
    const cap = (a0, a1, depths) => {
      const n = depths.length, st = (a1 - a0) / n;
      let d = `M${pt(R0, a0)}A${R0} ${R0} 0 0 1 ${pt(R0, a1)}`;
      for (let k = n - 1; k >= 0; k--) d += `Q${pt(R0 - 2 * depths[k], a0 + st * (k + 0.5))} ${pt(R0 - 1.4, a0 + st * k)}`;
      return d + 'Z';
    };
    const main = cap(188, 262, [3.4, 5.6, 4.2, 6.6, 4, 5.2]), low = cap(52, 90, [3, 4.4, 3.2]);
    return uri(svg(
      `<path d='${main}' fill='url(#fr)' stroke='#fff' stroke-width='.7' stroke-linejoin='round'/><path d='${low}' fill='url(#fr)' stroke='#fff' stroke-width='.7' stroke-linejoin='round'/>` +
      `<circle cx='${G.cx}' cy='${G.cy}' r='${f1(G.r - 2)}' fill='none' stroke='#fff' stroke-opacity='.45' stroke-width='1.5'/>` +
      `<g fill='#fff'><path d='M14.5 20.5l.9 2.7 2.7.9-2.7.9-.9 2.7-.9-2.7-2.7-.9 2.7-.9z'/><path d='M49 41l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z' opacity='.9'/><path d='M22 9l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z' opacity='.85'/></g>`,
      lg('fr', [[0, '#ffffff'], [1, c]])));
  };

  /* ------------------------------------------------------------------ the fuse tokens (11 cosmetics) */
  const face = (o) => Object.assign({ sclera: '#ffffff', pupil: '#1d1432', line: '#150c28', blush: 'rgba(255,110,140,0.5)', ey: 36, slit: false }, o);
  const WARM = { low: R.tint('rgba(255,150,40,0.45)'), crit: R.tint('rgba(255,50,40,0.58)') };

  const TOKENS = {
    'fuse-classic': {
      name: 'Basic Cord', h: 14, rail: { bg: 'rgba(0,0,0,0.5)', line: 'rgba(255,255,255,0.05)' }, glow: '#ffb347', gs: ['rgba(255,170,60,0.42)', 'rgba(255,140,40,0.75)', 'rgba(255,70,50,0.9)'],
      rope: { base: R.twist('#b88a4a', '#8a6232', 6), low: R.twist('#f0a458', '#c0642a', 6), crit: R.twist('#ff8a5a', '#d02a1a', 6) },
      flame: { shape: 'flame', core: ['#ffffff', '#fff2a8'], tongue: ['#ff7a1a', '#ffb02e', '#ffe27a'], halo: ['rgba(255,150,50,0.55)'], ice: ['#ffffff', '#cfeeff', '#7fc4ff'] },
      ember: ['#ffb44a', '#ffe9a8'], ash: '#4a423c', heat: 'rgba(255,120,40,0.6)', smoke: 'rgba(205,195,215,0.55)', frost: '#d9f2ff',
      part: { spark: ['#ffd24a', '#ff8a3d', '#fff3b0'], ember: ['#ff9a3d', '#ff6a2a'], smoke: 'rgba(200,190,215,0.55)', special: null },
      bomb: { kind: 'classic', pal: { hi: '#8e7cc0', mid: '#33295a', lo: '#0c0818', edge: '#4a3d70', rim: '#a99be0', capEdge: '#8a560f' }, face: face({ mouth: '#f2e8ff' }) },
    },
    'fuse-rope': {
      name: 'Rope', h: 17, rail: { bg: 'rgba(30,14,4,0.55)', line: 'rgba(255,220,160,0.1)' }, glow: '#ffb347', gs: ['rgba(255,160,50,0.38)', 'rgba(255,130,40,0.75)', 'rgba(255,70,50,0.9)'],
      rope: { base: R.braid('#b98a45', '#7e5528', '#f0dba6'), low: R.braid('#e6a050', '#a8581e', '#ffe2a8'), crit: R.braid('#ff8a56', '#c4281a', '#ffc9a0') },
      flame: { shape: 'flame', core: ['#ffffff', '#fff2a8'], tongue: ['#ff7a1a', '#ffb02e', '#ffe27a'], halo: ['rgba(255,150,50,0.55)'], ice: ['#ffffff', '#d8efff', '#8fc8ff'] },
      ember: ['#ffb44a', '#ffe9a8'], ash: '#4c4036', heat: 'rgba(255,130,40,0.6)', smoke: 'rgba(205,190,170,0.55)', frost: '#e4f2ff',
      part: { spark: ['#ffd24a', '#ff8a3d', '#fff3b0'], ember: ['#ff9a3d', '#ff6a2a'], smoke: 'rgba(200,185,165,0.55)', special: { shape: 'fleck', colors: ['#e2c487', '#b98a45', '#f0dba6'], rate: 2.4 } },
      bomb: { kind: 'rope', pal: { hi: '#7a5a42', mid: '#3d2a1c', lo: '#150d08', edge: '#6a4a30', rim: '#d8b878' }, face: face({ line: '#2a1608', mouth: '#f6e2c0', blush: 'rgba(255,140,110,0.5)' }) },
    },
    'fuse-wire': {
      name: 'Copper Wire', h: 8, rail: { bg: 'rgba(0,0,0,0.5)', line: 'rgba(255,200,160,0.1)' }, glow: '#ff9a5a', gs: ['rgba(255,140,70,0.6)', 'rgba(255,120,50,0.85)', 'rgba(255,60,40,0.95)'],
      rope: { base: R.wire('#ffbf8f', '#c4682f'), low: R.wire('#ffd29a', '#e0702a'), crit: R.wire('#ffe0b0', '#ff4a24') },
      flame: { shape: 'star', core: ['#ffffff', '#fffbd0'], tongue: ['#ffb02e', '#ffe58a', '#fffbe0'], halo: ['rgba(255,225,120,0.65)'], ice: ['#ffffff', '#e8f6ff', '#9fd4ff'] },
      ember: ['#ffa060', '#fff0c8'], ash: '#554a44', heat: 'rgba(255,170,90,0.6)', smoke: 'rgba(220,205,200,0.4)', frost: '#e0eeff',
      part: { spark: ['#fff3b0', '#ffbf8f', '#ffd24a'], ember: ['#ffa060', '#ff7a3a'], smoke: 'rgba(215,200,195,0.4)', special: { shape: 'streak', colors: ['#ffffff', '#ffe58a', '#ffbf8f'], rate: 4 } },
      bomb: { kind: 'wire', pal: { hi: '#ffd9b4', mid: '#d9783a', lo: '#6a2e12', edge: '#7a3d18' }, face: face({ line: '#3a1608', pupil: '#2a1008', blush: 'rgba(255,90,70,0.5)' }) },
    },
    'fuse-neon': {
      name: 'Neon Tube', h: 8, rail: { bg: 'rgba(255,255,255,0.06)', line: 'rgba(190,240,255,0.4)', tube: true }, glow: '#3de1ff', gs: ['rgba(61,225,255,0.8)', 'rgba(255,61,139,0.85)', 'rgba(255,40,70,0.95)'],
      rope: { base: R.tube('#3de1ff', '#b9f6ff', '#ffffff'), low: R.tube('#ff3d8b', '#ffb3d0', '#ffffff'), crit: R.tube('#ff2a4a', '#ffa0a8', '#ffffff') },
      flame: { shape: 'flame', core: ['#ffffff', '#d8fbff'], tongue: ['#2aa8ff', '#3de1ff', '#bff6ff'], halo: ['rgba(61,225,255,0.6)'], ice: ['#ffffff', '#d8fbff', '#7fd8ff'] },
      ember: ['#3de1ff', '#d8fbff'], ash: '#2a3e58', heat: 'rgba(61,225,255,0.55)', smoke: 'rgba(120,230,255,0.3)', frost: '#cdf3ff',
      part: { spark: ['#3de1ff', '#bff6ff', '#ffffff'], ember: ['#3de1ff', '#7fd8ff'], smoke: 'rgba(110,225,255,0.28)', special: { shape: 'mote', colors: ['#3de1ff', '#bff6ff', '#ff7ad9'], rate: 2.6 } },
      bomb: { kind: 'neon', pal: { glow: '#3de1ff', core: '#d8fbff' }, face: face({ sclera: '#eaffff', pupil: '#06203a', line: '#02101e', mouth: '#bff6ff', blush: 'rgba(61,225,255,0.4)' }) },
    },
    'fuse-ice': {
      name: 'Ice', h: 14, rail: { bg: 'rgba(160,220,255,0.12)', line: 'rgba(190,235,255,0.35)' }, glow: '#bfe8ff', gs: ['rgba(150,220,255,0.7)', 'rgba(255,200,140,0.7)', 'rgba(255,120,90,0.85)'],
      rope: { base: R.ice('#f4fdff', '#9fdcff', '#5bb4ee'), low: R.tint('rgba(255,175,90,0.42)'), crit: R.tint('rgba(255,70,60,0.52)') },
      flame: { shape: 'flame', core: ['#ffffff', '#ecfaff'], tongue: ['#7fc4ff', '#bfe8ff', '#f4fdff'], halo: ['rgba(160,225,255,0.65)'], ice: ['#ffffff', '#ecfaff', '#9fd8ff'] },
      ember: ['#9fdcff', '#ffffff'], ash: '#3a4c62', heat: 'rgba(170,225,255,0.55)', smoke: 'rgba(220,240,255,0.5)', frost: '#eef9ff',
      part: { spark: ['#ffffff', '#bfe8ff', '#8fd0ff'], ember: ['#bfe8ff', '#8fd0ff'], smoke: 'rgba(220,240,255,0.5)', special: { shape: 'shard', colors: ['#f4fdff', '#bfe8ff', '#8fd0ff'], rate: 2.6 } },
      bomb: { kind: 'ice', pal: {}, face: face({ pupil: '#12304f', line: '#1d4f7a', blush: 'rgba(120,190,255,0.5)' }) },
    },
    'fuse-plasma': {
      name: 'Plasma', h: 9, rail: { bg: 'linear-gradient(180deg, rgba(120,60,255,0.15), rgba(0,0,0,0.6))', line: 'rgba(200,160,255,0.38)', tube: true }, glow: '#b36bff', gs: ['rgba(150,80,255,0.8)', 'rgba(255,80,200,0.8)', 'rgba(255,60,120,0.95)'],
      rope: { base: R.plasma('#f1d9ff', '#b36bff', '#6a2bd9'), low: R.plasma('#ffd9f4', '#ff6bd0', '#b02a9a'), crit: R.plasma('#ffe0e8', '#ff5a8a', '#c81a4a'), flow: true },
      flame: { shape: 'orb', core: ['#ffffff', '#f1d9ff'], tongue: ['#b36bff', '#d9a8ff', '#f6e8ff'], halo: ['rgba(170,100,255,0.65)'], ice: ['#ffffff', '#e8f4ff', '#9fd0ff'], ring: true },
      ember: ['#c9a0ff', '#ffffff'], ash: '#3a2a58', heat: 'rgba(180,110,255,0.55)', smoke: 'rgba(190,130,255,0.3)', frost: '#e8e0ff',
      part: { spark: ['#e6c8ff', '#b36bff', '#ffffff'], ember: ['#b36bff', '#d9a8ff'], smoke: 'rgba(180,120,255,0.3)', special: { shape: 'wisp', colors: ['#e6c8ff', '#b36bff', '#ff9ae6'], rate: 2.4 } },
      bomb: { kind: 'plasma', pal: { glow: '#b36bff', core: '#e6c8ff', arm: '#d9a8ff' }, face: face({ sclera: '#f6ecff', pupil: '#24104a', line: '#10042a', mouth: '#e6c8ff', blush: 'rgba(200,120,255,0.45)' }) },
    },
    'fuse-candy': {
      name: 'Candy Cane', h: 16, rail: { bg: 'rgba(78,8,50,0.62)', line: 'rgba(255,160,205,0.24)' }, glow: '#ff5fa8', gs: ['rgba(255,95,168,0.6)', 'rgba(255,140,40,0.85)', 'rgba(255,50,80,0.95)'],
      rope: { base: R.stripes('#ff3b78', '#ffffff'), low: R.stripes('#ff7a2a', '#fff1d8'), crit: R.stripes('#ff1f4a', '#ffffff') },
      flame: { shape: 'star', core: ['#ffffff', '#ffe0f0'], tongue: ['#ff5fa8', '#ff9ad0', '#fff0f8'], halo: ['rgba(255,140,205,0.65)'], ice: ['#ffffff', '#ffeaf6', '#ffb8e0'] },
      ember: ['#ff7ab8', '#fff0f8'], ash: '#5a3a4a', heat: 'rgba(255,120,190,0.55)', smoke: 'rgba(255,200,225,0.4)', frost: '#ffe6f4',
      part: { spark: ['#ff5fa8', '#ffffff', '#ffe58a'], ember: ['#ff7ab8', '#ffc0e0'], smoke: 'rgba(255,205,228,0.4)', special: { shape: 'sprinkle', colors: ['#ff5fa8', '#ffffff', '#ffe58a', '#7be8ff'], rate: 3.4 } },
      bomb: { kind: 'candy', pal: { a: '#ff3b78', ring: '#ffb3d2', edge: '#ffd6e8' }, face: face({ pupil: '#4a0f2a', line: '#7a1a46', blush: 'rgba(255,90,150,0.5)' }) },
    },
    'fuse-vine': {
      name: 'Vine', h: 28, railH: 17, rail: { bg: 'rgba(6,40,20,0.66)', line: 'rgba(110,255,150,0.2)' }, glow: '#6bff9e', gs: ['rgba(110,255,150,0.45)', 'rgba(255,170,60,0.7)', 'rgba(255,70,60,0.9)'],
      rope: {
        base: `${vineTile('#2f9f56', '#8dffb0', '#46d97c', '#2fbf63', '#0d5a2c')} repeat-x 0 50% / 48px 26px, linear-gradient(180deg, transparent 32%, #1f8a45 32% 68%, transparent 68%)`,
        low: `${vineTile('#c8b04a', '#fff0a0', '#e8a030', '#c8742a', '#6a5416', "<circle cx='10' cy='8.2' r='1.8' fill='#e8742a'/><circle cx='32' cy='13.6' r='1.8' fill='#ffb02e'/>")} repeat-x 0 50% / 48px 26px, linear-gradient(180deg, transparent 30%, #6a5416 30% 36%, #b8a040 36% 64%, #6a5416 64% 70%, transparent 70%)`,
        crit: `${vineTile('#d8a040', '#fff0a0', '#e86a2a', '#c8301a', '#6a2a10', "<circle cx='10' cy='8.2' r='1.8' fill='#ff4a2a'/><circle cx='32' cy='13.6' r='1.8' fill='#ff8a2a'/>")} repeat-x 0 50% / 48px 26px, linear-gradient(180deg, transparent 30%, #6a2a10 30% 36%, #c88040 36% 64%, #6a2a10 64% 70%, transparent 70%)`,
        bare: true },
      flame: { shape: 'flame', core: ['#ffffff', '#f0ffb8'], tongue: ['#2fc060', '#7cf07c', '#f0ffb8'], halo: ['rgba(130,255,150,0.6)'], ice: ['#ffffff', '#e8fff0', '#9fe8c0'] },
      ember: ['#9cf07c', '#f0ffb8'], ash: '#2e4a30', heat: 'rgba(140,255,150,0.5)', smoke: 'rgba(170,230,170,0.35)', frost: '#e2faea',
      part: { spark: ['#f0ffb8', '#7cf07c', '#ffffff'], ember: ['#9cf07c', '#d8ff9e'], smoke: 'rgba(170,230,170,0.35)', special: { shape: 'leaf', colors: ['#a8ffc0', '#46d97c', '#c8ff9e', '#ffe58a'], rate: 3.0 } },
      bomb: { kind: 'vine', pal: {}, face: face({ pupil: '#0d3a1c', line: '#0d3a1c', blush: 'rgba(255,150,170,0.5)' }) },
    },
    'fuse-rod': {
      name: 'Lightning Rod', h: 14, railH: 18, rail: { bg: 'linear-gradient(180deg, #1b2740, #0a1222)', line: 'rgba(160,210,255,0.3)', steel: true }, glow: '#9fd8ff', gs: ['rgba(255,170,110,0.55)', 'rgba(255,140,60,0.85)', 'rgba(255,70,40,0.95)'],
      rope: { base: R.segs('#ffd9b0', '#e89a5a', '#c4682f', '#6a3418'), low: R.segs('#fff0d6', '#ff9a52', '#e0541c', '#8a2410'), crit: R.segs('#ffffff', '#ffc27a', '#ff5a24', '#a8200c'), arcs: true },
      flame: { shape: 'spike', core: ['#ffffff', '#e8f6ff'], tongue: ['#5aa0ff', '#9fd8ff', '#ffffff'], halo: ['rgba(120,190,255,0.65)'], ice: ['#ffffff', '#e8f6ff', '#9fd0ff'] },
      ember: ['#ffb070', '#ffffff'], ash: '#2a3348', heat: 'rgba(140,200,255,0.55)', smoke: 'rgba(150,175,210,0.35)', frost: '#d4ecff',
      part: { spark: ['#d6f0ff', '#8fd0ff', '#ffffff'], ember: ['#ff9a52', '#ffcf9a'], smoke: 'rgba(150,175,210,0.35)', special: { shape: 'arc', colors: ['#cfeaff', '#8fd0ff'], rate: 2.2 } },
      bomb: { kind: 'rod', pal: {}, face: face({ pupil: '#0a1a3a', line: '#050d24', mouth: '#cfeaff', blush: 'rgba(120,190,255,0.4)' }) },
    },
    'fuse-phoenix': {
      name: 'Phoenix Tail', h: 24, railH: 22, rail: { bg: 'rgba(46,8,2,0.72)', line: 'rgba(255,150,50,0.28)' }, glow: '#ff9a3d', gs: ['rgba(255,140,50,0.55)', 'rgba(255,90,30,0.85)', 'rgba(255,40,30,0.95)'],
      rope: { base: `${featherTile('#a81408', '#ff6a1a', '#ffd24a')} repeat-x 0 50% / 48px 24px`, low: `${featherTile('#6a0a06', '#d8340c', '#ff9a2e')} repeat-x 0 50% / 48px 24px`, crit: `${featherTile('#4a0604', '#c81a0c', '#ff6a1a')} repeat-x 0 50% / 48px 24px`, bare: true },
      flame: { shape: 'plume', core: ['#ffffff', '#fff3b0'], tongue: ['#ff5a1a', '#ffa02a', '#ffe58a'], halo: ['rgba(255,130,40,0.6)'], ice: ['#ffffff', '#fff3d8', '#ffd7a0'] },
      ember: ['#ff8a2a', '#fff3b0'], ash: '#4a2a22', heat: 'rgba(255,120,40,0.6)', smoke: 'rgba(120,90,80,0.5)', frost: '#fff0dc',
      part: { spark: ['#ffd24a', '#ff8a2a', '#fff3b0'], ember: ['#ff8a2a', '#ff5a1a'], smoke: 'rgba(120,90,80,0.5)', special: { shape: 'feather', colors: ['#ff6a1a', '#ffd24a', '#ffb02e'], rate: 2.6 } },
      bomb: { kind: 'phoenix', pal: {}, face: face({ pupil: '#3a0a04', line: '#3a0a04', blush: 'rgba(255,200,90,0.5)', ey: 40 }) },
    },
    'fuse-dragon': {
      name: 'Dragon', h: 14, rail: { bg: 'rgba(60,5,0,0.7)', line: 'rgba(255,120,40,0.25)' }, glow: '#ff7a2a', gs: ['rgba(255,90,30,0.8)', 'rgba(255,60,20,0.9)', 'rgba(255,30,20,1)'],
      rope: { base: R.scales('#ffd24a', '#ff7a2a', '#c4200f', '#6e0b08', '#ff9a3d'), low: R.scales('#fff0a0', '#ffb02e', '#e8340c', '#8a0f06', '#ffb85a'), crit: R.scales('#ffffff', '#ffd24a', '#ff4a1a', '#a8140a', '#ffd27a') },
      flame: { shape: 'flame', core: ['#fff6c8', '#ffe58a'], tongue: ['#e8340c', '#ff7a2a', '#ffd24a'], halo: ['rgba(255,110,30,0.65)'], ice: ['#ffffff', '#ffe8d8', '#ffb890'], big: true },
      ember: ['#ff7a2a', '#ffe58a'], ash: '#3a2020', heat: 'rgba(255,100,30,0.65)', smoke: 'rgba(80,55,55,0.55)', frost: '#ffe6d6',
      part: { spark: ['#ff4d2e', '#ff9a3d', '#ffd24a'], ember: ['#ff7a2a', '#ffd24a'], smoke: 'rgba(80,55,55,0.55)', special: { shape: 'lick', colors: ['#ff4d2e', '#ff9a3d', '#ffd24a'], rate: 3.0 } },
      bomb: { kind: 'dragon', pal: {}, face: face({ pupil: '#1a0402', line: '#2a0604', slit: true, ey: 40, blush: 'rgba(255,200,90,0.45)' }) },
    },
  };


  /* ------------------------------------------------------------------ Series 4 "Moonwick": six more fuse cosmetics, same engine */
  const WOOD = ['#a56c3c', '#6b4423', '#3f2712', '#241508'];
  const ICEC = (t) => t;   // the frozen flame colours are the engine's own (see ICE in js/fuse.js); the field is kept for fuses that tint it
  Object.assign(TOKENS, {
    'fuse-candle': {
      name: 'Candlewick', h: 16, railH: 20, rail: { bg: 'rgba(44,26,6,0.55)', line: 'rgba(255,225,160,0.16)' }, glow: '#ffcf6b', gs: ['rgba(255,205,110,0.34)', 'rgba(255,160,50,0.62)', 'rgba(255,70,50,0.85)'],
      rope: { base: waxRope(['#fffef2', '#f6e4b4', '#c9a45e', '#a98650']), low: waxRope(['#fff1c4', '#ffcb62', '#d48b20', '#8a5410']), crit: waxRope(['#ffd2c0', '#ff6a4a', '#c82a12', '#7a1408']), bare: true },
      flame: { shape: 'candle', core: ['#ffffff', '#fff6d0'], tongue: ['#ff9a2e', '#ffcc4e', '#ffeeb0', '#4f8fff'], halo: ['rgba(255,190,90,0.5)'], ice: ['#ffffff', '#ecfaff', '#9fd8ff'], tf: 0.55 },
      ember: ['#ffc24a', '#fff1b8'], ash: '#6a5a44', heat: 'rgba(255,190,80,0.5)', smoke: 'rgba(238,230,216,0.45)', frost: '#fff6e0',
      part: { spark: ['#ffe27a', '#ffb84a', '#fff6c8'], ember: ['#ffb44a', '#ff8a3a'], smoke: 'rgba(238,230,216,0.45)', special: { shape: 'drip', colors: ['#fffaf0', '#f6e0a8', '#ffc860'], rate: 2.6 } },
      bomb: { kind: 'wax', pal: { edge: '#c9a45e', rim: '#fff0c8' }, face: face({ pupil: '#4a2c10', line: '#8a5a2a', mouth: '#9a4a22', blush: 'rgba(255,140,100,0.5)' }) },
      cracks: '#ffb43a', crackKind: 'drip', wick: '#fff0c0', hot: 'rgba(255,150,60,0.55)',
    },
    'fuse-wand': {
      name: 'Star Wand', h: 14, rail: { bg: 'rgba(10,8,34,0.62)', line: 'rgba(200,210,255,0.18)' }, glow: '#ffe27a', gs: ['rgba(255,236,150,0.42)', 'rgba(255,170,50,0.7)', 'rgba(255,70,50,0.9)'],
      rope: { base: wandRope(WOOD, ['#ffffff', '#d5dcec', '#8d98b0', '#5a6580']), low: wandRope(WOOD, ['#fff6c8', '#ffc23a', '#e07a10', '#8a3a04'], '#ffae38'), crit: wandRope(WOOD, ['#ffd0c0', '#ff5a40', '#d01a10', '#6a0a06'], '#ff4a30') },
      flame: { shape: 'star', core: ['#ffffff', '#fffbe6'], tongue: ['#fff3b8', '#ffe27a', '#fffbe8'], halo: ['rgba(255,236,150,0.7)'], ice: ['#ffffff', '#f4f6ff', '#b8c8ff'] },
      ember: ['#ffe58a', '#ffffff'], ash: '#3a2a22', heat: 'rgba(255,225,130,0.5)', smoke: 'rgba(200,190,235,0.35)', frost: '#eef2ff',
      part: { spark: ['#fff3b0', '#ffe27a', '#ffffff'], ember: ['#ffe27a', '#ffb02e'], smoke: 'rgba(200,190,235,0.35)', special: { shape: 'twinkle', colors: ['#fff6c8', '#ffe27a', '#ffffff', '#b8d4ff'], rate: 3.8 } },
      bomb: { kind: 'robe', pal: { edge: '#7f8cff', rim: '#9faaff' }, face: face({ sclera: '#fff9e8', pupil: '#1a1f5a', line: '#0a0d36', mouth: '#ffe08a', blush: 'rgba(255,170,200,0.45)' }) },
      cracks: '#ffd24a', hot: 'rgba(255,205,90,0.6)',
    },
    'fuse-elixir': {
      name: 'Elixir', h: 15, railH: 19, rail: { bg: 'rgba(4,30,22,0.62)', line: 'rgba(150,255,200,0.24)', tube: true }, glow: '#7affb0', gs: ['rgba(110,255,170,0.55)', 'rgba(255,190,60,0.7)', 'rgba(255,70,60,0.9)'],
      rope: { base: vialRope(['#c8ffe0', '#5cf0a0', '#2fd47c', '#12a060', '#0a7a46'], 9), low: vialRope(['#fff0c0', '#ffd062', '#f0a020', '#c07010', '#8a4a06'], 9), crit: vialRope(['#ffd6cc', '#ff7060', '#e03020', '#b01808', '#700a04'], 11), flow: { bg: flowTile('bubble'), p: 30, dur: 1.6, rev: true } },
      flame: { shape: 'orb', core: ['#ffffff', '#e8fff0'], tongue: ['#2fd87a', '#7affb0', '#e8fff0'], halo: ['rgba(90,255,160,0.65)'], ice: ['#ffffff', '#e4fff2', '#9fe8c8'] },
      ember: ['#4dff9c', '#e8fff0'], ash: '#1f4a38', heat: 'rgba(80,255,160,0.5)', smoke: 'rgba(150,255,200,0.35)', frost: '#c8ffe4', gold: 'linear-gradient(180deg, #e8fff0, #5cf0a0 45%, #12a060)',
      part: { spark: ['#b6ffd4', '#4dff9c', '#ffffff'], ember: ['#4dff9c', '#2fd87a'], smoke: 'rgba(150,255,200,0.35)', special: { shape: 'bubble', colors: ['#b6ffd4', '#7affb0', '#e8fff0'], rate: 3.4 } },
      bomb: { kind: 'flask', pal: {}, face: face({ sclera: '#f4fff8', pupil: '#0a3a22', line: '#0a3a22', mouth: '#eafff2', blush: 'rgba(255,170,190,0.4)', ey: 39, sc: 0.92 }) },
      cracks: '#bfffe0', wick: '#d8ffe8', hot: 'rgba(255,200,70,0.5)',
    },
    'fuse-sandglass': {
      name: 'Sandglass', h: 14, railH: 20, rail: { bg: 'rgba(8,16,42,0.62)', line: 'rgba(190,225,255,0.3)', tube: true }, glow: '#ffd98a', gs: ['rgba(255,214,120,0.5)', 'rgba(255,150,60,0.75)', 'rgba(255,70,50,0.9)'],
      rope: { base: sandRope(['#ffe9a0', '#f1c04a', '#c48a22']), low: sandRope(['#ffd58a', '#ff9a3a', '#c0501a']), crit: sandRope(['#ffb050', '#ff6a2a', '#c02a0a'], true), flow: { bg: flowTile('grain'), p: 18, dur: 0.55, rev: true } },
      flame: { shape: 'star', core: ['#ffffff', '#fff8dc'], tongue: ['#ffcf4a', '#ffe9a0', '#fff8e0'], halo: ['rgba(255,215,110,0.65)'], ice: ['#ffffff', '#fff6dc', '#ffe0a0'] },
      ember: ['#ffd24a', '#fff3c0'], ash: '#6a5428', heat: 'rgba(255,215,110,0.55)', smoke: 'rgba(235,215,170,0.4)', frost: '#fff2cc',
      part: { spark: ['#fff3b0', '#ffd24a', '#ffffff'], ember: ['#ffd24a', '#ffa02a'], smoke: 'rgba(235,215,170,0.4)', special: { shape: 'grain', colors: ['#ffe9a0', '#f1c04a', '#fff6d8'], rate: 5.2 } },
      bomb: { kind: 'hourglass', pal: {}, face: face({ pupil: '#2a1a08', line: '#3a2410', mouth: '#fff0c0', blush: 'rgba(255,170,110,0.45)', ey: 23, sc: 0.66 }) },
      cracks: '#fff0b0', hot: 'rgba(255,170,60,0.5)',
    },
    'fuse-runechain': {
      name: 'Runechain', h: 18, railH: 22, rail: { bg: 'rgba(4,12,28,0.72)', line: 'rgba(130,220,255,0.26)' }, glow: '#8fd8ff', gs: ['rgba(90,215,255,0.5)', 'rgba(255,170,60,0.7)', 'rgba(255,70,50,0.9)'],
      rope: { base: chainRope(['#bff6ff', '#2fc8ff'], '#9fb4d0'), low: chainRope(['#ffe0a0', '#ff9a2a'], '#c8b090'), crit: chainRope(['#ffc0b0', '#ff4a30'], '#c89088'), bare: true },
      flame: { shape: 'spike', core: ['#ffffff', '#e8fcff'], tongue: ['#2fd0ff', '#9ff0ff', '#ffffff'], halo: ['rgba(90,215,255,0.65)'], ice: ['#ffffff', '#e8f6ff', '#9fd0ff'] },
      ember: ['#5ae6ff', '#e8fcff'], ash: '#1d2535', heat: 'rgba(90,220,255,0.5)', smoke: 'rgba(130,170,200,0.35)', frost: '#dff6ff',
      part: { spark: ['#bff6ff', '#5ae6ff', '#ffffff'], ember: ['#5ae6ff', '#2fa8e0'], smoke: 'rgba(130,170,200,0.35)', special: { shape: 'chip', colors: ['#7a8aa4', '#4c5870', '#8fecff', '#bff6ff'], rate: 3.2 } },
      bomb: { kind: 'golem', pal: { edge: '#2a3446' }, face: face({ sclera: '#d8fbff', pupil: '#06303f', line: '#0a1620', mouth: '#bfeaff', blush: 'rgba(90,215,255,0.3)' }) },
      cracks: '#2fd0ff', crackLine: '#e8fcff', wick: '#8fecff', hot: 'rgba(70,210,255,0.55)',
    },
    'fuse-moonrise': {
      name: 'Moonrise', h: 10, railH: 14, rail: { bg: 'rgba(6,10,38,0.66)', line: 'rgba(200,215,255,0.3)', tube: true }, glow: '#e8f0ff', gs: ['rgba(220,232,255,0.6)', 'rgba(255,190,120,0.7)', 'rgba(255,90,80,0.9)'],
      rope: { base: ribbonRope(['#8ea4dc', '#dbe6ff', '#c8d8ff']), low: R.tint('rgba(255,150,40,0.45)'), crit: R.tint('rgba(255,50,40,0.58)'), flow: { bg: flowTile('dust'), p: 30, dur: 2.4 } },
      flame: { shape: 'orb', core: ['#ffffff', '#f2f7ff'], tongue: ['#c8dcff', '#eaf2ff', '#ffffff'], halo: ['rgba(200,220,255,0.7)'], ice: ['#ffffff', '#f2f7ff', '#c8dcff'], ring: true },
      ember: ['#cfe0ff', '#ffffff'], ash: '#2a3150', heat: 'rgba(190,210,255,0.5)', smoke: 'rgba(200,215,255,0.3)', frost: '#f2f6ff',
      part: { spark: ['#ffffff', '#cfe0ff', '#fff3c8'], ember: ['#cfe0ff', '#9fb4ff'], smoke: 'rgba(200,215,255,0.3)', special: { shape: 'stardust', colors: ['#ffffff', '#cfe0ff', '#fff3c8'], rate: 3.2, frozen: true } },
      bomb: { kind: 'moon', pal: { edge: '#b9c9f0', glow: '#bcd0ff' }, face: face({ sclera: '#ffffff', pupil: '#1a2250', line: '#2a3568', mouth: '#3a4a8a', blush: 'rgba(160,180,255,0.5)' }) },
      cracks: '#aab8ff', wick: '#e8f0ff', hot: 'rgba(255,170,120,0.5)',
    },
  });

  /* ------------------------------------------------------------------ the DOM layers a body makes of itself on the live bomb (css = the pictures they use, baked with the fuse's tokens)
     back: behind the glass/body (inside .fz-xb); body: inside .fz-body, so it turns with the body. Strings only; the engine puts them in once per body. */
  const XTRA = {
    flask: { back: () => '<i class="fx-bulb"><i class="fx-lq"></i><i class="fx-lq hot"></i><i class="fx-lq cr"></i></i>' },
    hourglass: { body: () => '<i class="fx-stream"></i><i class="fx-hang"></i>' },
    golem: {
      body: () => Array.from({ length: 8 }, (_, i) => `<i class="rn rn${i + 1}"></i>`).join(''),
      css: (sel) => {
        const pos = [[32, 20.4], [18.6, 21.4], [45.4, 21.4], [10.2, 34.6], [53.4, 25.4], [14, 50.6], [50.2, 50.4], [32.6, 61]];
        const img = (i, lit) => uri(svg(`<g transform='translate(1 1)'>${lit ? `<path d='${RUNES[i]}' fill='none' stroke='#2fc8ff' stroke-opacity='.55' stroke-width='4.2' stroke-linecap='round' stroke-linejoin='round'/>` : `<path d='${RUNES[i]}' fill='none' stroke='#0a0f18' stroke-opacity='.75' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round' transform='translate(.4 .6)'/>`}<path d='${RUNES[i]}' fill='none' stroke='${lit ? '#d8fbff' : '#56627a'}' stroke-width='${lit ? 2.1 : 2.2}' stroke-linecap='round' stroke-linejoin='round'/></g>`, '', '0 0 14 14'));
        let c = '';
        pos.forEach(([x, y], i) => { c += `${sel} .rn${i + 1}{left:calc(${f1(x - 3.2)} * var(--b));top:calc(${f1(y - 3.2)} * var(--b));background-image:${img(i, false)}}${sel} .rn${i + 1}::after{background-image:${img(i, true)}}\n`; });
        for (let n = 1; n <= 8; n++) c += `${sel}[data-rn="${n}"] .rn:nth-child(-n+${n})::after{opacity:1}\n`;
        return c;
      } },
    moon: {
      back: () => '<i class="fx-halo"></i><i class="fx-corona"></i>',
      body: () => '<i class="fx-phs"><i class="fx-ph p1"></i><i class="fx-ph p2"></i><i class="fx-ph p3"></i><i class="fx-ph p4"></i></i>',
      css: (sel) => {
        const dark = `${rg('dk', [[0, '#1c2652'], [1, '#080c26']], 0.5, 0.5, 0.6)}`;
        const mk = (inner) => uri(svg(inner, dark));
        const fill = "fill='url(#dk)' fill-opacity='.93'";
        const p1 = mk(`<path d='M32 10A26 26 0 0 0 32 62A12.5 26 0 0 1 32 10Z' ${fill}/><path d='M32 10A12.5 26 0 0 0 32 62' fill='none' stroke='#080c26' stroke-opacity='.3' stroke-width='2.6'/>`);
        const p2 = mk(`<path d='M32 10A26 26 0 0 0 32 62A2.6 26 0 0 1 32 10Z' ${fill}/><path d='M32 10A2.6 26 0 0 1 32 62' fill='none' stroke='#080c26' stroke-opacity='.3' stroke-width='2.6'/>`);
        const p3 = mk(`<path fill-rule='evenodd' d='M32 10A26 26 0 1 0 32 62A26 26 0 1 0 32 10ZM32 10A26 26 0 0 1 32 62A19 26 0 0 0 32 10Z' ${fill}/>`);
        const p4 = mk(`<circle cx='32' cy='36' r='26' ${fill}/><circle cx='32' cy='36' r='24.6' fill='none' stroke='#dfe8ff' stroke-opacity='.9' stroke-width='2'/><circle cx='32' cy='36' r='22.8' fill='none' stroke='#9fb4ff' stroke-opacity='.4' stroke-width='1.4'/>`);
        return `${sel} .fx-ph.p1{background-image:${p1}}${sel} .fx-ph.p2{background-image:${p2}}${sel} .fx-ph.p3{background-image:${p3}}${sel} .fx-ph.p4{background-image:${p4}}\n`;
      } },
  };

  /** Fall back for any future fuse class that has no tokens: the Basic Cord. */
  const tokensFor = (cls) => TOKENS[cls] || TOKENS['fuse-classic'];

  BR.FuseArt = { uri, R, BODY, TOKENS, tokensFor, bodyURI, flameURI, flameAllURI, cracksURI, frostBombURI, WARM, FLAME, XTRA, RUNES };
})();
