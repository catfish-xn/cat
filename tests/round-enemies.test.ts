import { describe, expect, it } from 'vitest';
import { createRoundEnemies } from '../src/simulation/round-enemies';
import { DEFAULT_BOARD, isDeploymentCell } from '../src/simulation/board';
import { UNIT_DEFINITIONS } from '../src/simulation/units';

describe('deterministic round enemy templates', () => {
  it('keeps every template legal and separate from player serial IDs', () => {
    for (let round = 1; round <= 30; round++) {
      const units = createRoundEnemies(round);
      expect(units).toEqual(createRoundEnemies(round));
      expect(new Set(units.map(unit => unit.id)).size).toBe(units.length);
      const cells = new Set<string>();
      for (const unit of units) {
        expect(unit.team).toBe('enemy');
        expect(unit.id.startsWith('enemy-')).toBe(true);
        expect(UNIT_DEFINITIONS[unit.definitionId]).toBeDefined();
        expect(unit.location.kind).toBe('board');
        if (unit.location.kind !== 'board') throw new Error('Enemy is not deployed');
        expect(isDeploymentCell(DEFAULT_BOARD, 'enemy', unit.location.cell)).toBe(true);
        cells.add(JSON.stringify(unit.location.cell));
      }
      expect(cells.size).toBe(units.length);
    }
  });
  it('grows on frozen round boundaries and rotates the final three templates', () => {
    expect([1,2,3,4,5,6,7,9,10].map(round => createRoundEnemies(round).length)).toEqual([2,2,3,3,4,4,5,5,6]);
    expect(createRoundEnemies(10).map(unit => [unit.definitionId, unit.starLevel])).toEqual(createRoundEnemies(13).map(unit => [unit.definitionId, unit.starLevel]));
    expect(createRoundEnemies(10).at(-1)?.definitionId).toBe('oracle');
    expect(createRoundEnemies(11).at(-1)?.definitionId).toBe('colossus');
    expect(createRoundEnemies(2).map(unit => unit.id)).not.toEqual(createRoundEnemies(1).map(unit => unit.id));
  });
  it.each([0,-1,0.5,NaN,Infinity])('rejects invalid round %s', round => expect(() => createRoundEnemies(round)).toThrow(RangeError));
});
