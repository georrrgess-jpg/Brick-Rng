/* Visual effects: canvas particles, rings, confetti, screen shake and flashes. */
(function () {
  const BR = (window.BR = window.BR || {});

  class FX {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.parts = [];
      this.rings = [];
      this.bolts = [];
      this.running = false;
      this.last = 0;
      this.scale = 1;
      this.settings = { shake: true, reduced: false };
      this.resize = this.resize.bind(this);
      window.addEventListener('resize', this.resize);
      this.resize();
      this.loop = this.loop.bind(this);
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.scale = dpr;
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
    }

    get budget() { return this.settings.reduced ? 0.35 : 1; }

    _kick() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this.loop);
    }

    /** Brick shards flying out and falling. */
    shards(x, y, color, count = 8, power = 1, o = {}) {
      count = Math.round(count * this.budget);
      for (let i = 0; i < count && this.parts.length < 520; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (120 + Math.random() * 360) * power;
        this.parts.push({
          kind: 'shard', shape: o.shape || 'rect', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150 * power,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 16,
          size: (o.size || 4) + Math.random() * (o.spread || 7), life: 0, max: (o.life || 0.55) + Math.random() * 0.5,
          color, g: o.g != null ? o.g : 1500, drag: o.drag != null ? o.drag : 0.6,
        });
      }
      this._kick();
    }

    /** Generic one-off particle with sensible defaults. */
    emit(p) {
      if (this.parts.length >= 520) return;
      this.parts.push(Object.assign({ kind: 'shard', shape: 'rect', vx: 0, vy: 0, rot: 0, vr: 0, size: 4, life: 0, max: 0.8, color: '#fff', g: 0, drag: 1 }, p));
      this._kick();
    }

    /**
     * One brick's worth of pop effect for the equipped Burst. `finish` adds sparkle layers:
     * gloss = white glints, holo = rainbow sparks, prism = rainbow sparks plus a ring.
     */
    pop(recipe, x, y, glow, hi, count, power = 1, finish = 'matte') {
      const R = ['#ff6b9a', '#ffd36b', '#6bffb2', '#6bb8ff', '#c08bff'];
      const rnd = (a, b) => a + Math.random() * (b - a);
      const n = Math.max(1, Math.round(count * this.budget));
      switch (recipe) {
        case 'ember': {
          const cols = ['#ff9a3d', '#ffcf3f', '#ff5468', glow];
          for (let i = 0; i < Math.ceil(n * 1.4); i++) this.emit({ kind: 'spark', x: x + rnd(-8, 8), y, vx: rnd(-90, 90), vy: rnd(-260, -60), g: -90, drag: 1.1, size: rnd(1.8, 4.2), max: rnd(0.8, 1.5), color: cols[(Math.random() * cols.length) | 0] });
          this.shards(x, y, glow, Math.ceil(n / 3), 0.55);
          break;
        }
        case 'petal': {
          const cols = [glow, '#ffd1e6', '#ffffff', hi];
          for (let i = 0; i < Math.ceil(n * 0.9); i++) this.emit({ kind: 'shard', shape: 'petal', x, y, vx: rnd(-150, 150), vy: rnd(-220, -40), g: 150, drag: 1.3, rot: rnd(0, 6.28), vr: rnd(-6, 6), size: rnd(5, 9), max: rnd(1.2, 2), color: cols[(Math.random() * cols.length) | 0], sway: rnd(0, 6.28) });
          break;
        }
        case 'glass':
          this.shards(x, y, '#dff7ff', Math.ceil(n * 1.4), 1.05, { shape: 'tri', size: 5, spread: 8, life: 0.6, g: 1300 });
          this.sparks(x, y, '#ffffff', Math.ceil(n / 2), 1.2, 0.4);
          break;
        case 'pixel': {
          const cols = [glow, hi, '#ffffff'];
          for (let i = 0; i < Math.ceil(n * 1.6); i++) {
            const a = ((Math.random() * 4) | 0) * 1.5708 + (Math.random() < 0.5 ? 0 : 0.785);
            const sp = rnd(120, 420);
            this.emit({ kind: 'shard', shape: 'pixel', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 200, drag: 3.2, size: 3 + ((Math.random() * 3) | 0) * 2, spread: 0, max: rnd(0.35, 0.7), color: cols[(Math.random() * cols.length) | 0] });
          }
          break;
        }
        case 'lightning':
          this.sparks(x, y, '#d6e8ff', Math.ceil(n * 1.1), 1.3, 0.35);
          this.shards(x, y, glow, Math.ceil(n / 2), 0.7);
          break;
        default:
          this.shards(x, y, glow, n, power);
          this.sparks(x, y, hi, Math.ceil(n / 3), 0.8, 0.5);
      }
      if (finish === 'gloss') this.sparks(x, y, '#ffffff', 3, 0.9, 0.35);
      else if (finish === 'holo' || finish === 'prism') {
        for (let i = 0; i < (finish === 'prism' ? 9 : 5); i++) this.emit({ kind: 'spark', x, y, vx: rnd(-260, 260), vy: rnd(-260, 200), g: 60, drag: 2, size: rnd(1.6, 3.4), max: rnd(0.5, 0.9), color: R[(Math.random() * R.length) | 0] });
        if (finish === 'prism') this.ring(x, y, R[(Math.random() * R.length) | 0], 46, 0.4, 3);
      }
    }

    /** A jagged lightning bolt that flickers out. */
    bolt(x0, y0, x1, y1, color = '#cfe4ff') {
      if (this.settings.reduced) return;
      const pts = [{ x: x0, y: y0 }];
      const segs = 7, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      for (let i = 1; i < segs; i++) {
        const t = i / segs, j = (Math.random() - 0.5) * Math.min(34, len * 0.28);
        pts.push({ x: x0 + dx * t + nx * j, y: y0 + dy * t + ny * j });
      }
      pts.push({ x: x1, y: y1 });
      this.bolts.push({ pts, color, life: 0, max: 0.34 });
      this._kick();
    }

    /** Soft glowing sparkles. */
    sparks(x, y, color, count = 10, power = 1, life = 0.6) {
      count = Math.round(count * this.budget);
      for (let i = 0; i < count && this.parts.length < 520; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (80 + Math.random() * 300) * power;
        this.parts.push({
          kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          size: 1.5 + Math.random() * 3, life: 0, max: life * (0.6 + Math.random() * 0.8),
          color, g: 120, drag: 2.4,
        });
      }
      this._kick();
    }

    ring(x, y, color, radius = 90, life = 0.5, width = 4) {
      if (this.settings.reduced) return;
      this.rings.push({ x, y, color, radius, life: 0, max: life, width });
      this._kick();
    }

    /** Falling paper confetti raining from above (crate reveals). */
    confetti(colors, count = 80, originY = -20) {
      count = Math.round(count * this.budget);
      for (let i = 0; i < count && this.parts.length < 520; i++) {
        this.parts.push({
          kind: 'conf', x: Math.random() * this.w, y: originY - Math.random() * 120,
          vx: (Math.random() - 0.5) * 140, vy: 120 + Math.random() * 260,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 12, sway: Math.random() * 6.28,
          size: 6 + Math.random() * 7, life: 0, max: 2.2 + Math.random() * 1.6,
          color: colors[(Math.random() * colors.length) | 0], g: 40, drag: 0.4,
        });
      }
      this._kick();
    }

    /** Radial burst of glowing particles + shards (crate reveal). */
    explosion(x, y, color, power = 1) {
      this.ring(x, y, color, 160 * power, 0.7, 6);
      this.ring(x, y, '#ffffff', 110 * power, 0.45, 3);
      this.sparks(x, y, color, 46 * power, 2.4, 1.1);
      this.sparks(x, y, '#ffffff', 24 * power, 1.8, 0.8);
      this.shards(x, y, color, 14 * power, 1.7);
    }

    loop(now) {
      const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
      this.last = now;
      const { ctx, scale } = this;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);

      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.life += dt;
        const t = r.life / r.max;
        if (t >= 1) { this.rings.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - t, 3);
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width * (1 - t) + 0.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius * e, 0, 6.2832);
        ctx.stroke();
      }

      for (let i = this.bolts.length - 1; i >= 0; i--) {
        const b = this.bolts[i];
        b.life += dt;
        const t = b.life / b.max;
        if (t >= 1) { this.bolts.splice(i, 1); continue; }
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - t) * (Math.random() < 0.3 ? 0.4 : 1);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        for (const [w, col] of [[11, b.color], [4, "#ffffff"]]) {
          ctx.strokeStyle = col; ctx.lineWidth = w * (1 - t * 0.5);
          ctx.beginPath(); ctx.moveTo(b.pts[0].x, b.pts[0].y);
          for (let k = 1; k < b.pts.length; k++) ctx.lineTo(b.pts[k].x, b.pts[k].y);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life += dt;
        if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
        const t = p.life / p.max;
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp; p.vy = p.vy * damp + p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.kind === 'conf') p.x += Math.sin(p.life * 4 + p.sway) * 60 * dt;
        else if (p.shape === 'petal') p.x += Math.sin(p.life * 5 + p.sway) * 40 * dt;
        if (p.rot !== undefined) p.rot += p.vr * dt;

        if (p.kind === 'spark') {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - t) * 0.95;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - t * 0.6), 0, 6.2832);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        } else {
          ctx.globalAlpha = p.kind === 'conf' ? Math.min(1, (1 - t) * 3) : Math.min(1, (1 - t) * 1.8);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          if (p.kind === 'conf') {
            ctx.scale(1, Math.cos(p.life * 7 + p.sway));
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          } else {
            const s = p.size * (1 - t * 0.35);
            if (p.shape === 'tri') { ctx.beginPath(); ctx.moveTo(0, -s * 0.85); ctx.lineTo(s * 0.7, s * 0.6); ctx.lineTo(-s * 0.7, s * 0.6); ctx.closePath(); ctx.fill(); }
            else if (p.shape === 'petal') { ctx.beginPath(); ctx.ellipse(0, 0, s * 0.95, s * 0.45, 0, 0, 6.2832); ctx.fill(); }
            else ctx.fillRect(-s / 2, -s / 2, s, s);
          }
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;

      if (this.parts.length || this.rings.length || this.bolts.length) requestAnimationFrame(this.loop);
      else { this.running = false; ctx.clearRect(0, 0, this.w, this.h); }
    }

    /** Decaying random camera shake on an element. */
    shake(el, intensity = 6, dur = 360) {
      if (!this.settings.shake || this.settings.reduced || !el || !el.animate) return;
      const steps = Math.max(4, Math.round(dur / 40));
      const frames = [];
      for (let i = 0; i <= steps; i++) {
        const k = 1 - i / steps;
        const a = Math.random() * 6.283;
        frames.push({ transform: i === steps ? 'translate(0,0) rotate(0)' : `translate(${(Math.cos(a) * intensity * k).toFixed(2)}px, ${(Math.sin(a) * intensity * k).toFixed(2)}px) rotate(${(((Math.random() - 0.5) * intensity) / 14 * k).toFixed(2)}deg)` });
      }
      el.animate(frames, { duration: dur, easing: 'linear' });
    }

    flash(color = '#fff', alpha = 0.5, dur = 380) {
      const el = document.getElementById('flash');
      if (!el || !el.animate || this.settings.reduced) return;
      el.style.background = color;
      el.animate([{ opacity: alpha }, { opacity: 0 }], { duration: dur, easing: 'ease-out' });
    }
  }

  BR.FX = FX;
})();
