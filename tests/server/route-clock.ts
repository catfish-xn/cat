import { ManualClock, type ClockHandle } from '../../src/server/room/clock';

/** Keeps runNext timer groups observable while a case pauses between same-time continuations. */
export class RouteClock extends ManualClock {
  private readonly due = new Map<ClockHandle, number>();
  override schedule(at: number, fn: () => void): ClockHandle {
    const handle = super.schedule(at, () => { this.due.delete(handle); fn(); });
    this.due.set(handle, at); return handle;
  }
  override cancel(handle: ClockHandle): void { this.due.delete(handle); super.cancel(handle); }
  get nextAt(): number | undefined {
    return this.due.size ? Math.min(...this.due.values()) : undefined;
  }
}
