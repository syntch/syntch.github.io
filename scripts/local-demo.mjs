// Dev helper: build a game's demo locally and stage it as a fetched bundle.
// Usage: node scripts/local-demo.mjs <slug> <path-to-game-repo>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, CACHE, readJson, rmrf, copyDir } from './lib.mjs';

const [slug, repoArg] = process.argv.slice(2);
if (!slug || !repoArg) {
  console.error('usage: node scripts/local-demo.mjs <slug> <path-to-game-repo>');
  process.exit(2);
}
const seed = path.join(ROOT, 'content', 'games', slug);
if (!fs.existsSync(path.join(seed, 'showcase.json'))) {
  console.error(`No seed bundle at content/games/${slug}`);
  process.exit(2);
}
const repo = path.resolve(repoArg);
if (!fs.existsSync(path.join(repo, 'package.json'))) {
  console.error(`${repo} does not look like a game repo (no package.json)`);
  process.exit(2);
}

const dest = path.join(CACHE, 'games', slug);
rmrf(dest);
fs.mkdirSync(path.dirname(dest), { recursive: true });
copyDir(seed, dest);

const out = path.join(dest, 'demo');
console.log(`Building demo from ${repo} into ${out}`);
const viteBin = path.join(repo, "node_modules", "vite", "bin", "vite.js");
const viteArgs = ["build", "--base=./", "--outDir", out, "--emptyOutDir"];
const r = fs.existsSync(viteBin)
  ? spawnSync(process.execPath, [viteBin, ...viteArgs], { cwd: repo, stdio: "inherit" })
  : spawnSync("npx", ["vite", ...viteArgs], { cwd: repo, stdio: "inherit", shell: true });
if (r.status !== 0) {
  console.error('vite build failed; the cached bundle was left without a demo.');
  rmrf(out);
  process.exit(r.status || 1);
}
if (!fs.existsSync(path.join(out, 'index.html'))) {
  console.error('Build finished but produced no index.html');
  process.exit(1);
}
const file = path.join(dest, 'showcase.json');
const data = readJson(file);
data.demo.available = true;
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`Staged .cache/games/${slug} with demo. Run "npm run build" to see it in dist/play/${slug}/.`);
