import { expect, it } from 'vitest';
import { WsGameClient } from '../../src/rendering/online/ws-client';
import { RemoteSession, REPLAY_OPENING_MS, STREAM_BUFFER_TICKS } from '../../src/rendering/online/remote-session';
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
  const appended = { ...prefix, ticks: full.ticks.slice(0, 7) };
  session.reviseReplay(appended); expect(session.combatView).toBe(held);
  session.advanceDisplay(0); expect(session.combatView!.tick).toBe(2); // retained time credit, four-tick jitter buffer
  expect(session.displayLog.slice(0, events.length)).toEqual(events);
  const rest = { ...prefix, ticks: full.ticks };
  session.reviseReplay(rest); session.advanceDisplay(100_000);
  expect(session.playingBack).toBe(true); // even a finished keyframe isn't the authoritative end marker
  session.reviseReplay({ ...rest, terminal: full.terminal, stream: { ...prefix.stream!, ended: true } });
  expect(session.playingBack).toBe(true);
  session.advanceDisplay(0);
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
  const envelope = { roomId: 'r', round: 1, battleId: 'b', revision: 1, seatId: 's', watch: false };
  push({ type: 'combat-open', ...envelope, initial: full.initial, frame: full.ticks[0], unitIds: [] });
  const chunk = { type: 'combat-chunk', ...envelope, fromTick: 1, throughTick: 2, ticks: full.ticks.slice(1, 3) };
  const sendChunk = (part: object) => push({ type: 'combat-chunk', chunks: [part] });
  sendChunk(chunk); sendChunk(chunk); sendChunk({ ...chunk, revision: 0 }); sendChunk({ ...chunk, battleId: 'other' });
  expect(received).toHaveLength(1); expect(revised).toHaveLength(1);
  sendChunk({ ...chunk, fromTick: 4, throughTick: 4, ticks: [full.ticks[4]] });
  fake.onopen();
  expect(sent.at(-1)).toMatchObject({ type: 'resume', combat: { battleId: 'b', revision: 1, nextTick: 3, seatId: 's' } });
  expect(revised).toHaveLength(1);
  sendChunk({ ...envelope, fromTick: 3, throughTick: full.terminal.tick, ticks: full.ticks.slice(3) });
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

it('slow irregular delivery retains fractional time at the frontier and drains every event after the end marker', () => {
  const full = replay(), session = new RemoteSession(stub, undefined, () => 0);
  const prefix = (through: number, ended = false): CombatReplay => ({ initial: full.initial, ticks: full.ticks.slice(0, through + 1),
    terminal: ended ? full.terminal : full.initial, stream: { revision: 1, fromTick: 0, ended } });
  session.receiveReplay(prefix(0));
  const seam = session as unknown as { accumulator: number };
  session.advanceDisplay(227);
  expect(seam.accumulator).toBe(77); // no received frame has enough future ticks yet
  for (let through = 2; through < full.ticks.length; through += 2) {
    session.reviseReplay(prefix(Math.min(through, full.ticks.length - 1)));
    session.advanceDisplay(137);
    expect(session.combatView!.tick).toBeLessThanOrEqual(Math.max(0, through - STREAM_BUFFER_TICKS));
  }
  session.reviseReplay(prefix(full.ticks.length - 1, true)); session.advanceDisplay(200);
  expect(session.playingBack).toBe(false); expect(session.combatView).toEqual(full.terminal);
  expect(session.displayLog).toEqual(full.ticks.flatMap(frame => frame.events));
  expect(session.playbackDebug().superseded).toBe(0);
});

it('own and watched streams use separate callbacks and resume cursors; watch receipts leave no pending messages', () => {
  const full = replay(), sent: Record<string, unknown>[] = [], session = new RemoteSession(stub, undefined, () => 0);
  const fake = { readyState: 1, onopen: null, onmessage: null, onclose: null, onerror: null,
    send(text: string) { sent.push(JSON.parse(text)); }, close() {} } as unknown as WebSocket & { onmessage: (event: { data: string }) => void; onopen: () => void };
  const client = new WsGameClient({ url: 'ws://memory', storage: null, createSocket: () => fake });
  client.listen({ lobby() {}, view() {}, state() {}, replay: r => session.receiveReplay(r), replayRevised: r => session.reviseReplay(r),
    watched: (seatId, r) => session.watchReplay(seatId, r) });
  const push = (message: object) => fake.onmessage({ data: JSON.stringify(message) });
  push({ type: 'receipt', commandId: 1, ok: true, result: { kind: 'joined', token: 't', seatId: 's', connectionEpoch: 1 } });
  push({ type: 'view', roomId: 'r', view: { phase: { kind: 'combat', round: 1 } } });
  const own = { roomId: 'r', round: 1, battleId: 'own', revision: 1, seatId: 's', watch: false };
  const watch = { ...own, battleId: 'other', seatId: 'other', watch: true };
  const open = (envelope: object) => push({ type: 'combat-open', ...envelope, initial: full.initial, frame: full.ticks[0], unitIds: [] });
  open(own); client.watch('other');
  expect(client.pendingCount).toBe(1);
  push({ type: 'receipt', commandId: sent.at(-1)!.commandId, ok: true, result: { kind: 'watching', seatId: 'other' } });
  expect(client.pendingCount).toBe(0); open(watch);
  push({ type: 'combat-chunk', chunks: [{ ...own, fromTick: 1, throughTick: 7, ticks: full.ticks.slice(1, 8) },
    { ...watch, fromTick: 1, throughTick: 4, ticks: full.ticks.slice(1, 5) }] });
  session.advanceDisplay(250);
  expect(session.watchedSeat).toBe('other');
  expect(session.lastBattle!.replay.ticks).toHaveLength(8); expect(session.battleHistory).toHaveLength(1);
  fake.onopen();
  expect(sent.at(-1)).toMatchObject({ type: 'resume', watchSeatId: 'other',
    combat: { battleId: 'own', seatId: 's', nextTick: 8 }, watchCombat: { battleId: 'other', seatId: 'other', nextTick: 5 } });
  client.watch(null);
  push({ type: 'combat-chunk', chunks: [{ ...watch, fromTick: 5, throughTick: 7, ticks: full.ticks.slice(5, 8) }] });
  session.stopWatching();
  expect(session.combatView!.tick).toBe(1); // own playback kept advancing underneath the watch
  expect(session.lastBattle!.replay.ticks).toHaveLength(8);
  client.dispose();
});
