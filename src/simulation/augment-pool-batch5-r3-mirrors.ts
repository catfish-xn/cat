import type { CombatStrategyInputs } from './combat-input';
import type { GameState } from './game';
import type { Unit } from './unit-types';
import type { CombatEvent, CombatUnit } from './combat-types';
import type { StrategySnapshot } from './strategy-types';
import type { S13Packet } from './combat-s13-abilities';
import { UNIT_DEFINITIONS } from './units';
import { changeMaxHp } from './m8/stats';
import { familyCombatBase } from './family-reunion';
import { resolveEffects } from './effects';

export interface HallMirrorOrigin {
  readonly choiceId: string;
  readonly sourceUnitId: string;
  /** The same owned identity/position, with the center champion's combat body. */
  readonly unit: Unit;
}
/** Authenticated compiler inputs to sample each position's original opening HP. Never a saved receipt. */
export interface R3OriginalArmy {
  readonly team: 'player' | 'enemy';
  readonly preparation: GameState;
  readonly strategy: StrategySnapshot;
}

export function hallOfMirrorsTargets(preparation: GameState): readonly Unit[] {
  const row = preparation.board.deploymentZones.player.firstRow;
  return preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board' && u.location.cell.row === row
    && UNIT_DEFINITIONS[u.definitionId] && !UNIT_DEFINITIONS[u.definitionId].summon && UNIT_DEFINITIONS[u.definitionId].unitKind !== 'neutral')
    .sort((a, b) => {
      const left = a.location.kind === 'board' ? a.location.cell.col : 0;
      const right = b.location.kind === 'board' ? b.location.cell.col : 0;
      return Math.abs(left - 3) - Math.abs(right - 3) || left - right;
    });
}

/** P-B5-78: simultaneous replacement, including the center itself; permanent ownership stays untouched. */
export function projectHallOfMirrors(state: CombatStrategyInputs): { state: CombatStrategyInputs; mirrors: readonly HallMirrorOrigin[] } {
  const a = state.augments.find(a => a.definitionId === 'hall-of-mirrors');
  const targets = a ? hallOfMirrorsTargets(state.preparation) : [];
  if (!a || !targets.length) return { state, mirrors: [] };
  const source = targets[0], ids = new Set(targets.map(u => u.id));
  const mirrors = targets.map(target => ({ choiceId: a.choiceId, sourceUnitId: source.id,
    unit: { ...target, definitionId: source.definitionId, starLevel: source.starLevel } }));
  const { d14Combat, ...rest } = state;
  return { mirrors, state: { ...rest, ...(d14Combat && !ids.has(d14Combat.unitId) ? { d14Combat } : {}),
    preparation: { ...state.preparation, units: state.preparation.units.map(u => mirrors.find(m => m.unit.id === u.id)?.unit ?? u) },
    items: state.items.filter(i => i.location.kind !== 'unit' || !ids.has(i.location.unitId)),
    temporaryEquipment: state.temporaryEquipment.filter(i => !ids.has(i.holderId)),
    anomalyBinding: state.anomalyBinding && ids.has(state.anomalyBinding.unitId) ? null : state.anomalyBinding,
    persistentGrowth: state.persistentGrowth.filter(g => !ids.has(g.unitId)),
    ...(state.augmentHistoryGrowth ? { augmentHistoryGrowth: state.augmentHistoryGrowth.filter(g => !ids.has(g.unitId)) } : {}),
    ...(state.h6Growth ? { h6Growth: state.h6Growth.filter(g => !ids.has(g.unitId)) } : {}),
  } };
}

export function bindHallOfMirrors(strategy: StrategySnapshot, mirrors: readonly HallMirrorOrigin[], original?: R3OriginalArmy): StrategySnapshot {
  if (!mirrors.length || !original) return strategy;
  return { ...strategy, r3Original: [original], units: strategy.units.map(unit => {
    const mirror = mirrors.find(m => m.unit.id === unit.unitId);
    if (!mirror) return unit;
    const source = original.strategy.units.find(u => u.unitId === mirror.sourceUnitId)!;
    const before = original.strategy.units.find(u => u.unitId === unit.unitId)!;
    const base = source.effectiveStarLevel && source.effectiveStarLevel !== mirror.unit.starLevel
      ? familyCombatBase(mirror.unit, source.effectiveStarLevel) : undefined;
    const resolved = base ? resolveEffects(base.base, base.ability, unit.sources) : unit;
    return { ...unit, ...resolved, r3Mirror: mirror, ...(source.effectiveStarLevel ? { effectiveStarLevel: source.effectiveStarLevel } : {}),
      stats: { ...resolved.stats, health: before.stats.health } };
  }) };
}

/** Called after the complete opening; each original position was independently compiled and started once. */
export function initializeHallOfMirrors(units: readonly CombatUnit[], events: CombatEvent[] = []): void {
  for (const unit of units) {
    if (!unit.r3Mirror) continue;
    const maxHp = unit.itemSummonOpeningMaxHp;
    if (!Number.isSafeInteger(maxHp) || maxHp! <= 0) throw new RangeError('Missing Hall of Mirrors opening health');
    const change = changeMaxHp(unit.maxHp, unit.hp, maxHp!);
    Object.assign(unit, { maxHp, hp: maxHp, maxHpBasis: { base: maxHp, flat: 0, bps: 0, bonusBps: 0 } });
    if (change.beforeMax !== change.afterMax) events.push({ type: 'maxHpChanged', tick: 0, unitId: unit.id,
      source: { ownerId: unit.id, sourceKind: 'augment', definitionId: 'hall-of-mirrors', instanceId: unit.r3Mirror.choiceId, effectIndex: 0, parentItemInstanceId: null }, ...change });
  }
}

/** One multiplicative outgoing penalty after normal amplification/mitigation, before shields and redirect. */
export function hallOfMirrorsDamage<T extends { beforeMitigation: number; mitigated: number; prevented: number; blockedByMitigation: number }>(
  owner: Pick<CombatUnit, 'r3Mirror'> | undefined, packet: Pick<S13Packet, 'inherited'>, prepared: T): T {
  if (!owner?.r3Mirror || packet.inherited) return prepared;
  const scale = (n: number) => Number(BigInt(n) * 6n / 10n);
  return { ...prepared, beforeMitigation: scale(prepared.beforeMitigation), mitigated: scale(prepared.mitigated),
    prevented: scale(prepared.prevented), blockedByMitigation: scale(prepared.blockedByMitigation) };
}

/** Execute packets bypass prepareDamage, but still obey the same outgoing penalty. */
export function hallOfMirrorsExecution(owner: Pick<CombatUnit, 'r3Mirror'> | undefined, amount: number) {
  return { raw: amount, prevented: 0, mitigated: owner?.r3Mirror ? Number(BigInt(amount) * 6n / 10n) : amount, critical: false };
}
