import { hexDistance, type Board } from './board';
import type { CombatOrigin, CombatTask, CombatEvent } from './combat-types';
import { ad, amount, ap, applyStatus, byDistance, champion, compareOrigins, enemies, grantShield, lowestAlly, mechanic, neighborsOf,
  origin, path, range, sourceKey, variable, type S13Unit } from './combat-s13-state';
import type { CritEligibility, DamageDelivery, DamageInput } from './m8/contracts';
export interface S13Packet { source: CombatOrigin; targetId: string; raw: number; damageType: 'physical' | 'magic'; actionSeq: number;
  ordinal: number; critical?: boolean; bounce?: boolean; delivery: DamageDelivery; critEligibility: CritEligibility;
  area: boolean; triggeringCastActionSeq: number | null; inherited?: Extract<DamageInput, { stage: 'after-mitigation' }>['inherited'] }
export interface S13Heal { source: CombatOrigin; targetId: string; amount: number }
export interface AbilityContext {
  tick: number; board: Board; units: S13Unit[]; events: CombatEvent[]; packets: S13Packet[]; heals: S13Heal[];
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
    amount: value, ordinal, total, cancellable, actionSeq: seq });
}
function replaceEndTask(unit: S13Unit, kind: CombatTask['kind'], at: number, value: number, seq: number): void {
  unit.tasks = unit.tasks.filter(t => t.kind !== kind); addTask(unit, kind, at, null, value, seq);
}
export function planS13Cast(ctx: AbilityContext, unit: S13Unit, target: S13Unit, seq: number): string[] {
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
      const ticks = duration('ShieldDuration', 3); shield(unit, mag('ShieldHealth'), ticks, true);
      replaceEndTask(unit, 'ireliaEnd', tick + ticks, mag('StrikeBaseDamage'), seq); break;
    }
    case 'maddie': {
      const far = byDistance(unit, enemies(unit, units), true)[0];
      if (!far) break;
      const shots = [0, 4, 9, 13, 18, 23];
      shots.forEach((offset, n) => addTask(unit, 'maddie', tick + offset, far.id, physical('PercentAttackDamage', 'APDamage'), seq, n, shots.length, true));
      applyStatus(unit, source, 'channel', 0, 24, tick, events, true); targets.push(far.id); break;
    }
    case 'darius': {
      for (const enemy of neighborsOf(unit, units)) hit(enemy, physical('PercentAttackDamage'), 'physical');
      ctx.heals.push({ source, targetId: unit.id, amount: mag('Heal') });
      const total = physical('BleedPercentAttackDamage');
      unit.tasks = unit.tasks.filter(t => t.kind !== 'bleed' || t.targetId !== target.id);
      for (let n = 0; n < 4; n++) addTask(unit, 'bleed', tick + (n + 1) * 20, target.id,
        Math.floor(total / 4) + (n < total % 4 ? 1 : 0), seq, n, 4); break;
    }
    case 'lux': {
      const ally = lowestAlly(unit, units, true)!; shield(ally, mag('Shield'), duration('ShieldDuration'));
      unit.runtime.nextAttackMagic = mag('Damage'); break;
    }
    case 'zyra': {
      hit(target, mag('TargetDamage'));
      applyStatus(target, source, 'stun', 0, duration('StunDuration', 1), tick, events);
      for (const enemy of byDistance(unit, enemies(unit, units).filter(u => u.id !== target.id)).slice(0, v('NumSmallerVines', 2))) hit(enemy, mag('AOEDamage')); break;
    }
    case 'tristana': hit(target, physical('PercentAttackDamage', 'APDamage'), 'physical', true); break;
    case 'urgot': {
      for (const enemy of enemies(unit, units).filter(u => hexDistance(target.cell, u.cell) <= 1)) {
        hit(enemy, physical(enemy.id === target.id ? 'PrimaryDamage' : 'SecondaryDamage', 'APDamage'), 'physical');
        applyStatus(enemy, source, 'armorReduction', 2000, duration('Duration', 6), tick, events);
      } break;
    }
    case 'rell': {
      shield(unit, mag('Shield'), duration('ShieldDuration'));
      const cells = path(ctx.board, unit.cell, target.cell);
      const hitUnits = enemies(unit, units).filter(u => cells.some(c => c.col === u.cell.col && c.row === u.cell.row));
      const steal = v('DefensesSteal');
      for (const enemy of hitUnits) {
        hit(enemy, mag('StabDamage'));
        applyStatus(enemy, source, 'resistanceFlat', -steal, 1200, tick, events, false, `${seq}:${enemy.id}`);
        applyStatus(unit, source, 'resistanceFlat', steal, 1200, tick, events, false, `${seq}:${enemy.id}`);
      } break;
    }
    case 'leona': {
      const ticks = duration('Duration', 3);
      applyStatus(unit, source, 'damageReduction', Math.min(10000, Math.round(v('DR') * ap(unit, tick) * 100)), ticks, tick, events, true);
      replaceEndTask(unit, 'leonaEnd', tick + ticks, mag('Damage'), seq); break;
    }
    case 'vander': {
      const ticks = duration('TauntDuration', 2.5);
      applyStatus(unit, source, 'channel', 0, ticks, tick, events, true);
      applyStatus(unit, source, 'resistanceFlat', mag('Resists'), ticks, tick, events, true);
      unit.runtime.nextAttackPhysical = amount(unit, tick, { ad: v('PercentAttackDamage') + v('BonusDamageADRatio') * mechanic(unit, 'lowCostAllies', 'count') });
      targets.push(unit.id); break;
    }
    case 'kogmaw': {
      const speedBefore = unit.runtime.attackSpeedBps, rangeBefore = range(unit);
      unit.runtime.attackSpeedBps += Math.round(v('AttackSpeed', .25) * 10000);
      if (unit.runtime.castCount % v('RangeIncreaseNumAttacks', 3) === 0) unit.runtime.rangeBonus++;
      events.push({ type: 'statChanged', tick, unitId: unit.id, source, stat: 'attackSpeedBps', before: speedBefore, after: unit.runtime.attackSpeedBps });
      if (rangeBefore !== range(unit)) events.push({ type: 'statChanged', tick, unitId: unit.id, source,
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
      for (const enemy of enemies(unit, units).filter(u => hexDistance(target.cell, u.cell) <= 1)) hit(enemy, physical('PercentAttackDamage', 'APDamage'), 'physical');
      hit(target, physical('PercentCenterDamage'), 'physical'); break;
    }
    case 'loris': {
      const ticks = duration('Duration'); shield(unit, mag('Shield'), ticks);
      applyStatus(unit, source, 'redirect', Math.round(v('PercentDamageRedirect', .5) * 10000), ticks, tick, events, true);
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
      applyStatus(unit, source, 'channel', 0, total, tick, events, true); targets.push(target.id); break;
    }
    case 'garen': {
      shield(unit, amount(unit, tick, { ap: v('APShield'), hp: v('PercentHealthShield') }), duration('ShieldDuration'));
      for (const enemy of enemies(unit, units).filter(u => hexDistance(target.cell, u.cell) <= 2)) hit(enemy,
        physical(enemy.id === target.id ? 'ADRatio' : 'SecondaryADRatio'), 'physical'); break;
    }
    case 'zoe': {
      hit(target, mag('Damage')); const seen = new Set([target.id]);
      for (let n = 0; n < v('NumRepeats', 2); n++) {
        const next = byDistance(target, enemies(unit, units).filter(u => !seen.has(u.id) && hexDistance(target.cell, u.cell) <= v('HexLimiter', 4)), true)[0];
        if (!next) break;
        hit(next, mag('Damage')); seen.add(next.id); hit(target, mag('Damage'));
      } break;
    }
    case 'caitlyn': {
      const total = v('TotalShots', 4), ticks = duration('RaidDuration', 5);
      for (let n = 0; n < total; n++) addTask(unit, 'caitlyn', tick + Math.floor(n * ticks / total), null,
        physical('PercentAttackDamage', 'APDamage'), seq, n, total, true);
      applyStatus(unit, source, 'channel', 0, ticks, tick, events, true); targets.push(target.id); break;
    }
  }
  return targets;
}
export function executeTask(ctx: AbilityContext, unit: S13Unit, task: CombatTask): void {
  if (task.kind === 'tristanaBounce' && !task.inherited) throw new RangeError('Missing inherited Tristana receipt');
  const opponents = enemies(unit, ctx.units), target = opponents.find(u => u.id === task.targetId);
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
      const center = [...opponents].sort((a, b) => a.id < b.id ? -1 : 1)[ctx.draw() % opponents.length];
      for (const enemy of opponents.filter(u => hexDistance(center.cell, u.cell) <= 1)) emit(enemy, task.amount, 'physical', task.ordinal * 100);
      emit(center, amount(unit, ctx.tick, { ad: variable(unit, 'HeadshotPercentAD') }), 'physical', task.ordinal * 100 + 1);
      applyStatus(center, task.source, 'resistanceFlat', -variable(unit, 'ResistReduction', 20), 1200, ctx.tick, ctx.events, false, `${task.actionSeq}:${task.ordinal}`); break;
    }
    case 'ireliaEnd': {
      const layer = unit.shieldLayers.find(s => s.key === sourceKey(task.source));
      const total = task.amount + Math.floor((layer?.absorbed ?? 0) * Math.round(variable(unit, 'PercentShieldDamage', .3) * 10000) / 10000);
      for (const enemy of neighborsOf(unit, ctx.units)) emit(enemy, total, 'magic'); break;
    }
    case 'leonaEnd': for (const enemy of neighborsOf(unit, ctx.units)) emit(enemy, task.amount, 'magic'); break;
    case 'lorisEnd': {
      const center = byDistance(unit, opponents)[0]; if (!center) break;
      for (const enemy of opponents.filter(u => hexDistance(center.cell, u.cell) <= 1)) emit(enemy, task.amount, 'magic'); break;
    }
  }
}
export function planS13Attack(ctx: AbilityContext, unit: S13Unit, target: S13Unit, seq: number): void {
  const source = { ...origin(unit), sourceKind: 'attack' as const }, base = unit.runtime.nextAttackPhysical || ad(unit);
  ctx.packets.push({ source, targetId: target.id, raw: base, damageType: 'physical',
    actionSeq: seq, ordinal: 0, delivery: 'basic-attack', critEligibility: 'basic', area: false, triggeringCastActionSeq: null });
  unit.runtime.nextAttackPhysical = 0;
  if (unit.runtime.nextAttackMagic > 0) {
    packet(ctx, unit, target, unit.runtime.nextAttackMagic, 'magic', seq, 1, false, false, null); unit.runtime.nextAttackMagic = 0;
  }
  if (champion(unit) === 'kogmaw') packet(ctx, unit, target, amount(unit, ctx.tick, { ap: variable(unit, 'DamageOnAttack') }), 'magic', seq, 2, false, false, null);
  let ordinal = 3;
  for (const effect of [...unit.mechanics ?? []].sort((a, b) => compareOrigins(a.source, b.source))) {
    if (effect.mechanic === 'rageblade') {
      const before = unit.runtime.attackSpeedBps; unit.runtime.attackSpeedBps += effect.values.attackSpeedBps;
      ctx.events.push({ type: 'statChanged', tick: ctx.tick, unitId: unit.id, source: effect.source,
        stat: 'attackSpeedBps', before, after: unit.runtime.attackSpeedBps });
    }
    if ((effect.mechanic === 'artillery' && unit.runtime.attackCount % (effect.values.everyN ?? 5) === 0) || effect.mechanic === 'titanic') {
      const bps = effect.values.adBps ?? (effect.mechanic === 'artillery' ? 12500 : 4000);
      for (const enemy of enemies(unit, ctx.units).filter(u => hexDistance(target.cell, u.cell) <= 1))
        ctx.packets.push({ source: effect.source, targetId: enemy.id, raw: Math.floor(ad(unit) * bps / 10000), damageType: 'physical', actionSeq: seq, ordinal: ordinal++,
          delivery: 'attack-extra', critEligibility: 'never', area: true, triggeringCastActionSeq: null });
    }
  }
}
