// One command for a phase gate: runs the test suites in a sensible order, one after the other (they use the CPU, so never in parallel),
// prints a line per suite and a summary, and exits 1 if any failed.
//   node tests/all.js            everything (about 20 minutes)
//   node tests/all.js --node     only the suites that need no browser (about 3 minutes)
//   node tests/all.js --browser  only the browser suites
//   node tests/all.js --perf     also run the performance budget (do this on an idle machine)
//   node tests/all.js logic flow just the named suites
const { spawnSync } = require('child_process');
const path = require('path');

const NODE = [
  ['logic', ['tests/logic.js']], ['engine', ['tests/engine.js']], ['season', ['tests/season.js']], ['keyframes', ['tests/keyframes.js'], true], ['cssclash', ['tests/cssclash.js'], true], ['u7-perf', ['tests/u7-perf.js'], true],
  ['director', ['tests/director.js', 'quick']], ['balance', ['tests/balance.js', '60']], ['sim', ['tests/sim.js', 'quick']],
];
const BROWSER = [
  ['spin', ['tests/spin.js']], ['lifecycle', ['tests/lifecycle.js']], ['flow', ['tests/flow.js']], ['chests', ['tests/chests.js']], ['touch', ['tests/touch.js']],
  ['coach', ['tests/coach.js']], ['visual', ['tests/visual.js']], ['uiaudit', ['tests/uiaudit.js']], ['tryit', ['tests/tryit.js']], ['stress', ['tests/stress.js']],
  ['moments', ['tests/moments.js']], ['u4cosmetics', ['tests/u4cosmetics.js']], ['audio', ['tests/audio.js']],
  ['u5-menus', ['tests/u5-menus.js'], true], ['u5-run', ['tests/u5-run.js'], true], ['u5-chests', ['tests/u5-chests.js'], true],
  ['u5-skins', ['tests/u5-skins.js'], true], ['u5-pops', ['tests/u5-pops.js'], true], ['u5-boards', ['tests/u5-boards.js'], true], ['u5-older', ['tests/u5-older.js'], true, 40], ['u5-fuses', ['tests/u5-fuses.js'], true, 60],
  ['u5-collection', ['tests/u5-collection.js'], true], ['upgrade', ['tests/upgrade.js'], true], ['u5-sets', ['tests/u5-sets.js'], true], ['u5-tower', ['tests/u5-tower.js'], true], ['u6-perf', ['tests/u6-perf.js'], true], ['u7-mobile', ['tests/u7-mobile.js'], true], ['u7-gfx', ['tests/u7-gfx.js'], true],
];
const PERF = [['perfbudget', ['tests/perfbudget.js']]];

const args = process.argv.slice(2);
const names = args.filter((a) => !a.startsWith('--'));
let list = [];
if (!args.includes('--browser')) list = list.concat(NODE);
if (!args.includes('--node')) list = list.concat(BROWSER);
if (args.includes('--perf')) list = list.concat(PERF);
if (names.length) list = NODE.concat(BROWSER, PERF).filter(([n]) => names.includes(n));

const fs = require('fs');
const results = [];
for (const [name, cmd, optional, minutes] of list) {
  if (optional && !fs.existsSync(path.resolve(__dirname, '..', cmd[0]))) { results.push([name, 'skip', 0]); console.log('skip  ' + name + ' (not present)'); continue; }
  const t0 = Date.now();
  const r = spawnSync('node', cmd, { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: (minutes || 20) * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  const secs = Math.round((Date.now() - t0) / 1000), ok = r.status === 0;
  results.push([name, ok ? 'ok' : 'FAIL', secs]);
  console.log((ok ? 'ok    ' : 'FAIL  ') + name.padEnd(14) + secs + 's');
  if (!ok) console.log(((r.stdout || '') + (r.stderr || '')).split('\n').slice(-25).map((l) => '      ' + l).join('\n'));
}
const failed = results.filter((r) => r[1] === 'FAIL');
console.log('\n' + results.filter((r) => r[1] === 'ok').length + ' passed, ' + failed.length + ' failed, ' + results.filter((r) => r[1] === 'skip').length + ' skipped' + (failed.length ? ': ' + failed.map((r) => r[0]).join(', ') : ''));
process.exit(failed.length ? 1 : 0);
