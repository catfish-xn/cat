import { expect, it } from 'vitest';
import { WsGameClient } from '../../src/rendering/online/ws-client';
import { RemoteSession, REPLAY_OPENING_MS } from '../../src/rendering/online/remote-session';
import type { GameClient } from '../../src/rendering/online/protocol';
import { createMatch, deployMatchUnit, startMatchCombat, stepMatch } from '../../src/simulation/match';
import { toCombatReplay, type CombatReplay } from '../../src/server-entry';

const stub: GameClient = { transport: 'local-room', listen: () => () => {}, joinQueue() {}, leaveQueue() {}, startMatch() {}, send: () => ({ ok: 'pending', commandId: 1 }), reset() {}, dispose() {} };
let cached: CombatReplay | null = null;
function replay() {
  if (cached) return cached;
  const initial = createMatch(42), deployed = deployMatchUnit(initial, initial.preparation.units[0]!.id, { kind: 'board', cell: { col: 3, row: 6 } });
  if (!deployed.ok) throw Error(deployed.reason);
  let result = startMatchCombat(deployed.state); if (!result.ok || !result.state.combat) throw Error('start');
  const opening = result.state.combat, events = [...result.events].filter(e => 'tick' in e);
  while (result.state.phase === 'combat') { result = { ok: true, ...stepMatch(result.state) }; events.push(...result.events.filter(e => 'tick' in e)); }
  return cached = toCombatReplay({ initial: opening, terminal: result.state.combat!, events });
}
it('waits on an empty buffer, appends without rebuilding/replaying the prefix, and only ends after combat-end', () => {
  const full = replay(), session = new RemoteSession(stub, undefined, () => 0);
  const prefix: CombatReplay = { initial: full.initial, ticks: full.ticks.slice(0, 3), terminal: full.initial, stream: { revision: 1, fromTick: 0, ended: false } };
  session.receiveReplay(prefix); session.advanceDisplay(REPLAY_OPENING_MS + 100);
  const held = session.combatView, events = [...session.displayLog];
  expect(session.playingBack).toBe(true); expect(session.liveBattle).not.toBeNull();
  expect(session.advanceDisplay(5_000)).toEqual([]); expect(session.combatView).toBe(held);
  const appended = { ...prefix, ticks: full.ticks.slice(0, 5) };
  session.reviseReplay(appended); expect(session.combatView).toBe(held);
  session.advanceDisplay(100); expect(session.combatView!.tick).toBe(4);
  expect(session.displayLog.slice(0, events.length)).toEqual(events);
  const rest = { ...prefix, ticks: full.ticks };
  session.reviseReplay(rest); session.advanceDisplay(100_000);
  expect(session.playingBack).toBe(true); // even a finished keyframe isn't the authoritative end marker
  session.reviseReplay({ ...rest, terminal: full.terminal, stream: { ...prefix.stream!, ended: true } });
  expect(session.playingBack).toBe(false); expect(session.combatView).toEqual(full.terminal);
  expect(session.displayLog).toEqual(full.ticks.flatMap(f => f.events));
});
it('client drops duplicate/stale chunks and end markers, and reconnects on a gap with its retained cursor', () => {
  const full = replay(), received: CombatReplay[] = [], revised: CombatReplay[] = [], sent: object[] = [];
  const fake = { readyState: 1, onopen: null, onmessage: null, onclose: null, onerror: null,
    send(text: string) { sent.push(JSON.parse(text)); }, close() {} } as unknown as WebSocket & { onmessage: (event: { data: string }) => void; onopen: () => void };
  const client = new WsGameClient({ url: 'ws://memory', storage: null, createSocket: () => fake });
  client.listen({ lobby() {}, view() {}, state() {}, replay: r => received.push(r), replayRevised: r => revised.push(r) });
  const push = (message: object) => fake.onmessage({ data: JSON.stringify(message) });
  push({ type: 'receipt', commandId: 1, ok: true, result: { kind: 'joined', token: 't', seatId: 's', connectionEpoch: 1 } });
  const envelope = { roomId: 'r', round: 1, battleId: 'b', revision: 1 };
  push({ type: 'combat-open', ...envelope, initial: full.initial, frame: full.ticks[0], unitIds: [] });
  const chunk = { type: 'combat-chunk', ...envelope, fromTick: 1, throughTick: 2, ticks: full.ticks.slice(1, 3) };
  push(chunk); push(chunk); push({ ...chunk, revision: 0 }); push({ ...chunk, battleId: 'other' });
  expect(received).toHaveLength(1); expect(revised).toHaveLength(1);
  push({ ...chunk, fromTick: 4, throughTick: 4, ticks: [full.ticks[4]] });
  fake.onopen();
  expect(sent.at(-1)).toMatchObject({ type: 'resume', combat: { battleId: 'b', revision: 1, nextTick: 3, seatId: 's' } });
  expect(revised).toHaveLength(1);
  push({ type: 'combat-chunk', ...envelope, fromTick: 3, throughTick: full.terminal.tick, ticks: full.ticks.slice(3) });
  push({ type: 'combat-end', ...envelope, throughTick: full.terminal.tick, terminal: full.terminal });
  push({ type: 'combat-end', ...envelope, throughTick: full.terminal.tick, terminal: full.terminal });
  expect(revised.at(-1)!.stream!.ended).toBe(true); expect(revised).toHaveLength(3);
  client.dispose();
});
it('switching a resumed keyframe tail to the completed recording preserves the displayed tick', () => {
  const full = replay(), frame = full.ticks.find(f => f.keyframe && f.tick > 0 && f.tick < full.terminal.tick)!;
  const tail: CombatReplay = { initial: frame.keyframe!, ticks: [{ tick: frame.tick, events: [] }, ...full.ticks.slice(frame.tick + 1)],
    terminal: full.terminal, stream: { revision: 1, fromTick: frame.tick, ended: true } };
  const session = new RemoteSession(stub, undefined, () => 0);
  session.receiveReplay(tail); session.advanceDisplay(REPLAY_OPENING_MS + 100);
  const tick = session.combatView!.tick;
  session.reviseReplay(full);
  expect(session.combatView!.tick).toBe(tick);
});
