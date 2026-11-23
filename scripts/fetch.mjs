// Downloads each game's `showcase` release bundle into .cache/games/<slug>/.
// A missing repo / release / asset is skipped, except that a bundle which was live
// at the last deploy must not disappear (see the guard at the end).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, CACHE, readJson, rmrf } from './lib.mjs';

const TAG = 'showcase';
const ASSET = 'showcase-bundle.zip';
const MAX_BYTES = 300 * 1024 * 1024;
const token = process.env.SHOWCASE_TOKEN || process.env.GITHUB_TOKEN || '';
const site = readJson(path.join(ROOT, 'site.json'));

const headers = (accept) => ({
  Accept: accept,
  'User-Agent': 'showcase-site-fetch',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

// ---- pick an unzip tool: unzip, bsdtar, or Windows' own tar.exe
function has(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return !r.error && r.status === 0 ? r : null;
}
function pickTool() {
  if (has('unzip', ['-v'])) return { list: (z) => ['unzip', ['-Z1', z]], extract: (z, d) => ['unzip', ['-q', '-o', z, '-d', d]] };
  const candidates = ['tar'];
  if (process.env.SystemRoot) candidates.push(path.join(process.env.SystemRoot, 'System32', 'tar.exe'));
  for (const t of candidates) {
    const r = has(t, ['--version']);
    if (r && /bsdtar/i.test(r.stdout)) return { list: (z) => [t, ['-tf', z]], extract: (z, d) => [t, ['-xf', z, '-C', d]] };
  }
  return null;
}
const tool = pickTool();

function unsafeEntry(name) {
  const n = name.replace(/\\/g, '/');
  return n.startsWith('/') || /^[a-zA-Z]:/.test(n) || n.split('/').includes('..') || n.includes('\0');
}

function hasSymlink(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) return true;
    if (e.isDirectory() && hasSymlink(p)) return true;
  }
  return false;
}

async function api(url, accept = 'application/vnd.github+json') {
  return fetch(url, { headers: headers(accept), redirect: 'follow' });
}

const fingerprint = [];
fs.mkdirSync(path.join(CACHE, 'tmp'), { recursive: true });

for (const { slug, repo } of site.games) {
  const say = (m) => console.log(`${slug.padEnd(18)} ${m}`);
  try {
    const rel = await api(`https://api.github.com/repos/${repo}/releases/tags/${TAG}`);
    if (rel.status === 404) { say(`skip: no "${TAG}" release yet (or repo not visible; need SHOWCASE_TOKEN for private repos)`); continue; }
    if (!rel.ok) { say(`skip: GitHub API answered ${rel.status}`); continue; }
    const release = await rel.json();
    const asset = (release.assets || []).find((a) => a.name === ASSET);
    if (!asset) { say(`skip: release has no ${ASSET} asset`); continue; }
    if (asset.size > MAX_BYTES) { say(`skip: asset too large (${asset.size} bytes)`); continue; }
    if (!tool) { say('skip: no unzip/bsdtar found on this machine'); continue; }

    const dl = await api(asset.url, 'application/octet-stream');
    if (!dl.ok) { say(`skip: download answered ${dl.status}`); continue; }
    const zip = path.join(CACHE, 'tmp', `${slug}.zip`);
    fs.writeFileSync(zip, Buffer.from(await dl.arrayBuffer()));

    const [lc, la] = tool.list(zip);
    const listed = spawnSync(lc, la, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (listed.status !== 0) { say('skip: could not list the zip'); continue; }
    const entries = listed.stdout.split(/\r?\n/).filter(Boolean);
    const bad = entries.find(unsafeEntry);
    if (bad) { say(`skip: unsafe path in zip (${bad})`); continue; }

    const dest = path.join(CACHE, 'games', slug);
    rmrf(dest);
    fs.mkdirSync(dest, { recursive: true });
    const [ec, ea] = tool.extract(zip, dest);
    const ex = spawnSync(ec, ea, { encoding: 'utf8' });
    if (ex.status !== 0 || hasSymlink(dest) || !fs.existsSync(path.join(dest, 'showcase.json'))) {
      rmrf(dest);
      say('skip: extraction failed, contained symlinks, or has no showcase.json at its root');
      continue;
    }
    fingerprint.push(`${slug} ${asset.id} ${asset.updated_at}`);
    say(`fetched ${ASSET} (${asset.size} bytes, updated ${asset.updated_at})`);
  } catch (err) {
    say(`skip: ${err.message}`);
  }
}

rmrf(path.join(CACHE, 'tmp'));
fs.mkdirSync(CACHE, { recursive: true });
fs.writeFileSync(path.join(CACHE, 'fingerprint.txt'), fingerprint.sort().join('\n') + '\n');
console.log(`fingerprint: ${fingerprint.length} bundle(s)`);

// Regression guard: a bundle that was live at the last deploy must still be here.
// Otherwise an expired token or an API outage would silently replace live demos
// with the seed pages. Set ALLOW_BUNDLE_REMOVAL=1 to remove a game's bundle on purpose.
const prevFile = process.env.PREV_FINGERPRINT;
if (prevFile && fs.existsSync(prevFile) && process.env.ALLOW_BUNDLE_REMOVAL !== '1') {
  const now = new Set(fingerprint.map((l) => l.split(' ')[0]));
  const lost = fs.readFileSync(prevFile, 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => l.split(' ')[0]).filter((s) => !now.has(s));
  if (lost.length) {
    console.error(`::error::Bundle(s) live at the last deploy could not be fetched: ${lost.join(', ')}. ` +
      'Refusing to deploy without them (check SHOWCASE_TOKEN). Re-run manually with "allow-removal" if this is intended.');
    process.exit(1);
  }
}
