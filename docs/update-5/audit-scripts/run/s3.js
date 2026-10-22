const H = require('./h.js');
(async () => {
  for (const [w, h] of [[393, 852], [360, 640], [844, 390], [1280, 800]]) {
    const L = await H.boot({ width: w, height: h, dsf: 2, mobile: w < 1000 });
    const { page } = L;
    await H.startRun(page, 'rush');
    const res = await page.evaluate(() => {
      const out = [];
      const list = [
        ['power', 'Use a power-up', 10], ['big8', 'Pop 8 or more bricks at once', 10], ['rush', 'Start Rush Mode', 15], ['line', 'Make a Line Blast', 15],
        ['chain', 'Chain 4 big pops in a row', 15], ['big12', 'Pop 12 or more bricks at once', 15], ['defuse', 'Defuse a Fuse brick', 20], ['rush2', 'Start Rush Mode twice', 20]];
      for (const [id, text, reward] of list) for (const done of [false, true]) {
        BR.Run.goal = { id, text, reward, done }; BR.Run.renderGoal();
        const el = document.getElementById('goalLine'), t = el.querySelector('.gl-txt');
        const r = el.getBoundingClientRect(), tr = t.getBoundingClientRect();
        out.push(`${id}${done ? '+done' : ''}: pill ${Math.round(r.width)}x${Math.round(r.height)} text h=${Math.round(tr.height)} ${tr.height > 22 ? 'WRAPS' : ''} ${tr.bottom > r.bottom + 0.5 ? 'OVERFLOWS' : ''}`);
      }
      return out;
    });
    console.log(w + 'x' + h, '\n ' + res.join('\n '));
    await page.evaluate(() => { BR.Run.goal = { id: 'big8', text: 'Pop 8 or more bricks at once', reward: 10, done: true }; BR.Run.renderGoal(); });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const b = document.getElementById('msgBand').getBoundingClientRect(); return { x: 0, y: Math.max(0, b.top - 10), width: innerWidth, height: b.height + 20 }; });
    await H.shot(page, `goal_wrap_${w}`, w > 800 ? undefined : r);
    await L.browser.close();
  }
})();
