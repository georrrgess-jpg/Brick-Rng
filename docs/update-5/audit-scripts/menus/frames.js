// Frame capture through the CDP screencast: every frame the compositor produces, with its wall-clock timestamp.
// capture(page, name, action, { ms, every, clip }) runs `action` (a function evaluated in the page, or an async node
// function when node: true) and writes a contact sheet of the frames at 0, every, 2*every ... ms after the action.
const { execFileSync } = require('child_process');
const { SHOTS, ROOT, path, fs, wait } = require('./u5lib');
const FR = path.join(ROOT, 'frames');
fs.mkdirSync(FR, { recursive: true });

async function capture(page, name, action, o = {}) {
  const ms = o.ms || 900, every = o.every || 60;
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => { frames.push({ t: f.metadata.timestamp * 1000, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  const vp = page.viewportSize();
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1, maxWidth: vp.width, maxHeight: vp.height });
  await wait(page, 300);
  let t0;
  if (o.node) { t0 = Date.now(); await action(); } else t0 = await page.evaluate(action);
  if (typeof t0 !== 'number') t0 = Date.now();
  await wait(page, ms + 150);
  await cdp.send('Page.stopScreencast');
  await cdp.detach().catch(() => {});
  const dir = path.join(FR, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  // sample: the last frame at or before each tick
  const picks = [];
  for (let s = 0; s <= ms; s += every) {
    const tt = t0 + s; let best = null;
    for (const f of frames) if (f.t <= tt + 4) best = f;
    if (!best) best = frames[0];
    if (!best) break;
    const file = path.join(dir, `f${String(s).padStart(4, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(best.data, 'base64'));
    picks.push([file, `+${s}ms (frame ${Math.round(best.t - t0)}ms)`]);
  }
  // frame cadence: gaps between consecutive frames after the action
  const after = frames.filter((f) => f.t >= t0 - 20 && f.t <= t0 + ms).map((f) => f.t);
  const gaps = after.slice(1).map((t, i) => Math.round(t - after[i]));
  const sheet = path.join(FR, name + '.png');
  const args = [path.join(ROOT, 'sheet.py'), sheet, String(o.cols || 6), String(o.scale || 0.5), JSON.stringify(o.clip || null)];
  picks.forEach(([f, l]) => args.push(f, l));
  execFileSync('python3', args);
  return { sheet, n: frames.length, gaps: gaps.length ? { max: Math.max(...gaps), med: gaps.sort((a, b) => a - b)[gaps.length >> 1] } : null };
}

/** A diff strip: mean absolute pixel change between consecutive sampled frames (to find jumps and pops). */
module.exports = { capture, FR };
