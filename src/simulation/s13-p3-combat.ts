import type { CombatUnit, CombatMechanic } from './combat-types';
import type { AbilityContext, S13Packet } from './combat-s13-abilities';
import type { S13Unit } from './combat-s13-state';
import { byDistance, enemies, spellCrit } from './combat-s13-state';
import { hexDistance } from './board';
import { executeMechanismEffect } from './m8/s13-mechanisms';
import { asSource } from './m8/s13-definitions';
import { resolveMana } from './m8/mana';
import { addCritChance, rollCrit } from './m8/crit';
import { burn } from './content/item-programs';
import { p3Stun, p3Values, p3ReflectionDamage } from './s13-p3-programs';
import type { DamageOutcome } from './m8/contracts';

export interface P3CombatState {
  readonly charged: boolean;
  readonly manaRemainder: number;
  readonly dragonTargets: readonly string[];
  readonly fireballs: readonly { readonly targetId: string; readonly actionSeq: number; readonly launchedAtTick: number; readonly pulse: number }[];
}
export function p3Mechanic(u: Pick<CombatUnit, 'mechanics'>, id: string): CombatMechanic | undefined {
  return u.mechanics?.find(m => m.mechanic === 's13P3' && m.source.definitionId === id);
}
function state(u: S13Unit): P3CombatState {
  return u.s13P3 ??= { charged: false, manaRemainder: 0, dragonTargets: [], fireballs: [] };
}
/** All burn providers enter applyFrozenStatus; Pyromaniac scales the shared outgoing burn packet once. */
export function p3BurnRaw(owner: S13Unit | undefined, packet: S13Packet): number {
  return packet.delivery === 'item-burn' && owner && p3Mechanic(owner, 'pyromaniac')
    ? Math.floor(packet.raw * (1 + p3Values('pyromaniac').BurnIncrease)) : packet.raw;
}
export function p3Cast(ctx: AbilityContext, u: S13Unit, target: S13Unit, seq: number, spent: number): void {
  if (p3Mechanic(u, 'knockout')) u.s13P3 = { ...state(u), charged: true };
  const m = p3Mechanic(u, 'fireball'); if (!m) return;
  const v = p3Values('fireball'), old = state(u), total = old.manaRemainder + spent;
  const shots = Math.floor(total / v.ManaSpent), added: P3CombatState['fireballs'][number][] = [];
  for (let shot = 0; shot < shots; shot++) for (const enemy of byDistance(target, enemies(u, ctx.units)).filter(e => hexDistance(target.cell, e.cell) <= v.HexRadius)) {
    // Fireball's 6% true DoT is separate from the ordinary 1% Burn + Wound. Both use the common damage pipeline.
    added.push({ targetId: enemy.id, actionSeq: seq, launchedAtTick: ctx.tick, pulse: 0 });
    const declared = u.mechanismDefinitions?.eventTriggers?.find(t => t.id === 'fireball-burn');
    burn(v.Duration * 20).forEach((effect, index) => executeMechanismEffect(ctx, u,
      asSource({ ...(declared?.source ?? m.source), effectIndex: (declared?.source.effectIndex ?? m.source.effectIndex) + index }), enemy, effect, seq, shot * 32 + index));
  }
  u.s13P3 = { ...old, manaRemainder: total % v.ManaSpent, fireballs: [...old.fireballs, ...added] };
}
export function advanceP3(ctx: AbilityContext): void {
  for (const u of ctx.units) {
    const m = p3Mechanic(u, 'fireball'); if (!m || !u.s13P3?.fireballs.length) continue;
    const pending: P3CombatState['fireballs'][number][] = [], v = p3Values('fireball');
    for (const [index, f] of u.s13P3.fireballs.entries()) {
      const target = ctx.units.find(t => t.id === f.targetId && t.alive && t.hp > 0); if (!target) continue;
      if (ctx.tick < f.launchedAtTick + (f.pulse + 1) * 20) { pending.push(f); continue; }
      ctx.packets.push({ source: m.source, targetId: target.id, actionSeq: f.actionSeq, ordinal: 10000 + index,
        raw: Math.floor(target.maxHp * Math.round(v.HPRatio * 10000) * (f.pulse + 1) / (10000 * v.Duration)) - Math.floor(target.maxHp * Math.round(v.HPRatio * 10000) * f.pulse / (10000 * v.Duration)), damageType: 'true',
        delivery: 'equipment-proc', critEligibility: 'never', critical: false, area: true, triggeringCastActionSeq: f.actionSeq });
      if (f.pulse + 1 < v.Duration) pending.push({ ...f, pulse: f.pulse + 1 });
    }
    u.s13P3 = { ...u.s13P3, fireballs: pending };
  }
}
/** Project the next-attack gate once for the entire attack action (including multi-target basic packets). */
export function p3Attack(ctx: AbilityContext, u: S13Unit, target: S13Unit, seq: number): boolean {
  const knockout = !!p3Mechanic(u, 'knockout') && state(u).charged;
  if (knockout) u.s13P3 = { ...state(u), charged: false };
  const dragon = p3Mechanic(u, 'dragonsoul');
  if (dragon && !state(u).dragonTargets.includes(target.id)) {
    u.s13P3 = { ...state(u), dragonTargets: [...state(u).dragonTargets, target.id] };
    ctx.packets.push({ source: dragon.source, targetId: target.id, actionSeq: seq, ordinal: 8000,
      raw: Math.floor(target.maxHp * Math.round(p3Values('dragonsoul').PercentHPDamage * 10000) / 10000), damageType: 'true',
      delivery: 'attack-extra', critEligibility: 'never', critical: false, area: false, triggeringCastActionSeq: null });
  }
  return knockout;
}
/** Shared critical authorization/true conversion boundary. No second resistance, shield or HP settlement. */
export function p3Roll(ctx: AbilityContext, u: S13Unit, packet: S13Packet, charged: boolean, shared?: boolean): boolean {
  const authorization = spellCrit(u), boosted = charged && packet.delivery === 'basic-attack';
  const boostedAuth = boosted ? addCritChance(authorization, Math.round(p3Values('knockout').BonusCrit * 10000)) : authorization;
  const critical = shared ?? rollCrit(packet.critEligibility, boostedAuth, ctx.draw);
  if (boosted) packet.critMultiplierBps = boostedAuth.multiplierBps;
  if (boosted) {
    // 项目约定：替换本次基础普攻为90%原始普攻真伤，非额外相加；先转换系数、后走统一暴击。
    packet.raw = Math.floor(packet.raw * Math.round(p3Values('knockout').TrueDamagePercent * 10000) / 10000);
    packet.damageType = 'true';
  }
  return critical;
}
/** One reflection guard shared by Bramble and Thornskin. Reflection never reflects another reflection. */
export function isP3Reflection(packet: Pick<S13Packet, 'source'>): boolean {
  return packet.source.definitionId === 'thornskin' || packet.source.definitionId === 'bramble-vest' || packet.source.definitionId === 'TFT5_Item_BrambleVestRadiant';
}
export function p3Reflect(ctx: AbilityContext, target: S13Unit, packet: S13Packet, blocked: number): void {
  const m = p3Mechanic(target, 'thornskin'); if (!m || blocked <= 0 || isP3Reflection(packet)) return;
  // 项目约定：仅护甲/魔抗与减伤阻止的量，不含护盾、伤害免疫、分摊或延期偿付。
  const raw = Math.floor(blocked * Math.round(p3Values('thornskin').DamagePercent * 10000) / 10000);
  if (raw <= 0) return;
  for (const [index, enemy] of byDistance(target, enemies(target, ctx.units)).filter(e => hexDistance(target.cell, e.cell) <= 1).entries())
    executeMechanismEffect(ctx, target, asSource(m.source), enemy, p3ReflectionDamage(raw), packet.actionSeq, 20000 + index,
      undefined, undefined, undefined, undefined, { area: true, triggeringCastActionSeq: null });
}
export function p3Damage(ctx: AbilityContext, owner: S13Unit | undefined, outcome: DamageOutcome): void {
  if (owner && outcome.context.source.definitionId === 'bramble-vest' && outcome.hpDamage > 0 && p3Mechanic(owner, 'thorn-plated-armor'))
    ctx.heals.push({ source: outcome.context.source, targetId: owner.id,
      amount: Math.floor(outcome.hpDamage * p3Values('thorn-plated-armor').Heal) });
}
/** Freeze before death cleanup clears mana and harmful statuses. */
export function settleP3Deaths(ctx: AbilityContext, fallen: readonly S13Unit[]): void {
  const frozen = fallen.map(u => ({ id: u.id, team: u.team, mana: u.mana, frost: (u.mechanismState?.statuses ?? [])
    .flatMap(g => g.contributions).filter(c => c.source.definitionId === 'touch-of-frost' && c.application.modifier?.stat === 'attackSpeed'
      && c.appliedAtTick <= ctx.tick && (c.expiresAtTick === null || c.expiresAtTick > ctx.tick)).map(c => c.source) }));
  for (const u of ctx.units.filter(u => u.alive && u.hp > 0)) {
    const m = p3Mechanic(u, 'nothing-wasted'); if (!m) continue;
    for (const dead of frozen.filter(d => d.team === u.team && d.id !== u.id)) {
      const amount = Math.floor(dead.mana * p3Values('nothing-wasted').ManaPercent);
      const outcome = resolveMana({ unitId: u.id, current: u.mana, maximum: u.maxMana, lockedUntilTick: u.manaLockedUntilTick ?? 0 },
        { source: asSource(m.source), targetId: u.id, amount, reason: 'periodic', bypassLock: 'none', castActionSeq: null }, ctx.tick);
      u.mana = outcome.after; ctx.events.push({ type: 'manaChanged', tick: ctx.tick, outcome });
    }
  }
  for (const dead of frozen) for (const source of dead.frost) {
    const owner = ctx.units.find(u => u.id === source.ownerId), corpse = ctx.units.find(u => u.id === dead.id)!;
    if (!owner) continue;
    const next = byDistance(corpse, ctx.units.filter(u => u.team === corpse.team && u.alive && u.hp > 0))[0];
    if (!next) continue;
    const declaration = owner.mechanismDefinitions?.eventTriggers?.find(t => t.id === 'frost-death');
    if (declaration) executeMechanismEffect(ctx, owner, declaration.source, next, p3Stun(), 0);
  }
}

export function validateP3State(u: CombatUnit, units: readonly CombatUnit[], tick: number, nextActionSeq: number): void {
  const s = u.s13P3;
  if (!s) {
    if (p3Mechanic(u,'fireball')&&(u.runtime?.castCount??0)>0 || p3Mechanic(u,'dragonsoul')&&(u.runtime?.attackCount??0)>0 || p3Mechanic(u,'knockout')&&((u.runtime?.attackCount??0)+(u.runtime?.castCount??0))>0) throw new RangeError('Missing S13 P3 combat state');
    return;
  }
  const check = (v: unknown) => { if (!v) throw new RangeError('Invalid S13 P3 combat state'); };
  check(['fireball','knockout','dragonsoul'].some(id=>p3Mechanic(u,id)));
  check(Object.keys(s).sort().join(',') === 'charged,dragonTargets,fireballs,manaRemainder');
  check(typeof s.charged === 'boolean' && (!s.charged || p3Mechanic(u, 'knockout') && (u.runtime?.castCount ?? 0) > 0));
  check(Number.isSafeInteger(s.manaRemainder) && s.manaRemainder >= 0 && s.manaRemainder < 70 && (!s.manaRemainder || p3Mechanic(u, 'fireball')));
  check(Array.isArray(s.dragonTargets) && new Set(s.dragonTargets).size === s.dragonTargets.length
    && s.dragonTargets.every(id => units.some(t => t.id === id && t.team !== u.team))
    && s.dragonTargets.length <= (u.runtime?.attackCount ?? 0) && (!s.dragonTargets.length || p3Mechanic(u, 'dragonsoul')));
  check(Array.isArray(s.fireballs) && s.fireballs.length <= units.length * (u.runtime?.castCount ?? 0) * 100
    && (!s.fireballs.length || p3Mechanic(u, 'fireball')));
  for (const f of s.fireballs) check(Object.keys(f).sort().join(',') === 'actionSeq,launchedAtTick,pulse,targetId'
    && units.some(t => t.id === f.targetId && t.team !== u.team) && Number.isSafeInteger(f.actionSeq) && f.actionSeq >= 0 && f.actionSeq < nextActionSeq
    && Number.isSafeInteger(f.launchedAtTick) && f.launchedAtTick > 0 && f.launchedAtTick <= tick
    && Number.isSafeInteger(f.pulse) && f.pulse >= 0 && f.pulse < 5
    && f.pulse === Math.min(4, Math.floor((tick - f.launchedAtTick) / 20)));
}
