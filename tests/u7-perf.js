// Update 7, smoothness (static, no browser):
//  - every rule that starts an animation (in css/ and in the style sheets the scripts inject) names a class that the
//    under-overlay and menu-idle pause rules in css/base.css list, so an open sheet or an idle menu still holds it still;
//  - no rule keyed on a class of <html> (or on a class that <html> also wears: idle, under-overlay...) ends in a bare `*`, which makes
//    the browser restyle every element of the page when that class changes.
// Usage: node tests/u7-perf.js
const fs = require('fs');
const path = require('path');

let problems = 0;
const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
const ROOT = path.join(__dirname, '..');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

const base = strip(fs.readFileSync(path.join(ROOT, 'css', 'base.css'), 'utf8'));
const listOf = (re) => { const m = base.match(re); return m ? m[1].split(',').map((x) => x.trim()) : []; };
const under = listOf(/html\.under-overlay :is\(#screens, \.bg\) :is\(([^)]*)\)\s*,/);
const idle = listOf(/html\.menu-idle :is\(#screens, \.bg, \.tabbar\) :is\(([^)]*)\)\s*,/);
const underPs = listOf(/html\.under-overlay :is\(#screens, \.bg\) :is\(([^)]*)\)::before/);
ok(under.length > 50, 'the under-overlay pause list was not found in css/base.css');
ok(JSON.stringify(under) === JSON.stringify(idle), 'the menu-idle pause list differs from the under-overlay one');

// rules that set an animation: [file, full selector, rightmost compound]
const rules = [];
const scan = (file, css, js) => {
  css = strip(css).replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) {
    const am = m[2].match(/(?:^|;)\s*animation(?:-name)?\s*:\s*([^;!]+)/);
    if (!am || /^\s*none\s*$/.test(am[1])) continue;
    (js ? m[1].replace(/^[\s\S]*[;`'"]/, '') : m[1]).replace(/^\s*@[^{]*$/, '').split(/,(?![^(]*\))/).forEach((sel) => {
      sel = sel.trim(); if (!sel || /perf-mode|html\.reduced/.test(sel)) return;
      const parts = sel.split(/\s+|>|\+|~/).filter(Boolean);
      rules.push([file, sel, parts[parts.length - 1]]);
    });
  }
};
for (const f of fs.readdirSync(path.join(ROOT, 'css')).filter((x) => x.endsWith('.css'))) scan('css/' + f, fs.readFileSync(path.join(ROOT, 'css', f), 'utf8'));
for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter((x) => x.endsWith('.js'))) {
  const js = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  // injected style sheets: minified rules inside template strings
  (js.match(/[.#a-z][^{}`'";\n]*\{[^{}`]*animation:[^{}`]*\}/g) || []).forEach((r) => scan('js/' + f, r, true));
}
ok(rules.length > 100, 'too few animated rules found', rules.length);
// animated elements with no class of their own: their markup carries class="an" (which the pause lists name)
const TAGGED = new Set(['.fuse-line', '.tap-hint', '.combo', '.rushbar', '.best-line', '.pt-n', '.mini-burst', '.tw-stars', '.s4-swirl', '.fz-p4']);
for (const [file, sel, last] of rules) {
  const pseudo = /::?(before|after)/.test(last);
  const compound = last.replace(/::?(before|after)/, '');
  const classes = compound.match(/\.[a-zA-Z0-9_-]+/g) || [];
  if (/^#splash/.test(sel)) continue;
  const list = pseudo ? underPs : under;
  const prev = sel.split(/\s+|>|\+|~/).filter(Boolean).slice(-2, -1)[0] || '';
  const tagged = !classes.length && (prev.match(/\.[a-zA-Z0-9_-]+/g) || []).some((c) => TAGGED.has(c)) && list.includes('.an');
  ok(classes.some((c) => list.includes(c)) || tagged, `${file}: "${sel}" animates, but none of ${classes.join('') || '(no class: give the element class="an")'} is in the ${pseudo ? '::before/::after ' : ''}pause list of css/base.css`);
}

// no root-class rule with a bare * at its end (one class change on <html> would restyle the whole page)
for (const f of fs.readdirSync(path.join(ROOT, 'css')).filter((x) => x.endsWith('.css'))) {
  const css = strip(fs.readFileSync(path.join(ROOT, 'css', f), 'utf8'));
  for (const sel of css.split('}').map((r) => r.split('{').slice(-2)[0] || '').join(',').split(/,(?![^(]*\))/)) {
    const s = sel.trim();
    if (/^(html|:root)[.:[]/.test(s) && /\s\*(::?(before|after))?$/.test(s) && /under-overlay|menu-idle/.test(s)) ok(false, f, 'a pause rule ends in a bare *:', s.slice(0, 120));
    if (/(^|\s)\.(idle|under-overlay|menu-idle)\b[^\s]*\s+\*(::?(before|after))?$/.test(s)) ok(false, f, 'a rule on a class that <html> wears ends in a bare * (restyles the whole page when it changes):', s.slice(0, 120));
  }
}

console.log(problems ? problems + ' PROBLEMS' : 'u7-perf ok (' + rules.length + ' animated rules covered)');
process.exit(problems ? 1 : 0);
