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
// (user, 2026-10-23). Speed bonuses add, and intervals round up like Warwick frenzy.
export const OVERTIME_MOVE_SPEED_BONUS_BPS = S13_COMBAT_RULES.overtimeMoveSpeedBonusBps;
export function overtimeMoveBonusBps(tick: number): number {
  return overtimeStacks(tick) > 0 ? OVERTIME_MOVE_SPEED_BONUS_BPS : 0;
}
/** Ticks until the next step: 5 normally, 4 in overtime or Warwick frenzy, 3 with both. */
export function movementIntervalTicks(frenzy: boolean, tick: number): number {
  return Math.ceil(MOVE_INTERVAL_TICKS * 10000 / (10000 + (frenzy ? 5000 : 0) + overtimeMoveBonusBps(tick)));
}
