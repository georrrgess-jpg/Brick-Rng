/* Applies the equipped loadout (Facet, Burst, Arena) and renders item previews. */
(function () {
  const BR = (window.BR = window.BR || {});

  const FINISH_ATTR = { facet: 'ffinish', burst: 'bfinish', arena: 'afinish' };

  BR.Skins = {
    burst: 'classic',
    burstFinish: 'matte',
    beam: '#9ff0ff',

    /** Re-read the loadout and restyle the whole page. */
    apply() {
      const root = document.documentElement;
      const f = BR.Progress.equipped('facet'), b = BR.Progress.equipped('burst'), a = BR.Progress.equipped('arena');
      // Arena styles the whole page. The Facet applies only to real bricks (board + menu), never to previews.
      Array.from(root.classList).filter((c) => /^arena-/.test(c)).forEach((c) => root.classList.remove(c));
      root.classList.add(a.item.cls);
      root.dataset.afinish = a.inst ? a.inst.finish : 'matte';
      root.dataset.bfinish = b.inst ? b.inst.finish : 'matte';
      const seed = f.inst ? f.inst.seed : 0;
      for (const id of ['field', 'menuBricks']) {
        const el = document.getElementById(id);
        if (!el) continue;
        Array.from(el.classList).filter((c) => /^facet-/.test(c)).forEach((c) => el.classList.remove(c));
        el.classList.add(f.item.cls);
        el.dataset.ffinish = f.inst ? f.inst.finish : 'matte';
        el.style.setProperty('--ang', 160 + ((seed % 41) - 20) + 'deg');
        el.style.setProperty('--sx', (seed % 97) + 'px');
      }
      this.burst = b.item.recipe;
      this.burstFinish = root.dataset.bfinish;
      this.beam = a.item.beam;
    },

    /** Brick markup shared by the board, previews and menu. */
    brickHTML(color) {
      return `<div class="brick" data-c="${color}"><div class="face"><i class="stud"></i><b class="deco"></b><b class="sheen"></b></div></div>`;
    },

    /**
     * Small live preview of an item (used on reel cards, Vault cards and the result screen).
     * `inst` supplies Finish and pattern seed; without it the item shows at Matte.
     */
    previewHTML(item, inst) {
      const finish = inst ? inst.finish : 'matte';
      if (item.type === 'facet') {
        const seed = inst ? inst.seed : 0;
        const style = `--ang:${160 + ((seed % 41) - 20)}deg;--sx:${seed % 97}px`;
        return `<div class="mini-bricks ${item.cls}" data-ffinish="${finish}" style="${style}">${[0, 1, 3].map((c) => this.brickHTML(c)).join('')}</div>`;
      }
      if (item.type === 'burst') {
        const dots = Array.from({ length: 10 }, (_, i) => `<i style="--a:${i * 36}deg"></i>`).join('');
        return `<div class="mini-burst" style="--c:${item.color}">${dots}</div>`;
      }
      return `<div class="mini-arena ${item.cls}" data-afinish="${finish}"><i></i></div>`;
    },
  };
  BR.Skins.FINISH_ATTR = FINISH_ATTR;
})();
