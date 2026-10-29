import { hexDistance, type HexCell } from './board';
import type { GameState } from './game';
import type { Unit } from './unit-types';
import { UNIT_DEFINITIONS } from './units';
import type { CombatStrategyInputs } from './combat-input';
import type { CombatEvent, CombatUnit } from './combat-types';
import type { ItemSummonOrigin } from './g2-4b-summons';
import type { StrategySnapshot, TraitDefinition, TraitSnapshot } from './strategy-types';
import { deriveEffectiveTraits, effectiveTraitMembers, type EffectiveMembership } from './traits/effective-membership';
import { changeMaxHp } from './m8/stats';
import { familyCombatBase } from './family-reunion';
import { resolveEffects } from './effects';
import type { HallMirrorOrigin } from './augment-pool-batch5-r3-mirrors';
import { AUGMENT_BATCH5_R3 } from './content/augment-pool-batch5-r3';

/** Content sentinels identify roster rules; they are not per-unit combat effects. */
export const isR3Augment = (id: string): boolean => Object.hasOwn(AUGMENT_BATCH5_R3,id);

export const isR3Copy = (copy: ItemSummonOrigin | undefined): boolean => copy?.kind === 'cloning-facility';

/** P-B5-74 (2026-10-27). Copies exist only in the compiled combat projection. */
export function projectR3Roster(state: CombatStrategyInputs): { state: CombatStrategyInputs; copies: readonly ItemSummonOrigin[] } {
  const augment = state.augments.find(a => a.definitionId === 'cloning-facility');
  const placement = augment && cloningFacilityPlacement(state.preparation);
  if (!augment || !placement) return { state, copies: [] };
  const { owner, cell } = placement;
  const id = JSON.stringify(['b5-r3', 'cloning-facility', augment.choiceId, owner.id]);
  const unit: Unit = { ...owner, id, location: { kind: 'board', cell } };
  const copy: ItemSummonOrigin = { kind: 'cloning-facility', ownerId: owner.id, itemInstanceId: augment.choiceId,
    unit, formCell: owner.location.kind === 'board' ? owner.location.cell : cell, healthBps: 7000 };
  return { state: { ...state, preparation: { ...state.preparation, units: [...state.preparation.units, unit] } }, copies: [copy] };
}

/** Each augment copy contributes a member; ordinary same-champion duplicates retain the normal distinct rule. */
export function r3Traits(projection: EffectiveMembership, team: 'player' | 'enemy', definitions: Readonly<Record<string, TraitDefinition>>,
  copies: readonly ItemSummonOrigin[], mirrors: readonly HallMirrorOrigin[] = []): TraitSnapshot[] {
  const traits = deriveEffectiveTraits(projection, team, definitions);
  if (!copies.length && !mirrors.length) return traits;
  const copied = new Set([...copies.map(c => c.unit.id), ...mirrors.map(m => m.unit.id)]);
  const board = projection.preparation.units.filter(u => u.team === team && u.location.kind === 'board');
  return traits.map(trait => {
    const members = effectiveTraitMembers(projection, team, trait.traitId);
    const count = new Set(members.map(u => copied.has(u.id) ? u.id : u.definitionId)).size;
    const definition = definitions[trait.traitId];
    const tier = trait.traitId === 'emissary' && count !== 1 && count !== 4 ? 0
      : definition.tiers.reduce((n, t) => t.threshold <= count ? Math.max(n, t.threshold) : n, 0);
    return { ...trait, count, tier, targetUnitIds: tier === 0 ? [] : (definition.target === 'team' ? board : members).map(u => u.id).sort() };
  });
}

/** Apply only augment combat bodies before ordinary skill/item summon placement. */
export function projectR3Preparation(preparation: GameState, strategy?: StrategySnapshot): GameState {
  if (!strategy) return preparation;
  const replacements = strategy.units.flatMap(u => u.r3Mirror ? [u.r3Mirror.unit] : []);
  const added = strategy.units.flatMap(u => isR3Copy(u.itemSummon) ? [u.itemSummon!.unit] : [])
    .filter(u => !preparation.units.some(old => old.id === u.id));
  if (!replacements.length && !added.length) return preparation;
  return { ...preparation, units: [...preparation.units.map(u => replacements.find(r => r.id === u.id) ?? u), ...added] };
}

export function bindR3Copies(strategy: StrategySnapshot, copies: readonly ItemSummonOrigin[], equipmentBasis?: StrategySnapshot): StrategySnapshot {
  if (!copies.length) return strategy;
  return { ...strategy, units: strategy.units.map(unit => {
    const copy = copies.find(c => c.unit.id === unit.unitId);
    if (!copy) return unit;
    const frozen = equipmentBasis?.units.find(u => u.unitId === unit.unitId);
    if (frozen) return frozen;
    const owner = strategy.units.find(u => u.unitId === copy.ownerId)!;
    const base = owner.effectiveStarLevel && owner.effectiveStarLevel !== copy.unit.starLevel
      ? familyCombatBase(copy.unit, owner.effectiveStarLevel) : undefined;
    const resolved = base ? resolveEffects(base.base, base.ability, unit.sources) : unit;
    const maxMana = Math.ceil(owner.stats.maxMana * 12000 / 10000);
    return { ...unit, ...resolved, ...(owner.effectiveStarLevel ? { effectiveStarLevel: owner.effectiveStarLevel } : {}), itemSummon: copy,
      stats: { ...resolved.stats, health: Math.max(1, Math.floor(owner.stats.health * 7000 / 10000)),
      maxMana, initialMana: Math.min(unit.stats.initialMana, maxMana) } };
  }) };
}

/** Final sampling follows opening equipment, anomaly and trait effects; subsequent ticks never resample the owner. */
export function initializeR3Copies(units: readonly CombatUnit[], events: CombatEvent[] = []): void {
  for (const unit of units) {
    const copy = unit.itemSummon;
    if (copy?.kind !== 'cloning-facility') continue;
    const owner = units.find(u => u.id === copy.ownerId);
    if (!owner) throw new RangeError('Missing Cloning Facility owner');
    const maxHp = Math.max(1, Math.floor(owner.maxHp * 7000 / 10000));
    const change = changeMaxHp(unit.maxHp, unit.hp, maxHp);
    Object.assign(unit, { itemSummonOpeningMaxHp: owner.maxHp, maxHp, hp: maxHp,
      maxHpBasis: { base: owner.maxHp, flat: 0, bps: 0, bonusBps: 0 } });
    if (change.beforeMax !== change.afterMax) events.push({ type: 'maxHpChanged', tick: 0, unitId: unit.id,
      source: { ownerId: owner.id, sourceKind: 'augment', definitionId: 'cloning-facility', instanceId: copy.itemInstanceId, effectIndex: 0, parentItemInstanceId: null }, ...change });
  }
}

/** B5-74: positions are in the owning player's preparation coordinates. */
export function cloningFacilityPlacement(preparation: GameState): { owner: Unit; cell: HexCell } | null {
  const zone = preparation.board.deploymentZones.player;
  const origin = { col: 3, row: zone.lastRow - 1 };
  const owner = preparation.units.find(u => u.team === 'player' && u.location.kind === 'board'
    && u.location.cell.col === origin.col && u.location.cell.row === origin.row
    && UNIT_DEFINITIONS[u.definitionId] && !UNIT_DEFINITIONS[u.definitionId].summon
    && UNIT_DEFINITIONS[u.definitionId].unitKind !== 'neutral');
  if (!owner) return null;
  const occupied = new Set(preparation.units.flatMap(u => u.location.kind === 'board' ? [`${u.location.cell.col}:${u.location.cell.row}`] : []));
  const cells: HexCell[] = [];
  for (let row = zone.firstRow; row <= zone.lastRow; row++) for (let col = 0; col < preparation.board.columns; col++) {
    if (!occupied.has(`${col}:${row}`)) cells.push({ col, row });
  }
  cells.sort((a,b) => hexDistance(origin,a) - hexDistance(origin,b) || a.row - b.row || a.col - b.col);
  return cells[0] ? { owner, cell: cells[0] } : null;
}

