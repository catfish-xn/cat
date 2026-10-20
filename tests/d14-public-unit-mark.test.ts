import { describe, expect, it } from 'vitest';
import { createMatch, d14PublicUnitMark, type MatchState } from '../src/simulation/match';
import { d14PublicUnitMark as serverMark } from '../src/server-entry';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { freeze } from './combat-helpers';

function fixture(): MatchState {
  let state = createMatch(42);
  for (let n = 0; n < 9; n++) {
    const result = grantMechanicUnit(state, { receiptId: `mark:${n}`, source: 'test', definitionId: 'lux' });
    if (!result.ok) throw Error(result.reason);
    state = result.state;
  }
  const unit = state.preparation.units.find(u => u.definitionId === 'lux' && u.starLevel === 3)!;
  return { ...state, d14: { choiceId: 'mark-only', anomalyId: 'ultimate-hero', originalUnit: unit,
    unitId: unit.id, atOrdinal: 0, selectionPrefixLength: 1, phase: 'promoted', held: null } };
}

describe('d14PublicUnitMark', () => {
  it('exports only the four-star mark through both public boundaries without mutation', () => {
    const state = freeze(fixture()), before = JSON.stringify(state);
    expect(serverMark).toBe(d14PublicUnitMark);
    expect(d14PublicUnitMark(state, state.d14!.unitId)).toStrictEqual({ effectiveStarLevel: 4 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('returns null without D14 or for another existing unit', () => {
    const state = fixture(), unitId = state.d14!.unitId;
    expect(d14PublicUnitMark({ ...state, d14: undefined }, unitId)).toBeNull();
    expect(d14PublicUnitMark({ ...state, d14: { ...state.d14!, unitId: 'another-unit' } }, unitId)).toBeNull();
  });

  it.each(['waiting', 'absent', 'returned', 'retired'] as const)('returns null in phase %s', phase => {
    const state = fixture();
    expect(d14PublicUnitMark({ ...state, d14: { ...state.d14!, phase } }, state.d14!.unitId)).toBeNull();
  });

  it('returns null for missing units, including a stale promoted binding', () => {
    const state = fixture();
    expect(d14PublicUnitMark(state, 'missing-unit')).toBeNull();
    expect(d14PublicUnitMark({ ...state, preparation: { ...state.preparation, units: [] } }, state.d14!.unitId)).toBeNull();
  });

  it('preserves the private unit JSON field order and owner-only values', () => {
    const state = fixture(), unit = state.preparation.units.find(u => u.id === state.d14!.unitId)!;
    const plain = toPrivateSeatView({ ...state, d14: undefined }).preparation.units.find(u => u.id === unit.id)!;
    const projected = toPrivateSeatView(state).preparation.units.find(u => u.id === unit.id)!;
    expect(JSON.stringify(projected)).toBe(JSON.stringify({ ...plain, effectiveStarLevel: 4, sellGold: 9, poolCopies: 9 }));
  });
});
