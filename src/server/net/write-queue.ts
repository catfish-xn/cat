/**
 * The room's single logical writer (V2 §5.1): every inbound message and every room push is a
 * task that runs to completion in arrival order. A task queued while another task runs (for
 * example a room listener firing inside Room.handle) runs after the current one, never nested.
 */
export class WriteQueue {
  private readonly tasks: Array<() => void> = [];
  private draining = false;
  private processed = 0;

  constructor(private readonly onError: (error: unknown) => void = () => {}) {}

  get depth(): number { return this.tasks.length; }
  get completed(): number { return this.processed; }

  push(task: () => void): void {
    this.tasks.push(task);
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.tasks.length > 0) {
        const next = this.tasks.shift()!;
        try { next(); } catch (error) { this.onError(error); }
        this.processed += 1;
      }
    } finally { this.draining = false; }
  }
}
