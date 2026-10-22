/* Fizz Hats (Update 5, Series 4 "Moonwick", spec section 4): the 12 hats as data. Node-loadable like js/fuse-art.js (no DOM at load).
   Every hat is drawn in the BOMB'S OWN COORDINATES for the round bomb: the sphere is centred on (32, 36) with radius 26, the head line (where a brim sits)
   is y = 16, and the picture's view box is "-16 -40 96 80", so a hat can reach above the bomb and past its sides. Each body kind that is not a plain
   ball (egg, dragon, hourglass, wax, robe, flask, golem, moon) has an anchor: where that body's head is, as a move and a scale of the hat about
   (32, 16). A hat can leave out the body's own cap, crown or topper (`noTop`): js/fuse.js then draws the body without it while the hat is worn.
   Some hats have a part that moves on its own (the Propeller Cap's blades, the Wizard Hat's tip): `parts`, each a second picture in its own box.

   API (browser and Node):
     BR.HATS                      the 12 entries { id, name, rarity, desc, earn, noTop, lip, parts? }
     BR.Hats.byId(id)             one entry (undefined for an unknown id), BR.Hats.list the same array
     BR.Hats.svg(id, o)           the hat as a standalone SVG string (o.live: without its moving parts; o.part: the n-th part alone)
     BR.Hats.anchor(id, kind)     { x, y, s } for a body kind ('classic', 'dragon', 'wax', ...) or a hat class ('ball', 'egg', ...)
     BR.Hats.kindOf(bodyKind)     the hat class of a body kind
     BR.Hats.html(id, bodyKind)   the live bomb's element: <i class="fz-hat" data-hat="..."> (browser; bakes the hat's picture on first use)
     BR.Hats.miniAttrs(id, cls)   attributes for a small .mini-fuse preview that wears the hat (browser)
     BR.Hats.badge(id, size, o)   the item badge of a hat: Fizz wearing it (browser; o.still, o.locked, o.cls like BR.Badge.html)
     BR.Hats.ensure(id)           bake the hat's picture into the page (browser; the calls above do it) */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});
  const f1 = (n) => Math.round(n * 10) / 10;
  const uri = (svg) => 'url("data:image/svg+xml,' + svg.replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'").replace(/\s+/g, ' ').trim() + '")';
  const VB = '-16 -40 96 80';
  const svg = (inner, defs, vb) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb || VB}'>${defs ? `<defs>${defs}</defs>` : ''}${inner}</svg>`;
  const stops = (a) => a.map(([o, c, op]) => `<stop offset='${o}' stop-color='${c}'${op != null ? ` stop-opacity='${op}'` : ''}/>`).join('');
  const lg = (id, a, x1, y1, x2, y2) => `<linearGradient id='${id}' x1='${x1 || 0}' y1='${y1 || 0}' x2='${x2 == null ? 0 : x2}' y2='${y2 == null ? 1 : y2}'>${stops(a)}</linearGradient>`;
  const rg = (id, a, cx, cy, r) => `<radialGradient id='${id}' cx='${cx == null ? 0.4 : cx}' cy='${cy == null ? 0.35 : cy}' r='${r == null ? 0.8 : r}'>${stops(a)}</radialGradient>`;
  const dot = (x, y, r, c, op) => `<circle cx='${f1(x)}' cy='${f1(y)}' r='${f1(r)}' fill='${c}'${op != null ? ` fill-opacity='${op}'` : ''}/>`;
  const star = (cx, cy, R, r, n = 5, rot = -90) => { let d = ''; for (let k = 0; k < n * 2; k++) { const a = ((rot + (k * 180) / n) * Math.PI) / 180, rr = k % 2 ? r : R; d += (k ? 'L' : 'M') + f1(cx + Math.cos(a) * rr) + ' ' + f1(cy + Math.sin(a) * rr); } return d + 'Z'; };
  /** a crescent facing left, outer radius R at (cx, cy) */
  const moon = (cx, cy, R) => { const x = 0.61 * R, y = 0.792 * R; return `M${f1(cx + x)} ${f1(cy - y)}A${f1(R)} ${f1(R)} 0 1 0 ${f1(cx + x)} ${f1(cy + y)}A${f1(R * 0.8)} ${f1(R * 0.8)} 0 1 1 ${f1(cx + x)} ${f1(cy - y)}Z`; };
  const OL = '#2a1838';                                   // the one outline colour every hat shares, so a hat looks like it belongs to the bomb
  const ol = (w) => `stroke='${OL}' stroke-opacity='.85' stroke-width='${w || 1.1}' stroke-linejoin='round' stroke-linecap='round'`;
  const hl = (d, w, op) => `<path d='${d}' fill='none' stroke='#fff' stroke-opacity='${op == null ? 0.55 : op}' stroke-width='${w || 1.2}' stroke-linecap='round'/>`;

  /* ------------------------------------------------------------------ the art: each returns { inner, defs } in bomb coordinates */
  const ART = {
    /* Party Hat: a striped paper cone with a confetti pom-pom and a fringe of tiny pom-poms along the rim */
    h_party: () => {
      const cone = 'M18.4 16.4L36 -15L45.6 16.4Q32 21.8 18.4 16.4Z';
      let fringe = '';
      for (let i = 0; i < 6; i++) { const t = i / 5, x = 19.6 + t * 24.8, y = 17.1 + Math.sin(t * Math.PI) * 1.9; fringe += dot(x, y + 0.6, 1.9, i % 2 ? '#ffd23f' : '#3fd9ff') + dot(x - 0.5, y, 0.6, '#fff', 0.8); }
      return {
        inner: `<clipPath id='c'><path d='${cone}'/></clipPath><path d='${cone}' fill='url(#p)'/><g clip-path='url(#c)'>` +
          `<path d='M10 9L50 -1L50 4.4L10 14.4Z' fill='#ffd23f'/><path d='M10 -3L50 -13L50 -8.4L10 1.6Z' fill='#3fd9ff'/><path d='M10 19L50 9L50 13L10 23Z' fill='#7a5cff'/>` +
          [[27, 12, 1.1], [38, 4, 1], [31, 5, 0.9], [39.5, 13, 0.9], [34, -8, 0.9], [29.5, 20, 0.8]].map(([x, y, r]) => dot(x, y, r, '#fff', 0.9)).join('') +
          `<path d='M24 12L33 -9' stroke='#fff' stroke-opacity='.4' stroke-width='1.6' stroke-linecap='round'/></g>` +
          `<path d='${cone}' fill='none' ${ol(1.2)}/>` + fringe +
          `<path d='M36 -15C41 -20 47 -19 48.4 -14.4M36 -15C32 -21 26 -20 24.6 -15.4M36 -15C40 -12.4 44 -12.4 46 -8.4' fill='none' stroke='#ffd23f' stroke-width='1.7' stroke-linecap='round'/>` +
          `<circle cx='36' cy='-16.4' r='4.4' fill='url(#q)' ${ol(1)}/>${dot(34.6, -18, 1.3, '#fff', 0.85)}`,
        defs: lg('p', [[0, '#ff7ac0'], [1, '#e8307f']], 0, 0, 1, 1) + rg('q', [[0, '#fff0f8'], [0.5, '#ff7ac0'], [1, '#d02a78']]),
      };
    },

    /* Top Hat: black silk with a red band and a gold buckle */
    h_top: () => ({
      inner:
        `<ellipse cx='32' cy='15.2' rx='23.4' ry='4.2' fill='#14141f' ${ol(1.1)}/><path d='M10.6 14.6C14 17.8 50 17.8 53.4 14.6' fill='none' stroke='#fff' stroke-opacity='.12' stroke-width='1.2'/>` +
        `<path d='M21 15.2V-7.4C21 -10 43 -10 43 -7.4V15.2C37 18 27 18 21 15.2Z' fill='url(#b)' ${ol(1.2)}/>` +
        `<ellipse cx='32' cy='-7.6' rx='11' ry='3.2' fill='url(#t)' ${ol(1)}/>` +
        `<path d='M21 8.2C27 11 37 11 43 8.2V13.8C37 16.8 27 16.8 21 13.8Z' fill='url(#r)' stroke='#7a0f22' stroke-opacity='.7' stroke-width='.9'/>` +
        `<rect x='28.4' y='9.6' width='7.2' height='5.6' rx='1.2' fill='none' stroke='#ffd24a' stroke-width='1.6'/><rect x='29' y='10.2' width='6' height='4.4' rx='.8' fill='none' stroke='#fff6c0' stroke-opacity='.6' stroke-width='.6'/>` +
        `<path d='M24.4 -5V12.4' stroke='#fff' stroke-opacity='.28' stroke-width='2' stroke-linecap='round'/><path d='M39.6 -5V11.6' stroke='#000' stroke-opacity='.25' stroke-width='2.4' stroke-linecap='round'/>`,
      defs: lg('b', [[0, '#3a3a52'], [0.35, '#1e1e2c'], [1, '#0e0e18']], 0, 0, 1, 0) + lg('t', [[0, '#5a5a78'], [1, '#2a2a3c']]) + lg('r', [[0, '#e8405a'], [1, '#a81830']]),
    }),

    /* Pom Beanie: a knitted cap with a ribbed cuff and a big fluffy pom-pom */
    h_pom: () => {
      let fluff = '', rib = '', knit = '';
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; fluff += dot(32 + Math.cos(a) * 5.6, -6 + Math.sin(a) * 5.6, 2.6, i % 2 ? '#f1ecff' : '#ffffff'); }
      for (let x = 18.6; x < 47; x += 2.7) rib += `<path d='M${f1(x)} 11.4V17.6' stroke='#c9a67a' stroke-opacity='.5' stroke-width='.8'/>`;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const x = 21 + c * 4.4 + (r % 2) * 2.2, y = 2.2 + r * 2.7; knit += `<path d='M${f1(x - 1.5)} ${f1(y)}L${f1(x)} ${f1(y + 1.5)}L${f1(x + 1.5)} ${f1(y)}' fill='none' stroke='#ffd1c8' stroke-opacity='.55' stroke-width='.8' stroke-linecap='round'/>`; }
      return {
        inner:
          `<path d='M16.8 15.4C15.4 4 23.4 -2.6 32 -2.6C40.6 -2.6 48.6 4 47.2 15.4Z' fill='url(#d)' ${ol(1.2)}/>` + knit +
          `<path d='M17.6 8.8C27 6 37 6 46.4 8.8' fill='none' stroke='#fff1d6' stroke-opacity='.8' stroke-width='1.4'/>` +
          `<path d='M15.4 11.4C26 9 38 9 48.6 11.4V17.8C38 20 26 20 15.4 17.8Z' fill='url(#cf)' ${ol(1.1)}/>` + rib +
          fluff + `<circle cx='32' cy='-6' r='6' fill='url(#pp)'/>` + hl('M27 -8.4C28 -10.6 30.6 -11.6 33 -11', 1.4, 0.8),
        defs: lg('d', [[0, '#ff8a7a'], [1, '#e04a5a']]) + lg('cf', [[0, '#fff6e2'], [1, '#e8d2a8']]) + rg('pp', [[0, '#ffffff'], [1, '#e4dcff']]),
      };
    },

    /* Propeller Cap: four colour panels, a short peak and a propeller on top (the blades are a part of their own so they can spin in Rush) */
    h_propeller: (live) => ({
      inner:
        `<clipPath id='c'><path d='M16.8 15.6C15.4 4.4 22.6 -0.6 32 -0.6C41.4 -0.6 48.6 4.4 47.2 15.6Z'/></clipPath>` +
        `<g clip-path='url(#c)'><rect x='10' y='-4' width='14.6' height='22' fill='#ff4d5e'/><rect x='24.6' y='-4' width='7.4' height='22' fill='#ffd23f'/><rect x='32' y='-4' width='7.4' height='22' fill='#3d8bff'/><rect x='39.4' y='-4' width='12' height='22' fill='#2fd07a'/>` +
        `<path d='M10 -4V18H52V-4Z' fill='url(#sh)'/></g>` +
        `<path d='M32 -0.6C26 4 24.4 10 24.4 15.8M32 -0.6V15.8M32 -0.6C38 4 39.6 10 39.6 15.8' fill='none' stroke='#fff' stroke-opacity='.55' stroke-width='.9'/>` +
        `<path d='M16.8 15.6C15.4 4.4 22.6 -0.6 32 -0.6C41.4 -0.6 48.6 4.4 47.2 15.6Z' fill='none' ${ol(1.2)}/>` +
        `<path d='M15.6 15Q32 22.6 48.4 15Q47.6 18.6 32 19.8Q16.4 18.6 15.6 15Z' fill='url(#pk)' ${ol(1.1)}/>` +
        `<circle cx='32' cy='-0.4' r='1.9' fill='#ffd24a' ${ol(0.9)}/><path d='M32 -1.5V-5' stroke='#c8a030' stroke-width='1.6' stroke-linecap='round'/><circle cx='32' cy='-6.2' r='2.3' fill='#ffd24a' ${ol(0.9)}/>${dot(31.3, -6.9, 0.7, '#fff', 0.9)}` +
        (live ? '' : BLADES.inner),
      defs: lg('sh', [[0, '#fff', 0.38], [0.5, '#fff', 0], [1, '#000', 0.25]]) + lg('pk', [[0, '#2f66d8'], [1, '#1a3a9a']]) + (live ? '' : BLADES.defs),
    }),

    /* Flower Crown: a wreath that hugs the top of the head: daisies, blossoms and leaves */
    h_flower: () => {
      const at = (deg, r) => [32 + Math.cos((deg * Math.PI) / 180) * r, 36 + Math.sin((deg * Math.PI) / 180) * r];
      let s = '';
      s += `<path d='${[[-124, 25.4], [-112, 25.8], [-100, 26], [-90, 26.2], [-80, 26], [-68, 25.8], [-56, 25.4]].map(([a, r], i) => { const [x, y] = at(a, r); return (i ? 'L' : 'M') + f1(x) + ' ' + f1(y); }).join('')}' fill='none' stroke='#2f7a3a' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/>`;
      s += `<path d='${[[-124, 25.4], [-112, 25.8], [-100, 26], [-90, 26.2], [-80, 26], [-68, 25.8], [-56, 25.4]].map(([a, r], i) => { const [x, y] = at(a, r); return (i ? 'L' : 'M') + f1(x) + ' ' + f1(y); }).join('')}' fill='none' stroke='#4fc25a' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/>`;
      [[-118, 1], [-104, -1], [-94, 1], [-84, -1], [-74, 1], [-62, -1]].forEach(([a, sd], i) => { const [x, y] = at(a, 27.4); s += `<path d='M0 0C-1.6 -3.4 1.4 -6 4.6 -5.2C4.8 -2.2 2.8 0.4 0 0Z' fill='#5fd86a' stroke='#1f5a2a' stroke-width='.7' transform='translate(${f1(x)} ${f1(y)}) rotate(${f1(a + 90 + (sd > 0 ? 40 : -40))}) scale(${sd > 0 ? 1 : -1} 1)'/>`; });
      const daisy = (x, y, r) => { let p = ''; for (let i = 0; i < 8; i++) { p += `<ellipse cx='0' cy='${f1(-r * 0.62)}' rx='${f1(r * 0.3)}' ry='${f1(r * 0.52)}' fill='#fff' stroke='#c8d0e8' stroke-width='.5' transform='rotate(${i * 45})'/>`; } return `<g transform='translate(${f1(x)} ${f1(y)})'>${p}<circle r='${f1(r * 0.34)}' fill='#ffcf3f' stroke='#c8901a' stroke-width='.6'/></g>`; };
      const blossom = (x, y, r, c1, c2) => { let p = ''; for (let i = 0; i < 5; i++) { p += `<circle cx='0' cy='${f1(-r * 0.58)}' r='${f1(r * 0.46)}' fill='${c1}' stroke='${c2}' stroke-width='.6' transform='rotate(${i * 72})'/>`; } return `<g transform='translate(${f1(x)} ${f1(y)})'>${p}<circle r='${f1(r * 0.3)}' fill='#fff3b0' stroke='#e0a030' stroke-width='.5'/></g>`; };
      [[-120, 3.1, 'b', '#ff9ad0', '#c8387a'], [-108, 4.2, 'd'], [-96, 3.3, 'b', '#8fb8ff', '#3a64c8'], [-86, 4.6, 'b', '#ff7ab8', '#c02a78'], [-75, 3.6, 'd'], [-64, 3.2, 'b', '#ffd26a', '#c8841a'], [-55, 2.6, 'b', '#ff9ad0', '#c8387a']].forEach(([a, r, t, c1, c2]) => { const [x, y] = at(a, 26.4); s += t === 'd' ? daisy(x, y, r) : blossom(x, y, r, c1, c2); });
      return { inner: s, defs: '' };
    },

    /* Chef's Toque: a pleated band and a tall puffed top */
    h_toque: () => {
      let pl = '';
      [[24.6, 8, 23.6], [28, 8, 26.6], [32, 8, 32], [36, 8, 37.4], [39.4, 8, 40.6]].forEach(([x, , tx]) => { pl += `<path d='M${f1(x)} 10.4C${f1(tx - 2)} 4 ${f1(tx + 2)} -2 ${f1(tx)} -6.6' fill='none' stroke='#b8c4da' stroke-opacity='.65' stroke-width='.9' stroke-linecap='round'/>`; });
      return {
        inner:
          `<path d='M20.6 10.4C12.6 9.4 10.6 0.6 17.4 -3.6C18.4 -11 27.4 -13.4 32 -9.2C36.6 -13.4 45.6 -11 46.6 -3.6C53.4 0.6 51.4 9.4 43.4 10.4Z' fill='url(#w)' ${ol(1.2)}/>` + pl +
          `<path d='M17 4C20 6.6 24 7.6 27 7' fill='none' stroke='#b8c4da' stroke-opacity='.5' stroke-width='1.2' stroke-linecap='round'/>` + hl('M20 -4.4C21.6 -8 25.6 -9.8 29 -9', 1.6, 0.9) +
          `<path d='M21 9.6H43V16.6Q32 19.8 21 16.6Z' fill='url(#bd)' ${ol(1.1)}/><path d='M25.4 10.6V17.6M29.2 10.6V18.4M33 10.6V18.8M36.8 10.6V18.4M40.6 10.6V17.6' stroke='#b8c4da' stroke-opacity='.8' stroke-width='.8'/>`,
        defs: lg('w', [[0, '#ffffff'], [1, '#dde6f4']]) + lg('bd', [[0, '#ffffff'], [1, '#cfd9ea']]),
      };
    },

    /* Wizard Hat: the season hat. A tall midnight cone with gold stars; the tip is a part of its own and flops when Fizz panics */
    h_wizard: (live) => ({
      inner:
        `<path d='M5 15.8C8 9.4 56 9.4 59 15.8C54 22.2 10 22.2 5 15.8Z' fill='url(#br)' ${ol(1.2)}/><path d='M8.4 16.6C16 21 48 21 55.6 16.6' fill='none' stroke='#8f9bff' stroke-opacity='.5' stroke-width='1' stroke-linecap='round'/>` +
        `<path d='M19.4 14C21 6 24.6 -1.4 28 -8L37.8 -8C41 -1.4 43.8 6 45.4 14C37 17.6 28 17.6 19.4 14Z' fill='url(#cn)' ${ol(1.2)}/>` +
        `<path d='M18.8 11.2C27 14.4 38 14.4 46 11.2V15.2C38 18.8 27 18.8 18.8 15.2Z' fill='url(#gd)' ${ol(1)}/>` +
        `<rect x='28.6' y='12.2' width='6.8' height='5.4' rx='1.3' fill='none' stroke='#fff3b0' stroke-width='1.4'/><rect x='29.4' y='13' width='5.2' height='3.8' rx='.6' fill='#7a4a08' fill-opacity='.5'/>` +
        `<path d='${star(29.5, 6.4, 3.2, 1.3)}' fill='#ffe08a' ${ol(0.5)}/><path d='${star(36.6, -0.8, 2.4, 1)}' fill='#ffe08a' ${ol(0.5)}/><path d='${star(35.4, 8.8, 1.7, 0.7)}' fill='#fff3b0'/><path d='${moon(24.6, 9.2, 2.5)}' fill='#ffd24a'/>${dot(31, -4.2, 0.6, '#fff', 0.9)}${dot(40.4, 5.6, 0.6, '#fff', 0.9)}${dot(28, 0.4, 0.5, '#fff', 0.9)}` +
        `<path d='M22.4 6.4C24.2 1.6 26.4 -2.8 28.6 -6.4' fill='none' stroke='#fff' stroke-opacity='.3' stroke-width='1.6' stroke-linecap='round'/>` +
        (live ? '' : TIP.inner),
      defs: lg('br', [[0, '#3a40b0'], [1, '#161870']]) + lg('cn', [[0, '#4a52d0'], [0.5, '#262c9a'], [1, '#12156a']], 0, 0, 1, 0) + lg('gd', [[0, '#fff0a0'], [0.5, '#f0b030'], [1, '#a8680a']]) + (live ? '' : TIP.defs),
    }),

    /* Night Cap: a soft cap that flops to one side, with a fluffy trim and a pom-pom, patterned with stars and a moon */
    h_nightcap: () => {
      let fluff = '', pom = '';
      for (let i = 0; i < 7; i++) { const t = i / 6, x = 16.4 + t * 31.6, y = 14.8 + Math.sin(t * Math.PI) * 2.6; fluff += dot(x, y, 2.9, i % 2 ? '#fff9ec' : '#ffffff'); }
      for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.283; pom += dot(57.8 + Math.cos(a) * 3, 21.6 + Math.sin(a) * 3, 2, i % 2 ? '#f4f0ff' : '#ffffff'); }
      return {
        inner:
          `<path d='M16.6 14.6C14.6 2 24 -8 35 -7C46 -6 53.6 3.4 58.4 17.8L53.4 20.6C49.4 11.4 44.6 5.4 42 8C45 10.6 47 12.4 48 15C38 18.6 26 18.6 16.6 14.6Z' fill='url(#nc)' ${ol(1.2)}/>` +
          `<path d='${star(26, 5, 2.6, 1.1)}' fill='#fff3b0'/><path d='${star(36, -1, 2, 0.85)}' fill='#fff3b0'/><path d='${star(48.6, 10, 1.7, 0.7)}' fill='#fff3b0'/><path d='${moon(31.6, 8, 2.8)}' fill='#ffe08a'/>${dot(22.4, 10.4, 0.6, '#fff')}${dot(42.4, 3.4, 0.6, '#fff')}${dot(52.4, 15.6, 0.6, '#fff')}` +
          hl('M21 4C23 -1.6 28 -5.2 33 -5.6', 1.6, 0.35) + fluff + pom + `<circle cx='57.8' cy='21.6' r='4.1' fill='url(#pm)' fill-opacity='.5'/>`,
        defs: lg('nc', [[0, '#5a64d8'], [1, '#262a8a']], 0, 0, 1, 1) + rg('pm', [[0, '#fff'], [1, '#d8d0ff']]),
      };
    },

    /* Tricorn: a pirate's three-cornered hat, gold braid, a red cockade and a white feather */
    h_tricorn: () => ({
      inner:
        `<path d='M3.6 13.6C8 8.4 14 5 20 3.6C24 7.6 40 7.6 44 3.6C50 5 56 8.4 60.4 13.6C54 20.4 40 20.2 32 19.4C24 20.2 10 20.4 3.6 13.6Z' fill='url(#ft)' ${ol(1.2)}/>` +
        `<path d='M19.4 12.4C19 3.2 24 -2.6 32 -2.6C40 -2.6 45 3.2 44.6 12.4C38 14.8 26 14.8 19.4 12.4Z' fill='url(#cr)' ${ol(1.2)}/>` +
        `<path d='M4.6 13.8C14 20.6 24 19.4 32 19C40 19.4 50 20.6 59.4 13.8' fill='none' stroke='#f0c050' stroke-width='1.6' stroke-linecap='round'/><path d='M20 3.8C24 7.6 40 7.6 44 3.8' fill='none' stroke='#f0c050' stroke-width='1.3' stroke-linecap='round'/>` +
        `<path d='M19.8 10.4C26 12.8 38 12.8 44.2 10.4' fill='none' stroke='#f0c050' stroke-width='1.3' stroke-linecap='round'/>` +
        hl('M24.6 2.4C27 -0.6 30 -1.4 33 -1.2', 1.5, 0.35) +
        `<circle cx='15.2' cy='9.4' r='3.6' fill='#d82a3c' ${ol(0.9)}/><circle cx='15.2' cy='9.4' r='1.9' fill='#ff7a88'/>${dot(15.2, 9.4, 0.7, '#ffe08a')}` +
        `<path d='M44 3C50 -8 58.6 -12.6 62 -9.4C60.6 -2 54 3.4 47 5.6Z' fill='url(#fe)' ${ol(1)}/><path d='M46 3.6C51 -3.4 56.4 -7.6 60.6 -9' fill='none' stroke='#c8d0ea' stroke-width='.8'/>`,
      defs: lg('ft', [[0, '#3a3652'], [1, '#1c1a2e']]) + lg('cr', [[0, '#48445f'], [1, '#262338']]) + lg('fe', [[0, '#ffffff'], [1, '#d8def4']]),
    }),

    /* Halo: a golden ring that floats above the head (it does not touch the bomb, so the body keeps its own topper) */
    h_halo: () => ({
      inner:
        `<ellipse cx='32' cy='-4.6' rx='17' ry='6' fill='url(#g)'/>` +
        `<ellipse cx='32' cy='-4.6' rx='12.6' ry='3.8' fill='none' stroke='#8a5a08' stroke-opacity='.7' stroke-width='5.2'/><ellipse cx='32' cy='-4.6' rx='12.6' ry='3.8' fill='none' stroke='url(#r)' stroke-width='3.8'/>` +
        `<path d='M20.4 -6.4C24 -9.4 40 -9.4 43.6 -6.4' fill='none' stroke='#fff' stroke-opacity='.85' stroke-width='1.2' stroke-linecap='round'/>` +
        `<path d='${star(19, -12, 2.6, 0.7, 4)}' fill='#fff'/><path d='${star(46.4, -11.4, 2, 0.6, 4)}' fill='#fff' fill-opacity='.9'/><path d='${star(52, -2, 1.5, 0.5, 4)}' fill='#fff3b0'/>`,
      defs: rg('g', [[0, '#fff3b0', 0.0], [0.55, '#ffd24a', 0.18], [1, '#ffcf3f', 0.34]], 0.5, 0.5, 0.5) + lg('r', [[0, '#fff6c0'], [0.5, '#ffcf3f'], [1, '#e89a14']]),
    }),

    /* Mortarboard: a flat square board on a skull cap, with a gold tassel */
    h_mortar: () => ({
      inner:
        `<path d='M20.6 11.4C20.6 8.6 43.4 8.6 43.4 11.4V16.2C38 19.2 26 19.2 20.6 16.2Z' fill='url(#cp)' ${ol(1.1)}/>` +
        `<path d='M4.4 5.2L32 -5.8L59.6 5.2L32 16.2Z' fill='#0a0a16' fill-opacity='.4' transform='translate(0 2.4)'/><path d='M4.4 5.2L32 16.2L59.6 5.2L59.6 8L32 19L4.4 8Z' fill='#12122a' ${ol(1)}/>` +
        `<path d='M4.4 5.2L32 -5.8L59.6 5.2L32 16.2Z' fill='url(#bd)' ${ol(1.2)}/><path d='M9 5.2L32 -3.6L55 5.2' fill='none' stroke='#fff' stroke-opacity='.25' stroke-width='1.2' stroke-linecap='round'/>` +
        `<circle cx='32' cy='5.2' r='1.9' fill='#ffd24a' ${ol(0.8)}/><path d='M32 5.2C42 5.4 52 6.4 56.6 8.6' fill='none' stroke='#ffd24a' stroke-width='1.5' stroke-linecap='round'/><path d='M32 5.2C42 5.4 52 6.4 56.6 8.6' fill='none' stroke='#8a5a08' stroke-opacity='.5' stroke-width='.5'/>` +
        `<path d='M56.6 8.6V22' stroke='#ffd24a' stroke-width='1.5' stroke-linecap='round'/><path d='M54.4 21.4H58.8L59.6 29.4H53.6Z' fill='url(#ts)' ${ol(0.9)}/><path d='M55.4 22.4V28.6M57.6 22.4V28.6' stroke='#8a5a08' stroke-opacity='.5' stroke-width='.6'/><circle cx='56.6' cy='21.2' r='1.6' fill='#ffd24a' ${ol(0.7)}/>`,
      defs: lg('bd', [[0, '#3a3a58'], [1, '#14142a']], 0, 0, 1, 1) + lg('cp', [[0, '#3a3a58'], [1, '#1a1a30']]) + lg('ts', [[0, '#fff0a0'], [1, '#d89a14']]),
    }),

    /* Crown: a golden crown with five points, pearls and three jewels */
    h_crown: () => ({
      inner:
        `<path d='M18.6 15.6L16 -2.6L24.6 6L28.6 -8.6L32 4.6L35.4 -8.6L39.4 6L48 -2.6L45.4 15.6Q32 20 18.6 15.6Z' fill='#8a1030' ${ol(0.6)}/>` +
        `<path d='M17.4 15.8V8.2H46.6V15.8Q32 19.6 17.4 15.8Z' fill='url(#gd)' ${ol(1.2)}/>` +
        `<path d='M17.4 8.4L14.4 -4.4L23.8 3.2L28.2 -9.2L32 2.2L35.8 -9.2L40.2 3.2L49.6 -4.4L46.6 8.4Q32 12.2 17.4 8.4Z' fill='url(#gd)' ${ol(1.2)}/>` +
        `<path d='M19 9.6L16.6 0.4M26 5L28.2 -5.6M38 5L35.8 -5.6M45 9.6L47.4 0.4' stroke='#fff' stroke-opacity='.5' stroke-width='1.2' stroke-linecap='round'/>` +
        [[14.4, -4.4], [28.2, -9.2], [35.8, -9.2], [49.6, -4.4], [32, 2.2]].map(([x, y]) => `<circle cx='${x}' cy='${y - 1}' r='2' fill='url(#pe)' ${ol(0.6)}/>`).join('') +
        `<ellipse cx='32' cy='13.2' rx='3.2' ry='3' fill='#e8203c' ${ol(0.8)}/>${dot(31, 12.2, 0.9, '#fff', 0.85)}<ellipse cx='23.4' cy='12.6' rx='2' ry='1.9' fill='#3a8cff' ${ol(0.7)}/><ellipse cx='40.6' cy='12.6' rx='2' ry='1.9' fill='#2fd07a' ${ol(0.7)}/>${dot(22.8, 12, 0.6, '#fff', 0.85)}${dot(40, 12, 0.6, '#fff', 0.85)}` +
        `<path d='M19 9.4C27 11.4 37 11.4 45 9.4' fill='none' stroke='#fff6c0' stroke-opacity='.7' stroke-width='.9' stroke-linecap='round'/>`,
      defs: lg('gd', [[0, '#fff0a0'], [0.45, '#f0b030'], [1, '#a8680a']]) + rg('pe', [[0, '#ffffff'], [1, '#d8def0']]),
    }),
  };

  /* the parts that move on their own (drawn in their own boxes: box = [x, y, w, h] in bomb coordinates, origin = the pivot inside it) */
  var BLADES = {
    box: [8, -13, 48, 14], origin: [24, -6.2 + 13],
    inner: `<path d='M31 -6.4C24 -11.6 15 -11 10 -7.4C16 -4.2 25 -3.6 31 -6Z' fill='#ff4d5e' ${ol(0.9)}/><path d='M33 -6.4C40 -11.6 49 -11 54 -7.4C48 -4.2 39 -3.6 33 -6Z' fill='#3d8bff' ${ol(0.9)}/><path d='M13 -8.8C18 -10.4 24 -9.8 28.4 -8M51 -8.8C46 -10.4 40 -9.8 35.6 -8' fill='none' stroke='#fff' stroke-opacity='.55' stroke-width='.9' stroke-linecap='round'/>`,
    defs: '',
  };
  var TIP = {
    box: [26, -27, 26, 20], origin: [7, 19],
    inner: `<path d='M28 -8L37.8 -8C40 -12.4 43 -17.6 49.8 -23.2C41.8 -23.2 32.4 -17 28 -8Z' fill='url(#cn)' ${ol(1.2)}/><path d='${star(40.4, -15, 1.9, 0.8)}' fill='#fff3b0'/><path d='M30.6 -9C33.4 -13.6 37.6 -17.4 42.4 -19.4' fill='none' stroke='#fff' stroke-opacity='.3' stroke-width='1.2' stroke-linecap='round'/>`,
    defs: '',
  };
  // the wizard's tip needs the cone gradient too
  TIP.defs = lg('cn', [[0, '#4a52d0'], [0.5, '#262c9a'], [1, '#12156a']], 0, 0, 1, 0);
  const PARTS = { h_propeller: [Object.assign({ name: 'blades' }, BLADES)], h_wizard: [Object.assign({ name: 'tip' }, TIP)] };

  /* ------------------------------------------------------------------ the data */
  const H = (id, name, rarity, desc, earn, extra) => Object.assign({ id, name, rarity, desc, earn, noTop: true, type: 'hat' }, extra);
  BR.HATS = [
    H('h_party', 'Party Hat', 'common', 'A striped paper cone with a confetti pom-pom.', 'Free with Update 5', { lip: [18.4, 45.6, 18.9] }),
    H('h_top', 'Top Hat', 'rare', 'Black silk, a red band and a golden buckle.', 'Season 4 Pass, tier 3', { lip: [8.6, 55.4, 19.4] }),
    H('h_pom', 'Pom Beanie', 'common', 'A knitted cap with a big, fluffy pom-pom.', 'Season 4 Pass, tier 8', { lip: [15.4, 48.6, 19.4] }),
    H('h_propeller', 'Propeller Cap', 'rare', 'Four bright panels and a propeller that spins in Rush Mode.', 'Season 4 Pass, tier 13', { lip: [15.6, 48.4, 19.8] }),
    H('h_flower', 'Flower Crown', 'rare', 'Daisies and blossoms woven round the head.', 'Season 4 Pass, tier 18', { lip: [17, 47, 19] }),
    H('h_toque', "Chef's Toque", 'common', 'A tall, pleated chef\'s hat. Fizz is cooking.', 'Season 4 Pass, tier 23', { lip: [21, 43, 18.8] }),
    H('h_wizard', 'Wizard Hat', 'epic', 'The season hat: a tall midnight cone with gold stars. The tip flops when Fizz panics.', 'Season 4 Pass, tier 27', { lip: [8, 56, 20.2] }),
    H('h_nightcap', 'Night Cap', 'common', 'A soft cap with a pom-pom for sleepy bombs.', 'The first full 7-day streak week', { lip: [16.6, 48, 18.8] }),
    H('h_tricorn', 'Tricorn', 'rare', 'A pirate captain\'s three-cornered hat.', 'The second full 7-day streak week', { lip: [5, 59, 19.6] }),
    H('h_halo', 'Halo', 'epic', 'A golden ring that floats above the head.', 'Save 25 runs with Last Spark', { noTop: false, lip: [15, 49, -0.2] }),
    H('h_mortar', 'Mortarboard', 'epic', 'A graduate\'s cap with a golden tassel.', 'Complete any Moonwick set', { lip: [20.6, 43.4, 18.4] }),
    H('h_crown', 'Crown', 'legendary', 'A golden crown with pearls and three jewels.', 'Own 75 items', { lip: [17.4, 46.6, 18.6] }),
  ];
  BR.HATS.forEach((h) => { if (PARTS[h.id]) h.parts = PARTS[h.id]; });

  /* ------------------------------------------------------------------ anchors: where each body's head is, as { x, y, s } (a move and a scale about (32, 16)) */
  const KIND_OF = { classic: 'ball', rope: 'ball', wire: 'ball', neon: 'ball', ice: 'ball', plasma: 'ball', candy: 'ball', vine: 'ball', rod: 'ball', phoenix: 'egg', dragon: 'dragon', hourglass: 'hourglass', wax: 'wax', robe: 'robe', flask: 'flask', golem: 'golem', moon: 'moon' };
  const ANCHOR = {
    ball: { x: 0, y: 0, s: 1 },
    egg: { x: 0, y: -1.6, s: 0.96 },
    dragon: { x: 0, y: -1, s: 0.94 },
    hourglass: { x: 0, y: -15.4, s: 0.84 },
    wax: { x: 0, y: 0.6, s: 1 },
    robe: { x: 0, y: 0, s: 1 },
    flask: { x: 0, y: -9.4, s: 0.54 },
    golem: { x: 0, y: 0.4, s: 1 },
    moon: { x: 0, y: 0, s: 1 },
  };
  /** a hat that floats (the halo) rides above the body's own topper instead of sitting on the head */
  const FLOAT = { halo: { ball: { x: 0, y: -2, s: 1 }, egg: { x: 0, y: -2.6, s: 0.96 }, dragon: { x: 0, y: -4, s: 0.94 }, hourglass: { x: 0, y: -4.4, s: 0.84 }, wax: { x: 0, y: -1.6, s: 1 }, robe: { x: 0, y: -4.4, s: 1 }, flask: { x: 0, y: -3, s: 0.6 }, golem: { x: 0, y: -1.6, s: 1 }, moon: { x: 0, y: 8, s: 1 } } };
  const byId = {};
  BR.HATS.forEach((h) => { byId[h.id] = h; });
  const kindOf = (k) => KIND_OF[k] || (ANCHOR[k] ? k : 'ball');

  /* ------------------------------------------------------------------ API */
  const Hats = (BR.Hats = {
    list: BR.HATS,
    byId: (id) => byId[id],
    kindOf,
    anchor(id, kind) {
      const k = kindOf(kind), h = byId[id];
      const a = (h && !h.noTop && FLOAT[h.id.slice(2)] && FLOAT[h.id.slice(2)][k]) || ANCHOR[k];
      return { x: a.x, y: a.y, s: a.s };
    },
    /** the hat as a standalone SVG string. o.live: without its moving parts. o.part: the n-th part alone (in its own box) */
    svg(id, o = {}) {
      const h = byId[id];
      if (!h) return '';
      if (o.part != null) { const p = h.parts && h.parts[o.part]; return p ? svg(p.inner, p.defs, p.box.join(' ')) : ''; }
      const a = ART[id](!!o.live);
      return svg(a.inner, a.defs);
    },
    /** the data of the n-th part (box and pivot), for the CSS that places it */
    part: (id, n) => { const h = byId[id]; return h && h.parts && h.parts[n]; },
    /** the box every hat picture is drawn in, for code that lays one out itself */
    box: { x: -16, y: -40, w: 96, h: 80, baseY: 16 },
  });
  if (typeof document === 'undefined') return;

  /* ------------------------------------------------------------------ browser: bake the pictures lazily, make the elements */
  const done = {};
  /** one rule per hat, on first use: --hat-img (the whole hat, for previews and badges), --hat-live (without moving parts) and --hat-pN (the parts) */
  Hats.ensure = (id) => {
    const h = byId[id];
    if (!h || done[id]) return;
    done[id] = 1;
    let sheet = document.getElementById('hatSheet');
    if (!sheet) { sheet = document.createElement('style'); sheet.id = 'hatSheet'; document.head.appendChild(sheet); }
    const vars = [`--hat-img:${uri(Hats.svg(id))}`];
    if (h.parts) { vars.push(`--hat-live:${uri(Hats.svg(id, { live: true }))}`); h.parts.forEach((p, i) => vars.push(`--hat-p${i + 1}:${uri(Hats.svg(id, { part: i }))}`)); }
    sheet.appendChild(document.createTextNode(`[data-hat="${id}"]{${vars.join(';')}}\n`));
  };
  const pct = (v, o, t) => f1(((v - o) / t) * 100) + '%';
  Hats.html = (id, bodyKind) => {
    const h = byId[id];
    if (!h) return '';
    Hats.ensure(id);
    const a = Hats.anchor(id, bodyKind), B = Hats.box;
    const parts = (h.parts || []).map((p, i) => `<b class="hp" data-part="${p.name}" style="left:${pct(p.box[0], B.x, B.w)};top:${pct(p.box[1], B.y, B.h)};width:${f1((p.box[2] / B.w) * 100)}%;height:${f1((p.box[3] / B.h) * 100)}%;transform-origin:${f1((p.origin[0] / p.box[2]) * 100)}% ${f1((p.origin[1] / p.box[3]) * 100)}%;--hat-pn:var(--hat-p${i + 1})"></b>`).join('');
    return `<i class="fz-hat" data-hat="${id}" aria-hidden="true" style="--hx:${a.x};--hy:${a.y};--hs:${a.s}">${parts}</i>`;
  };
  /** attributes that dress a .mini-fuse preview with a hat (the body without its topper too); cls = the fuse's class */
  Hats.miniAttrs = (id, cls) => {
    const h = byId[id];
    if (!h) return '';
    Hats.ensure(id);
    if (BR.FuseArt && BR.FuseArt.ensure && cls && h.noTop) BR.FuseArt.ensure(cls, ['nt']);
    const tok = BR.FuseArt && BR.FuseArt.tokensFor && BR.FuseArt.tokensFor(cls || 'fuse-classic'), kind = tok ? tok.bomb.kind : 'classic', a = Hats.anchor(id, kind);
    return ` data-hat="${id}"${h.noTop ? ' data-nt' : ''} style="--hx:${a.x};--hy:${a.y};--hs:${a.s}"`;
  };
  /** the item badge of a hat: a plain Fizz wearing it, on the rarity plate (BR.Badge.custom draws the art; the frame is BR.Badge's) */
  Hats.badge = (id, size, o = {}) => {
    const h = byId[id];
    if (!h || !BR.Badge) return '';
    return BR.Badge.html(h, o.inst || null, Object.assign({ size: size || 72 }, o));
  };
  const registerBadges = () => {
    if (!BR.Badge || !BR.Badge.custom) return;
    BR.HATS.forEach((h) => {
      BR.Badge.custom[h.id] = (item, inst, still) => {
        Hats.ensure(h.id);
        if (BR.FuseArt && BR.FuseArt.ensure) BR.FuseArt.ensure('fuse-classic', ['mini', 'nt']);
        const a = Hats.anchor(h.id, 'classic');
        return `<div class="bdg-hat" data-hat="${h.id}"${h.noTop ? ' data-nt' : ''} style="--hx:${a.x};--hy:${a.y};--hs:${a.s}"><span class="hb-glow"></span><span class="hb-fizz"><i class="hb-hat"></i></span></div>`;
      };
    });
  };
  // js/badges.js (loaded after this file) creates BR.Badge, so the hats register their badge art once the page has loaded
  if (BR.Badge) registerBadges(); else window.addEventListener('DOMContentLoaded', registerBadges);
})();
