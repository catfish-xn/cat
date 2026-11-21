import { landMelDash } from './combat-six-cost';
import { executeSkillShot, launchShot, scheduleShot } from './ability-projectile';
import { DARIUS_SPIN_TICKS, LUX_SELF_SHIELD_TICKS, LUX_SHIELD_FLIGHT_TICKS } from './cast-windup';
import { castMadChemist, isMadChemist } from './augment-pool-batch5-r4';
import { CAST_WINDUP_TICKS } from './cast-windup';
import { batch2Rocket } from './augment-pool-batch2-combat';
import { executeV20Teamup } from './combat-v20-traits';
import { sixCostCast, sixCostAttack } from './combat-six-cost';
import { planG2Cast, planG2Attack, executeG2Task, executeV20Powder } from './combat-g2';
import { chooseRandomCenter, selectAbilityTargets, selectConeTargets } from './m8/targeting';
import { targetingEnvironment } from './m8/s13-targeting';
import { integer, safeNumber } from './m8/stats';
import { asSource, flatAmount } from './m8/s13-definitions';
import { executeMechanismEffect, executeShieldEnd } from './m8/s13-mechanisms';
import { landDragonsoul } from './s13-p3-combat';
import { knockAway } from './combat-displacement';
import { GLOVES_OFF } from './content/gloves-off';
import { hexDistance, type Board, type HexCell } from './board';
import type { CombatOrigin, CombatTask, CombatEvent } from './combat-types';
import { ad, amount, ap, applyStatus, byDistance, champion, compareOrigins, enemies, areaEnemies, grantShield, lowestAlly, mechanic, neighborsOf,
  origin, path, range, sourceKey, variable, heroLive, type S13Unit } from './combat-s13-state';
import type { CritEligibility, DamageDelivery, DamageInput, Amount, HealRequest } from './m8/contracts';
export interface PeriodicReference { taskKey: string; effectIndex: number; holderId: string }
export interface PacketStatusEffect { source: import('./m8/contracts').Source; effect: Extract<import('./m8/contracts').Effect, { kind: 'apply-status' }>; ordinal: number }
export interface S13Packet { locked?: import('./combat-s13').AttackerSide; sevikaChomp?: boolean; devour?:boolean; beforeDamage?: PacketStatusEffect[]; afterDamageControl?: PacketStatusEffect[]; parentPacketId?: string; rootActionSeq?: number; periodic?: PeriodicReference; onPositiveHpDamageHeal?: Amount; source: CombatOrigin; targetId: string; raw: number; damageType: 'physical' | 'magic' | 'true'; actionSeq: number;
  ordinal: number; critical?: boolean; critMultiplierBps?: number; bounce?: boolean; delivery: DamageDelivery; critEligibility: CritEligibility;
  area: boolean; triggeringCastActionSeq: number | null; inherited?: Extract<DamageInput, { stage: 'after-mitigation' }>['inherited'] }
export interface S13Heal { g22Shared?: boolean; lateAmount?: Amount; reactionKey?: string; source: CombatOrigin; targetId: string; amount: number; request?: HealRequest; periodic?: PeriodicReference }
export interface AbilityContext {
  /** Step-local copies of CombatState.departedUnits: removed units still named as an effect's source (effectSourceUnit). */
  departedUnits?: S13Unit[];
  /** The step's full roster while banished units are out of `units` (effectSourceUnit). */
  roster?: readonly S13Unit[];
  movementReservations?: Set<string>;
  ambessaRetreats?: { unitId: string; targetCell: HexCell }[];
  anomalySeed?: number;
  anomalyOpening?: readonly { id: string; health: number; attackDamage: number }[];
  resolutionFacts?: import('./m8/triggers').ResolutionFacts;
  nextTriggerEventSeq?: number;
  virtualHp?: ReadonlyMap<string, number>;
  castReceipts?: import('./m8/contracts').CastReceipt[];
  /** Set by an ability's own branch choice while its cast resolves; copied onto that cast's receipt as output only. */
  castBranch?: string;
  manaRequests?: import('./m8/contracts').ManaRequest[];
  /** Current resolved armor/MR; Scuttle may exclude only Shred/Sunder while retaining other modifiers. */
  defenses?: (unit: S13Unit, armor: boolean, ignoreShredSunder?: boolean) => number;
  /** Set while a ranged hero's attack (actionSeq seq) is planned: its on-hit statuses wait for the shot to land. */
  attackLanding?: { readonly seq: number; readonly attackerId: string; readonly effects: { readonly targetId: string; readonly effect: import('./combat-types').AttackLandingEffect }[] };
  tick: number; combatId?: string; board: Board; units: S13Unit[]; events: CombatEvent[]; packets: S13Packet[]; heals: S13Heal[];
  draw: () => number;
}
function packet(ctx: AbilityContext, unit: S13Unit, target: S13Unit, raw: number, type: 'physical' | 'magic', seq: number,
  ordinal = 0, bounce = false, area = false, triggeringCastActionSeq: number | null = seq): void {
  ctx.packets.push({ source: origin(unit), targetId: target.id, raw, damageType: type, actionSeq: seq, ordinal,
    delivery: 'ability-direct', critEligibility: 'requires-spell-authorization', area, triggeringCastActionSeq, ...(bounce ? { bounce } : {}) });
}
function addTask(unit: S13Unit, kind: CombatTask['kind'], at: number, targetId: string | null, value: number, seq: number,
  ordinal = 0, total = 1, cancellable = false): void {
  unit.tasks.push({ key: `${unit.id}:${seq}:${kind}:${ordinal}`, kind, source: origin(unit), executeAtTick: at, targetId,
    amount: value, ordinal, total, cancellable, actionSeq: seq, ...(kind === 'ireliaEnd' ? { shieldEndKey: sourceKey(origin(unit)) } : {}), ...(kind === 'bleed' ? { attachedDot: true } : {}) });
}
function replaceEndTask(unit: S13Unit, kind: CombatTask['kind'], at: number, value: number, seq: number): void {
  unit.tasks = unit.tasks.filter(t => t.kind !== kind); addTask(unit, kind, at, null, value, seq);
}
export function planS13Cast(ctx: AbilityContext, unit: S13Unit, target: S13Unit, seq: number): string[] {
  if (isMadChemist(unit)) return castMadChemist(ctx, unit);
  if(unit.definitionId==='carry-golem'||unit.definitionId==='trainer-golem'||unit.definitionId==='augment-golem'){packet(ctx,unit,target,amount(unit,ctx.tick,{ap:variable(unit,'Damage')}),'magic',seq);return [target.id];}
  const six=sixCostCast(ctx,unit,target,seq);if(six)return six;
  const { tick, units, events } = ctx, source = origin(unit), v = (key: string, fallback = 0) => variable(unit, key, fallback);
  const mag = (key: string) => amount(unit, tick, { ap: v(key) });
  const physical = (key: string, apKey?: string) => amount(unit, tick, { ad: v(key), ap: apKey ? v(apKey) : 0 });
  const duration = (key: string, fallback = 4) => Math.round(v(key, fallback) * 20);
  const targets: string[] = [];
  const hit = (enemy: S13Unit, value: number, type: 'physical' | 'magic' = 'magic', bounce = false) => {
    packet(ctx, unit, enemy, value, type, seq, targets.length, bounce,
      ['darius', 'urgot', 'rell', 'scar', 'ezreal', 'garen'].includes(champion(unit))); targets.push(enemy.id);
  };
  const shield = (ally: S13Unit, value: number, ticks: number, decay = false) => {
    grantShield(ally, source, value, tick + ticks, tick, events, decay); targets.push(ally.id);
  };
  switch (champion(unit)) {
    case 'irelia': {
      const hero = heroLive(unit);
      if (hero) {
        // Blade Dance (P): dash to the farthest enemy within DashRange (other than the target), then back to the target;
        // each dash deals DashAd × AD + DashAp × AP physical. No position change is simulated.
        const far = byDistance(unit, enemies(unit, units), true).find(x => x.id !== target.id && hexDistance(unit.cell, x.cell) <= hero.dashRange) ?? target;
        const dash = amount(unit, tick, { ad: hero.dashAd / 10000, ap: hero.dashAp });
        hit(far, dash, 'physical'); hit(target, dash, 'physical'); break;
      }
      const ticks = duration('ShieldDuration', 3); shield(unit, mag('ShieldHealth'), ticks, true);
      const layer = unit.shieldLayers.find(l => l.key === sourceKey(source))!;
      unit.shieldLayers = unit.shieldLayers.map(l => l !== layer ? l : { ...l, m8Grant: { ...l.m8Grant!, onEnd: ['depleted', 'expired'],
        endTargeting: { kind: 'select', selector: { primary: 'normal', candidates: 'board', relation: 'enemy', anchor: 'holder', radius: 1, maxTargets: 100, excludeSelf: true, excludePrimary: false, distinct: true, order: 'id', sample: 'action-completion' } },
        endEffects: [{ kind: 'damage', damageType: 'magic', delivery: 'ability-direct', critEligibility: 'requires-spell-authorization', amount: flatAmount(mag('StrikeBaseDamage'), { shieldAbsorbedBps: Math.round(v('PercentShieldDamage', .3) * 10000), sample: 'packet' }) }] } });
      replaceEndTask(unit, 'ireliaEnd', tick + ticks, mag('StrikeBaseDamage'), seq); break;
    }
    case 'maddie': {
      const far = byDistance(unit, enemies(unit, units), true)[0];
      if (!far) break;
      const shots = [0, 4, 9, 13, 18, 23];
      // Landing batch (11-20): each shot leaves on its offset and settles where it lands (ability-projectile.ts).
      shots.forEach((offset, n) => scheduleShot(unit, 'maddie-shot', tick + offset, far.id, physical('PercentAttackDamage', 'APDamage'), seq, n, shots.length, true));
      applyStatus(unit, source, 'channel', 0, 24, tick, events, true, '', seq); targets.push(far.id); break;
    }
    case 'darius': {
      // Landing batch (11-20): the spin's damage, heal and bleed land DARIUS_SPIN_TICKS after the cast (g2Landing); who is hit
      // and every amount are taken now. Ordinals 0..k-1 are the neighbours' damage, k the heal, k+1 the bleed on the target.
      const around = neighborsOf(unit, units), at = tick + DARIUS_SPIN_TICKS, total = around.length + 2;
      around.forEach((enemy, n) => { addTask(unit, 'g2Landing', at, enemy.id, physical('PercentAttackDamage'), seq, n, total); targets.push(enemy.id); });
      addTask(unit, 'g2Landing', at, unit.id, mag('Heal'), seq, around.length, total);
      addTask(unit, 'g2Landing', at, target.id, physical('BleedPercentAttackDamage'), seq, around.length + 1, total); break;
    }
    case 'lux': {
      // Landing batch (11-20): an ally's shield lands when the bent missile arrives (abilityProjectile 'lux-shield'); her own,
      // LUX_SELF_SHIELD_TICKS after the cast (g2Landing, no projectile). The amount is taken now.
      const ally = lowestAlly(unit, units, true)!; targets.push(ally.id);
      if (ally.id === unit.id) addTask(unit, 'g2Landing', tick + LUX_SELF_SHIELD_TICKS, unit.id, mag('Shield'), seq, 0, 1);
      else launchShot(ctx, unit, { key: '', kind: 'skillShot', source, executeAtTick: tick, targetId: ally.id, amount: mag('Shield'), ordinal: 0, total: 1,
        cancellable: false, actionSeq: seq, shot: { skill: 'lux-shield' } }, ally.id, tick + LUX_SHIELD_FLIGHT_TICKS);
      unit.runtime.nextAttackMagic = mag('Damage'); break;
    }
    case 'zyra': {
      // The vines land CAST_WINDUP_TICKS later (g2Landing; ordinal 0 is the target, stunned); targets and amounts are taken now.
      const vines = [target, ...byDistance(unit, enemies(unit, units).filter(u => u.id !== target.id)).slice(0, v('NumSmallerVines', 2))];
      vines.forEach((enemy, n) => { addTask(unit, 'g2Landing', tick + CAST_WINDUP_TICKS.zyra, enemy.id, mag(n === 0 ? 'TargetDamage' : 'AOEDamage'), seq, n, vines.length); targets.push(enemy.id); });
      break;
    }
    case 'tristana':
      // The shell lands CAST_WINDUP_TICKS later (g2Landing, wind-up batch 2); its target and amount are taken now.
      addTask(unit, 'g2Landing', tick + CAST_WINDUP_TICKS.tristana, target.id, physical('PercentAttackDamage', 'APDamage'), seq, 0, 1);
      targets.push(target.id); break;
    case 'urgot': {
      for (const enemy of areaEnemies(unit, units).filter(u => hexDistance(target.cell, u.cell) <= 1)) {
        hit(enemy, physical(enemy.id === target.id ? 'PrimaryDamage' : 'SecondaryDamage', 'APDamage'), 'physical');
        applyStatus(enemy, source, 'armorReduction', 2000, duration('Duration', 6), tick, events);
      } break;
    }
    case 'rell': {
      shield(unit, mag('Shield'), duration('ShieldDuration'));
      const cells = path(ctx.board, unit.cell, target.cell);
      const hitUnits = areaEnemies(unit, units).filter(u => cells.some(c => c.col === u.cell.col && c.row === u.cell.row));
      const steal = v('DefensesSteal');
      for (const enemy of hitUnits) {
        hit(enemy, mag('StabDamage'));
        applyStatus(enemy, source, 'resistanceFlat', -steal, 1200, tick, events, false, JSON.stringify([seq, enemy.id]));
        applyStatus(unit, source, 'resistanceFlat', steal, 1200, tick, events, false, JSON.stringify([seq, enemy.id]));
      } break;
    }
    case 'leona': {
      const ticks = duration('Duration', 3);
      applyStatus(unit, source, 'damageReduction', Math.min(10000, Math.round(v('DR') * ap(unit, tick) * 100)), ticks, tick, events, true);
      replaceEndTask(unit, 'leonaEnd', tick + ticks, mag('Damage'), seq); break;
    }
    case 'vander': {
      const hero = heroLive(unit), ticks = hero ? GLOVES_OFF.castTicks : duration('TauntDuration', 2.5);
      applyStatus(unit, source, 'channel', 0, ticks, tick, events, true, '', seq);
      // 卯足全力 (content/gloves-off.ts): a 0.5 s cast with no resists instead of the 2.5 s brace; DamageBps × PercentAttackDamage,
      // and the empowered attack knocks the target back and splashes SplashBps to every enemy it hits.
      if (!hero) applyStatus(unit, source, 'resistanceFlat', mag('Resists'), ticks, tick, events, true);
      unit.runtime.nextAttackPhysical = amount(unit, tick, { ad: v('PercentAttackDamage') * (hero?.damageBps ?? 10000) / 10000 + v('BonusDamageADRatio') * mechanic(unit, 'lowCostAllies', 'count') });
      if (hero) unit.batch2 = { ...unit.batch2, primeSplash: true };
      targets.push(unit.id); break;
    }
    case 'kogmaw': {
      const speedBefore = unit.runtime.attackSpeedBps, rangeBefore = range(unit);
      unit.runtime.attackSpeedBps += Math.round(v('AttackSpeed', .25) * 10000);
      if (unit.runtime.castCount % v('RangeIncreaseNumAttacks', 3) === 0) unit.runtime.rangeBonus++;
      events.push({ type: 'statChanged', tick, unitId: unit.id, source: asSource(source), stat: 'attackSpeed', before: speedBefore, after: unit.runtime.attackSpeedBps });
      if (rangeBefore !== range(unit)) events.push({ type: 'statChanged', tick, unitId: unit.id, source: asSource(source),
        stat: 'range', before: rangeBefore, after: range(unit) });
      targets.push(unit.id); break;
    }
    case 'scar': {
      for (const enemy of byDistance(unit, enemies(unit, units)).slice(0, v('NumEnemies', 3))) {
        hit(enemy, mag('Damage')); applyStatus(enemy, source, 'stun', 0, duration('StunDuration', 1.5), tick, events);
      }
      ctx.heals.push({ source, targetId: unit.id, amount: mag('Heal') }); break;
    }
    case 'ezreal': {
      for (const enemy of areaEnemies(unit, units).filter(u => hexDistance(target.cell, u.cell) <= 1)) hit(enemy, physical('PercentAttackDamage', 'APDamage'), 'physical');
      hit(target, physical('PercentCenterDamage'), 'physical'); break;
    }
    case 'loris': {
      const ticks = duration('Duration'); shield(unit, mag('Shield'), ticks);
      applyStatus(unit, source, 'redirect', Math.round(v('PercentDamageRedirect', .5) * 10000), ticks, tick, events, true, '', seq);
      replaceEndTask(unit, 'lorisEnd', tick + ticks, mag('Damage'), seq); break;
    }
    case 'nami': {
      let current = target; const seen = new Set<string>();
      for (let n = 0; n <= v('NumBounces', 3); n++) {
        hit(current, mag('Damage')); seen.add(current.id);
        const next = byDistance(current, enemies(unit, units).filter(u => !seen.has(u.id) && hexDistance(current.cell, u.cell) <= v('SearchRange', 3)))[0];
        if (!next) break; current = next;
      } break;
    }
    case 'corki': {
      const total = v('BaseMissiles', 21);
      for (let n = 0; n < total; n++) {
        const mult = (n + 1) % v('SpecialMissileNum', 7) === 0 ? v('SpecialMissileMult', 7) : 1;
        addTask(unit, 'corki', tick + n, target.id,
          amount(unit, tick, { ad: v('PercentAD') * mult, flat: v('FlatDamagePerMissile') * mult }), seq, n, total, true);
      }
      applyStatus(unit, source, 'channel', 0, total, tick, events, true, '', seq); targets.push(target.id); break;
    }
    case 'garen': {
      shield(unit, amount(unit, tick, { ap: v('APShield'), hp: v('PercentHealthShield') }), duration('ShieldDuration'));
      for (const enemy of areaEnemies(unit, units).filter(u => hexDistance(target.cell, u.cell) <= 2)) hit(enemy,
        physical(enemy.id === target.id ? 'ADRatio' : 'SecondaryADRatio'), 'physical');
      break;
    }
    case 'zoe': {
      hit(target, mag('Damage')); const seen = new Set([target.id]);
      for (let n = 0; n < v('NumRepeats', 2); n++) {
        const next = byDistance(target, enemies(unit, units).filter(u => !seen.has(u.id) && hexDistance(target.cell, u.cell) <= v('HexLimiter', 4)), true)[0];
        if (!next) break;
        hit(next, mag('Damage')); seen.add(next.id); hit(target, mag('Damage'));
      } break;
    }
    default: return planG2Cast(ctx, unit, target, seq);
    case 'caitlyn': {
      const total = v('TotalShots', 4), ticks = duration('RaidDuration', 5);
      for (let n = 0; n < total; n++) addTask(unit, 'caitlyn', tick + Math.floor(n * ticks / total), null,
        physical('PercentAttackDamage', 'APDamage'), seq, n, total, true);
      applyStatus(unit, source, 'channel', 0, ticks, tick, events, true, '', seq); targets.push(target.id); break;
    }
  }
  return targets;
}
/** A ranged hero's shot lands (ranged attack landing): if its target still lives its packets (crits rolled on the attack) join this
 * tick's queue and its on-hit statuses apply; a target that died in flight takes nothing and no other one is picked. */
function landAttack(ctx: AbilityContext, unit: S13Unit, task: CombatTask): void {
  // A target that died while the shot flew (voided on its death, even if revived since) takes nothing.
  const target = task.landing!.voided ? undefined : ctx.units.find(u => u.id === task.targetId && u.alive && u.hp > 0);
  ctx.events.push({ type: 'attackLanded', tick: ctx.tick, attackerId: unit.id, targetId: task.targetId!, hit: !!target });
  if (!target) return;
  for (const packet of task.landing!.packets) {
    if (packet.source.ownerId !== unit.id) throw new RangeError('attack landing packet owner');
    if (landDragonsoul(unit, packet)) ctx.packets.push(structuredClone(packet));
  }
  for (const e of task.landing!.effects) {
    const holder = ctx.units.find(u => u.id === e.holderId);
    if (holder) executeMechanismEffect(ctx, holder, e.source, target, e.effect, task.actionSeq, e.ordinal);
  }
}
export function executeTask(ctx: AbilityContext, unit: S13Unit, task: CombatTask): void {
  if(task.kind==='attackLanding'){landAttack(ctx,unit,task);return;}
  if(task.kind==='v20Powder'){executeV20Powder(ctx,unit,task);return;}
  if(task.kind==='v20Teamup'){executeV20Teamup(ctx,unit,task);return;}
  if (task.kind.startsWith('g2')) { executeG2Task(ctx, unit, task); return; }
  if (task.kind === 'skillShot') { executeSkillShot(ctx, unit, task); return; }
  if (task.kind === 'melDash') { landMelDash(ctx, unit, task); return; }
  if (task.kind === 'tristanaBounce' && !task.inherited) throw new RangeError('Missing inherited Tristana receipt');
  const opponents = enemies(unit, ctx.units), target = (task.attachedDot || task.inherited ? areaEnemies(unit, ctx.units) : opponents).find(u => u.id === task.targetId);
  const emit = (u: S13Unit, value: number, type: 'physical' | 'magic' = 'physical', ordinal = task.ordinal) => {
    ctx.packets.push({ source: task.source, targetId: u.id, raw: value, damageType: type, actionSeq: task.actionSeq, ordinal,
      delivery: task.kind === 'bleed' ? 'ability-periodic' : 'ability-direct',
      critEligibility: task.kind === 'tristanaBounce' ? 'never' : 'requires-spell-authorization',
      area: ['caitlyn', 'ireliaEnd', 'leonaEnd', 'lorisEnd'].includes(task.kind),
      triggeringCastActionSeq: task.actionSeq,
      ...(task.kind === 'tristanaBounce' ? { inherited: task.inherited } : {}) });
  };
  switch (task.kind) {
    case 'bleed': if (target) emit(target, task.amount); break;
    case 'tristanaBounce': if (target) emit(target, task.amount); break;
    case 'maddie': {
      const aim = target ?? byDistance(unit, opponents, true)[0]; if (!aim) break;
      const line = path(ctx.board, unit.cell, aim.cell);
      const intercepted = line.map(c => opponents.find(u => u.cell.col === c.col && u.cell.row === c.row)).find(Boolean);
      if (intercepted) emit(intercepted, task.amount); break;
    }
    case 'corki': {
      const aim = target ?? byDistance(unit, opponents)[0]; if (!aim) break;
      const choices = [aim, ...opponents.filter(u => u.id !== aim.id && hexDistance(u.cell, aim.cell) <= 2).sort((a, b) => a.id < b.id ? -1 : 1)];
      const hit = choices[task.ordinal % choices.length]; emit(hit, task.amount);
      const shred = variable(unit, 'FlatArmorShred', 1) * ((task.ordinal + 1) % 7 === 0 ? 7 : 1);
      applyStatus(hit, task.source, 'resistanceFlat', -shred, 1200, ctx.tick, ctx.events, false, `armor:${task.actionSeq}:${task.ordinal}`); break;
    }
    case 'caitlyn': {
      if (opponents.length === 0) break;
      const env = targetingEnvironment(ctx.board, ctx.units, unit, ctx.tick);
      const centerId = chooseRandomCenter(env, ctx.draw);
      const selected = selectAbilityTargets({ kind: 'random-enemy-center', areaOrder: 'id', radius: 1, rng: 'combat', mapping: 'word-modulo-id-sorted-count', draws: 1 }, { ...env, randomCenterId: centerId });
      const center = ctx.units.find(u => u.id === selected.centerId)!;
      for (const id of selected.targetIds) emit(ctx.units.find(u => u.id === id)!, task.amount, 'physical', task.ordinal * 100);
      emit(center, amount(unit, ctx.tick, { ad: variable(unit, 'HeadshotPercentAD') }), 'physical', task.ordinal * 100 + 1);
      applyStatus(center, task.source, 'resistanceFlat', -variable(unit, 'ResistReduction', 20), 1200, ctx.tick, ctx.events, false, `${task.actionSeq}:${task.ordinal}`); break;
    }
    case 'ireliaEnd': executeShieldEnd(ctx, unit, task.shieldEndKey ?? sourceKey(task.source), task.actionSeq, { area: true, triggeringCastActionSeq: task.actionSeq }); break;
    case 'leonaEnd': for (const enemy of neighborsOf(unit, ctx.units)) emit(enemy, task.amount, 'magic'); break;
    case 'lorisEnd': {
      const center = byDistance(unit, opponents)[0]; if (!center) break;
      for (const enemy of areaEnemies(unit, ctx.units).filter(u => hexDistance(center.cell, u.cell) <= 1)) emit(enemy, task.amount, 'magic'); break;
    }
  }
}
export function planS13Attack(ctx: AbilityContext, unit: S13Unit, target: S13Unit, seq: number): void {
  if(sixCostAttack(ctx,unit,target,seq))return;
  const replacement = planG2Attack(ctx, unit, target, seq);
  const source = { ...origin(unit), sourceKind: 'attack' as const }, base = unit.runtime.nextAttackPhysical || ad(unit);
  if (!replacement) ctx.packets.push({ source, targetId: target.id, raw: base, damageType: 'physical',
    actionSeq: seq, ordinal: 0, delivery: 'basic-attack', critEligibility: 'basic', area: false, triggeringCastActionSeq: null });
  if (unit.attackCone) {
    const ids = selectConeTargets(targetingEnvironment(ctx.board, ctx.units, unit, ctx.tick, { primaryId: target.id }));
    const raw = safeNumber(integer(base) * integer(unit.attackCone.secondaryDamageBps) / 10000n);
    for (const [index, id] of ids.entries()) ctx.packets.push({ source: origin(unit), targetId: id, raw, damageType: 'physical', actionSeq: seq, rootActionSeq: seq, parentPacketId: JSON.stringify([ctx.combatId ?? 'standalone', ctx.tick, unit.id, seq, target.id, 0]), ordinal: 100 + index, delivery: 'ability-direct', critEligibility: 'never', area: true, triggeringCastActionSeq: null });
  }
  const prime = heroLive(unit);
  if (prime?.splashBps && unit.batch2?.primeSplash && unit.runtime.nextAttackPhysical > 0) {
    // The punch sends the target flying (stunned for the flight) and it hits every other enemy next to a cell it passes.
    const passed = knockAway(ctx, unit, target, GLOVES_OFF.knockbackHexes, 'vander-knockback');
    applyStatus(target, origin(unit), 'stun', 0, GLOVES_OFF.stunTicks, ctx.tick, ctx.events);
    for (const [index, enemy] of enemies(unit, ctx.units).filter(x => x.id !== target.id && passed.some(cell => hexDistance(x.cell, cell) <= 1)).sort((a, b) => a.id < b.id ? -1 : 1).entries())
      ctx.packets.push({ source: origin(unit), targetId: enemy.id, raw: Math.floor(base * prime.splashBps / 10000), damageType: 'physical', actionSeq: seq, ordinal: 300 + index, delivery: 'attack-extra', critEligibility: 'never', area: true, triggeringCastActionSeq: null });
    unit.batch2 = { ...unit.batch2, primeSplash: false };
  }
  unit.runtime.nextAttackPhysical = 0;
  if (unit.runtime.nextAttackMagic > 0) {
    packet(ctx, unit, target, unit.runtime.nextAttackMagic, 'magic', seq, 1, false, false, null); unit.runtime.nextAttackMagic = 0;
  }
  if (champion(unit) === 'kogmaw') packet(ctx, unit, target, amount(unit, ctx.tick, { ap: variable(unit, 'DamageOnAttack') }), 'magic', seq, 2, false, false, null);
  let ordinal = 3;
  for (const effect of [...unit.mechanics ?? []].sort((a, b) => compareOrigins(a.source, b.source))) {
    if ((effect.mechanic === 'artillery' && unit.runtime.attackCount % (effect.values.everyN ?? 5) === 0) || effect.mechanic === 'titanic') {
      const bps = effect.values.adBps ?? (effect.mechanic === 'artillery' ? 12500 : 4000);
      const rocketRaw=effect.mechanic==='artillery'?batch2Rocket(unit,Math.floor(ad(unit)*bps/10000)):Math.floor(ad(unit)*bps/10000);
      for (const enemy of areaEnemies(unit, ctx.units).filter(u => hexDistance(target.cell, u.cell) <= 1))
        ctx.packets.push({ source: effect.source, targetId: enemy.id, raw: rocketRaw, damageType: 'physical', actionSeq: seq, ordinal: ordinal++,
          delivery: 'attack-extra', critEligibility: 'never', area: true, triggeringCastActionSeq: null });
    }
  }
}
