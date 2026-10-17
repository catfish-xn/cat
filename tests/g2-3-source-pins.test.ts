/** G2-3 source pins: Rumble Self-Destruct values against map22, and the shared form rule against the old starting-rows rule. */
import { describe, expect, it } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { G23_POLICY } from '../src/simulation/content/g2-3-policy';
import { g23FormDefinitionId } from '../src/simulation/g2-3-forms';
import { startingRows } from '../src/simulation/m8/targeting';
import { UNIT_DEFINITIONS } from '../src/simulation/units';

describe('Rumble Self-Destruct source', () => {
  it('1- and 2-star values come from the map22 constants; 3-star is the user-chosen 14.24 notes value', () => {
    const text = gunzipSync(readFileSync('src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz')).toString('utf8');
    const value = (level: number) => Number(new RegExp(`"SelfDestruct_ResistDamage_Level${level}":\\{"mValue":([0-9.]+)`).exec(text)![1]);
    expect(G23_POLICY.rumble.selfDestructResistBps.slice(0, 2)).toEqual([Math.round(value(1) * 10000), Math.round(value(2) * 10000)]);
    // The same object says 20.0 (2000%); the user chose the 14.24 notes' 20000% (RECONCILIATION).
    expect(value(3)).toBe(20);
    expect(G23_POLICY.rumble.selfDestructResistBps[2]).toBe(2000000);
  });
});

describe('form swappers', () => {
  it('the shared row resolver matches the old starting-rows rule on every row of both teams', () => {
    const swappers = Object.values(UNIT_DEFINITIONS).filter(d => d.formSwap).map(d => d.id).sort();
    expect(swappers).toEqual(['elise', 'gangplank', 'jayce', 'swain']);
    for (const id of swappers) for (const team of ['player', 'enemy'] as const) for (let row = 0; row < 8; row++)
      expect(g23FormDefinitionId(id, team, row)).toBe(startingRows(team, row) === 'back-two' ? `${id}-ranged` : id);
  });
});
