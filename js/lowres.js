/* Low-resolution glows (Mobile mode, Update 8). The chest's light rays and the menu's colour blobs are soft gradients on huge layers
   (1,100 px and 767 px squares): at three times the pixel density each one holds 20 to 50 MB of graphics memory, which is what makes a
   phone stutter when a chest opens. A soft gradient has no detail to lose, so Mobile mode draws each into a small canvas once and lets
   CSS scale it up: the same look, a fraction of the pixels. */
(function () {
  const BR = window.BR = window.BR || {};

  /** '#rrggbb', '#rgb' or 'rgb(a)(...)' to [r, g, b]. */
  const rgb = (c) => {
    c = String(c || '').trim();
    let m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return m[1].split('').map((h) => parseInt(h + h, 16));
    m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) return m[1].split(',').slice(0, 3).map((x) => +x);
    return [255, 255, 255];
  };

  BR.LowRes = {
    rgb,
    /** Rays: `ray` degrees lit out of every `period`, in `color` at `alpha`, fading to nothing at the rim. Same picture as
        `repeating-conic-gradient(color a, transparent)` under `radial-gradient(circle, #000, transparent 71%)` (css/chest.css). */
    rays(cv, color, alpha, ray, period, size) {
      size = size || 256;
      if (cv.width !== size) cv.width = cv.height = size;
      const g = cv.getContext('2d'), c = size / 2, k = Array.isArray(color) ? color : rgb(color);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, size, size);
      g.fillStyle = `rgba(${k[0]},${k[1]},${k[2]},${alpha})`;
      for (let a = 0; a < 360; a += period) {
        g.beginPath(); g.moveTo(c, c);
        g.arc(c, c, size, (a - 90) * Math.PI / 180, (a + ray - 90) * Math.PI / 180);
        g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'destination-in';
      const m = g.createRadialGradient(c, c, 0, c, c, size * 0.502);
      m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = m; g.fillRect(0, 0, size, size);
      g.globalCompositeOperation = 'source-over';
    },
    /** A colour blob: the radial gradient of `.blob` (css/base.css), drawn small. */
    blob(cv, color, size) {
      size = size || 128;
      cv.width = cv.height = size;
      const g = cv.getContext('2d'), c = size / 2, k = rgb(color), r = size * 0.7071;
      const m = g.createRadialGradient(c, c, 0, c, c, r);
      m.addColorStop(0, `rgb(${k[0]},${k[1]},${k[2]})`);
      m.addColorStop(0.22, `rgba(${k[0]},${k[1]},${k[2]},0.55)`);
      m.addColorStop(0.42, `rgba(${k[0]},${k[1]},${k[2]},0.2)`);
      m.addColorStop(0.66, `rgba(${k[0]},${k[1]},${k[2]},0)`);
      g.clearRect(0, 0, size, size); g.fillStyle = m; g.fillRect(0, 0, size, size);
    },
    /** A canvas that takes the place of an element and keeps its classes (so its size, position and animation stay as they were). */
    replace(el, draw) {
      const cv = document.createElement('canvas');
      cv.className = el.className; cv.setAttribute('aria-hidden', 'true');
      draw(cv);
      el.replaceWith(cv);
      return cv;
    },
  };
})();
