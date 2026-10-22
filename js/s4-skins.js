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

  /* ================================================================== registration */
  Skins.applyHooks.push(() => {
    const sk = BR.Progress && BR.Progress.equipped ? BR.Progress.equipped('skin') : null;
    if (sk && sk.item) ensure(keyOf(sk.item.cls));
  });

  BR.S4Skins ={ SIG, sigPath, ensure, bakers: BAKERS, baked, mix, svgUri };
})();
