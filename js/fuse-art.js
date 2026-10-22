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
    classic: (P) => svg(
      shadow + `${BALL} fill='url(#b)' stroke='${P.edge}' stroke-width='2'/>` + rim(P.rim) + gloss(0.9) +
      `<rect x='54' y='29' width='9' height='14' rx='3' fill='url(#cap)' stroke='${P.capEdge}' stroke-width='1.2'/><ellipse cx='60.2' cy='36' rx='1.5' ry='4' fill='#2a1a06' opacity='.7'/>` +
      `<rect x='22' y='2.5' width='20' height='13' rx='3.5' fill='url(#cap)' stroke='${P.capEdge}' stroke-width='1.5'/><path d='M22.6 7.4h18.8M22.6 11h18.8' stroke='${P.capEdge}' stroke-opacity='.45'/><path d='M25.5 5.2h13' stroke='#fff8c8' stroke-width='1.4' stroke-linecap='round' opacity='.75'/><path d='M23 15.4Q32 19 41 15.4' fill='none' stroke='${P.capEdge}' stroke-width='1.2'/>`,
      GL + rg('b', [[0, P.hi], [0.45, P.mid], [1, P.lo]]) + lg('cap', [[0, '#fff0a0'], [0.5, '#e8b030'], [1, '#a8620a']])),

    rope: (P) => svg(
      shadow + `${BALL} fill='url(#b)' stroke='${P.edge}' stroke-width='2'/>` +
      `<clipPath id='c'><circle cx='32' cy='36' r='26'/></clipPath><g clip-path='url(#c)' fill='none' stroke-linecap='round'>` +
      ['M5 25Q32 14 59 25', 'M5 49Q32 60 59 49'].map((d) => `<path d='${d}' stroke='#6a431c' stroke-width='7.6'/><path d='${d}' stroke='#d8b878' stroke-width='6'/><path d='${d}' stroke='#8a6232' stroke-width='6' stroke-dasharray='1.5 2.5' opacity='.85'/><path d='${d}' stroke='#fff3cf' stroke-width='1.2' opacity='.5' transform='translate(0 -1.6)'/>`).join('') + '</g>' +
      rim(P.rim, 0.4) + gloss(0.55) +
      `<rect x='54' y='29' width='9' height='14' rx='3' fill='#d8b878' stroke='#6a431c' stroke-width='1.3'/><path d='M55 32.5h7M55 36h7M55 39.5h7' stroke='#8a6232' stroke-width='1.3'/>` +
      `<rect x='22' y='3' width='20' height='13' rx='3' fill='#d8b878' stroke='#6a431c' stroke-width='1.5'/><path d='M22.6 6.5h18.8M22.6 9.5h18.8M22.6 12.5h18.8' stroke='#8a6232' stroke-width='1.4'/><path d='M40 4.5Q47 1 49 7M41 7Q46 5 48 10' fill='none' stroke='#d8b878' stroke-width='2.2' stroke-linecap='round'/>`,
      GL + rg('b', [[0, P.hi], [0.45, P.mid], [1, P.lo]])),

    wire: (P) => {
      let coils = '';
      for (const y of [15, 19, 23, 49, 53, 57]) {
        const dx = Math.sqrt(Math.max(0, 26 * 26 - (y - 36) * (y - 36))) - 1, bulge = y < 36 ? 5 : 6;
        coils += `<path d='M${f1(32 - dx)} ${y}Q32 ${y + bulge} ${f1(32 + dx)} ${y}' fill='none' stroke='#6a2c10' stroke-width='2.3'/><path d='M${f1(32 - dx + 1)} ${y - 0.7}Q32 ${y + bulge - 0.7} ${f1(32 + dx - 1)} ${y - 0.7}' fill='none' stroke='#ffd9b4' stroke-width='.9' stroke-opacity='.65'/>`;
      }
      return svg(
        shadow + `${BALL} fill='url(#b)' stroke='${P.edge}' stroke-width='2'/>` + `<clipPath id='c'><circle cx='32' cy='36' r='26'/></clipPath><g clip-path='url(#c)'>${coils}</g>` + rim('#ffd9b4', 0.55) + gloss(1) +
        `<ellipse cx='32' cy='36' rx='9' ry='5.5' fill='none'/>` +
        `<rect x='54' y='30' width='9' height='12' rx='2.5' fill='url(#cu)' stroke='#7a3a14' stroke-width='1.2'/><path d='M55 33h7' stroke='#fff0dc' stroke-width='1' opacity='.7'/>` +
        `<rect x='28' y='7' width='8' height='9' rx='1.5' fill='url(#cu)' stroke='#7a3a14' stroke-width='1.3'/><circle cx='32' cy='4.5' r='4.6' fill='none' stroke='url(#cu)' stroke-width='3'/><circle cx='32' cy='4.5' r='4.6' fill='none' stroke='#7a3a14' stroke-width='.8' opacity='.6'/><ellipse cx='30.6' cy='3.2' rx='1.4' ry='.9' fill='#fff' opacity='.7'/>`,
        GL + rg('b', [[0, P.hi], [0.42, P.mid], [1, P.lo]]) + lg('cu', [[0, '#ffe0c0'], [0.5, '#e8884a'], [1, '#8a3a14']]));
    },

    neon: (P) => svg(
      shadow + `${BALL} fill='url(#b)'/>` +
      `<circle cx='32' cy='36' r='25' fill='none' stroke='${P.glow}' stroke-width='6' opacity='.22'/><circle cx='32' cy='36' r='25' fill='none' stroke='${P.glow}' stroke-width='2.6'/><circle cx='32' cy='36' r='24.9' fill='none' stroke='${P.core}' stroke-width='.9' opacity='.85'/>` +
      `<path d='M13 46A21 21 0 0 0 51 46' fill='none' stroke='${P.glow}' stroke-width='1.2' opacity='.45'/><path d='M10 36A22 22 0 0 1 20 17' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' opacity='.5'/>` +
      `<rect x='54' y='30' width='9' height='12' rx='3' fill='#0b1330' stroke='${P.glow}' stroke-width='1.8'/><rect x='56.5' y='33' width='4' height='6' rx='1.5' fill='${P.core}' opacity='.9'/>` +
      `<rect x='24' y='3' width='16' height='12' rx='4' fill='#0b1330' stroke='${P.glow}' stroke-width='2'/><rect x='28' y='6.4' width='8' height='5.2' rx='2.4' fill='${P.core}'/>`,
      rg('b', [[0, '#1c2f63'], [0.6, '#0a1127'], [1, '#050813']])),

    ice: (P) => svg(
      shadow + `${BALL} fill='url(#b)' stroke='#cfeeff' stroke-width='2'/>` +
      `<path d='M10 26L32 36L54 26M10 48L32 36L54 48M32 36V62M32 36V12' fill='none' stroke='#fff' stroke-opacity='.4' stroke-width='1'/><path d='M14 52Q32 66 50 52' fill='none' stroke='#2a7ab8' stroke-opacity='.25' stroke-width='3' stroke-linecap='round'/>` + rim('#ffffff', 0.7) + gloss(1) +
      `<g fill='#fff'><path d='M17 17l1 3.2 3.2 1-3.2 1-1 3.2-1-3.2-3.2-1 3.2-1z' opacity='.9'/></g>` +
      `<path d='M54.6 30.5L63 32.5L62 40L54.6 41.5Z' fill='url(#ig)' stroke='#9fdcff' stroke-width='1.1' stroke-linejoin='round'/>` +
      `<path d='M21 15L22.4 2L27.6 9L32 0.6L36.4 9L41.6 2L43 15Z' fill='url(#ig)' stroke='#8fd0ff' stroke-width='1.3' stroke-linejoin='round'/><path d='M27 12L28 6M32 12V5M37 12L36 6' stroke='#fff' stroke-width='.9' opacity='.8'/>`,
      GL + rg('b', [[0, '#ffffff'], [0.4, '#c8ecff'], [1, '#5fa8e0']]) + lg('ig', [[0, '#ffffff'], [1, '#9fdcff']])),

    plasma: (P) => svg(
      shadow + `${BALL} fill='url(#b)'/>` +
      `<circle cx='32' cy='36' r='25' fill='none' stroke='${P.glow}' stroke-width='5' opacity='.28'/><circle cx='32' cy='36' r='25' fill='none' stroke='${P.glow}' stroke-width='2.2'/>` +
      `<clipPath id='c'><circle cx='32' cy='36' r='25'/></clipPath><g clip-path='url(#c)' fill='none' stroke-linecap='round'><path d='M32 36C40 22 58 28 56 46' stroke='${P.arm}' stroke-width='4' opacity='.4'/><path d='M32 36C40 22 58 28 56 46' stroke='${P.core}' stroke-width='1.2' opacity='.8'/><path d='M32 36C24 50 6 44 8 26' stroke='${P.arm}' stroke-width='4' opacity='.4'/><path d='M32 36C24 50 6 44 8 26' stroke='${P.core}' stroke-width='1.2' opacity='.8'/><path d='M32 36C20 26 22 8 38 8' stroke='${P.arm}' stroke-width='3' opacity='.35'/><path d='M32 36C44 46 42 62 26 62' stroke='${P.arm}' stroke-width='3' opacity='.35'/></g>` +
      `<ellipse cx='32' cy='36' rx='29' ry='8' transform='rotate(-24 32 36)' fill='none' stroke='${P.core}' stroke-width='1.6' opacity='.75'/><circle cx='56.6' cy='27.4' r='2.8' fill='#fff'/><circle cx='56.6' cy='27.4' r='5' fill='${P.glow}' opacity='.45'/>` + gloss(0.7) +
      `<rect x='54' y='30' width='9' height='12' rx='3' fill='url(#mt)' stroke='${P.glow}' stroke-width='1.4'/>` +
      `<path d='M25 14.5L22.5 9L25 3.5H39L41.5 9L39 14.5Z' fill='url(#mt)' stroke='${P.glow}' stroke-width='1.5' stroke-linejoin='round'/><circle cx='32' cy='9' r='3' fill='${P.core}'/>`,
      GL + rg('b', [[0, '#5a2fb0'], [0.5, '#1d0b45'], [1, '#07021a']]) + lg('mt', [[0, '#e6c8ff'], [1, '#6a2bd9']])),

    candy: (P) => {
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
        `<rect x='22.5' y='3' width='19' height='12.5' rx='4' fill='#fff' stroke='#c4306f' stroke-width='1.6'/><path d='M27 3.4v11.8M32 3.4v11.8M37 3.4v11.8' stroke='${P.a}' stroke-width='2.4'/><path d='M24 6h16' stroke='#fff' stroke-width='1' opacity='.7'/>` +
        `<path d='M41 6Q47 2 50 7' fill='none' stroke='${P.a}' stroke-width='2.4' stroke-linecap='round'/>`,
        GL);
    },

    vine: (P) => svg(
      shadow + `${BALL} fill='url(#b)' stroke='#3fae62' stroke-width='2'/>` +
      `<clipPath id='c'><circle cx='32' cy='36' r='26'/></clipPath><g clip-path='url(#c)'><path d='M4 24C14 17 26 28 36 21S52 15 62 22' fill='none' stroke='#0d5a2c' stroke-width='4.4' stroke-linecap='round'/><path d='M4 24C14 17 26 28 36 21S52 15 62 22' fill='none' stroke='#3fbf68' stroke-width='2.6' stroke-linecap='round'/><path d='M8 52C20 46 32 58 46 50S60 52 62 50' fill='none' stroke='#2a9d54' stroke-width='2.4' stroke-linecap='round'/></g>` +
      `<g fill='#5cf08c' stroke='#0d5a2c' stroke-width='.7'><path d='M16 22C11 16 18 12 23 15C23 19 20 22 16 22z'/><path d='M47 21C52 27 58 25 59 20C55 17 50 18 47 21z'/><path d='M22 53C18 58 22 62 27 60C27 56 25 53 22 53z'/></g>` + rim('#b6ffc4', 0.4) + gloss(0.65) +
      `<rect x='54' y='30' width='9' height='12' rx='3' fill='#2fae5e' stroke='#0d5a2c' stroke-width='1.3'/><path d='M55.5 33.5h6M55.5 38h6' stroke='#b6ffc4' stroke-width='1' opacity='.6'/>` +
      `<path d='M32 15C18 17 15 3 28 1.5C29 7.5 37 8.5 32 15Z' fill='url(#lf)' stroke='#0d5a2c' stroke-width='1.5' stroke-linejoin='round'/><path d='M31 13C27 10 25 7 26.5 4' stroke='#1b8a45' stroke-width='1' fill='none'/><path d='M33 3C37 -1 44 3 41 8C39.5 10 36.5 9.5 36.5 7.5' fill='none' stroke='#3fae62' stroke-width='1.8' stroke-linecap='round'/>`,
      GL + rg('b', [[0, '#9be8a8'], [0.45, '#2f8148'], [1, '#0e2c1a']]) + lg('lf', [[0, '#b6ffc4'], [1, '#2fae5e']], 0, 0, 1, 1)),

    rod: (P) => {
      const arms = [[37.9, 35, 43.8, 31.8, 49.9, 31.8, 55.9, 35.8], [35.2, 38.4, 39.4, 41.9, 43.1, 45.8, 43.4, 52.4], [27.3, 37.7, 24.1, 43, 26.3, 51.1, 24.6, 56.8], [27.5, 30.5, 23, 27.1, 18.8, 23.1, 13.3, 20.9], [31.9, 28, 25.8, 23.7, 24.8, 17.5, 28.3, 10.3], [34.3, 29.5, 36.8, 25, 40.2, 21.1, 46.4, 19.5]]
        .map((p) => { const d = `M32 34L${f1(p[0])} ${f1(p[1])}L${f1(p[2])} ${f1(p[3])}L${f1(p[4])} ${f1(p[5])}L${f1(p[6])} ${f1(p[7])}`; return `<path d='${d}' fill='none' stroke='#8fd0ff' stroke-opacity='.5' stroke-width='3'/><path d='${d}' fill='none' stroke='#fff' stroke-width='1'/>`; }).join('');
      return svg(
        shadow + `${BALL} fill='url(#b)'/>` + `<clipPath id='c'><circle cx='32' cy='36' r='25'/></clipPath><g clip-path='url(#c)'>${arms}</g>` + `<circle cx='32' cy='36' r='26' fill='none' stroke='#5a2a10' stroke-width='3.6'/><circle cx='32' cy='36' r='25' fill='none' stroke='#c2672f' stroke-width='2'/>` + gloss(0.7) +
        `<path d='M10 30A24 24 0 0 1 26 12' fill='none' stroke='#8fd0ff' stroke-width='1.4' opacity='.5'/>` +
        `<rect x='54' y='29' width='9' height='14' rx='2.5' fill='url(#cu)' stroke='#5a2a10' stroke-width='1.3'/><path d='M55 33h7M55 39h7' stroke='#5a2a10' stroke-opacity='.5'/>` +
        `<path d='M31 15.5L31.6 5.8L28.6 5.8L32 .4L35.4 5.8L32.4 5.8L33 15.5' fill='url(#cu)' stroke='#5a2a10' stroke-width='1'/><path d='M23 17Q32 12.5 41 17L43 20Q32 16 21 20Z' fill='url(#cu)' stroke='#5a2a10' stroke-width='1.1'/>`,
        GL + rg('b', [[0, '#fff'], [0.04, '#fff'], [0.12, '#cfeaff'], [0.34, '#5aa0ff', 0.6], [0.74, '#080e28']], 0.5, 0.52, 0.55) + lg('cu', [[0, '#e8884a'], [0.45, '#ffe2c2'], [1, '#8a4018']], 0, 0, 1, 0));
    },

    phoenix: (P) => svg(
      shadow + `<path d='${EGG}' fill='url(#b)' stroke='#ffb02e' stroke-width='2.2'/>` +
      `<clipPath id='c'><path d='${EGG}'/></clipPath><g clip-path='url(#c)' fill='#ffd24a' opacity='.55'>${Array.from({ length: 28 }, (_, i) => { const r = Math.floor(i / 7), c = i % 7; return `<circle cx='${f1(10 + c * 7.4 + (r % 2) * 3.7)}' cy='${f1(48 + r * 6.4 - 12)}' r='1.6'/>`; }).join('')}</g>` +
      `<path d='M33 12L29 22L35 29L28 39L34 47L30 57' fill='none' stroke='#ff6a1a' stroke-opacity='.55' stroke-width='3'/><path d='M33 12L29 22L35 29L28 39L34 47L30 57' fill='none' stroke='#ffd24a' stroke-width='1.1'/><path d='M35 29L43 32L46 39M28 39L20 41L17 48' fill='none' stroke='#ffd24a' stroke-width='.9'/>` +
      rim('#ffd24a', 0.45) + `<ellipse cx='22' cy='25' rx='9' ry='5.2' transform='rotate(-38 22 25)' fill='url(#gl)' opacity='.8'/>` +
      `<rect x='54' y='31' width='9' height='12' rx='3' fill='#e8541c' stroke='#ffb02e' stroke-width='1.3'/><path d='M55.5 34h6M55.5 39h6' stroke='#ffd24a' stroke-width='1' opacity='.7'/>` +
      `<path d='M32 .6L36.5 10.4L44.6 1.4L41 16L48 12.6L38 26L32 24L26 26L16 12.6L23 16L19.4 1.4L27.5 10.4Z' transform='translate(0 0) scale(1 .62) translate(0 6.5)' fill='url(#cr)' stroke='#e8541c' stroke-width='1.2' stroke-linejoin='round'/>`,
      GL + rg('b', [[0, '#ffb870'], [0.3, '#e8541c'], [0.62, '#8a1608'], [1, '#2a0604']], 0.34, 0.24, 0.9) + lg('cr', [[0, '#fff3b0'], [0.4, '#ffd24a'], [1, '#e8541c']], 0, 0, 0, 1)),

    dragon: (P) => svg(
      shadow + `<path d='M32 9C45 9 56 22 56 39C56 53 46 62 32 62C18 62 8 53 8 39C8 22 19 9 32 9Z' fill='url(#b)' stroke='#ffb02e' stroke-width='2.2'/>` +
      `<clipPath id='c'><path d='M32 9C45 9 56 22 56 39C56 53 46 62 32 62C18 62 8 53 8 39C8 22 19 9 32 9Z'/></clipPath><g clip-path='url(#c)'>` +
      Array.from({ length: 6 }, (_, r) => Array.from({ length: 7 }, (_, c) => { const x = 6 + c * 10 + (r % 2) * 5, y = 14 + r * 9; return `<path d='M${x - 5} ${y}A5 5 0 0 0 ${x + 5} ${y}' fill='none' stroke='#2a0604' stroke-opacity='.55' stroke-width='1.6'/><path d='M${x - 4.4} ${y - 1.2}A4.6 4.6 0 0 0 ${x + 4.4} ${y - 1.2}' fill='none' stroke='#ffb85a' stroke-opacity='.55' stroke-width='.9'/>`; }).join('')).join('') + '</g>' +
      rim('#ffd24a', 0.45) + `<ellipse cx='22' cy='24' rx='9.5' ry='5.4' transform='rotate(-38 22 24)' fill='url(#gl)' opacity='.75'/>` +
      `<rect x='53.6' y='31' width='9.4' height='12' rx='3' fill='#c4200f' stroke='#ffb02e' stroke-width='1.4'/><path d='M55 34h6.4M55 39h6.4' stroke='#ffd24a' stroke-width='1' opacity='.7'/>` +
      `<path d='M15 14L19 .8L25.5 9.5L32 -0.4L38.5 9.5L45 .8L49 14Q32 18.5 15 14Z' fill='#ffd24a' stroke='#b8620a' stroke-width='1.3' stroke-linejoin='round'/><path d='M19 12Q32 15.5 45 12' fill='none' stroke='#fff3b0' stroke-width='1.2' opacity='.7'/><circle cx='32' cy='9.4' r='2' fill='#ff4d2e' stroke='#b8620a' stroke-width='.8'/>`,
      GL + rg('b', [[0, '#ff9a5a'], [0.45, '#d8340c'], [1, '#6e0b08']], 0.34, 0.28, 0.9)),
  };

  /* ------------------------------------------------------------------ face: the calm face baked in, for the small previews (the run draws its own live one) */
  const faceSVG = (F) => {
    const eye = (cx) => `<ellipse cx='${cx}' cy='${F.ey}' rx='6' ry='7' fill='${F.sclera}' stroke='${F.line}' stroke-width='1.4'/>` +
      (F.slit ? `<ellipse cx='${cx + 0.8}' cy='${F.ey + 0.6}' rx='1.5' ry='5.4' fill='${F.pupil}'/>` : `<ellipse cx='${cx + 0.8}' cy='${F.ey + 0.6}' rx='3.2' ry='4' fill='${F.pupil}'/>`) + `<circle cx='${cx + 2}' cy='${F.ey - 1.4}' r='1.2' fill='#fff'/>`;
    return eye(22) + eye(42) + `<path d='M26 ${F.ey + 12.5}Q32 ${F.ey + 17.5} 38 ${F.ey + 12.5}' fill='none' stroke='${F.mouth || F.line}' stroke-width='2.2' stroke-linecap='round'/>` + `<ellipse cx='15' cy='${F.ey + 9}' rx='3.2' ry='2' fill='${F.blush}'/><ellipse cx='49' cy='${F.ey + 9}' rx='3.2' ry='2' fill='${F.blush}'/>`;
  };
  const bodyURI = (kind, P, faceTok) => {
    let s = BODY[kind](P);
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
    orb: {
      tongue: 'M16 10C23 10 28 16 28 23C28 30 23 36 16 36C9 36 4 30 4 23C4 16 9 10 16 10Z',
      core: 'M16 17C20 17 23 20 23 24C23 28 20 31 16 31C12 31 9 28 9 24C9 20 12 17 16 17Z' },
  };
  /** One flame SVG layer. kind 'tongue' fades from the tip color down to the base color; 'core' is the white-hot heart. */
  const flameURI = (shape, layer, c) => {
    const S = FLAME[shape] || FLAME.flame, id = 'f';
    if (layer === 'tongue') return uri(svg(`<path d='${S.tongue}' fill='url(#${id})'/>`, lg(id, [[0, c[0]], [0.55, c[1]], [1, c[2]]]), '0 0 32 40'));
    return uri(svg(`<path d='${S.core}' fill='url(#${id})'/>`, lg(id, [[0, c[0]], [1, c[1]]]), '0 0 32 40'));
  };
  /** All three layers in one picture (used by the small previews, which have one spark element). */
  const flameAllURI = (shape, t) => {
    const S = FLAME[shape] || FLAME.flame;
    return uri(svg(`<circle cx='16' cy='25' r='15' fill='url(#h)'/><path d='${S.tongue}' fill='url(#t)'/><path d='${S.core}' fill='url(#k)'/>`,
      `<radialGradient id='h'>${stops([[0, t.halo[0], 0.7], [1, t.halo[0], 0]])}</radialGradient>` + lg('t', [[0, t.tongue[0]], [0.55, t.tongue[1]], [1, t.tongue[2]]]) + lg('k', [[0, t.core[0]], [1, t.core[1]]]), '0 0 32 40'));
  };

  /* generic crack lines (the bomb splits open when it panics) and frost (Rush) */
  const cracksURI = (hot, line) => uri(svg(`<path d='M33 9L29 19L35 26L28 36L34 44L30 54' fill='none' stroke='${hot}' stroke-opacity='.6' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'/><path d='M33 9L29 19L35 26L28 36L34 44L30 54' fill='none' stroke='${line}' stroke-width='1.2' stroke-linejoin='round'/><path d='M35 26L45 28L49 36M28 36L19 38L15 46M29 19L21 16' fill='none' stroke='${line}' stroke-width='1' stroke-linecap='round'/>`));
  /** Frost on the bomb in Rush: scalloped icing along the upper-left of the body (rounded drips, never points), a smaller patch low on the right, and glints. */
  const frostBombURI = (c) => {
    const pt = (r, deg) => `${f1(32 + r * Math.cos((deg * Math.PI) / 180))} ${f1(36 + r * Math.sin((deg * Math.PI) / 180))}`;
    const R0 = 27.4;
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
      `<circle cx='32' cy='36' r='25.4' fill='none' stroke='#fff' stroke-opacity='.45' stroke-width='1.5'/>` +
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

  /** Fall back for any future fuse class that has no tokens: the Basic Cord. */
  const tokensFor = (cls) => TOKENS[cls] || TOKENS['fuse-classic'];

  BR.FuseArt = { uri, R, BODY, TOKENS, tokensFor, bodyURI, flameURI, flameAllURI, cracksURI, frostBombURI, WARM, FLAME };
})();
