/** Matched production + query-reachable gzip9 experiment. Does not edit UI sources.
 * node scripts/measure-m8-u5-preview.mjs --baseline=/path/to/8e-tree --current=/path/to/u5-tree
 * Builds use each tree's normal Vite config and the same installed toolchain.
 */
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
const arg = (name, fallback) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const roots = { baseline: path.resolve(arg('baseline', '')), current: path.resolve(arg('current', '.')) };
const out = path.resolve(arg('out', 'artifacts/u5-preview/gzip'));
const probe = "\nimport { readEncounterPreview as u5Preview } from './simulation/match';\nimport { readRoundInfo as u5Round } from './simulation/round-selectors';\nObject.assign(globalThis, { __U5_QUERY_PROBE__: { readEncounterPreview: u5Preview, readRoundInfo: u5Round } });\n";
const report = { node: process.version, zlib: process.versions.zlib, method: 'sum each dist/assets/*.js gzip level 9', probe, trees: {}, measurements: {} };
for (const [name, root] of Object.entries(roots)) {
  const lock = fs.readFileSync(path.join(root, 'package-lock.json'));
  let sha = 'archive';
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (top === root) sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch { /* exported fixed tree */ }
  if (sha === 'archive') sha = arg(`${name}-sha`, sha);
  report.trees[name] = { root, sha, lockSha256: createHash('sha256').update(lock).digest('hex') };
  report.measurements[name] = {};
  for (const reachable of [false, true]) {
    const mode = reachable ? 'queryReachable' : 'production', outDir = path.join(out, name, mode);
    await build({ root, configFile: path.join(root, 'vite.config.ts'), build: { outDir, emptyOutDir: true },
      plugins: reachable ? [{ name: 'u5-matched-query-reachability', transform(code, id) {
        return id === path.join(root, 'src/main.ts') ? { code: code + probe, map: null } : undefined;
      } }] : [],
    });
    const assets = path.join(outDir, 'assets');
    const files = fs.readdirSync(assets).filter(f => f.endsWith('.js')).sort().map(file => {
      const bytes = fs.readFileSync(path.join(assets, file));
      return { file, bytes: bytes.length, gzip9Bytes: gzipSync(bytes, { level: 9 }).length };
    });
    report.measurements[name][mode] = { files, gzip9Bytes: files.reduce((n, f) => n + f.gzip9Bytes, 0) };
  }
}
if (report.trees.baseline.lockSha256 !== report.trees.current.lockSha256) throw new Error('Lockfile mismatch');
report.delta = Object.fromEntries(['production', 'queryReachable'].map(mode => [mode, report.measurements.current[mode].gzip9Bytes - report.measurements.baseline[mode].gzip9Bytes]));
report.currentReachableVsBaselineProduction = report.measurements.current.queryReachable.gzip9Bytes - report.measurements.baseline.production.gzip9Bytes;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.currentReachableVsBaselineProduction > 5850) throw new Error('U5 +5850 B stop-and-report threshold exceeded');
