import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { describe, expect, it } from 'vitest';
import { createRoundEnemies } from '../src/simulation/round-enemies';
import { DEFAULT_BOARD, isDeploymentCell } from '../src/simulation/board';
import { UNIT_DEFINITIONS } from '../src/simulation/units';

describe('deterministic round enemy templates', () => {
  it('keeps every template legal and separate from player serial IDs', () => {
    for (const {ordinal:round} of ROUND_CATALOG) {
      const units = createRoundEnemies(round);
      expect(units).toEqual(createRoundEnemies(round));
      expect(new Set(units.map(unit => unit.id)).size).toBe(units.length);
      const cells = new Set<string>();
      for (const unit of units) {
        expect(unit.team).toBe('enemy');
        if (ROUND_CATALOG[round-1].kind==='pve') expect(JSON.parse(unit.id)).toEqual(['pve',ROUND_CATALOG[round-1].roundId,unit.encounterId,expect.any(String)]);
        else expect(unit.id.startsWith('enemy-')).toBe(true);
        expect(UNIT_DEFINITIONS[unit.definitionId]).toBeDefined();
        expect(unit.location.kind).toBe('board');
        if (unit.location.kind !== 'board') throw new Error('Enemy is not deployed');
        expect(isDeploymentCell(DEFAULT_BOARD, 'enemy', unit.location.cell)).toBe(true);
        cells.add(JSON.stringify(unit.location.cell));
      }
      expect(cells.size).toBe(units.length);
    }
  });
  it('uses the frozen stage populations and supply/PvE boundaries (M5 R7)', () => {
    expect(['2-1','2-2','2-3','2-4','2-5','2-6','2-7','3-2','3-3'].map(id => createRoundEnemies(getCatalogRoundById(id).ordinal).length)).toEqual([3,3,3,0,4,4,3,5,5]);
    expect(['4-1','5-1','6-1'].map(id => createRoundEnemies(getCatalogRoundById(id).ordinal).length)).toEqual([6,7,8]);
    expect(createRoundEnemies(getCatalogRoundById('6-7').ordinal).map(unit => [unit.definitionId, unit.starLevel])).toEqual([['pve-rift-herald',1]]);
    expect(createRoundEnemies(2).map(unit => unit.id)).not.toEqual(createRoundEnemies(1).map(unit => unit.id));
    expect(() => createRoundEnemies(ROUND_CATALOG.length+1)).toThrow(RangeError);
  });
  it.each([0,-1,0.5,NaN,Infinity])('rejects invalid round %s', round => expect(() => createRoundEnemies(round)).toThrow(RangeError));
});
