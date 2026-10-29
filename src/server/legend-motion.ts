/**
 * Little-legend (小小英雄) movement shared by the room and the 3D layer: one geometry and one pace, so the server's
 * arrival time and the drawn walk agree. Pure, no imports. Points are in cells: on the carousel the platform's center is
 * the origin and x/y are the 3D x/z; on a board they are hex widths from the board origin in the owner's orientation.
 *
 * A walk is a straight line at LEGEND_CELLS_PER_SECOND. On the carousel the room plans every walk from where it last
 * left that seat's legend. Ground clicks keep their point; only a 2D card request aims at a unit's future position.
 * Moving or standing contact asks the rules for a pick at that moment, so whoever touches first takes it. On a board the walk is display only and the room relays it.
 */
export type LegendScene = 'carousel' | 'board';
export interface CellPoint { readonly x: number; readonly y: number }
/** Walk to a fixed point (3D), or ask for server-planned travel to a carousel card (2D `slot`). */
export interface LegendWalkRequest { readonly scene: LegendScene; readonly to?: CellPoint; readonly slot?: number; readonly from?: CellPoint }
/** One walk as the room published it; times are the server clock (ms). */
export interface LegendWalk {
  readonly seatId: string;
  readonly scene: LegendScene;
  readonly from: CellPoint;
  readonly to: CellPoint;
  readonly startedAt: number;
  readonly arriveAt: number;
  /** The 2D card it heads for; null for a ground point. The room grants only on circle contact. */
  readonly slot: number | null;
}

/** Half the first pace (playtest 10-21: legends moved too fast to watch a carousel scramble), on the board too. */
export const LEGEND_CELLS_PER_SECOND = 2.5;
/** Carousel layout in cells: legends on cradles around the ring, units on a ring inside the glass turning once per ORBIT_MS. */
export const CAROUSEL_LEGEND_RADIUS = 7.1, CAROUSEL_UNIT_RADIUS = 2.5, CAROUSEL_ORBIT_MS = 48_000, CAROUSEL_SEATS = 8;
/** A board walk stays within this many cells of the board origin (the room's sanity bound; the layer keeps it nearer). */
export const BOARD_WALK_LIMIT = 20;

/** The point at `index` of `count` on a circle of `radius`, turned by `turn` radians (index 0 at +y). */
export function ringPoint(index: number, count: number, radius: number, turn = 0): CellPoint {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 + turn;
  return { x: Math.sin(angle) * radius, y: Math.cos(angle) * radius };
}
/** A seat's cradle: public seat order, at least eight places around. */
export function carouselHome(index: number, seatCount: number): CellPoint {
  return ringPoint(index, Math.max(CAROUSEL_SEATS, seatCount), CAROUSEL_LEGEND_RADIUS);
}
/** Where the unit listed `index` of `count` stands `elapsedMs` after the carousel opened. */
export function carouselUnitPoint(index: number, count: number, elapsedMs: number): CellPoint {
  return ringPoint(index, count, CAROUSEL_UNIT_RADIUS, (Math.max(0, elapsedMs) / CAROUSEL_ORBIT_MS) * Math.PI * 2);
}
export function clampToRadius(point: CellPoint, radius: number): CellPoint {
  const length = Math.hypot(point.x, point.y);
  return length <= radius ? point : { x: point.x / length * radius, y: point.y / length * radius };
}
/** Milliseconds a straight walk takes. */
export function walkMs(from: CellPoint, to: CellPoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y) / LEGEND_CELLS_PER_SECOND * 1000;
}
/** Where a walk is at `at` (server or local clock, as its times are). */
export function walkPoint(walk: Pick<LegendWalk, 'from' | 'to' | 'startedAt' | 'arriveAt'>, at: number): CellPoint {
  const span = walk.arriveAt - walk.startedAt;
  const t = span <= 0 ? 1 : Math.min(1, Math.max(0, (at - walk.startedAt) / span));
  return { x: walk.from.x + (walk.to.x - walk.from.x) * t, y: walk.from.y + (walk.to.y - walk.from.y) * t };
}
/**
 * A walk from `from` that meets the turning unit `index` of `count`, starting `elapsedMs` into the carousel: the point it
 * meets it and how long that takes. The ring turns far slower than a legend runs, so a few refinements settle it.
 */
export function interceptCarouselUnit(from: CellPoint, index: number, count: number, elapsedMs: number): { readonly to: CellPoint; readonly ms: number } {
  let ms = 0, to = carouselUnitPoint(index, count, elapsedMs);
  for (let step = 0; step < 12; step++) { // each step shrinks the miss by unit speed / legend pace (about 0.13)
    ms = walkMs(from, to);
    to = carouselUnitPoint(index, count, elapsedMs + ms);
  }
  return { to, ms: walkMs(from, to) };
}

/** v26 approved pickup circle: the legend's center enters this radius, in cells. Shared with the 3D ring. */
export const CAROUSEL_UNIT_PICK_RADIUS = 0.55;
/** First contact while walking, then while standing at the destination through `untilAt`.
 * Moving segments retain the 10 ms sampling and entry refinement; idle orbit contact is solved analytically.
 * Ownership and grants still go through the carousel rules. No real clock is read here.
 */
export function carouselWalkContact(walk: LegendWalk, index: number, count: number, openedAt: number, untilAt = walk.arriveAt): number | null {
  const end = Math.min(walk.arriveAt, untilAt), span = end - walk.startedAt;
  const touches = (at: number) => {
    const legend = walkPoint(walk, at), unit = carouselUnitPoint(index, count, at - openedAt);
    return Math.hypot(legend.x - unit.x, legend.y - unit.y) <= CAROUSEL_UNIT_PICK_RADIUS;
  };
  if (untilAt < walk.startedAt) return null;
  if (touches(walk.startedAt)) return walk.startedAt;
  const steps = Math.ceil(span / 10);
  for (let i = 1; i <= steps; i++) {
    const at = walk.startedAt + span * i / steps;
    if (!touches(at)) continue;
    let lo = walk.startedAt + span * (i - 1) / steps, hi = at;
    for (let refine = 0; refine < 24; refine++) {
      const mid = (lo + hi) / 2;
      if (touches(mid)) hi = mid; else lo = mid;
    }
    return hi;
  }
  if (untilAt <= walk.arriveAt) return null;
  const point = walk.to, radius = Math.hypot(point.x, point.y);
  if (Math.abs(radius - CAROUSEL_UNIT_RADIUS) > CAROUSEL_UNIT_PICK_RADIUS || radius === 0) return null;
  const half = Math.acos(Math.max(-1, Math.min(1, (radius * radius + CAROUSEL_UNIT_RADIUS ** 2 - CAROUSEL_UNIT_PICK_RADIUS ** 2) / (2 * radius * CAROUSEL_UNIT_RADIUS))));
  const turn = Math.PI * 2, speed = turn / CAROUSEL_ORBIT_MS;
  const start = Math.max(walk.startedAt, walk.arriveAt);
  if (touches(start)) return start;
  const angle = index / Math.max(1, count) * turn + Math.max(0, start - openedAt) * speed;
  const entry = Math.atan2(point.x, point.y) - half;
  const delta = ((entry - angle) % turn + turn) % turn;
  const at = start + delta / speed;
  return at <= untilAt ? at : null;
}
