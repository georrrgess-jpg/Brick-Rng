/* Visual effects: canvas particles, rings, confetti, screen shake and flashes. */
(function () {
  const BR = (window.BR = window.BR || {});

  class FX {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.parts = [];
      this.rings = [];
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
    shards(x, y, color, count = 8, power = 1) {
      count = Math.round(count * this.budget);
      for (let i = 0; i < count && this.parts.length < 520; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (120 + Math.random() * 360) * power;
        this.parts.push({
          kind: 'shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150 * power,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 16,
          size: 4 + Math.random() * 7, life: 0, max: 0.55 + Math.random() * 0.5,
          color, g: 1500, drag: 0.6,
        });
      }
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

      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life += dt;
        if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
        const t = p.life / p.max;
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp; p.vy = p.vy * damp + p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.kind === 'conf') p.x += Math.sin(p.life * 4 + p.sway) * 60 * dt;
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
            ctx.fillRect(-s / 2, -s / 2, s, s);
          }
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;

      if (this.parts.length || this.rings.length) requestAnimationFrame(this.loop);
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
