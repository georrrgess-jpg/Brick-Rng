/* Applies the equipped Skin / Pop / Board / Fuse, renders item previews, and plays signature moments. */
(function () {
  const BR = (window.BR = window.BR || {});

  BR.Skins = {
    pop: 'classic',
    popShine: 'plain',
    beam: '#9ff0ff',
    moments: {},      // item moment keys currently active (e.g. { fireworks: true })
    fuseCls: 'fuse-classic',

    /** Re-read the loadout and restyle the page. */
    apply() {
      const root = document.documentElement;
      const P = BR.Progress;
      const sk = P.equipped('skin'), po = P.equipped('pop'), bo = P.equipped('board'), fu = P.equipped('fuse');
      Array.from(root.classList).filter((c) => /^board-/.test(c)).forEach((c) => root.classList.remove(c));
      root.classList.add(bo.item.cls);
      root.dataset.ashine = bo.inst ? bo.inst.shine : 'plain';
      const seed = sk.inst ? sk.inst.seed : 0;
      document.querySelectorAll('[data-skin-host]').forEach((el) => {
        Array.from(el.classList).filter((c) => /^skin-/.test(c)).forEach((c) => el.classList.remove(c));
        el.classList.add(sk.item.cls);
        el.dataset.shine = sk.inst ? sk.inst.shine : 'plain';
        el.style.setProperty('--ang', 160 + ((seed % 41) - 20) + 'deg');
        el.style.setProperty('--sx', (seed % 97) + 'px');
      });
      document.querySelectorAll('[data-fuse-host]').forEach((el) => {
        Array.from(el.classList).filter((c) => /^fuse-/.test(c)).forEach((c) => el.classList.remove(c));
        el.classList.add(fu.item.cls);
        el.dataset.shine = fu.inst ? fu.inst.shine : 'plain';
      });
      this.pop = po.item.recipe;
      this.popShine = po.inst ? po.inst.shine : 'plain';
      this.beam = bo.item.beam;
      this.fuseCls = fu.item.cls;
      this.moments = {};
      [sk, po, bo, fu].forEach((x) => { if (x.item.moment) this.moments[x.item.moment] = true; });
      root.classList.toggle('has-nova', !!this.moments.nova);
    },

    brickHTML(color) {
      return `<div class="brick" data-c="${color}"><div class="face"><i class="stud"></i><b class="deco"></b><b class="sheen"></b></div></div>`;
    },

    /** Small live preview of an item: used on cards, sheets, the reel and the result. */
    previewHTML(item, inst, o = {}) {
      const shine = inst ? inst.shine : 'plain';
      if (item.type === 'skin') {
        const seed = inst ? inst.seed : 0;
        const style = `--ang:${160 + ((seed % 41) - 20)}deg;--sx:${seed % 97}px`;
        return `<div class="mini-bricks ${item.cls}" data-shine="${shine}" style="${style}">${[0, 1, 3].map((c) => this.brickHTML(c)).join('')}</div>`;
      }
      if (item.type === 'pop') {
        const dots = Array.from({ length: 10 }, (_, i) => `<i style="--a:${i * 36}deg"></i>`).join('');
        return `<div class="mini-burst" style="--c:${item.color}">${dots}</div>`;
      }
      if (item.type === 'board') return `<div class="mini-board ${item.cls} ${o.live ? 'live' : ''}" data-ashine="${shine}">${o.live ? '<b class="scene-fx"></b><b class="scene-fx b"></b>' : ''}<i></i></div>`;
      return `<div class="mini-fuse ${item.cls}" data-shine="${shine}"><span class="mf-bomb"></span><span class="mf-track"><i class="mf-fill"></i><b class="mf-spark"></b></span></div>`;
    },
  };
})();
