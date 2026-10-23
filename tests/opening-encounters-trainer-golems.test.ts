import { describe, expect, it } from 'vitest';
import { createMatch, createOpeningEncounter, OPENING_ENCOUNTERS, OPENING_ENCOUNTER_CONFIG,
  TRAINER_GOLEMS_POLICY, validateOpeningEncounterConfig, validateTrainerGolemEmblems,
  applyTrainerGolemsOpening, applyOpeningEffects, planOpeningRound, readOpeningEncounterView,
  sellUnit, deployMatchUnit, useConsumable, startMatchCombat, getDeploymentCap } from '../src/simulation/match';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { CONSUMABLE_DEFINITIONS } from '../src/simulation/content/consumables';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { createSharedPool, initializeSharedSeat, restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import type { MatchCommandResult, MatchState } from '../src/simulation/match-types';
import { TRAINER_EMBLEMS, TRAINER_UNIT } from '../src/simulation/content/opening-batch-b';
import { trainerEmblems } from '../src/simulation/trainer-golems';

// Locate a legitimate draw; never overwrite the authenticated selection.
let seed = 0;
while (createOpeningEncounter(seed).selection.encounterId !== 'trainer-golems') seed++;
const emblems = Object.keys(EMBLEM_ITEMS);
const triple = emblems.slice(0, 3);
const fakeUnitId = 'trainer-golem-unissued';
const fact = { factId: 'trainer-golems:1-2', effectKey: 'trainer-golems', nodeId: '1-2' };
const receipt = { receiptId: 'trainer-golems:solo:1-2', factId: fact.factId, seatId: 'solo', nodeId: '1-2' };
function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
function rejected(result: MatchCommandResult, state: MatchState, reason: string): void {
  expect(result).toEqual({ ok: false, state, reason });
  expect(result.state).toBe(state);
  expect(result).not.toHaveProperty('events');
}
/** Batch B (v22) grants the trainer at creation; explicit retries authenticate and change nothing. */
function unchanged(result: MatchCommandResult, state: MatchState): void {
  expect(result).toEqual({ ok: true, state, events: [] });
  expect(result.state).toBe(state);
}

describe('PR4 trainer evidence admission and executable emblem validation', () => {
  it('retains the 4% identity, known counts, approved conventions and the batch B core parameters', () => {
    // Opening batch B (v22) supplies the approved pool, unit, growth and placement and enables the entry.
    expect(OPENING_ENCOUNTERS.find(e => e.id === 'trainer-golems')).toMatchObject({
      weightBps: 400, enabled: true, readiness: 'ready-for-followup',
      researchParameters: { emblem_sampling_pool: null, same_emblems_for_all_players: null },
      missingEvidence: TRAINER_GOLEMS_POLICY.missingEvidence,
    });
    expect(OPENING_ENCOUNTERS.reduce((n, e) => n + e.weightBps, 0)).toBe(10000);
    expect(TRAINER_GOLEMS_POLICY).toMatchObject({ golemsPerSeat: 1, emblemsPerGolem: 3,
      permanentEmblems: true, grantRound: '1-2', samplingScope: 'seat', distinctEmblems: true,
      emblemPool: TRAINER_EMBLEMS, unitDefinitionId: TRAINER_UNIT.id,
      countsTowardPopulation: false, placementAndMovement: 'front-center-first-empty/board-only', missingEvidence: [] });
    expect(TRAINER_GOLEMS_POLICY.statsAndGrowth).toMatchObject({ unit: TRAINER_UNIT });
    expect(Object.isFrozen(TRAINER_GOLEMS_POLICY)).toBe(true);
    expect(Object.isFrozen(TRAINER_GOLEMS_POLICY.missingEvidence)).toBe(true);
  });

  it.each(['enabled', 'emblemPool', 'unitDefinitionId', 'statsAndGrowth', 'countsTowardPopulation', 'placementAndMovement'])(
    'rejects caller-supplied %s instead of filling the evidence gap', key => {
      const config = structuredClone(OPENING_ENCOUNTER_CONFIG);
      Object.assign(config.trainerGolems, { [key]: key === 'enabled' ? false : 'unverified' });
      expect(() => validateOpeningEncounterConfig(config)).toThrow('opening-config-incomplete');
    });

  it('rejects disabling only the weighted entry and accepts the exact enabled config copy', () => {
    const config = structuredClone(OPENING_ENCOUNTER_CONFIG);
    expect(() => validateOpeningEncounterConfig(config)).not.toThrow();
    Object.assign(config.entries.find(e => e.id === 'trainer-golems')!, { enabled: false });
    expect(() => createOpeningEncounter(seed, config)).toThrow('opening-config-incomplete');
  });

  it('accepts every executable distinct triple, returns a detached frozen tuple; batch B samples from its approved 22-emblem pool', () => {
    for (let i = 0; i < emblems.length; i++) for (let j = i + 1; j < emblems.length; j++)
      for (let k = j + 1; k < emblems.length; k++) {
        const input = [emblems[i], emblems[j], emblems[k]], validated = validateTrainerGolemEmblems(input);
        expect(validated).toEqual(input); expect(validated).not.toBe(input);
        expect(Object.isFrozen(validated)).toBe(true);
      }
    expect(TRAINER_GOLEMS_POLICY.emblemPool).toEqual(TRAINER_EMBLEMS);
    expect(TRAINER_EMBLEMS).toHaveLength(22);
    for (const id of TRAINER_EMBLEMS) expect(emblems).toContain(id);
  });

  it.each([
    { label: 'null', value: null }, { label: 'object', value: { 0: triple[0], length: 3 } },
    { label: 'empty', value: [] }, { label: 'two', value: triple.slice(0, 2) },
    { label: 'four', value: emblems.slice(0, 4) }, { label: 'duplicate', value: [triple[0], triple[0], triple[2]] },
    { label: 'component', value: ['sword', triple[1], triple[2]] },
    { label: 'completed non-emblem', value: ['deathblade', triple[1], triple[2]] },
    { label: 'unknown', value: ['trainer-emblem', triple[1], triple[2]] },
    { label: 'prototype', value: ['__proto__', triple[1], triple[2]] },
    { label: 'constructor', value: ['constructor', triple[1], triple[2]] },
    { label: 'number', value: [1, triple[1], triple[2]] },
    { label: 'hole', value: new Array(3) },
  ])('rejects $label candidates', ({ value }) => {
    expect(() => validateTrainerGolemEmblems(value)).toThrow('invalid-opening-effect');
  });

  it('reuses existing emblem trait counting on an ordinary holder; no fabricated golem definition', () => {
    const state = createMatch(seed), holder = state.preparation.units.find(u => u.team === 'player')!;
    const ids = validateTrainerGolemEmblems(emblems.filter(id => !UNIT_DEFINITIONS[holder.definitionId].traits.includes(EMBLEM_ITEMS[id].emblemTrait!)).slice(0, 3));
    const preparation = { ...state.preparation, units: [{ ...holder, location: { kind: 'board' as const, cell: { col: 0, row: 4 } } }] };
    const items = ids.map((definitionId, slot) => ({ id: `test-emblem-${slot}`, definitionId,
      location: { kind: 'unit' as const, unitId: holder.id, slot } }));
    const traits = deriveTraits(preparation, 'player', undefined, undefined, items);
    for (const id of ids) expect(traits.find(t => t.traitId === EMBLEM_ITEMS[id].emblemTrait)?.count).toBe(1);
    const benched = { ...preparation, units: [{ ...holder, location: { kind: 'bench' as const, slot: 0 } }] };
    expect(deriveTraits(benched, 'player', undefined, undefined, items).every(t => t.count === 0)).toBe(true);
  });
});

describe('PR4 lifecycle (enabled by batch B), bypass rejection and restoration', () => {
  it('repeated explicit grants are idempotent; generic round hooks and restore never regrant or draw', () => {
    let state = createMatch(seed);
    const before = serializeMatch(state), cap = getDeploymentCap(state);
    for (let n = 0; n < 3; n++) {
      unchanged(applyTrainerGolemsOpening(state), state);
      if (state.openingEncounter.mode !== 'solo') throw new Error('solo');
      const plan = planOpeningRound(state.openingEncounter.context, '1-2');
      expect(plan.facts).toEqual([]);
      expect(applyOpeningEffects(state, plan.facts)).toEqual({ ok: true, state, events: [] });
      expect(serializeMatch(state)).toBe(before);
      state = restoreMatch(before);
    }
    // Exactly one golem with its three permanent seat-sampled emblems, issued once at creation.
    const golems = state.preparation.units.filter(u => u.definitionId === TRAINER_UNIT.id);
    expect(golems).toHaveLength(1);
    expect(state.items.map(i => i.definitionId)).toEqual(trainerEmblems(seed, 'solo'));
    expect(state.items.map(i => i.location)).toEqual([0, 1, 2].map(slot => ({ kind: 'unit', unitId: golems[0].id, slot })));
    expect(getDeploymentCap(state)).toBe(cap);
    expect(state.removedAugmentIds).toEqual([]);
    expect(state.preparation.units.filter(u => u.team === 'player')).toHaveLength(2);
    expect(readOpeningEncounterView(state)).toMatchObject({ encounterId: 'trainer-golems', enabled: true,
      readiness: 'ready-for-followup', statusTextZh: '本局奇遇效果已启用', revealedFacts: [] });
    expect(toPrivateSeatView(state).openingEncounter).toEqual(readOpeningEncounterView(state));
  });

  it('rejects the wrong encounter before evidence admission', () => {
    const state = createMatch(42);
    rejected(applyTrainerGolemsOpening(state), state, 'invalid-opening-effect');
  });

  it('rejects forged effects and successful receipts rather than authenticating a valid emblem triple', () => {
    const state = createMatch(seed), before = JSON.stringify(state);
    const forged = { ...fact, emblems: validateTrainerGolemEmblems(triple) };
    rejected(applyOpeningEffects(state, [forged]), state, 'invalid-opening-effect');
    const opening = state.openingEncounter;
    if (opening.mode !== 'solo') throw new Error('solo');
    for (const openingEncounter of [
      { ...opening, receipts: [receipt] },
      { ...opening, context: { ...opening.context, facts: [forged] } },
      { ...opening, context: { ...opening.context, trainerGolems: { enabled: true, emblems: triple } } },
    ]) {
      const bad = { ...state, openingEncounter };
      rejected(applyTrainerGolemsOpening(bad), bad, 'opening-context-mismatch');
      expect(() => restoreMatch(bad)).toThrow('opening-context-mismatch');
      expect(() => restoreMatch(JSON.stringify(bad))).toThrow('opening-context-mismatch');
    }
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keeps all eight seats idempotent and rejects forged shared receipts and foreign bindings', () => {
    let pool = createSharedPool('trainer-test', seed);
    for (let i = 0; i < 8; i++) {
      const joined = initializeSharedSeat(pool, createMatch(100 + i, { mode: 'shared-deferred' }), `seat-${i}`, i);
      if (!joined.ok) throw new Error(joined.reason);
      pool = joined.pool;
      const state = joined.state, before = JSON.stringify({ pool, state });
      unchanged(applyTrainerGolemsOpening(state, pool.openingEncounter), state);
      rejected(applyTrainerGolemsOpening(state), state, 'opening-context-mismatch');
      rejected(applyTrainerGolemsOpening(state, createOpeningEncounter(42)), state, 'opening-context-mismatch');
      const restored = restoreSharedOrbSnapshot(pool, JSON.stringify(state));
      expect(restored).toEqual(state);
      unchanged(applyTrainerGolemsOpening(restored, pool.openingEncounter), restored);
      const bad = { ...state, openingEncounter: { ...state.openingEncounter, receipts: [receipt] } };
      expect(() => restoreSharedOrbSnapshot(pool, bad)).toThrow('invalid-seat-state');
      expect(JSON.stringify({ pool, state })).toBe(before);
    }
  });

  it('cannot sell or move a trainer that was never issued', () => {
    const state = createMatch(seed), before = JSON.stringify(state);
    rejected(sellUnit(state, fakeUnitId), state, 'unknown-unit');
    rejected(deployMatchUnit(state, fakeUnitId, { kind: 'board', cell: { col: 0, row: 4 } }), state, 'unknown-unit');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('rejects a fabricated trainer definition in preparation on text and object restore', () => {
    const state = createMatch(seed), holder = state.preparation.units.find(u => u.team === 'player')!;
    const bad = { ...state, preparation: { ...state.preparation, units: state.preparation.units.map(u =>
      u.id === holder.id ? { ...u, definitionId: 'trainer-golem-unregistered' } : u) } };
    expect(() => restoreMatch(bad)).toThrow();
    expect(() => restoreMatch(JSON.stringify(bad))).toThrow();
  });

  it.each(Object.keys(CONSUMABLE_DEFINITIONS) as (keyof typeof CONSUMABLE_DEFINITIONS)[])(
    '%s cannot remove, reforge or copy an unissued trainer; tool and RNG are untouched', definitionId => {
      // Isolated command target validation: no fake grant/receipt is persisted.
      const state = { ...createMatch(seed), consumables: [{ consumableId: 'test-tool', definitionId }] };
      const before = JSON.stringify(state);
      rejected(useConsumable(state, 'test-tool', { kind: 'unit', unitId: fakeUnitId }), state, 'unknown-unit');
      expect(JSON.stringify(state)).toBe(before);
    });

  it('recompiles a real battle on restore and rejects a forged trainer in the compiled roster', () => {
    let state = createMatch(seed);
    const holder = state.preparation.units.find(u => u.team === 'player')!;
    state = accepted(deployMatchUnit(state, holder.id, { kind: 'board', cell: { col: 0, row: 4 } }));
    state = accepted(startMatchCombat(state));
    expect(state.combat).not.toBeNull();
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const bad = structuredClone(state);
    if (!bad.combat?.strategy) throw new Error('strategy');
    Object.assign(bad.combat.strategy, { units: [...bad.combat.strategy.units,
      { ...bad.combat.strategy.units[0], unitId: fakeUnitId }] });
    expect(() => restoreMatch(bad)).toThrow('resolved strategy');
    expect(() => restoreMatch(JSON.stringify(bad))).toThrow('resolved strategy');
  });
});
