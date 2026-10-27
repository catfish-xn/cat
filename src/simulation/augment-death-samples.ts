import type { CombatEvent, CombatState, CombatStep, CombatUnit } from './combat-types';
import type { AugmentDeath } from './augment-history-types';
import { UNIT_DEFINITIONS } from './units';

// Observation only: no fields on CombatState/events and no replay/wire byte changes.
// Weak ownership follows the exact execution; restored external terminals must be replayed.
const samples = new WeakMap<object, Omit<AugmentDeath, 'combatId' | 'eventSeq'>>();
const histories = new WeakMap<CombatState, readonly AugmentDeath[]>();
export function isAugmentOrdinaryHero(unit: CombatUnit): boolean {
  return !!UNIT_DEFINITIONS[unit.definitionId] && !UNIT_DEFINITIONS[unit.definitionId].summon
    && unit.unitKind !== 'neutral' && !unit.itemSummon && !unit.anomalySummon;
}
export function sampleAugmentDeath<E extends CombatEvent>(event: E, unit: CombatUnit): E {
  samples.set(event, { tick: event.tick, unitId: unit.id, definitionId: unit.definitionId, team: unit.team, ownerSeatId: unit.team === 'player' ? 'solo' : null, originalUnitId: unit.id,
    ordinaryHero: isAugmentOrdinaryHero(unit),
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

/** Combat-time view of the same deaths published into augment-history-v1.
 * The replay-authenticated first-death ledger supplies the ordered prefix even
 * after JSON restoration (WeakMap samples are deliberately not save fields).
 * Current unstamped events retain their exact emission order. Never infer a
 * death from HP, and never count a resurrection twice in this first-death view. */
export function readAugmentFirstHeroDeaths(state: CombatState, events: readonly CombatEvent[]): readonly { unitId: string; team: CombatUnit['team']; current: boolean }[] {
  const result: { unitId: string; team: CombatUnit['team']; current: boolean }[] = [];
  const seen = new Set<string>(), prior = histories.get(state) ?? [];
  for (const death of [...state.openingDeaths ?? []].sort((a, b) => a.eventSeq - b.eventSeq)) {
    const sampled = prior.find(d => d.unitId === death.unitId);
    const unit = state.units.find(u => u.id === death.unitId);
    const ordinary = sampled ? sampled.ordinaryHero : unit && isAugmentOrdinaryHero(unit);
    if (ordinary && !seen.has(death.unitId)) {
      seen.add(death.unitId); result.push({ unitId: death.unitId, team: sampled?.team ?? unit!.team, current: false });
    }
  }
  for (const death of augmentDeathsFromEvents(events)) if (death.ordinaryHero && !seen.has(death.unitId)) {
    seen.add(death.unitId); result.push({ unitId: death.unitId, team: death.team, current: true });
  }
  return result;
}
