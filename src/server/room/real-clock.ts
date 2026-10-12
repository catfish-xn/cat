/**
 * The only server file allowed to touch the real clock. Wraps `performance.now()` and
 * `setTimeout` behind the injectable Clock interface, so Room, Lobby and the network layer
 * stay testable with ManualClock. Times are integer milliseconds since the server started.
 */
import type { Clock, ClockHandle } from './clock';

export class RealClock implements Clock {
  private readonly timers = new Map<ClockHandle, ReturnType<typeof setTimeout>>();
  private nextHandle = 1;

  now(): number { return Math.round(performance.now()); }

  schedule(at: number, fn: () => void): ClockHandle {
    const handle = this.nextHandle++;
    const timer = setTimeout(() => { this.timers.delete(handle); fn(); }, Math.max(0, at - this.now()));
    this.timers.set(handle, timer);
    return handle;
  }

  cancel(handle: ClockHandle): void {
    const timer = this.timers.get(handle);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.timers.delete(handle);
  }

  get pending(): number { return this.timers.size; }

  /** Cancels every outstanding timer (server shutdown). */
  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
