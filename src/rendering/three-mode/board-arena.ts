/**
 * The arena scene under the 3D hex board (assets manifest `boards`): an original TFT board model placed so its own
 * hex cells sit on the live grid. Display only: picking and commands keep using the grid math (picking.ts), never
 * this model. Without a board in the manifest, or until its model loads, the procedural tiles stay as they are.
 */
import { Group, Vector3 } from 'three';
import type { BoardAlignment } from '../../rendering3d';
import type { ModelLease } from '../../rendering3d';

/** The default arena key (first-visit asset root); other boards are optional roots chosen later. */
export const DEFAULT_BOARD = 'board-default';

export interface HexFrame { readonly hexRadius: number; readonly origin: { readonly x: number; readonly y: number } }

/**
 * Root transform for a live grid. The alignment maps source → a reference grid (target radius/origin); hexCenter is
 * linear in radius and origin, so another grid is the same placement scaled by radius/target.radius about the origins.
 */
export function arenaTransform(alignment: BoardAlignment, frame: HexFrame): { position: Vector3; scale: Vector3 } {
  const k = frame.hexRadius / alignment.target.radius, [ox, oy, oz] = alignment.offset, [sx, sy, sz] = alignment.scale;
  return {
    position: new Vector3(frame.origin.x + k * (ox - alignment.target.origin.x), k * oy, frame.origin.y + k * (oz - alignment.target.origin.y)),
    scale: new Vector3(k * sx, k * sy, k * sz),
  };
}

export interface BoardArena {
  /** True once the arena model is in the scene (the procedural tiles can then fade back to a grid overlay). */
  readonly ready: boolean;
  /** Re-places the arena for a (new) grid; cheap, called on every board rebuild. */
  place(frame: HexFrame): void;
  dispose(): void;
}

/** Loads `key` once; `onReady` fires when it is placed. A missing or placeholder model leaves no arena. */
export function createBoardArena(parent: Group, alignment: BoardAlignment, load: () => Promise<ModelLease>, onReady: () => void): BoardArena {
  const root = new Group();
  root.name = 'render3d-board-arena';
  let lease: ModelLease | null = null, frame: HexFrame | null = null, disposed = false;
  const apply = () => {
    if (!frame) return;
    const { position, scale } = arenaTransform(alignment, frame);
    root.position.copy(position); root.scale.copy(scale);
  };
  void load().then(loaded => {
    if (disposed || loaded.placeholder) { loaded.release(); return; }
    lease = loaded;
    root.add(loaded.scene);
    parent.add(root);
    apply();
    onReady();
  }).catch(() => { /* keeps the procedural board */ });
  return {
    get ready() { return lease !== null; },
    place(next) { frame = next; apply(); },
    dispose() { disposed = true; root.removeFromParent(); lease?.release(); lease = null; },
  };
}
