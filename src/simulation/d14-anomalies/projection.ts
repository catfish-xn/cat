import { UNIT_DEFINITIONS, type ResolvedUnitStats } from '../units';
import { getUnitStats } from '../unit-stats';
import { resolveAbility } from '../combat-abilities';
import { makeSourcedEffects, resolveEffects } from '../effects';
import type { SourcedEffect } from '../strategy-types';
import type { S13ResolvedAbility } from '../ability-types';
import type { D14State } from './types';
import { D14_FOURTH_ABILITY } from './fourth-ability';
import { D14_POLICY } from '../content/d14-anomalies';

/** Provisional D14-only convention: preserve the historically approved 583.2%
 * HP/AD override, floored from 1-star base, independently of normal star scaling.
 * Not claimed as recovered original scaling.
 * Physical ownership remains 3-star / nine shares; no general four-star merge exists. */
export const D14_ULTIMATE_BASE_BPS = 58320;
/** Compile before resolveEffects, passing ALL item/trait/growth sources once. Absent units
 * return null: caller must also exclude them from population, traits and combat roster.
 * effectiveStarLevel is deliberately separate from physical Unit.starLevel. Production
 * star comparisons, survivor damage and restore require explicit integration. */
export function projectD14Unit(state: D14State, seatId: string, unitId: string,
  otherSources: readonly SourcedEffect[] = []) {
  const seat = state.ownership.seats.find(s => s.seatId === seatId);
  if (!seat) throw new RangeError('Unknown D14 seat');
  const unit = seat.preparation.units.find(u => u.id === unitId && u.team === 'player');
  if (!unit) return null;
  const record = state.records.find(r => r.selection.seatId === seatId && r.unitId === unitId && r.phase !== 'retired');
  const promoted = record?.phase === 'promoted';
  if(promoted&&record.selection.anomalyId!=='ultimate-hero')throw new RangeError('Invalid Ultimate Hero certificate');
  const sources = [...otherSources];
  const {base,ability}=d14UnitBase(unit,promoted);
  if (record?.phase === 'returned') sources.push(...makeSourcedEffects(unitId, 'anomaly', 'into-the-unknown', record.selection.choiceId, [
    { kind: 'statPercentBps', stat: 'attackDamage', bps: D14_POLICY.gainedADBps },
    { kind: 'statFlat', stat: 'abilityPower', amount: D14_POLICY.gainedAP },
  ]));
  return { ...resolveEffects(base, ability, sources), effectiveStarLevel: promoted ? 4 as const : unit.starLevel,
    physicalStarLevel: unit.starLevel, unitId, location: unit.location };
}

/** Shared certified base compiler; callers authenticate the promotion certificate first. */
export function d14UnitBase(unit: Pick<import('../unit-types').Unit,'definitionId'|'starLevel'>, promoted: boolean) {
  let base: ResolvedUnitStats = getUnitStats(unit.definitionId, unit.starLevel);
  let ability = resolveAbility(base.abilityId, unit.starLevel);
  if (promoted) {
    const definition = UNIT_DEFINITIONS[unit.definitionId];
    if (definition.cost !== 1 || unit.starLevel !== 3
      || !Object.hasOwn(D14_FOURTH_ABILITY, unit.definitionId)) throw new RangeError('Invalid Ultimate Hero certificate');
    base = { ...base, health: Math.floor(definition.baseStats.health * D14_ULTIMATE_BASE_BPS / 10000),
      attack: Math.floor(definition.baseStats.attack * D14_ULTIMATE_BASE_BPS / 10000) };
    const variables = Object.fromEntries(Object.entries(D14_FOURTH_ABILITY[unit.definitionId]).map(([key, value]) => [key, Math.round(value * 10000)]));
    // Riot 14.24b explicitly lists the fourth rank: 50/50/55/60%, raw 4-star is 70%.
    if (unit.definitionId === 'singed') variables.DR = 6000;
    ability = { id: base.abilityId, amount: 0, kind: 's13', championId: unit.definitionId, variables } satisfies S13ResolvedAbility;
  }
  return {base,ability};
}
