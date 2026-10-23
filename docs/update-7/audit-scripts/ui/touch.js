// Touch feel at 393x852 (isMobile + hasTouch, real touch events through CDP):
//  A. press feedback: every visible control with :active forced (CDP) against its normal style; lists controls that do not change
//  B. accidental double taps (two taps 90 ms apart) on Play, Start, Play again, Equip, a mission swap, a Shop chest
//  C. scroll versus tap: a vertical or horizontal drag that starts on a tappable card must not trigger it
//  D. re-tapping the current tab; the keyboard over the name field and the save-code field (layout shrunk by 336 px)
//  E. the Pass track in landscape with insets (its bleed margins)
// Usage: node touch.js [part...]   (A B C D E; default all). Shots: $AUDIT_OUT/shots/touch-*.png
const { launch, player, closeAll, wait, SHOTS, OUT, path, fs, setInsets } = require('./lib');
const want = (p) => process.argv.length <= 2 || process.argv.slice(2).includes(p);
const touch = (page, type, x, y) => page.__cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
async function tapXY(page, x, y) { await touch(page, 'touchStart', x, y); await wait(page, 40); await touch(page, 'touchEnd', x, y); }
async function tapSel(page, sel) { const b = await page.locator(sel).first().boundingBox(); if (!b) return false; await tapXY(page, b.x + b.width / 2, b.y + b.height / 2); return true; }
async function doubleTap(page, sel, gap = 90) { const b = await page.locator(sel).first().boundingBox(); if (!b) return 'missing'; const x = b.x + b.width / 2, y = b.y + b.height / 2; await tapXY(page, x, y); await wait(page, gap); await tapXY(page, x, y); return 'ok'; }
async function drag(page, x, y, dx, dy, steps = 8) { await touch(page, 'touchStart', x, y); for (let i = 1; i <= steps; i++) { await page.__cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps, id: 1 }] }); await wait(page, 16); } await touch(page, 'touchEnd', x + dx, y + dy); }
const report = [];
const log = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); report.push(s); console.log(s); };

(async () => {
  if (want('A')) {
    const { browser, page, cdp } = await launch({ width: 393, height: 852, dsf: 1 });
    await player(page, { resume: true });
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const PROPS = ['transform', 'background-color', 'background-image', 'filter', 'box-shadow', 'opacity', 'color', 'border-color', 'scale'];
    const check = async (label) => {
      const n = await page.evaluate(() => {
        let i = 0; document.querySelectorAll('[data-aud]').forEach((e) => e.removeAttribute('data-aud'));
        const sel = 'button, [role="button"], [data-act], [data-tab], [data-uid], [data-tier], label.toggle, .icard, [data-hold], [data-locked]';
        const roots = document.querySelectorAll('#topbar, #screens .screen.on, #layer-sheets .sheet.on, #tabbar, .opening.on, .results.on');
        const seen = new Set();
        roots.forEach((r) => r.querySelectorAll(sel).forEach((e) => {
          const b = e.getBoundingClientRect(); if (b.width < 2 || b.bottom < 0 || b.top > innerHeight || e.disabled) return;
          const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return;
          if (e.parentElement && e.parentElement.closest(sel) && !e.matches('button')) return;
          const k = e.tagName + '.' + (typeof e.className === 'string' ? e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
          if (seen.has(k)) return; seen.add(k); e.setAttribute('data-aud', String(i++));
        }));
        return i;
      });
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const none = [];
      for (let i = 0; i < n; i++) {
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-aud="${i}"]` });
        if (!nodeId) continue;
        const read = () => page.evaluate(([i, PROPS]) => { const e = document.querySelector(`[data-aud="${i}"]`); const all = [e, ...e.querySelectorAll('*')].slice(0, 12); return all.map((x) => { const cs = getComputedStyle(x); return PROPS.map((p) => cs.getPropertyValue(p)).join('|'); }).join('#'); }, [i, PROPS]);
        const before = await read();
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
        await wait(page, 260);
        const after = await read();
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
        if (before === after) none.push(await page.evaluate((i) => { const e = document.querySelector(`[data-aud="${i}"]`); return e.tagName.toLowerCase() + '.' + (typeof e.className === 'string' ? e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22) + '"'; }, i));
      }
      log('A', label, `${none.length} of ${n} controls show no press state:`, none.join(', '));
    };
    const steps = [
      ['home', () => BR.Router.go('home')], ['shop', () => BR.Router.go('shop')], ['collection', () => BR.Router.go('collection')],
      ['missions', () => { BR.Router.screens.missions.tab = 'daily'; BR.Router.go('missions'); BR.Router.rerender(); }],
      ['pass', () => { BR.Router.screens.missions.tab = 'pass'; BR.Router.rerender(); }],
      ['profile', () => BR.Router.go('profile')],
      ['settings', () => BR.settingsSheet()], ['ready', () => BR.readySheet('rush')],
      ['item', () => { const v = BR.Storage.data.profile.vault[1]; BR.itemSheet(v.uid, BR.itemById[v.itemId].type); }],
      ['odds', () => BR.showOdds('brick')],
    ];
    for (const [label, fn] of steps) { await closeAll(page); await wait(page, 500); await page.evaluate(fn); await wait(page, 1300); await check(label); }
    await closeAll(page); await wait(page, 500);
    await page.evaluate(() => { BR.Storage.clearRun(); BR.Router.go('home', { instant: true }); __app.startRun({ mode: 'rush', boosts: {} }); });
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 }).catch(() => {});
    await wait(page, 600); await check('run');
    await page.evaluate(() => BR.Run.pause()); await wait(page, 900); await check('pause');
    await closeAll(page); await wait(page, 400);
    await page.evaluate(() => BR.Run.endRun('ended')); await page.waitForFunction(() => BR.Run.resultsEl, null, { timeout: 15000 }).catch(() => {}); await wait(page, 3500); await check('results');
    await page.evaluate(() => BR.Run.closeResults()); await wait(page, 800);
    await page.evaluate(() => BR.App.openChest('golden')); await wait(page, 2400); await check('golden opening');
    await browser.close();
  }

  if (want('B')) {
    const { browser, page } = await launch({ width: 393, height: 852, dsf: 2 });
    await player(page, { coins: 5000, chests: { brick: 0 } });
    await page.evaluate(() => { const a = BR.App, s = a.startRun.bind(a); window.__starts = 0; a.startRun = (o) => { window.__starts++; return s(o); }; });
    // Play on Home (run 13: the Boosts sheet opens first)
    await page.evaluate(() => BR.Router.go('home')); await wait(page, 1200);
    await doubleTap(page, '.hero-play'); await wait(page, 900);
    log('B', 'double tap Play (runs >= 4):', await page.evaluate(() => ({ sheetOpen: !!document.querySelector('.sheet.on'), starts: window.__starts })));
    await page.screenshot({ path: path.join(SHOTS, 'touch-dbl-play.png') });
    await closeAll(page); await wait(page, 600);
    // Start in the Boosts sheet
    await page.evaluate(() => BR.readySheet('rush')); await wait(page, 1000);
    await doubleTap(page, '#goBtn', 90); await wait(page, 1500);
    log('B', 'double tap Start:', await page.evaluate(() => ({ starts: window.__starts, screen: BR.Router.current, sheets: document.querySelectorAll('.sheet.on').length })));
    // Play again on the results
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 }).catch(() => {});
    const tq = await page.evaluate(() => { const e = BR.Run.engine; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.n)) best = { r, c, n: p.cells.length }; } return BR.Run.view.pagePoint(best.r, best.c); });
    await tapXY(page, tq.x, tq.y); await wait(page, 1200);
    await page.evaluate(() => BR.Run.endRun('ended')); await page.waitForFunction(() => BR.Run.resultsEl, null, { timeout: 15000 }).catch(() => {}); await wait(page, 3800);
    const s0 = await page.evaluate(() => window.__starts);
    const again = await page.evaluate(() => { const b = [...BR.Run.resultsEl.querySelectorAll('button')].find((x) => /again|beat/i.test(x.textContent)); if (!b) return null; b.setAttribute('data-aud-again', '1'); return b.textContent.trim(); });
    if (again) { await doubleTap(page, '[data-aud-again]', 90); await wait(page, 1500); }
    log('B', `double tap "${again}" on results:`, await page.evaluate((s0) => ({ startsAdded: window.__starts - s0, screen: BR.Router.current, sheetOpen: !!document.querySelector('.sheet.on') }), s0));
    await page.screenshot({ path: path.join(SHOTS, 'touch-dbl-again.png') });
    await closeAll(page); await page.evaluate(() => { if (BR.Router.current === 'run') { BR.Run.over = true; BR.Run.token++; } if (BR.Run.resultsEl) BR.Run.closeResults(); BR.Router.go('home', { instant: true }); }); await wait(page, 800);
    // Equip in an item sheet
    await page.evaluate(() => { const v = BR.Storage.data.profile.vault.find((x) => BR.itemById[x.itemId].type === 'pop' && !BR.Progress.isEquipped(x.uid)); BR.itemSheet(v.uid, 'pop'); }); await wait(page, 1300);
    const eqSel = await page.evaluate(() => { const b = [...document.querySelectorAll('.sheet.on .sheet-actions button')].find((x) => /equip/i.test(x.textContent)); if (b) b.setAttribute('data-aud-eq', '1'); return !!b; });
    if (eqSel) { await doubleTap(page, '[data-aud-eq]', 90); await wait(page, 1000); }
    log('B', 'double tap Equip:', await page.evaluate(() => ({ sheetOpen: !!document.querySelector('.sheet.on'), screen: BR.Router.current })));
    await closeAll(page); await wait(page, 600);
    // mission swap
    await page.evaluate(() => { BR.Router.screens.missions.tab = 'daily'; BR.Router.go('missions'); BR.Router.rerender(); }); await wait(page, 1300);
    const c0 = await page.evaluate(() => BR.Progress.coins);
    const sw = await page.evaluate(() => { const b = document.querySelector('[data-act="swap"], .swap-btn, [data-swap]'); if (b) b.setAttribute('data-aud-sw', '1'); return b && b.outerHTML.slice(0, 80); });
    if (sw) { await doubleTap(page, '[data-aud-sw]', 90); await wait(page, 1200); }
    log('B', 'double tap mission swap:', sw ? { spent: c0 - (await page.evaluate(() => BR.Progress.coins)) } : 'no swap button found');
    // a Shop chest buy button
    await page.evaluate(() => BR.Router.go('shop')); await wait(page, 1300);
    const c1 = await page.evaluate(() => BR.Progress.coins);
    const buy = await page.evaluate(() => { const b = [...document.querySelectorAll('.screen.on button')].find((x) => x.dataset.chest === 'pop' || (x.closest('[data-chest="pop"]') && /\d/.test(x.textContent))); if (b) b.setAttribute('data-aud-buy', '1'); return b && b.textContent.trim(); });
    if (buy) { await doubleTap(page, '[data-aud-buy]', 90); await wait(page, 2500); }
    log('B', `double tap Shop chest "${buy}":`, await page.evaluate((c1) => ({ spent: c1 - BR.Progress.coins, opening: !!(BR.Openings.current && !BR.Openings.current.closed), state: BR.Openings.current && BR.Openings.current.state }), c1));
    await page.screenshot({ path: path.join(SHOTS, 'touch-dbl-buy.png') });
    await browser.close();
  }

  if (want('C')) {
    const { browser, page } = await launch({ width: 393, height: 852, dsf: 1 });
    await player(page, { resume: true });
    await page.evaluate(() => { const a = BR.App, s = a.startRun.bind(a); window.__starts = 0; a.startRun = (o) => { window.__starts++; return s(o); }; });
    const state = () => page.evaluate(() => ({ starts: window.__starts, sheet: !!document.querySelector('.sheet.on'), opening: !!(BR.Openings.current && !BR.Openings.current.closed), screen: BR.Router.current }));
    await page.evaluate(() => BR.Router.go('home')); await wait(page, 1200);
    let b = await page.locator('.hero').boundingBox();
    await drag(page, b.x + 60, b.y + b.height * 0.4, 0, -140); await wait(page, 900);
    log('C', 'vertical drag starting on the Home hero:', await state(), 'scrollTop', await page.evaluate(() => document.querySelector('.screen.on .scroll').scrollTop));
    await closeAll(page);
    await page.evaluate(() => BR.Router.go('collection')); await wait(page, 1500);
    b = await page.locator('.icard').nth(2).boundingBox();
    await drag(page, b.x + b.width / 2, b.y + b.height / 2, 0, -120); await wait(page, 900);
    log('C', 'vertical drag starting on a Collection card:', await state());
    await closeAll(page);
    await page.evaluate(() => { BR.Router.screens.missions.tab = 'pass'; BR.Router.go('missions'); BR.Router.rerender(); }); await wait(page, 1800);
    b = await page.locator('.track .pt').nth(1).boundingBox();
    const sl0 = await page.evaluate(() => document.querySelector('.track').scrollLeft);
    await drag(page, b.x + b.width / 2, b.y + b.height / 2, -160, 0); await wait(page, 900);
    log('C', 'horizontal drag starting on a Pass tile:', await state(), 'track scrolled', (await page.evaluate(() => document.querySelector('.track').scrollLeft)) - sl0);
    await closeAll(page);
    await page.evaluate(() => BR.Router.go('shop')); await wait(page, 1300);
    b = await page.locator('.screen.on .btn').nth(1).boundingBox();
    await drag(page, b.x + b.width / 2, b.y + b.height / 2, 0, -120); await wait(page, 1500);
    log('C', 'vertical drag starting on a Shop chest button:', await state());
    await page.evaluate(() => { const o = BR.Openings.current; if (o && !o.closed) o.requestClose(false); }); await closeAll(page); await wait(page, 900);
    // a sheet: drag down on the handle (people expect a swipe down to close a bottom sheet)
    await page.evaluate(() => BR.coinSheet()); await wait(page, 1000);
    b = await page.locator('.sheet.on .sheet-handle').boundingBox();
    await drag(page, b.x + b.width / 2, b.y + 4, 0, 260, 12); await wait(page, 900);
    log('C', 'swipe down on a bottom sheet handle:', { stillOpen: await page.evaluate(() => !!document.querySelector('.sheet.on')) });
    await closeAll(page); await wait(page, 500);
    // long press on a Collection card and on a reward: text selection or a callout?
    await page.evaluate(() => BR.Router.go('collection')); await wait(page, 1300);
    b = await page.locator('.icard').nth(1).boundingBox();
    await touch(page, 'touchStart', b.x + b.width / 2, b.y + b.height / 2); await wait(page, 900); await touch(page, 'touchEnd', b.x + b.width / 2, b.y + b.height / 2); await wait(page, 600);
    log('C', 'long press on a Collection card:', await state(), 'selection', JSON.stringify(await page.evaluate(() => String(getSelection()))));
    await closeAll(page); await wait(page, 400);
    // touch-action that reaches elements inside scrollers (body's manipulation stops at the scroll container)
    log('C', 'touch-action:', await page.evaluate(() => { BR.Router.go('home'); const q = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).touchAction : null; }; return { body: q('body'), scroll: q('.screen.on .scroll'), hero: q('.hero'), icard: q('.icard'), sheetBody: q('.sheet-body') }; }));
    await browser.close();
  }

  if (want('D')) {
    const { browser, page } = await launch({ width: 393, height: 852, dsf: 2 });
    await player(page, {});
    // re-tap the current tab after scrolling
    await page.evaluate(() => BR.Router.go('collection')); await wait(page, 1300);
    await page.evaluate(() => { document.querySelector('.screen.on .scroll').scrollTop = 900; }); await wait(page, 300);
    await tapSel(page, '#tabbar .tab[data-tab="collection"]'); await wait(page, 800);
    log('D', 're-tap the Collection tab after scrolling: scrollTop', await page.evaluate(() => document.querySelector('.screen.on .scroll').scrollTop));
    // keyboard: the name field (Profile) and the restore field. A 336px keyboard: the layout shrinks (Android resizes-content, or iOS visual viewport)
    await page.evaluate(() => BR.Router.go('profile')); await wait(page, 1300);
    await tapSel(page, '[data-name]'); await wait(page, 300);
    await page.setViewportSize({ width: 393, height: 852 - 336 }); await wait(page, 700);
    log('D', 'name field with keyboard:', await page.evaluate(() => { const r = document.querySelector('[data-name]').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, focused: document.activeElement && document.activeElement.matches('[data-name]') }; }));
    await page.screenshot({ path: path.join(SHOTS, 'touch-kb-name.png') });
    await page.setViewportSize({ width: 393, height: 852 }); await wait(page, 500);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.evaluate(() => BR.restoreSheet()); await wait(page, 1000);
    const before = await page.evaluate(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; }; return { box: r('.sheet.on .code-box'), btn: r('.sheet.on .sheet-actions .btn'), fontSize: getComputedStyle(document.querySelector('.sheet.on .code-box')).fontSize }; });
    log('D', 'restore sheet without keyboard:', before, '-> with a 336px keyboard over a fixed layout (iOS/Android resizes-visual) the visible area ends at', 852 - 336);
    await tapSel(page, '.sheet.on .code-box'); await wait(page, 200);
    await page.setViewportSize({ width: 393, height: 852 - 336 }); await wait(page, 800);
    log('D', 'restore sheet when the layout shrinks (resizes-content):', await page.evaluate(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; }; return { sheet: r('.sheet.on'), box: r('.sheet.on .code-box'), btn: r('.sheet.on .sheet-actions .btn'), vh: innerHeight }; }));
    await page.screenshot({ path: path.join(SHOTS, 'touch-kb-restore.png') });
    await browser.close();
  }

  if (want('E')) {
    const { browser, page } = await launch({ width: 844, height: 390, dsf: 2, insets: [0, 21, 59, 59] });
    await player(page, {});
    await page.evaluate(() => { BR.Router.screens.missions.tab = 'pass'; BR.Router.go('missions'); BR.Router.rerender(); }); await wait(page, 1800);
    await page.evaluate(() => { const t = document.querySelector('.track'); t.scrollIntoView({ block: 'center' }); t.scrollLeft = 0; }); await wait(page, 600);
    log('E', 'Pass track, landscape with insets:', await page.evaluate(() => { const t = document.querySelector('.track-wrap').getBoundingClientRect(), s = document.querySelector('.screen.on').getBoundingClientRect(), p = document.querySelector('.track .pt').getBoundingClientRect(), rail = document.getElementById('tabbar').getBoundingClientRect(); return { screenLeft: Math.round(s.left), screenRight: Math.round(s.right), wrapLeft: Math.round(t.left), wrapRight: Math.round(t.right), firstTileLeft: Math.round(p.left), railRight: Math.round(rail.right), vw: innerWidth }; }));
    await page.screenshot({ path: path.join(SHOTS, 'touch-land-track.png') });
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'touch.txt'), report.join('\n') + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
