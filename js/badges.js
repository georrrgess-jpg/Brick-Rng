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

  /** The old art for a pop: two rings of its particles turning slowly in opposite directions around a bright core (now the fallback for a recipe with no silhouette of its own). */
  function popArtRings(item) {
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

  /* ---------- Pop art, Update 5: each older pop has its own silhouette (K-3). At 56px the old badge was a ring of dots on every plate, so every pop looked
     alike; now the picture is the pop itself: a starburst, rising embers, a blossom, a shattered pane, a pixel burst, a bolt, a firework, a party popper,
     soap bubbles, a coin stack, leaves, neon rings, a snowflake, a storm cloud, an ink splat, a supernova and a tongue of flame. All are plain SVG in the
     same 100 x 100 box as before (-50..50), drawn with a dark outline so they read on a pale Common plate, with no filter and nothing animated except
     the small `pa-core` pulse. Series 4 pops do not come through here: they register BR.Badge.custom[id] and that wins. */
  const OUTLINE = 'stroke="#2b1650" stroke-width="3.8" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke"';
  const pts = (a) => a.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L');
  const starPts = (n, r1, r2, rot = -90) => Array.from({ length: n * 2 }, (_, i) => { const a = ((rot + (i * 180) / n) * Math.PI) / 180, r = i % 2 ? r2 : r1; return [Math.cos(a) * r, Math.sin(a) * r]; });
  const polar = (deg, r) => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];
  const shape = (d, fill, w = 3.8, extra = '') => `<path d="${d}" fill="${fill}" stroke="#2b1650" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke" ${extra}/>`;
  const rectAt = (x, y, w, h, rot, fill) => `<rect x="${f1(-w / 2)}" y="${f1(-h / 2)}" width="${f1(w)}" height="${f1(h)}" rx="1.2" fill="${fill}" ${OUTLINE} transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)})"/>`;
  const circ = (x, y, r, fill, extra = '') => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${fill}" ${extra}/>`;
  const LEAF = 'M0 -34C15 -24 19 -4 0 30C-19 -4 -15 -24 0 -34Z';
  const BOLT = 'M12 -46L-20 4H-2L-14 46L24 -10H6Z';
  const FLAME = 'M2 -48C8 -32 30 -24 29 3C28 24 14 42 0 46C-16 42 -29 24 -27 3C-26 -9 -15 -14 -12 -28C-6 -22 -3 -34 2 -48Z';
  const POP_ART = {
    classic: () => shape(`M${pts(starPts(8, 45, 19))}Z`, '#ffffff') + shape(`M${pts(starPts(8, 31, 13, -67.5))}Z`, '#ffd36b', 0) + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const p = polar(i * 45 - 22.5, 40); return rectAt(p[0], p[1], 8, 5, i * 45 - 22.5, ['#ff6b9a', '#ffd36b', '#ffffff', '#6bb8ff'][i % 4]); }).join('') + `<g class="pa-core">${circ(0, 0, 10, '#ff6b9a')}${circ(0, 0, 4.6, '#fff')}</g>`,
    ember: () => [[-17, 17, 9], [11, 8, 11], [-5, -12, 8], [19, -27, 7], [-19, -33, 5.6]].map(([x, y, r]) => `<path d="M${f1(x)} ${f1(y + r * 0.8)}L${f1(x + r * 0.35)} ${f1(y + r * 3.2)}" stroke="#ff7a2a" stroke-opacity=".55" stroke-width="${f1(r * 0.8)}" stroke-linecap="round"/>${circ(x, y, r * 2.1, '#ff8a1e', 'fill-opacity=".22"')}${circ(x, y, r, '#ffb03c', 'stroke="#2b1650" stroke-width="2.6"')}${circ(x - r * 0.12, y - r * 0.12, r * 0.55, '#fff3c0')}`).join(''),
    petal: () => [0, 1, 2, 3, 4].map((i) => `<g transform="rotate(${i * 72})">${shape('M0 -4C-15 -12 -17 -33 -4 -43L0 -38L4 -43C17 -33 15 -12 0 -4Z', i % 2 ? '#ffb3d4' : '#ff8fc0')}<path d="M0 -10L0 -32" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/></g>`).join('') + `<g class="pa-core">${circ(0, 0, 9, '#ffe27a', 'stroke="#2b1650" stroke-width="2.4"')}${circ(0, 0, 3.6, '#fff')}</g>`,
    glass: () => [[-8, 44, 9, 7], [48, 33, 8, 10], [112, 47, 10, 8], [176, 30, 7, 11], [236, 43, 9, 9], [298, 35, 8, 10]].map(([a, r, w1, w2], i) => { const P = [polar(a - w1, 8), polar(a - w1 * 0.3, r), polar(a + w2 * 0.9, r * 0.74), polar(a + w2 * 1.5, 9)]; return shape(`M${pts(P)}Z`, ['#e8fbff', '#9fe8ff', '#cdf3ff'][i % 3]) + `<path d="M${pts([P[0], P[1]])}" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`; }).join('') + [[-6, -38, 5], [30, 8, 4.4], [-34, 20, 4.8]].map(([x, y, r], i) => shape(`M${pts([[x, y - r], [x + r * 0.9, y + r * 0.7], [x - r, y + r * 0.5]])}Z`, '#cdf3ff', 2.6, `transform="rotate(${i * 50} ${x} ${y})"`)).join('') + `<g class="pa-core"><path d="M0 -13L3 -3L13 0L3 3L0 13L-3 3L-13 0L-3 -3Z" fill="#fff"/></g>`,
    pixel: () => { const C = 9, cells = [[0, 0, 'w'], [1, 0, 'a'], [-1, 0, 'a'], [0, 1, 'a'], [0, -1, 'a'], [2, 0, 'b'], [-2, 0, 'b'], [0, 2, 'b'], [0, -2, 'b'], [1, 1, 'b'], [-1, 1, 'b'], [1, -1, 'b'], [-1, -1, 'b'], [3, 1, 'c'], [-3, -1, 'c'], [1, -3, 'c'], [-1, 3, 'c'], [3, -2, 'w'], [-3, 2, 'w'], [2, 3, 'a'], [-2, -3, 'a']], fillOf = { w: '#ffffff', a: '#3dffd0', b: '#7affc9', c: '#1fcf9c' };
      return cells.map(([x, y, k]) => `<rect x="${x * C - 4.6}" y="${y * C - 4.6}" width="9.2" height="9.2" fill="#2b1650" stroke="#2b1650" stroke-width="2.4"/>`).join('') + cells.map(([x, y, k]) => `<rect x="${x * C - 4}" y="${y * C - 4}" width="8" height="8" fill="${fillOf[k]}"/>`).join(''); },
    lightning: () => shape(BOLT, '#dbe9ff') + `<path d="M12 -34L-9 4H4L-6 30" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-opacity=".9"/><g class="pa-core">${shape('M-30 -22L-38 -10H-33L-37 0L-28 -12H-33Z', '#9fb8ff', 2.6)}${shape('M34 14L26 26H31L27 36L36 24H31Z', '#9fb8ff', 2.6)}</g>`,
    fireworks: () => { const R = ['#ff6b9a', '#ffd36b', '#6bffb2', '#6bb8ff', '#c08bff', '#ff9a3d']; return Array.from({ length: 12 }, (_, i) => { const a = i * 30, p0 = polar(a, 13), p1 = polar(a, i % 2 ? 30 : 38), pd = polar(a, i % 2 ? 36 : 44); return `<path d="M${pts([p0, p1])}" stroke="#2b1650" stroke-width="6" stroke-linecap="round"/><path d="M${pts([p0, p1])}" stroke="${R[i % 6]}" stroke-width="3" stroke-linecap="round"/>${circ(pd[0], pd[1], 4.3, R[(i + 3) % 6], 'stroke="#2b1650" stroke-width="2"')}`; }).join('') + `<g class="pa-core">${shape(`M${pts(starPts(5, 13, 6))}Z`, '#ffffff')}</g>`; },
    confetti: () => shape('M-46 46L-22 -6L8 24Z', '#ffd24a') + `<path d="M-37 30L-14 12M-30 40L-6 20" stroke="#ff5fa8" stroke-width="3.4" stroke-linecap="round"/><ellipse cx="-7" cy="8" rx="19" ry="7" transform="rotate(45 -7 8)" fill="#ff5fa8" ${OUTLINE}/>` + `<path d="M-2 0C10 -12 6 -26 20 -32S34 -22 42 -40" fill="none" stroke="#2b1650" stroke-width="7" stroke-linecap="round"/><path d="M-2 0C10 -12 6 -26 20 -32S34 -22 42 -40" fill="none" stroke="#4de1ff" stroke-width="3.4" stroke-linecap="round"/>` + [[14, -6, 11, 7, 30, '#ff5fa8'], [30, -10, 9, 6, -40, '#ffd24a'], [8, -34, 10, 6, 70, '#6bff9e'], [36, 8, 10, 6, 20, '#b36bff'], [26, -34, 9, 6, -20, '#ffffff'], [40, -22, 9, 6, 50, '#ff9a3d']].map(([x, y, w, h, r, c]) => rectAt(x, y, w, h, r, c)).join('') + circ(24, 14, 3.6, '#4de1ff', 'stroke="#2b1650" stroke-width="2"') + circ(-6, -22, 3.6, '#ffd24a', 'stroke="#2b1650" stroke-width="2"'),
    bubbles: () => [[-12, 10, 25], [22, -16, 16], [24, 26, 10], [-28, -26, 8.5]].map(([x, y, r], i) => `${circ(x, y, r, '#7fd8ff', 'fill-opacity=".34" stroke="#2b1650" stroke-width="6"')}${circ(x, y, r, 'none', `stroke="${['#e060b8', '#27b89c', '#7a6ae0', '#2fa4e0'][i]}" stroke-width="2.8"`)}<path d="M${f1(x - r * 0.62)} ${f1(y - r * 0.1)}A${f1(r * 0.64)} ${f1(r * 0.64)} 0 0 1 ${f1(x - r * 0.1)} ${f1(y - r * 0.62)}" fill="none" stroke="#fff" stroke-width="${f1(Math.max(2, r * 0.13))}" stroke-linecap="round"/>${circ(x + r * 0.42, y + r * 0.46, Math.max(1.4, r * 0.1), '#fff')}`).join(''),
    coins: () => circ(-18, 16, 21, '#e8920c', 'stroke="#2b1650" stroke-width="3.6"') + circ(30, 24, 12.5, '#e8920c', 'stroke="#2b1650" stroke-width="3.6"') + circ(6, -4, 27, '#ffc83d', 'stroke="#2b1650" stroke-width="3.8"') + circ(6, -4, 19, 'none', 'stroke="#fff3b0" stroke-width="3"') + `<g class="pa-core">${shape(`M${pts(starPts(5, 13, 5.6).map((p) => [p[0] + 6, p[1] - 4]))}Z`, '#fff3b0', 2.4)}</g>` + `<path d="M-24 6A21 21 0 0 1 -12 -2" fill="none" stroke="#fff3b0" stroke-width="2.6" stroke-linecap="round" transform="translate(0 6)"/>` + circ(30, 24, 6, 'none', 'stroke="#fff3b0" stroke-width="2"'),
    leaves: () => [[-17, -6, -42, '#e8542c'], [18, 2, 38, '#ffc83d'], [0, 18, 94, '#ff8a3d']].map(([x, y, r, c]) => `<g transform="translate(${x} ${y}) rotate(${r})">${shape(LEAF, c)}<path d="M0 -28L0 34M0 -12L-9 -20M0 2L9 -8M0 -2L-10 -12M0 12L8 4" fill="none" stroke="#7a2a0a" stroke-opacity=".75" stroke-width="1.8" stroke-linecap="round"/></g>`).join(''),
    neon: () => [[40, '#3dffd0'], [27, '#ff3dc8'], [14, '#ffffff']].map(([r, c]) => circ(0, 0, r, 'none', `stroke="#2b1650" stroke-width="8"`) + circ(0, 0, r, 'none', `stroke="${c}" stroke-opacity=".35" stroke-width="7"`) + circ(0, 0, r, 'none', `stroke="${c}" stroke-width="3.2"`)).join('') + `<path d="M-46 0H-16M16 0H46M0 -46V-16M0 16V46" stroke="#2b1650" stroke-width="6" stroke-linecap="round"/><path d="M-46 0H-16M16 0H46M0 -46V-16M0 16V46" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><g class="pa-core">${circ(0, 0, 5, '#ffffff')}</g>`,
    snow: () => { const arm = (deg) => `<g transform="rotate(${deg})"><path d="M0 0V-42M0 -17L-10 -28M0 -17L10 -28M0 -30L-8 -39M0 -30L8 -39" stroke="#2b1650" stroke-width="8.6" stroke-linecap="round" fill="none"/></g>`, arm2 = (deg) => `<g transform="rotate(${deg})"><path d="M0 0V-42M0 -17L-10 -28M0 -17L10 -28M0 -30L-8 -39M0 -30L8 -39" stroke="#ffffff" stroke-width="3.8" stroke-linecap="round" fill="none"/></g>`, ds = [0, 60, 120, 180, 240, 300];
      return ds.map(arm).join('') + circ(0, 0, 10, '#2b1650') + ds.map(arm2).join('') + `<path d="M${pts(starPts(6, 9, 9, 0))}Z" fill="#bfe8ff" stroke="#fff" stroke-width="2"/>` + `<g class="pa-core">${circ(0, 0, 3.2, '#fff')}</g>`; },
    thunder: () => shape('M-34 -4A13 13 0 0 1 -26 -28A16 16 0 0 1 2 -36A15 15 0 0 1 30 -22A11 11 0 0 1 34 -4Z', '#5a6a9e') + `<path d="M-24 -10A9 9 0 0 1 -18 -22" fill="none" stroke="#9fb0e6" stroke-width="3" stroke-linecap="round"/>` + shape('M6 -6L-14 22H-1L-9 48L18 14H4Z', '#ffe65a') + `<path d="M4 4L-6 20" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-opacity=".9"/><g class="pa-core">${shape('M-30 14L-34 22H-31L-33 28L-27 20H-30Z', '#fff3a0', 2.4)}${shape('M32 10L28 18H31L29 24L35 16H32Z', '#fff3a0', 2.4)}</g>`,
    ink: () => shape('M2 -38C10 -34 14 -28 22 -32C28 -26 26 -18 34 -14C42 -10 36 -2 40 6C44 14 34 18 30 24C26 32 18 28 12 34C6 42 2 34 -4 36C-12 40 -16 32 -22 30C-32 28 -28 20 -34 14C-42 8 -34 0 -34 -6C-34 -14 -26 -16 -24 -24C-20 -32 -10 -28 -6 -34C-4 -40 -2 -40 2 -38Z', '#7a3df0') + shape('M2 -22C12 -18 20 -14 22 -4C24 8 16 18 4 20C-8 20 -18 12 -18 0C-18 -12 -8 -20 2 -22Z', '#4a1fb0', 0) + `<ellipse cx="-11" cy="-12" rx="8" ry="4.2" transform="rotate(-35 -11 -12)" fill="#e0c8ff"/>` + [[-42, -32, 4.8], [43, -34, 3.8], [-34, 40, 4.4], [16, -46, 3.2], [46, 24, 4.2], [-46, 8, 3.2]].map(([x, y, r]) => circ(x, y, r, '#7a3df0', 'stroke="#2b1650" stroke-width="2.6"')).join('') + circ(-3, 4, 3.4, '#b58aff'),
    supernova: () => circ(0, 0, 38, 'none', 'stroke="#2b1650" stroke-width="6"') + circ(0, 0, 38, 'none', 'stroke="#fff2a8" stroke-opacity=".85" stroke-width="2" stroke-dasharray="4 4"') + circ(0, 0, 26, '#ff9ad8', 'fill-opacity=".28"') + shape('M0 -47L7 -7L47 0L7 7L0 47L-7 7L-47 0L-7 -7Z', '#fff2a8') + shape('M0 -26L4 -4L26 0L4 4L0 26L-4 4L-26 0L-4 -4Z', '#ffffff', 'transform="rotate(45)" stroke-width="0"') + `<g class="pa-core">${circ(0, 0, 8, '#ffffff')}</g>` + [[-34, -34], [36, -30], [-30, 36]].map(([x, y]) => `<path d="M${x} ${y - 7}L${x + 2} ${y - 2}L${x + 7} ${y}L${x + 2} ${y + 2}L${x} ${y + 7}L${x - 2} ${y + 2}L${x - 7} ${y}L${x - 2} ${y - 2}Z" fill="#ff9ad8" ${OUTLINE} stroke-width="2.6"/>`).join(''),
    dragonfire: () => shape(FLAME, '#ff8a1e') + shape('M2 -30C6 -20 20 -14 19 4C18 18 9 30 0 33C-10 30 -18 18 -17 4C-16 -4 -9 -8 -7 -18C-3 -14 0 -22 2 -30Z', '#ffd24a', 0) + `<g class="pa-core">${shape('M1 -12C3 -6 11 -2 10 8C9 16 5 21 0 23C-6 21 -10 16 -9 8C-8 3 -4 1 -3 -5C0 -3 0 -7 1 -12Z', '#fff0b0', 0)}</g>`,
  };
  /** The art for a pop: its own silhouette (POP_ART), or, for a recipe without one, the old ring of its particles around a bright core. */
  function popArt(item) {
    const own = POP_ART[item.recipe];
    if (own) return `<svg class="pa pa-own" viewBox="-50 -50 100 100" aria-hidden="true"><circle r="47" fill="#0c0620" opacity=".16"/>${own()}</svg>`;
    return popArtRings(item);
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
    // Update 5 (K-4): the board's own scene is the picture, and the small framed board sits in the open middle of it (the older boards' scenes keep their
    // art in the top and bottom bands, see css/u4-boards.css), so no two board badges are the same picture. Series 4 boards keep their own layout.
    const older = !item.series || item.series <= 3;
    return `<div class="bdg-scene ${item.cls || ''}" data-ashine="${shine}">${still ? '' : '<b class="scene-fx"></b><b class="scene-fx b"></b>'}<div class="bdg-bgrid${older ? ' u5' : ''}">${cells}</div></div>`;
  }
  /* ---------- Fuse art: the lit bomb and fuse on a glow ---------- */
  function fuseArt(item, inst) {
    const shine = inst ? inst.shine : 'plain';
    return `<div class="bdg-fuse" style="--g:${item.glow || '#ffb347'}"><span class="fz-glow"></span><div class="mini-fuse ${item.cls || ''}" data-shine="${shine}"><span class="mf-bomb"></span><span class="mf-track"><i class="mf-fill"></i><b class="mf-spark"></b></span></div></div>`;
  }

  BR.Badge = {
    custom: {},
    /**
     * The badge markup. o.size: pixel width (default 72). o.still: no animation. o.locked: dark silhouette with a "?".
     * o.cls: extra classes.
     */
    html(item, inst, o = {}) {
      const R = BR.rarityById[item.rarity], lv = level(item.rarity) + 1;
      const size = o.size || 72;
      let art;
      // Series 4 items draw their own badge art: BR.Badge.custom[id] = (item, inst, still) => markup for the .bdg-art box
      const own = BR.Badge.custom[item.id];
      if (own) art = own(item, inst, !!(o.still || o.locked));
      else if (item.type === 'skin') art = skinArt(item, inst);
      else if (item.type === 'pop') art = popArt(item);
      else if (item.type === 'board') art = boardArt(item, inst, o.still || o.locked);
      else art = fuseArt(item, inst);
      const extra = lv >= 4 && !o.still ? '<i class="bdg-rays"></i><i class="bdg-twinkle t1"></i><i class="bdg-twinkle t2"></i><i class="bdg-twinkle t3"></i>' : '';
      const gleam = lv >= 3 ? '<i class="bdg-gleam"></i>' : '';
      const shine = !o.locked && inst && inst.shine && inst.shine !== 'plain' ? inst.shine : '';
      const s4 = item.series === 4 && !o.locked ? (size < 52 ? 's4 s4m' : 's4') : '';   // a Moonwick item: a silver inner rim and a crescent in the corner
      return `<div class="bdg t-${item.type} r${lv} ${o.still ? 'still' : ''} ${o.locked ? 'locked' : ''} ${s4} ${o.cls || ''}" ${shine ? `data-bshine="${shine}"` : ''} style="--rc:${R.color};--bs:${size}px;--k:${(size / 118 * 0.86).toFixed(3)}">
        <i class="bdg-bg"></i>${extra}<div class="bdg-art">${art}</div>${gleam}${shine ? '<i class="bdg-fin"></i>' : ''}${o.locked ? '<b class="bdg-q">?</b>' : ''}<i class="bdg-edge"></i></div>`;
    },
  };

  /** Everything that used to ask for a small preview now gets a badge. */
  BR.Skins.previewHTML = (item, inst, o = {}) => BR.Badge.html(item, inst, Object.assign({ size: 64 }, o));
})();
