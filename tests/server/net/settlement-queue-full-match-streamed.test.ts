import type { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { playBusyMatch } from './settlement-queue-harness';

// Exercise the real parse/auth/dedupe/write queue with an in-memory transport; no listening port is required.
const transport = vi.hoisted(() => ({ connect: null as ((socket: EventEmitter) => void) | null }));
vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');
  return { WebSocketServer: class extends EventEmitter {
    override on(event: string, listener: (...args: unknown[]) => void): this {
      if (event === 'connection') { transport.connect = listener; return this; }
      return super.on(event, listener);
    }
    close(cb?: () => void) { cb?.(); }
  } };
});
vi.mock('node:http', async () => {
  const { EventEmitter } = await import('node:events');
  return { createServer: () => Object.assign(new EventEmitter(), {
    listen(_port: number, _host: string, ready: () => void) { ready(); },
    address: () => ({ port: 12345 }), close: (cb: () => void) => cb(), closeIdleConnections() {},
  }) };
});

// Split out of settlement-queue.test.ts so the two whole-match cases run on separate workers.
// The streamed path (production default) plans from sealed terminals and usually commits within one slice.
describe('commands arriving during sliced settlement', () => {
  it('finishes deterministically with eight bot controllers and continuous authenticated human traffic (streaming=true)', async () => {
    const play = () => playBusyMatch(socket => transport.connect!(socket), true, 0);
    expect(await play()).toEqual(await play());
  }, 600_000);
});
