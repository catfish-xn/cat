/** Observed replay spacing only: never predicts an attack or changes combat timing. */
export class AttackCadence {
  private lastTick: number | undefined;
  private interval: number | undefined;
  get intervalSeconds(): number | undefined { return this.interval; }
  observe(tick: number): void {
    if (!Number.isSafeInteger(tick) || tick < 0 || this.lastTick !== undefined && tick <= this.lastTick) return;
    if (this.lastTick !== undefined) this.interval = (tick - this.lastTick) * 0.05;
    this.lastTick = tick;
  }
  /** A cast, walk or control can delay the next attack; that gap is not attack speed. */
  pause(): void { this.lastTick = undefined; }
  reset(): void { this.pause(); this.interval = undefined; }
}
