/** A bounded worker keeps an old OOM reproduction away from the test runner.
 * Measure native peak resident memory, including allocations outside the heap. */
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

// Resolve this local domain graph in Node rather than asking the native service
// to scan ancestor directories, which may be unreadable in a restricted clone.
// The separate builder keeps profile() synchronous; measured workers are unchanged.
async function bundleWorker(entry, outfile) {
  const { build } = require('esbuild');
  const { readFileSync, existsSync, statSync } = require('node:fs');
  const { resolve, dirname, join, isAbsolute } = require('node:path');
  await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
    plugins: [{ name: 'local-domain-files', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if (args.path.startsWith('node:')) return { path: args.path, external: true };
        if (!args.path.startsWith('.') && !isAbsolute(args.path)) throw Error(`Unexpected domain dependency: ${args.path}`);
        const base = resolve(args.importer ? dirname(args.importer) : args.resolveDir, args.path);
        const path = [base, base + '.ts', join(base, 'index.ts')].find(p => existsSync(p) && statSync(p).isFile());
        if (!path) throw Error(`Missing domain dependency: ${args.path}`);
        return { path, namespace: 'local-domain' };
      });
      builder.onLoad({ filter: /.*/, namespace: 'local-domain' }, args => ({ contents: readFileSync(args.path, 'utf8'), loader: 'ts' }));
    } }],
  });
}

function profile(scenario) {
  const directory = mkdtempSync(join(tmpdir(), 'bracer-profile-'));
  try {
    const worker = join(directory, 'worker.cjs');
    const built = spawnSync(process.execPath, ['-e', `(${bundleWorker.toString()})(...process.argv.slice(1)).catch(error => { console.error(error); process.exitCode = 1; });`,
      resolve(__dirname, '../tests/fixtures/explorer-bracer-stress.ts'), worker],
      { cwd: resolve(__dirname, '..'), encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
    if (built.error || built.status !== 0) throw built.error ?? new Error(built.stderr);
    // maxRSS is Node's native process peak resident memory in KiB, including
    // non-heap allocations. Sample at exit, after the complete measured workload.
    const measure = "process.on('exit', () => require('node:fs').writeSync(2, '\\n__BRACER_PEAK_RSS_KIB__=' + process.resourceUsage().maxRSS + '\\n')); require(process.argv[1]);";
    const measured = spawnSync(process.execPath, ['--max-old-space-size=256', '-e', measure, worker, scenario],
      { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
    if (measured.error) throw measured.error;
    const peakRecord = measured.stderr.match(/^__BRACER_PEAK_RSS_KIB__=(\d+)\r?$/m);
    const peakRssKiB = Number(peakRecord?.[1]);
    if (!(peakRssKiB > 0)) throw new Error(`Missing child peak resident memory: ${measured.stderr.slice(-1200)}`);
    const lines = measured.stdout.trim().split('\n');
    const result = measured.status === 0 ? JSON.parse(lines.at(-1))
      : { scenario, outcome: 'worker-aborted', stderrTail: measured.stderr.replace(peakRecord[0], '').slice(-1200) };
    return { ...result, exitCode: measured.status, peakRssKiB, heapLimitMiB: 256 };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
module.exports = { profile };
if (require.main === module) console.log(JSON.stringify(profile(process.argv[2] ?? 'huge-count')));
