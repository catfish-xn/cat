export { maximumPlayerHp } from '../simulation/augment-pool-batch5-h7-health';
export { recordR2PortableBattle } from '../simulation/augment-pool-batch5-r2-history';
/** Pure rule boundary for Node callers. No scheduler, transport or browser adapters. */
export { drainBatch5H7Gold } from '../simulation/augment-pool-batch5-h7';
export {
  openAnvil, grantAnvilUnit, anvilDisplay, ANVIL_POLICY, createMatch, deployMatchUnit, autoDeployToCap, lockMatchCombatRoster, buyUnit, sellUnit, setShopLock, rerollShop, buyXp,
  startMatchCombat, stepMatch, nextRound, combineItems, equipItem, useConsumable, previewUseConsumable,
  selectAnomalyTarget, rerollAugment, deriveAugmentTier, augmentRerollLimit, rerollAnomaly, selectChoice,
  getDeploymentCap, validateMatchDeployment, matchStartFailure, needsAnomalyRecruitment,
  forfeitPendingChoice, claimOrDiscardLoot, claimOrb, forfeitTerminalOrbs, advanceMultiplayerRound,
  readItemSummons, moveItemSummon, d14PublicUnitMark, recordAugmentSettlementTable,
} from '../simulation/match';
export type { ItemSummonOrigin } from '../simulation/g2-4b-summons';
export type { MovableSummon } from '../simulation/g2-4b-voidspawn';
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
export { snapshotForBattle, snapshotForBattleSteps, restorePlayerBattleSnapshot, restorePlayerBattleSnapshotSteps } from '../simulation/two-sided-snapshot';
export { priorPvpWins, G22_EMISSARY_WIN_CAP } from '../simulation/g2-2-pvp-history';
export { compileBattle, compileBattleSteps, restoreBattleInput, restoreBattleInputSteps, startTwoSidedCombat, startTwoSidedCombatWithEvents,
  startTwoSidedBattle, startTwoSidedBattleSteps, resolveTwoSidedBattle, proposeSettlement, readBattleLiveGoldReaders } from '../simulation/two-sided-battle';
export type { BattleTask, BattleReplayTask, BattleReplayStep, BattleReplayOptions, BattleLiveGoldReader } from '../simulation/two-sided-battle';
export type { BattleEquipmentInput, BattleTickInput, BattleTickInputSource, BattleEquipmentCommand } from '../simulation/battle-input-log';
export { sampleD11CombatGold } from '../simulation/d11-fill';
export { readMatchLiveGoldReaders } from '../simulation/live-gold-readers';
export type { CombatBankSample } from '../simulation/combat-types';
export { stepCombat } from '../simulation/combat';
export type { CombatStep } from '../simulation/combat';
export { PLAYER_BATTLE_SNAPSHOT_VERSION, TWO_SIDED_BATTLE_VERSION, BattleValidationError } from '../simulation/two-sided-types';
export type { PlayerBattleSnapshot, BattleIdentity, BattleIdMapping, BattleInput, BattleResult,
  BattleSideResult, BattleSurvivor, SideProposal, BattleFailure } from '../simulation/two-sided-types';
export { applyRoundSettlement, enableMultiplayerSettlement, ROUND_SETTLEMENT_VERSION } from '../simulation/round-settlement';
export type { RoundSettlementReceipt, MultiplayerProgress, MultiplayerCommandResult, MultiplayerFailure } from '../simulation/round-settlement';

export { createSharedPool, initializeSharedSeat, generateSharedShop, buySharedUnit, buySharedXp, rerollSharedShop,
  setSharedShopLock, sellSharedUnit, releaseSeatOnElimination, refreshSharedShops, nextSharedRound,
  runSharedMatchCommand, restoreSharedOrbSnapshot, assertSharedPoolConservation, SHARED_POOL_VERSION, POOL_CAPACITY_BY_COST } from '../simulation/shared-pool';
export type { SharedPoolState, SharedPoolBinding, SharedPoolResult, SharedPoolBatchResult, SharedPoolFailure,
  SharedPoolEvent, SharedMatchCommand, PoolHolding, ShopReservation, RewardReservation, PoolRewardReceipt } from '../simulation/shared-pool-types';

export { decideBotAction, claimBotPreparationOrbs, BOT_POLICY_VERSION, BOT_MAX_STEPS } from '../simulation/bot';
export type { BotContext, BotDecision } from '../simulation/bot';

export { toPrivateSeatView } from '../simulation/private-seat-view';
export { freeRerollsAvailable } from '../simulation/free-rerolls';
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

export { drainSetup } from '../simulation/setup-work';
export { applyBattleEquipment } from '../simulation/battle-equipment';
export type { BattleEquipmentReceipt, BattleEquipmentFailure } from '../simulation/battle-equipment';
export { queueMatchBattleEquipment } from '../simulation/match';

// Opening encounter PR1: domain context/query only; Room/transport wiring belongs to PR8.
export { createOpeningEncounter, validateOpeningEncounterConfig, validateOpeningEncounterContext,
  validateOpeningEncounterState, planOpeningRound, applyOpeningEffects, readOpeningEncounterView,
  OpeningEncounterError, OPENING_ENCOUNTERS, OPENING_ENCOUNTER_CONFIG } from '../simulation/match';
export type { OpeningEncounterId, OpeningEncounterContext, OpeningEncounterState, OpeningEncounterSelection,
  OpeningEncounterFailure, OpeningEncounterView, OpeningEffectFact, OpeningEffectReceipt } from '../simulation/match';
// Opening encounters PR8: owner-only progress readers and the shared-batch resolution shape (re-exports only).
export { readOpeningMelProgress, readOpeningForgeProgress, readMasterworkOptions } from '../simulation/match';
export type { OpeningMelProgress, OpeningForgeProgress } from '../simulation/match';
export type { OpeningRoundResolution } from '../simulation/shared-pool-types';

export { appendAugmentFact, prepareAugmentAcquisition, bindAugmentPreviousBattle, recordAugmentTable, recordAugmentPvpRoster, recordAugmentTransition, historyRoster, needsAugmentHistory, needsAugmentPreparationClock, captureAugmentHistoryAuthority, advanceAugmentPreparationTime, type AugmentHistoryAuthority } from '../simulation/augment-history';
export { readAugmentCombatDeaths, augmentDeathsFromEvents } from '../simulation/augment-death-samples';
export type { HistorySeat, PreviousAugmentBattle } from '../simulation/augment-history-types';
export { completeTraitTrackerCommand } from '../simulation/augment-pool-batch5-h10-tracker';
export { grantAdditionalCarouselPick } from '../simulation/carousel';
export { applyDhampyrSettlement } from '../simulation/augment-pool-batch5-h8-health';
export { drainBatch5H8Deaths } from '../simulation/augment-pool-batch5-h8-deaths';
export { readAugmentPlayerHealth } from '../simulation/augment-history';

export { settleBatch5H9History } from '../simulation/augment-pool-batch5-h9';

export { hasTombRaider, recordTombRaiderEliminations, publishTombRaiderChoice } from '../simulation/augment-pool-batch5-r1';
