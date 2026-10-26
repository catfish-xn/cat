/*! @license GPL-3.0-or-later
 * Derived from ltk-manager (GPL-3.0-or-later).
 * Source: src/modules/workshop/bin/vfx/engine/utils/analyticDrag.ts
 * Port/adaptation: catfish-xn/cat, 2026-10-26. See NOTICE.md and LICENSE.
 */
/**
 * `kAnalyticDragMotion`'s closed form, one axis at a time.
 *
 * Decision 2.39 of docs/plans/vfx-particle-renderer.md.
 */

/** Where one axis eases out to, `birthVelocity / birthDrag`, and nothing without a birth drag. */
export function analyticTerminal(velocity: number, birthDrag: number): number {
  return birthDrag > 0 ? velocity / birthDrag : 0;
}

/** What of an axis's terminal displacement is still to travel at `age` under `drag`. */
export function analyticOffset(terminal: number, drag: number, age: number): number {
  return Math.exp(-drag * age) * terminal;
}
