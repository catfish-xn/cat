/**
 * Presentation-only cast lunges (10-23 playtest: 安蓓萨的技能没有冲出去打). The rules keep the caster on its cell; in the
 * 3D view its model dashes most of the way to the cast's first target, holds a moment and comes back, all within
 * `seconds`. Only the drawn body moves (placeholder-renderer.ts offsets it under the root): the root, facing,
 * bars and grounding stay on the authoritative cell. Kept apart from the renderer so the curve is testable on numbers.
 */

export interface CastLungeSpec {
  /** Share of the caster→target distance the model travels (stopping short of the target's body). */
  readonly ratio: number;
  /** Seconds from leaving the cell to standing on it again. */
  readonly seconds: number;
}

/** Champions whose cast is drawn as a lunge, by definitionId. */
export const CAST_LUNGE: Readonly<Record<string, CastLungeSpec>> = {
  ambessa: { ratio: 0.7, seconds: 0.55 },
};

export const castLungeFor = (definitionId: string): CastLungeSpec | undefined => CAST_LUNGE[definitionId];

/** Shares of the duration spent going out and coming back; the rest is the hold at the far point. */
const OUT = 0.3, BACK = 0.4;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

/** How far along its offset (0 at the cell, 1 at the far point) a lunge is `elapsed` seconds in; 0 once it is over. */
export function lungeReach(elapsed: number, seconds: number): number {
  if (!(seconds > 0) || elapsed <= 0 || elapsed >= seconds) return 0;
  const t = elapsed / seconds;
  if (t < OUT) return easeOut(t / OUT);
  if (t < 1 - BACK) return 1;
  return 1 - easeInOut((t - (1 - BACK)) / BACK);
}

/** One lunge in flight: a fixed board-plane offset (x, z) to the far point, scaled by lungeReach over time. */
export class CastLunge {
  private elapsed = 0;
  constructor(readonly dx: number, readonly dz: number, readonly seconds: number) {}
  /** Advances the lunge; returns the current world offset, or null once it has finished (offset back to zero). */
  update(seconds: number): { x: number; z: number } | null {
    this.elapsed += seconds;
    if (this.elapsed >= this.seconds) return null;
    const reach = lungeReach(this.elapsed, this.seconds);
    return { x: this.dx * reach, z: this.dz * reach };
  }
}
