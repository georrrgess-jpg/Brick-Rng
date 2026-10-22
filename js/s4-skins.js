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

  /* ================================================================== moments: shared pieces */

  /* DOM sprites (transform + opacity only) live in the sprite layer #s3fx that Series 3 made (css/s3-skins.css); the layer allows 26 live at
     once and a moment uses at most three. Everything else a moment draws is a canvas particle (fx.emit, fx.shards, fx.sparks, fx.sprite,
     fx.link) or a ring, so it costs no DOM. */
  const LAYER_MAX = 26;
  const spriteLayer = () => {
    let el = document.getElementById('s3fx');
    if (!el) { el = document.createElement('div'); el.id = 's3fx'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
    return el;
  };
  /** A throw-away element of w x h px centred on (x, y) that plays `frames` and removes itself. `host` is the layer by default. */
  function sprite(cls, x, y, w, h, frames, opts, style, host) {
    const L = host || spriteLayer();
    if (!host && L.childElementCount >= LAYER_MAX) return null;
    const el = document.createElement('i');
    el.className = 's3-bit ' + cls;
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.left = f1(x - w / 2) + 'px'; el.style.top = f1(y - h / 2) + 'px';
    if (style) Object.keys(style).forEach((k) => el.style.setProperty(k, style[k]));
    if (!el.animate) return null;
    L.appendChild(el);
    const a = el.animate(frames, Object.assign({ fill: 'both' }, opts));   // 'both': a sprite with a delay waits in its first keyframe, not in its plain style
    let fin = false;
    const done = () => { if (fin) return; fin = true; el.remove(); };
    a.onfinish = done; a.oncancel = done;
    setTimeout(done, (opts.duration || 600) + (opts.delay || 0) + 250);
    return el;
  }
  const tf = (x, y, s, r, sy) => `translate(${f1(x)}px, ${f1(y)}px) scale(${f2(s)}, ${f2(sy == null ? s : sy)}) rotate(${f1(r || 0)}deg)`;
  /** At most 40 particles in a moment: take what a budget allows. */
  const budget = (max = 40) => { let used = 0; return (k = 1) => { if (used + k > max) return false; used += k; return true; }; };

  /* the sounds: short, quiet, made from the shared synth (BR.audio.tone / BR.audio.noise); a missing synth is silence */
  const A = () => BR.audio;
  const tone = (o) => { const a = A(); if (a && a.tone) a.tone(o); };
  const noise = (o) => { const a = A(); if (a && a.noise) a.noise(o); };
  const sfx = {
    glug() { tone({ f: 190, to: 340, dur: 0.1, vol: 0.075, attack: 0.006, lp: 1600 }); tone({ f: 250, to: 430, dur: 0.12, vol: 0.065, attack: 0.006, at: 0.09, lp: 1600 }); noise({ dur: 0.2, vol: 0.035, from: 1300, to: 500, q: 1.4, type: 'bandpass', attack: 0.01 }); },
    cork() { tone({ f: 520, to: 150, dur: 0.07, vol: 0.09, attack: 0.002, lp: 2200 }); noise({ dur: 0.05, vol: 0.05, from: 2600, to: 900, q: 0.9, type: 'bandpass', attack: 0.002 }); },
    glint() { tone({ f: 2093, dur: 0.14, vol: 0.04, attack: 0.002 }); tone({ f: 3136, dur: 0.18, vol: 0.03, attack: 0.002, at: 0.03 }); },
    chime() { [523, 659, 784].forEach((f, i) => tone({ f, dur: 0.5 - i * 0.08, vol: 0.05, attack: 0.004, at: i * 0.06, lp: 4200 })); },
    sand() { noise({ dur: 0.32, vol: 0.05, from: 4200, to: 1800, q: 0.6, type: 'bandpass', attack: 0.02 }); },
    tick() { tone({ f: 1480, to: 1100, dur: 0.05, vol: 0.05, attack: 0.002 }); },
    clock() { tone({ f: 131, dur: 0.7, vol: 0.09, attack: 0.004, lp: 1400 }); tone({ f: 262, dur: 0.5, vol: 0.05, attack: 0.004, lp: 2600 }); tone({ f: 392, dur: 0.35, vol: 0.03, attack: 0.004, at: 0.01 }); },
    bell() { tone({ f: 164, dur: 0.9, vol: 0.09, attack: 0.004, lp: 2000 }); tone({ f: 329, dur: 0.7, vol: 0.05, attack: 0.004, lp: 3000 }); tone({ f: 493, dur: 0.5, vol: 0.03, attack: 0.004, at: 0.01 }); },
    moon() { tone({ f: 392, to: 523, dur: 0.5, vol: 0.04, attack: 0.05, lp: 3000 }); tone({ f: 587, dur: 0.6, vol: 0.025, attack: 0.08, at: 0.1 }); },
  };

  /* A moment runs for the equipped Skin's key; the item-reveal demo passes the previewed item instead. */
  const active = (key, type, d, ctx) => (type === 'demo' ? !!(d && d.item && d.item.moment === key) : !!ctx.M[key]);
  const centroid = (cells) => { let x = 0, y = 0; cells.forEach((c) => { x += c.x; y += c.y; }); return { x: x / cells.length, y: y / cells.length }; };
  /** The element that wears the Skin: the board's field in a run, the preview's brick group in a reveal. */
  const skinHost = (d, type) => {
    if (type !== 'demo') return document.getElementById('field');
    let el = d.cells && d.cells[0];
    while (el && !(el.classList && Array.from(el.classList).some((c) => /^skin-/.test(c)))) el = el.parentElement;
    return el;
  };
  /** The colour index of each popped brick (a group is one colour; a demo reads it from the brick). */
  const colorsOf = (type, d, ctx) => (type === 'demo' ? d.cells.map((el) => +el.dataset.c || 0) : ctx.cells.map(() => (d.res && d.res.plan && d.res.plan.color != null ? d.res.plan.color : 0)));
  /** The page rectangle that holds the bricks: the real board in a run, the demo's cells (with a margin) in a reveal. */
  const boardRect = (d, type, ctx) => {
    if (type !== 'demo' && d.view && d.view.boardEl) return d.view.boardEl.getBoundingClientRect();
    const host = skinHost(d, type);
    if (host) { const r = host.getBoundingClientRect(); if (r.width) return r; }
    return { left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight };
  };
  /** The fuse readout the time chips fly to. */
  const readoutPoint = () => {
    const el = document.getElementById('fuseTime') || document.getElementById('fuseTimeBox');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };
  /** The cells (page points) along a Line Blast: its row and/or column. */
  const linePoints = (d) => {
    const v = d.view, p = d.res && d.res.plan, out = [];
    if (!v || !p) return out;
    if (p.lineH) for (let c = 0; c < BR.CFG.cols; c++) out.push({ pt: v.pagePoint(p.r, c), i: c });
    if (p.lineV) for (let r = 0; r < BR.CFG.rows; r++) out.push({ pt: v.pagePoint(r, p.c), i: r });
    return out;
  };
  const later = (fn, ms) => setTimeout(() => { if (!still()) fn(); }, ms);
  /** Play a class on an element for ms (a CSS animation set through the class), then take it off. */
  const flag = (el, cls, ms) => {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    clearTimeout(el['_s4t_' + cls]);
    el['_s4t_' + cls] = setTimeout(() => el.classList.remove(cls), ms);
  };
  /** A soft glow that grows and fades, in the colour of the moment. Used for vapour and clouds. */
  const puff = (cls, x, y, w, h, color, dur, delay, drift) => sprite(cls, x, y, w, h, [
    { transform: tf(0, 0, 0.4), opacity: 0 },
    { transform: tf(0, -(drift || 30) * 0.45, 0.85), opacity: 0.85, offset: 0.35 },
    { transform: tf(0, -(drift || 30), 1.25), opacity: 0 }], { duration: dur, delay: delay || 0, easing: 'ease-out' }, { '--vc': color });

  /* ================================================================== Potion */
  /** Every pop: the bottle breaks into white glass shards, droplets of the elixir and a vapour puff that rises (at most 30 particles). */
  function potionPop(type, d, ctx) {
    const { fx, cells, n, col } = ctx;
    if (!cells || !cells.length) return;
    const B = budget(), big = n >= 8, k = cells.length, ci = colorsOf(type, d, ctx), c0 = centroid(cells);
    const shards = big ? 2 : k <= 5 ? 3 : 2, drops = big ? 1 : k <= 5 ? 3 : 2;
    cells.forEach((q, i) => {
      const p = BR.PALETTE[ci[i] % 7] || col(0);
      for (let j = 0; j < shards; j++) if (B()) fx.emit({ shape: 'tri', x: q.x + rnd(-6, 6), y: q.y + rnd(-6, 6), vx: rnd(-170, 170), vy: rnd(-300, -60), g: 1250, drag: 0.7, rot: rnd(0, 6.28), vr: rnd(-12, 12), size: rnd(3, 6), max: rnd(0.34, 0.5), color: j % 2 ? '#ffffff' : '#d8f1ff' });
      for (let j = 0; j < drops; j++) if (B()) fx.emit({ kind: 'spark', x: q.x, y: q.y - 4, vx: rnd(-120, 120), vy: rnd(-330, -120), g: 900, drag: 0.9, size: rnd(2.8, 4.6), max: rnd(0.34, 0.5), color: p.glow });
    });
    const p0 = BR.PALETTE[ci[0] % 7] || col(0);
    if (!big) { puff('s4-vapor', c0.x, c0.y, 52 + k * 7, 52 + k * 7, p0.glow, 480, 0, 38); return; }
    // big pop: a column of smoke rises from the group and blooms into a glittering cloud that drifts up and fades (two sprites, 12 sparkles, 560 ms)
    const colH = clamp(c0.y * 0.5, 90, 150);
    sprite('s4-smoke', c0.x, c0.y - colH * 0.45, 54, colH, [
      { transform: tf(0, 26, 0.5, 0, 0.25), opacity: 0 },
      { transform: tf(0, 0, 1, 0, 1), opacity: 0.85, offset: 0.4 },
      { transform: tf(0, -26, 1.25, 0, 1.12), opacity: 0 }], { duration: 360, easing: 'ease-out' }, { '--vc': p0.glow });
    puff('s4-cloud', c0.x, c0.y - colH - 8, 140, 104, p0.hi, 380, 180, 34);
    for (let j = 0; j < 10; j++) if (B()) later(() => fx.emit({ kind: 'spark', x: c0.x + rnd(-48, 48), y: c0.y - colH - 8 + rnd(-30, 24), vx: rnd(-26, 26), vy: rnd(-70, -20), g: -20, drag: 1, size: rnd(2, 3.6), max: rnd(0.24, 0.3), color: j % 3 ? '#ffffff' : p0.hi }), 150 + j * 12);
    sfx.glug();
  }
  /** Line Blast: bubbles stream along the blasted line in the line's colour. */
  function potionLine(type, d, ctx) {
    const pts = linePoints(d), fx = ctx.fx, B = budget(), color = Skins.beam || '#9ff0ff';
    pts.forEach(({ pt, i }) => { for (let j = 0; j < 2; j++) if (B()) later(() => fx.emit({ kind: 'spark', x: pt.x + rnd(-10, 10), y: pt.y + rnd(-6, 8), vx: rnd(-18, 18), vy: rnd(-120, -60), g: -60, drag: 0.8, size: rnd(2.8, 4.8), max: rnd(0.3, 0.4), color: j ? '#ffffff' : color }), i * 20 + j * 50); });
    if (pts.length) sfx.glug();
  }
  /** Stage-up: the corks pop (every third bottle jumps up and drops back, 340 ms). */
  function potionStage(d, type) {
    flag(skinHost(d, type), 's4-corks', 520);
    sfx.cork();
  }

  /* ================================================================== Gemcut */
  /** Every pop: the gem shatters into facet shards (triangles in the gem's colour and its light tint), white sparkles and a thin refraction ring. */
  function gemPop(type, d, ctx) {
    const { fx, cells, n } = ctx;
    if (!cells || !cells.length) return;
    const B = budget(), ci = colorsOf(type, d, ctx), c0 = centroid(cells), per = cells.length <= 5 ? 3 : 2;
    cells.forEach((q, i) => {
      const p = BR.PALETTE[ci[i] % 7];
      for (let j = 0; j < per; j++) if (B()) fx.emit({ shape: 'tri', x: q.x, y: q.y, vx: rnd(-260, 260), vy: rnd(-300, 80), g: 1300, drag: 0.8, rot: rnd(0, 6.28), vr: rnd(-14, 14), size: rnd(4, 8), max: rnd(0.34, 0.5), color: j === 1 ? p.hi : j === 2 ? mix('#ffffff', p.hi, 0.55) : p.glow });
      if (B()) fx.emit({ kind: 'spark', x: q.x + rnd(-8, 8), y: q.y + rnd(-8, 8), vx: rnd(-60, 60), vy: rnd(-80, 20), g: 0, drag: 2, size: rnd(2.4, 3.8), max: rnd(0.28, 0.4), color: '#ffffff' });
    });
    fx.ring(c0.x, c0.y, '#e8f0ff', 36 + Math.min(n, 12) * 4, 0.4, 2);
    if (n >= 8) gemPrism(type, d, ctx, c0, B);
  }
  /** Big pop: the prism. A white beam fires up from the group and splits into a fan of seven rays, one in each brick colour, that sweeps across the board (two sprites, 580 ms). */
  function gemPrism(type, d, ctx, c0, B) {
    const r = boardRect(d, type, ctx), top = Math.max(r.top + 4, 40), rise = Math.max(40, c0.y - top), size = clamp(r.width * 1.25, 200, 520);
    sprite('s4-beam', c0.x, c0.y - rise / 2, 14, rise, [
      { transform: tf(0, 0, 1, 0, 0.1), opacity: 0 }, { transform: tf(0, 0, 1, 0, 1), opacity: 0.85, offset: 0.4 }, { transform: tf(0, 0, 0.6, 0, 1), opacity: 0 }], { duration: 240, easing: 'ease-out' });
    const ks = {};
    BR.PALETTE.forEach((p, i) => { ks['--k' + i] = p.glow; });
    sprite('s4-fan', c0.x, top + size / 2 - 4, size, size, [
      { transform: tf(0, 0, 0.55, -24), opacity: 0 },
      { transform: tf(0, 0, 0.95, -10), opacity: 0.95, offset: 0.25 },
      { transform: tf(0, 0, 1, 14), opacity: 0.8, offset: 0.7 },
      { transform: tf(0, 0, 1.05, 24), opacity: 0 }], { duration: 440, delay: 130, easing: 'ease-in-out' }, ks);
    for (let j = 0; j < 10; j++) if (B()) later(() => ctx.fx.emit({ kind: 'spark', x: c0.x + rnd(-30, 30), y: top + rnd(0, 60), vx: rnd(-60, 60), vy: rnd(20, 90), g: 0, drag: 1, size: rnd(2, 3.4), max: rnd(0.22, 0.28), color: pick(['#ffffff', '#ff8191', '#78adff', '#68f2ac', '#ffe272', '#ff8ff0']) }), 150 + j * 14);
    sfx.glint();
  }
  /** Line Blast: ten glints run along the beam. */
  function gemLine(type, d, ctx) {
    const pts = linePoints(d), fx = ctx.fx, B = budget(10);
    pts.forEach(({ pt, i }) => { if (i % 4 === 1 || i % 4 === 3 || i === 0) { if (B()) later(() => { fx.emit({ kind: 'spark', x: pt.x, y: pt.y, vx: 0, vy: 0, g: 0, drag: 1, size: 6, max: 0.3, color: '#ffffff' }); fx.emit({ kind: 'spark', x: pt.x, y: pt.y, vx: 0, vy: 0, g: 0, drag: 1, size: 10, max: 0.24, color: '#cfe4ff' }); }, i * 36); } });
    if (pts.length) sfx.glint();
  }
  /** Rush start: fine star sparkles drift down over the board. */
  function gemRush(d, ctx) {
    const r = boardRect(d, 'rush', ctx), fx = ctx.fx, B = budget(18);
    for (let j = 0; j < 18; j++) if (B()) later(() => fx.emit({ shape: 'star', x: r.left + rnd(0.04, 0.96) * r.width, y: r.top + rnd(0, 0.5) * r.height, vx: rnd(-14, 14), vy: rnd(40, 110), g: 0, drag: 0.4, rot: rnd(0, 6), vr: rnd(-3, 3), size: rnd(3, 6), max: rnd(0.36, 0.5), color: pick(['#ffffff', '#cfe4ff', '#fff0b8']) }), j * 18);
    fx.ring(r.left + r.width / 2, r.top + r.height / 2, '#e8f0ff', r.width * 0.4, 0.6, 3);
    sfx.chime();
  }
  /** Stage-up: one polishing gleam sweeps diagonally across the whole board (one element, translate). */
  function gemStage(d, ctx) {
    const board = document.getElementById('board');
    if (!board) return;
    const w = board.clientWidth, h = board.clientHeight;
    sprite('s4-gleam', w / 2, h / 2, w * 0.5, h * 2.1, [
      { transform: `translateX(${-w * 0.9}px) rotate(32deg)`, opacity: 0 },
      { transform: `translateX(${-w * 0.55}px) rotate(32deg)`, opacity: 1, offset: 0.2 },
      { transform: `translateX(${w * 0.55}px) rotate(32deg)`, opacity: 1, offset: 0.8 },
      { transform: `translateX(${w * 0.9}px) rotate(32deg)`, opacity: 0 }], { duration: 640, easing: 'ease-in-out' }, null, board);
    sfx.glint();
  }

  /* ================================================================== Hourglass */
  const SANDS = ['#f6e2a8', '#ecd08a', '#fff3c9'];
  const sandOf = (p) => mix(p.glow, '#fff6d8', 0.6);
  /** Every pop: the hourglass cracks and its sand pours out in a short falling stream (tiny square grains) with a brass ring flash. */
  function sandPop(type, d, ctx) {
    const { fx, cells, n } = ctx;
    if (!cells || !cells.length) return;
    const B = budget(), ci = colorsOf(type, d, ctx), c0 = centroid(cells), per = n >= 8 ? 2 : cells.length <= 5 ? 4 : 3;
    cells.forEach((q, i) => {
      const sc = sandOf(BR.PALETTE[ci[i] % 7]);
      for (let j = 0; j < per; j++) if (B()) later(() => fx.emit({ shape: 'rect', x: q.x + rnd(-5, 5), y: q.y - 2, vx: rnd(-26, 26), vy: rnd(10, 110), g: 1500, drag: 0.35, size: rnd(2.6, 4.4), spread: 0, rot: 0, vr: 0, max: rnd(0.3, 0.45), color: j % 3 ? sc : pick(SANDS) }), j * 24 + i * 5);
    });
    fx.ring(c0.x, c0.y, '#f0c04a', 34 + Math.min(n, 12) * 3, 0.36, 3);
    if (n >= 8) sandRibbon(c0, ctx, B);
  }
  /** Big pop: the group's sand swirls into a ribbon that trails the time chip into the fuse readout. */
  function sandRibbon(c0, ctx, B) {
    const end = readoutPoint();
    if (!end) return;
    const fx = ctx.fx, mx = (c0.x + end.x) / 2 + (end.x > c0.x ? -1 : 1) * 70, my = Math.min(c0.y, end.y) + (Math.abs(c0.y - end.y)) * 0.35;
    const at = (t) => ({ x: (1 - t) * (1 - t) * c0.x + 2 * (1 - t) * t * mx + t * t * end.x, y: (1 - t) * (1 - t) * c0.y + 2 * (1 - t) * t * my + t * t * end.y });
    const N = 14;
    for (let i = 0; i < N; i++) {
      if (!B()) break;
      const t = i / (N - 1), e = t * t * (3 - 2 * t), P = at(e), sw = Math.sin(i * 1.15) * 11 * (1 - t);
      later(() => fx.emit({ shape: 'rect', x: P.x + sw, y: P.y, vx: rnd(-14, 14), vy: rnd(-14, 14), g: 0, drag: 2, size: rnd(3, 5), spread: 0, max: 0.26, color: i % 2 ? '#ffe9a8' : '#fff7dc' }), i * 18);
    }
    sfx.sand();
  }
  /** Line Blast: grains rain down along the blasted line. */
  function sandLine(type, d, ctx) {
    const pts = linePoints(d), fx = ctx.fx, B = budget(24);
    pts.forEach(({ pt, i }) => { for (let j = 0; j < 2; j++) if (B()) later(() => fx.emit({ shape: 'rect', x: pt.x + rnd(-8, 8), y: pt.y - rnd(0, 10), vx: rnd(-14, 14), vy: rnd(30, 120), g: 1400, drag: 0.3, size: rnd(2.6, 4.4), spread: 0, max: rnd(0.32, 0.4), color: pick(SANDS) }), i * 18 + j * 45); });
    if (pts.length) sfx.sand();
  }
  /** Rush start: time stops. A silver ring from the board, and grains left hanging in the air. */
  function sandRush(d, ctx) {
    const r = boardRect(d, 'rush', ctx), fx = ctx.fx, B = budget(22);
    fx.ring(r.left + r.width / 2, r.top + r.height / 2, '#e2f6ff', r.width * 0.48, 0.55, 3);
    for (let j = 0; j < 20; j++) if (B()) later(() => fx.emit({ shape: 'rect', x: r.left + rnd(0.05, 0.95) * r.width, y: r.top + rnd(0.05, 0.95) * r.height, vx: 0, vy: 0, g: 0, drag: 4, size: rnd(2.4, 4), spread: 0, max: rnd(0.4, 0.55), color: pick(['#ffffff', '#e8f8ff', '#fff3c9']) }), j * 12);
    sfx.tick();
  }
  /** Rush end: the frost cracks off and the sand runs again. */
  function sandThaw(d, ctx) {
    const r = boardRect(d, 'rush', ctx), fx = ctx.fx, B = budget(16);
    for (let j = 0; j < 16; j++) if (B()) later(() => fx.emit({ shape: 'tri', x: r.left + rnd(0.05, 0.95) * r.width, y: r.top + rnd(0.05, 0.95) * r.height, vx: rnd(-60, 60), vy: rnd(-90, 20), g: 900, drag: 1, rot: rnd(0, 6.28), vr: rnd(-8, 8), size: rnd(3, 5.5), max: rnd(0.34, 0.5), color: '#e8f8ff' }), j * 12);
    sfx.tick();
  }
  /** Stage-up: every hourglass turns over in a diagonal wave from the top left (24 ms apart, 380 ms each, about 0.7 s for the board);
      the sand runs down while the glass turns, so the glass is full at the top again when it lands. */
  const EASE = 'cubic-bezier(0.55, 0, 0.25, 1)', TURN = 380;
  function sandFlip(d, type) {
    const bricks = [];
    if (type === 'demo') {
      const host = skinHost(d, type);
      if (host) Array.from(host.querySelectorAll('.brick')).forEach((el, i) => bricks.push({ el, r: (i / 3) | 0, c: i % 3 }));
    } else if (d.run && d.run.view) d.run.view.bricks.forEach((rec) => bricks.push({ el: rec.el, r: rec.r, c: rec.c }));
    const step = type === 'demo' ? 60 : 24;
    bricks.forEach(({ el, r, c }) => {
      if (el.classList.contains('fusebrick')) return;
      const deco = el.querySelector('.deco');
      if (!deco || !deco.animate) return;
      const delay = (r + c) * step;
      deco.animate([{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(90deg) scale(1.1)', offset: 0.5 }, { transform: 'rotate(180deg) scale(1)' }], { duration: TURN, delay, easing: EASE });
      setTimeout(() => el.classList.add('hg-turn'), delay);
      setTimeout(() => el.classList.remove('hg-turn'), delay + TURN + 5);
    });
    sfx.clock();
  }

  /* ================================================================== Sigil */
  const GOLD = '#ffe6a0', GOLD2 = '#fff6d0';
  /** The glyph bitmap of a sigil (white gold), baked once per colour and shared by every particle. */
  const glyphImg = (c) => BR.FX.bake('s4-glyph-' + c, 44, 44, (x) => {
    x.translate(22, 22); x.scale(0.38 * EXT[c] * 1.1, 0.38 * EXT[c] * 1.1); x.translate(-50, -50);
    x.shadowColor = BR.PALETTE[c].glow; x.shadowBlur = 24;
    const g = x.createLinearGradient(0, 0, 40, 100); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ffd978');
    x.fillStyle = g; x.fill(new Path2D(sigPath(c)), 'evenodd');
  });
  /** A tiny rune stroke (four shapes) for the Line Blast runes. */
  const runeImg = (k) => BR.FX.bake('s4-rune-' + k, 28, 28, (x) => {
    x.translate(14, 14); x.strokeStyle = GOLD2; x.lineWidth = 2.6; x.lineCap = 'round'; x.lineJoin = 'round'; x.shadowColor = '#ffcf6b'; x.shadowBlur = 8;
    const P = ['M0 -9V9M-6 -3L6 3', 'M-7 7L0 -9L7 7', 'M0 -4.5A4.5 4.5 0 1 1 0 4.5A4.5 4.5 0 1 1 0 -4.5M0 -9V-4.5', 'M-7 -7H7L-7 7H7'][k % 4];
    x.stroke(new Path2D(P));
  });
  const castUri = {};
  /** The spell circle of colour c: an outer rune band, a hexagram, an inner ring and the sigil in the middle. Built once per colour. */
  function castSvg(c) {
    if (castUri[c]) return castUri[c];
    const p = BR.PALETTE[c], glow = p.glow;
    let hexa = '', dots = '', runes = '';
    for (const off of [0, 180]) { let dd = ''; for (let i = 0; i < 3; i++) { const a = ((i * 120 + off - 90) * Math.PI) / 180; dd += (i ? 'L' : 'M') + f1(Math.cos(a) * 62) + ' ' + f1(Math.sin(a) * 62); } hexa += `<path d='${dd}Z'/>`; }
    for (let i = 0; i < 6; i++) { const a = ((i * 60 - 90) * Math.PI) / 180; dots += `<circle cx='${f1(Math.cos(a) * 62)}' cy='${f1(Math.sin(a) * 62)}' r='5' fill='${GOLD2}' stroke='${glow}' stroke-width='2'/>`; }
    for (let i = 0; i < 28; i++) {
      const k = i % 4, g = k === 0 ? `<path d='M0 -4V4M-2.5 -1.5L2.5 1.5'/>` : k === 1 ? `<path d='M-3 3L0 -4L3 3'/>` : k === 2 ? `<circle r='2.6'/><path d='M0 -4.5V-2.6'/>` : `<path d='M-3 -3H3L-3 3H3'/>`;
      runes += `<g transform='rotate(${f1((i / 28) * 360)}) translate(0 -86)' stroke='${GOLD2}' stroke-width='1.3' fill='none' stroke-linecap='round'>${g}</g>`;
    }
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-100 -100 200 200'><circle r='96' fill='${glow}' fill-opacity='.1'/><g fill='none'>`
      + `<circle r='92' stroke='${glow}' stroke-opacity='.45' stroke-width='9'/><circle r='92' stroke='${GOLD}' stroke-width='3'/><circle r='80' stroke='${GOLD}' stroke-width='1.4' stroke-opacity='.8'/>`
      + `<circle r='62' stroke='${glow}' stroke-opacity='.5' stroke-width='7'/><circle r='62' stroke='${GOLD2}' stroke-width='2.2'/><g stroke='${GOLD}' stroke-width='2' stroke-linejoin='round'>${hexa}</g><circle r='30' stroke='${GOLD2}' stroke-width='2'/></g>`
      + `${runes}${dots}<circle r='24' fill='${glow}' fill-opacity='.3'/><g transform='scale(.3) translate(-50 -50)'><path d='${sigPath(c)}' fill-rule='evenodd' fill='#fff'/></g></svg>`;
    return (castUri[c] = svgUri(svg));
  }
  /** Every pop: each brick's sigil lifts off for 300 ms and dissolves into gold motes. */
  function sigilPop(type, d, ctx) {
    const { fx, cells, n } = ctx;
    if (!cells || !cells.length) return;
    const B = budget(), ci = colorsOf(type, d, ctx), c0 = centroid(cells);
    cells.forEach((q, i) => {
      const c = ci[i] % 7;
      if (B()) fx.sprite({ img: glyphImg(c), x: q.x, y: q.y - 2, vx: rnd(-14, 14), vy: rnd(-120, -80), g: 0, drag: 2.2, size: 24, rot: rnd(-0.3, 0.3), vr: rnd(-1.5, 1.5), max: 0.3, a: 1, grow: 0.5 });
      for (let j = 0; j < 2; j++) if (B()) later(() => fx.emit({ kind: 'spark', x: q.x + rnd(-6, 6), y: q.y - 12 + rnd(-6, 6), vx: rnd(-50, 50), vy: rnd(-110, -40), g: 120, drag: 1.6, size: rnd(2.2, 3.6), max: rnd(0.3, 0.4), color: j ? GOLD2 : GOLD }), 100 + j * 40);
    });
    if (n >= 8) sigilCast(type, d, ctx, c0, ci[0] % 7, B);
  }
  /** Big pop: the cast. A spell circle draws itself round the group, holds, then a pillar of light fires upward; it is gone by 600 ms. */
  function sigilCast(type, d, ctx, c0, c, B) {
    const cells = ctx.cells;
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    cells.forEach((q) => { l = Math.min(l, q.x); t = Math.min(t, q.y); r = Math.max(r, q.x); b = Math.max(b, q.y); });
    const cell = ctx.view ? ctx.view.cell : 44, size = clamp(Math.max(r - l, b - t) + cell * 2.4, 150, 300);
    const col = BR.PALETTE[c];
    sprite('s4-cast', c0.x, c0.y, size, size, [
      { transform: tf(0, 0, 0.6, -30), opacity: 0 },
      { transform: tf(0, 0, 1, 0), opacity: 1, offset: 0.3 },
      { transform: tf(0, 0, 1, 4), opacity: 1, offset: 0.58 },
      { transform: tf(0, 0, 1.08, 8), opacity: 0 }], { duration: 600, easing: 'ease-out' }, { '--cast': castSvg(c) });
    const pillar = clamp(c0.y - 30, 80, 520);
    sprite('s4-pillar', c0.x, c0.y - pillar / 2, size * 0.3, pillar, [
      { transform: tf(0, pillar / 2, 1, 0, 0), opacity: 0 }, { transform: tf(0, 0, 1, 0, 1), opacity: 0.6, offset: 0.35 }, { transform: tf(0, 0, 0.7, 0, 1), opacity: 0 }], { duration: 250, delay: 330, easing: 'ease-out' }, null);
    for (let j = 0; j < 8; j++) if (B()) later(() => ctx.fx.emit({ kind: 'spark', x: c0.x + rnd(-size * 0.25, size * 0.25), y: c0.y + rnd(-10, 20), vx: rnd(-30, 30), vy: rnd(-260, -120), g: 0, drag: 1.2, size: rnd(2.4, 4), max: rnd(0.22, 0.26), color: j % 2 ? GOLD2 : col.glow }), 260 + j * 6);
    sfx.bell();
  }
  /** Line Blast: eight runes race along the blasted line ahead of the beam, and the board frame flashes gold. */
  function sigilLine(type, d, ctx) {
    const pts = linePoints(d), fx = ctx.fx;
    pts.forEach(({ pt, i }, k) => { if (k < 8) later(() => fx.sprite({ img: runeImg(i), x: pt.x, y: pt.y, vx: 0, vy: -26, g: 0, drag: 1, size: 22, rot: rnd(-0.3, 0.3), vr: rnd(-1, 1), max: 0.32, a: 1, grow: 0.3 }), i * 34); });
    const board = document.getElementById('board');
    if (board) sprite('s4-frame', board.clientWidth / 2, board.clientHeight / 2, board.clientWidth, board.clientHeight, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 480, easing: 'ease-out' }, null, board);
    if (pts.length) sfx.bell();
  }
  /** The eight runes set into the board frame count down the Rush: one goes dark each second. */
  let runeTimer = 0;
  const RUNE_SPOTS = [[0.3, 0], [0.7, 0], [1, 0.3], [1, 0.7], [0.7, 1], [0.3, 1], [0, 0.7], [0, 0.3]];
  function runeFrame(on, d) {
    const board = document.getElementById('board');
    clearInterval(runeTimer); runeTimer = 0;
    const old = board && board.querySelector('.s4-runes');
    if (old) old.remove();
    if (!on || !board || still()) return;
    const W = board.clientWidth, H = board.clientHeight, m = 6;
    let marks = '';
    RUNE_SPOTS.forEach(([fx, fy], i) => {
      const x = m + fx * (W - 2 * m), y = m + fy * (H - 2 * m);
      marks += `<g class='rn on' transform='translate(${f1(x)} ${f1(y)})'><circle r='8.5' fill='#ffd36b' fill-opacity='.32'/><path d='M0 -6.5L6.5 0L0 6.5L-6.5 0Z' fill='#fff3c4' stroke='#ffd36b' stroke-width='1.4'/><path d='M0 -2.6V2.6M-2 0H2' stroke='#a8740c' stroke-width='1.1'/></g>`;
    });
    const el = document.createElement('div');
    el.className = 's4-runes';
    el.innerHTML = `<svg viewBox='0 0 ${W} ${H}'><rect x='${m}' y='${m}' width='${W - 2 * m}' height='${H - 2 * m}' rx='16' fill='none' stroke='#ffd36b' stroke-opacity='.7' stroke-width='1.6'/>${marks}</svg>`;
    board.appendChild(el);
    const rn = Array.from(el.querySelectorAll('.rn'));
    const update = () => {
      const run = BR.Run;
      if (!run || !run.el || !run.el.classList.contains('rushing')) { runeFrame(false); return; }
      const lit = clamp(Math.ceil(run.engine.rush.left), 0, 8);
      rn.forEach((g, i) => g.classList.toggle('on', i >= 8 - lit));
    };
    update();
    runeTimer = setInterval(update, 200);
  }
  /** Stage-up: every sigil flashes in a ripple from the centre (opacity and a small swell on .stud, every third brick, plus one ring). */
  function sigilRipple(d, type, ctx) {
    const bricks = [];
    if (type === 'demo') {
      const host = skinHost(d, type);
      if (host) Array.from(host.querySelectorAll('.brick')).forEach((el, i) => bricks.push({ el, r: (i / 3) | 0, c: i % 3, k: i }));
    } else if (d.run && d.run.view) {
      const keep = new Set(Array.from(document.getElementById('field').children).map((el, i) => (i % 3 === 2 ? el : null)).filter(Boolean));
      d.run.view.bricks.forEach((rec) => { if (keep.has(rec.el)) bricks.push({ el: rec.el, r: rec.r, c: rec.c }); });
    }
    const mr = type === 'demo' ? 1 : 3.5, mc = type === 'demo' ? 1 : 3.5;
    bricks.forEach(({ el, r, c }) => {
      if (el.classList.contains('fusebrick')) return;
      const st = el.querySelector('.stud');
      if (!st || !st.animate) return;
      const dist = Math.hypot(r - mr, c - mc), delay = dist * (type === 'demo' ? 70 : 60);
      const base = 'translate(-50%, -50%)';
      st.animate([{ opacity: 1, transform: `${base} scale(1)` }, { opacity: 0.25, transform: `${base} scale(1.5)`, offset: 0.35 }, { opacity: 1, transform: `${base} scale(1)` }], { duration: 320, delay, easing: 'ease-out' });
    });
    const r = boardRect(d, type, ctx || {});
    if (ctx && ctx.fx) ctx.fx.ring(r.left + r.width / 2, r.top + r.height / 2, GOLD, r.width * 0.55, 0.6, 3);
    sfx.bell();
  }

  /* ================================================================== Moonglass */
  const moonUris = {};
  /** The moon behind the board at phase k (1 = a thin crescent, 8 = full), lit from the right. */
  function moonUri(k) {
    k = clamp(Math.round(k), 1, 8);
    if (moonUris[k]) return moonUris[k];
    const f = k / 8, R = 3.4, rx = Math.abs(1 - 2 * f) * R, sweep = f > 0.5 ? 1 : 0;
    const lit = `M4 ${4 - R}A${R} ${R} 0 0 1 4 ${4 + R}A${f1(rx)} ${R} 0 0 ${sweep} 4 ${4 - R}Z`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><defs><radialGradient id='m' cx='.62' cy='.4' r='.7'><stop offset='0' stop-color='#ffffff'/><stop offset='.7' stop-color='#dfe8ff'/><stop offset='1' stop-color='#b9c9f6'/></radialGradient></defs>`
      + `<circle cx='4' cy='4' r='${R}' fill='#8ea3dc' fill-opacity='.1'/><circle cx='4' cy='4' r='${R}' fill='none' stroke='#cfdcff' stroke-opacity='.25' stroke-width='.05'/><path d='${lit}' fill='url(#m)'/></svg>`;
    return (moonUris[k] = svgUri(svg));
  }
  const SILVER = '#e8f0ff';
  const setMoon = (stage) => { const f = document.getElementById('field'); if (f) f.style.setProperty('--mg-moon', moonUri(stage)); };
  /** js/view.js writes --r and --c when it places a brick, but a brick that falls or refills keeps the row it was placed in, so while the
      Rush moon is up this keeps every pane's slice on its real row and column (cheap: 64 comparisons a frame, only during Rush). */
  let mgRaf = 0;
  function mgSync() {
    const run = BR.Run, v = run && run.view;
    if (!v) return;
    v.bricks.forEach((rec) => {
      if (rec._s4r !== rec.r) { rec._s4r = rec.r; rec.el.style.setProperty('--r', rec.r); }
      if (rec._s4c !== rec.c) { rec._s4c = rec.c; rec.el.style.setProperty('--c', rec.c); }
    });
  }
  function mgLoop() {
    mgRaf = 0;
    const run = BR.Run;
    if (!run || !run.el || !run.el.classList.contains('rushing') || !Skins.moments.moonglass) return;
    mgSync();
    mgRaf = requestAnimationFrame(mgLoop);
  }
  const mgStart = () => { mgSync(); if (!mgRaf) mgRaf = requestAnimationFrame(mgLoop); };
  /** Every pop: the pane shatters into glass shards in its colour and dark slivers of lead; a spot of moonlight shines where it was. */
  function moonPop(type, d, ctx) {
    const { fx, cells, n } = ctx;
    if (!cells || !cells.length) return;
    const B = budget(), ci = colorsOf(type, d, ctx), c0 = centroid(cells), k = cells.length, sh = k <= 6 ? 3 : 2, sl = k <= 6 ? 2 : 1;
    cells.forEach((q, i) => {
      const p = BR.PALETTE[ci[i] % 7];
      for (let j = 0; j < sh; j++) if (B()) fx.emit({ shape: 'tri', x: q.x, y: q.y, vx: rnd(-240, 240), vy: rnd(-280, 40), g: 1250, drag: 0.8, rot: rnd(0, 6.28), vr: rnd(-12, 12), size: rnd(4, 7.5), max: rnd(0.34, 0.5), color: j % 2 ? p.hi : p.glow });
      for (let j = 0; j < sl; j++) if (i % 2 === 0 || k <= 6) if (B()) fx.emit({ shape: 'rect', x: q.x, y: q.y, vx: rnd(-200, 200), vy: rnd(-240, 40), g: 1300, drag: 0.7, rot: rnd(0, 6.28), vr: rnd(-10, 10), size: 2.6, spread: 6, max: rnd(0.34, 0.46), color: '#262838' });
      if (B()) fx.emit({ kind: 'spark', x: q.x, y: q.y, vx: 0, vy: -8, g: 0, drag: 1, size: 15, max: 0.4, color: '#dfe9ff' });
    });
    if (n >= 8) moonShaft(type, d, ctx, c0, B);
  }
  /** Big pop: a shaft of moonlight falls on the group's place from the top of the board, with silver motes. */
  function moonShaft(type, d, ctx, c0, B) {
    const r = boardRect(d, type, ctx), top = r.top + 2, len = Math.max(60, c0.y - top + 30), w = clamp(ctx.view ? ctx.view.cell * 2.2 : 80, 60, 130);
    sprite('s4-shaft', c0.x, top + len / 2, w, len, [
      { transform: tf(0, -10, 1, 0, 0.6), opacity: 0 }, { transform: tf(0, 0, 1, 0, 1), opacity: 0.9, offset: 0.3 }, { transform: tf(0, 6, 1, 0, 1), opacity: 0.7, offset: 0.65 }, { transform: tf(0, 10, 1, 0, 1), opacity: 0 }], { duration: 540, easing: 'ease-out' });
    for (let j = 0; j < 8; j++) if (B()) later(() => ctx.fx.emit({ kind: 'spark', x: c0.x + rnd(-w / 2, w / 2), y: top + rnd(0, len), vx: rnd(-14, 14), vy: rnd(20, 70), g: 0, drag: 0.6, size: rnd(2, 3.4), max: rnd(0.26, 0.34), color: SILVER }), 40 + j * 16);
    sfx.moon();
  }
  /** Line Blast: light streams through the line, as if a window had been opened. */
  function moonLine(type, d, ctx) {
    const v = d.view, p = d.res && d.res.plan, board = document.getElementById('board');
    if (!v || !p || !board) return;
    const rc = v.pagePoint(0, 0), cell = v.cell, bw = board.clientWidth, bh = board.clientHeight, br = board.getBoundingClientRect();
    if (p.lineH) { const y = rc.y + p.r * cell - br.top; sprite('s4-stream', bw / 2, y, bw, cell * 1.1, [{ transform: 'scaleX(0.2)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1, offset: 0.3 }, { transform: 'scaleX(1.02)', opacity: 0 }], { duration: 470, easing: 'ease-out' }, null, board); }
    if (p.lineV) { const x = rc.x + p.c * cell - br.left; sprite('s4-stream v', x, bh / 2, cell * 1.1, bh, [{ transform: 'scaleY(0.2)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1, offset: 0.3 }, { transform: 'scaleY(1.02)', opacity: 0 }], { duration: 470, easing: 'ease-out' }, null, board); }
    sfx.moon();
  }
  /** Rush start: the moon comes up behind the window (CSS), a ring of moonlight spreads and silver motes drift up. */
  function moonRush(d, ctx) {
    const r = boardRect(d, 'rush', ctx), fx = ctx.fx, B = budget(14);
    fx.ring(r.left + r.width / 2, r.top + r.height / 2, SILVER, r.width * 0.5, 0.7, 4);
    for (let j = 0; j < 14; j++) if (B()) later(() => fx.emit({ kind: 'spark', x: r.left + rnd(0.1, 0.9) * r.width, y: r.top + rnd(0.5, 1) * r.height, vx: rnd(-10, 10), vy: rnd(-90, -40), g: 0, drag: 0.5, size: rnd(2, 3.6), max: rnd(0.4, 0.55), color: SILVER }), j * 20);
    sfx.moon();
  }

  /* ================================================================== the events */
  Skins.handlers.push((type, d, ctx) => {
    if (still()) return;
    if (type === 'pop' || type === 'demo') {
      if (type === 'demo') ensure(keyOf(d.item && d.item.cls));
      if (active('potion', type, d, ctx)) potionPop(type, d, ctx);
      if (active('gem', type, d, ctx)) gemPop(type, d, ctx);
      if (active('hourglass', type, d, ctx)) sandPop(type, d, ctx);
      if (active('sigil', type, d, ctx)) sigilPop(type, d, ctx);
      if (active('moonglass', type, d, ctx)) moonPop(type, d, ctx);
      if (type === 'demo') demoShowpiece(d, ctx);
    } else if (type === 'line') {
      if (ctx.M.potion) potionLine(type, d, ctx);
      if (ctx.M.gem) gemLine(type, d, ctx);
      if (ctx.M.hourglass) sandLine(type, d, ctx);
      if (ctx.M.sigil) sigilLine(type, d, ctx);
      if (ctx.M.moonglass) moonLine(type, d, ctx);
    } else if (type === 'rushStart') {
      if (ctx.M.gem) gemRush(d, ctx);
      if (ctx.M.hourglass) sandRush(d, ctx);
      if (ctx.M.sigil) runeFrame(true, d);
      if (ctx.M.moonglass) { mgStart(); moonRush(d, ctx); }
    } else if (type === 'rushEnd') {
      if (ctx.M.hourglass) sandThaw(d, ctx);
      runeFrame(false);
    } else if (type === 'stageUp') {
      if (ctx.M.potion) potionStage(d, 'stage');
      if (ctx.M.gem) gemStage(d, ctx);
      if (ctx.M.hourglass) sandFlip(d, 'stage');
      if (ctx.M.sigil) sigilRipple(d, 'stage', ctx);
      if (ctx.M.moonglass) { setMoon(d.info ? d.info.to : 1); sfx.moon(); ctx.fx.ring(innerWidth / 2, innerHeight * 0.5, SILVER, 140, 0.6, 3); }
    }
  });

  /** The reveal and the item sheet play each skin's showpiece too, every few loops: a stage-up turn, a Rush look. */
  const demoCount = new WeakMap();
  function demoShowpiece(d, ctx) {
    const host = skinHost(d, 'demo');
    if (!host) return;
    const k = (demoCount.get(host) || 0) + 1;
    demoCount.set(host, k);
    const key = d.item && d.item.moment;
    if (k % 3 !== 0) return;
    if (key === 'potion') potionStage(d, 'demo');
    else if (key === 'hourglass') sandFlip(d, 'demo');
    else if (key === 'sigil') sigilRipple(d, 'demo', ctx);
    else if (key === 'gem') gemStage(d, ctx);
    else if (key === 'moonglass') { host.classList.add('mg-demo'); mgDemo(host); setTimeout(() => host.classList.remove('mg-demo'), 1100); }
  }
  /** The demo board is 3 x 3: each brick gets its row and column so the moon window works there too. */
  function mgDemo(host) { Array.from(host.querySelectorAll('.brick')).forEach((el, i) => { el.style.setProperty('--r', (i / 3) | 0); el.style.setProperty('--c', i % 3); }); }

  /* ================================================================== hooks */
  /** Runs at the end of every Skins.apply(): bake the equipped skin's art, set what its moments need, and clean up after the one it replaced. */
  Skins.applyHooks.push((M) => {
    const sk = BR.Progress && BR.Progress.equipped ? BR.Progress.equipped('skin') : null;
    const key = sk && sk.item ? keyOf(sk.item.cls) : '';
    ensure(key);
    const field = document.getElementById('field');
    if (key === 'moonglass') {
      const st = BR.Run && BR.Run.engine ? BR.Run.engine.stage : 1;
      setMoon(st);
      Skins.beam = SILVER;   // the Line Blast beam turns silver
      if (BR.Run && BR.Run.el && BR.Run.el.classList.contains('rushing')) mgStart();
    } else if (field) field.style.removeProperty('--mg-moon');
    if (key !== 'sigil') runeFrame(false);
    else if (BR.Run && BR.Run.el && BR.Run.el.classList.contains('rushing') && !runeTimer) runeFrame(true);
    if (key !== 'potion' && field) field.classList.remove('s4-corks');
    if (key !== 'hourglass') document.querySelectorAll('.hg-turn').forEach((el) => el.classList.remove('hg-turn'));
  });
  /* a new run starts at the first moon phase */
  Skins.applyHooks.push(() => { if (BR.Run && BR.Run.engine && Skins.moments.moonglass) setMoon(BR.Run.engine.stage); });

  /* ================================================================== badges */
  /** A badge is a hero brick in front of two others, all wearing the skin, inside a thin silver rim with the hero colour's sigil in the corner
      (the series mark). The Collection and the reel draw it still; elsewhere the brick keeps its own life. */
  function skinBadge(item, inst, isStill) {
    ensure(keyOf(item.cls));
    const h = item.hero != null ? item.hero : 0, seed = inst ? inst.seed || 0 : 0, shine = inst ? inst.shine : 'plain';
    const b = (c) => Skins.brickHTML(c);
    const mark = `<svg viewBox='-6 -6 112 112'><path d='${sigPath(h, false)}' fill='#e8f0ff' stroke='#e8f0ff' stroke-width='6' stroke-linejoin='round' transform='translate(50 50) scale(${EXT[h]}) translate(-50 -50)'/></svg>`;
    return `<div class="s4b ${item.cls}" data-shine="${shine}" style="--ang:${160 + ((seed % 41) - 20)}deg;--sx:${seed % 97}px">`
      + `<i class="s4b-rim"></i><i class="s4b-back"></i>`
      + `<span class="s4b-k k1">${b((h + 2) % 7)}</span><span class="s4b-k k2">${b((h + 4) % 7)}</span><span class="s4b-k kh">${b(h)}</span>`
      + `<i class="s4b-mark">${mark}</i></div>`;
  }
  /* the badge registry lives in js/badges.js, which loads after this file: register as soon as it exists */
  const registerBadges = () => {
    if (!BR.Badge || !BR.Badge.custom) return false;
    ['f_patchwork', 'f_glowcap', 'f_spellbook', 'f_origami', 'f_potion', 'f_gemcut', 'f_hourglass', 'f_sigil', 'f_moonglass'].forEach((id) => { BR.Badge.custom[id] = skinBadge; });
    return true;
  };
  if (!registerBadges()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registerBadges);
    Skins.applyHooks.push(registerBadges);
  }

  BR.S4Skins = { SIG, sigPath, ensure, bakers: BAKERS, baked, mix, svgUri, castSvg, moonUri, sandFlip, mgSync, badge: skinBadge, registerBadges };
})();
