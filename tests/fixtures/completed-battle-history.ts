import { BattleHistory } from '../../src/replay/history';
import type { SessionChange, BattleRecord } from '../../src/m6/contracts';
import type { LedgerCombatEvent } from '../../src/simulation/combat-types';

/** Public-command fixture recorder that only consumes completed records.
 * Keep every event, but snapshot terminal state only at battle end. These
 * fixtures never mutate emitted events or request a live save prefix. */
export class CompletedBattleHistory extends BattleHistory {
  constructor(runId: string, battles: readonly BattleRecord[] = [], currentBattle: BattleRecord | null = null) {
    super(battles[0]?.runId ?? runId, battles, currentBattle);
  }
  private pending: LedgerCombatEvent[] = [];
  override observe(change: SessionChange): void {
    if (!change.before.combat) { this.pending = []; super.observe(change); return; }
    this.pending.push(...change.events);
    if (change.after.combat?.status === 'finished' || change.reason === 'command') {
      super.observe({...change, events:this.pending}); this.pending = [];
    }
  }
  override capturePrefix(): never { throw new Error('Completed fixture history has no live prefix'); }
}
