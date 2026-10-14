import { describe, expect, it } from 'vitest';
import type { MatchState } from '../src/simulation/match';
import type { Unit, UnitLocation } from '../src/simulation/units';
import { expectedCommand } from './fixtures/m5/command-oracle.cjs';
import { accepted, freeze, readyMatch } from './match-helpers';

const opening = { kind: 'unit-acquired', unitId: 'unit-1', source: { kind: 'opening' }, sequence: 0, roundId: '1-2' };
const unit = (id: string, location: UnitLocation, starLevel: Unit['starLevel'] = 1): Unit =>
  ({ id, definitionId: 'irelia', team: 'player', starLevel, location });

/** Command-unit inputs only, matching the original economy vectors. Funded shops and
 * synthetic merge rosters are not claimed to be complete B8 acquisition/restore routes.
 * Every appended expected fact below is hand-written, never copied from a product result.
 */
function fixture(definitionId = 'vander'): MatchState {
  const state = readyMatch();
  return { ...state, gold: 10, nextMatchEventSeq: 19,
    shop: { ...state.shop, generation: 7, slots: state.shop.slots.map(() => ({ status: 'available', definitionId })) } };
}

describe('B8 independent command provenance oracle', () => {
  it('records one paid birth with its own resource sequence and exact shop source', () => {
    const before = fixture(), snapshot = structuredClone(before);
    const result = expectedCommand(freeze(before), { type: 'buy', slot: 3, generation: 7 });
    const state = accepted(result);
    expect(state.resourceProvenance).toEqual({ version: 'm8-b8-resource-provenance-v1', entries: [opening,
      { kind: 'unit-acquired', unitId: 'unit-2', source: { kind: 'shop', generation: 7, slotIndex: 3, definitionId: 'vander' }, sequence: 1, roundId: '1-2' },
    ] });
    expect(state.gold).toBe(8); expect(state.nextUnitSerial).toBe(3);
    expect(state.nextMatchEventSeq).toBe(19); expect(result.ok && result.events).toEqual([]);
    expect(before).toEqual(snapshot);
    expect(state.resourceProvenance.entries[0]).not.toBe(before.resourceProvenance.entries[0]);
  });

  it('records the consumed ninth card once and links both hand-calculated cascade merges to that birth', () => {
    const base = fixture('irelia'), location = { kind: 'board' as const, cell: { col: 3, row: 4 } };
    const before: MatchState = { ...base, nextUnitSerial: 5, preparation: { ...base.preparation, units: [
      unit('unit-4', { kind: 'bench', slot: 1 }, 2),
      unit('unit-3', { kind: 'board', cell: { col: 1, row: 7 } }, 2),
      unit('unit-2', { kind: 'bench', slot: 0 }), unit('unit-1', location),
    ] } };
    const snapshot = structuredClone(before);
    const first = { type: 'unitUpgraded', survivorId: 'unit-1', consumedIds: ['unit-2', 'unit-5'], definitionId: 'irelia', fromStar: 1, toStar: 2, location };
    const second = { type: 'unitUpgraded', survivorId: 'unit-1', consumedIds: ['unit-3', 'unit-4'], definitionId: 'irelia', fromStar: 2, toStar: 3, location };
    const result = expectedCommand(freeze(before), { type: 'buy', slot: 3, generation: 7 });
    const state = accepted(result);
    expect(state.resourceProvenance.entries).toEqual([opening,
      { kind: 'unit-acquired', unitId: 'unit-5', source: { kind: 'shop', generation: 7, slotIndex: 3, definitionId: 'irelia' }, sequence: 1, roundId: '1-2' },
      { kind: 'unit-upgraded', acquisitionSequence: 1, event: first, sequence: 2, roundId: '1-2' },
      { kind: 'unit-upgraded', acquisitionSequence: 1, event: second, sequence: 3, roundId: '1-2' },
    ]);
    expect(result.ok && result.events).toEqual([
      { ...first, domain: 'match', eventSeq: 19 }, { ...second, domain: 'match', eventSeq: 20 },
    ]);
    expect(state.preparation.units).toEqual([unit('unit-1', location, 3)]);
    expect(state.gold).toBe(9); expect(state.nextUnitSerial).toBe(6); expect(state.nextMatchEventSeq).toBe(21);
    expect(before).toEqual(snapshot);
    const sold = accepted(expectedCommand(freeze(state), { type: 'sell', id: 'unit-1' }));
    expect(sold.resourceProvenance.entries).toEqual([...state.resourceProvenance.entries,
      { kind: 'unit-sold', unitId: 'unit-1', context: 'preparation', goldGranted: 9, sequence: 4, roundId: '1-2' },
    ]);
    expect(sold.gold).toBe(18); expect(sold.nextMatchEventSeq).toBe(21);
  });

  it.each([[1, 4], [2, 11], [3, 35]] as const)('records the independently fixed %s-star Corki sale of %s gold', (starLevel, goldGranted) => {
    const base = fixture();
    const before: MatchState = { ...base, preparation: { ...base.preparation, units: [
      { ...unit('unit-1', { kind: 'bench', slot: 0 }, starLevel), definitionId: 'corki' },
    ] } };
    const result = expectedCommand(freeze(before), { type: 'sell', id: 'unit-1' });
    const state = accepted(result);
    expect(state.resourceProvenance.entries).toEqual([opening,
      { kind: 'unit-sold', unitId: 'unit-1', context: 'preparation', goldGranted, sequence: 1, roundId: '1-2' },
    ]);
    expect(state.gold).toBe(10 + goldGranted); expect(state.preparation.units).toEqual([]);
    expect(state.nextUnitSerial).toBe(2); expect(result.ok && result.events).toEqual([]);
  });

  it('rejects insufficient gold and a full non-merging bench before any birth, spend or sequence allocation', () => {
    const base = fixture();
    const full: MatchState = { ...base, preparation: { ...base.preparation, units: [
      ...base.preparation.units,
      ...Array.from({ length: 9 }, (_, slot) => unit(`fixture-${slot}`, { kind: 'bench', slot })),
    ] } };
    for (const [state, reason] of [[{ ...base, gold: 1 }, 'insufficient-gold'], [full, 'bench-full']] as const) {
      const snapshot = structuredClone(state);
      const result = expectedCommand(freeze(state), { type: 'buy', slot: 3, generation: 7 });
      expect(result).toEqual({ ok: false, state, reason });
      expect(result.state).toBe(state); expect(state).toEqual(snapshot);
      expect(state.resourceProvenance.entries).toEqual([opening]);
    }
  });
});
