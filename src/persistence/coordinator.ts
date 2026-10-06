import type { CapturedSave, SaveStatus, SlotToken } from '../m6/contracts';
import { SaveError, saveError } from './repository';

export interface SaveWriter { commit(expected: SlotToken, snapshot: CapturedSave): Promise<SlotToken> }
/** Latest fixed state plus all immutable additions from superseded pending captures. */
function merge(older: CapturedSave | null, newer: CapturedSave): CapturedSave {
  if (!older) return newer;
  const additions = new Map(older.addedBattles.map(record => [record.combatId, record]));
  // A completed record is immutable. Keep the first captured copy for a repeated key.
  for (const record of newer.addedBattles) if (!additions.has(record.combatId)) additions.set(record.combatId, record);
  return { ...newer, addedBattles: [...additions.values()] };
}
/** One in-flight transaction and at most one latest pending capture, even during quota failure. */
export class SaveCoordinator {
  private current: SlotToken;
  private pending: CapturedSave | null = null;
  private running: Promise<void> | null = null;
  private failure: SaveError | null = null;
  private disposed = false;
  constructor(private readonly repository: SaveWriter, token: SlotToken, private readonly onStatus: (status: SaveStatus) => void) { this.current = { ...token }; }
  get token(): SlotToken { return { ...this.current }; }
  /** Read-only evidence/diagnostic count; excludes the sole in-flight transaction. */
  get pendingCount(): number { return this.pending ? 1 : 0; }
  enqueue(snapshot: CapturedSave): void {
    if (this.disposed || this.failure?.reason === 'conflict') return;
    this.pending = merge(this.pending, structuredClone(snapshot));
    this.failure = null;
    this.start();
  }
  private notify(status: SaveStatus): void { if (!this.disposed) this.onStatus(status); }
  private start(): void {
    if (this.running || this.disposed || this.failure || !this.pending) return;
    this.running = this.drain().finally(() => { this.running = null; if (!this.failure && !this.disposed && this.pending) this.start(); });
  }
  private async drain(): Promise<void> {
    while (!this.disposed && this.pending) {
      const snapshot = this.pending;
      this.pending = null;
      this.notify({ kind: 'saving' });
      try {
        this.current = await this.repository.commit(this.current, snapshot);
        this.notify({ kind: 'saved', at: new Date().toISOString(), token: this.token });
      } catch (error) {
        if (this.disposed) return;
        this.failure = saveError(error);
        // Preserve newly completed records from the failed transaction, but keep the
        // latest queued legal tick. A prolonged failure must not retain every tick.
        this.pending = this.pending ? merge(snapshot, this.pending) : snapshot;
        this.notify({ kind: 'failed', reason: this.failure.reason, message: this.failure.message });
        return;
      }
    }
  }
  async flush(): Promise<void> {
    if (this.disposed) throw new SaveError('unavailable', '保存协调器已关闭');
    if (this.failure?.reason === 'conflict') throw this.failure;
    this.failure = null;
    this.start();
    while (this.running) await this.running;
    if (this.failure) throw this.failure;
  }
  /** In-flight transaction may finish; all callbacks are fenced and no later write starts. */
  dispose(): void { this.disposed = true; this.pending = null; }
}
