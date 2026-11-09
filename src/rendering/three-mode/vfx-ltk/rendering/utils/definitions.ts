/*! @license GPL-3.0-or-later
 * Derived from ltk-manager (GPL-3.0-or-later).
 * Source: src/modules/workshop/bin/vfx/rendering/utils/definitions.ts
 * Port/adaptation: catfish-xn/cat, 2026-10-26. See NOTICE.md and LICENSE.
 */
import type { EmitterModel, SystemModel } from "../../engine/model/model";
import { childPath, childPrefix, MAX_CHILD_DEPTH } from "../../engine/simulation/children";
import { drawRanks, GROUND_ORDER } from "./drawKind";

/** One emitter definition as the viewport draws it, at any depth of the child sets. */
export interface DrawnEmitter {
  /** Unique across the tree, which the emitter's textures and geometry are keyed by. */
  readonly key: string;
  readonly emitter: EmitterModel;
  /** The child path its sources come from, and empty for an emitter of the opened system. */
  readonly path: string;
  /** The index of the opened system's emitter it descends from, which solo narrows to. */
  readonly root: number;
  /**
   * Where it falls in the draw order: its `pass`, then the opened system's emitters first and
   * each child's after, and a ground-layer emitter under [`GROUND_ORDER`] before them all.
   */
  readonly rank: number;
}

/** What a run leaves out of its draw: the opened system's emitters by pool index, children by path. */
export interface DrawVisibility {
  readonly muted: ReadonlySet<number>;
  readonly soloed: ReadonlySet<number>;
  readonly mutedChildren: ReadonlySet<string>;
  readonly soloedChildren: ReadonlySet<string>;
}

/** Whether any emitter or child of `run` is soloed. */
export function anySolo(run: DrawVisibility): boolean {
  return run.soloed.size > 0 || run.soloedChildren.size > 0;
}

/** Whether `path` is one of the child `paths` or a child under one. */
export function underChild(paths: ReadonlySet<string>, path: string): boolean {
  if (path === "") return false;

  for (const each of paths) {
    if (path === each || path.startsWith(childPrefix(each))) return true;
  }
  return false;
}

/**
 * Whether `run` leaves `definition` out of the draw.
 *
 * A muted emitter hides its children, and a muted child hides the children under it. With
 * any solo set, a definition draws only under a soloed emitter or a soloed child.
 */
export function hiddenIn(
  definition: Pick<DrawnEmitter, "root" | "path">,
  run: DrawVisibility,
): boolean {
  if (run.muted.has(definition.root) || underChild(run.mutedChildren, definition.path)) {
    return true;
  }
  if (!anySolo(run)) return false;

  return !run.soloed.has(definition.root) && !underChild(run.soloedChildren, definition.path);
}

/** How many ranks of one tree fit between two adjacent passes. */
const RANK_SPAN = 4096;

/**
 * The bound of [`passOrder`]: every particle stays inside ±90, under the board's damage numbers
 * (100) and star rows (1000) and over the stage and ground layers far below.
 */
export const PASS_ORDER_LIMIT = 90;

/** `pass` is a signed 16-bit field. */
const PASS_MAX = 32768;
const PASS_LOG = Math.log1p(PASS_MAX);

/**
 * `pass` mapped strictly increasing into (-90, 90): sign · log, so every distinct pass keeps its
 * own place (11-09 survey: 5584 emitters, passes from -9999 to 32767, 870 at 100 or more) while
 * none reaches another object's order. Small passes, the bulk, keep the widest spacing.
 */
export function passOrder(pass: number): number {
  const p = Math.max(-PASS_MAX, Math.min(PASS_MAX, pass));
  return Math.sign(p) * PASS_ORDER_LIMIT * Math.log1p(Math.abs(p)) / PASS_LOG;
}

/**
 * `rank` as the draw order, which a ground-layer emitter takes under the character.
 *
 * The engine sorts every live emitter by `pass` first, across systems, so the order is the
 * pass with the tree's own rank as a fraction of the gap to the next pass: two systems drawn
 * together interleave by pass, and one tree keeps the comparator's order within a pass.
 * Sevika's slot icons (pass 33/34, their own system) draw over the machine's reel backs
 * (pass 30) and under its white lock-in flashes (45) and border (50); a bare rank drew the 33
 * backs and boards of the machine over the icons' 10 emitters (11-09 #579 recording: every reel empty).
 */
function orderOf(emitter: EmitterModel, rank: number): number {
  const at = passOrder(emitter.pass), gap = passOrder(emitter.pass + 1) - at;
  const order = at + gap * Math.min(rank, RANK_SPAN - 1) / RANK_SPAN;
  return emitter.groundLayer ? GROUND_ORDER + order : order;
}

/**
 * Every emitter the viewport draws: the opened system's, then each child set's in turn.
 *
 * A child reaches the list where a particle of its parent can spawn it: its system was
 * reached, its set names no bones or `posed` says a character is there to spawn them on,
 * and it stands within the depth the simulation caps. Each child ranks after everything
 * listed before it, since a child is a top-level system of its own and the engine sorts
 * emitters within one.
 */
export function drawnEmitters(system: SystemModel, posed = false): DrawnEmitter[] {
  const out: DrawnEmitter[] = [];
  const ranks = drawRanks(system.emitters);
  for (const emitter of system.emitters) {
    out.push({
      key: `${emitter.index}`,
      emitter,
      path: "",
      root: emitter.index,
      rank: orderOf(emitter, ranks.get(emitter.index) ?? 0),
    });
  }
  for (const emitter of system.emitters) collect(out, emitter, "", emitter.index, 1, posed);
  return out;
}

/* The unposed list of each system, which every node preview filters for its own emitter. */
const DRAWN = new WeakMap<SystemModel, readonly DrawnEmitter[]>();

function drawnOf(system: SystemModel): readonly DrawnEmitter[] {
  let drawn = DRAWN.get(system);
  if (drawn === undefined) {
    drawn = drawnEmitters(system);
    DRAWN.set(system, drawn);
  }
  return drawn;
}

/** The entries of `drawnEmitters(system)` that draw `emitter`. */
export function drawnFor(system: SystemModel, emitter: EmitterModel): DrawnEmitter[] {
  return drawnOf(system).filter((each) => each.emitter === emitter);
}

/** The entries of `drawnEmitters(system)` of the child at `path` and of every child under it. */
export function drawnUnder(system: SystemModel, path: string): DrawnEmitter[] {
  const paths = new Set([path]);
  return drawnOf(system).filter((each) => underChild(paths, each.path));
}

function collect(
  out: DrawnEmitter[],
  parent: EmitterModel,
  prefix: string,
  root: number,
  depth: number,
  posed: boolean,
): void {
  const set = parent.childSet;
  if (set === null || parent.disabled || depth > MAX_CHILD_DEPTH) return;
  if (set.bones.length > 0 && !posed && !parent.mesh?.skinned) return;

  set.children.forEach((child, slot) => {
    if (child === null) return;
    const path = childPath(prefix, parent.index, slot);
    const base = out.length;
    const ranks = drawRanks(child.emitters);
    for (const emitter of child.emitters) {
      out.push({
        key: `${path}:${emitter.index}`,
        emitter,
        path,
        root,
        rank: orderOf(emitter, base + (ranks.get(emitter.index) ?? 0)),
      });
    }
    for (const emitter of child.emitters) {
      collect(out, emitter, childPrefix(path), root, depth + 1, posed);
    }
  });
}
