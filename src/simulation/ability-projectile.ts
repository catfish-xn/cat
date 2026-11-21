import { hexDistance } from './board';
import { HEIMER_ROCKET_TIMING, maddieShotFlightTicks, MEL_BOLT_TICKS_PER_HEX, MORDEKAISER_CLAW_TICKS } from './cast-windup';
import { melBolts } from './combat-six-cost';
import type { CombatTask } from './combat-types';
import type { AbilityContext } from './combat-s13-abilities';
import { byDistance, enemies, grantShield, origin, path, variable, type S13Unit } from './combat-s13-state';

/**
 * Skill projectiles that settle where they land (landing batch, 11-20; docs/S13_RULES_GAP.md 技能落地结算批). What a cast
 * decides (targets, amounts) is still decided on the cast; each projectile then leaves on its own launch tick
 * (abilityProjectileLaunched) and settles on its arrival tick (abilityProjectileLanded, then its effect). A target that died
 * in flight takes nothing and no other one is picked (hit false), as ranged basic attacks do.
 */
export type AbilityProjectileSkill = 'maddie-shot' | 'heimerdinger-rocket' | 'lux-shield' | 'mordekaiser-claw' | 'mel-barrage' | 'mel-bolt';
export const ABILITY_PROJECTILE_SKILLS: readonly AbilityProjectileSkill[] = ['maddie-shot', 'heimerdinger-rocket', 'lux-shield', 'mordekaiser-claw', 'mel-barrage', 'mel-bolt'];
/** The champion each projectile belongs to. */
export const ABILITY_PROJECTILE_OWNER: Readonly<Record<AbilityProjectileSkill, string>> =
  { 'maddie-shot': 'maddie', 'heimerdinger-rocket': 'heimerdinger', 'lux-shield': 'lux', 'mordekaiser-claw': 'mordekaiser', 'mel-barrage': 'mel', 'mel-bolt': 'mel' };
/** A skillShot task: before launch (arrivalTick absent) it runs on its launch tick; after, on arrivalTick (= executeAtTick). */
export interface SkillShotState { readonly skill: AbilityProjectileSkill; readonly arrivalTick?: number }

/** Schedules one projectile of a cast to leave on launchTick (ordinal of total; targetId null: Maddie aims when it leaves). */
export function scheduleShot(unit: S13Unit, skill: AbilityProjectileSkill, launchTick: number, targetId: string | null, value: number,
  seq: number, ordinal: number, total: number, cancellable = false): void {
  unit.tasks.push({ key: JSON.stringify([unit.id, seq, 'skillShot', ordinal]), kind: 'skillShot', source: origin(unit), executeAtTick: launchTick,
    targetId, amount: value, ordinal, total, cancellable, actionSeq: seq, shot: { skill } });
}

/** Sends the projectile now (its launch tick): it lands on arrivalTick. */
export function launchShot(ctx: AbilityContext, unit: S13Unit, task: CombatTask, targetId: string, arrivalTick: number): void {
  const skill = task.shot!.skill;
  ctx.events.push({ type: 'abilityProjectileLaunched', tick: ctx.tick, sourceId: unit.id, targetId, arrivalTick, skill, ordinal: task.ordinal, actionSeq: task.actionSeq, count: task.total });
  unit.tasks.push({ ...task, key: JSON.stringify([unit.id, task.actionSeq, 'skillShot', task.ordinal, 'flight']), executeAtTick: arrivalTick, targetId, cancellable: false,
    shot: { skill, arrivalTick } });
}

/** Runs a skillShot task: its launch, or its landing. */
export function executeSkillShot(ctx: AbilityContext, unit: S13Unit, task: CombatTask): void {
  const shot = task.shot!;
  if (shot.arrivalTick === undefined) {
    if (shot.skill === 'maddie-shot') {
      // Her shot leaves toward her aim (the target taken on the cast, else the farthest enemy now) and goes to the first enemy
      // on the path there; it flies MADDIE_SHOT_TICKS_PER_HEX a hex to that enemy.
      const opponents = enemies(unit, ctx.units);
      const aim = opponents.find(u => u.id === task.targetId) ?? byDistance(unit, opponents, true)[0]; if (!aim) return;
      const struck = path(ctx.board, unit.cell, aim.cell).map(c => opponents.find(u => u.cell.col === c.col && u.cell.row === c.row)).find(Boolean);
      if (!struck) return;
      launchShot(ctx, unit, task, struck.id, ctx.tick + maddieShotFlightTicks(hexDistance(unit.cell, struck.cell)));
      return;
    }
    if (shot.skill === 'heimerdinger-rocket') { launchShot(ctx, unit, task, task.targetId!, ctx.tick + HEIMER_ROCKET_TIMING.flightTicks); return; }
    if (shot.skill === 'mordekaiser-claw') {
      const star = (unit.starLevel ?? 1) as 1 | 2 | 3, claw = MORDEKAISER_CLAW_TICKS[star];
      launchShot(ctx, unit, task, task.targetId!, ctx.tick + claw.land - claw.appear); return;
    }
    if (shot.skill === 'mel-barrage' || shot.skill === 'mel-bolt') {
      // Mel's bolts at one target leave together and fly MEL_BOLT_TICKS_PER_HEX a hex (self-chosen, not original data).
      const aim = ctx.units.find(u => u.id === task.targetId);
      launchShot(ctx, unit, task, task.targetId!, ctx.tick + Math.max(1, (aim ? hexDistance(unit.cell, aim.cell) : 1) * MEL_BOLT_TICKS_PER_HEX)); return;
    }
    throw new RangeError('unlaunched skill shot ' + shot.skill);
  }
  const target = ctx.units.find(u => u.id === task.targetId && u.alive && u.hp > 0);
  ctx.events.push({ type: 'abilityProjectileLanded', tick: ctx.tick, sourceId: unit.id, targetId: task.targetId!, skill: shot.skill, ordinal: task.ordinal,
    actionSeq: task.actionSeq, count: task.total, hit: !!target });
  if (!target) return;
  const damage = (type: 'physical' | 'magic', area: boolean) => ctx.packets.push({ source: task.source, targetId: target.id, raw: task.amount, damageType: type,
    actionSeq: task.actionSeq, ordinal: task.ordinal, delivery: 'ability-direct', critEligibility: 'requires-spell-authorization', area, triggeringCastActionSeq: task.actionSeq });
  switch (shot.skill) {
    case 'maddie-shot': damage('physical', false); break;
    case 'heimerdinger-rocket': damage('magic', false); break;
    case 'mordekaiser-claw': damage('magic', true); break;
    case 'mel-barrage': melBolts(ctx, target, task.amount, task.actionSeq, task.source); break;
    // One bolt of a normal cast: one magic packet (ordinal = the bolt's place in the cast).
    case 'mel-bolt': damage('magic', true); break;
    case 'lux-shield': grantShield(target, task.source, task.amount, ctx.tick + luxShieldTicks(unit), ctx.tick, ctx.events); break;
  }
}
/** Lux's shield lasts ShieldDuration from where it lands. */
export function luxShieldTicks(unit: S13Unit): number { return Math.round(variable(unit, 'ShieldDuration', 4) * 20); }
