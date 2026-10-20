/**
 * Bridge between the 2D BoardScene and the optional 3D layer (?render=3d). Without a subscriber every publish is a
 * single boolean check, so the default 2D path builds nothing. Frames and events flow out read-only; input flows back
 * only through BoardControls, which BoardScene implements with its own 2D gesture code and the same session commands.
 */
import type { DisplayCombatEvent } from '../presentation/combat-display';

export interface BoardPiece {
  readonly id: string; readonly definitionId: string; readonly team: 'player' | 'enemy'; readonly starLevel: number;
  /** BoardScene logical coordinates of the drawn token (tweens included); 3D maps x→x and y→z. */
  readonly x: number; readonly y: number; readonly visible: boolean;
}
export interface BoardFrame {
  readonly rows: number; readonly columns: number; readonly hexRadius: number; readonly origin: { readonly x: number; readonly y: number };
  readonly bench: readonly { readonly x: number; readonly y: number }[];
  readonly pieces: readonly BoardPiece[];
  /** True while a combat is shown; the 3D layer resets per-unit action state when this flips. */
  readonly fighting: boolean;
  /** The unit BoardScene is dragging (either input), or null; the 3D layer drops its own drag once this clears. */
  readonly dragging: string | null;
}
export interface BoardDropHint {
  /** Where the dragged unit would land, as BoardScene's own hit test reads the point; undefined over nothing. */
  readonly target?: { readonly kind: 'board'; readonly x: number; readonly y: number } | { readonly kind: 'bench'; readonly x: number; readonly y: number };
  /** False when the 2D board would refuse the drop (the status line says why); the session still decides. */
  readonly allowed: boolean;
}
/**
 * The 3D layer's pointer, replayed as 2D board gestures. Points are BoardScene logical coordinates (3D x→x, z→y);
 * `client` is the CSS pixel position, used to tell a release over the shop (sell) from one over the board.
 */
export interface BoardControls {
  hover(id: string | null): void;
  select(id: string): void;
  /** False when the 2D board would not let this unit be dragged now. */
  dragStart(id: string): boolean;
  dragMove(point: { x: number; y: number }): BoardDropHint;
  dragEnd(point: { x: number; y: number } | null, client: { x: number; y: number }): void;
  dragCancel(): void;
}
export interface BoardFeedListener {
  frame(frame: BoardFrame): void; events(events: readonly DisplayCombatEvent[]): void;
  /** The visible piece (either team) drawn under a CSS-pixel point, by the layer's own picking; undefined over none. */
  unitAt?(client: { x: number; y: number }): string | undefined;
  /** CSS-pixel box of the drawn piece as the layer projects it; undefined when the piece is not drawn or off screen. */
  screenBox?(id: string): BoardScreenBox | undefined;
}
export interface BoardScreenBox { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

let listener: BoardFeedListener | null = null, controls: BoardControls | null = null;

export const boardFeedActive = (): boolean => listener !== null;
/** null when no layer answers (2D picks itself); otherwise the layer's piece under the point, if any. */
export function boardFeedUnitAt(client: { x: number; y: number }): string | undefined | null {
  return listener?.unitAt ? listener.unitAt(client) : null;
}
/** null when no layer answers (2D places its own cards); otherwise where the layer drew the piece, if anywhere. */
export function boardFeedScreenBox(id: string): BoardScreenBox | undefined | null {
  return listener?.screenBox ? listener.screenBox(id) : null;
}
export function publishBoardFrame(build: () => BoardFrame): void { if (listener) listener.frame(build()); }
export function publishCombatEvents(build: () => readonly DisplayCombatEvent[]): void {
  if (!listener) return;
  const events = build();
  if (events.length) listener.events(events);
}
/** One 3D layer at a time; the returned function detaches it. */
export function subscribeBoardFeed(next: BoardFeedListener): () => void {
  listener = next;
  return () => { if (listener === next) listener = null; };
}
/** BoardScene registers its controls while it runs; the returned function withdraws them. */
export function provideBoardControls(next: BoardControls): () => void {
  controls = next;
  return () => { if (controls === next) controls = null; };
}
/** What three-loader.ts hands the 3D chunk (it must not import this module itself; see placeholder-renderer.ts). */
export interface BoardFeed { subscribe(next: BoardFeedListener): () => void; controls(): BoardControls | null }
export const boardFeed: BoardFeed = { subscribe: subscribeBoardFeed, controls: () => controls };
