/* The Moonwick Tower (UPDATE-5.md 1.5): Series 4 progress as a night-sky tower in the Collection. One floor per set (Library, Moon Garden,
   Alchemy Lab, Time Vault, Spire), four windows per floor (skin, pop, board, fuse), a belfry for the two Pop Pass exclusives and a cellar for
   the eight items that belong to no set. A found item lights its window in its rarity colour and shows its badge; a missing one is dark and
   shows its silhouette. The art is CSS (css/tower.css); this file holds the counting (plain functions, they load in Node), the markup and
   the one-time bell. The caller (js/screens.js) listens with event delegation on:
     [data-tw-item][data-tw-uid]   a found window (open the item sheet)
     [data-tw-locked]              a missing window (open the where-to-find sheet)
   Cost: the first frame is the tower and its windows as plain boxes; the badges (up to 30) are filled in afterwards, a few at a time,
   like the Collection grid. Nothing moves at rest except a very slow twinkle of eight stars (off in Reduce Motion and on low-end phones);
   every animation is transform or opacity. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  /* ------------------------------------------------------------------ the catalogue as a tower (pure) */
  /** The five floors from the bottom up: the room each set lives in (BR.SETS in js/items.js has the set itself). */
  const FLOORS = [
    { set: 'library', room: 'The Library' },
    { set: 'glade', room: 'The Moon Garden' },
    { set: 'alchemy', room: 'The Alchemy Lab' },
    { set: 'vault', room: 'The Time Vault' },
    { set: 'spire', room: 'The Spire' },
  ];
  const TYPE_RANK = { skin: 0, pop: 1, board: 2, fuse: 3 };
  const LEVEL = (id) => (BR.rarityById && BR.rarityById[id] ? BR.RARITIES.indexOf(BR.rarityById[id]) : 0);
  const asSet = (o) => (o instanceof Set ? o : new Set(o || []));
  const byType = (a, b) => TYPE_RANK[a.type] - TYPE_RANK[b.type];
  const byEase = (a, b) => LEVEL(a.rarity) - LEVEL(b.rarity) || byType(a, b);   // the easy ones first: the order a player will find them in

  function pack(set, name, room, items, owned, extra) {
    const list = items.map((x) => ({ id: x.id, have: owned.has(x.id) }));
    const have = list.filter((x) => x.have).length;
    return Object.assign({ set, name, room, items: list, have, total: list.length, done: list.length > 0 && have === list.length }, extra);
  }
  /** The five set floors, bottom to top: [{ set, name, room, items: [{ id, have }], have, total, done }]. `owned` is a Set (or array) of item ids. */
  function floors(owned) {
    const o = asSet(owned);
    return FLOORS.map((f) => pack(f.set, BR.SETS[f.set].name, f.room, BR.setItems(f.set).slice().sort(byType), o));
  }
  /** The two parts of Series 4 that are not a set: the belfry (the Pop Pass exclusives) and the cellar (the rooms on their own). */
  function extras(owned) {
    const o = asSet(owned);
    const s4 = BR.ITEMS.filter((x) => x.series === 4);
    return [
      pack('pass', 'Pop Pass', 'The Belfry', s4.filter((x) => x.pass).sort(byType), o, { extra: true }),
      pack('cellar', 'No set', 'The Cellar', s4.filter((x) => !x.pass && !x.set).sort(byEase), o, { extra: true }),
    ];
  }
  /** The floor to finish next: the unfinished set with the fewest items left (the lowest floor on a tie), as { set, name, room, left }, or null when all five are done. */
  function nextFloor(owned) {
    let best = null;
    for (const f of floors(owned)) if (!f.done && (!best || f.total - f.have < best.left)) best = { set: f.set, name: f.name, room: f.room, left: f.total - f.have };
    return best;
  }
  /** Every Series 4 item the tower shows: { have, total, floorsDone, floors }. */
  function summary(owned) {
    const o = asSet(owned), fl = floors(o), all = fl.concat(extras(o));
    return { have: all.reduce((a, f) => a + f.have, 0), total: all.reduce((a, f) => a + f.total, 0), floorsDone: fl.filter((f) => f.done).length, floors: fl.length };
  }
  const the = (room) => room.replace(/^The /, 'the ');
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  /** The sentence for the next floor ("2 items to finish the Library"). */
  function nextLine(owned) {
    const n = nextFloor(owned);
    if (n) return plural(n.left, 'item') + ' to finish ' + the(n.room);
    const s = summary(owned);
    return s.have === s.total ? 'Every window is lit. The tower is complete!' : 'All five floors are lit. ' + plural(s.total - s.have, 'room') + ' left to find.';
  }
  /** The instance to show for an item: the one with the best finish (the vault holds one per item, but an old save may hold two). */
  function bestInst(vault, itemId) {
    const rank = (i) => (BR.SHINES ? BR.SHINES.findIndex((s) => s.id === i.shine) : 0);
    let best = null;
    for (const i of vault || []) if (i.itemId === itemId && (!best || rank(i) > rank(best))) best = i;
    return best;
  }

  /* ------------------------------------------------------------------ the bells already rung (localStorage, with a memory fallback) */
  const KEY = 'poprush.tower.bells';
  let memo = [];
  const bellsSeen = () => {
    const s = new Set(memo);
    try { const a = JSON.parse(G.localStorage.getItem(KEY)); if (Array.isArray(a)) a.forEach((x) => s.add(x)); } catch (e) { /* blocked storage: the memory list is all there is */ }
    return s;
  };
  const remember = (s) => { memo = Array.from(s); try { G.localStorage.setItem(KEY, JSON.stringify(memo)); } catch (e) { /* ignore */ } };
  /** Forget which bells have rung (for tests and a debug reset): every complete floor is new again. */
  function forget() { memo = []; try { G.localStorage.removeItem(KEY); } catch (e) { /* ignore */ } tower.rung.length = 0; }

  /* ------------------------------------------------------------------ markup */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TYPE_NAME = (t) => (BR.ITEM_TYPES && BR.ITEM_TYPES[t] ? BR.ITEM_TYPES[t].name : t);
  /** The crest of a floor: BR.Sets.crest from js/sets.js when it is there, else a shield with the set's mark (an image in css/tower.css). */
  function crest(set) {
    try { if (BR.Sets && BR.Sets.crest) { const h = BR.Sets.crest(set, 28); if (h) return `<span class="tw-crest">${h}</span>`; } } catch (e) { /* the set crests are optional */ }
    return `<span class="tw-crest c-${set}"></span>`;
  }
  const ringSVG = (frac, size, w) => {
    const r = (size - w) / 2, c = 2 * Math.PI * r;
    return `<svg class="tw-ringsvg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${w}"/><circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${w}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1)}"/></svg>`;
  };
  /** One window. A found one is a button with data-tw-item and data-tw-uid; a missing one has data-tw-locked only. The badge goes into .tw-glass later (hydrate). */
  function win(item, inst, have, A, eager, round) {
    const R = BR.rarityById[item.rarity], tn = TYPE_NAME(item.type);
    const badge = eager && BR.Badge ? BR.Badge.html(item, have ? inst : null, { size: 48, still: true, locked: !have }) : '';
    const attrs = have ? `${A.item}="${item.id}"${inst ? ` ${A.uid}="${inst.uid}"` : ''}` : `${A.locked}="${item.id}"`;
    const label = have ? `${esc(item.name)}, ${R.name} ${tn}, found. See it` : `${R.name} ${tn}, not found yet. See where to find it`;
    return `<button class="tw-win ${have ? 'on' : 'off'} r${LEVEL(item.rarity) + 1}${round ? ' round' : ''}" type="button" ${attrs} aria-label="${label}"><span class="tw-glass${badge ? ' hy' : ''}" data-b="${item.id}" data-have="${have ? 1 : 0}"${have && inst ? ` data-u="${inst.uid}"` : ''}>${badge}</span><span class="tw-sill">${tn}</span></button>`;
  }
  /** The header strip of a floor: crest, name, how many are found, and a bell once a set floor is complete. */
  function band(f) {
    // "Time Vault · 1 to find" (the set's name is dropped on a very narrow phone), "Set complete"; the belfry is narrow: its strip carries the name alone
    const sub = f.set === 'pass' ? esc(f.name) : f.done ? (f.extra ? 'All found' : 'Set complete') : `<span class="tw-sn">${esc(f.name)} · </span>${f.total - f.have} to find`;
    return `<div class="tw-band">${crest(f.set)}<span class="tw-ft"><b>${esc(f.room)}</b><small>${sub}</small></span>${f.done && !f.extra ? '<i class="tw-bell"></i>' : ''}<b class="tw-chip" aria-hidden="true">${f.have}<i>/</i>${f.total}</b></div>`;
  }
  function floorHTML(f, ctx, o) {
    const items = f.items.map((x) => win(BR.itemById[x.id], ctx.best.get(x.id) || null, x.have, ctx.A, ctx.eager, o.round));
    if (o.mid) items.splice(1, 0, o.mid);                              // the belfry's bell hangs between its two windows
    const cls = `tw-floor${f.extra ? '' : ' f-' + f.set}${f.done ? ' done' : ''}${ctx.next && ctx.next.set === f.set ? ' next' : ''}${o.cls ? ' ' + o.cls : ''}`;
    return `<div class="${cls}" data-set="${f.set}" role="group" aria-label="${esc(f.room)}, ${esc(f.name)}${f.extra ? '' : ' set'}, ${f.have} of ${f.total} found">${band(f)}<div class="tw-wins${o.mid ? ' mid' : ''}">${items.join('')}</div></div>`;
  }

  const attrNames = (o) => Object.assign({ item: 'data-tw-item', uid: 'data-tw-uid', locked: 'data-tw-locked' }, o);
  /** The view: the summary card and the tower. opts: { owned: Set (default: the vault), vault (default: the saved vault), attrs: { item, uid, locked } attribute names,
      onItem(itemId, uid) and onLocked(itemId): taps (afterRender listens for them), eager: true builds the badges now instead of in afterRender }. */
  function html(opts) {
    opts = opts || {};
    const vault = opts.vault || (BR.Storage && BR.Storage.data ? BR.Storage.data.profile.vault : []);
    const owned = opts.owned ? asSet(opts.owned) : new Set(vault.map((i) => i.itemId));
    const best = new Map();
    for (const i of vault) if (owned.has(i.itemId)) best.set(i.itemId, bestInst(vault, i.itemId));
    tower.best = best;
    tower.cfg = { A: attrNames(opts.attrs), onItem: opts.onItem, onLocked: opts.onLocked };
    const ctx = { best, A: tower.cfg.A, eager: !!opts.eager, next: nextFloor(owned) };
    const fl = floors(owned), [pass, cellar] = extras(owned), sum = summary(owned);
    const next = ctx.next
      ? `<button class="tw-next" type="button" data-tw-jump="${ctx.next.set}"><i class="tw-spark" aria-hidden="true"></i><span>${esc(nextLine(owned))}</span></button>`
      : `<p class="tw-next all"><i class="tw-spark" aria-hidden="true"></i><span>${esc(nextLine(owned))}</span></p>`;
    const LEDGE = '<i class="tw-ledge"></i>';                          // the stone ledge under a floor
    const belfry = floorHTML(pass, ctx, { cls: 'tw-belfry', round: true, mid: '<span class="tw-arch"><i class="tw-bell"></i></span>' }) + LEDGE;
    const body = fl.slice().reverse().map((f) => floorHTML(f, ctx, {}) + LEDGE).join('') + floorHTML(cellar, ctx, { cls: 'tw-cellar' }) + LEDGE;
    return `<section class="tw${BR.reducedMotion || BR.lowEnd ? ' calm' : ''}" aria-label="Moonwick Tower, ${sum.have} of ${sum.total} items found">
      <header class="tw-sum"><div class="tw-ring" role="img" aria-label="${sum.have} of ${sum.total} found">${ringSVG(sum.have / sum.total, 64, 6)}<b>${sum.have}<small>/${sum.total}</small></b></div>
        <div class="tw-st-txt"><h3>Moonwick Tower</h3><p>${sum.have} of ${sum.total} items · ${sum.floorsDone} of ${sum.floors} floors lit</p></div>${next}</header>
      <div class="tw-sky"><i class="tw-moon"></i><i class="tw-cloud c1"></i><i class="tw-cloud c2"></i><i class="tw-cloud c3"></i><i class="tw-cloud c4"></i><span class="tw-stars"><i class="an"></i><i class="an"></i><i class="an"></i><i class="an"></i><i class="an"></i><i class="an"></i><i class="an"></i><i class="an"></i></span>
        <div class="tw-tower"><div class="tw-roof"></div>${belfry}<div class="tw-body">${body}</div></div><div class="tw-ground"></div></div>
      <p class="tw-hint">Tap a lit window to see the item. Tap a dark one to see where to find it.</p>
    </section>`;
  }

  /* ------------------------------------------------------------------ after the markup is in the page */
  const now = () => (G.performance ? G.performance.now() : Date.now());
  const frame = (fn) => (G.requestAnimationFrame ? G.requestAnimationFrame(fn) : setTimeout(fn, 16));
  /** The badge size that fits a window: from the width of the tower and the grid of the floors (a floor far off screen has no layout to ask). */
  function badgeSize(root) {
    const body = root.querySelector('.tw-body'), wins = body && body.querySelector('.tw-wins');
    if (!wins) return 46;
    const cs = G.getComputedStyle(wins), pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), gap = parseFloat(cs.columnGap) || 0;
    return Math.max(34, Math.min(58, Math.round((body.clientWidth - pad - gap * 3) / 4 - 8 - 6)));   // window width, less the frame (4 + 4) and a little air
  }
  /** Fill the windows with their badges a few at a time (4 ms of work per frame), so the tower is on screen before any badge is built. */
  function hydrate(root) {
    const list = Array.from(root.querySelectorAll('.tw-glass:not(.hy)'));
    if (!list.length || !BR.Badge) return;
    let k = 0, size = 0;
    const fill = (glass) => {
      const item = BR.itemById[glass.dataset.b];
      glass.classList.add('hy');
      if (!item) return;
      const have = glass.dataset.have === '1', uid = glass.dataset.u;
      const inst = have ? (tower.best && tower.best.get(item.id)) || (uid && BR.Progress && BR.Progress.instance(uid)) || null : null;
      glass.insertAdjacentHTML('beforeend', BR.Badge.html(item, inst, { size, still: true, locked: !have }));
    };
    const step = () => {
      if (!root.isConnected) return;                                   // the view was redrawn: its replacement hydrates itself
      if (!size) size = badgeSize(root);
      const t0 = now();
      do { fill(list[k++]); } while (k < list.length && now() - t0 < 4);
      if (k < list.length) frame(step);
    };
    setTimeout(() => frame(step), 80);
  }
  /** A low bell: the strike, a ring that hangs on, and a quiet overtone (the same voice as the Moonwick Tower board). */
  function toll() {
    const t = BR.audio && BR.audio.tone;
    if (!t) return;
    try { t({ f: 196, dur: 1.1, vol: 0.12, attack: 0.004 }); t({ f: 541, dur: 0.5, vol: 0.04, attack: 0.004 }); t({ f: 98, dur: 0.7, vol: 0.06, attack: 0.008 }); } catch (e) { /* sound is optional */ }
  }
  /** The belfry's big bell swings and sends two rings out (a second toll restarts it). */
  function tollBelfry(root) {
    const arch = root.querySelector('.tw-arch');
    toll();
    if (!arch) return;
    arch.classList.remove('ring');
    void arch.offsetWidth;
    arch.classList.add('ring');
    setTimeout(() => arch.classList.remove('ring'), 2700);
  }
  /** A floor's own bell swings, two rings spread from it, and its four windows flash gold one after another (about 2 s; the flashes are added now and removed after). */
  function ringFloor(f) {
    tower.rung.push(f.dataset.set);
    const flashes = Array.from(f.querySelectorAll('.tw-glass')).map((g, k) => { const i = document.createElement('i'); i.className = 'tw-flash'; i.style.animationDelay = k * 0.15 + 's'; g.appendChild(i); return i; });
    f.classList.add('ringing');
    setTimeout(() => { f.classList.remove('ringing'); flashes.forEach((i) => i.remove()); }, 2400);
  }
  /** The set floors that are complete and have not rung yet ring their bell, once: the belfry tolls at once, a floor's own bell when it scrolls into view. Returns the sets. */
  function celebrate(root) {
    if (BR.reducedMotion) return [];                                   // Reduce Motion: no bell, and the floor stays unseen so a later view can still celebrate it
    const seen = bellsSeen();
    const fresh = Array.from(root.querySelectorAll('.tw-floor.done[data-set] > .tw-band > .tw-bell')).map((b) => b.parentNode.parentNode).filter((f) => !seen.has(f.dataset.set));
    if (!fresh.length) return [];
    fresh.forEach((f) => seen.add(f.dataset.set));
    remember(seen);
    fresh.slice(0, 3).forEach((f, i) => setTimeout(() => { if (root.isConnected) tollBelfry(root); }, 500 + i * 900));
    if (G.IntersectionObserver) {
      const io = new G.IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); ringFloor(e.target); } }), { threshold: 0.4 });
      fresh.forEach((f) => io.observe(f));
    } else fresh.forEach((f, i) => setTimeout(() => ringFloor(f), 600 + i * 500));
    return fresh.map((f) => f.dataset.set);
  }
  /** Call once the markup from html() is in the page (`root` is the element it went into, or the view itself). It builds the badges, rings the bell of a floor that
      was just completed, wires the "next floor" button, and calls opts.onItem(itemId, uid) / opts.onLocked(itemId) on a tap (the ones given to html() unless
      opts has its own); a caller that listens with event delegation on the data attributes can leave them out. */
  function afterRender(root, opts) {
    if (!root) return;
    const el = root.classList && root.classList.contains('tw') ? root : root.querySelector && root.querySelector('.tw');
    if (!el) return;
    const cfg = tower.cfg || {};
    el._tw = { A: attrNames((opts && opts.attrs) || cfg.A), onItem: (opts && opts.onItem) || cfg.onItem, onLocked: (opts && opts.onLocked) || cfg.onLocked };
    hydrate(el);
    celebrate(el);
    if (el._twBound) return;
    el._twBound = true;
    el.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('[data-tw-jump], .tw-win');
      if (!t) return;
      if (t.classList.contains('tw-win')) {                            // a window
        const h = el._tw, id = t.getAttribute(h.A.item), lock = t.getAttribute(h.A.locked);
        if (id && h.onItem) h.onItem(id, t.getAttribute(h.A.uid));
        else if (lock && h.onLocked) h.onLocked(lock);
        return;
      }
      const f = el.querySelector(`.tw-floor[data-set="${t.dataset.twJump}"]`);   // "2 items to finish the Library": show the floor
      if (!f) return;
      f.scrollIntoView({ block: 'center', behavior: BR.reducedMotion ? 'auto' : 'smooth' });
      f.classList.add('spot');
      setTimeout(() => f.classList.remove('spot'), 1600);
    });
  }

  const tower = (BR.Tower = { floors, extras, nextFloor, nextLine, summary, bestInst, html, afterRender, forget, KEY, best: null, cfg: null, rung: [], FLOORS });
})();
