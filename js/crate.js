/* Crate opening: drop-in crate, charge-up, burst, CS:GO-style reel, reveal, equip/scrap choice. */
(function () {
  const BR = (window.BR = window.BR || {});
  const $ = (id) => document.getElementById(id);
  const sleep = BR.sleep;
  const REEL_EASE = 'cubic-bezier(0.1, 0.52, 0.1, 1)';
  const WIN_INDEX = 52;
  const TOTAL_CARDS = 70;

  class CrateUI {
    constructor({ fx, audio }) {
      this.fx = fx;
      this.audio = audio;
      this.root = $('crate');
      this.stage = $('crateStage');
      this.box = $('crateBox');
      this.svg = this.box.querySelector('.crate-svg');
      this.lid = this.box.querySelector('.crate-lid');
      this.inner = this.box.querySelector('.crate-inner');
      this.rays = $('crateRays');
      this.openBtn = $('btnOpenCrate');
      this.reelStage = $('reelStage');
      this.reelWin = $('reelWindow');
      this.strip = $('reelStrip');
      this.kicker = $('reelKicker');
      this.result = $('result');
      this.glow = $('crateGlow');
      this.cleanups = [];
    }

    /* Waits for a click on `el` (or one of `keys`). */
    _wait(el, keys = []) {
      return new Promise((resolve) => {
        const done = (v) => { el.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey, true); resolve(v); };
        const onClick = () => done(true);
        const onKey = (e) => { if (keys.includes(e.key)) { e.preventDefault(); e.stopPropagation(); done(true); } };
        el.addEventListener('click', onClick);
        window.addEventListener('keydown', onKey, true);
      });
    }

    _randomCore(minLevel = 0) {
      const r = BR.RARITIES.filter((x) => x.level >= minLevel);
      const rarity = (() => {
        let total = r.reduce((a, x) => a + x.weight, 0), roll = Math.random() * total;
        for (const x of r) { roll -= x.weight; if (roll < 0) return x; }
        return r[r.length - 1];
      })();
      const pool = BR.CORES.filter((c) => c.rarity === rarity.id);
      return pool[(Math.random() * pool.length) | 0];
    }

    _cardHTML(core) {
      const r = BR.rarityById[core.rarity];
      return `<div class="rcard"><div class="rcard-in" style="--rc:${r.color}"><div class="core-ico" style="--rc:${r.color}">${BR.icon(core)}</div><div class="rcard-name">${core.name}</div></div></div>`;
    }

    _buildReel(win) {
      const winLevel = BR.rarityById[win.rarity].level;
      const cores = [];
      for (let i = 0; i < TOTAL_CARDS; i++) cores.push(this._randomCore());
      cores[WIN_INDEX] = win;
      // CS:GO-style tease: a big drop often sits right next to a smaller one.
      if (winLevel < 4 && Math.random() < 0.55) cores[WIN_INDEX + (Math.random() < 0.5 ? 1 : -1)] = this._randomCore(4);
      else if (winLevel < 3 && Math.random() < 0.5) cores[WIN_INDEX + 1] = this._randomCore(3);
      this.strip.innerHTML = cores.map((c) => this._cardHTML(c)).join('');
      this.cards = Array.from(this.strip.children);
    }

    _oddsHTML() {
      const total = BR.RARITIES.reduce((a, r) => a + r.weight, 0);
      return BR.RARITIES.map((r) => `<span style="--rc:${r.color}">${r.name} ${Math.round((r.weight / total) * 100)}%</span>`).join('');
    }

    _shakeCrate(ms) {
      const frames = [];
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const k = Math.pow(i / n, 1.6);
        const s = i % 2 ? 1 : -1;
        frames.push({ transform: `translate(${(s * (2 + k * 9)).toFixed(1)}px, ${((i % 3) * -1.5 * k).toFixed(1)}px) rotate(${(s * (1 + k * 7)).toFixed(1)}deg) scale(${(1 + k * 0.08).toFixed(3)})` });
      }
      return this.svg.animate(frames, { duration: ms, easing: 'linear', fill: 'forwards' });
    }

    /**
     * Run the whole crate sequence for a pre-rolled `core`.
     * Resolves to 'equip' or 'scrap'.
     */
    async run({ core, isNew, current }) {
      const rarity = BR.rarityById[core.rarity];
      const reduced = BR.reducedMotion;
      const { fx, audio } = this;

      // ----- reset -----
      this.root.style.setProperty('--rc', '#ffd66b');
      this.glow.style.opacity = 0;
      this.stage.classList.remove('on'); this.reelStage.classList.remove('on', 'settled'); this.result.classList.remove('on');
      this.strip.style.transform = ''; this.strip.getAnimations().forEach((a) => a.cancel());
      this.svg.getAnimations().forEach((a) => a.cancel()); this.lid.getAnimations().forEach((a) => a.cancel()); this.inner.getAnimations().forEach((a) => a.cancel());
      this.inner.setAttribute('opacity', 0);
      this.rays.style.opacity = ''; this.rays.getAnimations().forEach((a) => a.cancel());
      this.openBtn.style.visibility = ''; this.openBtn.disabled = false;
      $('crateOdds').innerHTML = this._oddsHTML();
      this.root.classList.add('show');
      this.root.setAttribute('aria-hidden', 'false');

      // ----- 1. crate drops in, wait for the player -----
      await sleep(60);
      this.stage.classList.add('on');
      audio.crateDrop();
      await this._wait(this.openBtn, ['Enter', ' ']);
      this.openBtn.disabled = true;
      audio.ui();

      // ----- 2. charge up + burst -----
      const charge = reduced ? 450 : 1150;
      audio.chargeUp(charge / 1000);
      this.openBtn.style.visibility = 'hidden';
      if (!reduced) {
        this._shakeCrate(charge);
        this.rays.animate([{ opacity: 0.35 }, { opacity: 0.95 }], { duration: charge, fill: 'forwards', easing: 'ease-in' });
      }
      await sleep(charge);

      const br = this.box.getBoundingClientRect();
      const cx = br.left + br.width / 2, cy = br.top + br.height * 0.42;
      audio.boom();
      fx.flash('#fff6d6', 0.75, 520);
      fx.explosion(cx, cy, '#ffd66b', 1.1);
      fx.shake(this.root, 14, 520);
      this.inner.setAttribute('opacity', 1);
      if (this.lid.animate) {
        this.lid.animate([
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: 'translate(-10px,-66px) rotate(-34deg)', opacity: 1, offset: 0.5 },
          { transform: 'translate(-40px,-30px) rotate(-70deg)', opacity: 0 },
        ], { duration: 560, easing: 'cubic-bezier(0.2,0.8,0.3,1)', fill: 'forwards' });
      }
      this.svg.animate([{ transform: 'scale(1.1)' }, { transform: 'scale(1.35)', opacity: 0 }], { duration: 620, delay: 120, easing: 'ease-in', fill: 'forwards' });
      await sleep(reduced ? 200 : 520);
      this.stage.classList.remove('on');

      // ----- 3. the reel -----
      this._buildReel(core);
      this.kicker.textContent = 'Rolling';
      this.kicker.style.color = ''; this.kicker.style.textShadow = '';
      this.reelStage.classList.add('on');
      await sleep(120);

      const cardW = this.cards[0].getBoundingClientRect().width;
      const winW = this.reelWin.clientWidth;
      const jitter = (Math.random() * 2 - 1) * 0.34;
      const target = WIN_INDEX * cardW + cardW / 2 + jitter * cardW;
      const dist = target - winW / 2;
      const duration = reduced ? 2400 : 6400;
      const anim = this.strip.animate(
        [{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${-dist}px,0,0)` }],
        { duration, easing: REEL_EASE, fill: 'forwards' },
      );

      // tick sounds + active card highlight, locked to the real rendered position
      let lastIdx = -1, lastX = 0, lastT = performance.now(), running = true;
      const loop = (now) => {
        if (!running) return;
        const m = new DOMMatrixReadOnly(getComputedStyle(this.strip).transform);
        const x = -m.m41;
        const idx = Math.floor((x + winW / 2) / cardW);
        if (idx !== lastIdx) {
          if (lastIdx >= 0 && this.cards[lastIdx]) this.cards[lastIdx].classList.remove('active');
          if (this.cards[idx]) this.cards[idx].classList.add('active');
          const v = Math.abs(x - lastX) / Math.max(1, now - lastT) * 1000;
          if (lastIdx >= 0) audio.tick(Math.min(1, v / 3600));
          lastIdx = idx;
        }
        lastX = x; lastT = now;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      // tap anywhere to speed up
      const speedUp = () => { try { anim.updatePlaybackRate(3.2); } catch (e) { /* ignore */ } this.reelStage.removeEventListener('pointerdown', speedUp); };
      const speedTimer = setTimeout(() => this.reelStage.addEventListener('pointerdown', speedUp), 900);

      try { await Promise.race([anim.finished, sleep(duration + 2000)]); } catch (e) { /* cancelled */ }
      clearTimeout(speedTimer);
      this.reelStage.removeEventListener('pointerdown', speedUp);
      running = false;

      // guarantee the committed result is what sits under the marker
      const m = new DOMMatrixReadOnly(getComputedStyle(this.strip).transform);
      const finalIdx = Math.floor((-m.m41 + winW / 2) / cardW);
      this.cards.forEach((c) => c.classList.remove('active'));
      if (finalIdx !== WIN_INDEX) console.warn('reel landed on', finalIdx, 'expected', WIN_INDEX);

      // ----- 4. reveal -----
      const lvl = rarity.level;
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
      if (lvl >= 5) setTimeout(() => fx.confetti(['#ffd700', '#fff2a8', '#ffffff'], 120), 500);
      await sleep(reduced ? 500 : 1100 + lvl * 220);

      // ----- 5. result card + choice -----
      $('resultRarity').textContent = rarity.name;
      $('resultIcon').innerHTML = BR.icon(core);
      $('resultName').textContent = core.name;
      $('resultDesc').textContent = core.desc;
      $('resultNew').classList.toggle('show', !!isNew);
      $('resultReplace').textContent = current ? `Equipping replaces ${current.name}` : 'Nothing equipped yet';
      $('scrapAmt').textContent = '+' + rarity.scrap;
      $('btnEquip').textContent = current && current.id === core.id ? 'Re-equip' : 'Equip';
      this.reelStage.classList.remove('on');
      this.result.classList.add('on');
      if (lvl >= 4) fx.shake(this.root, 7, 300);

      const choice = await new Promise((resolve) => {
        const eq = $('btnEquip'), sc = $('btnScrap');
        const finish = (v) => { eq.removeEventListener('click', onEq); sc.removeEventListener('click', onSc); window.removeEventListener('keydown', onKey, true); resolve(v); };
        const onEq = () => finish('equip'), onSc = () => finish('scrap');
        const onKey = (e) => {
          if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') { e.preventDefault(); e.stopPropagation(); finish('equip'); }
          else if (e.key === 's' || e.key === 'S') { e.preventDefault(); e.stopPropagation(); finish('scrap'); }
        };
        eq.addEventListener('click', onEq); sc.addEventListener('click', onSc);
        setTimeout(() => window.addEventListener('keydown', onKey, true), 700);
      });

      // ----- 6. outro -----
      const card = $('resultCard');
      if (choice === 'equip') {
        audio.equip();
        fx.flash(rarity.color, 0.35, 450);
        card.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.2)', opacity: 0 }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
      } else {
        audio.scrap();
        card.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.2) rotate(8deg)', opacity: 0 }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
      }
      $('btnEquip').parentElement.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
      await sleep(360);
      this.root.classList.remove('show');
      this.root.setAttribute('aria-hidden', 'true');
      await sleep(320);
      this.result.classList.remove('on');
      card.getAnimations().forEach((a) => a.cancel());
      $('btnEquip').parentElement.getAnimations().forEach((a) => a.cancel());
      this.glow.style.opacity = 0;
      return choice;
    }
  }

  BR.CrateUI = CrateUI;
})();
