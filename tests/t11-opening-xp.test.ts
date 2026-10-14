import { describe, expect, it } from 'vitest';
import { createMatch, nextRound, startMatchCombat, stepMatch } from '../src/simulation/match';
import { XP_TO_NEXT_LEVEL } from '../src/simulation/match-rules';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { accepted, finish, resolveM5Choices } from './match-helpers';
import { makeRoom, runUntil } from './server/helpers';

// User-signed T11 oracle: 0 + 2 + 2 + 2 XP, thresholds 2 + 2 => level 3, 2/6.
// Only start/continue and mandatory loot choices; no purchases, sales, rerolls or paid XP.
describe('T11 signed opening economy', () => {
  it('seed 42 single-player enters 2-1 with 3 levels, 2/6 XP and 13 gold (T13 opening bonus), exactly once', () => {
    expect(XP_TO_NEXT_LEVEL).toEqual({ 1: 2, 2: 2, 3: 6, 4: 10, 5: 20, 6: 36, 7: 48, 8: 76 });
    let state = createMatch(42);
    for (const roundId of ['1-2', '1-3', '1-4']) {
      expect(state.roundDefinitionId).toBe(roundId);
      state = resolveM5Choices(finish(accepted(startMatchCombat(state))));
      expect(state.roundResults.at(-1)).toMatchObject({ roundId, xpRequested: 2 });
      const restored = restoreMatch(serializeMatch(state));
      expect(restored).toEqual(state);
      expect(stepMatch(restored)).toEqual({ state: restored, events: [] });
      const round = state.round;
      state = accepted(nextRound(restored, round));
      expect(nextRound(state, round)).toEqual({ ok: false, state, reason: 'wrong-phase' });
    }
    expect(state).toMatchObject({ roundDefinitionId: '2-1', phase: 'choice', level: 3, xp: 2, gold: 13 });
    expect(state.roundResults.map(r => r.xpRequested)).toEqual([2, 2, 2]);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });

  it('seed 42 eight-seat room reaches 2-1 before the augment timeout with the same economy in every seat', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    runUntil(room, clock, s => s.roundId === '2-1' && s.phase === 'choice');
    expect(room.state.fault).toBeNull();
    expect(room.state.seats).toHaveLength(8);
    for (const seat of room.state.seats) {
      expect(seat.match).toMatchObject({ roundDefinitionId: '2-1', phase: 'choice', level: 3, xp: 2, gold: 13 });
      expect(seat.match.roundResults.map(r => r.xpRequested)).toEqual([2, 2, 2]);
    }
  }, 30_000);
});
