/**
 * v23 live fix: the online client drops a view (roomRevision) or seat state (seatRevision) push older than one it
 * already rendered on the same socket, and still takes the snapshot a resume sends on a new socket.
 */
import { expect, it } from 'vitest';
import { WsGameClient } from '../../src/rendering/online/ws-client';
import type { PlayerView } from '../../src/rendering/online/protocol';
import type { MatchState } from '../../src/simulation/match-types';
import { createMatch } from '../../src/simulation/match';
import { toSeatPrivateView } from '../../src/server/room/projection';

type Fake = WebSocket & { onmessage: (event: { data: string }) => void; onopen: () => void; onclose: (event: { code: number }) => void };
function fakeSocket(sent: object[]): Fake {
  return { readyState: 1, onopen: null, onmessage: null, onclose: null, onerror: null,
    send(text: string) { sent.push(JSON.parse(text)); }, close() {} } as unknown as Fake;
}
const view = (round: number, endsAt: number) => ({ phase: { kind: 'preparation', round, endsAt, serverNow: 0 }, seats: [], mySeatId: 's' }) as unknown as PlayerView;

it('drops an older view or state after a newer one, and accepts the resume snapshot of a new socket', () => {
  const sent: object[] = [], sockets: Fake[] = [];
  const timers: (() => void)[] = [];
  const client = new WsGameClient({ url: 'ws://memory', storage: null, backoffMs: [1],
    createSocket: () => { const socket = fakeSocket(sent); sockets.push(socket); return socket; },
    timers: { set: callback => { timers.push(callback); return timers.length; }, clear() {} } });
  const views: PlayerView[] = [], states: MatchState[] = [];
  client.listen({ lobby() {}, view: v => views.push(v), state: s => states.push(s), replay() {} });
  const push = (message: object) => sockets.at(-1)!.onmessage({ data: JSON.stringify(message) });
  push({ type: 'receipt', commandId: 1, ok: true, result: { kind: 'joined', token: 't', seatId: 's', connectionEpoch: 1 } });
  const match = createMatch(42), seatView = toSeatPrivateView(match);
  const state = (seatRevision: number, gold: number) => ({ type: 'state', roomId: 'r', round: 1, seatRevision, state: { ...seatView, gold } });

  push({ type: 'view', roomId: 'r', roomRevision: 91, view: view(1, 25_449) });
  push({ ...state(3, 10) });
  push({ type: 'view', roomId: 'r', roomRevision: 92, view: view(2, 40_487) });
  push({ ...state(4, 11) });
  // The live pre-check: rev 91 arrived after rev 92; an older seat state after a newer one.
  push({ type: 'view', roomId: 'r', roomRevision: 91, view: view(1, 25_449) });
  push({ ...state(3, 10) });
  expect(views.map(v => v.phase.endsAt)).toEqual([25_449, 40_487]);
  expect(states.map(s => s.gold)).toEqual([10, 11]);
  // A repeat of the same revision is not older: it is still taken.
  push({ type: 'view', roomId: 'r', roomRevision: 92, view: view(2, 40_487) });
  expect(views).toHaveLength(3);

  // Reconnect: the new socket resumes and the server's snapshot is taken even at lower revisions (a fresh resync).
  sockets.at(-1)!.onclose({ code: 1006 });
  timers.shift()!();
  expect(sockets).toHaveLength(2);
  sockets[1]!.onopen();
  expect(sent.at(-1)).toMatchObject({ type: 'resume', token: 't' });
  push({ type: 'receipt', commandId: 2, ok: true, result: { kind: 'resumed', seatId: 's', connectionEpoch: 2 } });
  push({ type: 'view', roomId: 'r', roomRevision: 5, view: view(2, 50_000) });
  push({ ...state(1, 20) });
  expect(views.at(-1)!.phase.endsAt).toBe(50_000);
  expect(states.at(-1)!.gold).toBe(20);
  // …and on that socket an older push is again dropped.
  push({ type: 'view', roomId: 'r', roomRevision: 4, view: view(2, 1) });
  push({ ...state(0, 1) });
  expect(views.at(-1)!.phase.endsAt).toBe(50_000);
  expect(states.at(-1)!.gold).toBe(20);
  // Another room (a new match) starts from its own revisions.
  push({ type: 'view', roomId: 'r2', roomRevision: 0, view: view(1, 7) });
  push({ ...state(0, 30), roomId: 'r2' });
  expect(views.at(-1)!.phase.endsAt).toBe(7);
  expect(states.at(-1)!.gold).toBe(30);
  client.dispose();
});
