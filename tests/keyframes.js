// Every @keyframes name must be defined once across css/*.css. A second definition silently replaces the first (the later file wins),
// which is how Collection cards once played the chest-reveal flip and the Home bomb's spark floated off its wick.
// Usage: node tests/keyframes.js
const fs = require('fs'), path = require('path');
const dir = process.env.CSS_DIR || path.resolve(__dirname, '..', 'css');   // (CSS_DIR lets the test be pointed at an old copy to prove it fails)
const seen = new Map();   // name -> [file:line, ...]
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.css')).sort()) {
  const css = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));   // comments keep their line breaks
  const re = /@(?:-webkit-)?keyframes\s+([A-Za-z0-9_-]+)/g;
  let m;
  while ((m = re.exec(css))) {
    const line = css.slice(0, m.index).split('\n').length;
    if (!seen.has(m[1])) seen.set(m[1], []);
    seen.get(m[1]).push(`${f}:${line}`);
  }
}
let problems = 0;
for (const [name, where] of seen) if (where.length > 1) { problems++; console.log('PROBLEM duplicate @keyframes', name, 'defined in', where.join(', ')); }
// every animation name used in a stylesheet should exist (a typo or a rename that missed one reference plays nothing)
const defined = new Set(seen.keys());
const KNOWN_UNDEFINED = new Set();   // animations that are played but not defined (none: add a name here only with a reason)
const builtin = new Set(['none', 'infinite', 'alternate', 'alternate-reverse', 'reverse', 'normal', 'forwards', 'backwards', 'both', 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'running', 'paused', 'initial', 'inherit', 'unset', 'steps']);
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.css')).sort()) {
  const css = fs.readFileSync(path.join(dir, f), 'utf8');
  const re = /(?:^|[;{\s])animation(?:-name)?\s*:\s*([^;}]+)/g;
  let m;
  while ((m = re.exec(css))) {
    for (const part of m[1].split(',')) {
      for (const tok of part.trim().split(/\s+/)) {
        if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(tok) || builtin.has(tok) || /^(steps|cubic-bezier|var|calc)/.test(tok)) continue;
        if (/^(\d|--)/.test(tok)) continue;
        if (KNOWN_UNDEFINED.has(tok)) { console.log('NOTE known undefined @keyframes', tok, 'in', f); continue; }
        if (!defined.has(tok)) { problems++; console.log('PROBLEM animation uses an undefined @keyframes name', tok, 'in', f); }
      }
    }
  }
}
console.log(problems ? problems + ' PROBLEMS' : `keyframes ok (${seen.size} names)`);
process.exit(problems ? 1 : 0);
