import { describe, expect, it } from 'vitest';
import {
  createMatch, deployMatchUnit, enableMultiplayerSettlement, startMatchCombat, stepMatch,
  lockMatchCombatRoster, serializeMatch, restoreMatch, createSharedPool,
  initializeSharedSeat, assertSharedPoolConservation,
} from '../src/server-entry';
import { reachRound } from './match-helpers';
import { accepted } from './t10-helpers';

// Baseline diagnostic only. These assertions record the pre-existing boundary;
// they are NOT the T12 equipment or multiplayer recovery acceptance tests.
describe('T12 baseline recovery scope decision', () => {
  for (const roundId of ['1-2', '2-1']) {
    it(`offline ${roundId} saves, restores and continues through the public entry`, () => {
      const preparation = accepted(deployMatchUnit(reachRound(roundId), 'unit-1',
        { kind: 'board', cell: { col: 3, row: 4 } }));
      expect(restoreMatch(serializeMatch(preparation))).toEqual(preparation);
      const running = accepted(startMatchCombat(preparation));
      expect(running.phase).toBe('combat');
      const restored = restoreMatch(serializeMatch(running));
      expect(stepMatch(restored)).toEqual(stepMatch(running));
    });

    it(`online ${roundId} is rejected before any equipment operation`, () => {
      const online = accepted(enableMultiplayerSettlement(reachRound(roundId), 'A'));
      const frozen = roundId === '1-2'
        ? accepted(startMatchCombat(online))
        : accepted(lockMatchCombatRoster(online));
      for (const state of [online, frozen]) {
        const bytes = JSON.stringify(state);
        expect(() => serializeMatch(state)).toThrow('Invalid Match save: multiplayer-state');
        expect(() => restoreMatch(bytes)).toThrow('Invalid Match save: multiplayer-state');
        expect(JSON.stringify(state)).toBe(bytes);
      }
    });
  }

  it('a conserved shared opening is also outside the offline restore format', () => {
    const result = initializeSharedSeat(createSharedPool('t12-baseline', 42), createMatch(42), 'A', 0);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    assertSharedPoolConservation(result.pool, [result.state]);
    expect(() => serializeMatch(result.state)).toThrow('multiplayer-state');
    expect(() => restoreMatch(JSON.stringify(result.state))).toThrow('multiplayer-state');
  });
});
