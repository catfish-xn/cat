/** Pure rule boundary for Node callers. No scheduler, transport or browser adapters. */
export {
  createMatch, deployMatchUnit, autoDeployToCap, lockMatchCombatRoster, buyUnit, sellUnit, setShopLock, rerollShop, buyXp,
  startMatchCombat, stepMatch, nextRound, combineItems, equipItem, useConsumable, previewUseConsumable,
  selectAnomalyTarget, rerollAugment, deriveAugmentTier, augmentRerollLimit, rerollAnomaly, selectChoice,
  getDeploymentCap, validateMatchDeployment, matchStartFailure, needsAnomalyRecruitment,
  forfeitPendingChoice, claimOrDiscardLoot, claimOrb, forfeitTerminalOrbs, advanceMultiplayerRound,
  readItemSummons, moveItemSummon,
} from '../simulation/match';
export type { ItemSummonOrigin } from '../simulation/g2-4b-summons';
export { serializeMatch, restoreMatch } from '../simulation/serialization';
export type {
  MatchState, MatchBase, MatchCommandResult, MatchFailure, MatchStep, MatchEvent,
  RunningCombat, FinishedCombat, RoundResult, PersistentGrowth,
} from '../simulation/match-types';
export type { Unit, UnitLocation } from '../simulation/unit-types';
export type { CombatState, CombatResult, CombatEvent, LedgerCombatEvent } from '../simulation/combat-types';
export type { GameState } from '../simulation/game';
export type { TemporaryEquipment, StatusKind } from '../simulation/m8/contracts';
export type { CombatInputBasis, CombatStrategyInputs } from '../simulation/combat-input';
export type {
  StrategySnapshot, StrategyUnitSnapshot, ItemInstance, OwnedAugment, AnomalyBinding,
} from '../simulation/strategy-types';
export { snapshotForBattle, restorePlayerBattleSnapshot } from '../simulation/two-sided-snapshot';
export { priorPvpWins, G22_EMISSARY_WIN_CAP } from '../simulation/g2-2-pvp-history';
export { compileBattle, restoreBattleInput, startTwoSidedCombat, startTwoSidedCombatWithEvents,
  startTwoSidedBattle, resolveTwoSidedBattle, proposeSettlement } from '../simulation/two-sided-battle';
export type { BattleTask, BattleReplayTask, BattleReplayOptions } from '../simulation/two-sided-battle';
export { stepCombat } from '../simulation/combat';
export type { CombatStep } from '../simulation/combat';
export { PLAYER_BATTLE_SNAPSHOT_VERSION, TWO_SIDED_BATTLE_VERSION, BattleValidationError } from '../simulation/two-sided-types';
export type { PlayerBattleSnapshot, BattleIdentity, BattleIdMapping, BattleInput, BattleResult,
  BattleSideResult, BattleSurvivor, SideProposal, BattleFailure } from '../simulation/two-sided-types';
export { applyRoundSettlement, enableMultiplayerSettlement, ROUND_SETTLEMENT_VERSION } from '../simulation/round-settlement';
export type { RoundSettlementReceipt, MultiplayerProgress, MultiplayerCommandResult, MultiplayerFailure } from '../simulation/round-settlement';

export { createSharedPool, initializeSharedSeat, generateSharedShop, buySharedUnit, rerollSharedShop,
  setSharedShopLock, sellSharedUnit, releaseSeatOnElimination, refreshSharedShops, nextSharedRound,
  runSharedMatchCommand, restoreSharedOrbSnapshot, assertSharedPoolConservation, SHARED_POOL_VERSION, POOL_CAPACITY_BY_COST } from '../simulation/shared-pool';
export type { SharedPoolState, SharedPoolBinding, SharedPoolResult, SharedPoolBatchResult, SharedPoolFailure,
  SharedPoolEvent, SharedMatchCommand, PoolHolding, ShopReservation, RewardReservation, PoolRewardReceipt } from '../simulation/shared-pool-types';

export { decideBotAction, claimBotPreparationOrbs, BOT_POLICY_VERSION, BOT_MAX_STEPS } from '../simulation/bot';
export type { BotContext, BotDecision } from '../simulation/bot';

export { toPrivateSeatView } from '../simulation/private-seat-view';
export type { PrivateSeatView, ConsumableTargetView } from '../simulation/private-seat-view';
export { createCombatReplayRecorder, toCombatViewState, toCombatViewEvents, startCombatReplay, toCombatReplay, applyCombatReplayTick, COMBAT_REPLAY_KEYFRAME_INTERVAL } from '../simulation/combat-replay-view';
export type { CombatReplayRecorder, CombatViewState, CombatViewUnit, CombatViewStatus, CombatAnimationEvent, CombatViewEvent, CombatReplayTick, CombatReplay, CombatReplayTask, CombatReplayInput } from '../simulation/combat-replay-view';

export { createOrbLayout, freezeOrbLayoutThroughRound } from '../simulation/orb-layout';
export type { OrbLayoutLedger, OrbRoundLayout, OrbTier, LootInitialization, OrbLayoutResult, OrbLayoutFailure } from '../simulation/orb-layout';
export { freezeLootThroughRound } from '../simulation/loot-freeze';
export type { ConsumableDefinitionId, ConsumableInstance, ConsumableTarget, ConsumablePreview, ConsumableFailure } from '../simulation/consumable-types';

export { readComponentEquivalent, readPublicOrbSummary } from '../simulation/loot-view';
export { forfeitUnclaimedOrbs, ORB_CLAIM_PHASES } from '../simulation/orb-claim';
export { MULTIPLAYER_NET_PROTOCOL_VERSION, MULTIPLAYER_LOOT_CONTRACT_VERSION } from '../simulation/m8/version';

export { CONSUMABLE_DEFINITIONS } from '../simulation/content/consumables';

export { releaseCarouselParticipant, completeCarouselForSeat, releaseCarouselSeat, resolvePendingCarouselUnits, sellPendingCarouselUnit, createCarouselMatch, opensCarousel, schedule, prepareCarouselParticipants, createCarousel, pickFromCarousel, autoPickFromCarousel, advanceCarousel, grantCarouselPick, pickCarouselForSeat, autoPickCarouselForSeat, listCarouselSlots, restoreCarouselSeat, restoreCarousel, validateCarousel, CAROUSEL_RULES, CAROUSEL_COST_ODDS } from '../simulation/carousel';
export type * from '../simulation/carousel-types';
export { previewRoundEconomy } from '../simulation/economy-preview';
export type { RoundEconomyPreview, RoundEconomyPreviewOutcome } from '../simulation/economy-preview';
export { summarizeBattle } from '../simulation/combat-summary';
export type { UnitBattleSummary } from '../simulation/combat-summary';
