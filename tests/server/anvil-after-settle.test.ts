/**
 * v22 anvil units after a seat settled (server review follow-ups of #435): an anvil the rules let a seat open while the
 * room is still in its battle phase (a seat the rules already settled, e.g. during the playback tail) can be answered
 * there too, and a bot that took over a disconnected seat answers an anvil its player left open in settlement instead
 * of leaving it to its 30 s deadline.
 *
 * Opening encounter "component-anvils" (蔚) puts two component anvils on every seat's bench at the start.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Room, ROOM_TIMING_DEFAULTS, type RoomOptions } from '../../src/server/room/room';
import { BOT_DRIVER_DEFAULTS, BotDriver } from '../../src/server/room/bot-driver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { createOpeningEncounter } from '../../src/server-entry';
import type { MatchState } from '../../src/simulation/match-types';
import { runUntil, SEATS, TIMINGS } from './helpers';
import { benchAnvils, countOf, openAnvil, seatOf, seedSeat } from './anvil-room-helpers';

const ANVIL_SEED = (() => { for (let seed = 1; seed < 400_000; seed++) if (createOpeningEncounter(seed).selection.encounterId === 'component-anvils') return seed; throw new Error('no seed'); })();
const BOT_STEP_MS = BOT_DRIVER_DEFAULTS.stepMs;
const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });
function openRoom(overrides: Partial<RoomOptions> = {}) {
  const clock = new ManualClock();
  const room = new Room(SEATS, { ...ROOM_TIMING_DEFAULTS, ...TIMINGS, roomId: 'anvil-after-settle', seed: ANVIL_SEED, clock, resolver: new TwoSidedBattleResolver(), ...overrides });
  disposers.push(() => room.dispose());
  room.start();
  return { room, clock };
}

describe('v22: an anvil opened in the battle phase is answered there', () => {
  it('a settled seat opens its anvil during the battle and picks it before the phase ends; other choices stay refused', () => {
    const { room, clock } = openRoom();
    runUntil(room, clock, state => state.phase === 'battle');
    // Test seam: the seat as the rules leave it once its own combat settled (live catch-up), the room still in battle.
    seedSeat(room, 's0', match => { const { combatRosterLocked: _locked, ...multiplayer } = match.multiplayer!; return { ...match, phase: 'settlement', combat: null, multiplayer } as MatchState; });
    const unit = benchAnvils(seatOf(room.state, 's0').match)[0]!;
    const choice = openAnvil(room, 's0', unit.id, true);
    expect(room.state.phase).toBe('battle');
    // Only the seat's own open anvil passes in battle.
    expect(room.handle('s0', { type: 'choose', choiceId: 'other', generation: choice.generation, definitionId: choice.offers[1]! })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    const items = countOf(seatOf(room.state, 's0').match, choice.offers[1]!);
    expect(room.handle('s0', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[1]! })).toMatchObject({ ok: true });
    const after = seatOf(room.state, 's0');
    expect(room.state.phase).toBe('battle');
    expect(after.match.pendingChoice).toBeNull();
    expect(after.choiceDeadline).toBeUndefined();
    expect(countOf(after.match, choice.offers[1]!)).toBe(items + 1);
  });
});

describe('v22: a takeover bot answers an anvil left open in settlement', () => {
  it('picks the first offer at its next step, long before the anvil deadline', () => {
    const { room, clock } = openRoom();
    const bots = new BotDriver(room, ANVIL_SEED, { takeover: true, takeoverMs: 0 });
    disposers.unshift(() => bots.dispose());
    runUntil(room, clock, state => state.phase === 'settlement');
    const unit = benchAnvils(seatOf(room.state, 's0').match)[0]!;
    const opened = clock.now(), choice = openAnvil(room, 's0', unit.id, true);
    const items = countOf(seatOf(room.state, 's0').match, choice.offers[0]!);
    room.setConnected('s0', false);
    runUntil(room, clock, state => seatOf(state, 's0').match.pendingChoice === null || state.phase !== 'settlement');
    const after = seatOf(room.state, 's0');
    expect(room.state.fault).toBeNull();
    expect(after.controller).toBe('takeover');
    expect(clock.now() - opened).toBe(BOT_STEP_MS); // the bot's first step, not the anvil deadline
    expect(after.match.pendingChoice).toBeNull();
    expect(countOf(after.match, choice.offers[0]!)).toBe(items + 1);
    const receipt = (after.match.seatMechanics?.receipts ?? []).find(candidate => candidate.receiptId === choice.choiceId);
    expect(receipt).toMatchObject({ kind: 'choice', choiceKind: 'forge', source: 'anvil-unit', optionId: choice.offers[0] });
    expect(receipt).not.toMatchObject({ timedOut: true });
  });

  it('a human seat (no takeover) keeps its anvil open in settlement until its own deadline', () => {
    const { room, clock } = openRoom();
    const bots = new BotDriver(room, ANVIL_SEED);
    disposers.unshift(() => bots.dispose());
    runUntil(room, clock, state => state.phase === 'settlement');
    const unit = benchAnvils(seatOf(room.state, 's0').match)[0]!;
    openAnvil(room, 's0', unit.id, true);
    clock.advance(10_000);
    expect(room.state.phase).toBe('settlement');
    expect(seatOf(room.state, 's0').match.pendingChoice).not.toBeNull();
  });
});
