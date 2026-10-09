import { describe, expect, it } from 'vitest';
import { ROUND_CATALOG, ROUND_SEMANTIC_NODES } from '../src/simulation/content/round-catalog';
import { getCatalogRoundById, getCatalogRoundByOrdinal, getNextCatalogRound } from '../src/simulation/round-selectors';

// Handwritten from OPENING §4, ENCOUNTERS §2 and the B6 handoff, before running implementation.
// provisional: B6-Q1/Q2/Q3/Q4 await the user's approval; these are project conventions.
const expectedRounds = [
  ['1-2', 1, 1, 2, 'pve', false, 'minions-a-v1', '1-2'],
  ['1-3', 2, 1, 3, 'pve', false, 'minions-b-v1', '1-3'],
  ['1-4', 3, 1, 4, 'pve', false, 'minions-c-v1', '1-4'],
  ['2-1', 4, 2, 1, 'pvp', false, null, '2-1'],
  ['2-2', 5, 2, 2, 'pvp', false, null, '2-2'],
  ['2-3', 6, 2, 3, 'pvp', false, null, '2-3'],
  ['2-4', 7, 2, 4, 'supply', false, null, '2-4'],
  ['2-5', 8, 2, 5, 'pvp', false, null, '2-5'],
  ['2-6', 9, 2, 6, 'pvp', false, null, '2-6'],
  ['2-7', 10, 2, 7, 'pve', false, 'krugs-v1', '2-7'],
  ['3-1', 11, 3, 1, 'pvp', false, null, '3-1'],
  ['3-2', 12, 3, 2, 'pvp', false, null, '3-2'],
  ['3-3', 13, 3, 3, 'pvp', false, null, '3-3'],
  ['3-4', 14, 3, 4, 'supply', false, null, '3-4'],
  ['3-5', 15, 3, 5, 'pvp', false, null, '3-5'],
  ['3-6', 16, 3, 6, 'pvp', false, null, '3-6'],
  ['3-7', 17, 3, 7, 'pve', false, 'wolves-v1', '3-7'],
  ['4-1', 18, 4, 1, 'pvp', false, null, '4-1'],
  ['4-2', 19, 4, 2, 'pvp', false, null, '4-2'],
  ['4-3', 20, 4, 3, 'pvp', false, null, '4-3'],
  ['4-4', 21, 4, 4, 'supply', false, null, '4-4'],
  ['4-5', 22, 4, 5, 'pvp', false, null, '4-5'],
  ['4-6', 23, 4, 6, 'pvp', false, null, '4-6'],
  ['4-7', 24, 4, 7, 'pve', false, 'razorbeaks-v1', '4-7'],
  ['5-1', 25, 5, 1, 'pvp', false, null, '5-1'],
  ['5-2', 26, 5, 2, 'pvp', false, null, '5-2'],
  ['5-3', 27, 5, 3, 'pvp', false, null, '5-3'],
  ['5-4', 28, 5, 4, 'supply', false, null, '5-4'],
  ['5-5', 29, 5, 5, 'pvp', false, null, '5-5'],
  ['5-6', 30, 5, 6, 'pvp', false, null, '5-6'],
  ['5-7', 31, 5, 7, 'pve', false, 'elder-dragon-v1', '5-7'],
  ['6-1', 32, 6, 1, 'pvp', false, null, '6-1'],
  ['6-2', 33, 6, 2, 'pvp', false, null, '6-2'],
  ['6-3', 34, 6, 3, 'pvp', false, null, '6-3'],
  ['6-4', 35, 6, 4, 'supply', false, null, '6-4'],
  ['6-5', 36, 6, 5, 'pvp', false, null, '6-5'],
  ['6-6', 37, 6, 6, 'pvp', false, null, '6-6'],
  ['6-7', 38, 6, 7, 'pve', true, 'rift-herald-v1', '6-7'],
] as const;

describe('B6 isolated round catalog (provisional conventions)', () => {
  it('matches all eight frozen contract fields in 38 handwritten rows', () => {
    expect(ROUND_CATALOG.map(r => [r.roundId, r.ordinal, r.stage, r.subround, r.kind, r.isFinal, r.encounterId, r.displayName])).toEqual(expectedRounds);
    expect(ROUND_CATALOG).toHaveLength(38);
    expect(new Set(ROUND_CATALOG.map(r => r.roundId)).size).toBe(38);
    expect(ROUND_CATALOG.map(r => r.ordinal)).toEqual([
      1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,
      20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,
    ]);
    expect(ROUND_CATALOG.filter(r => r.kind !== 'supply')).toHaveLength(33);
    expect(ROUND_CATALOG.filter(r => r.kind === 'supply').map(r => r.roundId)).toEqual(['2-4','3-4','4-4','5-4','6-4']);
    expect(ROUND_CATALOG.filter(r => r.isFinal).map(r => r.roundId)).toEqual(['6-7']);
  });

  it('matches the eight PvE positions and encounter IDs individually', () => {
    expect(ROUND_CATALOG.filter(r => r.kind === 'pve').map(r => [r.roundId, r.ordinal, r.encounterId])).toEqual([
      ['1-2',1,'minions-a-v1'], ['1-3',2,'minions-b-v1'], ['1-4',3,'minions-c-v1'],
      ['2-7',10,'krugs-v1'], ['3-7',17,'wolves-v1'], ['4-7',24,'razorbeaks-v1'],
      ['5-7',31,'elder-dragon-v1'], ['6-7',38,'rift-herald-v1'],
    ]);
  });

  it('has only the approved augment, anomaly and five supply semantic nodes', () => {
    expect(ROUND_SEMANTIC_NODES).toEqual({
      '2-1':['augment'], '2-4':['supply'], '3-2':['augment'], '3-4':['supply'],
      '4-2':['augment'], '4-4':['supply'], '4-6':['anomaly'], '5-4':['supply'], '6-4':['supply'],
    });
    expect(JSON.stringify(ROUND_SEMANTIC_NODES)).not.toMatch(/r1-component-[12]|reward|component/);
    for (const roundId of Object.keys(ROUND_SEMANTIC_NODES)) expect(getCatalogRoundById(roundId)).toBeDefined();
  });

  it('deep-freezes catalog rows and nested semantic node arrays', () => {
    expect(Object.isFrozen(ROUND_CATALOG)).toBe(true);
    for (const round of ROUND_CATALOG) expect(Object.isFrozen(round)).toBe(true);
    expect(Object.isFrozen(ROUND_SEMANTIC_NODES)).toBe(true);
    for (const nodes of Object.values(ROUND_SEMANTIC_NODES)) expect(Object.isFrozen(nodes)).toBe(true);
    expect(() => { (ROUND_CATALOG as unknown as { stage: number }[])[0].stage = 99; }).toThrow(TypeError);
    expect(() => { (ROUND_SEMANTIC_NODES['2-1'] as unknown as string[]).push('component'); }).toThrow(TypeError);
  });

  it('queries every row without mutation and traverses stage boundaries and the final round', () => {
    const before = JSON.stringify(ROUND_CATALOG);
    for (const r of ROUND_CATALOG) {
      expect(getCatalogRoundById(r.roundId)).toBe(r);
      expect(getCatalogRoundByOrdinal(r.ordinal)).toBe(r);
    }
    expect(getNextCatalogRound('1-2')?.roundId).toBe('1-3');
    expect(getNextCatalogRound('1-4')?.roundId).toBe('2-1');
    expect(getNextCatalogRound('2-7')?.roundId).toBe('3-1');
    expect(getNextCatalogRound('6-6')?.roundId).toBe('6-7');
    expect(getNextCatalogRound('6-7')).toBeNull();
    expect(JSON.stringify(ROUND_CATALOG)).toBe(before);
  });

  it.each([0, -1, 39, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, '1', null, undefined])(
    'provisional B6-Q4: invalid ordinal %s throws RangeError', value => {
      expect(() => getCatalogRoundByOrdinal(value as number)).toThrow(RangeError);
    },
  );
  it.each(['', '1-1', '1-5', '2-0', '6-8', '7-1', '01-2', 'r-1-2', ' 1-2', '1-2 ', '__proto__', 1, null, undefined])(
    'provisional B6-Q1/Q4: noncanonical round ID %s throws RangeError', value => {
      expect(() => getCatalogRoundById(value as string)).toThrow(RangeError);
      expect(() => getNextCatalogRound(value as string)).toThrow(RangeError);
    },
  );
});
