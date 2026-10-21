import { describe, expect, it } from 'vitest';
// @ts-expect-error Pure Node utility.
import { mergeUnitDefinitions, selectUnits } from '../scripts/assets3d/runtime.mjs';
// @ts-expect-error Pure Node utility.
import { selectUnits as buildSelection } from '../scripts/assets3d/build-all.mjs';
// @ts-expect-error Pure Node utility.
import { argumentsFor } from '../scripts/assets3d/plan-fetch.mjs';

const extras = { warwick: { cost: 6 }, viktor: { cost: 6 }, mel: { cost: 6 } };
const base = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`toy${i}`, { cost: i % 5 + 1 }]));

describe('six-cost asset selection with synthetic definitions', () => {
  it('adds extras without changing the legacy all/default cost batches', () => {
    const definitions = mergeUnitDefinitions(base, extras);
    expect(selectUnits(definitions)).toEqual(selectUnits(base));
    expect(selectUnits(definitions)).toHaveLength(60);
    expect(selectUnits(definitions, 'all', '1,2,3,4,5')).toEqual(selectUnits(base));
    expect(selectUnits(definitions, 'warwick,viktor,mel')).toEqual(['mel', 'viktor', 'warwick']);
    expect(selectUnits(definitions, 'all', '6')).toEqual(['mel', 'viktor', 'warwick']);
    expect(selectUnits(definitions, 'toy0,mel', '1,6')).toEqual(['toy0', 'mel']);
    expect(selectUnits(definitions, 'mel', '5')).toEqual([]);
    expect(buildSelection).toBe(selectUnits);
    expect(Object.keys(base)).toHaveLength(60);
  });
  it('preserves the complete domain definition and rejects conflicting costs', () => {
    const domainMel = { cost: 6, marker: 'domain-authoritative' };
    const definitions = { ...base, mel: domainMel };
    const merged = mergeUnitDefinitions(definitions, extras);
    expect(merged.mel).toBe(domainMel);
    expect(merged).not.toBe(definitions);
    expect(() => mergeUnitDefinitions({ mel: { cost: 5 } }, extras)).toThrow('extra-unit-cost-conflict:mel');
  });
  it('accepts explicit planner CLI selections and rejects invalid filters/units', () => {
    expect(argumentsFor(['--units', 'warwick,viktor,mel', '--cost', '6'], ['--units', '--cost']))
      .toEqual({ units: 'warwick,viktor,mel', cost: '6' });
    for (const cost of ['0', '7', '6,6', '6.5', 'nope'])
      expect(() => selectUnits(extras, 'all', cost)).toThrow('invalid-cost-filter');
    for (const units of ['mel,mel', 'guessed'])
      expect(() => selectUnits(extras, units)).toThrow('invalid-unit-selection');
  });
});
