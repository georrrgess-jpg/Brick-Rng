// A bare class selector (`.name { ... }` at the top level) defined in two CSS files is a collision waiting to happen: the later file's
// rules bleed into the other component (Update 5: the chest "first look" layer and the Collection's locked tile were both `.lk`).
// The pairs below are intended layering (a board's variables set in two files, the run board over the skin board). Anything new fails.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'css');
const ALLOWED = new Set(['board', 'board-aurora', 'board-beach', 'board-carnival', 'board-volcano', 'fuse', 'hero-board', 's4b', 'stud']);
const seen = new Map();
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.css')).sort()) {
  const t = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0, buf = '';
  for (const ch of t) {
    if (ch === '{') { if (depth === 0) for (const s of buf.split(',')) { const m = /^\s*\.([\w-]+)\s*$/.exec(s); if (m) { if (!seen.has(m[1])) seen.set(m[1], new Set()); seen.get(m[1]).add(f); } } depth++; buf = ''; }
    else if (ch === '}') { depth--; buf = ''; }
    else if (depth === 0) buf += ch;
  }
}
const bad = [...seen].filter(([k, v]) => v.size > 1 && !ALLOWED.has(k));
bad.forEach(([k, v]) => console.log('CLASH', '.' + k, 'is defined in', [...v].join(' and ')));
console.log(bad.length ? bad.length + ' clashes' : 'cssclash ok');
process.exit(bad.length ? 1 : 0);
