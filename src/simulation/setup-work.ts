/** Drain the same deterministic work used by cooperative callers. No clock or RNG. */
export function drainSetup<T>(work: Generator<void, T, void>): T {
  for (;;) { const next = work.next(); if (next.done) return next.value; }
}
