import type { EventEmitter } from 'node:events';
import { describe, vi } from 'vitest';
import { registerBusyMatch } from './settlement-queue-harness';

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

// One route per file; each round continues its cached run under the default case timeout.
// Legacy resolver path: PvE live-bank tails span many slices, so frozen arrivals are guaranteed.
describe('commands arriving during sliced settlement', () => {
  registerBusyMatch(socket => transport.connect!(socket), false, 10);
});
