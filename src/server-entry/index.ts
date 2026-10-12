/** Pure rule boundary for Node callers. No scheduler, transport or browser adapters. */
export {
  createMatch, deployMatchUnit, buyUnit, sellUnit, setShopLock, rerollShop, buyXp,
  startMatchCombat, stepMatch, nextRound, combineItems, equipItem,
  selectAnomalyTarget, rerollAnomaly, selectChoice,
  getDeploymentCap, validateMatchDeployment, matchStartFailure, needsAnomalyRecruitment,
} from '../simulation/match';
export { serializeMatch, restoreMatch } from '../simulation/serialization';
export type {
  MatchState, MatchBase, MatchCommandResult, MatchFailure, MatchStep, MatchEvent,
  RunningCombat, FinishedCombat, RoundResult, PersistentGrowth,
} from '../simulation/match-types';
export type { Unit, UnitLocation } from '../simulation/unit-types';
export type { CombatState, CombatResult, CombatEvent, LedgerCombatEvent } from '../simulation/combat-types';
export type { GameState } from '../simulation/game';
export type { TemporaryEquipment } from '../simulation/m8/contracts';
export type { CombatInputBasis, CombatStrategyInputs } from '../simulation/combat-input';
export type {
  StrategySnapshot, StrategyUnitSnapshot, ItemInstance, OwnedAugment, AnomalyBinding,
} from '../simulation/strategy-types';
export { snapshotForBattle, restorePlayerBattleSnapshot } from '../simulation/two-sided-snapshot';
export { compileBattle, restoreBattleInput, startTwoSidedCombat, startTwoSidedCombatWithEvents,
  resolveTwoSidedBattle, proposeSettlement } from '../simulation/two-sided-battle';
export { stepCombat } from '../simulation/combat';
export type { CombatStep } from '../simulation/combat';
export { PLAYER_BATTLE_SNAPSHOT_VERSION, TWO_SIDED_BATTLE_VERSION, BattleValidationError } from '../simulation/two-sided-types';
export type { PlayerBattleSnapshot, BattleIdentity, BattleIdMapping, BattleInput, BattleResult,
  BattleSideResult, BattleSurvivor, SideProposal, BattleFailure } from '../simulation/two-sided-types';
