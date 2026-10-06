/** M6 F1 public protocol. Persistence identity never participates in domain rules. */
import type { MatchState } from '../simulation/match-types';
import type { CombatEvent, CombatState, CombatResult } from '../simulation/combat-types';
export interface BattleRecord {
  readonly runId: string;
  readonly combatId: string;
  readonly context: MatchState;
  readonly initial: CombatState;
  readonly events: readonly CombatEvent[];
  readonly endTick: number;
  readonly nextEventSeq: number;
  readonly result: CombatResult | null;
  readonly stateHash: string;
  readonly eventHash: string;
}
export interface SaveEnvelope {
  readonly kind: 'hex-autobattler-save';
  readonly saveFormatVersion: 1;
  readonly replayFormatVersion: 1;
  readonly runId: string;
  readonly createdAt: string;
  readonly match: MatchState;
  readonly battles: readonly BattleRecord[];
  readonly currentBattle: BattleRecord | null;
}
export interface SlotToken { readonly runId: string; readonly activationEpoch: string; readonly revision: number }
export interface CapturedSave {
  readonly match: MatchState;
  readonly currentBattle: BattleRecord | null;
  readonly battleKeys: readonly string[];
  readonly addedBattles: readonly BattleRecord[];
}
export type SaveStatus = { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly at: string; readonly token: SlotToken }
  | { readonly kind: 'failed'; readonly reason: 'quota' | 'abort' | 'conflict' | 'unavailable' | 'validation'; readonly message: string };
export interface SessionChange {
  readonly before: MatchState;
  readonly after: MatchState;
  readonly events: readonly CombatEvent[];
  readonly reason: 'command' | 'tick' | 'new-match';
}
