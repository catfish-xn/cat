/**
 * Work order C6: the client plays the server's compact replay (contract §14.2) through RemoteSession, the same
 * session the browser uses. No DOM: a stub GameClient stands in for the transport.
 */
import { describe, expect, it } from 'vitest';
import { toCombatReplayFor } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleSeatOutcome, RoomState, TwoSidedBattleResult } from '../../src/server/room/types';
import { REPLAY_OPENING_MS, RemoteSession } from '../../src/rendering/online/remote-session';
import type { GameClient } from '../../src/rendering/online/protocol';
import { toDisplayEvents } from '../../src/presentation/combat-display';
import { applyCombatReplayTick, toCombatReplay, type CombatReplay, type CombatViewState } from '../../src/server-entry';
import { COMBAT_TICK_MS } from '../../src/simulation/combat';
import { makeRoom, runUntil } from './helpers';

const client: GameClient = {
  transport: 'local-room', listen: () => () => {}, joinQueue: () => {}, leaveQueue: () => {}, startMatch: () => {},
  send: () => ({ ok: 'pending', commandId: 0 }), reset: () => {}, dispose: () => {},
};
/** Frame time only: these tests hand playback every millisecond themselves, so wall time never needs catching up. */
const frozen = () => 0;
/** Feeds a replay to a fresh RemoteSession and advances it one tick (50 ms) at a time to the end. */
function playThroughSession(replay: CombatReplay): { session: RemoteSession; views: CombatViewState[] } {
  const session = new RemoteSession(client, undefined, frozen);
  session.receiveReplay(replay);
  expect(session.combatView).toBe(replay.initial);
  const views: CombatViewState[] = [];
  expect(session.advanceDisplay(REPLAY_OPENING_MS - 1)).toEqual([]); // the opening transition holds the initial view
  session.advanceDisplay(1);
  views.push(session.combatView!);
  for (let guard = 0; session.playingBack && guard < 2_000; guard++) { session.advanceDisplay(COMBAT_TICK_MS); views.push(session.combatView!); }
  return { session, views };
}

let cache: { state: RoomState; pvp: TwoSidedBattleResult; pve: BattleSeatOutcome } | null = null;
/** One room up to its first real PvP battle; its PvE battles of round 1 were kept along the way. */
function battles() {
  if (cache) return cache;
  const { room, clock } = makeRoom(new TwoSidedBattleResolver());
  room.start();
  const pveState = runUntil(room, clock, current => current.phase === 'battle' && current.roundKind === 'pve', 400);
  const pve = pveState.battles.flatMap(battle => battle.kind === 'placeholder' ? battle.outcomes : []).find(outcome => outcome.combat && outcome.combat.initial.units.length > 1)!;
  const state = runUntil(room, clock, current => current.phase === 'battle' && current.battles.some(battle => battle.kind === 'two-sided' && battle.participants.length === 2), 600);
  const pvp = state.battles.find((candidate): candidate is TwoSidedBattleResult => candidate.kind === 'two-sided' && candidate.participants.length === 2)!;
  cache = { state, pvp, pve };
  return cache;
}

describe('C6 replay playback in RemoteSession', () => {
  it('applies every tick record in order and ends exactly on the terminal view (A and mirrored B)', () => {
    const { state, pvp } = battles();
    for (const seatId of [pvp.battle.a.seatId, pvp.battle.b.seatId]) {
      const { replay } = toCombatReplayFor(state, seatId)!;
      const { session, views } = playThroughSession(replay);
      expect(views).toHaveLength(replay.ticks.length);
      expect(views.map(view => view.tick)).toEqual(replay.ticks.map(frame => frame.tick));
      expect(session.combatView).toEqual(replay.terminal);
      expect(session.playingBack).toBe(false);
      // Every animation event and unitUpdated diff was handed to the scene once, in order.
      expect(session.displayLog).toEqual(replay.ticks.flatMap(frame => frame.events));
    }
  }, 60_000);

  it('a keyframe replaces the whole view; diffs between keyframes agree with it', () => {
    const { state, pvp } = battles();
    const { replay } = toCombatReplayFor(state, pvp.battle.a.seatId)!;
    let view = replay.initial;
    let keyframes = 0;
    for (const frame of replay.ticks) {
      const next = applyCombatReplayTick(view, frame);
      if (frame.keyframe) {
        keyframes++;
        expect(next).toBe(frame.keyframe);
        // The unit diffs alone reach the same unit values (status/result change only through the final keyframe).
        const diffsOnly = applyCombatReplayTick(view, { tick: frame.tick, events: frame.events });
        expect(JSON.parse(JSON.stringify(diffsOnly.units))).toEqual(JSON.parse(JSON.stringify(frame.keyframe.units)));
      }
      view = next;
    }
    expect(keyframes).toBeGreaterThan(0);
    // A tampered keyframe wins over the diffs before it: the session shows exactly the keyframe.
    const at = replay.ticks.findIndex(frame => frame.keyframe && frame.tick > 0);
    const marked = { ...replay.ticks[at]!.keyframe!, units: replay.ticks[at]!.keyframe!.units.map(unit => ({ ...unit, hp: 1 })) };
    const tampered: CombatReplay = { ...replay, ticks: replay.ticks.map((frame, index) => index === at ? { ...frame, keyframe: marked } : frame) };
    const session = new RemoteSession(client, undefined, frozen);
    session.receiveReplay(tampered);
    session.advanceDisplay(REPLAY_OPENING_MS - COMBAT_TICK_MS + (at + 1) * COMBAT_TICK_MS);
    expect(session.combatView).toBe(marked);
  }, 60_000);

  it('side B sees every cell row-flipped and teams swapped, values unchanged', () => {
    const { state, pvp } = battles();
    const a = toCombatReplayFor(state, pvp.battle.a.seatId)!.replay, b = toCombatReplayFor(state, pvp.battle.b.seatId)!.replay;
    const rows = a.initial.board.rows;
    const endA = playThroughSession(a).session.combatView!, endB = playThroughSession(b).session.combatView!;
    expect(endB.units.map(unit => unit.id)).toEqual(endA.units.map(unit => unit.id));
    endA.units.forEach((unit, index) => {
      const twin = endB.units[index]!;
      expect(twin.cell).toEqual({ col: unit.cell.col, row: rows - 1 - unit.cell.row });
      expect(twin.team).toBe(unit.team === 'player' ? 'enemy' : 'player');
      expect(twin.hp).toBe(unit.hp); expect(twin.mana).toBe(unit.mana); expect(twin.alive).toBe(unit.alive);
    });
    expect(endB.result).toBe(endA.result === 'playerWin' ? 'enemyWin' : endA.result === 'enemyWin' ? 'playerWin' : endA.result);
  }, 60_000);

  it('skips to the terminal view when the tab returns and drops the battle once the settled state arrives', () => {
    const { state, pvp } = battles();
    const { replay } = toCombatReplayFor(state, pvp.battle.a.seatId)!;
    const session = new RemoteSession(client, undefined, frozen);
    const before = session.state;
    session.receiveReplay(replay);
    expect(session.takeOpening()).toBe(true); expect(session.takeOpening()).toBe(false);
    expect(session.phase).toBe('combat');
    session.advanceDisplay(REPLAY_OPENING_MS + 3 * COMBAT_TICK_MS);
    expect(session.playingBack).toBe(true);
    session.skipPlayback();
    expect(session.playingBack).toBe(false);
    expect(session.combatView).toBe(replay.terminal);
    expect(session.advanceDisplay(COMBAT_TICK_MS)).toEqual([]); // stays on terminal until the server pushes
    session.receiveState({ ...before, round: before.round + 1, phase: 'settlement' } as typeof before);
    expect(session.combatView).toBeNull();
    expect(session.phase).toBe('settlement');
  }, 60_000);
});

describe('C6 playback keeps 1x across dropped frames', () => {
  it('catches up with wall time when frames were dropped, never runs ahead of it', () => {
    const { state, pvp } = battles();
    const { replay } = toCombatReplayFor(state, pvp.battle.a.seatId)!;
    let now = 1_000;
    const session = new RemoteSession(client, undefined, () => now);
    session.receiveReplay(replay);
    // A 2 s stall the page never handed over (one 16 ms frame after it): the board jumps to where 1x would be.
    now += 2_000;
    session.advanceDisplay(16);
    expect(session.combatView!.tick).toBe(Math.floor((2_000 - REPLAY_OPENING_MS) / COMBAT_TICK_MS));
    // Normal frames afterwards advance one tick per 50 ms, no further correction.
    now += 100; session.advanceDisplay(100);
    expect(session.combatView!.tick).toBe(Math.floor((2_100 - REPLAY_OPENING_MS) / COMBAT_TICK_MS));
  }, 60_000);
});

describe('C6 one display whitelist for offline and online', () => {
  it('projects a local ledger exactly like the server replay events (PvP and PvE)', () => {
    const { state, pvp, pve } = battles();
    const pvpReplay = toCombatReplayFor(state, pvp.battle.a.seatId)!.replay;
    const wire = (replay: CombatReplay) => replay.ticks.flatMap(frame => frame.events).filter(event => event.type !== 'unitUpdated');
    // effectTriggered is an execution program the wire never carries; offline keeps it for its label only.
    const local = (events: Parameters<typeof toDisplayEvents>[0]) => toDisplayEvents(events).filter(event => event.type !== 'effectTriggered');
    expect(local(pvp.battle.events)).toEqual(wire(pvpReplay));
    const pveSeat = state.seats.find(seat => seat.seatId === pve.seatId)!;
    expect(pveSeat).toBeDefined();
    expect(local(pve.combat!.events)).toEqual(wire(toCombatReplay(pve.combat!)));
  }, 60_000);
});
