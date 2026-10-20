/**
 * D11 live bank in the room (planning/live-gold-combat-2026-10-20.md): a combat that reads the seat's live gold
 * (avarice-incarnate) sees the gold the seat has at each tick of the battle phase, and the room settles and shows that
 * live run instead of the frozen one. The rules' sampling and replay are covered by tests/d11-wiring-bank.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { PlaceholderBattleResolver } from '../../src/server/room/battle-resolver';
import { toCombatReplayFor } from '../../src/server/room/projection';
import type { Room } from '../../src/server/room/room';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleSeatOutcome, RoomState, SeatState, TwoSidedBattleResult } from '../../src/server/room/types';
import type { MatchState } from '../../src/simulation/match-types';
import { makeRoom, runUntil } from './helpers';
import { replayTail } from '../../src/server/room/live-bank';
import { REPLAY_OPENING_MS, RemoteSession } from '../../src/rendering/online/remote-session';
import { WsGameClient } from '../../src/rendering/online/ws-client';
import type { GameClient } from '../../src/rendering/online/protocol';
import type { CombatReplay } from '../../src/server-entry';
import { COMBAT_TICK_MS } from '../../src/simulation/combat';

const seat = (state: RoomState, seatId: string): SeatState => state.seats.find(candidate => candidate.seatId === seatId)!;
/** Test seam (as g2-4a-forge-timeout): binds avarice-incarnate to the seat's first board unit during its preparation. */
function bindAvarice(room: Room, seatId: string): void {
  const holder = room as unknown as { current: RoomState };
  holder.current = { ...holder.current, seats: holder.current.seats.map(candidate => {
    if (candidate.seatId !== seatId) return candidate;
    const match: MatchState = candidate.match;
    const unit = match.preparation.units.find(entry => entry.team === 'player' && entry.location.kind === 'board')!;
    return { ...candidate, seatRevision: candidate.seatRevision + 1,
      match: { ...match, anomalyBinding: { definitionId: 'avarice-incarnate', unitId: unit.id, choiceId: 'test-avarice', boundRound: match.round } } };
  }) };
}
const pveOutcome = (state: RoomState, seatId: string): BattleSeatOutcome => state.battles.flatMap(battle => battle.kind === 'placeholder' ? battle.outcomes : []).find(outcome => outcome.seatId === seatId)!;
const pvpBattle = (state: RoomState, seatId: string): TwoSidedBattleResult => state.battles.find((battle): battle is TwoSidedBattleResult => battle.kind === 'two-sided' && battle.participants.includes(seatId))!;
/** Some gold-changing operation the seat can afford during its battle: XP, else selling a bench unit. */
function changeGold(room: Room, seatId: string): void {
  const match = seat(room.state, seatId).match;
  if (match.gold >= 4 && room.handle(seatId, { type: 'buyXp' }).ok) return;
  const bench = match.preparation.units.find(unit => unit.team === 'player' && unit.location.kind === 'bench');
  if (bench && room.handle(seatId, { type: 'sell', unitId: bench.id }).ok) return;
  expect(room.handle(seatId, { type: 'reroll' })).toMatchObject({ ok: true });
}

describe('D11 live bank: PvE', () => {
  it('a gold change during a PvE battle settles the live combat it fed, without the frozen-HP fault', () => {
    const { room, clock } = makeRoom(new PlaceholderBattleResolver());
    room.start();
    runUntil(room, clock, state => state.round === 3 && state.phase === 'preparation');
    bindAvarice(room, 's0');
    runUntil(room, clock, state => state.round === 3 && state.phase === 'battle');
    const frozen = pveOutcome(room.state, 's0');
    const hp = seat(room.state, 's0').hp;
    clock.advance(400);
    expect(room.state.phase).toBe('battle');
    const goldBefore = seat(room.state, 's0').match.gold;
    changeGold(room, 's0');
    expect(seat(room.state, 's0').match.gold).not.toBe(goldBefore);
    // The operation stepped the live combat to the live tick before it applied: the rules read the new gold after it.
    expect(seat(room.state, 's0').match.combat!.tick).toBeGreaterThan(0);
    runUntil(room, clock, state => state.round === 3 && state.phase !== 'battle');
    expect(room.state.fault).toBeNull();
    const settled = seat(room.state, 's0');
    const live = pveOutcome(room.state, 's0');
    // The bank the combat read changed, so the published battle is the live run, not the frozen one.
    expect(live).not.toBe(frozen);
    expect(live.combat!.terminal).not.toEqual(frozen.combat!.terminal);
    const record = settled.match.roundResults.at(-1)!;
    expect(record.round).toBe(3);
    expect(live.damage).toBe(record.playerDamage);
    expect(settled.hp).toBe(Math.max(0, hp - live.damage));
    // Its replay is the recorded live frames (the combat cannot be re-run from its start without the gold it read).
    const replay = toCombatReplayFor(room.state, 's0')!;
    expect(replay.replay.terminal.tick).toBe(live.combat!.terminal.tick);
    expect(JSON.stringify(replay)).not.toMatch(/liveGold|bankSamples|currentItemBankGold|openingItemBankGold/);
    expect(room.retained.timers).toBe(1);
  }, 120_000);

  it('a seat whose combat does not read its gold settles exactly as frozen after operating in battle', () => {
    const { room, clock } = makeRoom(new PlaceholderBattleResolver());
    room.start();
    runUntil(room, clock, state => state.round === 3 && state.phase === 'battle');
    const frozen = pveOutcome(room.state, 's0');
    clock.advance(400);
    changeGold(room, 's0');
    runUntil(room, clock, state => state.round === 3 && state.phase !== 'battle');
    expect(room.state.fault).toBeNull();
    expect(pveOutcome(room.state, 's0')).toBe(frozen);
  }, 120_000);
});

describe('D11 live bank: two-sided PvP', () => {
  function playPvp(avarice: boolean) {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    runUntil(room, clock, state => state.round === 5 && state.phase === 'preparation');
    if (avarice) bindAvarice(room, 's0');
    runUntil(room, clock, state => state.round === 5 && state.phase === 'battle');
    const frozen = pvpBattle(room.state, 's0');
    const frozenReplay = toCombatReplayFor(room.state, 's0')!.replay;
    const hp = seat(room.state, 's0').hp;
    const notified: string[] = [];
    let streamed: { fromTick: number; ticks: number } | null = null;
    room.subscribeLive(battleId => {
      notified.push(battleId);
      const frames = room.liveFrames(battleId)!;
      if (!streamed) streamed = { fromTick: frames.fromTick, ticks: frames.ticks.length };
      // Only public view frames leave the room: never the private samples or bank values.
      expect(JSON.stringify(frames)).not.toMatch(/liveGold|bankSamples|currentItemBankGold|openingItemBankGold/);
    });
    clock.advance(400);
    changeGold(room, 's0');
    const gold = seat(room.state, 's0').match.gold;
    runUntil(room, clock, state => state.round === 5 && state.phase !== 'battle');
    return { room, frozen, frozenReplay, hp, gold, notified, streamed: streamed as { fromTick: number; ticks: number } | null, published: pvpBattle(room.state, 's0') };
  }

  it('samples the new gold into a live run at the live tick and settles that run', () => {
    const { room, frozen, frozenReplay, hp, gold, notified, streamed, published } = playPvp(true);
    expect(room.state.fault).toBeNull();
    expect(published).not.toBe(frozen);
    // The changed frames were streamed while the battle ran, from a tick after the sample, before the run finished.
    expect(notified.length).toBeGreaterThan(0);
    expect(streamed!.fromTick).toBeGreaterThan(8);
    const live = toCombatReplayFor(room.state, 's0')!.replay;
    expect(live.ticks.slice(0, streamed!.fromTick)).toEqual(frozenReplay.ticks.slice(0, streamed!.fromTick));
    const team = published.battle.a.seatId === 's0' ? 'player' : 'enemy';
    const samples = published.battle.bankSamples!.filter(sample => sample.team === team);
    expect(samples.at(-1)!.liveGold).toBe(gold);
    // 400 ms of playback = 8 ticks, plus the lead.
    expect(samples.at(-1)!.tick).toBeGreaterThanOrEqual(8);
    const proposal = [published.proposals.a, published.proposals.b].find(entry => entry.seatId === 's0')!;
    expect(seat(room.state, 's0').hp).toBe(Math.max(0, hp - proposal.damage));
    expect(JSON.stringify(toCombatReplayFor(room.state, 's0'))).not.toMatch(/liveGold|bankSamples|currentItemBankGold|openingItemBankGold/);
    expect(room.retained.timers).toBe(1);
  }, 180_000);

  it('a battle no seat of which reads its live gold keeps its frozen run, with nothing streamed', () => {
    const { room, frozen, published, notified } = playPvp(false);
    expect(room.state.fault).toBeNull();
    expect(published).toBe(frozen);
    expect(notified).toEqual([]);
  }, 180_000);
});

describe('D11 live bank: revised replay on the wire and on the board', () => {
  const stub: GameClient = {
    transport: 'local-room', listen: () => () => {}, joinQueue: () => {}, leaveQueue: () => {}, startMatch: () => {},
    send: () => ({ ok: 'pending', commandId: 0 }), reset: () => {}, dispose: () => {},
  };
  /** A frozen and a revised replay of one battle: the revision keeps the first records and changes the rest. */
  function pair(): { readonly before: CombatReplay; readonly after: CombatReplay; readonly from: number } {
    const { room, clock } = makeRoom(new PlaceholderBattleResolver());
    room.start();
    runUntil(room, clock, state => state.round === 3 && state.phase === 'battle');
    const before = toCombatReplayFor(room.state, 's0')!.replay;
    const from = Math.min(5, before.ticks.length - 1);
    const changed = { ...before.ticks[from]!, keyframe: { ...before.initial, tick: from } };
    return { before, after: { ...before, ticks: [...before.ticks.slice(0, from), changed, ...before.ticks.slice(from + 1)] }, from };
  }

  it('replayTail sends only the records from the first difference; the same replay sends nothing', () => {
    const { before, after, from } = pair();
    expect(replayTail(before, before)).toBeNull();
    const tail = replayTail(before, after)!;
    expect(tail.fromTick).toBe(from);
    expect(tail.ticks).toEqual(after.ticks.slice(from));
    expect([...before.ticks.slice(0, tail.fromTick), ...tail.ticks]).toEqual(after.ticks);
  }, 60_000);

  it('the websocket client splices a replay-tail onto the battle it holds and ignores one for another battle', () => {
    const fake = { readyState: 0, onopen: null, onmessage: null, onclose: null, onerror: null, send() {}, close() {} } as unknown as WebSocket & { onmessage: (event: { data: string }) => void };
    const client = new WsGameClient({ url: 'ws://test', storage: { getItem: () => null, setItem() {}, removeItem() {} }, createSocket: () => fake });
    const revised: CombatReplay[] = [];
    client.listen({ lobby() {}, view() {}, state() {}, replay() {}, replayRevised: replay => revised.push(replay) });
    const { before, after, from } = pair();
    const push = (message: object) => fake.onmessage({ data: JSON.stringify(message) });
    push({ type: 'replay', roomId: 'r', round: 3, battleId: 'b', replay: before, unitIds: [] });
    push({ type: 'replay-tail', roomId: 'r', round: 3, battleId: 'other', fromTick: from, ticks: after.ticks.slice(from), terminal: after.terminal });
    expect(revised).toHaveLength(0);
    push({ type: 'replay-tail', roomId: 'r', round: 3, battleId: 'b', fromTick: from, ticks: after.ticks.slice(from), terminal: after.terminal });
    expect(revised).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(revised[0]))).toEqual(JSON.parse(JSON.stringify(after)));
    // A resume resends the battle: the same records change nothing, a revised whole replay is taken as a revision.
    push({ type: 'replay', roomId: 'r', round: 3, battleId: 'b', replay: after, unitIds: [] });
    expect(revised).toHaveLength(1);
    client.dispose();
  }, 60_000);

  it('RemoteSession keeps its playback position and shows the revised records from there', () => {
    const { before, after, from } = pair();
    const session = new RemoteSession(stub, undefined, () => 0);
    session.receiveReplay(before);
    session.advanceDisplay(REPLAY_OPENING_MS);
    for (let tick = 1; tick < from; tick++) session.advanceDisplay(COMBAT_TICK_MS);
    const shown = session.liveBattle!.played;
    session.reviseReplay(after);
    expect(session.liveBattle!.played).toBe(shown);
    expect(session.liveBattle!.replay).toBe(after);
    for (let guard = 0; session.playingBack && guard < 2_000; guard++) session.advanceDisplay(COMBAT_TICK_MS);
    expect(session.combatView).toEqual(after.ticks.at(-1)!.keyframe ?? session.combatView);
    expect(session.lastBattle!.replay).toBe(after);
  }, 60_000);
});
