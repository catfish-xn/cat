/**
 * Read-only bridge from the 2D BoardScene to the optional 3D layer (?render=3d). Without a subscriber every
 * publish is a single boolean check, so the default 2D path builds nothing. Display only: no commands, no rules.
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
}
export interface BoardFeedListener { frame(frame: BoardFrame): void; events(events: readonly DisplayCombatEvent[]): void }

let listener: BoardFeedListener | null = null;

export const boardFeedActive = (): boolean => listener !== null;
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
