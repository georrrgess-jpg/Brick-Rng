/* Boosters: earned from the charge bar, never rolled. Each maps a tapped brick to a set of cells. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  BR.BOOSTER_ORDER = ['hammer', 'beam', 'prism'];

  BR.BOOSTERS = {
    hammer: {
      id: 'hammer', name: 'Hammer', perBrick: 15,
      desc: 'Smash a 3x3 area.',
      aim: 'Tap a brick to smash the area around it',
      icon: '<path d="M13.5 4.5l6 6-3 3-6-6z"/><path d="M11 9L4 16.5 7.5 20 15 13"/><path d="M15.5 3l5.5 5.5"/>',
      cells(board, r, c) {
        const out = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (board.get(r + dr, c + dc)) out.push({ r: r + dr, c: c + dc });
        return out;
      },
    },
    beam: {
      id: 'beam', name: 'Beam', perBrick: 15,
      desc: 'Clear a whole row and column.',
      aim: 'Tap a brick to fire a beam through its row and column',
      icon: '<path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="3.6"/>',
      cells(board, r, c) {
        const out = [];
        const seen = new Set();
        const add = (rr, cc) => { const k = rr * board.cols + cc; if (!seen.has(k) && board.get(rr, cc)) { seen.add(k); out.push({ r: rr, c: cc }); } };
        for (let cc = 0; cc < board.cols; cc++) add(r, cc);
        for (let rr = 0; rr < board.rows; rr++) add(rr, c);
        return out;
      },
    },
    prism: {
      id: 'prism', name: 'Prism', perBrick: 20,
      desc: 'Clear every brick of one color.',
      aim: 'Tap a brick to shatter every brick of its color',
      icon: '<path d="M6 4h12l4 6-10 11L2 10z"/><path d="M2 10h20M8.5 4L12 21l3.5-17"/>',
      cells(board, r, c) {
        const t = board.get(r, c);
        const out = [];
        if (!t) return out;
        for (let rr = 0; rr < board.rows; rr++) for (let cc = 0; cc < board.cols; cc++) { const b = board.get(rr, cc); if (b && b.color === t.color) out.push({ r: rr, c: cc }); }
        return out;
      },
    },
  };
})();
