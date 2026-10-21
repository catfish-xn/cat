import type { M8_VERSION } from '../simulation/m8/version';
/** M6 F1 public protocol. Persistence identity never participates in domain rules. */
import type { MatchState } from '../simulation/match-types';
import type { CombatState, CombatResult } from '../simulation/combat-types';
import type { LedgerCombatEvent } from '../simulation/combat-types';
/** M8_RULES §10: each record names the exact version its validator must match. */
export interface BattleRecordVersion {
  readonly schemaVersion: MatchState['schemaVersion'];
  readonly rulesVersion: MatchState['rulesVersion'];
  readonly contentVersion: MatchState['contentVersion'];
  readonly contentDigest: string;
  readonly replayFormatVersion: typeof M8_VERSION.replayFormatVersion;
}
export interface BattleRecord {
  readonly version: BattleRecordVersion;
  readonly roundId: string;
  readonly runId: string;
  readonly combatId: string;
  readonly context: MatchState;
  /** Ordered equips (including in-place combinations), inventory combinations and consumable uses,
   * issued during combat before stepping this tick. */
  readonly equipmentCommands?: readonly import('../simulation/battle-input-log').BattleEquipmentCommand[];
  readonly initial: CombatState;
  readonly events: readonly LedgerCombatEvent[];
  readonly endTick: number;
  readonly nextEventSeq: number;
  readonly result: CombatResult | null;
  readonly stateHash: string;
  readonly eventHash: string;
}
export interface SaveEnvelope {
  readonly kind: 'hex-autobattler-save';
  readonly saveFormatVersion: typeof M8_VERSION.saveFormatVersion;
  readonly replayFormatVersion: typeof M8_VERSION.replayFormatVersion;
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
  readonly events: readonly LedgerCombatEvent[];
  readonly reason: 'command' | 'tick' | 'new-match';
}
