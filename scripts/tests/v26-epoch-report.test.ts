import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const serial = 'scripts/verify-v26-neutrals-1424-epoch.cjs';
const parallel = 'scripts/verify-v26-epoch-parallel.cjs';
const evidence = 'docs/evidence/v26-neutrals-1424/epoch-verification.json';
const artifact = 'artifacts/v26-neutrals-1424-recording/epoch-verification.json';
const original = Buffer.from('{"previous":"successful evidence"}\n');
type Scenario = 'success' | 'failure' | 'spawn-error' | 'mutation' | 'deletion' | 'publish-error';

// Execute both real entry points and their shared helper with controlled children
// and filesystem I/O. No fixture battles or repository/index writes are needed.
async function run(runner: string, write: boolean, scenario: Scenario) {
  const files = new Map<string, Buffer>([
    [serial, readFileSync(serial)],
    [evidence, original],
    ['tracked.txt', Buffer.from('before')],
  ]);
  const tracked = [...files.keys(), 'already-missing.txt'];
  const writes: string[] = [];
  const finished: string[][] = [];
  const errors: string[] = [];
  let snapshots = 0;
  let launched = 0;
  let active = 0;
  const processMock = {
    argv: ['node', runner, ...(write ? ['--write'] : []), ...(runner === parallel ? ['--jobs=8'] : [])],
    env: {}, execPath: 'node', pid: 42, exitCode: undefined as number | undefined,
  };
  const missing = () => Object.assign(new Error('missing'), { code: 'ENOENT' });
  const fs = {
    readFileSync(file: string, encoding?: string) {
      if (!files.has(file)) throw missing();
      const bytes = files.get(file)!;
      return encoding ? bytes.toString() : bytes;
    },
    lstatSync(file: string) {
      if (!files.has(file)) throw missing();
      return { isSymbolicLink: () => false };
    },
    mkdirSync() {},
    openSync() { return 1; },
    closeSync() {},
    writeFileSync(file: string, bytes: string) {
      // Neither artifacts nor evidence may be finalized while children run.
      expect(active).toBe(0);
      writes.push(file);
      files.set(file, Buffer.from(bytes));
    },
    renameSync(from: string, to: string) {
      expect(active).toBe(0);
      if (scenario === 'publish-error') throw new Error('cannot publish');
      writes.push(to);
      files.set(to, files.get(from)!);
      files.delete(from);
    },
    rmSync(file: string) { files.delete(file); },
  };
  const start = () => {
    // Every child sees the previous successful report, including the last step.
    expect(files.get(evidence)).toEqual(original);
    active++;
    return ++launched;
  };
  const finish = (number: number, args: string[]) => {
    active--;
    finished.push(args);
    if (number !== 1) return { status: 0, signal: null };
    if (scenario === 'mutation') files.set('tracked.txt', Buffer.from('after!'));
    if (scenario === 'deletion') files.delete('tracked.txt');
    return {
      status: scenario === 'failure' ? 2 : scenario === 'spawn-error' ? null : 0,
      signal: null,
      ...(scenario === 'spawn-error' ? { error: new Error('spawn failed') } : {}),
    };
  };
  const childProcess = {
    spawnSync(_exe: string, args: string[]) { return finish(start(), args); },
    spawn(_exe: string, args: string[]) {
      const child = new EventEmitter();
      const number = start();
      queueMicrotask(() => {
        const result = finish(number, args);
        if (result.error) child.emit('error', result.error);
        else child.emit('exit', result.status, result.signal);
      });
      return child;
    },
  };
  function load(file: string): { exports: unknown; completion: unknown } {
    const module = { exports: {} };
    const completion = runInNewContext(readFileSync(file, 'utf8'), {
      module, exports: module.exports, process: processMock, performance,
      console: { log() {}, error(message: string) { errors.push(message); } },
      require(id: string) {
        if (id === 'node:fs') return fs;
        if (id === 'node:child_process') return childProcess;
        if (id === './v26-epoch-report.cjs') return load('scripts/v26-epoch-report.cjs').exports;
        if (id === './offline-process-output.cjs') return {
          readProcessOutput(exe: string, args: string[]) {
            expect(exe).toBe('git');
            expect([...args]).toEqual(['ls-files', '-z']);
            snapshots++;
            return Buffer.from(tracked.join('\0') + '\0');
          },
        };
        return require(id);
      },
    }, { filename: file });
    return { exports: module.exports, completion };
  }
  let thrown: unknown;
  try { await load(runner).completion; } catch (error) { thrown = error; }
  return {
    files, writes, finished, errors, snapshots, thrown, exitCode: processMock.exitCode,
    report: JSON.parse(files.get(artifact)!.toString()),
  };
}

describe.each([serial, parallel])('%s report safety', runner => {
  it('checks all steps without changing tracked bytes and writes one artifact', async () => {
    const result = await run(runner, false, 'success');
    expect(result.thrown).toBeUndefined();
    expect(result.exitCode).toBeUndefined();
    expect(result.snapshots).toBe(2);
    expect(result.writes).toEqual([artifact]);
    expect(result.files.get(evidence)).toEqual(original);
    expect(result.report).toMatchObject({ complete: true, trackedFilesUnchanged: true, changedTrackedFiles: [] });
    expect(result.report.steps).toHaveLength(15);
    expect(result.report.steps.map((step: { args: string[] }) => step.args)).toEqual(
      runner === serial ? result.finished : expect.arrayContaining(result.finished),
    );
    expect(result.report.steps.map((step: { name: string }) => step.name)).toEqual([
      'check-identities', 'record-battle-start', 'record-release', 'record-herald', 'record-inputs',
      'record-live-reveal', 'record-transfer', 'check-transfer', 'check-inputs', 'check-herald',
      'check-history', 'check-live-reveal', 'record-chest-trial', 'consumer-byte-audit', 'compare-digests',
    ]);
  });

  it('publishes complete write results exactly once after all children finish', async () => {
    const result = await run(runner, true, 'success');
    expect(result.thrown).toBeUndefined();
    expect(result.exitCode).toBeUndefined();
    expect(result.snapshots).toBe(0);
    expect(result.report.complete).toBe(true);
    expect(result.report.steps).toHaveLength(15);
    expect(result.files.get(evidence)).toEqual(result.files.get(artifact));
    expect(result.writes).toEqual([artifact, evidence + '.42.tmp', evidence]);
    expect(result.files.has(evidence + '.42.tmp')).toBe(false);
  });

  for (const write of [false, true]) {
    it.each(['failure', 'spawn-error'] as const)(`preserves evidence on %s (write=${write})`, async scenario => {
      const result = await run(runner, write, scenario);
      expect(result.thrown).toBeUndefined();
      expect(result.exitCode).toBe(1);
      expect(result.files.get(evidence)).toEqual(original);
      expect(result.writes).toEqual([artifact]);
      expect(result.report.complete).toBe(false);
      expect(result.report.steps).toHaveLength(result.finished.length);
      expect(result.report.steps.length).toBeLessThan(15);
      expect(result.report.steps[0].exitCode).toBe(scenario === 'failure' ? 2 : null);
      expect(result.snapshots).toBe(write ? 0 : 2);
      if (!write) expect(result.report.trackedFilesUnchanged).toBe(true);
    });
  }

  it.each(['mutation', 'deletion'] as const)('fails check mode on tracked file %s', async scenario => {
    const result = await run(runner, false, scenario);
    expect(result.thrown).toBeUndefined();
    expect(result.exitCode).toBe(1);
    expect(result.files.get(evidence)).toEqual(original);
    expect(result.writes).toEqual([artifact]);
    expect(result.report).toMatchObject({ complete: false, trackedFilesUnchanged: false, changedTrackedFiles: ['tracked.txt'] });
    expect(result.report.steps).toHaveLength(15);
    expect(result.errors).toEqual(['Check mode changed tracked files: tracked.txt']);
  });

  it('preserves previous evidence when final atomic publication fails', async () => {
    const result = await run(runner, true, 'publish-error');
    expect(String(result.thrown)).toContain('cannot publish');
    expect(result.files.get(evidence)).toEqual(original);
    expect(result.files.has(evidence + '.42.tmp')).toBe(false);
    expect(result.report.complete).toBe(true);
  });
});
