import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const { replayErrorGuard, assertNoReplayErrors } = createRequire(import.meta.url)('../../scripts/replay-error-guard.cjs');
const root = fileURLToPath(new URL('../../', import.meta.url));

describe('Server replay errors fail acceptance scripts', () => {
  it.each([
    ['replay.failed after readiness', "process.stdout.write('READY\\n'); setImmediate(() => process.stderr.write('error replay.failed roomId=room-1\\n'));", 1],
    ['split replay-divergence after readiness', "process.stdout.write('READY\\n'); setImmediate(() => {process.stderr.write('replay-div'); setImmediate(() => process.stderr.write('ergence'));});", 1],
    ['replay.failed before readiness', "process.stderr.write('error replay.failed\\n'); process.stdout.write('READY\\n');", 1],
    ['unrelated server output', "process.stdout.write('READY\\n'); setImmediate(() => process.stderr.write('ordinary server warning\\n'));", 0],
  ] as const)('%s cannot be hidden by an explicit success exit', (_label, childCode, status) => {
    const runner = `
      import { start, stopAll } from './tests/server/e2e/harness.mjs';
      const child = await start(process.execPath, ['-e', ${JSON.stringify(childCode)}], {}, /READY/);
      child.once('exit', () => { stopAll(); process.exit(0); });
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', runner], { cwd: root, encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(status);
    if (status) expect(result.stderr).toContain('Server replay error:');
  });
  it('the load worker detects split logs and rejects the match even with no client error', () => {
    const failures: string[] = [];
    const observe = replayErrorGuard((error: Error) => failures.push(error.message));
    observe('error rep'); observe('lay.failed roomId=room-1');
    expect(failures).toHaveLength(1);
    expect(() => assertNoReplayErrors(failures)).toThrow('Server replay errors: 1');
    expect(() => assertNoReplayErrors([])).not.toThrow();
  });
});
