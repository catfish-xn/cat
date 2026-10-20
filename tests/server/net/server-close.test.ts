/**
 * Server shutdown and failed start leave nothing behind on the injected clock: a superseded connection's pending close
 * is cancelled by close(), and a listen that fails releases the lobby it built.
 */
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../../src/server/room/clock';
import { createGameServer } from '../../../src/server/net/server';
import { expectOk, startServer } from './helpers';

describe('server close and failed start', () => {
  it('cancels the delayed close of a superseded connection when the server closes', async () => {
    const harness = await startServer();
    const a = await harness.connect();
    expectOk(await a.join('甲'));
    const b = await harness.connect();
    expectOk(await b.resume(a.token!));
    await a.waitFor(message => message.type === 'error' && message.code === 'session-superseded');
    expect(harness.clock.pending).toBe(1); // the superseded tab's grace-period close
    await harness.close();
    expect(harness.clock.pending).toBe(0);
  });

  it('rejects a start on a taken port and leaves no timer on the clock', async () => {
    const holder = await startServer();
    const clock = new ManualClock();
    await expect(createGameServer({ port: holder.server.port, host: '127.0.0.1', clock, seed: 1, queueTimeoutMs: 1_000 })).rejects.toThrow();
    expect(clock.pending).toBe(0);
    await holder.close();
  });
});
