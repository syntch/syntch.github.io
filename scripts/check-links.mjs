// Verifies that every internal href/src in dist HTML (excluding play/) resolves to a file.
import fs from 'node:fs';
import path from 'node:path';
import { DIST, getBase } from './lib.mjs';

const base = getBase();
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!(dir === DIST && e.name === 'play')) walk(p); }
    else if (e.name.endsWith('.html')) files.push(p);
  }
})(DIST);

const problems = [];
let count = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const re = /\b(?:href|src|data-src)="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    let url = m[1].replace(/&amp;/g, '&');
    if (!url || url.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) continue; // external, mailto:, data:
    url = url.split('#')[0].split('?')[0];
    if (!url.startsWith(base)) { problems.push(`${path.relative(DIST, f)}: "${m[1]}" is not under base ${base}`); continue; }
    count++;
    let target = path.join(DIST, decodeURIComponent(url.slice(base.length)));
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) problems.push(`${path.relative(DIST, f)}: "${m[1]}" -> missing file`);
  }
  // CSP sanity: no inline scripts or styles
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) problems.push(`${path.relative(DIST, f)}: inline <script>`);
  if (/\sstyle="/i.test(html) || /<style[\s>]/i.test(html)) problems.push(`${path.relative(DIST, f)}: inline style`);
}
if (problems.length) {
  console.error(`Link check FAILED (${problems.length}):\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`Link check OK: ${files.length} pages, ${count} internal references (base ${base})`);
