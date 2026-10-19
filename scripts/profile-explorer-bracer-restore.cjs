/** A bounded worker keeps an old OOM reproduction away from the test runner.
 * Measure native peak resident memory, including allocations outside the heap. */
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
    const measure = `import json, subprocess, sys
p = subprocess.Popen(sys.argv[1:], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    out, err = p.communicate(timeout=15)
except subprocess.TimeoutExpired:
    p.kill()
    out, err = p.communicate()
if sys.platform == 'win32':
    import ctypes
    from ctypes import wintypes
    class ProcessMemoryCounters(ctypes.Structure):
        _fields_ = [('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD)] + [(name, ctypes.c_size_t) for name in (
            'PeakWorkingSetSize', 'WorkingSetSize', 'QuotaPeakPagedPoolUsage', 'QuotaPagedPoolUsage',
            'QuotaPeakNonPagedPoolUsage', 'QuotaNonPagedPoolUsage', 'PagefileUsage', 'PeakPagefileUsage')]
    counters = ProcessMemoryCounters()
    counters.cb = ctypes.sizeof(counters)
    read_memory = ctypes.WinDLL('psapi', use_last_error=True).GetProcessMemoryInfo
    read_memory.argtypes = [wintypes.HANDLE, ctypes.POINTER(ProcessMemoryCounters), wintypes.DWORD]
    read_memory.restype = wintypes.BOOL
    # Popen retains its process handle after communicate(), including peak data.
    if not read_memory(int(p._handle), ctypes.byref(counters), counters.cb):
        raise ctypes.WinError(ctypes.get_last_error())
    peak_rss_kib = (counters.PeakWorkingSetSize + 1023) // 1024
else:
    import resource
    peak_rss_kib = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
if peak_rss_kib <= 0:
    raise RuntimeError('Missing child peak resident memory')
print(json.dumps({"exitCode": p.returncode, "peakRssKiB": peak_rss_kib, "stdout": out, "stderrTail": err[-1200:]}))
`;
    const measured = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', measure, process.execPath, '--max-old-space-size=256', worker, scenario],
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
