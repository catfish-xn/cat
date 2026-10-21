/**
 * Little-legend (小小英雄) movement shared by the room and the 3D layer: one geometry and one pace, so the server's
 * arrival time and the drawn walk agree. Pure, no imports. Points are in cells: on the carousel the platform's center is
 * the origin and x/y are the 3D x/z; on a board they are hex widths from the board origin in the owner's orientation.
 *
 * A walk is a straight line at LEGEND_CELLS_PER_SECOND. On the carousel the room plans every walk from where it last
 * left that seat's legend and, for a walk toward a unit, aims where the turning unit will be on arrival; the pick is the
 * room's at that moment, so whoever arrives first takes it. On a board the walk is display only and the room relays it.
 */
export type LegendScene = 'carousel' | 'board';
export interface CellPoint { readonly x: number; readonly y: number }
/** What a client asks: walk to a point, or (carousel) to the unit on `slot`. */
export interface LegendWalkRequest { readonly scene: LegendScene; readonly to?: CellPoint; readonly slot?: number; readonly from?: CellPoint }
/** One walk as the room published it; times are the server clock (ms). */
export interface LegendWalk {
  readonly seatId: string;
  readonly scene: LegendScene;
  readonly from: CellPoint;
  readonly to: CellPoint;
  readonly startedAt: number;
  readonly arriveAt: number;
  /** The carousel unit it heads for; the room asks the rules for that pick on arrival. */
  readonly slot: number | null;
}

export const LEGEND_CELLS_PER_SECOND = 5;
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
  for (let step = 0; step < 6; step++) {
    ms = walkMs(from, to);
    to = carouselUnitPoint(index, count, elapsedMs + ms);
  }
  return { to, ms: walkMs(from, to) };
}
