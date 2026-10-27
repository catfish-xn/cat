import type { CombatEvent, CombatOrigin, CombatState, CombatStep, CombatUnit } from './combat-types';
import type { AugmentDeath, AugmentTakedownActor } from './augment-history-types';
import { UNIT_DEFINITIONS } from './units';

// Observation only: no fields on CombatState/events and no replay/wire byte changes.
// Weak ownership follows the exact execution; restored external terminals must be replayed.
const samples = new WeakMap<object, Omit<AugmentDeath, 'combatId' | 'eventSeq'>>();
const histories = new WeakMap<CombatState, readonly AugmentDeath[]>();
// Keep attribution beside the observed event, not in the combat event or save protocol.
const takedowns = new WeakMap<object, readonly AugmentTakedownActor[]>();
const killers = new WeakMap<object, CombatOrigin | null>();
export interface AugmentDeathAttribution { readonly combatId: string; readonly eventSeq: number; readonly killer: CombatOrigin | null; readonly takedowns?: readonly AugmentTakedownActor[] }
const attributionHistories = new WeakMap<CombatState, readonly AugmentDeathAttribution[]>();
export function sampleAugmentDeath<E extends CombatEvent>(event: E, unit: CombatUnit, killer?: CombatOrigin | null, actors?: readonly AugmentTakedownActor[]): E {
  if (actors !== undefined) takedowns.set(event, structuredClone(actors));
  if (killer !== undefined) killers.set(event, killer ? structuredClone(killer) : null);
  samples.set(event, { tick: event.tick, unitId: unit.id, definitionId: unit.definitionId, team: unit.team, ownerSeatId: unit.team === 'player' ? 'solo' : null, originalUnitId: unit.id,
    ordinaryHero: !!UNIT_DEFINITIONS[unit.definitionId] && !UNIT_DEFINITIONS[unit.definitionId].summon && unit.unitKind !== 'neutral' && !unit.itemSummon && !unit.anomalySummon,
    equipment: structuredClone(unit.equipment ?? []), combatItemGrants: structuredClone(unit.combatItemGrants ?? []) });
  return event;
}
export function carryAugmentDeathSample<E extends CombatEvent>(before: CombatEvent, after: E): E {
  const sample = samples.get(before); if (sample) samples.set(after, sample);
  if (takedowns.has(before)) takedowns.set(after, takedowns.get(before)!);
  if (killers.has(before)) killers.set(after, killers.get(before)!);
  return after;
}
export function augmentDeathsFromEvents(events: readonly object[], includeKiller = false, includeTakedowns = false): readonly AugmentDeath[] {
  return events.flatMap(e => { const s = samples.get(e), event = e as CombatEvent;
    return s ? [{ ...s, combatId: event.combatId!, eventSeq: event.eventSeq!,
      ...(includeTakedowns && takedowns.has(e) ? { takedowns: structuredClone(takedowns.get(e)!) } : {}),
      ...(includeKiller && killers.has(e) ? { killer: structuredClone(killers.get(e)!) } : {}) }] : []; });
}
export function carryAugmentCombatDeaths(before: CombatState, step: CombatStep): CombatStep {
  const added = augmentDeathsFromEvents(step.events), previous = histories.get(before) ?? [];
  if (added.length || previous.length) histories.set(step.state, [...previous, ...added]);
  const attributions = step.events.flatMap(event => {
    if (!killers.has(event) || typeof event.combatId !== 'string' || typeof event.eventSeq !== 'number') return [];
    return [{ combatId: event.combatId, eventSeq: event.eventSeq, killer: structuredClone(killers.get(event)!), ...(takedowns.has(event)?{takedowns:structuredClone(takedowns.get(event)!)}:{}) }];
  });
  const oldAttributions = attributionHistories.get(before) ?? [];
  if (attributions.length || oldAttributions.length) attributionHistories.set(step.state, [...oldAttributions, ...attributions]);
  return step;
}
export function readAugmentCombatDeaths(terminal: CombatState, includeKiller = false, includeTakedowns = false): readonly AugmentDeath[] {
  const rows = structuredClone(histories.get(terminal) ?? []);
  if (!includeKiller && !includeTakedowns) return rows;
  const attributes = new Map((attributionHistories.get(terminal) ?? []).map(a => [JSON.stringify([a.combatId, a.eventSeq]), a]));
  return rows.map(row => {
    const attribution = attributes.get(JSON.stringify([row.combatId, row.eventSeq]));
    return attribution ? { ...row, ...(includeKiller?{killer:structuredClone(attribution.killer)}:{}),
      ...(includeTakedowns && attribution.takedowns?{takedowns:structuredClone(attribution.takedowns)}:{}) } : row;
  });
}

/** The actual killing source, if the S13 resolver observed this death. Undefined means no sample. */
export function readAugmentDeathKiller(event: object): CombatOrigin | null | undefined {
  const source = killers.get(event); return source ? structuredClone(source) : source;
}

/** Detached attribution samples observed during this execution, including terminal-only delivery. */
export function readAugmentCombatAttributions(state: CombatState): readonly AugmentDeathAttribution[] {
  return structuredClone(attributionHistories.get(state) ?? []);
}
