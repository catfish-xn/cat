import { readFileSync } from 'node:fs';
import { posix as path } from 'node:path';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';

// Execute the unchanged production script end-to-end with synthetic chunks and
// deterministic browser timings. No real browser, network, builds or assets.
// Both the synthetic FS and the script-injected node:path use POSIX semantics,
// regardless of the host OS (including Windows); the real script is unchanged.
const source = readFileSync(new URL('../scripts/m7-budget.cjs', import.meta.url), 'utf8');
const root = '/synthetic-rendering3d-budget';
const dirs = { base: `${root}/base`, current: `${root}/current`, jsBase: `${root}/js-base`, out: `${root}/out` };
const payload = 'export const syntheticChunk = "no real assets";';
const gzipBytes = (text: string) => gzipSync(Buffer.from(text), { level: 9 }).length;
interface BudgetReport {
  baselineDirectories: { js: string; interactive: string };
  jsGzipBytes: { base: number; current: number };
  js3dGzipBytes: number;
  jsRatio: number; jsBudget: number;
  interactiveMs: { base: number[]; current: number[]; baseMedian: number; currentMedian: number };
  interactiveRatio: number; interactiveBudget: number; passed: boolean;
  wallClock: { enforced: boolean; gates: { actual: number; limit: number; passed: boolean }[] };
}
interface Options {
  base?: Record<string, string>; current?: Record<string, string>; jsBase?: Record<string, string>;
  baseTimes?: number[]; currentTimes?: number[]; enforce?: boolean;
}
async function runBudget(options: Options = {}) {
  const files = new Map<string, string>(), directories = new Set<string>();
  const add = (dir: string, entries: Record<string, string>) => {
    directories.add(dir);
    for (const [name, text] of Object.entries(entries)) {
      const file = path.join(dir, name); files.set(file, text);
      for (let parent = path.dirname(file); parent.startsWith(dir); parent = path.dirname(parent)) directories.add(parent);
    }
  };
  add(dirs.base, { 'index.html': '<button data-debug="m6-fixed-start">synthetic</button>', ...(options.base ?? { 'assets/base.js': payload }) });
  add(dirs.current, options.current ?? { 'assets/current.js': payload });
  if (options.jsBase) add(dirs.jsBase, options.jsBase);
  const missing = (file: string) => Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
  const fs = {
    existsSync: (file: string) => files.has(file) || directories.has(file),
    readdirSync: (dir: string) => {
      if (!directories.has(dir)) throw missing(dir);
      return [...new Set([...files.keys()].filter(file => file.startsWith(`${dir}/`)).map(file => file.slice(dir.length + 1).split('/')[0]))];
    },
    readFileSync: (file: string) => { if (!files.has(file)) throw missing(file); return Buffer.from(files.get(file)!); },
    mkdirSync: vi.fn(), writeFileSync: vi.fn((file: string, text: string) => { files.set(file, text); }),
  };
  const servers: { port: number; close: ReturnType<typeof vi.fn> }[] = [];
  const http = { createServer: vi.fn(() => {
    const entry = { port: 3001 + servers.length, close: vi.fn() }; servers.push(entry);
    const server = { listen: (_port: number, _host: string, ready: () => void) => { ready(); return server; }, address: () => ({ port: entry.port }), close: entry.close };
    return server;
  }) };
  const times = { base: options.baseTimes ?? [9000, 80, 100, 120], current: options.currentTimes ?? [7000, 100, 110, 120] };
  const cursors = { base: 0, current: 0 }, navigation: { key: string; waitUntil: string }[] = [];
  let clock = 0;
  const querySelector = vi.fn(() => ({ disabled: false }));
  const waitForFunction = vi.fn();
  const browser = { close: vi.fn(), newContext: vi.fn(async () => {
    let key: 'base' | 'current' = 'base';
    return { close: vi.fn(), newPage: async () => ({
      goto: async (url: string, options: { waitUntil: string }) => {
        key = new URL(url).port === '3001' ? 'base' : 'current'; navigation.push({ key, waitUntil: options.waitUntil }); clock += 10;
      },
      waitForFunction: async (ready: () => boolean, arg: unknown, options: unknown) => {
        waitForFunction(ready, arg, options);
        if (!ready()) throw new Error('synthetic start button not ready');
        clock += times[key][cursors[key]++] - 10;
      },
    }) };
  }) };
  const enforced = options.enforce ?? true;
  const recordWallClock = vi.fn((_source: string, gates: unknown) => gates);
  const process = { argv: ['node', 'scripts/m7-budget.cjs', `--base=${dirs.base}`, `--current=${dirs.current}`, `--out=${dirs.out}`, '--samples=3',
    ...(options.jsBase ? [`--js-base=${dirs.jsBase}`] : [])], env: {}, exitCode: 0 };
  const console = { log: vi.fn(), error: vi.fn() };
  await runInNewContext(source, { process, console, Date: { now: () => clock }, document: { querySelector }, require: (name: string) => {
    switch (name) {
      case 'node:fs': return fs;
      case 'node:http': return http;
      case 'node:path': return path;
      case 'node:zlib': return { gzipSync };
      case 'playwright': return { chromium: { launch: async () => browser } };
      case './wallclock-gate.cjs': return { wallClockEnforced: enforced, recordWallClock };
      default: throw new Error(`unexpected script dependency ${name}`);
    }
  } }, { filename: 'scripts/m7-budget.cjs' });
  const reportText = files.get(path.join(dirs.out, 'report.json'));
  if (!reportText) throw console.error.mock.calls[0]?.[0] ?? new Error('budget script wrote no report');
  return { report: JSON.parse(reportText) as BudgetReport, exitCode: process.exitCode, navigation, querySelector, waitForFunction, browser, servers };
}

describe('3D gzip column and unchanged 2D/interaction budgets', () => {
  it('separates 3D chunks by directory, including normal-named chunks, without misclassifying top-level 2D names', async () => {
    const current = { 'assets/main.js': payload, 'assets/three-loader.js': payload, 'assets/render3d-helper.js': payload,
      'assets/3d/plain.js': payload, 'assets/3d/vendor.js': `${payload}\n${payload}`, 'assets/3d/ignored.js.map': 'map', 'assets/style.css': 'css' };
    const { report } = await runBudget({ current });
    expect(report.jsGzipBytes.current).toBe(gzipBytes(payload) * 3);
    expect(report.js3dGzipBytes).toBe(gzipBytes(payload) + gzipBytes(`${payload}\n${payload}`));
    expect(report.jsRatio).toBe(3);
  });
  it('reports zero when the optional 3D directory is absent', async () => {
    const { report, exitCode } = await runBudget();
    expect(report.js3dGzipBytes).toBe(0); expect(report.jsRatio).toBe(1); expect(exitCode).toBe(0);
    expect(report.baselineDirectories).toEqual({ js: '/synthetic-rendering3d-budget/base', interactive: '/synthetic-rendering3d-budget/base' });
  });
  it('adding 3D chunks changes only the separate column, leaving both 2D budgets and decisions unchanged', async () => {
    const before = await runBudget(), after = await runBudget({ current: { 'assets/current.js': payload, 'assets/3d/only.js': payload.repeat(100) } });
    expect(after.report.js3dGzipBytes).toBe(gzipBytes(payload.repeat(100)));
    const { js3dGzipBytes: _before3d, ...before2d } = before.report;
    const { js3dGzipBytes: _after3d, ...after2d } = after.report;
    expect(after2d).toEqual(before2d); expect(after.exitCode).toBe(before.exitCode);
  });
  it('uses the separate JS baseline while preserving the interaction baseline and ignoring its optional 3D files', async () => {
    const { report } = await runBudget({ base: { 'assets/interaction-base.js': payload.repeat(5) },
      jsBase: { 'assets/base-a.js': payload, 'assets/base-b.js': payload, 'assets/3d/ignored.js': payload.repeat(10) },
      current: { 'assets/a.js': payload, 'assets/b.js': payload, 'assets/c.js': payload } });
    expect(report.baselineDirectories).toEqual({ js: dirs.jsBase, interactive: dirs.base });
    expect(report.jsGzipBytes).toEqual({ base: gzipBytes(payload) * 2, current: gzipBytes(payload) * 3 });
    expect(report.jsRatio).toBe(1.5); expect(report.interactiveMs.baseMedian).toBe(100);
  });
  it.each([3, 4])('enforces the original 1.5 JS threshold with %i equal-sized current chunks against two baseline chunks', async count => {
    const { report, exitCode } = await runBudget({ base: { 'assets/a.js': payload, 'assets/b.js': payload },
      current: Object.fromEntries(Array.from({ length: count }, (_, i) => [`assets/chunk-${i}.js`, payload])) });
    expect(report.jsBudget).toBe(1.5); expect(report.jsRatio).toBe(count / 2);
    expect(report.passed).toBe(count === 3); expect(exitCode).toBe(count === 3 ? 0 : 1);
  });
  it('keeps navigation-to-enabled timing, discards the warm-up pair, alternates builds and uses sample medians', async () => {
    const { report, navigation, querySelector, waitForFunction, browser, servers } = await runBudget();
    expect(report.interactiveMs).toEqual({ base: [80, 100, 120], current: [100, 110, 120], baseMedian: 100, currentMedian: 110 });
    expect(report.interactiveRatio).toBe(1.1); expect(report.interactiveBudget).toBe(1.2);
    expect(navigation.map(row => row.key)).toEqual(['base', 'current', 'current', 'base', 'base', 'current', 'current', 'base']);
    expect(navigation.every(row => row.waitUntil === 'commit')).toBe(true);
    expect(querySelector).toHaveBeenCalledWith('[data-debug="m6-fixed-start"]'); expect(waitForFunction).toHaveBeenCalledTimes(8);
    expect(browser.close).toHaveBeenCalledTimes(1); servers.forEach(server => expect(server.close).toHaveBeenCalledTimes(1));
  });
  it.each([120, 121])('enforces the original 1.2 interaction threshold with current median %i / baseline 100', async median => {
    const { report, exitCode } = await runBudget({ currentTimes: [7000, median + 10, median - 10, median] });
    expect(report.interactiveRatio).toBe(median / 100); expect(report.interactiveBudget).toBe(1.2);
    expect(report.wallClock.gates[0]).toMatchObject({ actual: median / 100, limit: 1.2, passed: median === 120 });
    expect(report.passed).toBe(median === 120); expect(exitCode).toBe(median === 120 ? 0 : 1);
  });
  it('preserves report-only interaction behavior while continuing to enforce the 2D JS threshold', async () => {
    const { report, exitCode } = await runBudget({ enforce: false, currentTimes: [7000, 200, 210, 220] });
    expect(report.wallClock.enforced).toBe(false); expect(report.wallClock.gates[0].passed).toBe(false); expect(report.passed).toBe(true); expect(exitCode).toBe(0);
    const overJs = await runBudget({ enforce: false, current: { 'assets/a.js': payload, 'assets/b.js': payload } });
    expect(overJs.report.passed).toBe(false); expect(overJs.exitCode).toBe(1);
  });
  it('still errors when mandatory 2D assets are missing rather than treating the build as zero bytes', async () => {
    await expect(runBudget({ current: {} })).rejects.toThrow('ENOENT');
    await expect(runBudget({ base: {} })).rejects.toThrow('ENOENT');
    await expect(runBudget({ jsBase: { 'index.html': 'no assets directory' } })).rejects.toThrow('ENOENT');
  });
});
