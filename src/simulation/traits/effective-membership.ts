import { combatBenchProjection } from '../bench-capacity';
import { EMBLEM_ITEMS } from '../content/emblems';
import type { ItemInstance } from '../strategy-types';
import type { Team } from '../board';
import { contains, sameCell } from '../board';
import type { GameState } from '../game';
import type { Unit } from '../unit-types';
import { UNIT_DEFINITIONS } from '../units';
import { TRAIT_DEFINITIONS } from '../content/traits';
import type { TraitDefinition, TraitSnapshot } from '../strategy-types';

interface TemporarySource {
  readonly sourceId: string;
  /** Match round ordinal, including carousel and overtime. End is exclusive. */
  readonly activeFromRound: number;
  readonly expiresBeforeRound: number;
}
/** Verified ownership/choice history must supply these declarations, never saved counts.
 * Projection does not grant ownership, equipment, population or rewards. */
export type TraitProjectionSource = TemporarySource & (
  | { readonly kind: 'add-unit'; readonly unit: Unit }
  | { readonly kind: 'remove-unit'; readonly unitId: string }
  | { readonly kind: 'add-trait' | 'remove-trait'; readonly unitId: string; readonly traitId: string }
  | { readonly kind: 'emblem'; readonly unitId: string; readonly traitId: string; readonly itemInstanceId: string }
);
export interface TraitProjectionContext {
  readonly round: number;
  readonly sources: readonly TraitProjectionSource[];
}
export interface EffectiveMembership {
  readonly preparation: GameState;
  readonly members: readonly { readonly unitId: string; readonly traitId: string; readonly sourceIds: readonly string[] }[];
}
const ascii = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const check = (condition: unknown): void => { if (!condition) throw new RangeError('Invalid trait projection source'); };
const ordinal = (n: number): boolean => Number.isSafeInteger(n) && n >= 1;

/** Q3: absence removes only the projection, never the owned instance.
 * Q5: conflicting operations and duplicate grants are rejected pending policy review.
 * Native distinct-definition counting remains unchanged. No mutable-state cache. */
export function projectEffectiveMembership(preparation: GameState, context?: TraitProjectionContext,
  definitions: Readonly<Record<string,TraitDefinition>> = TRAIT_DEFINITIONS, items: readonly ItemInstance[] = []): EffectiveMembership {
  preparation = combatBenchProjection(preparation);
  const sources = context?.sources ?? [];
  if (context) check(ordinal(context.round) && Array.isArray(sources));
  const ids = new Set<string>();
  for (const source of sources) {
    check(typeof source.sourceId === 'string' && source.sourceId.length > 0 && !ids.has(source.sourceId)
      && ordinal(source.activeFromRound) && ordinal(source.expiresBeforeRound) && source.expiresBeforeRound > source.activeFromRound);
    ids.add(source.sourceId);
    check(['add-unit','remove-unit','add-trait','remove-trait','emblem'].includes(source.kind));
    if (source.kind === 'emblem') check(typeof source.itemInstanceId === 'string' && source.itemInstanceId.length > 0);
    if (source.kind === 'emblem' || source.kind === 'add-trait' || source.kind === 'remove-trait') {
      check(Object.hasOwn(definitions,source.traitId));
      // Unique traits have one single-member tier; Emissary has special 1/4 tiers.
      if (source.kind !== 'remove-trait') check(!(definitions[source.traitId].tiers.length === 1 && definitions[source.traitId].tiers[0].threshold === 1));
    }
  }
  const active = sources.filter(s => context!.round >= s.activeFromRound && context!.round < s.expiresBeforeRound)
    .sort((a,b) => ascii(a.sourceId,b.sourceId));
  const units = [...preparation.units], unitOperations = new Set<string>();
  // Resolve the final roster as a set: vacated cells are available to additions
  // regardless of source-id ordering. Same-identity operations still conflict.
  const unitSources = active.filter(s => s.kind === 'add-unit' || s.kind === 'remove-unit')
    .sort((a,b) => Number(a.kind === 'add-unit') - Number(b.kind === 'add-unit') || ascii(a.sourceId,b.sourceId));
  for (const source of unitSources) {
    const id = source.kind === 'add-unit' ? source.unit.id : source.unitId;
    check(typeof id === 'string' && id.length > 0 && !unitOperations.has(id)); unitOperations.add(id);
    const index = units.findIndex(u => u.id === id);
    if (source.kind === 'remove-unit') { check(index >= 0); units.splice(index,1); }
    else {
      const unit = source.unit, location = unit.location;
      check(index < 0 && Object.hasOwn(UNIT_DEFINITIONS,unit.definitionId) && ['player','enemy'].includes(unit.team)
        && [1,2,3].includes(unit.starLevel) && location.kind === 'board' && contains(preparation.board,location.cell)
        && !units.some(u => u.location.kind === 'board' && location.kind === 'board' && sameCell(u.location.cell,location.cell)));
      units.push(structuredClone(unit));
    }
  }
  const members: {unitId:string;traitId:string;sourceIds:string[]}[] = [];
  const boardUnits = units.filter(u => u.location.kind === 'board').sort((a,b) => ascii(a.id,b.id));
  for (const unit of boardUnits) {
    if (!Object.hasOwn(UNIT_DEFINITIONS,unit.definitionId)) throw new RangeError(`Unknown unit definition: ${unit.definitionId}`);
    for (const traitId of UNIT_DEFINITIONS[unit.definitionId].traits) {
      members.push({unitId:unit.id,traitId,sourceIds:[]});
    }
  }
  // Equipment membership is derived from owned instances, never saved counts. Native traits do not double count.
  for (const item of items) {
    const traitId = EMBLEM_ITEMS[item.definitionId]?.emblemTrait;
    if (!traitId || item.location.kind !== 'unit' || !Object.hasOwn(definitions,traitId)) continue;
    const unitId = item.location.unitId;
    if (boardUnits.some(u=>u.id===unitId) && !members.some(m=>m.unitId===unitId&&m.traitId===traitId))
      members.push({unitId,traitId,sourceIds:[JSON.stringify(['emblem',item.id])]});
  }
  const membershipOperations = new Set<string>(), emblems = new Set<string>();
  for (const source of active) if (source.kind !== 'add-unit' && source.kind !== 'remove-unit') {
    check(preparation.units.some(u => u.id === source.unitId) || units.some(u => u.id === source.unitId));
    const key = JSON.stringify([source.unitId,source.traitId]);
    check(!membershipOperations.has(key)); membershipOperations.add(key);
    if (source.kind === 'emblem') { check(!emblems.has(source.itemInstanceId)); emblems.add(source.itemInstanceId); }
    // Bench equipment remains owned but contributes no on-board membership.
    if (!boardUnits.some(u => u.id === source.unitId)) continue;
    const index = members.findIndex(m => m.unitId === source.unitId && m.traitId === source.traitId);
    if (source.kind === 'remove-trait') { check(index >= 0); members.splice(index,1); }
    else { check(index < 0); members.push({unitId:source.unitId,traitId:source.traitId,sourceIds:[source.sourceId]}); }
  }
  return {preparation:active.some(s => s.kind === 'add-unit' || s.kind === 'remove-unit') ? {...preparation,units} : preparation,
    members:members.sort((a,b) => ascii(a.unitId,b.unitId) || ascii(a.traitId,b.traitId))};
}
export function effectiveTraitMembers(projection: EffectiveMembership, team: Team, traitId: string): Unit[] {
  const ids = new Set(projection.members.filter(m => m.traitId === traitId).map(m => m.unitId));
  return projection.preparation.units.filter(u => u.team === team && u.location.kind === 'board' && ids.has(u.id)).sort((a,b) => ascii(a.id,b.id));
}
/** Single count/tier implementation for preview, compiler and current-board settlement. */
export function deriveEffectiveTraits(projection: EffectiveMembership, team: Team,
  definitions: Readonly<Record<string,TraitDefinition>> = TRAIT_DEFINITIONS): TraitSnapshot[] {
  const boardUnits = projection.preparation.units.filter(u => u.team === team && u.location.kind === 'board').sort((a,b) => ascii(a.id,b.id));
  for (const unit of boardUnits) for (const traitId of UNIT_DEFINITIONS[unit.definitionId].traits)
    if (!Object.hasOwn(definitions,traitId)) throw new RangeError(`Unknown trait: ${traitId}`);
  return Object.keys(definitions).sort(ascii).map(traitId => deriveEffectiveTrait(projection,team,traitId,definitions));
}

/** A specific trait consumer does not require unrelated legacy traits in its catalog. */
export function deriveEffectiveTrait(projection: EffectiveMembership, team: Team, traitId: string,
  definitions: Readonly<Record<string,TraitDefinition>> = TRAIT_DEFINITIONS): TraitSnapshot {
    const boardUnits = projection.preparation.units.filter(u => u.team === team && u.location.kind === 'board').sort((a,b) => ascii(a.id,b.id));
    const definition = definitions[traitId], members = effectiveTraitMembers(projection,team,traitId);
    const memberDefinitionIds = [...new Set(members.map(u => u.definitionId))].sort(ascii), count = memberDefinitionIds.length;
    const tier = traitId === 'emissary' && count !== 1 && count !== 4 ? 0 : definition.tiers.reduce((n,t) => t.threshold <= count ? Math.max(n,t.threshold) : n,0);
    const targets = definition.target === 'team' ? boardUnits : members;
    // Preserve native snapshot shapes. Different copies can carry different emblems.
    const dynamic = boardUnits.some(u => members.some(m => m.id === u.id) !== UNIT_DEFINITIONS[u.definitionId].traits.includes(traitId));
    return {team,traitId,count,tier,memberDefinitionIds,targetUnitIds:tier === 0 ? [] : targets.map(u => u.id),
      ...(dynamic ? {memberUnitIds:members.map(u => u.id)} : {})};
}

/** Combat reads the frozen compiler membership; plain combat retains native behavior. */
export function isCombatTraitMember(unit: Pick<import('../combat-types').CombatUnit,'definitionId'|'sources'>, traitId:string):boolean {
  return unit.sources === undefined ? (UNIT_DEFINITIONS[unit.definitionId]?.traits.includes(traitId) ?? false)
    : unit.sources.some(s => s.source.sourceKind==='trait' && s.source.sourceDefinitionId===traitId && s.effect.kind==='mechanic' && s.effect.mechanic==='g23Trait');
}

/** A frozen row may distinguish copies; definition ids are only the native fallback. */
export function isTraitSnapshotMember(trait: TraitSnapshot, unit: Pick<Unit,'id'|'definitionId'|'team'>): boolean {
  return trait.team === unit.team && (trait.memberUnitIds !== undefined
    ? trait.memberUnitIds.includes(unit.id) : trait.memberDefinitionIds.includes(unit.definitionId));
}
