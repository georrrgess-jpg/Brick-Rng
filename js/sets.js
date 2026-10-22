/* Moonwick sets (Update 5, Series 4, spec: docs/update-5/series-4-moonwick.md 5.2): the crest and the flourish of a full set.
   A full set is the four equipped items (skin, pop, board, fuse) all carrying the same `set`. Wearing one adds two things and nothing else:
     * a CREST beside the stage label in the run HUD: one 22px element with a silver-and-gold emblem on midnight (an open book, a toadstool
       between two leaves, a flask, an hourglass, a tower under a star). It pops in when a run starts and then holds still;
     * a FLOURISH on one event, once per 6 seconds at most:
         Library  Bookstorm            Line Blast         a flock of paper birds crosses the board, pages fly off the line
         Glade    Fairy Ring           stage-up           a ring of fireflies circles the board and fades
         Alchemy  Great Work           Rush start         a golden ripple turns the board gold for a beat, a transmutation circle turns
         Vault    Time Turn            Last Spark saved   a ghost clock face turns back over the board, sand runs up
         Spire    Moonwick Ascendant   first stage-up of a run and every Rush start: constellation lines draw across the board
   A set never changes points, time, odds or drops (nothing here writes the engine, the board or the save). A flourish lasts at most 900 ms, adds at most 30
   particles (every canvas particle, link, ring and DOM layer counts, and the budget is enforced by the helpers that make them), moves DOM layers on
   transform and opacity only, draws nothing over the HUD (it stays inside the board's box) and is OFF with Reduce Motion and on low-end phones.

   API (the pure part loads in Node, no DOM at load):
     BR.Sets.list                       the five sets in order: { id, name, flourish, trigger, on, blurb, tint, items }  (items = the four item ids)
     BR.Sets.get(id)                    one entry (undefined for an unknown id)
     BR.Sets.statusOf(id, owned)        { have, total, missing: [itemIds] }   (owned = a Set or an array of item ids)
     BR.Sets.wornFrom(items)            the set id when the four items (skin, pop, board, fuse) are all of one set, else null
     BR.Sets.worn()                     the set id of the current loadout, or null
     BR.Sets.ownedIds()                 a Set of the item ids in the vault (browser, reads the save)
     BR.Sets.crest(id, size)            the crest as an SVG string (size in px, 22 by default; below 30px the art drops its hairlines)
     BR.Sets.crestUri(id, size)         the same as a css url("data:image/svg+xml,...") value (22px art by default)
     BR.Sets.fires(id, type, d, first)  does this event play this set's flourish? (first: it is the first stage-up of the run)
     BR.Sets.CAP                        { ms: 900, particles: 30, gap: 6000 }
   Browser only:
     BR.Sets.flourish(id, ctx)          play a set's flourish now (the demo, Try it, the Tower view). ctx is { fx, view } like the Skins handlers get, or
                                        an element to play inside (it is given position: relative while the flourish runs). Returns { set, ms, particles,
                                        stop() } or null (Reduce Motion, low-end, no room). An explicit call ignores the 6 s gap and restarts a running one.
     BR.Sets.onEvent(type, d, ctx)      registered on BR.Skins.handlers: plays the worn set's flourish when its event comes
     BR.Sets.refresh()                  rebuild the crest from the loadout (an applyHook does it after every BR.Skins.apply)
     BR.Sets.warm(id)                   bake a set's bitmaps and art now (the crest does it when a run starts, so a flourish never stalls on its first play)
     BR.Sets.last                       what the last flourish did: { set, ms, particles, at } (ms and particles as declared by the helpers)
     BR.Sets.rest()                     forget the last play time (tests and demos) */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});
  const SILVER = '#e8f0ff', GOLD = '#ffcf6b';
  const ORDER = ['library', 'glade', 'alchemy', 'vault', 'spire'];
  const CAP = { ms: 900, particles: 30, gap: 6000 };
  const DATA = {
    library: { trigger: 'Line Blast', on: ['line'], blurb: 'A Line Blast sends a flock of paper birds across the board.', tint: '#e8a24a' },
    glade: { trigger: 'stage-up', on: ['stageUp'], blurb: 'A new stage rings the board with fireflies.', tint: '#46d8b4' },
    alchemy: { trigger: 'Rush start', on: ['rushStart'], blurb: 'Rush starts with a golden ripple that turns the board gold for a beat.', tint: '#5fd88a' },
    vault: { trigger: 'Last Spark saved', on: ['sparkEnd'], blurb: 'Saving the Last Spark turns a ghost clock back over the board.', tint: '#e0b868' },
    spire: { trigger: 'first stage-up and every Rush start', on: ['stageUp', 'rushStart'], blurb: 'Constellation lines draw themselves across the board.', tint: '#8c9cff' },
  };
  const f1 = (n) => Math.round(n * 10) / 10;
  const uri = (svg) => 'url("data:image/svg+xml,' + svg.replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'").replace(/\s+/g, ' ').trim() + '")';

  /* ------------------------------------------------------------------ the crests: art in a 32 x 32 box
     A round midnight medallion with a moon-silver rim and a glow of the set's colour at the bottom, then one gold-and-silver emblem. Flat fills only
     (no ids, so any number of crests can share a page and one in a hidden tab never loses its paint). Under 30px the hairlines are left out and the
     rim is bolder, so the 22px crest in the HUD keeps only strokes that survive being drawn at two thirds of their size. */
  const EMBLEM = {
    /* an open book: gold covers, two silver pages, a spark above the spine */
    library: (d) => `<g transform="translate(0 1.6)">
      <path d="M5.4 11.4Q10.8 9 16 11.8Q21.2 9 26.6 11.4V23.4Q21.2 21.8 16 24.8Q10.8 21.8 5.4 23.4Z" fill="${GOLD}"/>
      <path d="M7.2 12.2Q11.8 10.6 15.3 13V22.2Q11.8 20.2 7.2 21.4Z" fill="${SILVER}"/><path d="M24.8 12.2Q20.2 10.6 16.7 13V22.2Q20.2 20.2 24.8 21.4Z" fill="${SILVER}"/>
      ${d ? `<path d="M9.2 15.2Q11.6 14.4 13.4 15.6M9.2 18.2Q11.6 17.4 13.4 18.6M22.8 15.2Q20.4 14.4 18.6 15.6M22.8 18.2Q20.4 17.4 18.6 18.6" fill="none" stroke="#7d8bb8" stroke-width=".9" stroke-linecap="round"/>` : ''}
      <path d="M16 3.4L17.1 6.1L19.8 7.2L17.1 8.3L16 11L14.9 8.3L12.2 7.2L14.9 6.1Z" fill="${GOLD}"/></g>`,
    /* a toadstool between two leaves (a fairy ring seen from the side) */
    glade: (d) => `<g transform="translate(0 .6)">
      <path d="M12.4 24.6C8 24.8 5.2 21.8 5 17.2C9.2 17.4 12 20.2 12.4 24.6Z" fill="#c4ece0"/><path d="M19.6 24.6C24 24.8 26.8 21.8 27 17.2C22.8 17.4 20 20.2 19.6 24.6Z" fill="#c4ece0"/>
      <path d="M13.2 17.6Q16 18.8 18.8 17.6L19.4 23.4Q16 25 12.6 23.4Z" fill="${SILVER}"/>
      <path d="M7.6 17C7.6 10.2 11.6 6.6 16 6.6C20.4 6.6 24.4 10.2 24.4 17Q16 19.2 7.6 17Z" fill="${GOLD}"/>
      <path d="M8.2 16.4Q16 18.6 23.8 16.4Q16 17.2 8.2 16.4Z" fill="#b87a22"/>
      <circle cx="12" cy="12.2" r="1.9" fill="#fffbe8"/><circle cx="17.6" cy="9.6" r="1.6" fill="#fffbe8"/><circle cx="20.2" cy="13.8" r="1.4" fill="#fffbe8"/>
      ${d ? `<circle cx="6.4" cy="9.4" r="1" fill="${GOLD}"/><circle cx="26" cy="10.4" r="1" fill="${GOLD}"/>` : ''}</g>`,
    /* a round-bottom flask half full of gold, a bubble rising in the neck */
    alchemy: (d) => `<g transform="translate(0 .4)">
      <path d="M13.4 6.6V13.2C9.6 14.4 7.8 17 7.8 19.8C7.8 23.8 11.4 27.2 16 27.2C20.6 27.2 24.2 23.8 24.2 19.8C24.2 17 22.4 14.4 18.6 13.2V6.6Z" fill="#1a2554"/>
      <path d="M7.9 20.6Q11.5 18.6 14.6 20.4T20.6 20.2T24.1 20.6C23.9 24.2 20.4 27.1 16 27.1C11.6 27.1 8.1 24.2 7.9 20.6Z" fill="${GOLD}"/>
      <circle cx="13.8" cy="23.6" r="1.3" fill="#fffbe8"/><circle cx="18.6" cy="22.2" r="1" fill="#fffbe8"/><circle cx="16.4" cy="10.6" r="1.1" fill="${GOLD}"/>
      <path d="M13.4 6.6V13.2C9.6 14.4 7.8 17 7.8 19.8C7.8 23.8 11.4 27.2 16 27.2C20.6 27.2 24.2 23.8 24.2 19.8C24.2 17 22.4 14.4 18.6 13.2V6.6" fill="none" stroke="${SILVER}" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M11.8 5.4H20.2" stroke="${SILVER}" stroke-width="2.2" stroke-linecap="round"/></g>`,
    /* an hourglass in silver caps: a little sand above, a stream, a heap below */
    vault: (d) => `<g transform="translate(0 .2)">
      <path d="M10.6 7.6H21.4C21.4 12.8 16.8 14.2 16.8 16C16.8 17.8 21.4 19.2 21.4 24.4H10.6C10.6 19.2 15.2 17.8 15.2 16C15.2 14.2 10.6 12.8 10.6 7.6Z" fill="#1a2554"/>
      <path d="M12.6 8.8H19.4C19.1 11.4 17.4 13 16.6 14.2H15.4C14.6 13 12.9 11.4 12.6 8.8Z" fill="${GOLD}"/>
      <path d="M16 14.4V20.6" stroke="${GOLD}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M12.2 23.6C13.2 21.2 14.8 20.2 16 20C17.2 20.2 18.8 21.2 19.8 23.6Z" fill="${GOLD}"/>
      <path d="M10.6 7.6H21.4C21.4 12.8 16.8 14.2 16.8 16C16.8 17.8 21.4 19.2 21.4 24.4H10.6C10.6 19.2 15.2 17.8 15.2 16C15.2 14.2 10.6 12.8 10.6 7.6Z" fill="none" stroke="${SILVER}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M8.4 6.6H23.6M8.4 25.4H23.6" stroke="${SILVER}" stroke-width="2.4" stroke-linecap="round"/></g>`,
    /* a tower with a lit window and a gold roof, a star over the spire */
    spire: (d) => `<g>
      <path d="M12.6 17.6H19.4L20 27H12Z" fill="${SILVER}"/>
      <path d="M11 15.6H21V17.8H11Z" fill="${SILVER}"/>
      <path d="M12.4 15.8L16 9L19.6 15.8Z" fill="${GOLD}"/>
      <path d="M14.9 27V23.4C14.9 21.8 17.1 21.8 17.1 23.4V27Z" fill="#1a2554"/><path d="M15.2 21V19.8C15.2 19 16.8 19 16.8 19.8V21Z" fill="${GOLD}"/>
      <path d="M16 3L17.2 5.6L19.9 6.6L17.2 7.6L16 10.2L14.8 7.6L12.1 6.6L14.8 5.6Z" fill="${GOLD}"/>
      ${d ? `<circle cx="8.6" cy="12" r=".9" fill="${SILVER}"/><circle cx="23.6" cy="10.4" r=".9" fill="${SILVER}"/><circle cx="23.2" cy="20.6" r=".8" fill="${SILVER}"/><circle cx="8.8" cy="21.6" r=".8" fill="${SILVER}"/>` : ''}</g>`,
  };
  const GLOW = { library: '#e8a24a', glade: '#46d8b4', alchemy: '#5fd88a', vault: '#e0b868', spire: '#8c9cff' };
  /** the crest of set `id` as an SVG string, `size` px square */
  function crest(id, size) {
    if (!EMBLEM[id]) return '';
    const s = size || 22, d = s >= 30;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 32 32" role="img" aria-label="${BR.SETS && BR.SETS[id] ? BR.SETS[id].name : id} set">` +
      `<circle cx="16" cy="16" r="15.2" fill="#0b0e2b"/><path d="M1.2 19.4A15.2 15.2 0 0 0 30.8 19.4Z" fill="${GLOW[id]}" fill-opacity=".3"/><path d="M2.3 22.6A15.2 15.2 0 0 0 29.7 22.6Z" fill="${GLOW[id]}" fill-opacity=".22"/>` +
      (d ? EMBLEM[id](d) : `<g transform="translate(16 16) scale(1.08) translate(-16 -16)">${EMBLEM[id](d)}</g>`) +
      (d ? `<circle cx="16" cy="16" r="12.4" fill="none" stroke="${GOLD}" stroke-opacity=".5" stroke-width=".6"/>` : '') +
      `<circle cx="16" cy="16" r="14.4" fill="none" stroke="${SILVER}" stroke-width="${d ? 1.5 : 2}"/></svg>`;
  }

  /* ------------------------------------------------------------------ the pure API */
  const itemIds = (id) => (BR.setItems ? BR.setItems(id) : []).map((x) => x.id);
  const Sets = (BR.Sets = {
    CAP,
    list: ORDER.map((id) => {
      const e = { id, get name() { return BR.SETS && BR.SETS[id] ? BR.SETS[id].name : id; }, get flourish() { return BR.SETS && BR.SETS[id] ? BR.SETS[id].flourish : ''; }, get items() { return itemIds(id); } };
      return Object.assign(e, DATA[id]);
    }),
    get: (id) => Sets.list.find((s) => s.id === id),
    statusOf(id, owned) {
      const ids = itemIds(id);
      const has = !owned ? () => false : typeof owned.has === 'function' ? (x) => owned.has(x) : Array.isArray(owned) ? (x) => owned.includes(x) : () => false;
      const missing = ids.filter((x) => !has(x));
      return { have: ids.length - missing.length, total: ids.length, missing };
    },
    wornFrom(items) {
      if (!items || items.length !== 4) return null;
      const s = items[0] && items[0].set;
      return s && DATA[s] && items.every((x) => x && x.set === s) ? s : null;
    },
    worn() {
      const P = BR.Progress, T = BR.TYPE_ORDER;
      if (!P || !P.equipped || !T) return null;
      return Sets.wornFrom(T.map((t) => P.equipped(t).item));
    },
    ownedIds() { const v = BR.Storage && BR.Storage.data && BR.Storage.data.profile && BR.Storage.data.profile.vault; return new Set((v || []).map((i) => i.itemId)); },
    crest,
    crestUri: (id, size) => uri(crest(id, size || 22)),
    /** does this event play the flourish of set `id`? `first` says it is the first stage-up of the run (only the Spire cares) */
    fires(id, type, d, first) {
      if (id === 'library') return type === 'line';
      if (id === 'glade') return type === 'stageUp';
      if (id === 'alchemy') return type === 'rushStart';
      if (id === 'vault') return type === 'sparkEnd' && !!(d && d.saved);
      if (id === 'spire') return (type === 'stageUp' && !!first) || type === 'rushStart';
      return false;
    },
    last: null,
  });
  if (typeof document === 'undefined') return;

  /* ================================================================== browser: the crest */
  const $ = (id) => document.getElementById(id);
  const calm = () => !!(BR.reducedMotion || BR.lowEnd);
  const now = () => performance.now();
  const state = { worn: null, lastAt: -1e9, play: null, engine: null, stageUps: 0, popEngine: null, crest: null };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeIO = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const audio = (kind, o) => { try { if (BR.audio && BR.audio[kind]) BR.audio[kind](o); } catch (e) { /* sound is optional */ } };

  /** The one crest element, between the stage label and the stage goal; made when a full set is worn and removed when it is not. */
  function syncCrest() {
    const id = Sets.worn(), row = $('stageTag') && $('stageTag').parentNode;
    state.worn = id;
    let el = state.crest;
    if (!id || !row) { if (el) { el.remove(); state.crest = null; } return null; }
    if (!el || !el.isConnected) {
      el = state.crest = document.createElement('i');
      el.id = 'setCrest'; el.className = 'set-crest'; el.setAttribute('role', 'img');
      row.insertBefore(el, $('stageTag').nextSibling);
    }
    if (el.dataset.set !== id) {
      el.dataset.set = id;
      el.style.setProperty('--sc-img', Sets.crestUri(id));
      el.setAttribute('aria-label', Sets.get(id).name + ' set');
    }
    return el;
  }
  /** A quick pop when a run starts (the first apply() of a new engine on the run screen): a spring on one element, a ring and a few motes. */
  function popCrest(el) {
    const eng = BR.Run && BR.Run.engine;
    if (!el || !eng || eng === state.popEngine || !BR.Router || BR.Router.current !== 'run') return;
    state.popEngine = eng;
    if (Sets.warm) Sets.warm(state.worn);
    if (BR.reducedMotion || !el.animate) return;
    el.animate([
      { transform: 'scale(0.2) rotate(-24deg)', opacity: 0 },
      { transform: 'scale(1.3) rotate(5deg)', opacity: 1, offset: 0.55 },
      { transform: 'scale(0.94) rotate(-2deg)', offset: 0.8 },
      { transform: 'scale(1) rotate(0deg)', opacity: 1 },
    ], { duration: 460, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
    const fx = BR.fx || (BR.App && BR.App.fx), r = el.getBoundingClientRect();
    if (!fx || BR.lowEnd || !(r.width > 0)) return;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    fx.ring(x, y, SILVER, 24, 0.42, 2);
    for (let i = 0; i < 6; i++) { const a = rnd(0, TAU), v = rnd(50, 120); fx.emit({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 40, drag: 2.2, size: rnd(1.4, 2.4), max: rnd(0.3, 0.5), color: i % 2 ? GOLD : SILVER }); }
  }
  Sets.refresh = () => popCrest(syncCrest());
  if (BR.Skins && BR.Skins.applyHooks) BR.Skins.applyHooks.push(() => Sets.refresh());

  /* ================================================================== browser: the flourishes */
  const steer = (p, fn, data) => { if (p && BR.U4 && BR.U4.steer) BR.U4.steer(p, fn, data); };
  const bake = (key, w, h, draw) => BR.FX.bake(key, w, h, draw);
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const x = rgb(h); return `rgba(${x[0]},${x[1]},${x[2]},${a})`; };
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => clamp(Math.round(v * t + y[i] * (1 - t)), 0, 255).toString(16).padStart(2, '0')).join(''); };
  /** Set a sprite's alpha to v at any age: js/fx.js fades a sprite over the last 45% of its life, so that fade is divided back out. */
  function alpha(p, v) { const f = Math.min(1, (1 - p.life / p.max) * 2.2); p.a = f > 0.02 ? Math.min(v / f, 60) : 0; }

  /* ---- baked bitmaps (FX.bake: one canvas per key, made the first time a flourish needs it). Only what is drawn on the particle canvas lives here (the
     Glade's fireflies and toadstools, which run round the edge of the board where no text ever is); the larger pictures are DOM layers below. */
  const PAPER = {
    cream: { lit: '#fff8e6', mid: '#f1e4c4', shade: '#cdbd94', edge: '#8a7a52', beak: '#ffb066' },
    gold: { lit: '#fff2bd', mid: '#ffcf6b', shade: '#c8902e', edge: '#7a5200', beak: '#ff9a3d' },
    silver: { lit: '#ffffff', mid: '#dbe6ff', shade: '#9fb0da', edge: '#56668f', beak: '#ffcf6b' },
  };
  const STARS = [[GOLD, '#ffcf6b'], [SILVER, '#9fb4ff'], ['#ffe9a8', '#ffcf6b']];   // a star's core and halo colours
  /** device scale for canvas shadows (shadowBlur ignores the transform) */
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
  /** a firefly with a comet tail, head to the right: a dark pool so it shows on bright bricks, a halo, a hot core, a tail that fades to nothing */
  const cometImg = (col) => bake('sfcomet' + col, 128, 48, (c) => {
    let g = c.createRadialGradient(100, 24, 2, 100, 24, 24); g.addColorStop(0, 'rgba(6, 22, 18, 0.45)'); g.addColorStop(1, 'rgba(6, 22, 18, 0)');
    c.fillStyle = g; c.fillRect(70, 0, 58, 48);
    g = c.createLinearGradient(6, 0, 98, 0); g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.55, rgba(col, 0.42)); g.addColorStop(1, rgba(col, 0.85));
    c.fillStyle = g; c.beginPath(); c.moveTo(6, 24); c.quadraticCurveTo(52, 17.5, 100, 18.4); c.lineTo(100, 29.6); c.quadraticCurveTo(52, 30.5, 6, 24); c.fill();
    g = c.createRadialGradient(100, 24, 0, 100, 24, 22); g.addColorStop(0, rgba(mix(col, '#ffffff', 0.2), 0.98)); g.addColorStop(0.3, rgba(col, 0.62)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(78, 2, 50, 44);
    g = c.createRadialGradient(100, 24, 0, 100, 24, 8); g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, mix(col, '#ffffff', 0.45)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(100, 24, 8, 0, TAU); c.fill();
  });
  /** a little glowing toadstool, upright: a dark rim, a lit cap with spots, a pale stem, a halo underneath */
  const capImg = (col) => bake('sfcap' + col, 48, 48, (c) => {
    const g = c.createRadialGradient(24, 30, 0, 24, 30, 24); g.addColorStop(0, rgba(col, 0.6)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, 48, 48);
    c.shadowColor = 'rgba(8, 24, 22, 0.7)'; c.shadowBlur = 2.6 * dpr(); c.shadowOffsetY = 1 * dpr();
    c.fillStyle = '#f4efe0'; c.beginPath(); c.moveTo(19.5, 25); c.lineTo(28.5, 25); c.lineTo(29.5, 37); c.quadraticCurveTo(24, 39.4, 18.5, 37); c.closePath(); c.fill();
    c.fillStyle = mix(col, '#ffffff', 0.78); c.beginPath(); c.moveTo(8, 26); c.bezierCurveTo(8, 14, 16, 9, 24, 9); c.bezierCurveTo(32, 9, 40, 14, 40, 26); c.quadraticCurveTo(24, 30, 8, 26); c.fill();
    c.shadowColor = 'transparent';
    c.fillStyle = col; c.beginPath(); c.moveTo(8, 26); c.bezierCurveTo(8, 14, 16, 9, 24, 9); c.bezierCurveTo(32, 9, 40, 14, 40, 26); c.quadraticCurveTo(24, 30, 8, 26); c.fill();
    c.fillStyle = mix(col, '#000000', 0.55); c.beginPath(); c.moveTo(8.6, 25); c.quadraticCurveTo(24, 29.6, 39.4, 25); c.quadraticCurveTo(24, 27.4, 8.6, 25); c.fill();
    c.fillStyle = 'rgba(255, 255, 255, 0.92)';
    [[16, 18, 3.2], [26, 14.6, 2.6], [32.5, 21, 2.2]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
    c.strokeStyle = 'rgba(255, 255, 255, 0.7)'; c.lineWidth = 1.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(13, 15); c.quadraticCurveTo(15, 11.8, 19, 10.8); c.stroke();
  });

  /* ---- DOM art (SVG pictures baked into one stylesheet the first time they are used; the layers only move, never repaint).
     Everything bigger than a spark is a DOM layer on purpose: the stage sits below the game's own big texts (callouts, the stage wipe, the Rush
     banner), so a flourish can never cover them, which a particle on the full-screen canvas could not promise. */
  const sv = (inner, vb) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb || '-100 -100 200 200'}'>${inner}</svg>`;
  const poly = (n, r, rot) => Array.from({ length: n }, (_, i) => { const a = ((rot + (i * 360) / n) * Math.PI) / 180; return f1(Math.cos(a) * r) + ',' + f1(Math.sin(a) * r); }).join(' ');
  const ART = {
    /* the transmutation circle: two rings with a ring of ticks, a hexagram, a sun at its heart and a glyph between each pair of points */
    circle: () => {
      let t = '', gl = '';
      for (let i = 0; i < 72; i++) { const a = (i * 5 * Math.PI) / 180, r0 = i % 6 === 0 ? 86 : 90; t += `M${f1(Math.cos(a) * r0)} ${f1(Math.sin(a) * r0)}L${f1(Math.cos(a) * 94)} ${f1(Math.sin(a) * 94)}`; }
      const glyph = [
        `<circle r='5.6'/><circle r='1.4' fill='#ffcf6b'/>`,                                      // sun
        `<path d='M-3 -6A6.4 6.4 0 1 0 -3 6A4.6 4.6 0 1 1 -3 -6Z'/>`,                            // moon
        `<path d='M0 -6V6M-4 -2H4'/><circle cy='-6' r='1.6'/>`,                                   // venus
        `<path d='M-5.4 4.4H5.4L0 -5.4Z'/><path d='M-3.4 1.2H3.4'/>`,                            // air
        `<path d='M-5 -5H5L-5 5H5'/>`,                                                           // hourglass-ish
        `<path d='M0 -6L5.2 4.6H-5.2Z'/><path d='M0 6L5.2 -4.6H-5.2Z'/>`,                       // star
      ];
      for (let i = 0; i < 6; i++) { const a = (-60 + i * 60) - 0; gl += `<g transform='rotate(${a}) translate(0 -80) rotate(${-a})' stroke-width='2'>${glyph[i]}</g>`; }
      return sv(`<g fill='none' stroke='#ffcf6b' stroke-linecap='round' stroke-linejoin='round'>` +
        `<circle r='97' stroke-width='3' stroke-opacity='.35'/><circle r='96' stroke-width='2.2'/><circle r='87' stroke-width='1.2'/><path d='${t}' stroke-width='1.4' stroke-opacity='.8'/>` +
        `<circle r='70' stroke-width='1.4' stroke-opacity='.8'/><polygon points='${poly(3, 70, -90)}' stroke-width='2.6'/><polygon points='${poly(3, 70, 90)}' stroke-width='2.6'/>` +
        `<circle r='34' stroke-width='2'/><polygon points='${poly(6, 34, 0)}' stroke-width='1.4' stroke-opacity='.8'/><circle r='9' stroke-width='2.2'/><circle r='2.6' fill='#fff6d0' stroke='none'/>` +
        gl + `</g>`);
    },
    /* a ghost clock face: silver rings and ticks on a pale glass disc, gold diamonds at the quarters */
    face: () => {
      let m = '', h = '';
      for (let i = 0; i < 60; i++) { const a = (i * 6 * Math.PI) / 180, big = i % 5 === 0; m += `M${f1(Math.cos(a) * (big ? 70 : 79))} ${f1(Math.sin(a) * (big ? 70 : 79))}L${f1(Math.cos(a) * 85)} ${f1(Math.sin(a) * 85)}`; }
      for (let i = 0; i < 4; i++) h += `<path d='M0 -62l5 -9l-5 -9l-5 9z' fill='#ffcf6b' stroke='none' transform='rotate(${i * 90})'/>`;
      return sv(`<circle r='96' fill='#dce8ff' fill-opacity='.1'/><g fill='none' stroke='#e8f0ff' stroke-linecap='round'><circle r='96' stroke-width='3.4'/><circle r='89' stroke-width='1.2'/><path d='${m}' stroke-width='2'/><circle r='56' stroke-width='1' stroke-dasharray='2 7' stroke-opacity='.8'/></g>` + h);
    },
    /* the hands, each drawn from the middle of its own box so a turn about the centre is all it takes */
    minute: () => sv(`<path d='M-3.4 12L-1.4 -74L0 -84L1.4 -74L3.4 12Z' fill='#ffe9a8' stroke='#e8f0ff' stroke-width='1.1' stroke-linejoin='round'/>`),
    /* a paper bird facing right, folded in facets with a soft dark shadow (blurred once, in the picture): the body and the far wing here, the near wing
       in its own layer (wing...) that flaps about the shoulder at (32, 23.5). Both pictures share one box: view box -4 -4 72 56. */
    ...Object.fromEntries(Object.keys(PAPER).flatMap((t) => {
      const P = PAPER[t], pg = (pts, fill) => `<polygon points='${pts.map((q) => q.join(',')).join(' ')}' fill='${fill}' stroke='${P.edge}' stroke-width='1' stroke-linejoin='round'/>`, VB = '-4 -4 72 56';
      const back = [[8, 32], [26, 22], [46, 20], [60, 27], [46, 30], [27, 34]], belly = [[8, 32], [27, 34], [46, 30], [31, 42]];
      const bird = () => sv(
        `<defs><filter id='b' x='-20%' y='-30%' width='140%' height='170%'><feGaussianBlur stdDeviation='1.7'/></filter></defs>` +
        `<g fill='rgba(28,12,48,.6)' filter='url(#b)' transform='translate(0 2.2)'><polygon points='${back.map((q) => q.join(',')).join(' ')}'/><polygon points='${belly.map((q) => q.join(',')).join(' ')}'/><polygon points='22,24 46,22 40,4'/></g>` +
        pg([[30, 24], [46, 22], [41, 5]], P.shade) + pg([[3, 27], [12, 27], [8, 32]], P.shade) + pg(back, P.lit) + pg(belly, P.mid) + pg([[46, 20], [60, 27], [46, 30]], '#ffffff') +
        `<polygon points='60,27 64,29.5 57,29.4' fill='${P.beak}'/><circle cx='52' cy='25.2' r='1.3' fill='#2a2640'/><path d='M26 22L27 34' stroke='rgba(255,255,255,.85)' stroke-width='.8' stroke-linecap='round'/>`, VB);
      const wing = () => sv(pg([[22, 25], [32, 23.5], [7, 17]], P.mid) + pg([[32, 23.5], [42, 22], [7, 17]], P.lit) + `<path d='M32 23.5L7 17' stroke='rgba(255,255,255,.9)' stroke-width='.8' stroke-linecap='round'/>`, VB);
      return [['bird' + t, bird], ['wing' + t, wing]];
    })),
    /* a four-point sparkle with a soft halo and a thin dark edge, so a white star still reads on a yellow brick; one picture per colour pair in STARS */
    ...Object.fromEntries([0, 1, 2].map((i) => [`star${i}`, () => {
      const [core, halo] = STARS[i], ray = (r, k) => `M0 ${-r}Q${k} ${-k} ${r} 0Q${k} ${k} 0 ${r}Q${-k} ${k} ${-r} 0Q${-k} ${-k} 0 ${-r}Z`;
      return sv(`<defs><radialGradient id='h'><stop offset='0' stop-color='${halo}' stop-opacity='.85'/><stop offset='1' stop-color='${halo}' stop-opacity='0'/></radialGradient></defs><circle r='25' fill='url(#h)'/>` +
        `<path d='${ray(27.5, 3.4)}' fill='rgba(16,10,48,.55)'/><path d='${ray(26, 3.2)}' fill='${core}'/><path d='${ray(11, 3.6)}' fill='#ffffff'/>`, '-30 -30 60 60');
    }])),
    hour: () => sv(`<path d='M-4.6 12L-2.6 -42L0 -54L2.6 -42L4.6 12Z' fill='#ffcf6b' stroke='#e8f0ff' stroke-width='1.1' stroke-linejoin='round'/><circle cy='-32' r='4' fill='none' stroke='#e8f0ff' stroke-width='1.2'/><circle r='6.4' fill='#ffcf6b' stroke='#e8f0ff' stroke-width='1.3'/><circle r='2' fill='#fff6d0'/>`),
  };
  const baked = {};
  /** the css class of a DOM layer's picture, made on first use */
  function art(name) {
    if (baked[name]) return baked[name];
    let sheet = $('setsArt');
    if (!sheet) { sheet = document.createElement('style'); sheet.id = 'setsArt'; document.head.appendChild(sheet); }
    sheet.appendChild(document.createTextNode(`.sf.${name}{background-image:${uri(ART[name]())}}\n`));
    return (baked[name] = name);
  }

  /* ---- a play: one flourish's budget, timers, layers and particles
     Every particle, link, ring and DOM layer is made through a helper here, which takes it out of the budget of 30 and trims its life so that
     nothing outlives 900 ms; the stage that holds the DOM layers counts as one too. */
  class Play {
    constructor(id, env) {
      this.set = id; this.env = env; this.fx = env.fx;
      this.t0 = now(); this.cur = 0;          // cur: how far into the flourish the timer callback that is running is, in ms (0 while it is being built)
      this.left = CAP.particles; this.live = true;
      this.timers = new Set(); this.anims = []; this.parts = []; this.stage = null; this.fixed = false;
      this.report = { set: id, ms: 0, particles: 0, at: this.t0 };
    }
    /** take n particles out of the budget; false when it is spent */
    take(n = 1) { if (this.left < n) return false; this.left -= n; this.report.particles += n; return true; }
    mark(ms) { if (ms > this.report.ms) this.report.ms = Math.min(CAP.ms, Math.round(ms)); }
    /** a life in seconds, trimmed so that what is made now still ends inside the cap */
    life(sec) { const l = Math.max(0.05, Math.min(sec, (CAP.ms - this.cur) / 1000)); this.mark(this.cur + l * 1000); return l; }
    at(ms, fn) {
      if (!this.live || ms >= CAP.ms - 60) return;
      this.mark(ms);
      const t = setTimeout(() => { this.timers.delete(t); if (!this.live) return; this.cur = Math.max(ms, now() - this.t0); fn(); this.cur = 0; }, ms);   // a late timer is counted from when it really ran
      this.timers.add(t);
    }
    /** the clipped box that holds the DOM layers: exactly the board's rectangle */
    mount() {
      if (this.stage) return this.stage;
      if (!this.take()) return null;
      const g = this.env.g, layer = this.env.layer, lr = layer.getBoundingClientRect();
      if (this.env.host && getComputedStyle(layer).position === 'static') { this.pos = layer.style.position; layer.style.position = 'relative'; this.fixed = true; }
      const st = this.stage = document.createElement('div');
      st.className = 'sf-stage'; st.setAttribute('aria-hidden', 'true');
      st.style.cssText = `left:${f1(g.L - lr.left)}px;top:${f1(g.T - lr.top)}px;width:${f1(g.W)}px;height:${f1(g.H)}px;border-radius:${g.radius}`;
      layer.appendChild(st);
      return st;
    }
    /** a DOM layer in the stage (box in px from the board's corner), animated on transform and opacity only, starting `from` ms in */
    el(cls, box, frames, from, dur, easing, o = {}) {
      const st = this.mount();
      if (!st || !this.take()) return null;
      const e = document.createElement('i');
      e.className = 'sf ' + cls;
      e.style.cssText = `left:${f1(box.x)}px;top:${f1(box.y)}px;width:${f1(box.w)}px;height:${f1(box.h)}px`;
      (o.parent || st).appendChild(e);
      const n = o.iterations || 1, d = Math.max(0, Math.min(dur, (CAP.ms - from) / n));   // n runs of dur ms (a wing flapping) are trimmed to the cap as a whole
      this.mark(from + d * n);
      if (d > 0 && e.animate) this.anims.push(e.animate(frames, { duration: d, delay: from, easing: easing || 'linear', fill: 'none', iterations: n, direction: o.direction || 'normal', iterationStart: o.iterationStart || 0 }));
      return e;
    }
    /** put a particle (or link or ring) the fx object just made on the list to be cleared when this play ends */
    own(list, n) { const p = list.length > n ? list[list.length - 1] : null; if (p) this.parts.push(p); return p; }
    sprite(o) { if (!this.live || !this.take()) return null; o.max = this.life(o.max); const n = this.fx.parts.length; this.fx.sprite(o); return this.own(this.fx.parts, n); }
    spark(o) { if (!this.live || !this.take()) return null; o.max = this.life(o.max); const n = this.fx.parts.length; this.fx.emit(Object.assign({ kind: 'spark' }, o)); return this.own(this.fx.parts, n); }
    /** a ring grows to at most the distance to the board's nearest edge, so it never reaches the HUD */
    ring(x, y, color, radius, sec, width) {
      if (!this.live || !this.take()) return null;
      const g = this.env.g, room = Math.min(x - g.L, g.L + g.W - x, y - g.T, g.T + g.H - y), n = this.fx.rings.length;
      this.fx.ring(x, y, color, Math.max(8, Math.min(radius, room)), this.life(sec), width);
      return this.own(this.fx.rings, n);
    }
    /** the flourish is built: one timer ends it, whatever is left is cleared */
    arm() { const t = setTimeout(() => { this.timers.delete(t); this.finish(); }, CAP.ms + 30); this.timers.add(t); }
    finish() {
      if (!this.live) return;
      this.live = false;
      this.timers.forEach(clearTimeout); this.timers.clear();
      this.anims.forEach((a) => { try { a.cancel(); } catch (e) { /* gone */ } });
      this.parts.forEach((p) => { p.max = 0; });
      if (this.stage) this.stage.remove();
      if (this.fixed) this.env.layer.style.position = this.pos;
      if (state.play === this) state.play = null;
    }
  }

  /** where the board is, in page px, and the sizes the flourishes scale by (k: 1 on the run's board, smaller in a preview) */
  function resolve(ctx, d) {
    let host = null, view = null, fx = null;
    if (ctx && ctx.nodeType === 1) host = ctx;
    else if (ctx) { host = ctx.host || ctx.el || null; view = ctx.view || null; fx = ctx.fx || null; }
    if (!host && !view) view = (d && (d.view || (d.run && d.run.view))) || (BR.Router && BR.Router.current === 'run' && BR.Run && BR.Run.view) || null;
    fx = fx || BR.fx || (BR.App && BR.App.fx);
    const box = host || (view && view.boardEl), layer = host || (view && view.layer);
    if (!fx || !box || !layer) return null;
    const r = box.getBoundingClientRect();
    if (!(r.width > 24 && r.height > 24)) return null;
    return { host, view, fx, layer, g: { L: r.left, T: r.top, W: r.width, H: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, k: clamp(r.width / 369, 0.45, 1.2), radius: (host ? getComputedStyle(host).borderRadius : getComputedStyle(box).borderRadius) || '22px' } };
  }

  /* ---------------------------------------------------------------- Library: Bookstorm
     The blasted line lifts off as a flock of paper birds (a V of five, each wing a layer of its own that flaps about the shoulder, each bird on its own
     wavering path) that sweeps along the line and across the board; paper pages fly off the line behind it and gold glints are shed in its wake. A bird
     is only seen inside the board (it fades in at one edge and out at the other) and the whole stage is a DOM layer, below the game's own texts. */
  /** where a body thrown with speed v, pulled by gravity gr, slowed by drag dr, is after t seconds (one axis) */
  const ball = (p0, v, gr, dr, t) => p0 + (v / dr) * (1 - Math.exp(-dr * t)) + (gr / dr) * (t - (1 - Math.exp(-dr * t)) / dr);
  function bookstorm(P, g, d) {
    const pl = d && d.res && d.res.plan, vert = !!(pl && pl.lineV && !pl.lineH), dir = Math.random() < 0.5 ? 1 : -1, k = g.k;
    const idx = clamp(pl && (vert ? pl.c : pl.r) != null ? (vert ? pl.c : pl.r) : 3, 0, 7), along = vert ? g.H : g.W, across = vert ? g.W : g.H;
    const lat = clamp(((idx + 0.5) / 8) * across, 100 * k, across - 100 * k);     // the flock's centre line, from the board's edge
    // f runs along the flight from the entry side, s across it; the point in the stage (px from the board's corner)
    const pt = (f, s) => { const a = dir > 0 ? f : along - f; return vert ? { x: lat + s, y: g.H - a } : { x: a, y: lat + s }; };
    const tones = ['cream', 'gold', 'cream', 'silver', 'gold'], slots = [[0, 0], [-42, -32], [-42, 32], [-84, -62], [-84, 62]], T = CAP.ms - 40, N = 18, mirror = !vert && dir < 0;
    const place = (i, u) => {
      const [back, side] = slots[i], e = lerp(u, easeIO(u), 0.55), ph = (i * 2.1) % TAU;
      const s = clamp(lat + side * k * (1 - 0.3 * e) + Math.sin(e * 6.5 + ph) * 9 * k - Math.sin(e * Math.PI) * 24 * k, 34 * k, across - 34 * k);   // a bird never leaves the board's box
      const f = lerp(-40 * k, along + 70 * k, e) + back * k, p = pt(f, s - lat);
      p.f = f;
      return p;
    };
    slots.forEach((slot, i) => {
      const W = 64 * (i ? 0.82 : 1) * k * 1.2 * (72 / 64), H = W * 56 / 72, frames = [];
      for (let j = 0; j <= N; j++) {
        const u = j / N, a = place(i, u), b = place(i, Math.min(1, u + 0.02)), rot = mirror ? Math.atan2(a.y - b.y, a.x - b.x) : Math.atan2(b.y - a.y, b.x - a.x);
        // seen only inside the board: in over the first 30px of one edge, out over the last 30px of the other
        frames.push({ offset: u, opacity: clamp(a.f / (30 * k), 0, 1) * clamp((along - a.f) / (30 * k), 0, 1), transform: `translate(${f1(a.x)}px, ${f1(a.y)}px) rotate(${rot.toFixed(3)}rad) scaleX(${mirror ? -1 : 1})` });
      }
      const bird = P.el('sf-bird ' + art('bird' + tones[i]), { x: -W / 2, y: -H / 2, w: W, h: H }, frames, 0, T);
      if (bird) P.el('sf-wing ' + art('wing' + tones[i]), { x: 0, y: 0, w: W, h: H }, [{ transform: 'rotate(46deg)' }, { transform: 'rotate(-54deg)' }], 0, 150, 'ease-in-out', { parent: bird, iterations: T / 150, direction: 'alternate', iterationStart: (i * 0.37) % 1 });
    });
    // pages spray off the line along the flight and flip as they fall (slow enough to stay inside the board's box)
    const mid = pt(along * 0.5, 0);
    for (let i = 0; i < 6; i++) {
      const f0 = along * (0.14 + 0.62 * (i / 5)), p = pt(f0, rnd(-8, 8)), life = rnd(0.6, 0.8), v = clamp(Math.min(rnd(50, 100) * k, 1.4 * (along - f0 - 28)), 10, 100), side = rnd(-60, 60) * k;
      const vx = vert ? side : dir * v, vy = vert ? -dir * v : rnd(-100, -30) * k, gy = vert ? 0 : 170, spin = rnd(-5, 5), r0 = rnd(0, TAU), frames = [];
      for (let j = 0; j <= 6; j++) {
        const t = (life * j) / 6, flip = j % 2 ? 0.18 : 1;
        frames.push({ offset: j / 6, opacity: j < 5 ? 1 : 1 - (j - 5) * 0.9, transform: `translate(${f1(ball(p.x, vx, 0, 1.6, t))}px, ${f1(ball(p.y, vy, gy, 1.6, t))}px) rotate(${(r0 + spin * t).toFixed(2)}rad) scaleY(${flip})` });
      }
      P.el('sf-page' + (i % 3 === 1 ? ' gold' : ''), { x: -7 * k, y: -5 * k, w: 14 * k, h: 10 * k }, frames, 0, life * 1000);
    }
    // gold glints shed in the flock's wake: tiny canvas sparks
    for (let i = 0; i < 6; i++) P.at(100 + i * 110, () => {
      const q = place(i % 5, clamp((100 + i * 110) / T, 0, 1)), x = g.L + clamp(q.x, 24 * k, g.W - 24 * k), y = g.T + clamp(q.y, 24 * k, g.H - 24 * k);
      P.spark({ x, y, vx: rnd(-24, 24), vy: rnd(-24, 24), g: 0, drag: 1.4, size: rnd(2.4, 4), max: rnd(0.3, 0.5), color: i % 2 ? GOLD : '#fff6d0' });
    });
    P.ring(g.L + mid.x, g.T + mid.y, GOLD, 52 * k, 0.4, 2);
    audio('noise', { dur: 0.3, vol: 0.05, from: 3400, to: 1700, q: 1.1, type: 'bandpass', attack: 0.06 });
    audio('noise', { dur: 0.28, vol: 0.04, from: 2600, to: 1400, q: 1.1, type: 'bandpass', attack: 0.05, at: 0.16 });
  }

  /* ---------------------------------------------------------------- Glade: Fairy Ring
     Twelve fireflies, each with a comet tail, come out in turn on a circle as wide as the board and run a third of the way round it while a
     dashed thread of light turns under them. Behind them eight glowing toadstools spring up on the circle (the fairy ring itself), a little dust
     drifts off, and everything fades. */
  const easeBack = (t) => { t = clamp(t, 0, 1) - 1; return 1 + 2.70158 * t * t * t + 1.70158 * t * t; };
  function fairyRing(P, g) {
    const R = g.W / 2 - 22 * g.k, N = 12, warm = ['#e6ff8a', '#7affd2'], T = CAP.ms - 20;
    P.el('sf-thread', { x: g.W / 2 - R, y: g.H / 2 - R, w: R * 2, h: R * 2 }, [
      { transform: 'rotate(-30deg) scale(0.88)', opacity: 0 },
      { transform: 'rotate(0deg) scale(1)', opacity: 1, offset: 0.24 },
      { transform: 'rotate(40deg) scale(1.03)', opacity: 0.8, offset: 0.7 },
      { transform: 'rotate(66deg) scale(1.06)', opacity: 0 },
    ], 0, 860, 'cubic-bezier(0.25, 0.6, 0.35, 1)');
    for (let i = 0; i < N; i++) {
      const a0 = -Math.PI / 2 + (i / N) * TAU, delay = 30 + i * 24, ph = rnd(0, TAU);
      const sp = P.sprite({ img: cometImg(warm[i % 2]), x: g.cx, y: g.cy, size: 124 * g.k, max: T / 1000, a: 0 });
      steer(sp, (q) => {
        const ms = q.life * 1000, u = clamp((ms - delay) / (T - delay), 0, 1), th = a0 + easeOut(u) * 2.2;
        const r = R * (0.9 + 0.1 * easeOut((ms - delay) / 220)) + Math.sin(ms * 0.012 + ph) * 3 * g.k;
        q.x = g.cx + Math.cos(th) * r; q.y = g.cy + Math.sin(th) * r; q.vx = q.vy = 0; q.rot = th + Math.PI / 2;
        q.sx = q.sy = (0.5 + 0.5 * easeOut((ms - delay) / 160)) * (0.85 + 0.15 * Math.sin(ms * 0.03 + ph));
        alpha(q, clamp((ms - delay) / 110, 0, 1) * clamp((T - ms) / 260, 0, 1));
      });
    }
    for (let k = 0; k < 8; k++) {
      const th = -Math.PI / 2 + ((k + 0.5) / 8) * TAU, delay = 110 + k * 50, x = g.cx + Math.cos(th) * R * 0.985, y = g.cy + Math.sin(th) * R * 0.985;
      const sp = P.sprite({ img: capImg(k % 2 ? '#ffd36b' : '#6bffd0'), x, y, size: 52 * g.k, max: T / 1000, a: 0 });
      steer(sp, (q) => {
        const ms = q.life * 1000, u = (ms - delay) / 170;
        q.sx = q.sy = u < 0 ? 0 : easeBack(u); q.rot = Math.sin(ms * 0.01 + k) * 0.06;
        alpha(q, clamp(u * 3, 0, 1) * clamp((T - ms) / 220, 0, 1));
      });
    }
    const dust = (n) => { for (let i = 0; i < n; i++) { const a = rnd(0.1, Math.PI - 0.1), r = R * rnd(0.88, 1); P.spark({ x: g.cx + Math.cos(a) * r, y: g.cy + Math.sin(a) * r, vx: rnd(-26, 26), vy: rnd(-70, -20), g: 24, drag: 1, size: rnd(1.8, 3.2), max: rnd(0.4, 0.55), color: i % 2 ? '#e6ff8a' : '#9dffe0' }); } };
    dust(2); P.at(260, () => dust(1));
    [523, 659, 784].forEach((f, i) => audio('tone', { f: f * 2, dur: 0.18, vol: 0.035, attack: 0.004, at: 0.06 + i * 0.07 }));
  }

  /* ---------------------------------------------------------------- Alchemy: Great Work
     A gold ripple runs out from the middle of the board (two bands, one after the other), the board turns gold for a beat under a soft wash, a
     transmutation circle turns once in the middle and gold motes rise. */
  function greatWork(P, g) {
    const W = g.W, H = g.H, cx = W / 2, cy = H / 2, big = Math.max(W, H) * 1.25, s = W * 0.8;
    P.el('sf-wash', { x: 0, y: 0, w: W, h: H }, [{ opacity: 0 }, { opacity: 0.8, offset: 0.26 }, { opacity: 0.55, offset: 0.55 }, { opacity: 0 }], 0, 800, 'ease-in-out');
    P.el('sf-ripple', { x: cx - big / 2, y: cy - big / 2, w: big, h: big }, [{ transform: 'scale(0.06)', opacity: 0.95 }, { opacity: 0.9, offset: 0.5 }, { transform: 'scale(1)', opacity: 0 }], 0, 660, 'cubic-bezier(0.2, 0.7, 0.3, 1)');
    P.el('sf-ripple b', { x: cx - big / 2, y: cy - big / 2, w: big, h: big }, [{ transform: 'scale(0.06)', opacity: 0.8 }, { opacity: 0.7, offset: 0.5 }, { transform: 'scale(0.86)', opacity: 0 }], 150, 640, 'cubic-bezier(0.2, 0.7, 0.3, 1)');
    P.el('sf-circle ' + art('circle'), { x: cx - s / 2, y: cy - s / 2, w: s, h: s }, [
      { transform: 'rotate(-40deg) scale(0.7)', opacity: 0 },
      { transform: 'rotate(-12deg) scale(1)', opacity: 0.95, offset: 0.3 },
      { transform: 'rotate(22deg) scale(1.04)', opacity: 0.8, offset: 0.7 },
      { transform: 'rotate(40deg) scale(1.12)', opacity: 0 },
    ], 40, 820, 'cubic-bezier(0.25, 0.6, 0.35, 1)');
    const motes = (n) => { for (let i = 0; i < n; i++) { P.spark({ x: g.L + g.W * rnd(0.1, 0.9), y: g.T + g.H * rnd(0.5, 0.95), vx: rnd(-24, 24), vy: rnd(-220, -90), g: -30, drag: 0.9, size: rnd(2, 4.2), max: rnd(0.45, 0.78), color: ['#ffe9a8', GOLD, '#fff6d0', '#ffb347'][i % 4] }); } };
    motes(6); P.at(150, () => motes(5)); P.at(300, () => motes(5));
    [392, 494, 587, 784].forEach((f, i) => audio('tone', { f, dur: 0.3, vol: 0.04, attack: 0.01, at: i * 0.07 }));
  }

  /* ---------------------------------------------------------------- Vault: Time Turn
     A ghost clock face fades up over the board and its hands spin backwards, the minute hand one and a half times round; a silver ring goes out, motes
     of sand circle backwards into the middle (each a soft DOM glow on a circular path) and a few grains run up from the bottom edge. */
  function timeTurn(P, g) {
    const W = g.W, H = g.H, s = Math.min(W, H) * 0.86, box = { x: W / 2 - s / 2, y: H / 2 - s / 2, w: s, h: s }, k = g.k;
    const fade = [0, 0.8, 0.7, 0], off = [0, 0.2, 0.62, 1];
    const frames = (t) => off.map((o, i) => ({ offset: o, opacity: fade[i], transform: t[i] }));
    P.el('sf-face ' + art('face'), box, frames(['scale(0.82) rotate(-8deg)', 'scale(1) rotate(0deg)', 'scale(1.02) rotate(0deg)', 'scale(1.08) rotate(0deg)']), 0, 840, 'ease-out');
    P.el('sf-hand ' + art('minute'), box, frames(['scale(0.82) rotate(0deg)', 'scale(1) rotate(-200deg)', 'scale(1.02) rotate(-420deg)', 'scale(1.08) rotate(-540deg)']), 0, 840, 'cubic-bezier(0.3, 0.1, 0.3, 1)');
    P.el('sf-hand ' + art('hour'), box, frames(['scale(0.82) rotate(0deg)', 'scale(1) rotate(-18deg)', 'scale(1.02) rotate(-36deg)', 'scale(1.08) rotate(-45deg)']), 0, 840, 'cubic-bezier(0.3, 0.1, 0.3, 1)');
    P.ring(g.cx, g.cy, SILVER, s * 0.5, 0.62, 3);
    P.at(240, () => P.ring(g.cx, g.cy, GOLD, s * 0.34, 0.5, 2));
    const T = CAP.ms - 60, N = 12;
    for (let i = 0; i < 10; i++) {
      const th0 = (i / 10) * TAU + rnd(-0.2, 0.2), delay = 40 + i * 22, r0 = s * 0.46, size = (i % 3 ? 14 : 20) * k, dur = T - delay, fr = [];
      for (let j = 0; j <= N; j++) {
        const u = j / N, th = th0 - easeIO(u) * 3.4, r = lerp(r0, s * 0.12, easeIO(u * 0.9));
        fr.push({ offset: u, opacity: clamp(u * dur / 100, 0, 1) * clamp((dur - u * dur - 40) / 160, 0, 1), transform: `translate(${f1(W / 2 + Math.cos(th) * r)}px, ${f1(H / 2 + Math.sin(th) * r)}px)` });
      }
      P.el('sf-grain c' + (i % 4), { x: -size / 2, y: -size / 2, w: size, h: size }, fr, delay, dur);
    }
    for (let i = 0; i < 6; i++) P.spark({ x: g.cx + rnd(-16, 16) * k, y: g.T + g.H * 0.9, vx: rnd(-16, 16), vy: rnd(-230, -140), g: 90, drag: 0.9, size: rnd(1.8, 3), max: rnd(0.5, 0.7), color: i % 2 ? GOLD : '#ffe9a8' });
    audio('tone', { f: 196, dur: 0.9, vol: 0.07, attack: 0.004 }); audio('tone', { f: 541, dur: 0.5, vol: 0.022, attack: 0.004 });
    for (let i = 0; i < 4; i++) audio('tone', { f: 1180 - i * 70, dur: 0.05, vol: 0.03, attack: 0.002, at: 0.08 + i * 0.085 });
  }

  /* ---------------------------------------------------------------- Spire: Moonwick Ascendant
     A constellation draws itself across the board: stars light one after another, a line grows from each to the next (a silver bar with a dark edge, so it
     shows on every brick colour), the last star flashes and the whole figure fades together. Stars and lines are DOM layers (below the game's texts). */
  const FIGURES = [
    // the tower: up one side, round the apex, down the other and across the door
    { s: [[0.28, 0.9], [0.34, 0.54], [0.22, 0.44], [0.5, 0.1], [0.78, 0.44], [0.66, 0.54], [0.72, 0.9]], e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [1, 5]] },
    // the wanderer: a long zig-zag with a branch
    { s: [[0.08, 0.62], [0.26, 0.28], [0.44, 0.56], [0.64, 0.2], [0.8, 0.5], [0.93, 0.2], [0.7, 0.82]], e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [3, 6], [4, 6]] },
    // the moon's arc: a crescent of stars and a spur
    { s: [[0.1, 0.8], [0.16, 0.5], [0.34, 0.24], [0.6, 0.14], [0.84, 0.28], [0.9, 0.56], [0.52, 0.5]], e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [3, 6]] },
  ];
  let lastFigure = -1;
  function ascendant(P, g) {
    let fi = (Math.random() * FIGURES.length) | 0; if (fi === lastFigure) fi = (fi + 1) % FIGURES.length; lastFigure = fi;
    const F = FIGURES[fi], pad = 0.07, mir = Math.random() < 0.5, step = 80, t0 = 50, END = CAP.ms - 30, k = g.k;
    const pts = F.s.map(([u, v]) => ({ x: g.W * (pad + (mir ? 1 - u : u) * (1 - 2 * pad)), y: g.H * (pad + v * (1 - 2 * pad)) }));   // in the stage
    const starAt = (i) => t0 + i * step;
    pts.forEach((pt, i) => {
      const delay = starAt(i), D = END - delay, S = 57.7 * k * (fi === 0 && i === 3 ? 1.3 : 1), fadeAt = Math.max(D - 240, 160), key = [[0, 0, 0.3, 23], [70, 1, 1.35, 6], [140, 1, 1, 0]];
      for (let t = 250, n = 0; t < fadeAt - 40; t += 110, n++) key.push([t, 1, n % 2 ? 0.94 : 1.12, 0]);
      key.push([fadeAt, 1, 1, 0], [D, 0, 1, 0]);
      P.el('sf-star ' + art('star' + (i % 3)), { x: pt.x - S / 2, y: pt.y - S / 2, w: S, h: S }, key.map(([t, o, sc, r]) => ({ offset: t / D, opacity: o, transform: `scale(${sc}) rotate(${r}deg)` })), delay, D);
    });
    F.e.forEach(([a, b]) => {
      const from = starAt(a) + 20, D = END - from, len = Math.hypot(pts[b].x - pts[a].x, pts[b].y - pts[a].y), ang = Math.atan2(pts[b].y - pts[a].y, pts[b].x - pts[a].x), h = 2.4 * Math.max(0.8, k), grow = step * 0.95, fadeAt = Math.max(grow + 10, 600 - from);
      const tf = (sx) => `rotate(${ang.toFixed(4)}rad) scaleX(${sx})`;
      P.el('sf-line', { x: pts[a].x, y: pts[a].y - h / 2, w: len, h }, [{ offset: 0, opacity: 1, transform: tf(0) }, { offset: grow / D, opacity: 1, transform: tf(1) }, { offset: fadeAt / D, opacity: 1, transform: tf(1) }, { offset: 1, opacity: 0, transform: tf(1) }], from, D, 'ease-out');
    });
    const last = pts[pts.length - 1];
    P.at(starAt(pts.length - 1) + 60, () => {
      for (let i = 0; i < 4; i++) { const a = rnd(0, TAU); P.spark({ x: g.L + last.x, y: g.T + last.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, g: 30, drag: 2.2, size: rnd(2, 3.4), max: rnd(0.3, 0.46), color: i % 2 ? SILVER : GOLD }); }
    });
    [1047, 1319, 1568, 2093].forEach((f, i) => audio('tone', { f, dur: 0.22, vol: 0.026, attack: 0.004, at: 0.05 + i * 0.1 }));
  }

  const FLOURISH = { library: bookstorm, glade: fairyRing, alchemy: greatWork, vault: timeTurn, spire: ascendant };
  /** bake a set's pictures when a run starts (a flourish then never stalls on its first play); everything is cached, so this costs nothing after the first run */
  const WARM = {
    library: () => ['cream', 'gold', 'silver'].forEach((t) => { art('bird' + t); art('wing' + t); }),
    glade: () => { ['#e6ff8a', '#7affd2'].forEach(cometImg); ['#ffd36b', '#6bffd0'].forEach(capImg); },
    alchemy: () => { art('circle'); },
    vault: () => { art('face'); art('minute'); art('hour'); },
    spire: () => [0, 1, 2].forEach((i) => art('star' + i)),
  };
    Sets.warm = (id) => { if (WARM[id] && !calm() && BR.FX && BR.FX.bake) WARM[id](); };

  /** run set `id`'s flourish in the board resolved from ctx; returns the handle or null. An event play (not explicit) waits out the 6 s gap. */
  function play(id, ctx, d, explicit) {
    if (!FLOURISH[id] || calm()) return null;
    if (!explicit && (state.play || now() - state.lastAt < CAP.gap)) return null;
    const env = resolve(ctx, d);
    if (!env) return null;
    if (state.play) state.play.finish();
    const P = new Play(id, env);
    state.play = P; state.lastAt = P.t0;
    try { FLOURISH[id](P, env.g, d); } catch (e) { P.finish(); throw e; }
    P.arm();
    Sets.last = P.report;
    return { set: id, get ms() { return P.report.ms; }, get particles() { return P.report.particles; }, stop: () => P.finish() };
  }
  Sets.flourish = (id, ctx) => play(id, ctx, null, true);
  Sets.rest = () => { state.lastAt = -1e9; };

  /* ---- the event handler (BR.Skins.handlers): only the five events that matter, and nothing at all when no full set is worn */
  Sets.onEvent = function (type, d, ctx) {
    if (type === 'results') { if (state.play) state.play.finish(); return; }
    if (type !== 'line' && type !== 'stageUp' && type !== 'rushStart' && type !== 'sparkEnd') return;
    const id = Sets.worn();
    if (!id) return;
    let first = false;
    if (type === 'stageUp') { const eng = BR.Run && BR.Run.engine; if (eng !== state.engine) { state.engine = eng; state.stageUps = 0; } first = state.stageUps++ === 0; }
    if (Sets.fires(id, type, d, first)) play(id, ctx, d, false);
  };
  if (BR.Skins && BR.Skins.handlers) BR.Skins.handlers.push((type, d, ctx) => Sets.onEvent(type, d, ctx));
})();
