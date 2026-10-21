/* Geode opening: drop-in, crack it yourself (3 taps), shatter, item reel, rarity reveal, try-it board. */
(function () {
  const BR = (window.BR = window.BR || {});
  const $ = (id) => document.getElementById(id);
  const sleep = BR.sleep;
  const REEL_EASE = 'cubic-bezier(0.1, 0.52, 0.1, 1)';
  const WIN_INDEX = 52;
  const TOTAL_CARDS = 70;
  const TAPS = 3;

  class GeodeUI {
    constructor({ fx, audio }) {
      this.fx = fx;
      this.audio = audio;
      this.root = $('geode');
      this.stage = $('geodeStage');
      this.btn = $('geodeBtn');
      this.svg = $('geodeSvg');
      this.cracks = Array.from(this.svg.querySelectorAll('.crack'));
      this.reelStage = $('reelStage');
      this.reelWin = $('reelWindow');
      this.strip = $('reelStrip');
      this.kicker = $('reelKicker');
      this.result = $('result');
      this.glow = $('geodeGlow');
      this.tryTimer = 0;
    }

    /* ---------------- helpers ---------------- */
    _randomItem() {
      const rar = BR.RARITIES;
      let total = rar.reduce((a, r) => a + r.weight, 0), roll = Math.random() * total, pick = rar[0];
      for (const r of rar) { roll -= r.weight; if (roll < 0) { pick = r; break; } }
      const pool = BR.ITEMS.filter((i) => i.rarity === pick.id);
      return pool[(Math.random() * pool.length) | 0];
    }

    _cardHTML(item, inst) {
      const r = BR.rarityById[item.rarity];
      return `<div class="rcard"><div class="rcard-in" style="--rc:${r.color}"><div class="rprev">${BR.Skins.previewHTML(item, inst)}</div><div class="rcard-name">${item.name}</div><div class="rcard-type">${BR.ITEM_TYPES[item.type].name}</div></div></div>`;
    }

    _buildReel(item, drop) {
      const winLevel = BR.rarityById[item.rarity].level;
      const list = [];
      for (let i = 0; i < TOTAL_CARDS; i++) list.push({ item: this._randomItem(), inst: null });
      list[WIN_INDEX] = { item, inst: { finish: drop.finish, seed: drop.seed } };
      // CS:GO-style tease: a bigger drop often sits right beside a smaller one.
      const hi = BR.ITEMS.filter((i) => BR.rarityById[i.rarity].level >= 4);
      if (winLevel < 4 && Math.random() < 0.55) list[WIN_INDEX + (Math.random() < 0.5 ? 1 : -1)] = { item: hi[(Math.random() * hi.length) | 0], inst: null };
      this.strip.innerHTML = list.map((c) => this._cardHTML(c.item, c.inst)).join('');
      this.cards = Array.from(this.strip.children);
    }

    _oddsHTML(kind) {
      if (kind === 'fusion') return '';
      const key = kind === 'series' ? 'series' : 'weight';
      const total = BR.RARITIES.reduce((a, r) => a + r[key], 0);
      return BR.RARITIES.map((r) => `<span style="--rc:${r.color}">${r.name} ${Math.round((r[key] / total) * 100)}%</span>`).join('');
    }

    _shake(el, ms, amp) {
      const frames = [], n = 20;
      for (let i = 0; i <= n; i++) {
        const k = 1 - i / n, s = i % 2 ? 1 : -1;
        frames.push({ transform: `translate(${(s * amp * k).toFixed(1)}px, ${(-(i % 3) * 1.4 * k).toFixed(1)}px) rotate(${(s * amp * 0.5 * k).toFixed(1)}deg)` });
      }
      return el.animate(frames, { duration: ms, easing: 'linear' });
    }

    /* ---------------- the whole sequence ---------------- */
    /**
     * @param {{kind:string, remaining:number, getDrop:()=>object}} o  getDrop consumes the Geode (called on the last tap,
     *        so closing early never wastes one)
     * @returns {Promise<null | {drop:object, choice:'equip'|'keep'|'dust'}>}
     */
    async run({ kind, remaining, getDrop, skipCrack = false }) {
      const { fx, audio } = this;
      const reduced = BR.reducedMotion;
      this.token = (this.token || 0) + 1;
      const token = this.token;

      // ----- reset -----
      this.root.dataset.phase = 'idle';
      this.root.classList.remove('blackout');
      this.root.style.setProperty('--rc', '#ffd66b');
      this.glow.style.opacity = 0;
      this.stage.classList.remove('on'); this.reelStage.classList.remove('on', 'settled'); this.result.classList.remove('on');
      this.strip.style.transform = ''; this.strip.getAnimations().forEach((a) => a.cancel());
      [this.svg, this.btn, ...this.svg.querySelectorAll('.g-half,.g-bands,.g-seam,.g-core,.g-cracks')].forEach((el) => el.getAnimations && el.getAnimations().forEach((a) => a.cancel()));
      this.cracks.forEach((c) => c.classList.remove('on'));
      this.btn.style.setProperty('--heat', 0);
      $('geodeRays').style.opacity = '';
      this.svg.querySelector('.g-core').setAttribute('opacity', 0);
      $('geodeTaps').querySelectorAll('i').forEach((i) => i.classList.remove('on'));
      $('geodePrompt').textContent = reduced ? 'Tap the Geode to open it' : 'Tap the Geode to crack it';
      $('geodeKicker').textContent = (kind === 'fusion' ? 'Fusion' : kind === 'series' ? 'Series Geode' : 'Geode') + (remaining > 1 ? ` · ${remaining} to open` : '');
      $('geodeOdds').innerHTML = this._oddsHTML(kind);
      $('reelTip').classList.remove('show');
      $('resultActions').getAnimations().forEach((a) => a.cancel());
      this.root.classList.add('show');
      this.root.setAttribute('aria-hidden', 'false');

      let drop, item, rarity;
      if (skipCrack) {
        // Fusion: no shell to crack, go straight to the reel.
        drop = getDrop(); item = BR.itemById[drop.itemId]; rarity = BR.rarityById[drop.rarity];
        this.root.dataset.phase = 'busy';
        fx.flash('#cfe4ff', 0.5, 500);
        await sleep(160);
      } else {
      // ----- 1. present the Geode, wait for three taps -----
      await sleep(60);
      this.stage.classList.add('on');
      audio.geodeDrop();

      const need = reduced ? 1 : TAPS;
      const closed = await new Promise((resolve) => {
        let taps = 0;
        const pips = $('geodeTaps').querySelectorAll('i');
        const cleanup = () => { this.btn.removeEventListener('click', onTap); $('btnGeodeClose').removeEventListener('click', onClose); window.removeEventListener('keydown', onKey, true); };
        const onClose = () => { cleanup(); resolve(true); };
        const onTap = () => {
          if (taps >= need) return;
          const i = taps++;
          if (reduced) pips.forEach((p) => p.classList.add('on')); else pips[i].classList.add('on');
          this._crack(reduced ? TAPS - 1 : i);
          if (taps >= need) { cleanup(); resolve(false); }
          else $('geodePrompt').textContent = taps === 1 ? 'Again!' : 'One more!';
        };
        const onKey = (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onTap(); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
        };
        this.btn.addEventListener('click', onTap);
        $('btnGeodeClose').addEventListener('click', onClose);
        window.addEventListener('keydown', onKey, true);
      });
      if (closed) { await this._hide(); return null; }

      // ----- 2. the drop is decided now; shatter the shell -----
      this.root.dataset.phase = 'busy';
      drop = getDrop(); item = BR.itemById[drop.itemId]; rarity = BR.rarityById[drop.rarity];
      const br = this.btn.getBoundingClientRect();
      const cx = br.left + br.width / 2, cy = br.top + br.height * 0.5;
      audio.rockShatter();
      fx.flash('#fff3d6', 0.8, 640);
      fx.explosion(cx, cy, '#ffb347', 1.2);
      fx.shards(cx, cy, '#6a6084', 30, 2.4, { size: 6, spread: 12, g: 1800, life: 0.7 });
      fx.shards(cx, cy, '#2a2336', 20, 1.9, { size: 5, spread: 10, g: 1800, life: 0.7 });
      fx.shake(this.root, 16, 560);
      if (navigator.vibrate) { try { navigator.vibrate([40, 30, 80]); } catch (e) { /* ignore */ } }
      const core = this.svg.querySelector('.g-core');
      core.setAttribute('opacity', 1);
      if (core.animate) core.animate([{ transform: 'scale(0.4)', opacity: 0.2 }, { transform: 'scale(2.4)', opacity: 1 }, { transform: 'scale(3.6)', opacity: 0 }], { duration: 800, fill: 'forwards', easing: 'ease-out' });
      const half = (sel, kf) => { const el = this.svg.querySelector(sel); if (el && el.animate) el.animate(kf, { duration: 650, easing: 'cubic-bezier(0.2,0.7,0.3,1)', fill: 'forwards' }); };
      half('.g-top', [{ transform: 'none', opacity: 1 }, { transform: 'translate(-46px,-110px) rotate(-38deg)', opacity: 0 }]);
      half('.g-bottom', [{ transform: 'none', opacity: 1 }, { transform: 'translate(34px,60px) rotate(12deg)', opacity: 0 }]);
      half('.g-bands', [{ opacity: 1 }, { opacity: 0 }]);
      half('.g-seam', [{ opacity: 1 }, { opacity: 0 }]);
      half('.g-cracks', [{ opacity: 1 }, { opacity: 0 }]);
      await sleep(reduced ? 200 : 780);
      if (token !== this.token) return null;
      this.stage.classList.remove('on');

      }

      // ----- 3. the reel -----
      this._buildReel(item, drop);
      this.kicker.textContent = 'Rolling';
      this.kicker.style.color = ''; this.kicker.style.textShadow = '';
      this.root.dataset.phase = 'reel';
      this.reelStage.classList.add('on');
      await sleep(120);
      const cardW = this.cards[0].getBoundingClientRect().width;
      const winW = this.reelWin.clientWidth;
      const jitter = (Math.random() * 2 - 1) * 0.34;
      const dist = WIN_INDEX * cardW + cardW / 2 + jitter * cardW - winW / 2;
      const duration = reduced ? 2400 : 6400;
      const anim = this.strip.animate([{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${-dist}px,0,0)` }], { duration, easing: REEL_EASE, fill: 'forwards' });

      let lastIdx = -1, lastX = 0, lastT = performance.now(), running = true;
      const loop = (now) => {
        if (!running) return;
        const x = -new DOMMatrixReadOnly(getComputedStyle(this.strip).transform).m41;
        const idx = Math.floor((x + winW / 2) / cardW);
        if (idx !== lastIdx) {
          if (lastIdx >= 0 && this.cards[lastIdx]) this.cards[lastIdx].classList.remove('active');
          if (this.cards[idx]) this.cards[idx].classList.add('active');
          if (lastIdx >= 0) audio.tick(Math.min(1, (Math.abs(x - lastX) / Math.max(1, now - lastT)) * 1000 / 3600));
          lastIdx = idx;
        }
        lastX = x; lastT = now;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      const speedUp = () => { try { anim.updatePlaybackRate(3.2); } catch (e) { /* ignore */ } this.reelStage.removeEventListener('pointerdown', speedUp); };
      const speedTimer = setTimeout(() => { this.reelStage.addEventListener('pointerdown', speedUp); $('reelTip').classList.add('show'); }, 900);
      try { await Promise.race([anim.finished, sleep(duration + 2000)]); } catch (e) { /* cancelled */ }
      clearTimeout(speedTimer);
      this.reelStage.removeEventListener('pointerdown', speedUp);
      $('reelTip').classList.remove('show');
      running = false;
      this.cards.forEach((c) => c.classList.remove('active'));

      // ----- 4. reveal (Celestial gets a blackout first) -----
      const lvl = rarity.level;
      if (lvl >= 5 && !reduced) { this.root.classList.add('blackout'); await sleep(1100); this.root.classList.remove('blackout'); }
      this.root.style.setProperty('--rc', rarity.color);
      this.result.style.setProperty('--rc', rarity.color);
      this.result.dataset.r = rarity.id;
      this.glow.style.opacity = String(0.18 + lvl * 0.1);
      this.reelStage.classList.add('settled');
      this.cards[WIN_INDEX].classList.add('win');
      this.kicker.textContent = rarity.name;
      this.kicker.style.color = rarity.color;
      this.kicker.style.textShadow = `0 0 24px ${rarity.color}`;
      audio.reveal(lvl);
      const mr = this.reelWin.getBoundingClientRect();
      fx.flash(rarity.color, Math.min(0.5, 0.14 + lvl * 0.07), 500 + lvl * 120);
      fx.explosion(mr.left + mr.width / 2, mr.top + mr.height / 2, rarity.color, 0.5 + lvl * 0.35);
      if (lvl >= 2) fx.shake(this.root, 4 + lvl * 3, 380 + lvl * 80);
      if (lvl >= 3) fx.confetti([rarity.color, '#ffffff', '#ffd66b'], 28 + lvl * 24);
      if (lvl >= 5) setTimeout(() => fx.confetti(['#ffd34a', '#fff2a8', '#ffffff'], 120), 500);
      await sleep(reduced ? 500 : 1100 + lvl * 220);
      if (token !== this.token) return null;

      // ----- 5. result card with a live try-it board -----
      $('resultRarity').textContent = rarity.name;
      $('resultType').textContent = BR.ITEM_TYPES[item.type].name;
      $('resultName').textContent = item.name;
      $('resultDesc').textContent = item.desc;
      $('resultNew').classList.toggle('show', !drop.dup);
      const fin = BR.finishById[drop.finish];
      $('resultBadges').innerHTML =
        (drop.finish !== 'matte' ? `<span class="badge finish-${fin.id}">${fin.name}</span>` : `<span class="badge">Matte</span>`) +
        (drop.tracker ? `<span class="badge tracker">Tracker: ${drop.tracker.stat}</span>` : '');
      const dustAmt = rarity.dust;
      $('btnEquip').textContent = 'Equip';
      $('btnKeep').textContent = drop.dup ? `Dust for +${dustAmt} Shards` : 'Keep in Vault';
      this._setupTry(item, drop);
      this.reelStage.classList.remove('on');
      this.result.classList.add('on');
      this.root.dataset.phase = 'result';
      this._startTry(item, drop);
      if (lvl >= 4) fx.shake(this.root, 7, 300);

      const choice = await new Promise((resolve) => {
        const eq = $('btnEquip'), kp = $('btnKeep');
        const finish = (v) => { eq.removeEventListener('click', onEq); kp.removeEventListener('click', onKp); window.removeEventListener('keydown', onKey, true); resolve(v); };
        const onEq = () => finish('equip');
        const onKp = () => finish(drop.dup ? 'dust' : 'keep');
        const onKey = (e) => {
          if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') { e.preventDefault(); e.stopPropagation(); finish('equip'); }
          else if (e.key === 'k' || e.key === 'K' || e.key === 'd' || e.key === 'D') { e.preventDefault(); e.stopPropagation(); onKp(); }
        };
        eq.addEventListener('click', onEq); kp.addEventListener('click', onKp);
        setTimeout(() => window.addEventListener('keydown', onKey, true), 700);
      });

      // ----- 6. outro -----
      this._stopTry();
      const card = $('resultCard');
      if (choice === 'equip') { audio.equip(); fx.flash(rarity.color, 0.35, 450); }
      else if (choice === 'dust') audio.scrap(); else audio.ui();
      card.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: choice === 'equip' ? 'scale(1.18)' : 'scale(0.25) translateY(40px)', opacity: 0 }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
      $('resultActions').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
      await sleep(380);
      await this._hide(remaining > 1);
      card.getAnimations().forEach((a) => a.cancel());
      $('resultActions').getAnimations().forEach((a) => a.cancel());
      return { drop, choice };
    }

    async _hide(keepOpen) {
      this.result.classList.remove('on');
      if (keepOpen) { this.glow.style.opacity = 0; return; }
      this.root.classList.remove('show');
      this.root.setAttribute('aria-hidden', 'true');
      await sleep(320);
      this.glow.style.opacity = 0;
    }

    /** One crack tap: draw a crack, heat the seams, shake, sparks, sound, haptics. */
    _crack(i) {
      const { fx, audio } = this;
      this.cracks[i].classList.add('on');
      this.btn.style.setProperty('--heat', (i + 1) / TAPS);
      audio.crack(i);
      const br = this.btn.getBoundingClientRect();
      const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
      fx.sparks(cx, cy, '#ffcf6b', 14 + i * 10, 1.2 + i * 0.5, 0.6);
      fx.ring(cx, cy, '#ffcf6b', 70 + i * 26, 0.45, 3);
      fx.shards(cx, cy, '#6a6084', 4 + i * 4, 1.1, { size: 4, spread: 6, g: 1700 });
      fx.shake(this.root, 4 + i * 5, 260);
      if (!BR.reducedMotion) this._shake(this.svg, 360, 5 + i * 3);
      $('geodeRays').style.opacity = String(0.35 + i * 0.3);
      if (navigator.vibrate) { try { navigator.vibrate(18 + i * 14); } catch (e) { /* ignore */ } }
    }

    /* ---------------- try-it board ---------------- */
    _setupTry(item, drop) {
      const P = BR.Progress;
      const eq = { facet: P.equipped('facet'), burst: P.equipped('burst'), arena: P.equipped('arena') };
      const showing = { facet: { item: eq.facet.item, finish: eq.facet.inst ? eq.facet.inst.finish : 'matte', seed: eq.facet.inst ? eq.facet.inst.seed : 0 }, arena: { item: eq.arena.item, finish: eq.arena.inst ? eq.arena.inst.finish : 'matte' } };
      if (item.type === 'facet') showing.facet = { item, finish: drop.finish, seed: drop.seed };
      if (item.type === 'arena') showing.arena = { item, finish: drop.finish };
      const wrap = $('tryWrap'), board = $('tryBoard');
      wrap.className = 'try-wrap ' + showing.arena.item.cls;
      wrap.dataset.afinish = showing.arena.finish;
      board.className = 'try ' + showing.facet.item.cls;
      board.dataset.ffinish = showing.facet.finish;
      board.style.setProperty('--ang', 160 + ((showing.facet.seed % 41) - 20) + 'deg');
      board.style.setProperty('--sx', (showing.facet.seed % 97) + 'px');
      const colors = [1, 3, 1, 3, 3, 3, 1, 3, 1];
      board.innerHTML = colors.map((c) => BR.Skins.brickHTML(c)).join('');
      this.tryCross = [1, 3, 4, 5, 7];
      this.tryBurst = item.type === 'burst' ? { recipe: item.recipe, finish: drop.finish } : { recipe: BR.Skins.burst, finish: BR.Skins.burstFinish };
    }

    _startTry() {
      this._stopTry();
      let first = true;
      const cycle = () => {
        const bricks = Array.from($('tryBoard').children);
        const center = bricks[4].getBoundingClientRect();
        const ox = center.left + center.width / 2, oy = center.top + center.height / 2;
        if (first) { this.audio.pop(5, 0, this.tryBurst.recipe === 'classic' ? null : this.tryBurst.recipe); first = false; }
        this.tryCross.forEach((idx, k) => {
          const b = bricks[idx], face = b.querySelector('.face'), r = b.getBoundingClientRect();
          const x = r.left + r.width / 2, y = r.top + r.height / 2;
          const pal = BR.PALETTE[3];
          face.animate([
            { transform: 'scale(1)', opacity: 1, filter: 'brightness(1)', offset: 0 },
            { transform: 'scale(1.22)', opacity: 1, filter: 'brightness(1.7)', offset: 0.12, easing: 'ease-in' },
            { transform: 'scale(0.05)', opacity: 0, filter: 'brightness(2)', offset: 0.22 },
            { transform: 'scale(0.05)', opacity: 0, filter: 'brightness(1)', offset: 0.58, easing: 'cubic-bezier(0.34,1.56,0.64,1)' },
            { transform: 'scale(1.1)', opacity: 1, offset: 0.8 },
            { transform: 'scale(1)', opacity: 1, offset: 1 },
          ], { duration: 1300, delay: k * 35, easing: 'ease-out' });
          setTimeout(() => {
            this.fx.pop(this.tryBurst.recipe, x, y, pal.glow, pal.hi, 5, 0.8, this.tryBurst.finish);
            if (this.tryBurst.recipe === 'lightning' && idx !== 4) this.fx.bolt(ox, oy, x, y, pal.hi);
          }, k * 35 + 70);
        });
      };
      const run = cycle;
      run();
      this.tryTimer = setInterval(run, 2300);
    }

    _stopTry() { clearInterval(this.tryTimer); this.tryTimer = 0; }
  }

  BR.GeodeUI = GeodeUI;
})();
