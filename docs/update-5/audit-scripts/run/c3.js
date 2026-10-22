const H = require('./h.js');
(async () => {
  for (const w of [393, 360]) {
    const L = await H.boot({ width: w, height: 852, dsf: 2 });
    const { page } = L;
    for (const c of ['brick', 'pop', 'board', 'fuse', 'golden']) {
      await page.evaluate((c) => { BR.Storage.data.profile.coins = 9999; if (c === 'golden') BR.Progress.addChest('golden', 1); BR.App.openChest(c); return 0; }, c);
      await page.waitForFunction(() => BR.Openings.current && BR.Openings.current.state === 'ready', null, { timeout: 15000 });
      const r = await page.evaluate(() => { const s = document.querySelector('.opening.on .op-title span'), t = document.querySelector('.opening.on .op-title'); const cs = getComputedStyle(s); return { lines: Math.round(s.scrollHeight / parseFloat(cs.lineHeight || 16)), sh: s.scrollHeight, ch: s.clientHeight, th: t.clientHeight, tsh: t.scrollHeight, ov: cs.overflow, text: s.textContent }; });
      console.log(w, c, JSON.stringify(r));
      await page.evaluate(() => BR.Openings.current.close(false)); await page.waitForTimeout(600);
    }
    await L.browser.close();
  }
})();
