/**
 * Real-time Clock adapter (work order C3). This is the ONLY file under src/server allowed to
 * touch the real clock and real timers (see tests/server/purity.test.ts); the room itself
 * stays pure and is driven through the Clock interface. `now()` is performance.now(), so the
 * in-browser client's countdown (also performance.now() based) needs no offset correction.
 */
import type { Clock, ClockHandle } from './clock';

export class RealClock implements Clock {
  private readonly timers = new Map<ClockHandle, ReturnType<typeof setTimeout>>();
  private nextHandle = 1;
  now(): number { return performance.now(); }
  schedule(at: number, fn: () => void): ClockHandle {
    const handle = this.nextHandle++;
    const timer = setTimeout(() => { this.timers.delete(handle); fn(); }, Math.max(0, at - this.now()));
    this.timers.set(handle, timer);
    return handle;
  }
  cancel(handle: ClockHandle): void {
    const timer = this.timers.get(handle);
    if (timer === undefined) return;
    clearTimeout(timer); this.timers.delete(handle);
  }
  get pending(): number { return this.timers.size; }
  /** Cancels every pending timer (used when the owning client is disposed). */
  dispose(): void { for (const timer of this.timers.values()) clearTimeout(timer); this.timers.clear(); }
}
