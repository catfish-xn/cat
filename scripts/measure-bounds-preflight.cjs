// Pass an external directory containing a clean 8db36d0 export and node_modules.
// Alternate serial, single-worker runs; do not mix this with other test jobs.
const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
if (!process.argv[2]) throw new Error('Usage: node scripts/measure-bounds-preflight.cjs <external baseline directory>');
const baseline = resolve(process.argv[2]);
const output = resolve(root, 'docs/evidence/restore-audit/bounds-preflight/logs');
mkdirSync(output, { recursive: true });
const results = [];
for (let pair = 1; pair <= 3; pair++) for (const variant of ['multiplayer', 'preflight']) {
  const cwd = variant === 'multiplayer' ? baseline : root;
  const report = resolve(output, `b7-${variant}-${pair}.json`);
  const started = performance.now();
  const run = spawnSync(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', '--project', 'fast',
    '--dir', 'tests', '--maxWorkers=1', 'tests/m8-b7-match-wiring.test.ts', '--reporter=json', `--outputFile=${report}`],
  { cwd, encoding: 'utf8', windowsHide: true });
  const elapsedMs = performance.now() - started;
  writeFileSync(resolve(output, `b7-${variant}-${pair}.log`), (run.stdout ?? '') + (run.stderr ?? ''));
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`${variant}/${pair} failed: ${run.stdout}\n${run.stderr}`);
  results.push({ pair, variant, elapsedMs });
  console.log(JSON.stringify(results.at(-1)));
}
const median = variant => results.filter(r => r.variant === variant).map(r => r.elapsedMs).sort((a, b) => a - b)[1];
const summary = { node: process.version, baseline: '8db36d0', command: 'vitest run --project fast --dir tests --maxWorkers=1 tests/m8-b7-match-wiring.test.ts',
  results, baselineMedianMs: median('multiplayer'), preflightMedianMs: median('preflight'),
  changePercent: (median('preflight') / median('multiplayer') - 1) * 100 };
writeFileSync(resolve(output, 'b7-comparison.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
