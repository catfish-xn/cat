import { describe, expect, it } from 'vitest';
import { deathWins } from '../src/simulation/augment-pool-batch5-h7';
import { lootExplosionRollKey } from '../src/simulation/augment-pool-batch5-g7';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility } from '../src/persistence/compatibility';
import { M8_VERSION } from '../src/simulation/m8/version';
import { readyMatch } from './match-helpers';

// Death-keyed rolls (2026-11-20): Good for Something and Loot Explosion are keyed by the death's battle, tick and unit, so a
// display-only event (which moves eventSeqs) cannot change who is paid or what drops.
describe('death-keyed rolls ignore eventSeq', () => {
  it('Good for Something: the roll is a function of the death tick and unit only', () => {
    const wins = Array.from({ length: 200 }, (_, t) => deathWins(42, 's1', 'round:2-1:augment', 'room:r6:b0', t, 'unit-1'));
    expect(wins.some(Boolean)).toBe(true);
    expect(wins.some(w => !w)).toBe(true);
    expect(deathWins.length).toBe(6); // seed, seat, choice, battle, tick, unit: no eventSeq parameter
  });
  it('Loot Explosion: the roll key names the death by tick and unit, not eventSeq', () => {
    const death = { combatId: 'room:r6:b0', tick: 112, unitId: 'u', eventSeq: 99 };
    const key = lootExplosionRollKey('s1', 'c', 6, death);
    expect(key).toBe(lootExplosionRollKey('s1', 'c', 6, { ...death, eventSeq: 93 } as typeof death));
    expect(key).not.toContain('99');
    expect(key).not.toBe(lootExplosionRollKey('s1', 'c', 6, { ...death, tick: 113 }));
  });
  it('has its own identifier; saves with the earlier digest are rejected', () => {
    expect(S13_COMBAT_RULES.deathRollKeys).toBe('combat-tick-unit-not-event-seq');
    const before = 'fnv1a32-utf16:2f642cc0';
    expect(CONTENT_DIGEST).not.toBe(before);
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-death-keys', createdAt: '2026-11-20T00:00:00Z', match: { ...readyMatch(42), contentDigest: before }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toMatchObject({ status: 'rejected', reason: 'digest-mismatch' });
  });
});
