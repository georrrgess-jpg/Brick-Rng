/* Series 4 "Moonwick" skins: per-colour baked art and skin moments. Registers through BR.Skins.handlers / applyHooks and BR.Badge.custom.
   The nine skins: Patchwork, Glowcap, Spellbook, Origami (static looks, CSS and baked sigils), Potion, Gemcut, Hourglass, Sigil, Moonglass
   (moments). Every picture that has to carry a brick's colour (sigils, bottles, gem cuts) is baked ONCE per palette colour, on the first
   use of its item (equipping it, drawing its badge, its demo), never at boot. Every moment is short, draws on the particle canvas (fx.sprite,
   fx.link, FX.bake) or on at most three throw-away DOM sprites, moves only transform and opacity, and does nothing on a low-end phone or
   with Reduce Motion. */
(function () {
  const BR = (window.BR = window.BR || {});
  const Skins = BR.Skins;
  if (!Skins || !Skins.handlers) return;

  /* ------------------------------------------------------------------ small helpers */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const f1 = (n) => +n.toFixed(1);
  const f2 = (n) => +n.toFixed(2);
  const still = () => !!(BR.reducedMotion || BR.lowEnd);   // no idle animation, no moments
  const sound = (name, ...a) => { if (BR.audio && typeof BR.audio[name] === 'function') { try { BR.audio[name](...a); } catch (e) { /* sound is optional */ } } };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const toHex = (v) => '#' + v.map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
  /** mix(a, b, t): t of a, 1 - t of b. */
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v * t + y[i] * (1 - t))); };
  const svgUri = (svg) => 'url("data:image/svg+xml,' + svg.replace(/%/g, '%25').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23') + '")';

  /* ------------------------------------------------------------------ the Seven Sigils
     Outlines in a 100 x 100 box: exactly the outlines of the Shape hints in css/run.css (a circle, a diamond, a triangle, a rounded square,
     a hexagon, a five-point star, a cross), each with the cut-out of its inner mark (fill-rule evenodd). Ruby = circle (Sun), Sapphire =
     diamond (Tide), Emerald = triangle (Grove), Topaz = square (Gate), Amethyst = hexagon (Crystal), Amber = star (Star), Aqua = cross (Wind). */
  const SIG = [
    { o: 'M50 0A50 50 0 1 1 49.99 0Z', i: 'M50 28A22 22 0 1 0 50.01 28Z', s: 1 },
    { o: 'M50 0L100 50L50 100L0 50Z', i: 'M50 26L74 50L50 74L26 50Z', s: 1 },
    { o: 'M50 6L100 94L0 94Z', i: 'M50 46L68 80H32Z', s: 1 },
    { o: 'M14 0H86Q100 0 100 14V86Q100 100 86 100H14Q0 100 0 86V14Q0 0 14 0Z', i: 'M30 30V70H70V30Z', s: 0.9 },
    { o: 'M25 4H75L100 50L75 96H25L0 50Z', i: 'M38 30H62L76 50L62 70H38L24 50Z', s: 1 },
    { o: 'M50 0L61 35L98 35L68 57L79 91L50 70L21 91L32 57L2 35L39 35Z', i: 'M50 40A9 9 0 1 0 50.01 40Z', s: 1.2 },
    { o: 'M34 0H66V34H100V66H66V100H34V66H0V34H34Z', i: 'M42 42H58V58H42Z', s: 1 },
  ];
  /** The sigil of colour c as one path (outline plus the cut-out of the inner mark), inside a 100 x 100 box. */
  const sigPath = (c, inner = true) => SIG[c].o + (inner ? SIG[c].i : '');
  /** The sigil moved and scaled: a transform string for a `<g>` around the 100 x 100 box. */
  const place = (cx, cy, size) => `translate(${f1(cx - size / 2)} ${f1(cy - size / 2)}) scale(${f2(size / 100)})`;

  /* ------------------------------------------------------------------ lazy baking
     Each baker returns the CSS for one palette colour. ensure(key) bakes a skin's art into one <style> the first time that skin is used. */
  const BAKERS = {};
  const baked = {};
  const ensure = (key) => {
    if (baked[key] || !BAKERS[key] || !document.head || !BR.PALETTE) return;
    baked[key] = true;
    const el = document.createElement('style');
    el.id = 's4-art-' + key;
    el.textContent = BR.PALETTE.map((p, i) => BAKERS[key](p, i)).join('\n');
    document.head.appendChild(el);
  };
  const keyOf = (cls) => (cls && /^skin-/.test(cls) ? cls.slice(5) : '');
  const SKIN_KEYS = ['patchwork', 'glowcap', 'spellbook', 'origami', 'potion', 'gemcut', 'hourglass', 'sigil', 'moonglass'];
  const isMine = (cls) => SKIN_KEYS.includes(keyOf(cls));

  /** Visual extent of each sigil inside its 100 x 100 box, so the seven weigh about the same on a brick. */
  const EXT = [0.9, 0.96, 0.92, 0.78, 0.92, 1, 0.9];
  const norm = (c, inner) => `<g transform='translate(50 50) scale(${EXT[c]}) translate(-50 -50)'>${inner}</g>`;
  /** A rule for colour i that holds on a plain board only: with Shape hints on, .stud is the white hint shape of css/run.css. */
  const studRule = (skin, i, css) => `:root:not(.shapes) .skin-${skin} .brick[data-c="${i}"]:not(.fusebrick) .stud{${css}}`;

  /* ------------------------------------------------------------------ Patchwork: the sigil embroidered in satin stitch */
  BAKERS.patchwork = (p, i) => {
    const d = sigPath(i), shade = mix(p.lo, '#12040a', 0.4);
    let lines = '';
    for (let y = -30; y < 134; y += 3.5) lines += `M-30 ${y}H130`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-8 -8 116 116'><defs><clipPath id='k'><path d='${d}' clip-rule='evenodd' transform='translate(50 50) scale(${EXT[i]}) translate(-50 -50)'/></clipPath></defs>`
      + `<g transform='translate(1.2 2.6)' opacity='.6'>${norm(i, `<path d='${d}' fill-rule='evenodd' fill='${shade}'/>`)}</g>`
      + `<g clip-path='url(#k)'><rect x='-8' y='-8' width='116' height='116' fill='#e3cd98'/><g transform='rotate(-38 50 50)'><path d='${lines}' stroke='#fff6dc' stroke-width='2.3' stroke-linecap='round'/></g></g>`
      + norm(i, `<path d='${SIG[i].o}' fill='none' stroke='#b49a62' stroke-width='2.4' stroke-linejoin='round'/>`)
      + `</svg>`;
    return studRule('patchwork', i, `background-image:${svgUri(svg)};background-size:100% 100%;background-repeat:no-repeat`);
  };

  /* ------------------------------------------------------------------ Spellbook: the sigil pressed in gold foil */
  BAKERS.spellbook = (p, i) => {
    const d = sigPath(i);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-8 -8 116 116'><defs>`
      + `<linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fffbd0'/><stop offset='.32' stop-color='#f2cd62'/><stop offset='.62' stop-color='#d9a233'/><stop offset='1' stop-color='#8f5d12'/></linearGradient>`
      + `<linearGradient id='s' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.5' stop-color='#fff' stop-opacity='.55'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient></defs>`
      + norm(i, `<path d='${d}' fill-rule='evenodd' fill='#1b0606' fill-opacity='.55' transform='translate(1.8 2.6)'/>`
        + `<path d='${d}' fill-rule='evenodd' fill='url(#g)' stroke='#7c4c0c' stroke-width='1.6' stroke-linejoin='round'/>`
        + `<path d='${d}' fill-rule='evenodd' fill='url(#s)'/>`
        + `<path d='${SIG[i].o}' fill='none' stroke='#fff6c4' stroke-width='1.3' stroke-opacity='.9' stroke-linejoin='round' transform='translate(-.8 -.8)'/>`)
      + `</svg>`;
    return studRule('spellbook', i, `background-image:${svgUri(svg)};background-size:100% 100%;background-repeat:no-repeat`);
  };

  /* ------------------------------------------------------------------ Potion: a bottle shaped like the sigil, filled with the colour's elixir
     Seven glass outlines in a 100 x 100 box (the neck leaves room for the cork, which is drawn by the face's ::after so it can pop):
     round flask (Ruby), diamond decanter (Sapphire), conical flask (Emerald), square bottle (Topaz), hexagonal bottle (Amethyst),
     star bottle (Amber) and a vial under a cross stopper (Aqua). lv is the liquid level, hw half the width of its surface. */
  const BOTTLES = [
    { g: ['M43 15H57V33C57 36 60 38 64 41C72 47 77 55 77 65C77 80 65 91 50 91C35 91 23 80 23 65C23 55 28 47 36 41C40 38 43 36 43 33Z'], lv: 59, hw: 26, hl: 'M31 67C30 59 33 53 39 49' },
    { g: ['M44 15H56V32L81 63L50 94L19 63L44 32Z'], lv: 61, hw: 28, hl: 'M29 62L42 47' },
    { g: ['M43 15H57V37L85 87Q87 92 82 92H18Q13 92 15 87L43 37Z'], lv: 62, hw: 20, hl: 'M44 49L30 77' },
    { g: ['M42 15H58V30H76Q81 30 81 35V87Q81 92 76 92H24Q19 92 19 87V35Q19 30 24 30H42Z'], lv: 53, hw: 29, hl: 'M26 41V81' },
    { g: ['M43 15H57V37H70L91 64L70 91H30L9 64L30 37H43Z'], lv: 59, hw: 34, hl: 'M17 63L32 44' },
    { g: ['M44 11H56V38H44Z', 'M50 24L60 50.2L88 52L66.2 69.3L73.5 97L50 81L26.5 97L33.8 69.3L12 52L40 50.2Z'], lv: 60, hw: 21, hl: 'M26 53L37 52' },
    { g: ['M38 24H62V86Q62 92 56 92H44Q38 92 38 86Z'], lv: 50, hw: 11, hl: 'M43 31V80' },
  ];
  const bottleSvg = (p, i) => {
    const B = BOTTLES[i], paths = B.g.map((d) => `<path d='${d}'/>`).join('');
    const air = mix(p.lo, '#0a0420', 0.34), air2 = mix(p.lo, '#0a0420', 0.2);
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs>`
      + `<clipPath id='c'>${paths}</clipPath><clipPath id='l'><rect x='0' y='${B.lv}' width='100' height='60'/></clipPath>`
      + `<linearGradient id='a' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${air2}'/><stop offset='1' stop-color='${air}'/></linearGradient>`
      + `<linearGradient id='q' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${mix(p.glow, '#ffffff', 0.5)}'/><stop offset='.22' stop-color='${p.glow}'/><stop offset='1' stop-color='${mix(p.lo, '#000000', 0.78)}'/></linearGradient>`
      + `<radialGradient id='b' cx='.5' cy='.78' r='.5'><stop offset='0' stop-color='#fff' stop-opacity='.55'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient></defs>`
      + `<g fill='none' stroke='#eef8ff' stroke-width='5.2' stroke-linejoin='round' stroke-opacity='.95'>${paths}</g>`
      + `<g fill='url(#a)'>${paths}</g>`
      + `<g clip-path='url(#c)'><g clip-path='url(#l)'><rect x='0' y='${B.lv}' width='100' height='60' fill='url(#q)'/><rect x='0' y='${B.lv}' width='100' height='60' fill='url(#b)'/></g>`
      + `<rect x='0' y='${B.lv}' width='100' height='2.2' fill='#fff' fill-opacity='.55'/></g>`
      + `<path d='${B.hl}' fill='none' stroke='#fff' stroke-opacity='.8' stroke-width='3' stroke-linecap='round'/>`
      + `<g fill='none' stroke='${mix(p.lo, '#000000', 0.5)}' stroke-width='1.2' stroke-opacity='.55' stroke-linejoin='round'>${paths}</g>`
      + `</svg>`;
  };
  BAKERS.potion = (p, i) => {
    const B = BOTTLES[i], bw = Math.round(B.hw * 1.1), bt = B.lv + 5, bh = Math.max(14, 86 - bt);
    return `.skin-potion .brick[data-c="${i}"]:not(.fusebrick) .deco{background-image:${svgUri(bottleSvg(p, i))};--mw:${B.hw * 2}%;--mt:${B.lv}%;--bw:${bw}%;--bt:${bt}%;--bh:${bh}%}`;
  };

  /* ------------------------------------------------------------------ Gemcut: a faceted gem named after its colour, cut in the sigil's shape
     Round brilliant (Ruby), diamond cut (Sapphire), trillion (Emerald), princess square (Topaz), hexagon cut (Amethyst), star cut (Amber) and
     a cross-faceted cushion (Aqua). Each cut is a table, a ring of crown facets and a ring of girdle triangles, lit from the top left; the
     facet lightness stays inside about plus or minus 20 percent of the colour, so the hue stays clear. */
  const ring = (n, r, c = 50, ph = -90) => Array.from({ length: n }, (_, k) => [c + Math.cos((ph + (k * 360) / n) * Math.PI / 180) * r, c + Math.sin((ph + (k * 360) / n) * Math.PI / 180) * r]);
  const GEM = [
    { P: ring(16, 50), C: [50, 50], t: 0.46, m: 0.76, s: 0.88 },
    { P: [[50, 0], [75, 25], [100, 50], [75, 75], [50, 100], [25, 75], [0, 50], [25, 25]], C: [50, 50], t: 0.5, m: 0.78, s: 0.96 },
    { P: [[50, 6], [75, 50], [100, 94], [50, 94], [0, 94], [25, 50]], C: [50, 64], t: 0.5, m: 0.78, s: 0.92 },
    { P: [[12, 0], [88, 0], [100, 12], [100, 88], [88, 100], [12, 100], [0, 88], [0, 12]], C: [50, 50], t: 0.56, m: 0.8, s: 0.8 },
    { P: [[25, 4], [50, 4], [75, 4], [100, 50], [75, 96], [50, 96], [25, 96], [0, 50]], C: [50, 50], t: 0.5, m: 0.78, s: 0.94 },
    { P: [[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]], C: [50, 50], t: 0.34, m: 0.66, s: 0.98 },
    { P: [[34, 0], [66, 0], [66, 34], [100, 34], [100, 66], [66, 66], [66, 100], [34, 100], [34, 66], [0, 66], [0, 34], [34, 34]], C: [50, 50], t: 0.4, m: 0.7, s: 0.92 },
  ];
  /** The colour of a facet with brightness b (-1 dark to 1 bright) in palette p. */
  const gemTone = (p, b) => {
    const stops = [[-1, mix(p.lo, '#000000', 0.62)], [-0.45, p.lo], [0, p.glow], [0.5, p.hi], [1, mix('#ffffff', p.hi, 0.6)]];
    b = clamp(b, -1, 1);
    for (let k = 1; k < stops.length; k++) if (b <= stops[k][0]) { const [a0, c0] = stops[k - 1], [a1, c1] = stops[k]; return mix(c1, c0, (b - a0) / (a1 - a0)); }
    return stops[stops.length - 1][1];
  };
  const pts = (arr) => arr.map((q) => f1(q[0]) + ' ' + f1(q[1])).join(' ');
  function gemSvg(p, i) {
    const G = GEM[i], n = G.P.length, C = G.C, S = G.s;
    const T = G.P.map((q) => [C[0] + (q[0] - C[0]) * G.t, C[1] + (q[1] - C[1]) * G.t]);
    const M = G.P.map((q) => [C[0] + (q[0] - C[0]) * G.m, C[1] + (q[1] - C[1]) * G.m]);
    const fac = [];
    // brightness from the way a facet faces: lit from the top left
    const face = (poly, off) => { const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length - C[0], cy = poly.reduce((s, q) => s + q[1], 0) / poly.length - C[1]; return 0.9 * Math.cos(Math.atan2(cy, cx) + 2.356) + off; };
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n, odd = k % 2 ? 0.1 : -0.1;
      const crown = [T[k], T[k1], M[k1], M[k]], a = [M[k], G.P[k], G.P[k1]], b = [M[k], M[k1], G.P[k1]];
      fac.push([crown, face(crown, 0.12 + odd)], [a, face(a, -0.2 - odd)], [b, face(b, 0.06 + odd)]);
    }
    const sp = G.P.map((q) => [q[0], q[1]]);
    const outline = 'M' + sp.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L') + 'Z';
    const polys = fac.map(([poly, b]) => `<polygon points='${pts(poly)}' fill='${gemTone(p, b)}' stroke='#fff' stroke-opacity='.3' stroke-width='.7' stroke-linejoin='round'/>`).join('');
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-7 -7 114 114'><defs>`
      + `<linearGradient id='t' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.9'/><stop offset='.55' stop-color='#fff' stop-opacity='.2'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>`
      + `<linearGradient id='b' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ffffff'/><stop offset='.35' stop-color='#aab5cd'/><stop offset='.6' stop-color='#f4f7ff'/><stop offset='1' stop-color='#7d8aa6'/></linearGradient>`
      + `<clipPath id='k'><path d='${outline}'/></clipPath></defs>`
      + `<g transform='translate(50 50) scale(${S}) translate(-50 -50)'>`
      + `<path d='${outline}' fill='${gemTone(p, -0.6)}' transform='translate(1 2.4)' opacity='.5'/>`
      + `<path d='${outline}' fill='${gemTone(p, -0.5)}'/>${polys}`
      + `<polygon points='${pts(T)}' fill='url(#t)' fill-opacity='.7'/>`
      + `<g clip-path='url(#k)'><path d='M-10 70L70 -10H92L-10 92Z' fill='#fff' fill-opacity='.13'/></g>`
      + `<path d='${outline}' fill='none' stroke='url(#b)' stroke-width='4' stroke-linejoin='round'/>`
      + `</g></svg>`;
  }
  BAKERS.gemcut = (p, i) => `.skin-gemcut .brick[data-c="${i}"]:not(.fusebrick) .deco{background-image:${svgUri(gemSvg(p, i))}}`;

  /* ------------------------------------------------------------------ Sigil: the colour's sigil in white gold, with the glow of its colour
     The sigil (outline and the cut-out of its inner mark) over a soft blurred copy in the brick's own glow, so it burns without any filter on
     the page. Sized so the glyph itself is 78 percent of the layer (the rest is the glow). */
  BAKERS.sigil = (p, i) => {
    const d = sigPath(i);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-14 -14 128 128'><defs>`
      + `<filter id='f' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='4.5'/></filter>`
      + `<linearGradient id='g' x1='0' y1='0' x2='.4' y2='1'><stop offset='0' stop-color='#ffffff'/><stop offset='.55' stop-color='#fff4cc'/><stop offset='1' stop-color='#ffd978'/></linearGradient></defs>`
      + norm(i, `<path d='${d}' fill-rule='evenodd' fill='${p.glow}' filter='url(#f)' opacity='.95' transform='translate(50 50) scale(1.12) translate(-50 -50)'/>`
        + `<path d='${d}' fill-rule='evenodd' fill='url(#g)'/>`)
      + `</svg>`;
    return studRule('sigil', i, `background-image:${svgUri(svg)};background-size:100% 100%;background-repeat:no-repeat`);
  };

  /* ------------------------------------------------------------------ Moonglass: the sigil etched in frosted glass */
  BAKERS.moonglass = (p, i) => {
    const d = sigPath(i);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-8 -8 116 116'><defs>`
      + `<radialGradient id='f' cx='.38' cy='.32' r='.85'><stop offset='0' stop-color='#ffffff' stop-opacity='.98'/><stop offset='.7' stop-color='#e6eeff' stop-opacity='.78'/><stop offset='1' stop-color='#cfdcff' stop-opacity='.62'/></radialGradient></defs>`
      + norm(i, `<path d='${d}' fill-rule='evenodd' fill='#10142a' fill-opacity='.38' transform='translate(1.2 2)'/>`
        + `<path d='${d}' fill-rule='evenodd' fill='url(#f)'/>`
        + `<path d='${SIG[i].o}' fill='none' stroke='#fff' stroke-opacity='.9' stroke-width='1.6' stroke-linejoin='round'/>`)
      + `</svg>`;
    return studRule('moonglass', i, `background-image:${svgUri(svg)};background-size:100% 100%;background-repeat:no-repeat`);
  };

  /* ================================================================== registration */
  Skins.applyHooks.push(() => {
    const sk = BR.Progress && BR.Progress.equipped ? BR.Progress.equipped('skin') : null;
    if (sk && sk.item) ensure(keyOf(sk.item.cls));
  });

  BR.S4Skins ={ SIG, sigPath, ensure, bakers: BAKERS, baked, mix, svgUri };
})();
