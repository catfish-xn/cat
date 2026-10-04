import { describe, expect, it } from 'vitest';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { getUnitSellPrice, getUnitStats } from '../src/simulation/unit-stats';
import { UNIT_DEFINITIONS, validateUnitDefinitions, type StarLevel, type Unit, type UnitDefinition } from '../src/simulation/units';

const CONTENT = [
  ['sentinel', 1, 800, 45, 40, 30, 1, 80, 'sentinel-guard'], ['ranger', 1, 500, 70, 15, 15, 3, 60, 'ranger-shot'],
  ['mystic', 1, 450, 80, 10, 20, 1, 60, 'mystic-bolt'], ['bulwark', 2, 1000, 55, 45, 35, 1, 80, 'bulwark-guard'],
  ['archer', 2, 650, 85, 20, 20, 3, 60, 'archer-shot'], ['arcanist', 3, 750, 85, 25, 30, 3, 80, 'arcanist-burst'],
  ['duelist', 3, 1100, 100, 35, 30, 1, 60, 'duelist-strike'], ['warden', 4, 1500, 90, 55, 50, 1, 80, 'warden-guard'],
  ['tempest', 4, 950, 110, 30, 35, 3, 80, 'tempest-burst'], ['colossus', 5, 1800, 125, 65, 60, 1, 90, 'colossus-guard'],
  ['oracle', 5, 1150, 125, 35, 45, 3, 80, 'oracle-burst'],
] as const;

describe('authored unit catalog and star stat resolution', () => {
  it('provides all eleven complete definitions and the fixed nonempty tier catalogs', () => {
    expect(Object.keys(UNIT_DEFINITIONS)).toEqual(CONTENT.map(row => row[0]));
    expect(SHOP_CATALOG_BY_COST).toEqual({ 1: ['sentinel', 'ranger', 'mystic'], 2: ['bulwark', 'archer'],
      3: ['arcanist', 'duelist'], 4: ['warden', 'tempest'], 5: ['colossus', 'oracle'] });
    expect(() => validateUnitDefinitions()).not.toThrow();
    for (const [id, cost, health, attack, armor, magicResist, attackRange, maxMana, abilityId] of CONTENT) {
      expect(UNIT_DEFINITIONS[id]).toMatchObject({ id, cost, baseStats: { health, attack, armor, magicResist },
        attackRange, maxMana, abilityId, initialMana: 0, attackIntervalTicks: 20 });
    }
  });

  it.each(CONTENT)('resolves %s at all stars with one integer rounding and unchanged other attributes',
    (id, _cost, health, attack, armor, magicResist, attackRange, maxMana, abilityId) => {
      const percents = [100n, 180n, 324n];
      for (const star of [1, 2, 3] as const) {
        expect(getUnitStats(id, star)).toEqual({ health: Number(BigInt(health) * percents[star - 1] / 100n),
          attack: Number(BigInt(attack) * percents[star - 1] / 100n), armor, magicResist, attackRange,
          maxMana, initialMana: 0, abilityId, attackIntervalTicks: 20 });
      }
    },
  );

  it('returns an isolated primitive-only snapshot and keeps definitions deeply frozen', () => {
    const before = JSON.stringify(UNIT_DEFINITIONS), stats = getUnitStats('sentinel', 2);
    expect(getUnitStats('sentinel', 2)).not.toBe(stats);
    expect(Object.values(stats).every(value => typeof value === 'number' || typeof value === 'string')).toBe(true);
    expect(Object.isFrozen(UNIT_DEFINITIONS)).toBe(true);
    for (const definition of Object.values(UNIT_DEFINITIONS)) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.baseStats)).toBe(true);
    }
    expect(JSON.stringify(UNIT_DEFINITIONS)).toBe(before);
  });

  it('values every star at its represented card cost with no merge arbitrage', () => {
    for (const [definitionId, cost] of CONTENT) for (const starLevel of [1, 2, 3] as const) {
      const unit: Unit = { id: 'value', definitionId, starLevel, team: 'player', location: { kind: 'bench', slot: 0 } };
      expect(getUnitSellPrice(unit)).toBe(cost * [1, 3, 9][starLevel - 1]);
    }
  });

  it.each(['absent', '__proto__', 'constructor'])('rejects unknown definition %s', id => {
    expect(() => getUnitStats(id, 1)).toThrow(RangeError);
  });
  it.each([0, 4, 1.5, NaN])('rejects invalid star %s rather than silently using one star', star => {
    expect(() => getUnitStats('sentinel', star as StarLevel)).toThrow(RangeError);
  });

  it.each([
    { baseStats: { health: 0 } }, { baseStats: { attack: -1 } }, { baseStats: { armor: NaN } },
    { baseStats: { magicResist: Infinity } }, { baseStats: { health: 1.5 } },
    { cost: 6 }, { attackRange: 0 }, { attackIntervalTicks: 0 }, { maxMana: 0 }, { initialMana: 81 },
    { abilityId: '' }, { id: 'duplicate' },
  ])('rejects incomplete or invalid definition data %j', patch => {
    const sentinel = UNIT_DEFINITIONS.sentinel;
    const invalid = { ...sentinel, ...patch, baseStats: { ...sentinel.baseStats, ...patch.baseStats } } as UnitDefinition;
    expect(() => validateUnitDefinitions({ ...UNIT_DEFINITIONS, sentinel: invalid })).toThrow(RangeError);
  });

  it('rejects missing or uncatalogued definitions', () => {
    const missing = { ...UNIT_DEFINITIONS };
    delete missing.oracle;
    expect(() => validateUnitDefinitions(missing)).toThrow(RangeError);
    expect(() => validateUnitDefinitions({ ...UNIT_DEFINITIONS, extra: { ...UNIT_DEFINITIONS.sentinel, id: 'extra' } })).toThrow(RangeError);
  });
});
