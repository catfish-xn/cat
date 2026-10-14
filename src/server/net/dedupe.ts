/**
 * Per-seat commandId dedupe (V2 §5.2). Same id + same content → the original receipt; same id +
 * other content → refused; an id older than the retention span and never seen → refused with a
 * resync demand, never executed as new. Pure: digests are computed by the caller.
 */
export type DedupeVerdict<Receipt> =
  | { readonly kind: 'new' }
  | { readonly kind: 'replay'; readonly receipt: Receipt }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'expired' };

interface Entry<Receipt> { readonly digest: string; readonly receipt: Receipt }

export const DEFAULT_DEDUPE_WINDOW = 256;

export class CommandDedupe<Receipt> {
  private readonly entries = new Map<number, Entry<Receipt>>();
  private highest = 0;

  constructor(readonly retention = DEFAULT_DEDUPE_WINDOW) {
    if (!Number.isInteger(retention) || retention < 1) throw new RangeError('dedupe retention must be a positive integer');
  }

  get size(): number { return this.entries.size; }
  get highestSeen(): number { return this.highest; }

  check(commandId: number, digest: string): DedupeVerdict<Receipt> {
    const entry = this.entries.get(commandId);
    if (entry) return entry.digest === digest ? { kind: 'replay', receipt: entry.receipt } : { kind: 'conflict' };
    if (this.highest - commandId >= this.retention) return { kind: 'expired' };
    return { kind: 'new' };
  }

  /** Stores the receipt; when the retention overflows the lowest id is forgotten (it is `expired` from then on). */
  record(commandId: number, digest: string, receipt: Receipt): void {
    this.entries.set(commandId, { digest, receipt });
    if (commandId > this.highest) this.highest = commandId;
    while (this.entries.size > this.retention) {
      let lowest = Number.POSITIVE_INFINITY;
      for (const id of this.entries.keys()) if (id < lowest) lowest = id;
      this.entries.delete(lowest);
    }
  }
}
