/**
 * Crowd control as drawn (presentation only). The rules model every knock-up as a plain stun status: the 2D and 3D
 * views tell 击飞 from 眩晕 here, by the cast that applied it — a stun that lands on the same tick as a cast of one of
 * the champions below (on the targets that champion's ability knocks up) is drawn airborne until the stun ends.
 * Nothing here feeds back into the rules. If the rules ever expose the difference, read that instead of this table.
 */
import type { CombatState } from '../simulation/combat-types';
import type { DisplayCombatEvent, DisplayUnit } from './combat-display';
import { readUnitStatusRows } from './combat-status';

export type ControlKind = 'stun' | 'airborne';

/**
 * Casts whose stun is a knock-up, by the caster's definitionId: 'all' knocks up every unit it stuns; 'secondary' all
 * but its first target (蔚 slams the target down, stunning it, and the shockwave knocks up the rest of that row).
 */
export const KNOCKUP_CASTS: Readonly<Record<string, 'all' | 'secondary'>> = {
  violet: 'all', // 1-2-3连招: the uppercut
  vi: 'secondary', // 破坏小组: the row shockwave
  viktor: 'all', // 六费: knocks up all enemies
  jayce: 'all', // 锤形态: knocked into a Hexgate and flies back
};

/** 2D lift (logical px) and its rise/fall seconds; the 3D layer has its own (three-mode/unit-control.ts). */
export const KNOCKUP_2D = { height: 16, riseSeconds: 0.16, fallSeconds: 0.2 } as const;

/** True while the unit has a stun in effect: the replay view's statuses online, the engine's offline. */
export function unitStunned(runtime: CombatState | null, unit: ViewUnitStatuses): boolean {
  if (!unit.alive) return false;
  if (runtime) return readUnitStatusRows(runtime, unit.id).some(row => row.kind === 'stun' && row.state !== 'pending' && row.state !== 'suppressed');
  return (unit.statuses ?? []).some(status => status.kind === 'stun');
}

/** A displayed unit with the replay view's status list (CombatViewUnit.statuses) when it has one. */
export type ViewUnitStatuses = DisplayUnit & { readonly statuses?: readonly { readonly kind: string; readonly harmful?: boolean }[] };

interface KnockCast { readonly sourceId: string; readonly rule: 'all' | 'secondary'; readonly primary: string | undefined }

/** Remembers which stunned units were knocked up. Feed it every shown event batch; reset it with each new combat. */
export class ControlTracker {
  private readonly airborne = new Set<string>();
  private readonly casts = new Map<number, KnockCast[]>();
  private readonly stuns = new Map<number, string[]>();
  constructor(private readonly definitionOf: (unitId: string) => string | undefined) {}

  observe(events: readonly DisplayCombatEvent[]): void {
    let latest = -Infinity;
    const touched = new Set<number>();
    for (const event of events) {
      const tick = 'tick' in event && typeof event.tick === 'number' ? event.tick : null;
      if (tick === null) continue;
      latest = Math.max(latest, tick);
      if (event.type === 'cast') {
        const definitionId = this.definitionOf(event.sourceId), rule = definitionId ? KNOCKUP_CASTS[definitionId] : undefined;
        if (!rule) continue;
        push(this.casts, tick, { sourceId: event.sourceId, rule, primary: event.targetIds[0] });
        touched.add(tick);
      } else if (event.type === 'statusChanged' && event.kind === 'stun' && (event.reason === 'applied' || event.reason === 'refreshed')) {
        push(this.stuns, tick, event.targetId); touched.add(tick);
      }
    }
    // A tick's cast and stuns can arrive in two batches: the last tick stays on hand for the next one.
    for (const tick of [...touched].sort((a, b) => a - b)) {
      const casts = this.casts.get(tick) ?? [];
      for (const target of this.stuns.get(tick) ?? []) {
        const knocked = casts.some(cast => cast.sourceId !== target && (cast.rule === 'all' || cast.primary !== target));
        // A plain stun landing on a unit in the air takes over: it is drawn stunned from then on.
        if (knocked) this.airborne.add(target); else this.airborne.delete(target);
      }
    }
    for (const map of [this.casts, this.stuns]) for (const tick of [...map.keys()]) if (tick < latest - 1) map.delete(tick);
  }

  /** The control drawn on a unit now; `stunned` is unitStunned. A finished stun also ends its knock-up. */
  control(unitId: string, stunned: boolean): ControlKind | null {
    if (!stunned) { this.airborne.delete(unitId); return null; }
    return this.airborne.has(unitId) ? 'airborne' : 'stun';
  }

  reset(): void { this.airborne.clear(); this.casts.clear(); this.stuns.clear(); }
}

function push<T>(map: Map<number, T[]>, tick: number, value: T): void {
  const list = map.get(tick);
  if (list) list.push(value); else map.set(tick, [value]);
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
