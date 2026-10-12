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
export type { CombatState, CombatResult, LedgerCombatEvent } from '../simulation/combat-types';
export type { CombatInputBasis, CombatStrategyInputs } from '../simulation/combat-input';
export type {
  StrategySnapshot, StrategyUnitSnapshot, ItemInstance, OwnedAugment, AnomalyBinding,
} from '../simulation/strategy-types';
