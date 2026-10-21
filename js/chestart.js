/* Chest artwork (inline SVG). Parts carry classes the opening rituals animate:
   .c-lid .c-piece .c-glow .c-spark .c-needle .c-frost .c-cracks .c-half */
(function () {
  const BR = (window.BR = window.BR || {});

  const shadow = '<ellipse class="c-shadow" cx="100" cy="168" rx="70" ry="9" fill="#000" opacity=".4"/>';

  function brick() {
    // body: 3 rows of bricks, staggered, each its own piece so the ritual can scatter them
    const pieces = [];
    const cols = ['#ff7a59', '#ff6a4d', '#f2563f', '#ff8d6b'];
    for (let r = 0; r < 3; r++) {
      const off = r % 2 ? 16 : 0;
      for (let c = 0; c < 5; c++) {
        const x = 36 + c * 32 - off, w = 32;
        const x0 = Math.max(36, x), x1 = Math.min(164, x + w);
        if (x1 - x0 < 6) continue;
        const col = cols[(r * 5 + c) % cols.length];
        pieces.push(`<g class="c-piece"><rect x="${x0 + 1}" y="${96 + r * 24}" width="${x1 - x0 - 2}" height="22" rx="5" fill="${col}"/><rect x="${x0 + 1}" y="${96 + r * 24}" width="${x1 - x0 - 2}" height="8" rx="4" fill="#fff" opacity=".22"/><rect x="${x0 + 1}" y="${96 + r * 24 + 16}" width="${x1 - x0 - 2}" height="6" rx="3" fill="#7a1d1d" opacity=".28"/></g>`);
      }
    }
    const studs = [0, 1, 2, 3, 4].map((i) => `<g class="c-piece"><ellipse cx="${52 + i * 24}" cy="58" rx="10" ry="6" fill="${['#ffc83d', '#ff3d8b', '#3de1ff', '#3ddc97', '#8a4dff'][i]}"/><rect x="${42 + i * 24}" y="50" width="20" height="9" rx="4" fill="${['#ffc83d', '#ff3d8b', '#3de1ff', '#3ddc97', '#8a4dff'][i]}"/><ellipse cx="${52 + i * 24}" cy="50" rx="10" ry="5.5" fill="#fff" opacity=".35"/></g>`).join('');
    return `<svg class="chest-svg chest-brick" viewBox="0 0 200 180" aria-hidden="true"><defs>
      <linearGradient id="cbLid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9c7a"/><stop offset="1" stop-color="#e5483a"/></linearGradient>
      <radialGradient id="cbGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#ffe29a"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs>
      ${shadow}
      <ellipse class="c-glow" cx="100" cy="92" rx="62" ry="22" fill="url(#cbGlow)" opacity="0"/>
      <g class="c-body"><rect x="34" y="94" width="132" height="74" rx="10" fill="#9c2a2a"/>${pieces.join('')}</g>
      <g class="c-lid"><rect x="30" y="62" width="140" height="34" rx="10" fill="url(#cbLid)"/><rect x="30" y="62" width="140" height="12" rx="8" fill="#fff" opacity=".25"/>${studs}
        <rect x="88" y="78" width="24" height="26" rx="6" fill="#ffd24a" stroke="#a8620a" stroke-width="2"/><circle cx="100" cy="90" r="4" fill="#5b3300"/></g>
    </svg>`;
  }

  function pop() {
    const stars = [[70, 118], [100, 132], [130, 112], [84, 146], [118, 148]].map(([x, y]) => `<path d="M${x} ${y - 5}l1.6 3.4 3.7.5-2.7 2.5.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.5 3.7-.5z" fill="#fff" opacity=".9"/>`);
    return `<svg class="chest-svg chest-pop" viewBox="0 0 200 180" aria-hidden="true"><defs>
      <linearGradient id="cpBody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c81f6e"/><stop offset=".4" stop-color="#ff4d9a"/><stop offset="1" stop-color="#a3175c"/></linearGradient>
      <linearGradient id="cpCap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe58a"/><stop offset="1" stop-color="#e0961a"/></linearGradient>
      <radialGradient id="cpGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#ffb3d9"/><stop offset="1" stop-color="#ff3d8b" stop-opacity="0"/></radialGradient></defs>
      ${shadow}
      <ellipse class="c-glow" cx="100" cy="76" rx="52" ry="20" fill="url(#cpGlow)" opacity="0"/>
      <g class="c-body">
        <g class="c-half c-left"><path d="M44 78 V148 Q44 164 100 164 V78 Z" fill="url(#cpBody)"/>${stars.slice(0, 2).join('')}</g>
        <g class="c-half c-right"><path d="M156 78 V148 Q156 164 100 164 V78 Z" fill="url(#cpBody)" transform="translate(0 0)"/>${stars.slice(2).join('')}</g>
        <path d="M44 100h112M44 126h112" stroke="#fff" stroke-width="5" opacity=".55"/>
        <ellipse cx="100" cy="150" rx="56" ry="14" fill="none" stroke="url(#cpCap)" stroke-width="6" opacity="0" />
      </g>
      <g class="c-lid"><ellipse cx="100" cy="78" rx="58" ry="17" fill="url(#cpCap)" stroke="#a8620a" stroke-width="2"/><ellipse cx="100" cy="74" rx="46" ry="11" fill="#fff" opacity=".28"/>
        <path class="c-fusewire" d="M100 72 C 98 56 112 50 108 36 C 106 28 114 24 120 22" fill="none" stroke="#6b4a1e" stroke-width="4" stroke-linecap="round"/>
        <circle class="c-spark" cx="120" cy="22" r="6" fill="#ffd24a"/><circle class="c-spark2" cx="120" cy="22" r="10" fill="#ff9a3d" opacity=".35"/></g>
    </svg>`;
  }

  function board() {
    const tiles = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${78 + (i % 3) * 15}" y="${86 + Math.floor(i / 3) * 15}" width="12" height="12" rx="3" fill="${['#ff5468', '#4a8dff', '#34d98a', '#ffcf3f', '#b36bff', '#ff8a3d', '#25d0f0', '#ff5468', '#4a8dff'][i]}"/>`).join('');
    return `<svg class="chest-svg chest-board" viewBox="0 0 200 180" aria-hidden="true"><defs>
      <linearGradient id="cdBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4aa8ff"/><stop offset="1" stop-color="#1d4fb8"/></linearGradient>
      <linearGradient id="cdGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".5" stop-color="#ffc83d"/><stop offset="1" stop-color="#c47a10"/></linearGradient>
      <linearGradient id="cdGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8f6ff" stop-opacity=".75"/><stop offset=".5" stop-color="#7ac8ff" stop-opacity=".35"/><stop offset="1" stop-color="#4a8dff" stop-opacity=".5"/></linearGradient>
      <radialGradient id="cdGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#9fe8ff"/><stop offset="1" stop-color="#4aa8ff" stop-opacity="0"/></radialGradient></defs>
      ${shadow}
      <ellipse class="c-glow" cx="100" cy="96" rx="64" ry="24" fill="url(#cdGlow)" opacity="0"/>
      <g class="c-body"><rect x="32" y="100" width="136" height="66" rx="10" fill="url(#cdBody)"/><rect x="32" y="100" width="136" height="14" rx="8" fill="#fff" opacity=".2"/>
        <rect x="32" y="100" width="136" height="9" fill="url(#cdGold)"/><rect x="32" y="157" width="136" height="9" rx="4" fill="url(#cdGold)"/>
        <rect x="40" y="104" width="14" height="58" fill="url(#cdGold)" opacity=".9"/><rect x="146" y="104" width="14" height="58" fill="url(#cdGold)" opacity=".9"/>
        <rect x="88" y="124" width="24" height="26" rx="6" fill="url(#cdGold)" stroke="#8a560f" stroke-width="2"/><circle cx="100" cy="135" r="4" fill="#3b2806"/></g>
      <g class="c-lid"><path d="M32 102 Q32 52 100 48 Q168 52 168 102 Z" fill="#0d2250" opacity=".55"/><g opacity=".9">${tiles}</g>
        <path class="c-glass" d="M32 102 Q32 52 100 48 Q168 52 168 102 Z" fill="url(#cdGlass)" stroke="url(#cdGold)" stroke-width="4"/>
        <path d="M50 92 Q52 66 88 58" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>
        <path class="c-frost" d="M32 102 Q32 52 100 48 Q168 52 168 102 Z" fill="#eaf8ff" opacity="0"/>
        <g class="c-cracks" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M100 50l-6 18 10 12-8 18" pathLength="100"/><path d="M60 66l14 10-4 14 14 6M140 66l-12 12 6 12-12 8" pathLength="100"/></g></g>
    </svg>`;
  }

  function fuse() {
    const ticks = Array.from({ length: 9 }, (_, i) => { const a = (-135 + i * 33.75) * Math.PI / 180; return `<path d="M${(100 + Math.cos(a) * 17).toFixed(1)} ${(104 + Math.sin(a) * 17).toFixed(1)}L${(100 + Math.cos(a) * 21).toFixed(1)} ${(104 + Math.sin(a) * 21).toFixed(1)}" stroke="#ffd24a" stroke-width="2" stroke-linecap="round"/>`; }).join('');
    return `<svg class="chest-svg chest-fuse" viewBox="0 0 200 180" aria-hidden="true"><defs>
      <linearGradient id="cfMetal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3f4a66"/><stop offset=".3" stop-color="#b8c4de"/><stop offset=".55" stop-color="#6b7896"/><stop offset="1" stop-color="#2d3550"/></linearGradient>
      <linearGradient id="cfCap" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#53607e"/><stop offset=".35" stop-color="#e3ebff"/><stop offset="1" stop-color="#3b4766"/></linearGradient>
      <radialGradient id="cfGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff9a1f" stop-opacity="0"/></radialGradient></defs>
      ${shadow}
      <ellipse class="c-glow" cx="100" cy="58" rx="50" ry="22" fill="url(#cfGlow)" opacity="0"/>
      <g class="c-body"><rect x="54" y="54" width="92" height="110" rx="16" fill="url(#cfMetal)"/>
        <rect x="54" y="78" width="92" height="9" fill="#242c44" opacity=".7"/><rect x="54" y="132" width="92" height="9" fill="#242c44" opacity=".7"/>
        <g opacity=".95"><path d="M54 150h92" stroke="#ffb02e" stroke-width="8" stroke-dasharray="12 10"/></g>
        <circle cx="100" cy="106" r="27" fill="#161c30" stroke="#d6def2" stroke-width="4"/><circle cx="100" cy="106" r="22" fill="#0e1424"/>
        <g transform="translate(0 2)">${ticks}</g>
        <g class="c-needle" style="transform-origin:100px 106px"><path d="M100 106L100 88" stroke="#ff5468" stroke-width="3.4" stroke-linecap="round"/><circle cx="100" cy="106" r="4" fill="#ffd24a"/></g>
        <rect x="46" y="94" width="10" height="26" rx="4" fill="#3b4766"/><rect x="144" y="94" width="10" height="26" rx="4" fill="#3b4766"/>
        <circle class="c-vent" cx="50" cy="107" r="3" fill="#0e1424"/><circle class="c-vent" cx="150" cy="107" r="3" fill="#0e1424"/></g>
      <g class="c-lid"><rect x="50" y="40" width="100" height="20" rx="9" fill="url(#cfCap)"/><rect x="82" y="30" width="36" height="14" rx="6" fill="#ffb02e" stroke="#8a560f" stroke-width="2"/><rect x="50" y="40" width="100" height="6" rx="3" fill="#fff" opacity=".35"/></g>
    </svg>`;
  }

  function golden() {
    return `<svg class="chest-svg chest-golden" viewBox="0 0 200 180" aria-hidden="true"><defs>
      <linearGradient id="cgBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe58a"/><stop offset=".55" stop-color="#ffb21e"/><stop offset="1" stop-color="#c47a10"/></linearGradient>
      <linearGradient id="cgDark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a5a08"/><stop offset=".5" stop-color="#e0961a"/><stop offset="1" stop-color="#8a4f06"/></linearGradient>
      <radialGradient id="cgGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff2a8"/><stop offset="1" stop-color="#ffc83d" stop-opacity="0"/></radialGradient></defs>
      ${shadow}
      <ellipse class="c-glow" cx="100" cy="94" rx="66" ry="24" fill="url(#cgGlow)" opacity="0"/>
      <g class="c-body"><rect x="30" y="94" width="140" height="72" rx="10" fill="url(#cgBody)" stroke="#8a4f06" stroke-width="2.5"/><rect x="30" y="94" width="140" height="14" rx="8" fill="#fff" opacity=".3"/>
        <rect x="48" y="94" width="16" height="72" fill="url(#cgDark)"/><rect x="136" y="94" width="16" height="72" fill="url(#cgDark)"/>
        <circle cx="56" cy="108" r="3" fill="#5b3300"/><circle cx="144" cy="108" r="3" fill="#5b3300"/><circle cx="56" cy="152" r="3" fill="#5b3300"/><circle cx="144" cy="152" r="3" fill="#5b3300"/></g>
      <g class="c-lid"><path d="M30 96 Q30 46 100 42 Q170 46 170 96 Z" fill="url(#cgBody)" stroke="#8a4f06" stroke-width="2.5"/><path d="M44 90 Q46 62 90 52" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".55"/>
        <rect x="48" y="50" width="16" height="48" fill="url(#cgDark)" opacity=".95"/><rect x="136" y="50" width="16" height="48" fill="url(#cgDark)" opacity=".95"/>
        <rect x="86" y="84" width="28" height="30" rx="7" fill="#ffe58a" stroke="#8a4f06" stroke-width="2.5"/><circle cx="100" cy="97" r="4.5" fill="#5b3300"/><rect x="98" y="97" width="4" height="9" rx="2" fill="#5b3300"/>
        <circle cx="100" cy="66" r="7" fill="#ff4d6d" stroke="#fff" stroke-width="1.6"/><circle cx="76" cy="74" r="4.5" fill="#3de1ff"/><circle cx="124" cy="74" r="4.5" fill="#3ddc97"/></g>
      <g class="c-glints"><path d="M26 70l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff"/><path d="M172 56l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#fff"/></g>
    </svg>`;
  }

  BR.ChestArt = { brick, pop, board, fuse, golden };
  BR.chestSVG = (id) => BR.ChestArt[id]();
})();
