import type { CombatEvent, CombatState, CombatStep, CombatUnit } from './combat-types';
import type { AugmentDeath } from './augment-history-types';
import { UNIT_DEFINITIONS } from './units';

// Observation only: no fields on CombatState/events and no replay/wire byte changes.
// Weak ownership follows the exact execution; restored external terminals must be replayed.
const samples = new WeakMap<object, Omit<AugmentDeath, 'combatId' | 'eventSeq'>>();
const histories = new WeakMap<CombatState, readonly AugmentDeath[]>();
export function sampleAugmentDeath<E extends CombatEvent>(event: E, unit: CombatUnit): E {
  samples.set(event, { tick: event.tick, unitId: unit.id, definitionId: unit.definitionId, team: unit.team, ownerSeatId: unit.team === 'player' ? 'solo' : null, originalUnitId: unit.id,
    ordinaryHero: !!UNIT_DEFINITIONS[unit.definitionId] && !UNIT_DEFINITIONS[unit.definitionId].summon && unit.unitKind !== 'neutral' && !unit.itemSummon && !unit.anomalySummon,
    equipment: structuredClone(unit.equipment ?? []), combatItemGrants: structuredClone(unit.combatItemGrants ?? []) });
  return event;
}
export function carryAugmentDeathSample<E extends CombatEvent>(before: CombatEvent, after: E): E {
  const sample = samples.get(before); if (sample) samples.set(after, sample); return after;
}
export function augmentDeathsFromEvents(events: readonly object[]): readonly AugmentDeath[] {
  return events.flatMap(e => { const s = samples.get(e), event = e as CombatEvent;
    return s ? [{ ...s, combatId: event.combatId!, eventSeq: event.eventSeq! }] : []; });
}
export function carryAugmentCombatDeaths(before: CombatState, step: CombatStep): CombatStep {
  const added = augmentDeathsFromEvents(step.events), previous = histories.get(before) ?? [];
  if (added.length || previous.length) histories.set(step.state, [...previous, ...added]);
  return step;
}
export function readAugmentCombatDeaths(terminal: CombatState): readonly AugmentDeath[] { return structuredClone(histories.get(terminal) ?? []); }
