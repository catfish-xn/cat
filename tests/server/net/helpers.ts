import { ManualClock } from '../../../src/server/room/clock';
import type { BattleResolver } from '../../../src/server/room/battle-resolver';
import { createGameServer, type GameServer, type GameServerOptions } from '../../../src/server/net/server';
import { TestClient } from '../../../src/server/net/test-client';
import type { ServerMessage } from '../../../src/server/net/messages';
import { DamageResolver, TIMINGS } from '../helpers';

export interface NetHarness {
  readonly server: GameServer;
  readonly clock: ManualClock;
  readonly url: string;
  connect(): Promise<TestClient>;
  close(): Promise<void>;
}

/** Real sockets on a random port; the room runs on a ManualClock so no test waits for wall time. */
export async function startServer(overrides: Partial<GameServerOptions> = {}, resolver: BattleResolver = new DamageResolver(() => 10)): Promise<NetHarness> {
  const clock = (overrides.clock as ManualClock | undefined) ?? new ManualClock();
  const server = await createGameServer({
    port: 0, host: '127.0.0.1', clock, seed: 42, resolver, roomId: 'net-room', timings: TIMINGS,
    limits: { maxMessagesPerWindow: 10_000 }, ...overrides,
  });
  const url = `ws://127.0.0.1:${server.port}`;
  const clients: TestClient[] = [];
  return {
    server, clock, url,
    async connect() { const client = await TestClient.connect(url); clients.push(client); return client; },
    async close() { for (const client of clients) if (client.isOpen) client.close(); await server.close(); },
  };
}

/** Two humans seated and the match started; both hold their first view and private state. */
export async function seatTwo(harness: NetHarness, names: [string, string] = ['甲', '乙']): Promise<[TestClient, TestClient]> {
  const a = await harness.connect(), b = await harness.connect();
  expectOk(await a.join(names[0])); expectOk(await b.join(names[1]));
  expectOk(await a.start());
  await Promise.all([a, b].map(client => client.waitFor(message => message.type === 'state')));
  await Promise.all([a, b].map(client => client.waitFor(message => message.type === 'view')));
  return [a, b];
}

export function expectOk(receipt: { ok: boolean; reason?: string }): void {
  if (!receipt.ok) throw new Error(`expected an accepted receipt, got ${receipt.reason}`);
}

/** True when any nested object of `value` has a key named `key`. */
export function hasKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some(entry => hasKey(entry, key));
  if (typeof value !== 'object' || value === null) return false;
  if (key in value) return true;
  return Object.values(value).some(entry => hasKey(entry, key));
}

export function messagesOfType<T extends ServerMessage['type']>(inbox: readonly ServerMessage[], type: T): Extract<ServerMessage, { type: T }>[] {
  return inbox.filter((message): message is Extract<ServerMessage, { type: T }> => message.type === type);
}

/** Lets the event loop deliver anything already on the wire. */
export const flush = (ms = 50): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
