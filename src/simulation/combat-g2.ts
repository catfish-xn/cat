import { batch2AutomataBlast } from './augment-pool-batch2-combat';
import { detonateMenaces, teamup } from './combat-v20-traits';
import { canMove } from './combat-movement';
import { occupiesCell } from './anomalies/availability';
import { isAttackProxy } from './anomalies/availability';
import { planG23Cast, executeG23Task } from './combat-g2-3';
import { planG22Cast, planG22Attack, executeG22Task } from './combat-g2-2';
/** G2 finite skill extensions. All state is detached Combat JSON; source coefficients stay in abilities.ts. */
import { hexDistance } from './board';
import type { CombatTask, ExpansionState } from './combat-types';
import type { AbilityContext, S13Packet } from './combat-s13-abilities';
import { amount, ap, applyStatus, areaEnemies, byDistance, champion, compareText, enemies, grantShield, mechanic, origin, path, variable, type S13Unit } from './combat-s13-state';
import { asSource } from './m8/s13-definitions';
import { executeMechanismEffect, executeOverTimeTask } from './m8/s13-mechanisms';
import { burn, modifier, stat, status } from './content/item-programs';

export const EMPTY_EXPANSION: ExpansionState = { damageDealt: 0, damageTaken: 0, crystals: 0, crystalDamage: 0,
  attacksRemaining: 0, buffUntilTick: 0, lastRetaliationTick: 0, chainUntilTick: 0, chainTargets: [], chainCastSeq: 0, chainKills: 0 };
export function expansion(unit: S13Unit): ExpansionState { return unit.expansion ??= structuredClone(EMPTY_EXPANSION); }
function hit(ctx: AbilityContext, unit: S13Unit, target: S13Unit, raw: number, seq: number, ordinal: number,
  type: S13Packet['damageType'] = 'magic', area = false, source = origin(unit), derived = false): void {
  ctx.packets.push({ source, targetId: target.id, raw, damageType: type, actionSeq: seq, ordinal,
    delivery: derived ? 'attack-extra' : 'ability-direct', critEligibility: derived ? 'never' : 'requires-spell-authorization', area, triggeringCastActionSeq: derived ? null : seq });
}
function task(unit: S13Unit, kind: CombatTask['kind'], at: number, targetId: string | null, value: number,
  seq: number, ordinal = 0, total = 1, source = origin(unit)): void {
  unit.tasks.push({ key: JSON.stringify([unit.id, seq, kind, targetId, ordinal, source.instanceId, at, unit.tasks.length]), kind, source,
    executeAtTick: at, targetId, amount: value, actionSeq: seq, ordinal, total, cancellable: false,
    ...(['g2Infection', 'bleed'].includes(kind) ? { attachedDot: true } : {}) });
}
function effect(ctx: AbilityContext, unit: S13Unit, target: S13Unit, e: Parameters<typeof executeMechanismEffect>[4], seq: number): void {
  executeMechanismEffect(ctx, unit, asSource(origin(unit)), target, e, seq);
}
function ignite(ctx: AbilityContext, unit: S13Unit, target: S13Unit, ticks: number, seq: number): void {
  for (const e of burn(ticks)) effect(ctx, unit, target, e, seq);
}
export function planG2Cast(ctx: AbilityContext, unit: S13Unit, target: S13Unit, seq: number): string[] {
  const v = (k: string) => variable(unit, k), mag = (k: string) => amount(unit, ctx.tick, { ap: v(k) });
  const ticks = (k: string) => Math.round(v(k) * 20), ids: string[] = [];
  const strike = (t: S13Unit, raw: number, type: S13Packet['damageType'] = 'magic', area = false) => { hit(ctx, unit, t, raw, seq, ids.length, type, area); ids.push(t.id); };
  switch (champion(unit)) {
    case 'vladimir':
      ctx.heals.push({ source: origin(unit), targetId: unit.id, amount: mag('Heal') }); strike(target, mag('Damage')); break;
    case 'singed': {
      applyStatus(unit, origin(unit), 'damageReduction', Math.min(10000, Math.round(v('DR') * ap(unit, ctx.tick) * 100)), ticks('Duration'), ctx.tick, ctx.events, true);
      const ally = ctx.units.filter(u => u.alive && !isAttackProxy(u) && u.team === unit.team).sort((a, b) => (b.expansion?.damageDealt ?? 0) - (a.expansion?.damageDealt ?? 0) || (a.id < b.id ? -1 : 1))[0];
      if (ally) {
        applyStatus(ally, origin(unit), 'attackSpeed', Math.round(v('AttackSpeed') * 100), 1, ctx.tick, ctx.events, true);
        task(unit, 'g2SingedSpeed', ctx.tick + 1, ally.id, Math.round(v('AttackSpeed') * 100), seq, 1, ticks('Duration'));
        ids.push(ally.id);
      } break;
    }
    case 'twitch': {
      expansion(unit).attacksRemaining = v('TotalAttacks'); ids.push(unit.id); break;
    }
    case 'nocturne': expansion(unit).buffUntilTick = ctx.tick + ticks('Duration'); ids.push(unit.id); break;
    case 'illaoi': {
      applyStatus(unit, origin(unit), 'damageReduction', Math.round(v('DR') * 10000), ticks('SpellDuration'), ctx.tick, ctx.events, true);
      for (let n = 1; n <= v('SpellDuration'); n++) task(unit, 'g2Drain', ctx.tick + n * 20, null, mag('HealthSteal'), seq, n - 1, v('SpellDuration'));
      task(unit, 'g2Slam', ctx.tick + ticks('SpellDuration'), null, Math.floor((unit.armor + unit.magicResist) * v('DamageResistRatio')), seq);
      ids.push(unit.id); break;
    }
    case 'leblanc': {
      const targets = byDistance(unit, enemies(unit, ctx.units)).slice(0, v('ChainTargets'));
      const total = mag('Damage'), state = expansion(unit);
      state.chainCastSeq = seq; state.chainKills = 0; state.chainTargets = targets.map(t => t.id); state.chainUntilTick = ctx.tick + ticks('ChainDuration'); state.attacksRemaining = v('NumAttacks');
      targets.forEach((t, n) => strike(t, Math.floor(total / targets.length) + (n < total % targets.length ? 1 : 0)));
      break;
    }
    case 'rumble': {
      const foes = enemies(unit, ctx.units), row = foes.filter(u => u.cell.row === target.cell.row).sort((a, b) => a.cell.col - b.cell.col || (a.id < b.id ? -1 : 1));
      for (let n = 0; n < v('NumMissile'); n++) {
        const victim = foes.length === 1 ? foes[0] : row[n];
        if (victim) { strike(victim, mag('Damage'), 'magic', true); ignite(ctx, unit, victim, ticks('WoundDuration'), seq); }
        else (ctx.manaRequests ??= []).push({ source: asSource(origin(unit)), targetId: unit.id, amount: v('ManaPerMissile'), reason: 'cast-refund', bypassLock: 'this-cast-refund', castActionSeq: seq });
      } break;
    }
    case 'blitzcrank': {
      grantShield(unit, origin(unit), mag('Shield'), ctx.tick + ticks('ShieldDuration'), ctx.tick, ctx.events);
      for (const t of byDistance(unit, enemies(unit, ctx.units)).slice(0, v('NumEnemies'))) {
        strike(t, mag('BaseDamage'));
        effect(ctx, unit, t, stat(modifier('damageAmp', -Math.round(v('DamageReduction') * 10000), 'bps'), ticks('ShieldDuration')), seq);
      } break;
    }
    case 'ekko': {
      const targets = [target, ...byDistance(target, enemies(unit, ctx.units).filter(u => u.id !== target.id)).slice(0, v('NumBonusEnemies'))];
      for (const t of targets) {
        strike(t, mag(t.id === target.id ? 'TargetDamage' : 'SecondaryDamage'));
        const e = stat(modifier('magicResist', -v('ShredAmount')));
        if (e.kind !== 'modify-stat') throw new Error('Expected stat declaration');
        effect(ctx, unit, t, { ...e, stackPolicy: { kind: 'add-stacks', cap: null } }, seq);
      } break;
    }
    case 'powder': {
      if(teamup(unit,'menaces')){
        const center=enemies(unit,ctx.units).map(t=>({t,count:enemies(unit,ctx.units).filter(u=>hexDistance(t.cell,u.cell)<=2).length})).sort((a,b)=>b.count-a.count||(a.t.id<b.t.id?-1:1))[0]?.t??target;
        unit.tasks.push({key:JSON.stringify(['v20-powder',unit.id,seq]),kind:'v20Powder',source:origin(unit),executeAtTick:ctx.tick+1,targetId:target.id,cell:{...center.cell},amount:mag('Damage'),actionSeq:seq,ordinal:ticks('IgniteDuration'),total:Math.round(v('FalloffPercent')*10000),cancellable:false,attachedDot:true});
        ids.push(target.id);break;
      }
      const center = enemies(unit, ctx.units).map(t => ({ t, count: enemies(unit, ctx.units).filter(u => hexDistance(t.cell, u.cell) <= 2).length }))
        .sort((a, b) => b.count - a.count || (a.t.id < b.t.id ? -1 : 1))[0]?.t ?? target;
      for (const t of areaEnemies(unit, ctx.units).filter(t => hexDistance(center.cell, t.cell) <= 2)) {
        strike(t, Math.floor(mag('Damage') * Math.max(0, 10000 - Math.round(v('FalloffPercent') * 10000) * hexDistance(center.cell, t.cell)) / 10000), 'magic', true);
        ignite(ctx, unit, t, ticks('IgniteDuration'), seq);
      }
      break;
    }
    case 'violet':
      for (let n = 0; n < v('NumStrikes'); n++) strike(target, amount(unit, ctx.tick, { ad: v('PercentAttackDamage') }), 'physical');
      strike(target, amount(unit, ctx.tick, { ad: v('PercentIncreasedAttackDamage'), ap: v('APDamage') }), 'physical');
      applyStatus(target, origin(unit), 'stun', 0, ticks('StunDuration'), ctx.tick, ctx.events, false, '', undefined, true); break; // the uppercut knocks up
    case 'malzahar': {
      // The gate crosses the target row: two hexes on either side, clipped by the board.
      const targets = areaEnemies(unit, ctx.units).filter(u => u.cell.row === target.cell.row && Math.abs(u.cell.col-target.cell.col)<=2).sort((a,b)=>compareText(a.id,b.id));
      for (const t of targets) { strike(t, mag('Damage'), 'magic', true); effect(ctx, unit, t, status('shred', 2000, ticks('ShredDuration'), { activation: 'immediate' }), seq); }
      // Five total stacks: round-robin gives floor(5/N), then +1 in hit order.
      for (let n = 0; n < 5; n++) task(unit, 'g2Infection', ctx.tick + 20, targets[n % targets.length].id, mag('InfectionDamage'), seq, n, 5);
      break;
    }
  }
  return ids.length ? ids : (() => { const next=planG22Cast(ctx, unit, target, seq); return next.length ? next : planG23Cast(ctx, unit, target, seq); })();
}
/** Passive attack replacements return true when they already emitted the basic packet. */
export function planG2Attack(ctx: AbilityContext, unit: S13Unit, initial: S13Unit, seq: number): boolean {
  if (planG22Attack(ctx, unit, initial, seq)) return true;
  const name = champion(unit);
  if (!['twitch', 'zeri', 'leblanc', 'nocturne'].includes(name)) return false;
  const v = (k: string) => variable(unit, k), state = expansion(unit);
  if (name === 'twitch' && state.attacksRemaining > 0) {
    const targets = enemies(unit, ctx.units), target = targets[Math.floor(ctx.draw() / 2 ** 32 * targets.length)];
    const cells = path(ctx.board, unit.cell, target.cell);
    const pierced = areaEnemies(unit, ctx.units).filter(t => t.id === target.id || cells.some(c => c.col === t.cell.col && c.row === t.cell.row))
      .sort((a, b) => hexDistance(unit.cell, a.cell) - hexDistance(unit.cell, b.cell) || (a.id < b.id ? -1 : 1));
    pierced.forEach((t, n) => {
      const raw = Number(BigInt(amount(unit, ctx.tick, { ad: v('PercentAttackDamage'), ap: v('APDamage') })) * BigInt(10000 - Math.round(v('DamageReduction') * 10000)) ** BigInt(n) / 10000n ** BigInt(n));
      ctx.packets.push({ source: { ...origin(unit), sourceKind: 'attack' }, targetId: t.id, raw, damageType: 'physical', actionSeq: seq, ordinal: n, delivery: 'basic-attack', critEligibility: 'basic', area: true, triggeringCastActionSeq: null });
    }); state.attacksRemaining--; return true;
  }
  if (name === 'zeri' && unit.runtime.attackCount % v('NumOfAttacks') === 0) {
    const raw = amount(unit, ctx.tick, { ad: v('PercentAttackDamage'), ap: v('APDamage') });
    ctx.packets.push({ source: { ...origin(unit), sourceKind: 'attack' }, targetId: initial.id, raw, damageType: 'physical', actionSeq: seq, ordinal: 0, delivery: 'basic-attack', critEligibility: 'basic', area: false, triggeringCastActionSeq: null });
    for (const [n, t] of byDistance(initial, enemies(unit, ctx.units).filter(u => u.id !== initial.id)).slice(0, v('NumOfBounces')).entries())
      hit(ctx, unit, t, Math.floor(raw * v('PercentDealtToBouncedEnemies')), seq, 100 + n, 'physical', false, origin(unit), true);
    return true;
  }
  if (name === 'leblanc' && state.attacksRemaining > 0) { hit(ctx, unit, initial, amount(unit, ctx.tick, { ap: v('AutoDamage') * (1 + state.chainKills * v('AutoKillBonus')) }), seq, 200); state.attacksRemaining--; }
  if (name === 'nocturne' && state.buffUntilTick > ctx.tick) {
    const total = amount(unit, ctx.tick, { ad: v('ADPercent'), flat: v('BaseDamage') });
    for (const t of areaEnemies(unit, ctx.units).filter(t => hexDistance(initial.cell, t.cell) <= 1))
      for (let n = 0; n < 4; n++) task(unit, 'bleed', ctx.tick + (n + 1) * 5, t.id, Math.floor(total / 4) + (n < total % 4 ? 1 : 0), seq, n, 4);
  }
  return false;
}
export function executeG2Task(ctx: AbilityContext, unit: S13Unit, t: CombatTask): void {
  if (t.kind.startsWith('g23')) { executeG23Task(ctx, unit, t); return; }
  if (t.kind.startsWith('g24')) { executeOverTimeTask(ctx, t); return; }
  if (t.kind.startsWith('g22')) { executeG22Task(ctx, unit, t); return; }
  const target = ctx.units.find(u => u.id === t.targetId && u.alive && u.hp > 0);
  if (t.kind === 'g2SingedSpeed') {
    if (target) applyStatus(target, t.source, 'attackSpeed', Math.floor(t.amount * (t.total - t.ordinal) / t.total), 1, ctx.tick, ctx.events, true);
    if (t.ordinal + 1 < t.total) task(unit, t.kind, ctx.tick + 1, t.targetId, t.amount, t.actionSeq, t.ordinal + 1, t.total, t.source);
  } else if (t.kind === 'g2Drain') {
    for (const victim of byDistance(unit, enemies(unit, ctx.units)).slice(0, variable(unit, 'NumEnemies'))) {
      hit(ctx, unit, victim, t.amount, t.actionSeq, t.ordinal, 'true', false, t.source);
      ctx.heals.push({ source: t.source, targetId: unit.id, amount: t.amount });
    }
  } else if (t.kind === 'g2Slam') {
    for (const victim of areaEnemies(unit, ctx.units).filter(u => hexDistance(unit.cell, u.cell) <= 2)) hit(ctx, unit, victim, t.amount, t.actionSeq, t.ordinal, 'magic', true, t.source);
  } else if (t.kind === 'g2Infection') {
    const victim = target ?? byDistance(ctx.units.find(u => u.id === t.targetId) ?? unit, enemies(unit, ctx.units))[0];
    if (victim) {
      hit(ctx, unit, victim, t.amount, t.actionSeq, 1000 + t.ordinal, 'magic', false, t.source, true);
      task(unit, t.kind, ctx.tick + 20, victim.id, t.amount, t.actionSeq, t.ordinal, t.total, t.source);
    }
  } else if (target) hit(ctx, unit, target, t.amount, t.actionSeq, 1000 + t.ordinal, champion(unit) === 'leblanc' ? 'true' : 'magic', false, t.source, true);
}
export function advanceG2Passives(ctx: AbilityContext, nextSeq: () => number): void {
  // Snapshot damage totals only when a skill/trait consumes them.
  if (ctx.units.some(u => ['singed', 'blitzcrank', 'leblanc'].includes(champion(u)) || mechanic(u, 'automata', 'crystals') || mechanic(u, 'firelight', 'periodTicks')))
    for (const unit of ctx.units) expansion(unit);
  for (const unit of ctx.units.filter(u => u.alive && u.hp > 0)) {
    if (champion(unit) === 'amumu' && ctx.tick % 20 === 0)
      for (const target of areaEnemies(unit, ctx.units).filter(u => hexDistance(unit.cell, u.cell) <= 1)) hit(ctx, unit, target, amount(unit, ctx.tick, { ap: variable(unit, 'Damage') }), nextSeq(), 0, 'magic', true, origin(unit), true);
    const period = mechanic(unit, 'firelight', 'periodTicks');
    if(period&&!unit.v20Traits?.nextDashTick)unit.v20Traits={...unit.v20Traits,nextDashTick:period};
    if (period && ctx.tick >= unit.v20Traits!.nextDashTick!) {
      unit.v20Traits={...unit.v20Traits,nextDashTick:unit.v20Traits!.nextDashTick!+period,dashUntilTick:ctx.tick+20};
      const m = unit.mechanics!.find(m => m.mechanic === 'firelight')!, state = expansion(unit);
      ctx.heals.push({ source: m.source, targetId: unit.id, amount: Math.floor(state.damageTaken * m.values.healBps / 10000) }); state.damageTaken = 0;
      const target = byDistance(unit, enemies(unit, ctx.units))[0];
      const destination = canMove(unit, ctx.tick) && target && Array.from({length:ctx.board.rows},(_,row)=>Array.from({length:ctx.board.columns},(_,col)=>({col,row}))).flat().filter(c=>hexDistance(unit.cell,c)<=2&&hexDistance(unit.cell,c)>0).filter(c => !ctx.units.some(u => occupiesCell(u, ctx.tick) && u.cell.col === c.col && u.cell.row === c.row))
        .sort((a, b) => hexDistance(target.cell, b) - hexDistance(target.cell, a) || a.row - b.row || a.col - b.col)[0];
      if (destination) { ctx.events.push({ type: 'movement', tick: ctx.tick, unitId: unit.id, from: unit.cell, to: destination }); unit.cell = destination; }
      if (m.values.attackSpeedBps) applyStatus(unit, m.source, 'attackSpeed', m.values.attackSpeedBps, m.values.dashTicks, ctx.tick, ctx.events, true);
    }
  }
}
export function recordG2Damage(ctx: AbilityContext, owner: S13Unit | undefined, target: S13Unit, hp: number, absorbed: number,
  packet: S13Packet, survivingHp: number): void {
  if (owner?.expansion) {
    owner.expansion.damageDealt += hp + absorbed;
    if (champion(owner) === 'leblanc' && hp > 0 && survivingHp === 0 && packet.actionSeq === owner.expansion.chainCastSeq && packet.delivery === 'ability-direct') owner.expansion.chainKills++;
  }
  if (target.expansion) target.expansion.damageTaken += hp;
  if (owner && hp + absorbed > 0 && packet.source.definitionId !== 'automata' && packet.source.definitionId !== 'fractured-crystals') {
    const m = owner.mechanics?.find(m => m.mechanic === 'automata');
    if (m) {
      const state = expansion(owner); state.crystals++; state.crystalDamage += hp + absorbed;
      if (state.crystals === m.values.crystals) {
        const next = enemies(owner, ctx.units).find(u => u.id === owner.targetId) ?? byDistance(owner, enemies(owner, ctx.units))[0];
        if (next) {
          const raw=m.values.damage + Math.floor(state.crystalDamage * m.values.conversionBps / 10000);
          task(owner, 'g2Blast', ctx.tick + 1, next.id, raw, packet.actionSeq, 0, 1, m.source);
          batch2AutomataBlast(ctx,owner,raw,packet.actionSeq);
        }
        state.crystals = 0; state.crystalDamage = 0;
      }
    }
  }
  if (champion(target) === 'blitzcrank' && survivingHp > 0 && hp + absorbed > 0 && packet.delivery !== 'attack-extra') {
    const state = expansion(target), cd = Math.round(variable(target, 'PassiveCooldownSeconds') * 20);
    if (state.lastRetaliationTick === 0 || ctx.tick >= state.lastRetaliationTick + cd) {
      const victim = enemies(target, ctx.units).find(u => u.id === target.targetId) ?? byDistance(target, enemies(target, ctx.units))[0];
      if (victim) task(target, 'g2Retaliation', ctx.tick + 1, victim.id, Math.floor((hp + absorbed) * variable(target, 'PassiveDamagePercent')), packet.actionSeq);
      state.lastRetaliationTick = ctx.tick;
    }
  }
  // Chain-derived packets never recursively share again. Damage is distributed next tick.
  if (hp + absorbed > 0 && packet.delivery !== 'attack-extra') for (const caster of ctx.units.filter(u => u.alive && champion(u) === 'leblanc' && (u.expansion?.chainUntilTick ?? 0) > ctx.tick && u.expansion!.chainTargets.includes(target.id))) {
    const others = caster.expansion!.chainTargets.filter(id => id !== target.id && ctx.units.some(u => u.id === id && u.alive));
    const total = Math.floor((hp + absorbed) * variable(caster, 'DamageShare'));
    others.forEach((id, n) => task(caster, 'g2Retaliation', ctx.tick + 1, id, Math.floor(total / others.length) + (n < total % others.length ? 1 : 0), packet.actionSeq, n, others.length));
  }
}

export function executeV20Powder(ctx:AbilityContext,u:S13Unit,t:CombatTask):void {
  for(const victim of areaEnemies(u,ctx.units).filter(v=>hexDistance(t.cell!,v.cell)<=2)){
    hit(ctx,u,victim,Math.floor(t.amount*Math.max(0,10000-t.total*hexDistance(t.cell!,victim.cell))/10000),t.actionSeq,10000,'magic',true,t.source);
    ignite(ctx,u,victim,t.ordinal,t.actionSeq);
  }
  detonateMenaces(ctx,u,t.actionSeq,t.cell!);
}
