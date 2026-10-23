import { S13_COMBAT_RULES } from './s13-rules';
import { MOVE_INTERVAL_TICKS } from './combat-types';

/** Project timing: the first stack applies at tick 600, then every 20 ticks. */
export function overtimeStacks(tick: number): number {
  const rules = S13_COMBAT_RULES;
  return tick < rules.overtimeStartTick ? 0 : 1 + Math.floor((tick - rules.overtimeStartTick) / rules.overtimeStackTicks);
}
export function overtimeBonusBps(tick: number): number {
  return overtimeStacks(tick) * S13_COMBAT_RULES.overtimePerStackBps;
}
export function overtimeReceivedBps(tick: number): number {
  return 10000 - Math.min(S13_COMBAT_RULES.overtimeReductionCapBps, overtimeBonusBps(tick));
}
/** Positive durations round half up, minimum one tick; existing controls are untouched. */
export function overtimeControlTicks(duration: number, tick: number): number {
  return Math.max(1, Math.floor((duration * overtimeReceivedBps(tick) + 5000) / 10000));
}
// Riot 13.22 gives a flat movement bonus without a number; the project chose +50%
// (user, 2026-10-23), flat from tick 600 rather than per stack.
export const OVERTIME_MOVE_SPEED_BONUS_BPS = S13_COMBAT_RULES.overtimeMoveSpeedBonusBps;
export function overtimeMoveBonusBps(tick: number): number {
  return overtimeStacks(tick) > 0 ? OVERTIME_MOVE_SPEED_BONUS_BPS : 0;
}
/** Ticks until the next step. Before overtime this is unchanged: 5, or ceil(5/1.5)=4 in
 * Warwick frenzy. In overtime the speed bonuses add and steps snap to a fixed tick grid of
 * period 5*10000/speed (10/3 ticks alone, 2.5 with frenzy), so the long-run rate is exact
 * without storing a fractional carry: a unit that keeps moving alternates 3,3,4 (or 2,3). */
export function movementIntervalTicks(frenzy: boolean, tick: number): number {
  const bonus = overtimeMoveBonusBps(tick);
  if (bonus === 0) return frenzy ? Math.ceil(MOVE_INTERVAL_TICKS * 10000 / 15000) : MOVE_INTERVAL_TICKS;
  const speed = 10000 + (frenzy ? 5000 : 0) + bonus, period = MOVE_INTERVAL_TICKS * 10000;
  const next = Math.ceil((Math.floor(tick * speed / period) + 1) * period / speed);
  return next - tick;
}
/** Quickstriker accrues 3 tenths of a step per tick; overtime alternates 4 and 5 (4.5 = 3x1.5). */
export function quickstrikerMoveTenths(tick: number): number {
  return overtimeMoveBonusBps(tick) === 0 ? 3 : 4 + (tick & 1);
}
