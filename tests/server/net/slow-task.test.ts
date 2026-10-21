import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogRecord } from '../../../src/server/log';
import { SLOW_TASK_LOG_EVERY_MS } from '../../../src/server/net/server';
import { ManualClock } from '../../../src/server/room/clock';
import { startServer, type NetHarness } from './helpers';

let harness: NetHarness | null = null;
afterEach(async () => {
  try { await harness?.close(); } finally { harness = null; vi.restoreAllMocks(); }
});

/** Exercise the real room-clock/write-queue wrapper without running a match.
 * The public lobby start operation stands in for synchronous work of a known duration;
 * the injected clock and logger remain the server's actual measurement/reporting hooks.
 */
async function setup(loopLagReportMs?: number) {
  const clock = new ManualClock();
  const records: LogRecord[] = [];
  harness = await startServer({
    clock, queueTimeoutMs: 1, loopLagReportMs,
    heartbeat: { intervalMs: 50_000, timeoutMs: 100_000 },
    logger: (level, event, fields) => records.push({ level, event, ...fields }),
  });
  const server = harness.server;
  let duration = 0;
  const start = vi.spyOn(server.lobby, 'start').mockImplementation(() => {
    clock.advance(duration);
    return { ok: false, reason: 'empty' };
  });
  function task(ms: number) {
    duration = ms;
    const joined = server.lobby.join('timed work');
    if (!joined.ok) throw new Error(`join failed: ${joined.reason}`);
    const calls = start.mock.calls.length;
    // An observability timer may share this deadline and run before the queued task.
    while (start.mock.calls.length === calls) expect(clock.fireNext()).toBe(true);
    expect(start).toHaveBeenCalledTimes(calls + 1);
    server.lobby.leave(joined.seatId);
  }
  const slow = () => records.filter(record => record.event === 'task.slow');
  function pending() {
    task(55);
    const firstLoggedAt = clock.now();
    expect(slow()).toHaveLength(1);
    expect(slow()[0]).toMatchObject({ level: 'warn', task: 'room', count: 1, longestMs: 55 });
    // N = 3 pending tasks: the maximum and latest duration deliberately differ.
    for (const ms of [80, 125, 60]) task(ms);
    expect(slow()).toHaveLength(1);
    return firstLoggedAt;
  }
  return { clock, records, task, slow, pending };
}

describe('task.slow pending-window reports', () => {
  it('logs the first slow task immediately and ignores a fast task before expiry', async () => {
    const { task, slow } = await setup();
    task(55);
    expect(slow()).toHaveLength(1);
    expect(slow()[0]).toMatchObject({ task: 'room', count: 1, longestMs: 55 });
    task(0);
    expect(slow()).toHaveLength(1);
  });

  it('flushes count, maximum and latest slow duration on a fast task at window expiry, only once', async () => {
    const { clock, records, task, slow, pending } = await setup(SLOW_TASK_LOG_EVERY_MS + 57);
    const firstLoggedAt = pending();
    // The next queue-timeout task finishes exactly at the reporting boundary.
    clock.advance(firstLoggedAt + SLOW_TASK_LOG_EVERY_MS - 1 - clock.now());
    expect(slow()).toHaveLength(1);
    task(0);
    expect(slow()).toHaveLength(2);
    expect(slow()[1]).toMatchObject({ task: 'room', count: 3, longestMs: 125 });
    expect.soft(slow()[1]).toHaveProperty('lastMs', 60);
    task(0);
    clock.advance(SLOW_TASK_LOG_EVERY_MS);
    expect(records.some(record => record.event === 'loop.lag')).toBe(true);
    await harness!.close(); harness = null;
    expect(slow()).toHaveLength(2); // neither fast task, timer nor close duplicates the batch
    expect(clock.pending).toBe(0);
  });

  it('flushes an idle pending batch using only the loop.lag timer', async () => {
    const interval = SLOW_TASK_LOG_EVERY_MS + 57;
    const { clock, records, slow, pending } = await setup(interval);
    pending();
    clock.advance(interval - 1 - clock.now());
    expect(slow()).toHaveLength(1);
    clock.advance(1);
    expect(records.filter(record => record.event === 'loop.lag')).toHaveLength(1);
    expect(slow()).toHaveLength(2);
    expect(slow()[1]).toMatchObject({ task: 'room', count: 3, longestMs: 125 });
    clock.advance(interval);
    expect(slow()).toHaveLength(2);
    await harness!.close(); harness = null;
    expect(slow()).toHaveLength(2);
    expect(clock.pending).toBe(0);
    const count = records.length;
    clock.advance(100_000);
    expect(records).toHaveLength(count);
  });

  it('flushes the unexpired pending batch on close and cancels all timers', async () => {
    const { clock, records, slow, pending } = await setup(SLOW_TASK_LOG_EVERY_MS);
    pending();
    expect(clock.pending).toBe(2); // loop.lag and heartbeat
    await harness!.close(); harness = null;
    expect(slow()).toHaveLength(2);
    expect(slow()[1]).toMatchObject({ task: 'room', count: 3, longestMs: 125 });
    expect(clock.pending).toBe(0);
    const count = records.length;
    clock.advance(100_000);
    expect(records).toHaveLength(count);
    expect(clock.pending).toBe(0);
  });
});
