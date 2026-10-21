/* Chest artwork. Each chest is a stack of parts (a div per part, each holding a same-size SVG), so any part can be moved,
   rotated or faded on its own with plain CSS transforms; nothing depends on SVG transform origins. All parts share the
   200 x 180 canvas, so they line up by construction. The gradients live once in a hidden defs sheet.
   Part names the rituals use (data-p): body, pieces (many), straps, leak, lid, glow, needle, half-l, half-r, board, glass, frost, cracks. */
(function () {
  const BR = (window.BR = window.BR || {});
  const f1 = (n) => +n.toFixed(1);

  const lin = (id, stops, x2 = 1, y2 = 0) => `<linearGradient id="cg-${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
  const rad = (id, stops) => `<radialGradient id="cg-${id}" cx=".5" cy=".5" r=".5">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
  const DEFS = `<svg class="chest-defs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>
    ${lin('steel', [[0, '#56627f'], [0.28, '#f2f6ff'], [0.55, '#9aa8c8'], [1, '#444f6c']])}
    ${lin('steelV', [[0, '#f4f7ff'], [0.5, '#9aa8c8'], [1, '#4a5675']], 0, 1)}
    ${lin('gold', [[0, '#fff6b8'], [0.45, '#ffc83d'], [1, '#b9700d']], 1, 1)}
    ${lin('goldV', [[0, '#fff3a8'], [0.4, '#ffc83d'], [1, '#c27a0e']], 0, 1)}
    ${lin('brkFront', [[0, '#ee4a3c'], [1, '#8f1d22']], 0, 1)}
    ${lin('brkTop', [[0, '#ffb497'], [1, '#ff6a4d']], 0, 1)}
    ${lin('brkBase', [[0, '#8f2229'], [1, '#4f1017']], 0, 1)}
    ${rad('brkGlow', [[0, '#fff'], [0.45, '#ffe29a'], [1, '#ffb347', 0]])}
    ${lin('popBody', [[0, '#9c1560'], [0.3, '#ff4d9a'], [0.55, '#ff8cc4'], [1, '#a3175c']])}
    ${lin('popHalfL', [[0, '#9c1560'], [0.45, '#ff4d9a'], [1, '#ff8cc4']])}
    ${lin('popHalfR', [[0, '#ff8cc4'], [0.55, '#ff4d9a'], [1, '#9c1560']])}
    ${rad('popGlow', [[0, '#fff'], [0.5, '#ffb3d9'], [1, '#ff3d8b', 0]])}
    ${lin('iceBase', [[0, '#69c0ff'], [0.6, '#2a6ad8'], [1, '#17409a']], 0, 1)}
    ${lin('glass', [[0, '#e8fbff', 0.55], [0.5, '#7ac8ff', 0.14], [1, '#4a8dff', 0.34]], 1, 1)}
    ${lin('frost', [[0, '#f4fdff', 0.95], [1, '#b9e6ff', 0.55]], 0, 1)}
    ${rad('iceGlow', [[0, '#fff'], [0.5, '#9fe8ff'], [1, '#4aa8ff', 0]])}
    ${lin('vault', [[0, '#7c3c12'], [0.3, '#ffb56a'], [0.58, '#d4701a'], [1, '#6a300c']])}
    ${lin('vaultDark', [[0, '#2c3047'], [0.3, '#7b87a8'], [0.6, '#444c68'], [1, '#222638']])}
    ${rad('fuseGlow', [[0, '#fff'], [0.5, '#ffd27a'], [1, '#ff9a1f', 0]])}
    ${lin('gBody', [[0, '#fff0a0'], [0.5, '#ffb21e'], [1, '#b9700d']], 0, 1)}
    ${lin('gDark', [[0, '#8a4f06'], [0.5, '#e0961a'], [1, '#7a4206']])}
    ${rad('gGlow', [[0, '#fff'], [0.45, '#fff2a8'], [1, '#ffc83d', 0]])}
    ${rad('ruby', [[0, '#ffb3c1'], [0.5, '#ff2e55'], [1, '#8a0a28']])}
    ${rad('sapph', [[0, '#c9f4ff'], [0.5, '#2fc8f0'], [1, '#0a5a8a']])}
    ${rad('emer', [[0, '#c9ffd9'], [0.5, '#2fd97a'], [1, '#0a6a3a']])}
    <clipPath id="cg-clipHaz"><rect x="52" y="152" width="96" height="15" rx="7"/></clipPath>
    <clipPath id="cg-clipDome"><path d="M34 112Q34 46 100 42Q166 46 166 112Z"/></clipPath>
  </defs></svg>`;
  let defsDone = false;
  const ensureDefs = () => {
    if (defsDone || typeof document === 'undefined' || !document.body) return;
    defsDone = true;
    document.body.insertAdjacentHTML('afterbegin', DEFS);
  };

  const part = (name, inner, extra = '') => `<div class="cp cp-${name}" data-p="${name}"${extra}><svg viewBox="0 0 200 180" aria-hidden="true">${inner}</svg></div>`;
  /** A piece that gets scattered: its transform origin is its own center. */
  const piece = (cx, cy, inner) => `<div class="cp cp-piece" data-p="piece" style="transform-origin:${f1(cx / 2)}% ${f1(cy / 1.8)}%"><svg viewBox="0 0 200 180" aria-hidden="true">${inner}</svg></div>`;
  const rivet = (x, y, r = 2.4, c = '#ffe9a8') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#7a4a08" stroke-width=".6"/><circle cx="${f1(x - r * 0.28)}" cy="${f1(y - r * 0.32)}" r="${f1(r * 0.4)}" fill="#fff" opacity=".85"/>`;
  const sparkle = (x, y, s, cls = '') => `<path class="${cls}" d="M${x} ${y - s}l${f1(s * 0.28)} ${f1(s * 0.72)} ${f1(s * 0.72)} ${f1(s * 0.28)} ${f1(-s * 0.72)} ${f1(s * 0.28)} ${f1(-s * 0.28)} ${f1(s * 0.72)} ${f1(-s * 0.28)} ${f1(-s * 0.72)} ${f1(-s * 0.72)} ${f1(-s * 0.28)} ${f1(s * 0.72)} ${f1(-s * 0.28)}z" fill="#fff" style="transform-box:fill-box;transform-origin:center"/>`;
  const shadow = '<i class="cz-shadow"></i>';

  /* ======================================================================= Brick Chest */
  function brick() {
    const cols = ['#ff7a59', '#ff5a3f', '#f2483a', '#ff8d6b'];
    let pieces = '';
    for (let r = 0; r < 3; r++) {
      const off = r % 2 ? 16 : 0;
      for (let c = 0; c < 5; c++) {
        const x = 36 + c * 32 - off, x0 = Math.max(36, x), x1 = Math.min(164, x + 32);
        if (x1 - x0 < 6) continue;
        const y = 97 + r * 23, w = x1 - x0 - 2, col = cols[(r * 5 + c) % cols.length];
        pieces += piece(x0 + 1 + w / 2, y + 10.5, `<rect x="${x0 + 1}" y="${y}" width="${w}" height="21" rx="5" fill="${col}" stroke="#8a2024" stroke-width="1.2"/><rect x="${x0 + 3}" y="${y + 1.5}" width="${w - 4}" height="6" rx="3" fill="#fff" opacity=".3"/><rect x="${x0 + 2}" y="${y + 15}" width="${w - 2}" height="5" rx="2.5" fill="#5a1010" opacity=".3"/>`);
      }
    }
    const studC = [['#ffc83d', '#fff0a8'], ['#ff3d8b', '#ff9cc4'], ['#3de1ff', '#b8f3ff'], ['#3ddc97', '#b6ffe0']];
    const studs = [70, 90, 110, 130].map((x, i) => `<rect x="${x - 8}" y="57" width="16" height="8" rx="3" fill="${studC[i][0]}"/><ellipse cx="${x}" cy="57" rx="8" ry="4.6" fill="${studC[i][1]}" stroke="${studC[i][0]}" stroke-width="1"/><ellipse cx="${x - 2}" cy="55.8" rx="3" ry="1.4" fill="#fff" opacity=".7"/>`).join('');
    const strap = (x) => `<path d="M${x} 70L${x + 3} 52H${x + 15}V70Z" fill="url(#cg-steel)"/><rect x="${x}" y="70" width="15" height="31" fill="url(#cg-steel)"/>${rivet(x + 7.5, 61)}${rivet(x + 7.5, 91)}`;
    return `<div class="chest chest-brick">${shadow}
      ${part('glow', '<ellipse cx="100" cy="92" rx="66" ry="26" fill="url(#cg-brkGlow)"/>')}
      ${part('body', '<rect x="32" y="93" width="136" height="74" rx="11" fill="url(#cg-brkBase)"/>')}
      ${pieces}
      ${part('straps', `<rect x="43" y="93" width="14" height="74" fill="url(#cg-steel)"/><rect x="143" y="93" width="14" height="74" fill="url(#cg-steel)"/>${[104, 130, 156].map((y) => rivet(50, y) + rivet(150, y)).join('')}
        <path d="M32 154q0 13 12 13h12v-17z M168 154q0 13-12 13h-12v-17z" fill="url(#cg-steelV)"/>
        <rect x="21" y="116" width="12" height="20" rx="6" fill="none" stroke="#9aa8c8" stroke-width="3.4"/><rect x="167" y="116" width="12" height="20" rx="6" fill="none" stroke="#9aa8c8" stroke-width="3.4"/>
        <rect x="80" y="130" width="40" height="28" rx="6" fill="url(#cg-gold)" stroke="#8a560f" stroke-width="2"/><rect x="85" y="141" width="30" height="12" rx="3" fill="#ffe27a" stroke="#b9700d" stroke-width="1"/>${[92, 100, 108].map((x) => `<circle cx="${x}" cy="138" r="3.4" fill="#ffe27a" stroke="#b9700d" stroke-width="1"/>`).join('')}`)}
      ${part('leak', '<rect x="36" y="95" width="128" height="3.6" rx="1.8" fill="#fff6c8"/><rect x="36" y="118" width="128" height="2.6" rx="1.3" fill="#fff6c8"/><rect x="36" y="141" width="128" height="2.6" rx="1.3" fill="#fff6c8"/>')}
      ${part('lid', `<path d="M26 101V77q0-7 7-7h134q7 0 7 7v24z" fill="url(#cg-brkFront)"/><path d="M34 70L44 52q2-3 6-3h100q4 0 6 3L166 70z" fill="url(#cg-brkTop)"/>
        <rect x="26" y="70" width="148" height="4" fill="#fff" opacity=".4"/><rect x="26" y="94" width="148" height="7" rx="3.5" fill="#3d0a10" opacity=".4"/>
        ${studs}${strap(46)}${strap(139)}
        <path d="M93 88V80a7 7 0 0 1 14 0v8" fill="none" stroke="url(#cg-steel)" stroke-width="4.6" stroke-linecap="round"/>
        <rect x="87" y="86" width="26" height="22" rx="6" fill="url(#cg-gold)" stroke="#8a560f" stroke-width="2"/><rect x="91" y="88.5" width="9" height="3" rx="1.5" fill="#fff" opacity=".6"/><circle cx="100" cy="95" r="3.7" fill="#5b3300"/><rect x="98.3" y="95" width="3.4" height="8" rx="1.7" fill="#5b3300"/>
        <g class="tw tw1">${sparkle(72, 54, 4)}</g><g class="tw tw2">${sparkle(112, 53, 3.4)}</g><g class="tw tw3">${sparkle(132, 55, 3)}</g>`)}
    </div>`;
  }

  /* ======================================================================= Pop Chest */
  function pop() {
    const star = (x, y, s, o = 0.95) => `<path d="M${x} ${y - s}l${f1(s * 0.3)} ${f1(s * 0.66)} ${f1(s * 0.7)} ${f1(s * 0.1)} ${f1(-s * 0.52)} ${f1(s * 0.46)} ${f1(s * 0.16)} ${f1(s * 0.74)} ${f1(-s * 0.64)} ${f1(-s * 0.38)} ${f1(-s * 0.64)} ${f1(s * 0.38)} ${f1(s * 0.16)} ${f1(-s * 0.74)} ${f1(-s * 0.52)} ${f1(-s * 0.46)} ${f1(s * 0.7)} ${f1(-s * 0.1)}z" fill="#fff" opacity="${o}"/>`;
    const half = (left) => {
      const s = left ? 1 : -1, X = (x) => (left ? x : 200 - x);
      const body = `M${X(100)} 80H${X(56)}Q${X(41)} 122 ${X(52)} 160Q${X(76)} 168 ${X(100)} 168Z`;
      const hoop = (y, w) => `<path d="M${X(100)} ${y}Q${X(66)} ${y + 6} ${X(46 + (y - 80) * 0.02)} ${y - 2}" fill="none" stroke="url(#cg-gold)" stroke-width="${w}" stroke-linecap="round"/>`;
      return part(left ? 'half-l' : 'half-r', `<path d="${body}" fill="url(#cg-pop${left ? 'HalfL' : 'HalfR'})" stroke="#7a0f44" stroke-width="2"/>
        <path d="M${X(100)} 86Q${X(70)} 92 ${X(50)} 88M${X(100)} 128Q${X(68)} 134 ${X(46)} 128" fill="none" stroke="#fff" stroke-width="6" opacity=".55" stroke-linecap="round"/>
        ${hoop(106, 6)}${hoop(150, 6)}
        ${star(X(78), 118, 8)}${star(X(64), 140, 5.4, 0.8)}${star(X(84), 150, 4.4, 0.7)}
        <path d="M${X(58)} 90Q${X(48)} 125 ${X(56)} 158" fill="none" stroke="#fff" stroke-width="3" opacity=".35" stroke-linecap="round"/>
        <circle cx="${X(52)}" cy="106" r="2.4" fill="#fff3b0"/><circle cx="${X(52)}" cy="150" r="2.4" fill="#fff3b0"/>`);
    };
    const confetti = [[66, 74, '#ffd24a', -20], [82, 70, '#3de1ff', 15], [118, 71, '#6bff9e', -10], [134, 75, '#b36bff', 25], [100, 66, '#ff5fa8', 5]].map(([x, y, c, r]) => `<rect x="${x - 4}" y="${y - 2}" width="8" height="4.5" rx="1" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`).join('');
    return `<div class="chest chest-pop">${shadow}<i class="cf cf1"></i><i class="cf cf2"></i><i class="cf cf3"></i><i class="cf cf4"></i>
      ${part('glow', '<ellipse cx="100" cy="82" rx="58" ry="24" fill="url(#cg-popGlow)"/>')}
      ${half(true)}${half(false)}
      ${part('lid', `<path d="M40 82v9q0 12 60 13t60-13v-9z" fill="url(#cg-goldV)" stroke="#a8620a" stroke-width="2.4"/><path d="M48 96q52 9 104 0" fill="none" stroke="#fff" stroke-width="2.4" opacity=".4" stroke-linecap="round"/>
        <ellipse cx="100" cy="82" rx="60" ry="16" fill="url(#cg-gold)" stroke="#a8620a" stroke-width="2.4"/><ellipse cx="100" cy="79" rx="48" ry="10.5" fill="#fff" opacity=".3"/>
        ${confetti}
        <path class="c-fusewire" d="M100 76C97 58 114 52 109 38C106 29 115 24 122 22" fill="none" stroke="#7a4f1e" stroke-width="4.4" stroke-linecap="round"/>
        <path class="c-fusewire" d="M100 76C97 58 114 52 109 38C106 29 115 24 122 22" fill="none" stroke="#d9b070" stroke-width="1.4" stroke-linecap="round" opacity=".9"/>
        <circle class="c-spark2" cx="122" cy="22" r="10" fill="#ff9a3d" opacity=".4"/><circle class="c-spark" cx="122" cy="22" r="6" fill="#ffd24a"/><circle cx="122" cy="22" r="2.8" fill="#fff"/>
        <g class="tw tw1">${sparkle(52, 76, 4)}</g><g class="tw tw2">${sparkle(150, 72, 3.4)}</g>`)}
    </div>`;
  }

  /* ======================================================================= Board Chest */
  function board() {
    const tc = ['#ff5468', '#4a8dff', '#34d98a', '#ffcf3f', '#b36bff', '#ff8a3d', '#25d0f0', '#ff5468', '#4a8dff'];
    const tiles = tc.map((c, i) => `<rect class="tile t${i}" x="${70 + (i % 3) * 21}" y="${64 + Math.floor(i / 3) * 15}" width="18" height="12" rx="3.2" fill="${c}"/><rect x="${71.5 + (i % 3) * 21}" y="${65 + Math.floor(i / 3) * 15}" width="15" height="3.4" rx="1.7" fill="#fff" opacity=".35"/>`).join('');
    const ice = [[44, 14], [60, 9], [76, 12], [124, 11], [140, 15], [156, 10]].map(([x, h]) => `<path d="M${x - 4} 110L${x + 4} 110L${x} ${110 + h}Z" fill="#e8fbff" opacity=".92"/>`).join('');
    const dome = 'M34 112Q34 46 100 42Q166 46 166 112Z';
    return `<div class="chest chest-board">${shadow}
      ${part('glow', '<ellipse cx="100" cy="92" rx="66" ry="26" fill="url(#cg-iceGlow)"/>')}
      ${part('body', `<rect x="28" y="108" width="144" height="59" rx="11" fill="url(#cg-iceBase)"/><rect x="28" y="108" width="144" height="15" rx="8" fill="url(#cg-gold)"/><rect x="28" y="154" width="144" height="13" rx="6" fill="url(#cg-gold)"/>
        <rect x="28" y="108" width="144" height="5" rx="2.5" fill="#fff" opacity=".5"/>
        <rect x="38" y="124" width="14" height="30" fill="url(#cg-gold)" opacity=".95"/><rect x="148" y="124" width="14" height="30" fill="url(#cg-gold)" opacity=".95"/>
        ${[131, 147].map((y) => rivet(45, y, 2.2) + rivet(155, y, 2.2)).join('')}
        <rect x="66" y="126" width="68" height="26" rx="8" fill="#12347e" stroke="url(#cg-gold)" stroke-width="3"/>
        <g stroke="#bfeaff" stroke-width="2.2" stroke-linecap="round"><path d="M100 131v16M92 135l16 8M92 143l16-8"/></g><circle cx="100" cy="139" r="2.4" fill="#fff"/>
        <path d="M28 118q4 6 8 0M164 118q4 6 8 0" stroke="#fff" opacity=".4" fill="none"/>`)}
      ${part('board', `<rect x="64" y="58" width="72" height="54" rx="6" fill="#0d1f52" stroke="url(#cg-gold)" stroke-width="3"/>${tiles}`)}
      ${part('glass', `<path d="${dome}" fill="url(#cg-glass)" stroke="url(#cg-gold)" stroke-width="4.4" stroke-linejoin="round"/>
        <path d="M46 100Q47 66 86 54" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".65"/><path d="M132 66Q150 76 154 96" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".5"/>
        <g clip-path="url(#cg-clipDome)"><rect class="gl-streak" x="30" y="30" width="14" height="90" fill="#fff" opacity=".4" style="transform:translateX(-60px) skewX(-18deg)"/></g>
        <circle cx="100" cy="41" r="6.4" fill="url(#cg-gold)" stroke="#8a560f" stroke-width="1.6"/><circle cx="98" cy="39" r="2" fill="#fff" opacity=".8"/>
        <rect x="26" y="108" width="148" height="8" rx="4" fill="url(#cg-gold)" stroke="#8a560f" stroke-width="1.6"/>
        <g class="tw tw1">${sparkle(60, 70, 5)}</g><g class="tw tw2">${sparkle(142, 60, 4)}</g><g class="tw tw3">${sparkle(112, 94, 3.4)}</g>`)}
      ${part('frost', `<path d="${dome}" fill="url(#cg-frost)"/><rect x="26" y="108" width="148" height="9" rx="4" fill="#eaf8ff"/>${ice}`)}
      ${part('cracks', '<g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M100 44l-6 18 10 12-8 18 4 14" pathLength="100"/><path d="M58 70l14 10-4 14 14 6 -6 10" pathLength="100"/><path d="M142 70l-12 12 6 12-12 8 4 8" pathLength="100"/><path d="M80 52l8 12M122 54l-8 14" pathLength="100"/></g>')}
    </div>`;
  }

  /* ======================================================================= Fuse Chest */
  function fuse() {
    const ticks = Array.from({ length: 9 }, (_, i) => { const a = (-135 + i * 33.75) * Math.PI / 180; return `<path d="M${f1(100 + Math.cos(a) * 18)} ${f1(120 + Math.sin(a) * 18)}L${f1(100 + Math.cos(a) * 22.5)} ${f1(120 + Math.sin(a) * 22.5)}" stroke="${i > 6 ? '#ff5468' : '#ffd24a'}" stroke-width="2.2" stroke-linecap="round"/>`; }).join('');
    const danger = (() => { const a0 = (-135 + 6.4 * 33.75) * Math.PI / 180, a1 = (-135 + 8 * 33.75) * Math.PI / 180; return `<path d="M${f1(100 + Math.cos(a0) * 25)} ${f1(120 + Math.sin(a0) * 25)}A25 25 0 0 1 ${f1(100 + Math.cos(a1) * 25)} ${f1(120 + Math.sin(a1) * 25)}" fill="none" stroke="#ff3d5e" stroke-width="3" stroke-linecap="round" opacity=".9"/>`; })();
    return `<div class="chest chest-fuse">${shadow}<i class="vp vp1"></i><i class="vp vp2"></i>
      ${part('glow', '<ellipse cx="100" cy="64" rx="56" ry="24" fill="url(#cg-fuseGlow)"/>')}
      ${part('body', `<rect x="52" y="60" width="96" height="107" rx="15" fill="url(#cg-vault)" stroke="#5a2808" stroke-width="2"/>
        <rect x="52" y="60" width="96" height="14" rx="7" fill="url(#cg-vaultDark)"/><rect x="52" y="97" width="96" height="9" fill="url(#cg-vaultDark)"/><rect x="52" y="152" width="96" height="15" rx="7" fill="#ffc83d"/><g clip-path="url(#cg-clipHaz)" fill="#1c2036">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${52 + i * 14} 167l7-15h7l-7 15z"/>`).join('')}</g><rect x="52" y="152" width="96" height="4" rx="2" fill="#fff" opacity=".35"/>
        ${[62, 80, 100, 120, 138].map((x) => rivet(x, 67, 2.3, '#ffd8a0')).join('')}
        <rect x="52" y="60" width="96" height="5" rx="2.5" fill="#fff" opacity=".35"/><path d="M60 78V150" stroke="#fff" stroke-width="3.4" opacity=".28" stroke-linecap="round"/>
        <rect x="38" y="108" width="16" height="30" rx="5" fill="url(#cg-vaultDark)"/><rect x="146" y="108" width="16" height="30" rx="5" fill="url(#cg-vaultDark)"/>
        <circle cx="46" cy="123" r="4.2" fill="#10131f"/><circle cx="154" cy="123" r="4.2" fill="#10131f"/>
        <circle cx="100" cy="120" r="31" fill="#2a3047" stroke="url(#cg-steel)" stroke-width="5"/><circle cx="100" cy="120" r="26.5" fill="#0f1424"/><circle cx="100" cy="120" r="26.5" fill="none" stroke="#000" stroke-width="2" opacity=".5"/>
        ${ticks}${danger}<path d="M82 138q18 10 36 0" stroke="#fff" stroke-width="2" fill="none" opacity=".15"/>
        <path d="M68 168v7M132 168v7" stroke="#5a2808" stroke-width="6" stroke-linecap="round"/>`)}
      ${part('needle', '<path d="M100 120L100 99" stroke="#ff5468" stroke-width="3.6" stroke-linecap="round"/><circle cx="100" cy="120" r="5" fill="#ffd24a" stroke="#8a560f" stroke-width="1.4"/><circle cx="98.6" cy="118.6" r="1.6" fill="#fff"/>', ' style="transform-origin:50% 66.7%"')}
      ${part('lid', `<rect x="46" y="44" width="108" height="22" rx="10" fill="url(#cg-steel)" stroke="#444f6c" stroke-width="1.6"/><rect x="46" y="44" width="108" height="6" rx="3" fill="#fff" opacity=".5"/>
        ${[58, 78, 100, 122, 142].map((x) => rivet(x, 58, 2.2, '#ffd8a0')).join('')}
        <path class="c-fusewire" d="M100 32C102 22 112 20 114 12C115 8 120 6 124 8" fill="none" stroke="#8a5a2a" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="100" cy="36" r="14.5" fill="#1c2036" stroke="#444f6c" stroke-width="2"/><circle cx="95" cy="31" r="4.6" fill="#fff" opacity=".35"/><rect x="95" y="20" width="10" height="7" rx="2" fill="#7b87a8"/>
        <circle class="c-spark2" cx="124" cy="8" r="8" fill="#ff9a3d" opacity=".45"/><circle class="c-spark" cx="124" cy="8" r="5" fill="#ffd24a"/><circle cx="124" cy="8" r="2.2" fill="#fff"/>
        <g class="tw tw1">${sparkle(62, 52, 4)}</g>`)}
    </div>`;
  }

  /* ======================================================================= Golden Chest */
  function golden() {
    const filigree = (x, d) => `<path d="${d}" transform="translate(${x} 0)" fill="none" stroke="#fff2a8" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>`;
    return `<div class="chest chest-golden">${shadow}
      ${part('glow', '<ellipse cx="100" cy="96" rx="70" ry="26" fill="url(#cg-gGlow)"/>')}
      ${part('body', `<rect x="28" y="95" width="144" height="72" rx="11" fill="url(#cg-gBody)" stroke="#8a4f06" stroke-width="2.6"/><rect x="28" y="95" width="144" height="12" rx="7" fill="#fff" opacity=".35"/>
        <rect x="46" y="95" width="17" height="72" fill="url(#cg-gDark)"/><rect x="137" y="95" width="17" height="72" fill="url(#cg-gDark)"/>
        ${[107, 132, 156].map((y) => rivet(54.5, y, 2.6, '#fff2a8') + rivet(145.5, y, 2.6, '#fff2a8')).join('')}
        <path d="M68 112q16-8 32 0t32 0M68 150q16 8 32 0t32 0" fill="none" stroke="#8a4f06" stroke-width="2.4" opacity=".55" stroke-linecap="round"/>
        <circle cx="86" cy="131" r="6.4" fill="url(#cg-sapph)" stroke="#8a4f06" stroke-width="1.6"/><circle cx="114" cy="131" r="6.4" fill="url(#cg-emer)" stroke="#8a4f06" stroke-width="1.6"/>
        <path d="M28 150q0 17 12 17h12v-19z M172 150q0 17-12 17h-12v-19z" fill="url(#cg-gDark)"/>`)}
      ${part('leak', '<rect x="32" y="93" width="136" height="5" rx="2.5" fill="#fffbe0"/>')}
      ${part('lid', `<path d="M28 98Q28 48 100 44Q172 48 172 98Z" fill="url(#cg-gBody)" stroke="#8a4f06" stroke-width="2.6"/><path d="M42 92Q44 62 88 52" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" opacity=".6"/>
        <rect x="46" y="52" width="17" height="46" fill="url(#cg-gDark)" opacity=".95"/><rect x="137" y="52" width="17" height="46" fill="url(#cg-gDark)" opacity=".95"/>
        ${[62, 86].map((y) => rivet(54.5, y, 2.6, '#fff2a8') + rivet(145.5, y, 2.6, '#fff2a8')).join('')}
        ${filigree(0, 'M68 80q8-12 18-4M132 80q-8-12-18-4')}
        <path d="M84 60l5-9 6 6 5-8 5 8 6-6 5 9z" fill="url(#cg-gold)" stroke="#8a4f06" stroke-width="1.6" stroke-linejoin="round"/><circle cx="100" cy="46" r="3" fill="#ff4d6d"/>
        <rect x="87" y="82" width="26" height="28" rx="7" fill="#ffe58a" stroke="#8a4f06" stroke-width="2.4"/><circle cx="100" cy="95" r="9" fill="url(#cg-ruby)" stroke="#8a4f06" stroke-width="1.8"/><circle cx="97" cy="92" r="2.6" fill="#fff" opacity=".8"/>
        <circle cx="76" cy="62" r="4.6" fill="url(#cg-sapph)" stroke="#8a4f06" stroke-width="1.2"/><circle cx="124" cy="62" r="4.6" fill="url(#cg-emer)" stroke="#8a4f06" stroke-width="1.2"/>`)}
      ${part('glints', `<g class="tw tw1">${sparkle(26, 70, 7)}</g><g class="tw tw2">${sparkle(174, 56, 6)}</g><g class="tw tw3">${sparkle(150, 40, 4.4)}</g><g class="tw tw4">${sparkle(46, 40, 4)}</g>`)}
    </div>`;
  }

  BR.ChestArt = { brick, pop, board, fuse, golden };
  /** The chest as markup. Callers size a wrapper; the chest fills it (200 x 180 aspect). */
  BR.chestSVG = (id) => { ensureDefs(); return BR.ChestArt[id](); };
  BR.ensureChestDefs = ensureDefs;
})();
