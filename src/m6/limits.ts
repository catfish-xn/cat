/** F1 measured engineering limits; evidence and measurement scope: M6_GOAL.md. */
export const MAX_SAVE_BYTES = 256 * 1024 * 1024;
export const MAX_BATTLE_RECORDS = 30;
export const MAX_EVENTS_PER_BATTLE = 100_000;
export const AUTOSAVE_TICKS = 40;
export const MAX_COMPLETED_RUNS = 3;
export const CHECKPOINT_INTERVAL_TICKS = 40;
export const MIN_PIECE_DIAMETER_CSS = 32;
export const MIN_DOM_TARGET_CSS = 44;
export const MAX_HORIZONTAL_OVERFLOW_CSS = 0;
export const PERFORMANCE_BUDGET_MS = Object.freeze({
  incrementalCaptureP95: 50, incrementalWriteP95: 250,
  fullCaptureP95: 500, activationWriteP95: 1000,
  completeImport: 30_000, firstSeek: 2000, cachedSeek: 100,
  stats40TickBatch: 5,
});
/** Performance budget is a regression gate, never a wall-clock save validity rule. */
export const LIFECYCLE_CYCLES = 30;
export const MAX_POST_GC_HEAP_GROWTH_BYTES = 1024 * 1024;
