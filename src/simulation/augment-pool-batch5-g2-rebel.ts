import type { CombatState, CombatUnit, CombatMechanic, CombatEvent } from './combat-types';
import type { TraitSnapshot } from './strategy-types';
import type { HexCell } from './board';
import type { AbilityContext } from './combat-s13-abilities';
import { EMPTY_RUNTIME, type S13Unit } from './combat-s13-state';
import { g23FormStats } from './g2-3-forms';
import { resolveAbility } from './combat-abilities';
import { effectKey, resolveEffects, initializeEffectRuntime } from './effects';
import { compileCombatInitialInputs } from './combat-initialization';
import { nearestItemCell } from './g2-4b-item-kernel';
import { spawnCombatUnit } from './seat-mechanics/combat-events';
import { initializeBornUnits } from './combat-g2-4b-trench';
import { occupiesCell } from './anomalies/availability';
import { isTraitSnapshotMember } from './traits/effective-membership';
import { UNIT_DEFINITIONS } from './units';
import { REBEL_COPY_RULES } from './content/augment-pool-batch5-g2';
import { scaleItemSummonHp } from './g2-4b-summons';
import { g22 } from './combat-g2-2';
import { asSource } from './m8/s13-definitions';
import { executeMechanismEffect } from './m8/s13-mechanisms';
import { modifier, stat } from './content/item-programs';
import { V19_MECHANICS } from './content/v19-mechanics';

export interface RebelCopy { readonly ownerId: string; readonly ordinal: number; readonly spawnedAtTick: number; readonly traits: readonly string[] }
export interface RebelSummon { readonly ownerId: string; readonly team: CombatUnit['team']; readonly tick: number; readonly eventSeq: number; readonly ordinal: number; readonly copyId: string | null }

/** Only this augment needs a birth to inherit the team's already-consumed trait pulse. */
export function recordBatch5RebelPulse(team: readonly S13Unit[], members: readonly S13Unit[], tick: number): void {
  if (team.some(u => u.mechanics?.some(m => m.mechanic === 'rebelResurgence')))
    for (const unit of members) unit.batch5RebelPulseAtTick = tick;
}

function inheritRebelPulse(ctx: AbilityContext, unit: S13Unit): void {
  const m = unit.mechanics?.find(m => m.mechanic === 'rebel');
  if (!m) return;
  const team = ctx.units.filter(u => u.team === unit.team && u.id !== unit.id);
  const forced = !!m.values.forcedPeriodTicks;
  const donors = forced ? team.filter(u => u.v19?.smokePermanent) : team.filter(u => u.batch5RebelPulseAtTick !== undefined);
  if (!donors.length) return;
  const pulseAt = forced ? Math.max(...donors.map(u => u.v19?.smokeOrdinal ?? 0)) * V19_MECHANICS.rebel10.periodTicks
    : Math.max(...donors.map(u => u.batch5RebelPulseAtTick!));
  if (forced) unit.v19 = {...unit.v19, smokePermanent: true, smokeOrdinal: Math.floor(pulseAt / V19_MECHANICS.rebel10.periodTicks)};
  else { g22(unit).rebelTriggered = true; unit.batch5RebelPulseAtTick = pulseAt; }
  const apply = (name: 'attackDamage' | 'abilityPower' | 'attackSpeed', value: number, bps = false, duration: number | null = null) =>
    executeMechanismEffect(ctx, unit, asSource(m.source), unit, stat(modifier(name, value, bps ? 'bps' : 'flat'), duration), 0, 0,
      undefined, undefined, undefined, undefined, {area: false, triggeringCastActionSeq: null, applicationId: `batch5-rebel-inherit:${name}`});
  apply('attackDamage', m.values.adApBps, true);
  apply('abilityPower', m.values.adApBps / 100);
  const remaining = pulseAt + m.values.durationTicks - ctx.tick;
  if (remaining > 0) apply('attackSpeed', m.values.attackSpeedBps, true, remaining);
  if (m.values.bonusHpBps) executeMechanismEffect(ctx, unit, asSource(m.source), unit,
    {kind: 'change-max-hp', bonusBps: m.values.bonusHpBps, currentHp: 'add-max-delta', countsAsHeal: false}, 0, 0);
}

/** Use the frozen original's effective tags, including emblems, without adding another trait count. */
export function rebelTraitIdentity<T extends Pick<CombatUnit, 'id' | 'definitionId' | 'team'> & { readonly rebelCopy?: RebelCopy }>(unit: T): Pick<CombatUnit, 'id' | 'definitionId' | 'team'> {
  return unit.rebelCopy ? { id: unit.rebelCopy.ownerId, definitionId: unit.definitionId, team: unit.team } : unit;
}

/** Recompile a fresh lower-star body from non-item/non-anomaly declarations, never mutable combat stats. */
export function createRebelCopy(holder: CombatUnit, m: CombatMechanic, ordinal: number, cell: HexCell, tick: number, traits?: readonly TraitSnapshot[]): CombatUnit {
  const id = JSON.stringify(['batch5-rebel-copy', holder.id, m.source.instanceId, ordinal]);
  const starLevel = Math.max(REBEL_COPY_RULES.minimumStar, (holder.effectiveStarLevel ?? holder.starLevel) - 1) as 1 | 2 | 3;
  const formCell = holder.startingCell ?? holder.cell;
  const sources = (holder.sources ?? []).filter(s => s.source.sourceKind !== 'item' && s.source.sourceKind !== 'anomaly').map(s => {
    const source = { ...s.source, ownerId: id, ...(s.source.sourceKind === 'ability' && s.source.sourceInstanceId === holder.id ? { sourceInstanceId: id } : {}) };
    return { ...s, source, key: effectKey(source) };
  });
  const base = g23FormStats(holder.definitionId, starLevel, holder.team, formCell.row);
  const resolved = resolveEffects(base, resolveAbility(base.abilityId, starLevel), sources);
  const mechanics = [...resolved.mechanics ?? [], ...(holder.mechanics ?? []).filter(m => m.source.sourceKind === 'ability').map(m => ({ ...m, source: { ...m.source, ownerId: id, instanceId: m.source.instanceId === holder.id ? id : m.source.instanceId } }))]
    .filter(m => m.mechanic !== 'rebelResurgence');
  const stats = resolved.stats;
  const unit: S13Unit = {
    ...compileCombatInitialInputs(id, stats, resolved.ability, { ...resolved, mechanics }),
    id, definitionId: holder.definitionId, team: holder.team, starLevel, ...(holder.form ? {form: holder.form} : {}),
    cell: {...cell}, startingCell: {...formCell},
    rebelCopy: { ownerId: holder.id, ordinal, spawnedAtTick: tick,
      traits: traits ? traits.filter(t => isTraitSnapshotMember(t, holder)).map(t => t.traitId) : [...UNIT_DEFINITIONS[holder.definitionId].traits] },
    equipment: [], attackDamage: stats.attack, attackRange: stats.attackRange, attackIntervalTicks: stats.attackIntervalTicks,
    attackDamageBase: resolved.attackDamageBase, attackDamagePercentBps: resolved.attackDamagePercentBps,
    baseAttackSpeedBps: stats.baseAttackSpeedBps ?? Math.floor(200000 / stats.attackIntervalTicks), attackSpeedBonusBps: stats.attackSpeedBonusBps ?? 0,
    armor: stats.armor, magicResist: stats.magicResist, cooldownTicks: 0, moveCooldownTicks: 0,
    ability: resolved.ability, sources: resolved.sources, triggers: resolved.triggers, effectRuntime: initializeEffectRuntime(resolved.triggers),
    mechanics, shield: 0, shieldExpiresAtTick: null, shieldLayers: [], statuses: [], tasks: [], runtime: {...EMPTY_RUNTIME}, alive: true, targetId: null,
    maxHpBasis: { base: base.health,
      flat: sources.reduce((n, s) => n + (s.effect.kind === 'statFlat' && s.effect.stat === 'maxHp' ? s.effect.amount : 0), 0) + (holder.ghostFriends?.healthFlat ?? 0),
      bps: sources.reduce((n, s) => n + (s.effect.kind === 'statPercentBps' && s.effect.stat === 'maxHp' ? s.effect.bps : 0), 0), bonusBps: 0 },
    ...(holder.ghostFriends ? { ghostFriends: {...holder.ghostFriends} } : {}),
  };
  const basis = unit.maxHpBasis!;
  unit.maxHp = scaleItemSummonHp(unit, Math.floor((basis.base + basis.flat) * (10000 + basis.bps) / 10000));
  unit.hp = unit.maxHp;
  return unit;
}

/** The first five original Rebel death events per team, including simultaneous deaths in event order.
 * Every consumed trigger is retained even if the board has no free cell; copies never recurse. */
export function summonRebelCopies(ctx: AbilityContext, state: CombatState, roster: S13Unit[], deaths: readonly CombatEvent[]): readonly RebelSummon[] | undefined {
  if (!state.batch5RebelSummons && !roster.some(u => u.mechanics?.some(m => m.mechanic === 'rebelResurgence'))) return undefined;
  let membership: CombatState = {...state, units: roster};
  const receipts = [...state.batch5RebelSummons ?? []], born: CombatUnit[] = [];
  for (const death of deaths) {
    if (death.type !== 'death') continue;
    const holder = roster.find(u => u.id === death.unitId);
    const m = holder?.mechanics?.find(m => m.mechanic === 'rebelResurgence');
    if (!holder || !m || holder.rebelCopy || holder.itemSummon || holder.anomalySummon || UNIT_DEFINITIONS[holder.definitionId]?.summon || holder.unitKind === 'neutral') continue;
    const member = state.strategy?.traits.find(t => t.traitId === 'rebel' && t.team === holder.team);
    if (!(member ? isTraitSnapshotMember(member, holder) : UNIT_DEFINITIONS[holder.definitionId]?.traits.includes('rebel'))) continue;
    const ordinal = receipts.filter(r => r.team === holder.team).length;
    if (ordinal >= m.values.count) continue;
    const free = Array.from({length: ctx.board.rows}, (_, row) => Array.from({length: ctx.board.columns}, (_, col) => ({col, row}))).flat()
      .filter(c => !membership.units.some(u => occupiesCell(u, ctx.tick) && u.cell.col === c.col && u.cell.row === c.row));
    const cell = nearestItemCell(holder.cell, free);
    const copy = cell ? createRebelCopy(holder, m, ordinal, cell, ctx.tick, state.strategy?.traits) : null;
    receipts.push({ownerId: holder.id, team: holder.team, tick: ctx.tick, eventSeq: (state.nextEventSeq ?? 0) + ctx.events.indexOf(death), ordinal, copyId: copy?.id ?? null});
    if (!copy) continue;
    const spawned = spawnCombatUnit(membership, copy, m.source, ctx.tick);
    membership = spawned.state; ctx.events.push(...spawned.events); born.push(copy);
  }
  for (const unit of born) { roster.push(unit as S13Unit); if (roster !== ctx.units) ctx.units.push(unit as S13Unit); }
  if (born.length) {
    initializeBornUnits(ctx, born);
    for (const unit of born) inheritRebelPulse(ctx, unit as S13Unit);
  }
  return receipts.length ? receipts : undefined;
}
