/**
 * Crowd control as drawn (presentation only). The rules mark a knock-up as a stun with `knockup` (StatusApplication),
 * which the replay view keeps on its stun status: a unit is drawn airborne while a knock-up stun is in effect on it and
 * stunned while only plain stuns are. Nothing here feeds back into the rules.
 */
import type { CombatState } from '../simulation/combat-types';
import type { DisplayCombatEvent, DisplayUnit } from './combat-display';
import { readUnitStatusRows } from './combat-status';

export type ControlKind = 'stun' | 'airborne';

/** 2D lift (logical px) and its rise/fall seconds; the 3D layer has its own (three-mode/unit-control.ts). */
export const KNOCKUP_2D = { height: 16, riseSeconds: 0.16, fallSeconds: 0.2 } as const;

/**
 * Forced moves (pull, grab, knockback): the rules mark these movement events with a reason. 2D draws them as a quick
 * skid along the floor instead of the 220 ms walk; the 3D layer keeps its own list (three-mode/unit-control.ts).
 */
export const DISPLACEMENT_REASONS: ReadonlySet<string> = new Set(['mordekaiser-pull', 'sett-grab', 'sevika-knockback']);
export const isDisplacement = (event: DisplayCombatEvent): event is Extract<DisplayCombatEvent, { type: 'movement' }> =>
  event.type === 'movement' && DISPLACEMENT_REASONS.has((event as { reason?: string }).reason ?? '');
/** 2D skid: milliseconds, lean (radians, against the slide) and the dust streak's fade. */
export const DISPLACEMENT_SLIDE_2D = { ms: 150, lean: 0.22, streakMs: 260 } as const;

/** A displayed unit with the replay view's status list (CombatViewUnit.statuses) when it has one. */
export type ViewUnitStatuses = DisplayUnit & { readonly statuses?: readonly { readonly kind: string; readonly harmful?: boolean; readonly knockup?: true }[] };

/** The control drawn on a unit now: the engine's statuses offline, the replay view's online. A knock-up outranks a stun. */
export function unitControl(runtime: CombatState | null, unit: ViewUnitStatuses): ControlKind | null {
  if (!unit.alive) return null;
  const stuns: readonly { readonly knockup?: true }[] = runtime
    ? readUnitStatusRows(runtime, unit.id).filter(row => row.kind === 'stun' && row.state !== 'pending' && row.state !== 'suppressed')
    : (unit.statuses ?? []).filter(status => status.kind === 'stun');
  return !stuns.length ? null : stuns.some(stun => stun.knockup) ? 'airborne' : 'stun';
}

/**
 * Lift share (0 on the floor, 1 at the top) of a knock-up: eases up over `rise` seconds after it starts and, once it
 * has ended, back down over `fall` seconds from wherever it was. `since` is seconds airborne (null: not airborne);
 * `landing` seconds since it ended (null: still up). Shared shape of the 2D and 3D lifts.
 */
export function knockupLift(since: number | null, landing: number | null, from: number, rise: number, fall: number): number {
  if (landing !== null) return landing >= fall || !(fall > 0) ? 0 : from * (1 - easeInQuad(landing / fall));
  if (since === null) return 0;
  return !(rise > 0) || since >= rise ? 1 : easeOutCubic(since / rise);
}
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInQuad = (t: number) => t * t;
