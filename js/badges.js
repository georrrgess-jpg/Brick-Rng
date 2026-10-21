/* Item badges: one bright, framed icon per item, used everywhere an item is shown (Shop, Collection, the reel,
   the reveal, the Pop Pass). A badge is a square: a rarity-colored backdrop, the item's own art drawn large and
   saturated, and (Epic and up) a gleam that sweeps across it. All motion is transform and opacity. A `still`
   badge has no animation at all, which is what the reel uses so a spin costs the same as a static page. */
(function () {
  const BR = (window.BR = window.BR || {});
  const level = (id) => BR.RARITIES.findIndex((r) => r.id === id);

  /* ---------- Pop art: a burst of the pop's own particles around a bright core ---------- */
  const POP = {
    classic: { shape: 'rect', cols: ['#ffffff', '#ffd36b', '#ff6b9a'] },
    ember: { shape: 'dot', cols: ['#ff9a3d', '#ffcf3f', '#ff5468'] },
    petal: { shape: 'petal', cols: ['#ff8fc0', '#ffd1e6', '#ffffff'] },
    glass: { shape: 'tri', cols: ['#dff7ff', '#9fe8ff', '#ffffff'] },
    pixel: { shape: 'square', cols: ['#7affc9', '#3dffd0', '#ffffff'] },
    lightning: { shape: 'bolt', cols: ['#d6e8ff', '#9fb8ff', '#ffffff'] },
    fireworks: { shape: 'star', cols: ['#ff6b9a', '#ffd36b', '#6bffb2', '#6bb8ff', '#c08bff'] },
    confetti: { shape: 'rect', cols: ['#ff5fa8', '#ffd24a', '#4de1ff', '#6bff9e', '#b36bff'] },
    bubbles: { shape: 'ring', cols: ['#2fa4e0', '#e060b8', '#7a6ae0', '#27b89c'] },
    coins: { shape: 'coin', cols: ['#ffc83d'] },
    leaves: { shape: 'leaf', cols: ['#ff8a3d', '#e8542c', '#ffc83d', '#c4541c'] },
    neon: { shape: 'ring2', cols: ['#3dffd0', '#ff3dc8', '#ffffff'] },
    snow: { shape: 'flake', cols: ['#ffffff', '#bfe8ff'] },
    thunder: { shape: 'bolt', cols: ['#ffffff', '#9fb8ff', '#fff3a0'] },
    ink: { shape: 'blob', cols: ['#a56bff', '#5a2ab8', '#e0c8ff'] },
    supernova: { shape: 'star', cols: ['#fff2a8', '#ffffff', '#ff9ad8'], rings: true },
    dragonfire: { shape: 'flame', cols: ['#ffd24a', '#ff8a1e', '#fff0b0'] },
  };
  const f1 = (n) => +n.toFixed(1);
  const SHAPES = {
    dot: (s, c) => `<circle r="${f1(s * 0.5)}" fill="${c}"/>`,
    square: (s, c) => `<rect x="${f1(-s / 2)}" y="${f1(-s / 2)}" width="${f1(s)}" height="${f1(s)}" fill="${c}"/>`,
    rect: (s, c) => `<rect x="${f1(-s / 2)}" y="${f1(-s / 3)}" width="${f1(s)}" height="${f1(s * 0.66)}" rx="1" fill="${c}"/>`,
    petal: (s, c) => `<ellipse rx="${f1(s * 0.62)}" ry="${f1(s * 0.3)}" fill="${c}"/>`,
    tri: (s, c) => `<path d="M0 ${f1(-s * 0.62)}L${f1(s * 0.5)} ${f1(s * 0.4)}L${f1(-s * 0.5)} ${f1(s * 0.4)}Z" fill="${c}"/>`,
    star: (s, c) => { let d = ''; for (let k = 0; k < 10; k++) { const r = k % 2 ? s * 0.28 : s * 0.7, a = k * 0.6283 - 1.5708; d += (k ? 'L' : 'M') + f1(Math.cos(a) * r) + ' ' + f1(Math.sin(a) * r); } return `<path d="${d}Z" fill="${c}"/>`; },
    ring: (s, c) => `<circle r="${f1(s * 0.5)}" fill="${c}" fill-opacity=".28" stroke="${c}" stroke-width="2.2"/><circle cx="${f1(-s * 0.18)}" cy="${f1(-s * 0.2)}" r="${f1(s * 0.1)}" fill="#fff" fill-opacity=".9"/>`,
    ring2: (s, c) => `<circle r="${f1(s * 0.5)}" fill="none" stroke="${c}" stroke-width="2.4"/>`,
    coin: (s, c) => `<circle r="${f1(s * 0.55)}" fill="${c}" stroke="#a8620a" stroke-width="1.2"/><circle r="${f1(s * 0.36)}" fill="none" stroke="#fff3b0" stroke-width="1.4"/>`,
    leaf: (s, c) => `<path d="M${f1(-s * 0.6)} 0Q0 ${f1(-s * 0.7)} ${f1(s * 0.6)} 0Q0 ${f1(s * 0.7)} ${f1(-s * 0.6)} 0Z" fill="${c}"/><path d="M${f1(-s * 0.6)} 0H${f1(s * 0.5)}" stroke="#fff" stroke-opacity=".5" stroke-width="1"/>`,
    flake: (s, c) => `<g stroke="${c}" stroke-width="1.8" stroke-linecap="round"><path d="M0 ${f1(-s * 0.6)}V${f1(s * 0.6)}M${f1(-s * 0.52)} ${f1(-s * 0.3)}L${f1(s * 0.52)} ${f1(s * 0.3)}M${f1(-s * 0.52)} ${f1(s * 0.3)}L${f1(s * 0.52)} ${f1(-s * 0.3)}"/></g>`,
    bolt: (s, c) => `<path d="M${f1(s * 0.15)} ${f1(-s * 0.7)}L${f1(-s * 0.38)} ${f1(s * 0.08)}H${f1(-s * 0.02)}L${f1(-s * 0.2)} ${f1(s * 0.7)}L${f1(s * 0.42)} ${f1(-s * 0.15)}H${f1(s * 0.04)}Z" fill="${c}"/>`,
    blob: (s, c) => `<path d="M0 ${f1(-s * 0.55)}C${f1(s * 0.5)} ${f1(-s * 0.7)} ${f1(s * 0.75)} ${f1(-s * 0.05)} ${f1(s * 0.4)} ${f1(s * 0.3)}C${f1(s * 0.2)} ${f1(s * 0.7)} ${f1(-s * 0.5)} ${f1(s * 0.6)} ${f1(-s * 0.55)} ${f1(s * 0.1)}C${f1(-s * 0.7)} ${f1(-s * 0.4)} ${f1(-s * 0.3)} ${f1(-s * 0.5)} 0 ${f1(-s * 0.55)}Z" fill="${c}"/>`,
    flame: (s, c) => `<path d="M0 ${f1(-s * 0.75)}C${f1(s * 0.2)} ${f1(-s * 0.35)} ${f1(s * 0.6)} ${f1(-s * 0.1)} ${f1(s * 0.4)} ${f1(s * 0.4)}C${f1(s * 0.3)} ${f1(s * 0.7)} ${f1(-s * 0.3)} ${f1(s * 0.7)} ${f1(-s * 0.4)} ${f1(s * 0.4)}C${f1(-s * 0.55)} ${f1(s * 0.05)} ${f1(-s * 0.1)} ${f1(-s * 0.2)} 0 ${f1(-s * 0.75)}Z" fill="${c}"/>`,
  };
  const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rngOf = (seed) => { let a = seed || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /** The art for a pop: two rings of its particles turning slowly in opposite directions around a bright core. */
  function popArt(item) {
    const P = POP[item.recipe] || POP.classic, rnd = rngOf(hash(item.id));
    const ring = (n, r0, sMin, sMax, off) => {
      let out = '';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + off + (rnd() - 0.5) * 0.35, r = r0 + (rnd() - 0.5) * 6, s = sMin + rnd() * (sMax - sMin);
        out += `<g transform="translate(${f1(Math.cos(a) * r)} ${f1(Math.sin(a) * r)}) rotate(${Math.round(a * 57.3 + rnd() * 120)})">${SHAPES[P.shape](s, P.cols[i % P.cols.length])}</g>`;
      }
      return out;
    };
    const rings = P.rings ? `<circle r="30" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"/><circle r="40" fill="none" stroke="${P.cols[2]}" stroke-opacity=".6" stroke-width="1"/>` : '';
    const cloud = item.recipe === 'thunder' ? '<path d="M-26 -22a12 12 0 0 1 22-6a14 14 0 0 1 26 6a9 9 0 0 1-2 18h-40a9 9 0 0 1-6-18z" fill="#5a6a9e" opacity=".9"/>' : '';
    const core = `<circle r="11" fill="${P.cols[0]}" opacity=".35"/><circle r="7" fill="#fff"/><circle r="4" fill="${P.cols[Math.min(1, P.cols.length - 1)]}"/>`;
    // a soft dark disc behind the particles so pale ones still read on a pale Common frame
    const disc = '<circle r="46" fill="#0c0620" opacity=".16"/><circle r="34" fill="#0c0620" opacity=".2"/>';
    return `<svg class="pa" viewBox="-50 -50 100 100" aria-hidden="true">${disc}${rings}${cloud}<g class="pa-r1">${ring(9, 33, 7, 12, 0)}</g><g class="pa-r2">${ring(7, 20, 5, 9, 0.4)}</g><g class="pa-core">${core}</g></svg>`;
  }

  /* ---------- Skin art: a hero brick with two behind it, all wearing the skin ---------- */
  function skinArt(item, inst) {
    const h = item.hero != null ? item.hero : 0, seed = inst ? inst.seed || 0 : 0;
    const shine = inst ? inst.shine : 'plain';
    const b = (c) => BR.Skins.brickHTML(c);
    return `<div class="bdg-bricks ${item.cls || ''}" data-shine="${shine}" style="--ang:${160 + ((seed % 41) - 20)}deg;--sx:${seed % 97}px">
      <span class="bk b2">${b((h + 4) % 7)}</span><span class="bk b1">${b((h + 2) % 7)}</span><span class="bk b3">${b(h)}</span></div>`;
  }
  /* ---------- Board art: the scene with a small framed board of bricks in it ---------- */
  function boardArt(item, inst, still) {
    const shine = inst ? inst.shine : 'plain';
    const cells = [0, 3, 1, 2, 0, 4, 1, 3, 2].map((c) => BR.Skins.brickHTML(c)).join('');
    return `<div class="bdg-scene ${item.cls || ''}" data-ashine="${shine}">${still ? '' : '<b class="scene-fx"></b><b class="scene-fx b"></b>'}<div class="bdg-bgrid">${cells}</div></div>`;
  }
  /* ---------- Fuse art: the lit bomb and fuse on a glow ---------- */
  function fuseArt(item, inst) {
    const shine = inst ? inst.shine : 'plain';
    return `<div class="bdg-fuse" style="--g:${item.glow || '#ffb347'}"><span class="fz-glow"></span><div class="mini-fuse ${item.cls || ''}" data-shine="${shine}"><span class="mf-bomb"></span><span class="mf-track"><i class="mf-fill"></i><b class="mf-spark"></b></span></div></div>`;
  }

  BR.Badge = {
    /**
     * The badge markup. o.size: pixel width (default 72). o.still: no animation. o.locked: dark silhouette with a "?".
     * o.cls: extra classes.
     */
    html(item, inst, o = {}) {
      const R = BR.rarityById[item.rarity], lv = level(item.rarity) + 1;
      const size = o.size || 72;
      let art;
      if (item.type === 'skin') art = skinArt(item, inst);
      else if (item.type === 'pop') art = popArt(item);
      else if (item.type === 'board') art = boardArt(item, inst, o.still || o.locked);
      else art = fuseArt(item, inst);
      const extra = lv >= 4 && !o.still ? '<i class="bdg-rays"></i><i class="bdg-twinkle t1"></i><i class="bdg-twinkle t2"></i><i class="bdg-twinkle t3"></i>' : '';
      const gleam = lv >= 3 ? '<i class="bdg-gleam"></i>' : '';
      const shine = !o.locked && inst && inst.shine && inst.shine !== 'plain' ? inst.shine : '';
      return `<div class="bdg t-${item.type} r${lv} ${o.still ? 'still' : ''} ${o.locked ? 'locked' : ''} ${o.cls || ''}" ${shine ? `data-bshine="${shine}"` : ''} style="--rc:${R.color};--bs:${size}px;--k:${(size / 118 * 0.86).toFixed(3)}">
        <i class="bdg-bg"></i>${extra}<div class="bdg-art">${art}</div>${gleam}${shine ? '<i class="bdg-fin"></i>' : ''}${o.locked ? '<b class="bdg-q">?</b>' : ''}<i class="bdg-edge"></i></div>`;
    },
  };

  /** Everything that used to ask for a small preview now gets a badge. */
  BR.Skins.previewHTML = (item, inst, o = {}) => BR.Badge.html(item, inst, Object.assign({ size: 64 }, o));
})();
