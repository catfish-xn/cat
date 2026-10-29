/*! @license GPL-3.0-or-later
 * Derived from ltk-manager (GPL-3.0-or-later).
 * Source: src/modules/workshop/bin/vfx/engine/simulation/stepper.ts
 * Port/adaptation: catfish-xn/cat, 2026-10-26. See NOTICE.md and LICENSE.
 */
import type { Stepping } from "../model/model";

/** One slice of simulation time, as the integrator runs one. */
export interface Step {
  /** Seconds the step advances the simulation by. */
  readonly dt: number;
  /** The time the step ends at, which is what a particle's age is measured against. */
  readonly now: number;
}

/** How a frame's elapsed time becomes simulation steps. */
export interface Stepper {
  /** The steps `frameTime` seconds buys, in the order they run. */
  advance(frameTime: number): Step[];
  /** Puts the clock at `now` and drops whatever time is banked. */
  reset(now?: number): void;
  /** The time the last step ended at. */
  readonly now: number;
}

/**
 * How many steps one `advance` runs at the authored period before it coarsens, the
 * client's own cap.
 *
 * A larger backlog halves the count and doubles `dt` until it fits, and what the halving
 * leaves over is banked for the next frame.
 */
export const MAX_STEPS = 20;

/** A stepper that runs one step per frame, however long the frame was. */
const NO_STEPS: Step[] = [];
export function variableStepper(now = 0): Stepper {
  let clock = now;
  const step = { dt: 0, now: 0 };
  const once: Step[] = [step];

  return {
    get now() {
      return clock;
    },
    advance(frameTime) {
      if (frameTime <= 0) return NO_STEPS;
      clock += frameTime;
      step.dt = frameTime; step.now = clock;
      return once;
    },
    reset(to = 0) {
      clock = to;
    },
  };
}

/**
 * A stepper that banks frame time and spends it in whole steps of `1 / rate`.
 *
 * If `everyFrame` is true, a frame that banks less than one whole step runs one step of the
 * banked time instead of none.
 */
export function fixedRateStepper(rate: number, now = 0, everyFrame = false): Stepper {
  let clock = now;
  let banked = 0;
  const steps: { dt: number; now: number }[] = [];

  return {
    get now() {
      return clock;
    },
    advance(frameTime) {
      if (frameTime > 0) banked += frameTime;

      let count = Math.floor(banked * rate);
      if (count <= 0 && everyFrame && banked > 0) {
        clock += banked;
        const step = steps[0] ?? (steps[0] = { dt: 0, now: 0 });
        step.dt = banked; step.now = clock;
        banked = 0;
        steps.length = 1;
        return steps;
      }
      if (count <= 0) return NO_STEPS;

      /* The client halves the count as a float and truncates once, after the loop. */
      let dt = 1 / rate;
      let halved = count;
      while (halved > MAX_STEPS) {
        halved *= 0.5;
        dt *= 2;
      }
      count = Math.trunc(halved);
      banked -= count * dt;

      steps.length = count;
      for (let at = 0; at < count; at += 1) {
        clock += dt;
        const step = steps[at] ?? (steps[at] = { dt: 0, now: 0 });
        step.dt = dt; step.now = clock;
      }
      return steps;
    },
    reset(to = 0) {
      clock = to;
      banked = 0;
    },
  };
}

/**
 * Returns the stepper a system with `stepping` runs on, from `now`.
 *
 * `oncePerFrame` takes one step per frame. Any other system takes whole steps at the effects
 * quality's rate, with the `everyFrame` fallback for a short frame.
 */
export function stepperFor(stepping: Stepping, now = 0): Stepper {
  if (stepping.oncePerFrame) return variableStepper(now);
  return fixedRateStepper(stepping.rate, now, stepping.everyFrame);
}
