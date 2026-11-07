/**
 * The room's little-legend walks (src/server/legend-motion.ts): the last walk of each seat per scene, the carousel arrival
 * timers and the publication to every seat. A walk changes no rule state, so it is not a seat command: no receipt, no
 * seatRevision, no room revision. The only rule step it leads to is the carousel pick on arrival, which the room asks the
 * rules for through its internal atomic pick-and-grant transaction. Player commands cannot grant a pick directly.
 */
import type { Clock, ClockHandle } from './clock';
import { walkPoint, type CellPoint, type LegendScene, type LegendWalk } from '../legend-motion';

/** A seat's walks closer together than this are dropped (a held button or a script; TFT itself repeats at about 10/s). */
export const LEGEND_WALK_MIN_GAP_MS = 80;

export class LegendWalkBook {
  private readonly walks = new Map<string, LegendWalk>();
  private readonly arrivals = new Map<string, ClockHandle[]>();
  private readonly listeners = new Set<(walk: LegendWalk) => void>();
  constructor(private readonly clock: Clock) {}

  subscribe(listener: (walk: LegendWalk) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  /** Every walk still kept (a resumed connection gets them once). */
  list(): readonly LegendWalk[] { return [...this.walks.values()]; }
  /** Where this seat's legend is now in `scene`; null when it never walked there (it stands home). */
  position(seatId: string, scene: LegendScene, at = this.clock.now()): CellPoint | null {
    const walk = this.walks.get(key(seatId, scene));
    return walk ? walkPoint(walk, at) : null;
  }
  /** Too soon after this seat's last walk in any scene. */
  throttled(seatId: string): boolean {
    const now = this.clock.now();
    for (const walk of this.walks.values()) if (walk.seatId === seatId && now - walk.startedAt < LEGEND_WALK_MIN_GAP_MS) return true;
    return false;
  }
  /** Records and publishes `walk`; a later walk of the seat replaces it and its arrival. `arrive` runs at `walk.arriveAt`. */
  start(walk: LegendWalk, arrive?: () => void): void {
    const id = key(walk.seatId, walk.scene);
    this.cancelArrival(id);
    this.walks.set(id, walk);
    if (arrive) this.contacts(walk, [{ at: walk.arriveAt, arrive }]);
    for (const listener of this.listeners) listener(walk);
  }
  /** Contact timers belong to the same walk: a new destination cancels every remaining contact. */
  contacts(walk: LegendWalk, contacts: readonly { at: number; arrive: () => void }[]): void {
    const id = key(walk.seatId, walk.scene);
    this.cancelArrival(id);
    const handles: ClockHandle[] = [];
    this.arrivals.set(id, handles);
    for (const contact of contacts) {
      const handle = this.clock.schedule(contact.at, () => {
        const index = handles.indexOf(handle);
        if (index >= 0) handles.splice(index, 1);
        if (handles.length === 0) this.arrivals.delete(id);
        contact.arrive();
      });
      handles.push(handle);
    }
    if (handles.length === 0) this.arrivals.delete(id);
  }
  /** Ends a seat's arrival without moving it (a pick that no longer applies). */
  stop(seatId: string, scene: LegendScene): void { this.cancelArrival(key(seatId, scene)); }
  /** Forgets one scene's walks and arrivals (a carousel is over: everyone is home for the next). */
  clearScene(scene: LegendScene): void {
    for (const [id, walk] of [...this.walks]) if (walk.scene === scene) { this.cancelArrival(id); this.walks.delete(id); }
  }
  get pendingArrivals(): number { return [...this.arrivals.values()].reduce((sum, handles) => sum + handles.length, 0); }
  dispose(): void {
    for (const id of [...this.arrivals.keys()]) this.cancelArrival(id);
    this.walks.clear(); this.listeners.clear();
  }
  private cancelArrival(id: string): void {
    const handle = this.arrivals.get(id);
    if (handle !== undefined) { for (const timer of handle) this.clock.cancel(timer); this.arrivals.delete(id); }
  }
}

const key = (seatId: string, scene: LegendScene) => `${scene}:${seatId}`;
