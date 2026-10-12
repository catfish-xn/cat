/** Injectable clock: the room never reads a real clock or a real timer. */
export type ClockHandle = number;
export interface Clock {
  now(): number;
  /** Runs `fn` once the clock reaches `at` (immediately on the next advance when `at` is in the past). */
  schedule(at: number, fn: () => void): ClockHandle;
  cancel(handle: ClockHandle): void;
}

interface Timer { readonly handle: ClockHandle; readonly at: number; readonly fn: () => void }

/** Test clock: time moves only through advance(); due callbacks fire in order of their time, then insertion. */
export class ManualClock implements Clock {
  private current: number;
  private timers: Timer[] = [];
  private nextHandle = 1;
  constructor(start = 0) { this.current = start; }
  now(): number { return this.current; }
  schedule(at: number, fn: () => void): ClockHandle {
    const handle = this.nextHandle++;
    this.timers.push({ handle, at, fn });
    return handle;
  }
  cancel(handle: ClockHandle): void { this.timers = this.timers.filter(timer => timer.handle !== handle); }
  get pending(): number { return this.timers.length; }
  /** Advances to now + ms, firing every timer due on the way; callbacks may schedule further timers. */
  advance(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) throw new RangeError('advance expects a non-negative duration');
    const target = this.current + ms;
    for (;;) {
      const due = this.timers.filter(timer => timer.at <= target).sort((a, b) => a.at - b.at || a.handle - b.handle)[0];
      if (!due) break;
      this.timers = this.timers.filter(timer => timer.handle !== due.handle);
      this.current = Math.max(this.current, due.at);
      due.fn();
    }
    this.current = target;
  }
  /** Fires the next timer regardless of how far away it is; returns false when none is pending. */
  runNext(): boolean {
    const next = [...this.timers].sort((a, b) => a.at - b.at || a.handle - b.handle)[0];
    if (!next) return false;
    this.advance(Math.max(0, next.at - this.current));
    return true;
  }
}
