import { describe, expect, it } from 'vitest';
import { readCombatStrategyInputs, type CombatStrategyInputs } from '../src/simulation/combat-input';
import { getRoundEnemyItems, readRoundEnemyProjection, roundEnemyItems } from '../src/simulation/round-enemies';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents } from '../src/simulation/combat';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { realUnits } from '../dev/castcmp/real-combat';

// Recording tools only (dev/castcmp --foe-items): CombatStrategyInputs.recordingEnemyItems names the enemies' items instead of
// the round's. A match never sets it; without it every reader sees exactly what it read before.
const round = Array.from({ length: 60 }, (_, i) => i + 1).find(r => { try { return getRoundEnemyItems(r).length > 0; } catch { return false; } })!;
const withEnemies = { round, preparation: { units: [{ team: 'player' }, { team: 'enemy' }] } };
const units = realUnits({ unit: 'garen', star: 1, foe: 'garen', dist: 1, nfoes: 1, foestar: 1 } as never);
const inputs = (extra: Partial<CombatStrategyInputs> = {}): CombatStrategyInputs => ({ round: 1, preparation: { board: DEFAULT_BOARD, benchSize: 7, units } as never,
  items: [], temporaryEquipment: [], augments: [], anomalyBinding: null, persistentGrowth: [], augmentProgress: [], ...extra } as CombatStrategyInputs);
const foeAttack = (extra: Partial<CombatStrategyInputs> = {}) =>
  (createCombatWithEvents(inputs(extra).preparation, buildStrategySnapshot(inputs(extra)), 'recording-enemy-items', 42).state as unknown as { units: { id: string; attackDamage: number }[] })
    .units.find(u => u.id === 'foe')!.attackDamage;

describe('recording-only enemy items', () => {
  it('without the field the enemy items are the round\'s own, as each reader computed them before (none when no enemy stands)', () => {
    expect(round).toBeGreaterThan(0);
    expect(roundEnemyItems(withEnemies)).toBe(readRoundEnemyProjection(round).items);
    expect(roundEnemyItems({ round, preparation: { units: [{ team: 'player' }] } })).toEqual([]);
  });
  it('with the field they are exactly the given items, an empty list too (never the round\'s)', () => {
    const given = [{ unitId: 'foe', definitionId: 'sword', slot: 0 }];
    expect(roundEnemyItems({ ...withEnemies, recordingEnemyItems: given })).toBe(given);
    expect(roundEnemyItems({ ...withEnemies, recordingEnemyItems: [] })).toEqual([]);
  });
  it('the read inputs carry no new key without the field, and pass it on unchanged with it', () => {
    const plain = readCombatStrategyInputs(inputs());
    expect(Object.hasOwn(plain, 'recordingEnemyItems')).toBe(false);
    expect(JSON.stringify(plain)).toBe(JSON.stringify(readCombatStrategyInputs(inputs({ recordingEnemyItems: undefined }))));
    const given = [{ unitId: 'foe', definitionId: 'sword', slot: 0 }];
    expect(readCombatStrategyInputs(inputs({ recordingEnemyItems: given })).recordingEnemyItems).toBe(given);
  });
  it('the strategy snapshot without the field is the same as before; with an item on a foe, that foe\'s stats take it', () => {
    expect(JSON.stringify(buildStrategySnapshot(inputs()))).toBe(JSON.stringify(buildStrategySnapshot(inputs({ recordingEnemyItems: [] }))));
    const bare = foeAttack(), armed = foeAttack({ recordingEnemyItems: [{ unitId: 'foe', definitionId: 'sword', slot: 0 }] });
    expect(armed).toBeGreaterThan(bare);
  });
});
