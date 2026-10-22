/* PROTOTYPE (scratch only): static frames of the Sigil skin's two moments, built the way the real moment would build them
   (one DOM sprite per element, SVG drawn once; in the build only transform and opacity would animate). */
(function () {
  const SIG = [
    (s) => `<circle r='${s}' fill='none' stroke='#fff' stroke-width='${s * 0.42}'/>`,
    (s) => `<path d='M0 ${-s}L${s} 0L0 ${s}L${-s} 0Z M0 ${-s * 0.4}L${-s * 0.4} 0L0 ${s * 0.4}L${s * 0.4} 0Z' fill='#fff' fill-rule='evenodd'/>`,
    (s) => `<path d='M0 ${-s}L${s * 0.95} ${s * 0.75}H${-s * 0.95}Z M0 ${-s * 0.2}L${-s * 0.4} ${s * 0.5}H${s * 0.4}Z' fill='#fff' fill-rule='evenodd'/>`,
    (s) => `<path d='M${-s * 0.8} ${-s * 0.8}H${s * 0.8}V${s * 0.8}H${-s * 0.8}Z M${-s * 0.32} ${-s * 0.32}V${s * 0.32}H${s * 0.32}V${-s * 0.32}Z' fill='#fff' fill-rule='evenodd'/>`,
    (s) => { let d = ''; for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; d += (i ? 'L' : 'M') + (Math.cos(a) * s).toFixed(1) + ' ' + (Math.sin(a) * s).toFixed(1); } let e = ''; for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; e += (i ? 'L' : 'M') + (Math.cos(a) * s * 0.45).toFixed(1) + ' ' + (Math.sin(a) * s * 0.45).toFixed(1); } return `<path d='${d}Z ${e}Z' fill='#fff' fill-rule='evenodd'/>`; },
    (s) => { let d = ''; for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283 - 1.5708, r = i % 2 ? s * 0.42 : s; d += (i ? 'L' : 'M') + (Math.cos(a) * r).toFixed(1) + ' ' + (Math.sin(a) * r).toFixed(1); } return `<path d='${d}Z' fill='#fff'/>`; },
    (s) => `<path d='M${-s * 0.3} ${-s}H${s * 0.3}V${-s * 0.3}H${s}V${s * 0.3}H${s * 0.3}V${s}H${-s * 0.3}V${s * 0.3}H${-s}V${-s * 0.3}H${-s * 0.3}Z' fill='#fff'/>`,
  ];
  const runeBand = (r, n, col) => {
    let out = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 360, k = i % 4;
      const g = k === 0 ? `<path d='M0 -4V4M-2.5 -1.5L2.5 1.5' />` : k === 1 ? `<path d='M-3 3L0 -4L3 3' />` : k === 2 ? `<circle r='2.6'/><path d='M0 -4.5V-2.6'/>` : `<path d='M-3 -3H3L-3 3H3'/>`;
      out += `<g transform='rotate(${a}) translate(0 ${-r})' stroke='${col}' stroke-width='1.3' fill='none' stroke-linecap='round'>${g}</g>`;
    }
    return out;
  };
  function circleSVG(glow, ci) {
    let hexa = '';
    for (const off of [0, 180]) { let d = ''; for (let i = 0; i < 3; i++) { const a = ((i * 120 + off - 90) * Math.PI) / 180; d += (i ? 'L' : 'M') + (Math.cos(a) * 62).toFixed(1) + ' ' + (Math.sin(a) * 62).toFixed(1); } hexa += `<path d='${d}Z'/>`; }
    let dots = ''; for (let i = 0; i < 6; i++) { const a = ((i * 60 - 90) * Math.PI) / 180; dots += `<circle cx='${(Math.cos(a) * 62).toFixed(1)}' cy='${(Math.sin(a) * 62).toFixed(1)}' r='5' fill='#fff6d0' stroke='${glow}' stroke-width='2'/>`; }
    return `<svg viewBox='-100 -100 200 200' xmlns='http://www.w3.org/2000/svg'>
      <circle r='96' fill='${glow}' fill-opacity='.10'/>
      <g fill='none'>
        <circle r='92' stroke='${glow}' stroke-opacity='.45' stroke-width='9'/>
        <circle r='92' stroke='#ffe6a0' stroke-width='3'/>
        <circle r='80' stroke='#ffe6a0' stroke-width='1.4' stroke-opacity='.8'/>
        <circle r='62' stroke='${glow}' stroke-opacity='.5' stroke-width='7'/>
        <circle r='62' stroke='#fff6d0' stroke-width='2.2'/>
        <g stroke='#ffe6a0' stroke-width='2' stroke-linejoin='round'>${hexa}</g>
        <circle r='30' stroke='#fff6d0' stroke-width='2'/>
      </g>
      ${runeBand(86, 28, '#fff6d0')}
      ${dots}
      <circle r='24' fill='${glow}' fill-opacity='.55'/>
      <g>${SIG[ci](15)}</g>
    </svg>`;
  }
  window.__sigilCast = function () {
    const e = BR.Run.engine, view = BR.Run.view;
    let best = null;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.cells.length)) best = p; }
    if (!best) return;
    const pts = best.cells.map((q) => view.pagePoint(q.r, q.c));
    let l = 1e9, t = 1e9, rr = -1e9, b = -1e9; pts.forEach((p) => { l = Math.min(l, p.x); t = Math.min(t, p.y); rr = Math.max(rr, p.x); b = Math.max(b, p.y); });
    const cx = (l + rr) / 2, cy = (t + b) / 2, size = Math.min(320, Math.max(rr - l, b - t) + view.cell * 2.4);
    const col = best.color != null ? best.color : 0, pal = BR.PALETTE[col];
    // the pressed group stays highlighted under the circle (the circle is drawn as lines, never a fill over the bricks)
    const recs = Array.from(view.bricks.values());
    best.cells.forEach((q) => { const rec = recs.find((x) => x.r === q.r && x.c === q.c); if (rec) rec.el.classList.add('hl'); });
    view.field.classList.add('has-hl');
    const el = document.createElement('div'); el.className = 'pz-cast';
    el.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px;transform:rotate(14deg)`;
    el.innerHTML = circleSVG(pal.glow, col);
    document.body.appendChild(el);
    const pil = document.createElement('i'); pil.className = 'pz-pillar';
    pil.style.cssText = `left:${cx - size * 0.16}px;top:${Math.max(0, cy - 520)}px;width:${size * 0.32}px;height:${Math.min(520, cy)}px`;
    document.body.appendChild(pil);
    window.__castInfo = { n: best.cells.length, color: pal.name, size: Math.round(size) };
  };
  window.__sigilRush = function (lit) {
    const field = document.getElementById('field'), board = document.getElementById('board');
    const g = document.createElement('div'); g.className = 'pz-great';
    let ticks = ''; for (let i = 0; i < 48; i++) ticks += `<path transform='rotate(${i * 7.5})' d='M0 -47V${i % 6 ? -45.5 : -43.5}' stroke='#ffe6a0' stroke-width='${i % 6 ? 0.5 : 0.9}'/>`;
    let hexa = ''; for (const off of [0, 180]) { let d = ''; for (let i = 0; i < 3; i++) { const a = ((i * 120 + off - 90) * Math.PI) / 180; d += (i ? 'L' : 'M') + (Math.cos(a) * 40).toFixed(1) + ' ' + (Math.sin(a) * 40).toFixed(1); } hexa += `<path d='${d}Z'/>`; }
    g.innerHTML = `<svg viewBox='-50 -50 100 100' width='100%' height='100%'><g fill='none' stroke='#ffe6a0'><circle r='48' stroke='#ffd36b' stroke-opacity='.4' stroke-width='5'/><circle r='48' stroke-width='2' stroke-opacity='1'/><circle r='42' stroke-width='.7'/><circle r='40' stroke='#ffd36b' stroke-opacity='.35' stroke-width='3'/><g stroke-width='1.6' stroke-opacity='.9'>${hexa}</g><circle r='20' stroke-width='.8'/></g>${ticks}</svg>`;
    g.style.transform = 'rotate(9deg)';
    field.insertBefore(g, field.firstChild);
    const R = document.createElement('div'); R.className = 'pz-runes';
    const W = board.clientWidth + 6, H = board.clientHeight + 6, m = 6;
    const spots = [[0.3, 0], [0.7, 0], [1, 0.3], [1, 0.7], [0.7, 1], [0.3, 1], [0, 0.7], [0, 0.3]];
    let marks = '';
    spots.forEach(([fx, fy], i) => {
      const x = m + fx * (W - 2 * m), y = m + fy * (H - 2 * m), on = i < lit;
      marks += `<g transform='translate(${x.toFixed(1)} ${y.toFixed(1)})'>${on ? `<circle r='11' fill='#ffd36b' fill-opacity='.35'/>` : ''}<path d='M0 -8L8 0L0 8L-8 0Z' fill='${on ? '#fff3c4' : '#3a3150'}' stroke='${on ? '#ffd36b' : '#6a5d8a'}' stroke-width='1.6'/><path d='M0 -3.5V3.5M-2.5 0H2.5' stroke='${on ? '#a8740c' : '#8d80b0'}' stroke-width='1.3'/></g>`;
    });
    R.innerHTML = `<svg width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'><rect x='${m}' y='${m}' width='${W - 2 * m}' height='${H - 2 * m}' rx='16' fill='none' stroke='#ffd36b' stroke-opacity='.75' stroke-width='2'/>${marks}</svg>`;
    board.appendChild(R);
  };
})();
