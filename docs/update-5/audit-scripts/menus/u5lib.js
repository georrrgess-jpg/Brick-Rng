// Helpers for the Update 5 menu audit (read-only on the repo).
const path = require('path');
const fs = require('fs');
const { launch } = require('/home/user/Brick-Rng/tests/lib.js');
const ROOT = process.env.AUDIT_OUT || require('os').tmpdir() + '/u5-menus';   // where screenshots and frame sheets go
const SHOTS = path.join(ROOT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const wait = (page, ms) => page.waitForTimeout(ms);

/** Screenshot the current screen at every scroll position of its .scroll (or `sel`). */
async function shotScroll(page, name, { sel, settle = 250, max = 8 } = {}) {
  const info = await page.evaluate((sel) => {
    const el = sel ? document.querySelector(sel) : document.querySelector('.screen.on .scroll');
    if (!el) return null;
    return { sh: el.scrollHeight, ch: el.clientHeight };
  }, sel || null);
  const files = [];
  if (!info) { const f = path.join(SHOTS, name + '.png'); await page.screenshot({ path: f }); return [f]; }
  const step = Math.max(100, info.ch - 80);
  let y = 0, k = 0;
  while (k < max) {
    await page.evaluate(([sel, y]) => { const el = sel ? document.querySelector(sel) : document.querySelector('.screen.on .scroll'); el.scrollTop = y; }, [sel || null, y]);
    await wait(page, settle);
    const f = path.join(SHOTS, `${name}${k ? '-' + k : ''}.png`);
    await page.screenshot({ path: f });
    files.push(f);
    if (y + info.ch >= info.sh - 2) break;
    y += step; k++;
  }
  await page.evaluate((sel) => { const el = sel ? document.querySelector(sel) : document.querySelector('.screen.on .scroll'); if (el) el.scrollTop = 0; }, sel || null);
  return files;
}

/** A returning player: a dozen runs, level 6, Coins, some items of each type with Shines, chests, streak, records. */
async function returning(page, o = {}) {
  await page.evaluate((o) => {
    const st = BR.Storage.data, P = BR.Progress, pr = st.profile;
    st.settings.sound = false; st.settings.music = false;
    st.runs = o.runs != null ? o.runs : 12; st.seenTutorial = true;
    pr.level = o.level || 6; pr.xp = Math.round(BR.xpForLevel(pr.level) * 0.4);
    pr.coins = o.coins != null ? o.coins : 900;
    st.best.rush = 48250; st.bestStage.rush = 5; st.best.chill = 0; st.best.daily = 12400;
    st.recent.rush = [21000, 33000, 48250, 29000, 40100];
    pr.records = { maxLines: 2, maxRushes: 3, history: [8000, 12000, 21000, 15000, 33000, 48250, 29000, 40100, 26000, 37000] };
    pr.stats.bricks = 5321; pr.stats.maxGroup = 14; pr.stats.bestCombo = 4;
    const shines = ['plain', 'glossy', 'holo', 'prism'];
    const types = ['skin', 'pop', 'board', 'fuse'];
    const n = o.items != null ? o.items : 5;
    types.forEach((t) => { BR.DROP_ITEMS.filter((i) => i.type === t).slice(0, n).forEach((i, k) => { if (!P.owns(i.id)) P.keep({ itemId: i.id, shine: shines[k % 4], seed: k + 3 }); }); });
    pr.chests = Object.assign({ brick: 0, pop: 0, board: 0, fuse: 0, golden: 0 }, o.chests || { brick: 1, golden: 1 });
    pr.trophies = { first_run: 1, first_rush: 1, stage5: 1, daily1: 1 };
    if (o.streak) pr.streak = o.streak;
    BR.Storage.save();
    BR.Router.rerender();
  }, o);
}

module.exports = { launch, shotScroll, returning, wait, SHOTS, ROOT, path, fs };
