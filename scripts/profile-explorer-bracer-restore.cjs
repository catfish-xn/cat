/** Linux subprocess measurement. A bounded worker keeps an old OOM reproduction
 * away from the test runner; wait4's child high-water RSS includes native memory. */
const { buildSync } = require('esbuild');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

function profile(scenario) {
  const directory = mkdtempSync(join(tmpdir(), 'bracer-profile-'));
  try {
    const worker = join(directory, 'worker.cjs');
    buildSync({ entryPoints: [resolve(__dirname, '../tests/fixtures/explorer-bracer-stress.ts')], outfile: worker,
      bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
    const measure = `import json, resource, subprocess, sys
p = subprocess.Popen(sys.argv[1:], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    out, err = p.communicate(timeout=15)
except subprocess.TimeoutExpired:
    p.kill()
    out, err = p.communicate()
print(json.dumps({"exitCode": p.returncode, "peakRssKiB": resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss, "stdout": out, "stderrTail": err[-1200:]}))
`;
    const measured = spawnSync('python3', ['-c', measure, process.execPath, '--max-old-space-size=256', worker, scenario],
      { encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024 });
    if (measured.error || measured.status !== 0) throw measured.error ?? new Error(measured.stderr);
    const report = JSON.parse(measured.stdout);
    const lines = report.stdout.trim().split('\n');
    const result = report.exitCode === 0 ? JSON.parse(lines.at(-1)) : { scenario, outcome: 'worker-aborted', stderrTail: report.stderrTail };
    return { ...result, exitCode: report.exitCode, peakRssKiB: report.peakRssKiB, heapLimitMiB: 256 };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
module.exports = { profile };
if (require.main === module) console.log(JSON.stringify(profile(process.argv[2] ?? 'huge-count')));
