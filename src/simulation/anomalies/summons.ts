import type { AbilityContext } from '../combat-s13-abilities';
import type { CombatOrigin } from '../combat-types';
import { byDistance, enemies, ad, applyStatus, EMPTY_RUNTIME, type S13Unit } from '../combat-s13-state';
import type { AnomalySummon } from './contracts';
import { nearestLanding, relocate } from './shared';
import { isPresent, isAttackProxy } from './availability';
import { isSelectable } from './availability';
import { P4_SOURCE } from './source';
import { nextRandom } from '../rng';
import { initializeMechanisms } from '../m8/s13-mechanisms';
import { compileCombatInitialInputs } from '../combat-initialization';
import { getUnitStats } from '../unit-stats';
import { resolveAbility } from '../combat-abilities';
import { freezeCombatDeclarations } from '../combat-static';

export { isAttackProxy } from './availability';
export function appendAnomalySummon(ctx: AbilityContext, owner: S13Unit, source: CombatOrigin,
  kind: AnomalySummon['kind'], ordinal: number, stats: { health: number; armor: number; magicResist: number; attack: number }): S13Unit | undefined {
  const id = JSON.stringify([owner.id, source.instanceId, 'anomaly', kind, ordinal]);
  if (ctx.units.some(u => u.id === id)) return;
  const proxy = kind !== 'crab', cell = proxy ? { ...owner.cell } : nearestLanding(ctx, owner.cell, id);
  if (!cell) return;
  const base = getUnitStats('s13-' + kind, 1), ability = resolveAbility(base.abilityId, 1);
  const unit: S13Unit = { ...compileCombatInitialInputs(id, base, ability), id, definitionId: 's13-' + kind, team: owner.team, starLevel: 1,
    cell, startingCell: { ...cell }, hp: stats.health, maxHp: stats.health,
    maxHpBasis: { base: stats.health, flat: 0, bps: 0, bonusBps: 0 },
    attackDamage: stats.attack, attackDamageBase: stats.attack, attackDamagePercentBps: 0,
    armor: stats.armor, magicResist: stats.magicResist, attackRange: 1,
    attackIntervalTicks: base.attackIntervalTicks, baseAttackSpeedBps: base.baseAttackSpeedBps, attackSpeedBonusBps: 0,
    cooldownTicks: 0, moveCooldownTicks: 0, mana: 0, maxMana: 0, shield: 0, shieldExpiresAtTick: null, ability,
    sources: [], triggers: [], effectRuntime: [], mechanics: [], shieldLayers: [], statuses: [], tasks: [],
    runtime: { ...EMPTY_RUNTIME }, alive: true, targetId: null,
    anomalySummon: { kind, ownerId: owner.id, ordinal, bornAtTick: ctx.tick, source },
  };
  freezeCombatDeclarations(unit, false, true);
  ctx.units.push(unit);
  initializeMechanisms({ ...ctx, units: [unit] });
  ctx.events.push({ type: 'unitSpawned', tick: ctx.tick, unitId: id, definitionId: unit.definitionId, team: unit.team, cell, source });
  return unit;
}
/** One scheduling boundary for owner-bound attack agents. No ordinary attack/cast/item hooks. */
export function scheduleAnomalyAttacks(ctx: AbilityContext, nextSeq: () => number): void {
  for (const proxy of ctx.units.filter(u => u.alive && isAttackProxy(u)).sort((a, b) => a.id < b.id ? -1 : 1)) {
    const origin = proxy.anomalySummon!, owner = ctx.units.find(u => u.id === origin.ownerId);
    if (!owner || !isPresent(owner, ctx.tick)) continue;
    relocate(ctx, proxy, owner.cell);
    if (origin.kind === 'mini') {
      const state = proxy.anomalyState!, due = (state.pendingAttacks ?? []).filter(t => t.executeAtTick <= ctx.tick);
      state.pendingAttacks = (state.pendingAttacks ?? []).filter(t => t.executeAtTick > ctx.tick);
      for (const task of due) {
        const target = ctx.units.find(u => u.id === task.targetId && u.team !== owner.team && isSelectable(u, ctx.tick));
        if (!target) continue; // Frozen target; never switch a projectile to another enemy.
        const draw = nextRandom(state.attackStream!.state); state.attackStream!.state = draw.state; state.attackStream!.draws++;
        proxy.runtime.attackCount++;
        ctx.packets.push({ source: { ...origin.source, ownerId: proxy.id, instanceId: proxy.id }, targetId: target.id,
          raw: task.raw, damageType: 'physical', delivery: 'attack-extra', critEligibility: 'never', critical: false,
          actionSeq: nextSeq(), rootActionSeq: task.rootActionSeq, ordinal: origin.ordinal, area: false, triggeringCastActionSeq: null });
      }
      continue;
    }
    proxy.attackDamage = Math.floor(ad(owner) * Math.round(P4_SOURCE.WolfFamiliars.values.PercentAD * 10000) / 10000);
    proxy.attackDamageBase = proxy.attackDamage;
    if (origin.kind !== 'wolf' || proxy.cooldownTicks > 0) continue;
    const eligible = enemies(owner, ctx.units), target = eligible.find(u => u.id === owner.targetId) ?? byDistance(owner, eligible)[0];
    if (!target) continue;
    const seq = nextSeq(), state = proxy.anomalyState ??= {};
    // Separate derived lcg32 stream, seeded before combat without touching the main stream.
    const stream = state.attackStream!; const draw = nextRandom(stream.state);
    stream.state = draw.state; stream.draws++;
    proxy.runtime.attackCount++; proxy.cooldownTicks = 20; proxy.targetId = target.id;
    ctx.events.push({ type: 'attack', tick: ctx.tick, attackerId: proxy.id, targetId: target.id });
    ctx.packets.push({ source: { ...origin.source, ownerId: proxy.id, instanceId: proxy.id }, targetId: target.id,
      raw: proxy.attackDamage, damageType: 'physical', delivery: 'basic-attack',
      critEligibility: 'never', critical: false, actionSeq: seq, ordinal: 0, area: false, triggeringCastActionSeq: null });
  }
}
export function recordAnomalyProxyHit(ctx: AbilityContext, proxy: S13Unit | undefined, target: S13Unit, seq: number): void {
  if (proxy?.anomalySummon?.kind !== 'mini' || (ctx.virtualHp?.get(target.id) ?? target.hp) <= 0) return;
  const source = { ...proxy.anomalySummon.source, ownerId: proxy.id, instanceId: proxy.id };
  applyStatus(target, source, 'resistanceFlat', -P4_SOURCE.DeftHands.values.ArmorReduction, 1201 - ctx.tick,
    ctx.tick, ctx.events, true, 'armor:' + JSON.stringify([seq, proxy.anomalySummon.ordinal, target.id]));
}
export function removeBoundAnomalySummons(ctx: AbilityContext, roster: readonly S13Unit[] = ctx.units): string[] {
  const removed: string[] = [];
  for (const unit of [...ctx.units].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)) {
    if (!isAttackProxy(unit)) continue;
    const owner = roster.find(u => u.id === unit.anomalySummon!.ownerId);
    if (owner?.alive && owner.hp > 0) continue;
    removed.push(unit.id); ctx.units.splice(ctx.units.indexOf(unit), 1);
    ctx.events.push({ type: 'unitRemoved', tick: ctx.tick, unitId: unit.id, reason: 'anomaly-owner-death' });
  }
  return removed;
}
export function seedAnomalyStream(seed: number, identity: string): { state: number; draws: number } {
  let state = (seed ^ 0x73313361) >>> 0;
  for (let i = 0; i < identity.length; i++) state = Math.imul(state ^ identity.charCodeAt(i), 16777619) >>> 0;
  return { state, draws: 0 };
}
