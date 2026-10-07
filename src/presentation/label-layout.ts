/**
 * Collision-free placement for short canvas labels (cast names, effect/growth tags).
 * Each label is placed once when it appears and keeps its slot until it fades; later labels
 * step away from the piece until they find a free slot, or are skipped when the area is full.
 * The DOM numeric floats treat the placed rects as obstacles, so numbers never sit on labels.
 * Pure: board logical coordinates in, rects out.
 */
export interface LabelRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

const GAP = 2, STEPS = 4;

const overlaps = (a: LabelRect, b: LabelRect) => Math.abs(a.x - b.x) * 2 < a.w + b.w + GAP * 2 && Math.abs(a.y - b.y) * 2 < a.h + b.h + GAP * 2;

/** `dy` is the preferred centre offset from the anchor; negative stacks upwards, positive downwards. */
export function placeLabel(anchor: { x: number; y: number }, w: number, h: number, dy: number,
  taken: readonly LabelRect[], bounds: { width: number; height: number }): LabelRect | null {
  const x = Math.max(w / 2, Math.min(bounds.width - w / 2, anchor.x));
  // Preferred side first; near the board edge fall back to the mirrored side of the piece.
  for (const offset of [dy, -dy]) {
    const step = (h + GAP) * Math.sign(offset || -1);
    for (let i = 0; i < STEPS; i++) {
      const y = anchor.y + offset + step * i;
      if (y - h / 2 < 0 || y + h / 2 > bounds.height) break;
      const rect = { x, y, w, h };
      if (!taken.some(other => overlaps(rect, other))) return rect;
    }
  }
  return null;
}

/** Label rects a canvas (e.g. the replay view) drew this frame, keyed by element, for the numeric floats to avoid. */
export const canvasLabelRects = new WeakMap<object, readonly LabelRect[]>();
