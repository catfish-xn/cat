/**
 * v23 live fix: the combat overtime indicator. Reads only the battle's current tick against the rules' constants
 * (S13_COMBAT_RULES: overtime from tick 600 = 30 s, a draw at maxTicks 900 = 45 s); decides nothing. DOM-free, so the
 * 2D countdown strip and the 3D layer can both show it.
 */
import { S13_COMBAT_RULES } from '../simulation/s13-rules';

export interface OvertimeIndicator { readonly secondsLeft: number; readonly text: string }

/** Null before overtime (or without a running battle); else the whole seconds left until the draw. */
export function overtimeIndicator(tick: number | null | undefined): OvertimeIndicator | null {
  const { overtimeStartTick, maxTicks, tickMs } = S13_COMBAT_RULES;
  if (typeof tick !== 'number' || !Number.isFinite(tick) || tick < overtimeStartTick) return null;
  const secondsLeft = Math.ceil(Math.max(0, maxTicks - tick) * tickMs / 1000);
  return { secondsLeft, text: `加时 ${secondsLeft}` };
}
