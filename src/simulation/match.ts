import { grantCookingPotGrowth, noScoutLockedUnits } from './augment-pool-batch5-h3';
import { drainPortfolioGold } from './augment-pool-batch5-h4';
import { drainContestedGold } from './augment-pool-batch5-h6';
import { initializeAugmentTrace, traceHistoryCommand, recordAugmentRoundEntry, recordAugmentAcquisition, recordAugmentPvpRoster, recordAugmentTable, historyRoster } from './augment-history';
import { augmentExtraRerolls, canRerollAugmentSlot } from './augment-pool-batch5-s1a';
import { atWhatCostGrant, skipsFutureAugment } from './augment-pool-batch5-s1b';
import { drainBatch5Inventory } from './augment-pool-batch5-s3a';
import { recordShopAcquisition, recordShopRound, recordShopXp, recordShopLock, recordShopBuy, recordShopAnomalyReroll } from './shop-history';
import { soloShopOrb } from './shop-orbs';
import { applyReinfourcement, enterShopAugmentRound, recordShopReroll, shopOfferCost, drawSoloAugmentShop, planFiresale, stealFiresaleUnit, subscriptionAcquired, subscriptionStageStart } from './shop-augments';
import { batch5Streak, drainBatch5Gold } from './augment-pool-batch5-progress';
import { drainBatch4Gold } from './augment-pool-batch4-progress';
import { AUGMENT_BATCH4 } from './content/augment-pool-batch4';
import { batch4B4xpSettlementXp, withBatch4B4xp } from './augment-pool-batch4-b4xp-progress';
import { salvageSale } from './augment-pool-batch5-s3b-salvage';
import { pandoraRoundEntry } from './augment-pool-batch5-s3b-conversions';
import { convertAcademicCraft } from './augment-pool-batch5-s3b';
import { drainBatch1Gifts } from './augment-pool-grants';
import { planOpenAnvil } from './anvils';
export { grantAnvilUnit } from './anvils';
export { anvilDisplay, ANVIL_POLICY } from './content/anvils';
import { isAnvil } from './content/anvils';
import { sixCostShopContext } from './six-cost-shop';
export { readOpeningBatchBRewards } from './opening-batch-b-rewards';
import { openingEncounterId } from './opening-encounter';
import { growTrainerGolem } from './trainer-golems';
import { enterOpeningCrabs } from './opening-crabs';
import { choiceAcquisitionXp, choiceAcquisitionGold } from './choice-acquisition';
import { outcomeAcquisitionXp } from './augment-pool-batch3-progress';
import { drainSetup } from './setup-work';
import { spendFreeReroll } from './free-rerolls';
import { drainBatch3RoundEntry } from './augment-pool-batch3-progress';
import { batch3EntryXp, xpPurchaseAmount, xpPurchaseCost, recordAcquisitionLevel, applyLevelUpHealth, applyAcquisitionHealthLoss } from './augment-xp';
import { deferredRoundIncome, payPreviousRoundIncome } from './deferred-income';
import { prepareBattleEquipment, installBattleEquipmentBatch } from './battle-equipment';

import { openMasterworkChoice, completeMasterworkChoice } from './masterwork-choice';
export { readMasterworkOptions } from './masterwork-choice';
import { applyOpeningRoundEntry, createSoloOpeningEncounter, commitOpeningEncounterHealth, applyOpeningEffects, planOpeningRound } from './opening-encounter';
export { TRAINER_GOLEMS_POLICY, validateTrainerGolemEmblems, applyTrainerGolemsOpening } from './trainer-golems';
export type { TrainerGolemEmblems } from './trainer-golems';
export { isMelBlessingCrossing, readOpeningMelProgress, applyWarwickHunger, createOpeningEncounter, validateOpeningEncounterConfig, validateOpeningEncounterContext, validateOpeningEncounterState, planOpeningRound, applyOpeningEffects, readOpeningEncounterView, readOpeningForgeProgress, OpeningEncounterError, OPENING_ENCOUNTERS, OPENING_ENCOUNTER_CONFIG } from './opening-encounter';
export type { OpeningMelThresholdReceipt, OpeningMelProgress, OpeningForgeProgress, OpeningWarwickKillFact, OpeningEncounterId, OpeningEncounterContext, OpeningEncounterState, OpeningEncounterSelection, OpeningEncounterFailure, OpeningEncounterView, OpeningEffectFact, OpeningEffectReceipt } from './opening-encounter';
import { melCanSave, commitMelSave } from './mel-save';
import { acquireD14, reconcileD14, eligibleD14Target } from './d14-runtime';
import { pruneForgePositions } from './forge-positions';
import { grantConsumableCopy } from './consumables';
import { grantPveRemover } from './pve-remover';
import {grantAnomalyAcquisition} from './anomaly-acquisition';
import { sampleD11CombatGold } from './d11-fill';
import { grantAugmentAcquisition,  openAugmentForge } from './augment-acquisition';
import { readAugmentIncome } from './augment-income';
import {claimG23Atom,openG23Choice,finishG23Choice,mechanicGrantEvents,drainG23Rewards} from './g2-3-runtime';
import {drainP2Gifts} from './s13-augments-p2-grants';
import {updateG23Cells} from './g2-3-state';
import {readG23Progress,writeG23Progress} from './g2-3-state';
import { deploymentCapFor } from './deployment-cap';
import {countsG23SurvivorDamage} from './g2-3-summons';
import {applyG23Radiant} from './g2-3-radiant';
import {type G23JunkerUpgrade} from './g2-3-junker';
import { commitG23Settlement,g23SoloFacts } from './g2-3-settlement';
import { createG23Progress,grantG23Academy } from './g2-3-match-progress';
import { selectOpeningUnit } from './opening-unit';
import { resolveCarouselPreparation } from './carousel-units';
import { planConsumable } from './consumables';
import { CONSUMABLE_RULES } from './content/consumables';
import type { LootInitialization, OrbLayoutLedger } from './orb-layout';
import type { ConsumableTarget } from './consumable-types';
export { previewUseConsumable } from './consumables';
import { resolveDeferredUpgrades } from './deferred-upgrades';
import { canOperateMatch, isCombatRosterLocked } from './operation-policy';
import type { UnitLootPolicy } from './loot-runtime';
import { planOrbClaim, forfeitUnclaimedOrbs, settleQueuedOrbClaims } from './orb-claim';
import type { MultiplayerCommandResult, MultiplayerFailure } from './round-settlement';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { FINAL_ROUND } from './round-schedule';
import { M8_VERSION } from './m8/version';
import { freezeCombatInput } from './combat-input';
import { appendResourceProvenance, mergeGrowthLedger, RESOURCE_PROVENANCE_VERSION } from './resource-provenance';
import { prepareMatchLoot, revealMatchLoot, grantDirectLoot, grantLootChoice, unresolvedLootChoices, hasPendingLootCapacity } from './loot-runtime';
import { isMatchCombatStreamTerminal } from './combat-stream-terminal';
import { makeLootPendingChoice } from './loot-choice';
import { createCombatWithEvents, createCombatWithEventsSteps, stepCombat, validateCombatStart, type CombatState } from './combat';
import { toLedgerEvents } from './combat-ledger';
import { deployUnit, getPlayerDeploymentCount } from './game';
import { type UnitLocation } from './units';
import { DEFAULT_MATCH_SEED, MATCH_RULES } from './match-rules';
import { nextRandom, validateSeed } from './rng';
import { DEFAULT_BOARD, sameCell } from './board';
import { OPENING_INITIAL_STATE } from './opening-economy';
import { resolveRoundEconomy } from './round-economy';
import { getCatalogRoundByOrdinal, getNextCatalogRound } from './round-selectors';
import { shareGeneratedJson } from './immutable-json';
import { COMPONENT_IDS } from './content/g2-3-item-registry';
import { generateShop } from './shop';
import { grantXp } from './progression';
import { getUnitSellPrice } from './unit-stats';
import { P3_AUGMENT_ITEMS } from './content/s13-p3';
import { planUnitAcquisition } from './unit-acquisition';
import { createRoundEnemies } from './round-enemies';
import { validateContent } from './validate-content';
import { planCombine, planEquip, returnUnitItems } from './inventory';
import { previewCombine, previewEquip } from './item-selectors';
import { initializeStreams } from './m8/equipment';
import { planTemporaryEquipment } from './temporary-equipment';
import { planPermanentItemGrant } from './item-grants';
import { buildStrategySnapshot, buildStrategySnapshotSteps } from './strategy-snapshot';
import { ROUND_PREPARATION_RULES, getRoundSchedule, getRoundKind } from './round-schedule';
import { planReward } from './rewards';
import { CONTENT_DIGEST, canonicalContent } from './content';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { ANOMALY_DEFINITIONS, anomalyCandidates } from './content/anomalies';
import { generateChoices } from './choices';
import { resolveAugmentTier, augmentCandidates, drawAugmentCard, augmentNodeOf, isTraitTailoredNode, fieldedTraitSnapshot, recordedOfferFilter, type AugmentOfferFilter } from './augment-offers';
export { deriveAugmentTier, resolveAugmentTier, augmentRerollLimit } from './augment-offers';
import type { ScheduleReceipt } from './strategy-types';
import { isSellableUnit } from './seat-mechanics/forms';
import { isMechanicChoice, isMechanicChoiceKind, resolveMechanicChoice, choiceTimeoutOption } from './seat-mechanics/choices';
import type { FinishedCombat, MatchCommandResult, MatchEvent, MatchFailure, MatchState, MatchStep, RunningCombat } from './match-types';
export * from './match-types';
export { DEFAULT_MATCH_SEED, MATCH_RULES } from './match-rules';
export { getXpToNextLevel, getShopOdds } from './progression';
export { readEncounterPreview } from './encounter-selectors';
export { readLootView } from './loot-view';
export { d14PublicUnitMark } from './d14-public-unit-mark';
export { getUnitSellPrice, getUnitStats } from './unit-stats';
const fail = (state: MatchState, reason: MatchFailure): MatchCommandResult => ({ ok: false, state, reason });
const accept = (state: MatchState, events: readonly MatchEvent[] = []): MatchCommandResult => {
  const inventory=drainBatch5Inventory(state);events=[...events,...mechanicGrantEvents(state,inventory)];state=inventory;
  const d14Events:MatchEvent[]=[];state=pruneForgePositions(reconcileD14(state,d14Events));events=[...events,...d14Events];
  state=applyG23Radiant(state,new Set(events.flatMap(e=>e.type==='itemCombined'?[e.itemId]:[])));
  const academy=grantG23Academy(state);state=academy.state;events=[...events,...academy.events];
  const opened=openG23Choice(updateG23Cells(state));state=opened.state;events=[...events,...opened.events];
  const forge=openAugmentForge(state);state=forge.state;events=[...events,...forge.events];
  return { ok: true, ...stampMatchEvents(state, events) };
};
function stampMatchEvents(state: MatchState, events: readonly MatchEvent[]): MatchStep {
  let seq = state.nextMatchEventSeq;
  const stamped = events.map(event => 'tick' in event ? event : { ...event, domain: 'match' as const, eventSeq: seq++ });
  return { state: { ...state, nextMatchEventSeq: seq }, events: stamped };
}
function acceptEquipment(state: MatchState, events: readonly MatchEvent[]): MatchCommandResult {
  // Choice-phase trading can consume/sell the currently selected anomaly target.
  // Follow an upgrade survivor, or ask for a new target without offering a free reroll.
  const choice = state.pendingChoice;
  const choiceEvents: MatchEvent[] = [];
  if (state.multiplayer && state.phase === 'choice' && choice?.kind === 'anomaly' && choice.targetId) {
    let targetId: string | null = choice.targetId;
    for (const event of events) if (event.type === 'unitUpgraded' && event.consumedIds.includes(targetId)) targetId = event.survivorId;
    if (!state.preparation.units.some(unit => unit.id === targetId && unit.team === 'player')) targetId = null;
    if (targetId !== choice.targetId) {
      const pendingChoice = { ...choice, targetId, step: targetId ? 'offer' as const : 'target' as const, generation: choice.generation + 1 };
      state = { ...state, pendingChoice };
      choiceEvents.push({type:'choiceOpened',choice:pendingChoice});
    }
  }
  // Multiplayer trading can upgrade Rumble while its popup is folded away.
  if (state.phase === 'choice' && choice?.kind === 'armory' && choice.choiceId.startsWith('g23:junker:')) {
    const refresh = openG23Choice({ ...state, phase: choice.returnPhase, pendingChoice: null } as MatchState);
    choiceEvents.push(...refresh.events.filter(event => event.type === 'mechanicFailed'));
    const refreshed = refresh.state.pendingChoice;
    if (refreshed?.kind === 'armory' && refreshed.choiceId === choice.choiceId && (JSON.stringify(refreshed.offers) !== JSON.stringify(choice.offers))) {
      const pendingChoice = { ...refreshed, generation: choice.generation + 1 };
      state = { ...state, pendingChoice };
      choiceEvents.push({ type: 'choiceOpened', choice: pendingChoice });
    }
  }
  const planned = planTemporaryEquipment(state);
  return accept(planned.state, [...events, ...choiceEvents, ...planned.events]);
}
/** Only the uncompleted anomaly node may defer choice while its roster is empty. */
export function needsAnomalyRecruitment(state: MatchState): boolean {
  return !(state.multiplayer && state.round > FINAL_ROUND) && state.phase === 'preparation' && !state.preparation.units.some(unit => unit.team === 'player')
    && getRoundSchedule(state.round).some(event => event.kind === 'anomaly' && !state.scheduleReceipts.some(receipt => receipt.eventId === event.id)
      && !state.multiplayer?.forfeitedChoices.includes(event.id));
}
function affordableOffer(state: MatchState, gold = state.gold): boolean {
  return state.shop.slots.some(slot => slot.status === 'available' && shopOfferCost(slot) <= gold);
}
/** v22: the candidate filter of an augment node opening now (trait snapshot only where the node is tailored). */
function openingOfferFilter(state: MatchState, choiceId: string, blocked: readonly string[]): AugmentOfferFilter {
  const node = augmentNodeOf(choiceId);
  return { node, fieldedTraits: isTraitTailoredNode(node) ? fieldedTraitSnapshot(state) : [], blocked: [...blocked].sort(), sharedCarousel: !!state.carousel && !!state.multiplayer && state.openingEncounter.mode === 'shared' };
}
/** `augmentBlocked`: ids other live seats block (externalAugmentBlocks), supplied by the all-seat round advance. */
function enterScheduledEvents(initial: MatchState, timing: 'before' | 'after' = 'before', augmentBlocked: readonly string[] = []): { state: MatchState; events: MatchEvent[] } {
  let state = initial; const events: MatchEvent[] = [];
  // Overtime has no catalog schedule; earned mechanic choices still return to their requested phase.
  const schedule = state.multiplayer && state.round > FINAL_ROUND ? [] : getRoundSchedule(state.round);
  for (const event of schedule.filter(event => (event.timing ?? 'before') === timing)) {
    if (state.scheduleReceipts.some(receipt => receipt.eventId === event.id)) continue;
    if (event.kind === 'augment' && skipsFutureAugment(state, state.round)) continue;
    if (state.multiplayer?.forfeitedChoices.includes(event.id)) continue;
    if (state.carousel && event.kind==='component' && getRoundKind(state.round)==='supply') continue;
    if (event.kind === 'reward') {
      const { receipt, ...plan } = planReward(state, event);
      state = { ...state, ...plan, scheduleReceipts: [...state.scheduleReceipts, receipt] };
      events.push({ type: 'rewardGranted', receipt });
      continue;
    }
    if (event.kind === 'anomaly' && !state.preparation.units.some(unit => unit.team === 'player')) continue;
    let choiceRngState = state.choiceRngState; let offers: readonly string[] = [];
    const filter = event.kind === 'augment' ? openingOfferFilter(state, event.id, augmentBlocked) : null;
    if (event.kind === 'augment') {
      const drawn = generateChoices(augmentCandidates(resolveAugmentTier(state, event.id), state.augments, state.removedAugmentIds,openingEncounterId(state), filter!), choiceRngState);
      offers = drawn.offers; choiceRngState = drawn.choiceRngState;
    } else if (event.kind === 'component') offers = [...COMPONENT_IDS];
    const pendingChoice = { kind: event.kind, step: event.kind === 'anomaly' ? 'target' as const : 'offer' as const,
      choiceId: event.id, eventId: event.id, generation: 0, offers, targetId: null, rerollCount: 0,
      ...(event.kind === 'augment' ? {augmentTier: resolveAugmentTier(state, event.id), rerollsRemaining: 3 + augmentExtraRerolls(state.augments, event.id), rerolledSlots: [false, false, false]} : {}),
      returnPhase: timing === 'after' || getRoundKind(state.round) === 'supply' ? 'settlement' as const : 'preparation' as const };
    state = { ...state, augmentOffers: event.kind === 'augment'
      ? [...state.augmentOffers, {choiceId:event.id,tier:resolveAugmentTier(state,event.id),rerollCount:0,rerolledIndices:[],fieldedTraits:filter!.fieldedTraits,externalBlocks:[filter!.blocked]}] : state.augmentOffers,
      // v22: a shown card is never offered to this seat again, chosen or not.
      removedAugmentIds: event.kind === 'augment' ? [...state.removedAugmentIds, ...offers] : state.removedAugmentIds, choiceRngState, phase: 'choice', combat: timing === 'after' ? state.combat : null, pendingChoice } as MatchState;
    events.push({ type: 'choiceOpened', choice: pendingChoice });
    return { state, events };
  }
  return { state: { ...state, phase: timing === 'after' ? 'settlement' : 'preparation',
    combat: timing === 'after' ? state.combat : null, pendingChoice: null } as MatchState, events };
}
/** One preparation transaction freezes enemies and appends the complete authoritative loot plan. */
function prepareRound(seed: number, round: number, previous?: MatchState['m8']['loot'], layout?:OrbLayoutLedger, initialization?:LootInitialization): MatchState['m8'] {
  const definition = getCatalogRoundByOrdinal(round);
  return shareGeneratedJson({round:definition,encounterPlan:null,loot:prepareMatchLoot(seed,round,previous,layout,initialization),preparation:{
    version:ROUND_PREPARATION_RULES.version,roundId:definition.roundId,encounterId:definition.encounterId,
    contentStatus:definition.kind === 'pve' ? ROUND_PREPARATION_RULES.pveContent : 'not-pve',
    enemies:createRoundEnemies(round),
  }});
}
/** Shared opening keeps the random one-cost unit and existing economy; 1-1 is PortalSelect. */
export function createCarouselMatch(seed=DEFAULT_MATCH_SEED):MatchState {
  const state=createMatch(seed,{mode:'shared-deferred'});
  return {...state,carousel:{receipts:[],pendingUnits:[],heldCarouselUnits:[],preparationReceipts:[]}};
}
function execute_createMatch(seed = DEFAULT_MATCH_SEED, loot:LootInitialization = {mode:'solo'}): MatchState {
  validateSeed(seed); validateContent();
  const openingEncounter = loot.mode === 'shared-deferred' ? {mode:'shared-deferred' as const} : createSoloOpeningEncounter(seed);
  const m8 = prepareRound(seed,1,undefined,undefined,loot);
  const initial: MatchState = { schemaVersion: M8_VERSION.schemaVersion, rulesVersion: M8_VERSION.rulesVersion, contentVersion: M8_VERSION.contentVersion,
    commandProtocolVersion: M8_VERSION.commandProtocolVersion, rngAlgorithm: M8_VERSION.rngAlgorithm, tickMs: M8_VERSION.tickMs,
    openingEncounter,
    m8, combatInputBasis:null, resourceProvenance:appendResourceProvenance({version:RESOURCE_PROVENANCE_VERSION,entries:[]},m8.round.roundId,
      {kind:'unit-acquired',unitId:OPENING_INITIAL_STATE.unit.id,source:{kind:'opening',seed,seatId:'solo'}}), roundDefinitionId: m8.round.roundId, streak: { kind: null, count: 0 }, outcome: null, persistentGrowth: [],
    augmentTierSeed: seed, augmentOffers: [], removedAugmentIds: [],
    augmentProgress: { pumpingRounds: 0, investmentHp: 0 }, battleSeedRngState: (seed ^ 0x9e3779b9) >>> 0,
    contentDigest: CONTENT_DIGEST, seed,
    equipmentState: { equipment: initializeStreams(seed).equipment, rolls: [] }, temporaryEquipment: [],
    consumables: [], nextConsumableSerial: 1, reforgeState:{state:(seed^CONSUMABLE_RULES.seedXor)>>>0,draws:0},
    items: [], nextItemSerial: 1, augments: [], anomalyBinding: null, pendingChoice: null, scheduleReceipts: [],
    choiceRngState: (seed ^ 0x9e3779b9) >>> 0, rewardRngState: (seed ^ 0x85ebca6b) >>> 0, nextMatchEventSeq: 0,
    ...generateShop(seed, 1, MATCH_RULES.initialLevel), round: 1, gold: MATCH_RULES.initialGold,
    level: MATCH_RULES.initialLevel, xp: OPENING_INITIAL_STATE.xp, playerHp: MATCH_RULES.initialHp, nextUnitSerial: OPENING_INITIAL_STATE.nextUnitSeq,
    preparation: { board: structuredClone(DEFAULT_BOARD), benchSize: 9, units: [
      { id:OPENING_INITIAL_STATE.unit.id,definitionId:selectOpeningUnit(seed),
        team:'player',starLevel:OPENING_INITIAL_STATE.unit.starLevel,
        location:{kind:'board',cell:{...OPENING_INITIAL_STATE.unit.cell}} },
      ...m8.preparation.enemies] }, roundResults: [], phase: 'preparation', combat: null };
  const entered = enterScheduledEvents(writeG23Progress(initial,createG23Progress(seed)));
  const prepared = accept(entered.state, entered.events).state;
  if (openingEncounter.mode === 'shared-deferred') return prepared;
  const applied = applyOpeningEffects(prepared, planOpeningRound(openingEncounter.context, '1-2').facts);
  if (!applied.ok) throw new Error(applied.reason);
  return applied.state;
}
/** v22: the round's augment choice opens inside preparation; the board stays editable while it is open. */
export function isAugmentPreparationChoice(state: MatchState): boolean {
  return state.phase === 'choice' && state.pendingChoice?.kind === 'augment' && state.pendingChoice.returnPhase === 'preparation';
}
function isBoardEditablePhase(state: MatchState): boolean { return state.phase === 'preparation' || isAugmentPreparationChoice(state); }
export function getDeploymentCap(state: MatchState): number { return deploymentCapFor(state.level, readG23Progress(state)); }
export function validateMatchDeployment(state: MatchState, unitId: string, target: UnitLocation): MatchFailure | undefined {
  if (!canOperateMatch(state)) return 'wrong-phase';
  if ((!isBoardEditablePhase(state) || isCombatRosterLocked(state)) && (target?.kind === 'board'
    || state.preparation.units.some(unit => unit.id === unitId && unit.location.kind === 'board'))) return 'wrong-phase';
  const planned = deployUnit(state.preparation, unitId, target);
  if (!planned.ok) return planned.reason;
  const locked = noScoutLockedUnits(state);
  if (planned.state.units.some(unit => locked.has(unit.id) && unit.location.kind === 'bench')) return 'unit-not-sellable';
  // Check the final formation: swapping at the cap does not add a deployed unit.
  return getPlayerDeploymentCount(planned.state) > getDeploymentCap(state) ? 'population-cap' : undefined;
}
function execute_deployMatchUnit(state: MatchState, unitId: string, target: UnitLocation): MatchCommandResult {
  const reason = validateMatchDeployment(state, unitId, target);
  if (reason) return fail(state, reason);
  const result = deployUnit(state.preparation, unitId, target);
  if (!result.ok) return fail(state, result.reason);
  // Online manual and automatic placement share the same complete deploy events.
  const events: MatchEvent[] = state.multiplayer ? result.state.units.flatMap(unit => {
    const from = state.preparation.units.find(previous => previous.id === unit.id)!.location;
    const to = unit.location;
    if (from.kind === 'board' && to.kind === 'board' ? sameCell(from.cell, to.cell)
      : from.kind === 'bench' && to.kind === 'bench' && from.slot === to.slot) return [];
    return [{ type: 'unitDeployed' as const, unitId: unit.id, from: structuredClone(from), to: structuredClone(unit.location) }];
  }) : [];
  const deployed={ ...state, preparation: result.state };
  const gifted=state.sharedPool?deployed:drainP2Gifts(deployed);
  return acceptEquipment(gifted,[...events,...mechanicGrantEvents(deployed,gifted)]);
}
/** After PvP snapshots are frozen, protect the live roster while keeping the T3 state shape. */
function execute_lockMatchCombatRoster(state: MatchState): MatchCommandResult {
  if (!state.multiplayer || state.multiplayer.status !== 'active' || state.phase !== 'preparation'
    || state.m8.round.kind !== 'pvp' || state.pendingChoice !== null) return fail(state, 'wrong-phase');
  if (state.multiplayer.combatRosterLocked) return { ok: true, state, events: [] };
  return { ok: true, state: { ...state, multiplayer: { ...state.multiplayer, combatRosterLocked: true } }, events: [] };
}
/** Server preparation-deadline hook. Never called by the offline Start path. */
function execute_autoDeployToCap(state: MatchState): MatchCommandResult {
  if (!state.multiplayer || state.multiplayer.status !== 'active' || state.phase !== 'preparation' || isCombatRosterLocked(state)) return fail(state, 'wrong-phase');
  const cap = getDeploymentCap(state), count = getPlayerDeploymentCount(state.preparation);
  if (count > cap) return fail(state, 'population-cap');
  const board = state.preparation.board, zone = board.deploymentZones.player;
  const columns = Array.from({ length: board.columns }, (_, col) => col)
    .sort((a, b) => Math.abs(a - (board.columns - 1) / 2) - Math.abs(b - (board.columns - 1) / 2) || a - b);
  const rows = Array.from({ length: zone.lastRow - zone.firstRow + 1 }, (_, offset) => zone.firstRow + offset);
  if (board.deploymentZones.enemy.firstRow > zone.lastRow) rows.reverse();
  const cells = rows.flatMap(row => columns.map(col => ({ col, row })));
  const reserves = state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'bench' && !isAnvil(unit.definitionId))
    .sort((a, b) => (a.location as Extract<UnitLocation, {kind:'bench'}>).slot - (b.location as Extract<UnitLocation, {kind:'bench'}>).slot);
  let next: MatchState = state;
  const events: MatchEvent[] = [];
  for (const unit of reserves) {
    if (getPlayerDeploymentCount(next.preparation) >= cap) break;
    const cell = cells.find(cell => !next.preparation.units.some(other => other.location.kind === 'board'
      && other.location.cell.col === cell.col && other.location.cell.row === cell.row));
    if (!cell) break;
    const result = deployMatchUnit(next, unit.id, { kind: 'board', cell });
    if (!result.ok) return fail(state, result.reason);
    next = result.state; events.push(...result.events);
  }
  return { ok: true, state: next, events };
}
function execute_buyUnit(state: MatchState, slotIndex: number, expectedGeneration: number, unitLootPolicy?: UnitLootPolicy): MatchCommandResult {
  if (!canOperateMatch(state)) return fail(state, 'wrong-phase');
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= state.shop.slots.length) return fail(state, 'invalid-slot');
  if (expectedGeneration !== state.shop.generation) return fail(state, 'stale-shop');
  const offer = state.shop.slots[slotIndex];
  if (offer.status !== 'available') return fail(state, 'purchased-slot');
  const cost = shopOfferCost(offer);
  if (state.gold < cost) return fail(state, 'insufficient-gold');
  const plan = planUnitAcquisition(state, offer.definitionId,
    { kind: 'shop', generation: expectedGeneration, slotIndex, definitionId: offer.definitionId,...(offer.starLevel?{starLevel:offer.starLevel}:{}) }, state.resourceProvenance.entries.length, isCombatRosterLocked(state), offer.starLevel ?? 1);
  if (!plan.ok) return fail(state, plan.reason);
  const purchased: MatchState = { ...state, items: plan.items, anomalyBinding: plan.anomalyBinding, persistentGrowth: mergeGrowthLedger(state.persistentGrowth, plan.upgradeEvents), gold: state.gold - cost, nextUnitSerial: plan.nextUnitSerial,
    resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId, plan.facts),
    preparation: plan.preparation,
    shop: { ...state.shop, slots: state.shop.slots.map((item, index) => index === slotIndex ? { status: 'purchased' } : item) },
  };
  const reinforced = applyReinfourcement(state, recordShopBuy(state,purchased,slotIndex), unitLootPolicy);
  const entered = needsAnomalyRecruitment(state) ? enterScheduledEvents(reinforced.state) : { state: reinforced.state, events: [] };
  const gifted=entered.state.phase!=='combat'&&!isCombatRosterLocked(entered.state)?drainP2Gifts(entered.state,unitLootPolicy):entered.state;
  return acceptEquipment(gifted, [...plan.events, ...reinforced.events, ...entered.events,...mechanicGrantEvents(entered.state,gifted)]);
}
function execute_openAnvil(state:MatchState,unitId:string):MatchCommandResult {
  const result=planOpenAnvil(state,unitId);
  return result.ok?acceptEquipment(result.state,result.events):result;
}
function execute_sellUnit(state: MatchState, unitId: string, unitLootPolicy?: UnitLootPolicy): MatchCommandResult {
  if(state.preparation.units.some(u=>u.id===unitId&&isAnvil(u.definitionId)))return openAnvil(state,unitId);
  const capacity = state.phase === 'settlement' && hasPendingLootCapacity(state) && !unresolvedLootChoices(state).length;
  if (!canOperateMatch(state) && !(capacity && !state.multiplayer)) return fail(state, 'wrong-phase');
  const unit = state.preparation.units.find(unit => unit.id === unitId);
  if (!unit) return fail(state, 'unknown-unit');
  if (unit.team !== 'player') return fail(state, 'enemy-unit');
  if (!isSellableUnit(unit.definitionId) || noScoutLockedUnits(state).has(unitId)) return fail(state, 'unit-not-sellable');
  if(unit.definitionId==='rumble'&&state.pendingChoice?.kind==='armory'&&state.pendingChoice.choiceId.startsWith('g23:junker:'))return fail(state,'wrong-phase');
  if (state.multiplayer && (!isBoardEditablePhase(state) || isCombatRosterLocked(state)) && unit.location.kind !== 'bench') return fail(state, 'wrong-phase');
  const returned = returnUnitItems(state.items, unitId), removesBinding = state.anomalyBinding?.unitId === unitId;
  const goldGranted = getUnitSellPrice(unit);
  let sold: MatchState = { ...state, items: returned.items, anomalyBinding: removesBinding ? null : state.anomalyBinding,
    persistentGrowth:state.persistentGrowth.filter(growth=>growth.unitId!==unitId),gold:state.gold+goldGranted,
    resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,
      {kind:'unit-sold',unitId,context:capacity?'settlement-capacity':'preparation',goldGranted}),
    preparation:{...state.preparation,units:state.preparation.units.filter(unit=>unit.id!==unitId)} };
  const returnedState=sold; sold=salvageSale(state,sold,unitId);
  const events: MatchEvent[] = [...mechanicGrantEvents(returnedState,sold),...returned.events,...(removesBinding?[{type:'anomalyRemoved' as const,unitId}]:[])];
  if (capacity) { const granted = grantDirectLoot(sold,false,unitLootPolicy); sold=granted.state; events.push(...granted.events); }
  if(sold.phase!=='combat'&&!isCombatRosterLocked(sold)){const drained=drainG23Rewards(sold,unitLootPolicy,events);events.push(...mechanicGrantEvents(sold,drained));sold=drained;}
  return acceptEquipment(sold,events);
}
function execute_setShopLock(state: MatchState, locked: boolean, expectedGeneration: number): MatchCommandResult {
  if (!canOperateMatch(state)) return fail(state, 'wrong-phase');
  if (typeof locked !== 'boolean') return fail(state, 'invalid-choice');
  if (expectedGeneration !== state.shop.generation) return fail(state, 'stale-shop');
  if (Boolean(state.shop.locked) === locked) return { ok: true, state, events: [] };
  return accept(recordShopLock(state,{ ...state, shop: { ...state.shop, locked } }));
}
function execute_rerollShop(state: MatchState): MatchCommandResult {
  if (!canOperateMatch(state)) return fail(state, 'wrong-phase');
  const spent = spendFreeReroll(state), cost = spent.free ? 0 : MATCH_RULES.rerollCost;
  if (state.gold < cost) return fail(state, 'insufficient-gold');
  const generated = drawSoloAugmentShop(recordShopReroll(spent.state),sixCostShopContext(state),false,'reroll',state);
  if (needsAnomalyRecruitment(state) && !affordableOffer({ ...state, ...generated }, state.gold - cost)) return fail(state, 'insufficient-gold');
  return accept({ ...generated, gold: state.gold - cost,
    shop: { ...generated.shop, locked: Boolean(state.shop.locked) } });
}
function execute_buyXp(state: MatchState, unitLootPolicy?: UnitLootPolicy): MatchCommandResult {
  if(state.sharedPool&&state.augments.some(a=>a.definitionId==='dual-purpose'))return fail(state,'invalid-mechanic-state');
  return buyXpWithShopRefresh(state,unitLootPolicy);
}
/** Shared-pool transactions supply their authoritative shop generator; direct shared Dual Purpose is refused. */
export function buyXpWithShopRefresh(state:MatchState,unitLootPolicy?:UnitLootPolicy,refreshShop?:(leveled:MatchState)=>MatchState):MatchCommandResult {
  if (!canOperateMatch(state)) return fail(state, 'wrong-phase');
  if (state.level >= MATCH_RULES.maxLevel) return fail(state, 'max-level');
  const cost = xpPurchaseCost(state.augments, state.round);
  if (state.gold < cost) return fail(state, 'insufficient-gold');
  if (needsAnomalyRecruitment(state) && !affordableOffer(state, state.gold - cost)) return fail(state, 'insufficient-gold');
  const progression = grantXp(state.level, state.xp, xpPurchaseAmount(state.augments, state.round));
  let leveled=applyLevelUpHealth(state, { ...state, gold: state.gold - cost, level: progression.level, xp: progression.xp });
  leveled=recordShopXp(state,leveled);
  const dual=state.augments.some(a=>a.definitionId==='dual-purpose');
  if(dual){
    leveled={...leveled,resourceProvenance:appendResourceProvenance(leveled.resourceProvenance,state.roundDefinitionId,{
      kind:'dual-purpose-xp-purchased',levelBefore:state.level,xpBefore:state.xp,generation:state.shop.generation+1,
      settled:state.roundResults.some(r=>r.round===state.round),
    })};
    // An XP-triggered regeneration costs neither gold nor a free-reroll credit; preserve the lock.
    if(state.sharedPool&&!refreshShop)return fail(state,'invalid-mechanic-state');
    leveled=recordShopReroll(leveled);
    if(refreshShop)leveled=refreshShop(leveled);
    else {
      leveled=drawSoloAugmentShop(leveled,sixCostShopContext(leveled),false,'dual-purpose');
    }
    leveled=drainBatch5Gold(leveled);
    if(needsAnomalyRecruitment(state)&&!affordableOffer(leveled))return fail(state,'insufficient-gold');
  }
  if(leveled.level===state.level||!state.augments.some(a=>AUGMENT_BATCH4[a.definitionId]))return accept(leveled,mechanicGrantEvents(state,leveled));
  const gifted=isCombatRosterLocked(leveled)?drainBatch4Gold(leveled):drainP2Gifts(leveled,unitLootPolicy);
  return accept(gifted,mechanicGrantEvents(state,gifted));
}
export function matchStartFailure(state: MatchState): MatchFailure | undefined {
  if (state.m8.loot.layoutBinding.mode === 'shared-deferred') return 'wrong-phase';
  if (state.phase !== 'preparation') return 'wrong-phase';
  if (state.multiplayer?.status === 'eliminated') return 'wrong-phase';
  if (state.multiplayer && state.m8.round.kind === 'pvp') return 'wrong-phase';
  if (needsAnomalyRecruitment(state)) return 'missing-player';
  if (getPlayerDeploymentCount(state.preparation) > getDeploymentCap(state)) return 'population-cap';
  const reason = validateCombatStart(state.preparation);
  // An empty deployment may concede the round, preventing a zero-gold/empty-roster soft lock.
  return reason === 'missing-player' ? undefined : reason;
}
/** Freeze income entitlement; commit victory gold, XP, HP, growth and the settlement identity once. */
function settleRound(state: MatchState, combat: FinishedCombat | null, pendingDelta: readonly import('./match-types').PersistentGrowth[] = [],unitLootPolicy?:UnitLootPolicy,hookEvents:MatchEvent[]=[]): MatchState {
  if (state.roundResults.some(record => record.round >= state.round)) throw new Error('Duplicate settlement');
  const {kind:roundKind,isFinal,roundId} = state.m8.round;
  const survivingEnemyCount = combat?.units.filter(unit => countsG23SurvivorDamage(unit) && unit.team === 'enemy').length ?? 0;
  let plan = resolveRoundEconomy({ augments:state.augments, roundId, result: combat?.result ?? null, gold: state.gold,
    streak: state.streak, level: state.level, xp: state.xp, hp: state.playerHp, enemySurvivors: survivingEnemyCount });
  plan=withBatch4B4xp(state,plan,batch4B4xpSettlementXp(state));
  const facts=combat?g23SoloFacts(state,combat):undefined,saved=melCanSave(state,facts,plan.hpAfter);
  if(saved)plan={...plan,hpAfter:1,hpLost:state.playerHp-1};
  const growth = new Map(state.persistentGrowth.map(entry => [entry.unitId, entry.attackDamageBps]));
  for (const delta of pendingDelta) growth.set(delta.unitId,(growth.get(delta.unitId)??0)+delta.attackDamageBps);
  const resourceProvenance = combat ? appendResourceProvenance(state.resourceProvenance,roundId,{
    kind:'combat-growth-committed',combatId:combat.combatId!,settlementId:`round-${state.round}-settled`,
    combatStartProvenancePrefixLength:state.combatInputBasis!.provenancePrefixLength,
    sourceDeltas:combatGrowth(combat).map(({unitId,attackDamageBps})=>({sourceUnitId:unitId,attackDamageBps})),
  }) : state.resourceProvenance;
  const terminal = plan.hpAfter === 0 || isFinal;
  const outcome = terminal ? isFinal && plan.hpAfter > 0 && combat?.result === 'playerWin' ? 'victory' as const : 'defeat' as const : null;
  const settled:MatchState={ ...state, resourceProvenance, phase: terminal && !state.multiplayer ? 'gameOver' : 'settlement',
    outcome:state.multiplayer ? null : outcome, combat,
    ...(state.multiplayer ? {multiplayer:{...state.multiplayer,status:plan.hpAfter===0?'eliminated' as const:'active' as const}} : {}),
    gold: plan.goldAfter - deferredRoundIncome(plan), playerHp: plan.hpAfter, streak: plan.streakAfter, level: plan.progression.level, xp: plan.progression.xp,
    persistentGrowth: [...growth].map(([unitId,attackDamageBps]) => ({unitId,attackDamageBps})).sort((a,b)=>a.unitId.localeCompare(b.unitId)),
    augmentProgress: {
      pumpingRounds: state.augmentProgress.pumpingRounds + (state.augments.some(a => a.definitionId === 'pumping-up-i') ? 1 : 0),
      investmentHp: state.augmentProgress.investmentHp,
      ...(state.augmentProgress.forming ? { forming: state.augmentProgress.forming } : {}),
      ...(state.augmentProgress.magicRoll ? { magicRoll: state.augmentProgress.magicRoll } : {}),
    },
    roundResults: [...state.roundResults, { round: state.round, roundId, settlementId: `round-${state.round}-settled`, roundKind,
      result: combat?.result ?? 'supply', combatTicks: combat?.tick ?? 0, combatEventCount:combat?.nextEventSeq??0,
      ...(combat?.bankSamples ? {bankSamples:combat.bankSamples} : {}),
      income: plan.income, incomeBreakdown: plan.incomeBreakdown, interestBasis: plan.interestBasis,
      streakBefore: state.streak, streakAfter: plan.streakAfter, mechanicReceiptPrefixLength:state.seatMechanics?.receipts.length??0,goldBefore: state.gold, goldAfter: plan.goldAfter,
      xpRequested: plan.progression.xpRequested, xpAwarded: plan.progression.xpApplied,
      levelBefore: state.level, levelAfter: plan.progression.level, xpBefore: state.xp, xpAfter: plan.progression.xp,
      hpBefore: state.playerHp, hpAfter: plan.hpAfter, baseDamage: plan.baseDamage, survivingEnemyCount,
      playerDamage: plan.playerDamage, hpLost: plan.hpLost }] };
  let committed=combat?grantPveRemover(commitG23Settlement(settled,facts!,unitLootPolicy,hookEvents)):settled;
  const contested=drainContestedGold(committed);hookEvents.push(...mechanicGrantEvents(committed,contested));committed=contested;
  if(!combat&&state.augments.some(a=>AUGMENT_BATCH4[a.definitionId])){
    const gifted=drainP2Gifts(committed,unitLootPolicy);hookEvents.push(...mechanicGrantEvents(committed,gifted));committed=gifted;
  }
  return applyLevelUpHealth(state,commitOpeningEncounterHealth(saved?commitMelSave(committed,combat!.combatId!,hookEvents):committed,hookEvents));
}
function combatGrowth(combat: CombatState): readonly import('./match-types').PersistentGrowth[] {
  const growth=combat.units.filter(unit=>unit.team==='player' && !unit.itemSummon && (unit.runtime?.permanentAdBps??0)>0)
    .map(unit=>({unitId:unit.id,attackDamageBps:unit.runtime!.permanentAdBps}));
  for(const split of combat.trenchSplits??[])if(split.permanentAdBps>0&&split.copyIds.some(id=>combat.units.some(u=>u.id===id&&u.team==='player')))
    growth.push({unitId:split.ownerId,attackDamageBps:split.permanentAdBps});
  return growth.sort((a,b)=>a.unitId<b.unitId?-1:a.unitId>b.unitId?1:0);
}
function enterLootChoice(state: MatchState): {state:MatchState;events:MatchEvent[]} {
  const descriptor = unresolvedLootChoices(state)[0];
  if (!descriptor) return {state,events:[]};
  const pendingChoice=makeLootPendingChoice(descriptor);
  return {state:{...state,phase:'choice',combat:state.combat as FinishedCombat,pendingChoice},events:[{type:'choiceOpened',choice:pendingChoice}]};
}
function withCombat(initial: MatchState, combat: CombatState, unitLootPolicy?: UnitLootPolicy): { state: MatchState; events: MatchEvent[] } {
  const revealed=revealMatchLoot(initial,combat), events=[...revealed.events];
  if (combat.status === 'running') return { state: { ...revealed.state, phase:'combat',combat:combat as RunningCombat },events };
  if (combat.result === null) throw new Error('Invalid combat result');
  const before:MatchState={...revealed.state,phase:'settlement',combat:combat as FinishedCombat,pendingChoice:null};
  let terminal=(!before.multiplayer && before.m8.round.isFinal) || resolveRoundEconomy({augments:before.augments,roundId:before.roundDefinitionId,result:combat.result,
    gold:before.gold,streak:before.streak,level:before.level,xp:before.xp,hp:before.playerHp,
    enemySurvivors:combat.units.filter(unit=>unit.team==='enemy'&&countsG23SurvivorDamage(unit)).length}).hpAfter===0;
  if(terminal&&melCanSave(before,g23SoloFacts(before,combat),0)&&!before.m8.round.isFinal)terminal=false;
  const granted=grantDirectLoot(before,terminal,unitLootPolicy); let state=granted.state; events.push(...granted.events);
  if (terminal) for (const descriptor of unresolvedLootChoices(state)) {
    const fallback=grantLootChoice(state,descriptor,descriptor.terminalFallbackDefinitionId,'terminal-fallback');
    state=fallback.state;events.push(...fallback.events);
  }
  const equipment=planTemporaryEquipment(state); events.push(...equipment.events);
  const settledPlan=resolveDeferredUpgrades(settleRound(equipment.state,combat as FinishedCombat,mergeGrowthLedger(combatGrowth(combat),granted.upgradeEvents),unitLootPolicy,events));
  const afterUpgrades=settledPlan.state.augments.some(a=>a.definitionId==='glorious-evolution') ? drainP2Gifts(settledPlan.state,unitLootPolicy) : settledPlan.state;
  let settled=pruneForgePositions(reconcileD14(afterUpgrades,events)); events.push(...settledPlan.events,...mechanicGrantEvents(initial,settled));
  events.push({type:'roundSettled',round:state.round});
  if (settled.phase==='gameOver' || settled.multiplayer?.status==='eliminated') {
    const forfeited=forfeitUnclaimedOrbs(settled); return {state:forfeited.state,events:[...events,...forfeited.events]};
  }
  const queued=settleQueuedOrbClaims(settled,unitLootPolicy);settled=queued.state;events.push(...queued.events);
  const choice=enterLootChoice(settled);
  if (choice.state.phase==='choice') return {state:choice.state,events:[...events,...choice.events]};
  const entered=enterScheduledEvents(settled,'after');
  return {state:entered.state,events:[...events,...entered.events]};
}
function execute_startMatchCombat(state: MatchState, unitLootPolicy?: UnitLootPolicy): MatchCommandResult {
  const reason = matchStartFailure(state); if (reason) return fail(state, reason);
  const draw = nextRandom(state.battleSeedRngState);
  const combatInputBasis=freezeCombatInput(state,draw.word,state.resourceProvenance.entries.length);
  const started = createCombatWithEvents(combatInputBasis.inputs.preparation, buildStrategySnapshot(combatInputBasis.inputs), `round-${state.round}`, draw.word);
  const combatStart = !state.multiplayer && state.m8.round.kind === 'pvp' && state.augments.some(a=>a.definitionId==='contested')
    ? recordAugmentPvpRoster(state, started.state.combatId!, [{...historyRoster(state),seatId:'solo',index:0,hp:state.playerHp,alive:true,rank:1,eliminatedRound:null}], null) : state;
  const next = withCombat({ ...combatStart, combatInputBasis,battleSeedRngState: draw.state }, started.state, unitLootPolicy);
  return accept(next.state, [...toLedgerEvents(started.events), ...next.events]);
}
/** Streaming PvE: only open/advance combat here. Terminal loot, income and pool reservations
 * are committed later in fixed seat order by settleCombatStream. No wall clock enters rules. */
function execute_openMatchCombatStream(state: MatchState): MatchCommandResult & { readonly streamInitial?: CombatState } {
  return drainSetup(openMatchCombatStreamSteps(state));
}
export function* openMatchCombatStreamSteps(state: MatchState): Generator<void, MatchCommandResult & { readonly streamInitial?: CombatState }, void> {
  const reason = matchStartFailure(state); if (reason) return fail(state, reason);
  const draw = nextRandom(state.battleSeedRngState);
  const combatInputBasis = freezeCombatInput(state, draw.word, state.resourceProvenance.entries.length);
  yield;
  const strategy = yield* buildStrategySnapshotSteps(combatInputBasis.inputs);
  yield;
  const started = yield* createCombatWithEventsSteps(combatInputBasis.inputs.preparation, strategy, `round-${state.round}`, draw.word);
  yield;
  const base = { ...state, combatInputBasis, battleSeedRngState: draw.state };
  const opened = started.state.status === 'running' ? withCombat(base, started.state) : { state: base, events: [] };
  const accepted = accept(opened.state, [...toLedgerEvents(started.events), ...opened.events]);
  if (accepted.ok && state.multiplayer && started.state.status === 'finished') {
    const revealed = revealMatchCombatStreamTerminal(accepted.state, started.state);
    return revealed.ok ? { ...revealed, events: [...accepted.events, ...revealed.events], streamInitial: started.state } : fail(state, revealed.reason);
  }
  return { ...accepted, streamInitial: started.state };
}
/** The final step is staged separately; its complete ledger is still recorded immediately. */
function execute_stepMatchCombatStream(state: MatchState, beforeTick?: import('./battle-input-log').BattleTickInputSource): MatchStep & { readonly terminal: CombatState | null } {
  if (state.pendingCombatTerminal) return { state, events: [], terminal: state.pendingCombatTerminal };
  if (state.phase !== 'combat' || state.multiplayer && state.m8.round.kind === 'pvp') throw new Error('wrong-phase');
  const requested = beforeTick?.(state.combat.tick + 1);
  if (requested !== undefined && (!Array.isArray(requested) || canonicalContent(requested) !== canonicalContent(state.combat.pendingEquipment?.map(r => r.input) ?? []))) throw new Error('battle-input-invalid');
  const sampled = state.multiplayer ? sampleD11CombatGold(state.combat, 'player', state.gold) : state.combat;
  const live = sampled === state.combat ? sampled : { ...sampled, bankSamples: [...(state.combat.bankSamples ?? []),
    { tick: state.combat.tick, team: 'player' as const, liveGold: state.gold }] };
  const next = stepCombat(live);
  if (next.state.status === 'finished') return { state, events: toLedgerEvents(next.events), terminal: next.state };
  const progressed = withCombat(state, next.state);
  const result = accept(progressed.state, [...toLedgerEvents(next.events), ...progressed.events]);
  return { state: result.state, events: result.ok ? result.events : [], terminal: null };
}
/** Reveal the trusted PvE terminal without granting loot, income or pool reservations. */
function execute_revealMatchCombatStreamTerminal(state: MatchState, terminal: CombatState): MatchCommandResult {
  if (!isMatchCombatStreamTerminal(state, terminal)) return fail(state, 'wrong-phase');
  if (state.pendingCombatTerminal) return canonicalContent(state.pendingCombatTerminal) === canonicalContent(terminal)
    ? { ok: true, state, events: [] } : fail(state, 'wrong-phase');
  const revealed = revealMatchLoot({ ...state, pendingCombatTerminal: terminal }, terminal);
  return { ok: true, ...stampMatchEvents(revealed.state, revealed.events) };
}
/** Trusted first-pass terminal only; a duplicate refuses before granting anything. */
function execute_settleMatchCombatStream(state: MatchState, terminal: CombatState, unitLootPolicy?: UnitLootPolicy): MatchCommandResult {
  if (state.roundResults.some(record => record.round >= state.round) || terminal.status !== 'finished'
    || terminal.combatId !== `round-${state.round}` || !state.combatInputBasis
    || terminal.tick < (state.combat?.tick ?? 0)
    || state.pendingCombatTerminal && canonicalContent(state.pendingCombatTerminal) !== canonicalContent(terminal)) return fail(state, 'wrong-phase');
  const { pendingCombatTerminal: _pending, ...base } = state;
  const settled = withCombat(base, terminal, unitLootPolicy);
  return accept(settled.state, settled.events);
}
function execute_stepMatch(state: MatchState, unitLootPolicy?: UnitLootPolicy): MatchStep {
  if (state.phase !== 'combat' || state.pendingCombatTerminal) return { state, events: [] };
  // Online PvP is resolved only by the two-sided runner and an external receipt.
  if (state.multiplayer && state.m8.round.kind === 'pvp') return {state,events:[]};
  const sampled=state.multiplayer?sampleD11CombatGold(state.combat,'player',state.gold):state.combat;
  const live=sampled===state.combat?sampled:{...sampled,bankSamples:[...(state.combat.bankSamples??[]),
    {tick:state.combat.tick,team:'player' as const,liveGold:state.gold}]};
  const next = stepCombat(live), settled = withCombat(state, next.state, unitLootPolicy);
  const result = accept(settled.state, [...toLedgerEvents(next.events), ...settled.events]);
  return { state: result.state, events: result.ok ? result.events : [] };
}
/** P7 replaces the supply choice, but keeps that natural round's economy exactly once. */
export function finishCarouselSupply(state:MatchState):MatchCommandResult {
  if(!state.carousel||state.m8.round.kind!=='supply'||state.phase!=='preparation'||state.pendingChoice||!state.carousel.receipts.some(r=>r.carouselId.endsWith(`:carousel:${state.roundDefinitionId}`)&&r.status==='granted'))return fail(state,'wrong-phase');
  const settled=settleRound(state,null);
  return accept({...settled,phase:'settlement',combat:null},[{type:'roundSettled',round:state.round}]);
}
function execute_nextRound(state: MatchState, expectedRound: number, layout?:OrbLayoutLedger, augmentBlocked: readonly string[] = []): MatchCommandResult {
  const initial = state;
  if (state.multiplayer?.status === 'eliminated') return fail(state,'wrong-phase');
  if (state.phase !== 'settlement') return fail(state, 'wrong-phase');
  if (expectedRound !== state.round) return fail(state, 'stale-round');
  if (unresolvedLootChoices(state).length || hasPendingLootCapacity(state)) return fail(state,'unsettled-round');
  if (state.roundResults.length !== state.round || state.roundResults.at(-1)?.round !== state.round) return fail(state, 'unsettled-round');
  const definition = getNextCatalogRound(state.m8.round.roundId);
  if (!definition) return fail(state, 'wrong-phase');
  const augment = getRoundSchedule(definition.ordinal).find(e => e.kind === 'augment');
  if (augment && augmentCandidates(resolveAugmentTier(state, augment.id), state.augments, state.removedAugmentIds,openingEncounterId(state), openingOfferFilter(state, augment.id, augmentBlocked)).length < 3)
    return fail(state, 'augment-pool-too-small');
  state = payPreviousRoundIncome(state);
  const round = definition.ordinal, m8 = prepareRound(state.seed,round,state.m8.loot,layout);
  state=pandoraRoundEntry(state,round,definition.roundId);
  // Round-start XP is granted only after the previous round has settled; retries fail above.
  state = grantCookingPotGrowth(recordAugmentRoundEntry({...state, round}));
  if(!state.multiplayer&&state.augments.some(a=>a.definitionId==='scoreboard-scrapper'))
    state=recordAugmentTable(state,'entry',[{...historyRoster(state),seatId:'solo',index:0,hp:state.playerHp,alive:true,rank:1,eliminatedRound:null}]);
  const entryLevel = state.level;
  const progression = grantXp(state.level,state.xp,readAugmentIncome(state.augments).roundXp+batch3EntryXp(state.augments,state.roundResults,round));
  state={...state,level:progression.level,xp:progression.xp};
  state=recordShopRound({...state,round});
  const emptyAnomaly = getRoundSchedule(round).some(event => event.kind === 'anomaly') && !state.preparation.units.some(unit => unit.team === 'player');
  // An exhausted locked shop cannot supply a target. Use this round's normal free refresh.
  const refresh = state.shop.locked && !subscriptionStageStart(state,round) && !(emptyAnomaly && !affordableOffer(state)) ? { shop: state.shop, rngState: state.rngState } : drawSoloAugmentShop({...state,round},sixCostShopContext(state),subscriptionStageStart(state,round));
  const carousel = resolveCarouselPreparation({ ...state, ...refresh, round, m8, roundDefinitionId: definition.roundId, phase: 'preparation', combat: null, combatInputBasis:null,
    preparation: { ...state.preparation, units: [...state.preparation.units.filter(unit => unit.team === 'player'), ...m8.preparation.enemies] } });
  let prepared = growTrainerGolem(enterOpeningCrabs(carousel.state));
  const portfolio = drainPortfolioGold(prepared), portfolioEvents = stampMatchEvents(portfolio, mechanicGrantEvents(prepared,portfolio));
  prepared = portfolioEvents.state;
  const openingEvents: MatchEvent[] = [...portfolioEvents.events];
  const applied=applyOpeningRoundEntry(prepared);
  if(!applied.ok)return fail(initial,applied.reason);
  // Entry level-ups heal after the opening encounter's damage (P), never a player it eliminated.
  const drained=drainBatch3RoundEntry(applyLevelUpHealth({level:entryLevel},applied.state));
  const gifted=drained.augments.some(a=>(a.definitionId==='a-change-of-fate'||a.definitionId==='replication'||a.definitionId==='pilfer'||a.definitionId==='glorious-evolution'||a.definitionId==='hard-commit'))?drainP2Gifts(drained):drained;
  const shopEntry=enterShopAugmentRound(gifted),shopEvents=stampMatchEvents(shopEntry,mechanicGrantEvents(drained,shopEntry));
  prepared=shopEvents.state;openingEvents.push(...applied.events,...mechanicGrantEvents(applied.state,drained),...shopEvents.events);
  if (prepared.phase === 'gameOver') {
    const terminal = stampMatchEvents(prepared, carousel.events);
    return {ok: true, state:terminal.state, events: [...openingEvents, ...terminal.events]};
  }
  if(prepared.m8.loot.layoutBinding.mode!=='shared'){const steal=planFiresale(prepared,round);if(steal){const result=stealFiresaleUnit(prepared,steal.owner,steal.slot);const stamped=stampMatchEvents(result.state,result.events);prepared=stamped.state;openingEvents.push(...stamped.events);}}
  const entered = enterScheduledEvents(prepared, 'before', augmentBlocked);
  const accepted = acceptEquipment(entered.state, [...carousel.events,...entered.events]);
  return accepted.ok ? {...accepted, events: [...openingEvents, ...accepted.events]} : accepted;
}

/** Online advancement. Shared seats must use the all-seat nextSharedRound transaction. */
function execute_advanceMultiplayerRound(state: MatchState, expectedRound: number, layout?:OrbLayoutLedger, augmentBlocked: readonly string[] = []): MultiplayerCommandResult {
  const initial=state;
  if (!state.multiplayer) return multiplayerFail(state, 'multiplayer-required');
  if (state.multiplayer.status === 'eliminated') return multiplayerFail(state, 'seat-eliminated');
  if (state.sharedPool) return multiplayerFail(state, 'shared-pool-required');
  if (expectedRound !== state.round) return multiplayerFail(state, 'stale-round');
  if (state.phase !== 'settlement') return multiplayerFail(state, 'wrong-phase');
  if (state.pendingChoice || unresolvedLootChoices(state).length || hasPendingLootCapacity(state)
    || state.roundResults.length !== state.round
    || state.roundResults.some((record, index) => record.round !== index + 1)) return multiplayerFail(state, 'unsettled-round');
  try {
    const current = getMultiplayerRoundByOrdinal(state.round);
    if (current.roundId !== state.roundDefinitionId || current.roundId !== state.m8.round.roundId) return multiplayerFail(state, 'stale-round');
    if (state.round < FINAL_ROUND) return nextRound(state, expectedRound, layout, augmentBlocked);
    state = payPreviousRoundIncome(state);
    const definition = getMultiplayerRoundByOrdinal(state.round + 1);
    const m8: MatchState['m8'] = { ...state.m8, round: definition, encounterPlan: null,
      preparation: { version: ROUND_PREPARATION_RULES.version, roundId: definition.roundId,
        encounterId: null, contentStatus: 'not-pve', enemies: [] } };
    state=pandoraRoundEntry(state,definition.ordinal,definition.roundId);
    state = grantCookingPotGrowth(recordAugmentRoundEntry({...state, round: definition.ordinal}));
    const entryLevel=state.level;
    const progression=grantXp(state.level,state.xp,readAugmentIncome(state.augments).roundXp+batch3EntryXp(state.augments,state.roundResults,definition.ordinal));
    state={...state,level:progression.level,xp:progression.xp};
    state=recordShopRound({...state,round:definition.ordinal});
    const refresh = state.shop.locked && !subscriptionStageStart(state,definition.ordinal) ? { shop: state.shop, rngState: state.rngState }
      : drawSoloAugmentShop({...state,round:definition.ordinal},sixCostShopContext(state),subscriptionStageStart(state,definition.ordinal));
    const applied=applyOpeningRoundEntry({ ...state, ...refresh, round: definition.ordinal, roundDefinitionId: definition.roundId,
      m8, phase: 'preparation', combat: null, combatInputBasis: null, pendingChoice: null, outcome: null,
      preparation: { ...state.preparation, units: state.preparation.units.filter(unit => unit.team === 'player') } });
    if(!applied.ok)return multiplayerFail(initial,applied.reason);
    const entry=drainPortfolioGold(drainBatch3RoundEntry(applyLevelUpHealth({level:entryLevel},applied.state)));
    const gifted=entry.augments.some(a=>(a.definitionId==='a-change-of-fate'||a.definitionId==='replication'||a.definitionId==='pilfer'||a.definitionId==='hard-commit'))?drainP2Gifts(entry):entry;
    const drained=enterShopAugmentRound(gifted),accepted=acceptEquipment(drained,mechanicGrantEvents(applied.state,drained));
    return accepted.ok?{...accepted,events:[...applied.events,...accepted.events]}:accepted;
  } catch { return multiplayerFail(initial, 'invalid-round'); }
}

function execute_useConsumable(state:MatchState,consumableId:string,target:ConsumableTarget):MatchCommandResult {
  if (state.consumables.find(c=>c.consumableId===consumableId)?.definitionId === 'masterwork-upgrade') {
    const opened = openMasterworkChoice(state,consumableId,target);
    return opened.ok ? acceptEquipment(opened.state,opened.events) : opened;
  }
  const plan=planConsumable(state,consumableId,target);
  if(!plan.ok)return fail(state,plan.reason);
  const used={...plan.state,resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,
    {kind:'consumable-used',record:plan.record,...(state.phase === 'combat' && state.combat ? {tick:state.combat.tick} : {})})};
  const copied=grantConsumableCopy(used,plan.record);
  const gifted=copied.state.augments.some(a=>a.definitionId==='why-not-both')&&copied.state.phase!=='combat'&&!isCombatRosterLocked(copied.state)?drainP2Gifts(copied.state):copied.state;
  return acceptEquipment(gifted,[...plan.events,...copied.events,...mechanicGrantEvents(copied.state,gifted)]);
}
function execute_combineItems(state: MatchState, aId: string, bId: string): MatchCommandResult {
  const preview = previewCombine(state, aId, bId);
  if (!preview.allowed) return fail(state, preview.reason);
  const plan = planCombine(state.items, state.nextItemSerial, aId, bId);
  const timing = state.phase === 'combat' && state.combat ? {tick:state.combat.tick} : {};
  if(!plan.ok)return fail(state,plan.reason);
  const crafted=convertAcademicCraft({ ...state, items: plan.items, nextItemSerial: plan.nextItemSerial,
    resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,plan.events.filter((event):event is Extract<import('./strategy-types').StrategyEvent,{type:'itemCombined'}>=>event.type==='itemCombined').map(event=>({kind:'item-combined' as const,event,...timing}))) });
  const gifted=crafted.items===plan.items||state.phase==='combat'||isCombatRosterLocked(state)?crafted:drainBatch1Gifts(crafted);
  return accept(gifted,[...plan.events,...mechanicGrantEvents(crafted,gifted)]);
}
function execute_equipItem(state: MatchState, itemId: string, unitId: string, slot: number, options?: { readonly deferBattleEquipment?: boolean }): MatchCommandResult {
  const preview = previewEquip(state, itemId, unitId, slot);
  if (!preview.allowed) return fail(state, preview.reason);
  const plan = planEquip(state.items, state.preparation, itemId, unitId, slot, state.nextItemSerial);
  if (!plan.ok) return fail(state, plan.reason);
  const combined = plan.events.filter((event): event is Extract<import('./strategy-types').StrategyEvent, {type:'itemCombined'}> => event.type === 'itemCombined');
  const timing = state.phase === 'combat' && state.combat ? {tick:state.combat.tick} : {};
  const crafted = convertAcademicCraft({ ...state, items: plan.items, nextItemSerial: plan.nextItemSerial,
    resourceProvenance: combined.length ? appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId,
      combined.map(event => ({ kind: 'item-combined' as const, event, ...timing })))
      : appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId, {kind:'item-equipped',itemId,unitId,slot:plan.events.find(event => event.type === 'itemEquipped')!.slot,...timing}),
  });
  const gifted=crafted.items===plan.items||state.phase==='combat'||isCombatRosterLocked(state)?crafted:drainBatch1Gifts(crafted);
  const accepted = acceptEquipment(gifted,[...plan.events,...mechanicGrantEvents(crafted,gifted)]);
  if (accepted.ok && !(options?.deferBattleEquipment && state.multiplayer) && state.phase === 'combat' && state.combat?.status === 'running' && state.combatInputBasis
    && !(state.multiplayer && state.m8.round.kind === 'pvp')
    && state.preparation.units.some(u => u.id === unitId && u.location.kind === 'board')) {
    const prior = state.combat.pendingEquipment?.at(-1) ?? state.combat.equipmentReceipts?.at(-1);
    const staged = queueMatchBattleEquipment(state, accepted.state,
      { kind: 'equipment', seq: (prior?.input.seq ?? 0) + 1, effectiveTick: state.combat.tick + 1,
        seatId: state.multiplayer?.seatId ?? 'player', itemId, unitId, slot });
    return staged.ok ? { ...accepted, state: staged.state } : staged;
  }
  return accepted;
}
/** Authoritative PvE adapter. The caller commits equipped assets and this intent together. */
export function queueMatchBattleEquipment(before: MatchState, equipped: MatchState,
  input: import('./battle-input-log').BattleEquipmentInput): MatchCommandResult {
  if (before.phase !== 'combat' || before.pendingCombatTerminal || before.combat.status !== 'running' || !before.combatInputBasis) return fail(before, 'wrong-phase');
  try {
    const prior = before.combat.pendingEquipment?.at(-1) ?? before.combat.equipmentReceipts?.at(-1);
    const receipt = prepareBattleEquipment(prior?.after ?? before.combatInputBasis.inputs, input, equipped, 'player', before.combatInputBasis.battleSeed);
    installBattleEquipmentBatch(before.combat, [...before.combat.pendingEquipment ?? [], receipt]);
    return { ok: true, events: [], state: { ...equipped, combat: { ...before.combat,
      pendingEquipment: [...before.combat.pendingEquipment ?? [], receipt] } } as MatchState };
  } catch (error) { return fail(before, error instanceof Error && error.message === 'battle-unit-unavailable' ? 'battle-unit-unavailable' : 'battle-input-invalid'); }
}

function choiceFailure(state: MatchState, choiceId: string, generation: number): MatchFailure | undefined {
  if (state.phase !== 'choice' || isCombatRosterLocked(state)) return 'wrong-phase';
  if (!state.pendingChoice || state.pendingChoice.choiceId !== choiceId || state.pendingChoice.generation !== generation) return 'stale-choice';
  return undefined;
}
function execute_selectAnomalyTarget(state: MatchState, choiceId: string, generation: number, unitId: string): MatchCommandResult {
  const reason = choiceFailure(state, choiceId, generation); if (reason) return fail(state, reason);
  const choice = state.pendingChoice!;
  if (choice.kind !== 'anomaly' || choice.step !== 'target') return fail(state, 'invalid-choice');
  const target = state.preparation.units.find(unit => unit.id === unitId);
  if (!target || target.team !== 'player' || isAnvil(target.definitionId) || state.anomalyBinding !== null) return fail(state, 'invalid-target');
  if(state.multiplayer&&choice.offers.some(id=>!eligibleD14Target(target,id)))return fail(state,'invalid-target');
  const draw = state.multiplayer && choice.offers.length
    ? {offers:choice.offers,choiceRngState:state.choiceRngState}
    : generateAnomalyOffer(anomalyCandidates(!!state.multiplayer).filter(id=>eligibleD14Target(target,id)), state.choiceRngState);
  return accept({ ...state, choiceRngState: draw.choiceRngState, pendingChoice: { ...choice, step: 'offer', targetId: unitId, offers: draw.offers, generation: generation + 1 } },
    [{ type: 'anomalyTargetSelected', choiceId, unitId }]);
}
/** Base slot rerolls and any shared extra uses; missing legacy slot arguments fail closed until UI/server wiring. */
function execute_rerollAugment(state: MatchState, choiceId: string, generation: number, optionIndex?: number, augmentBlocked: readonly string[] = []): MatchCommandResult {
  const choice = state.pendingChoice;
  if (state.phase !== 'choice' || choice?.kind !== 'augment' || choice.step !== 'offer'
    || isCombatRosterLocked(state) || state.multiplayer?.status === 'eliminated') return fail(state, 'wrong-phase');
  if (choice.choiceId !== choiceId || choice.generation !== generation) return fail(state, 'stale-choice');
  if (optionIndex === undefined || !Number.isSafeInteger(optionIndex) || optionIndex < 0 || optionIndex >= choice.offers.length) return fail(state, 'invalid-slot');
  const tier = resolveAugmentTier(state, choiceId);
  const record = state.augmentOffers.find(candidate => candidate.choiceId === choiceId);
  if (!record) return fail(state, 'stale-choice');
  if (!canRerollAugmentSlot(state.augments, choiceId, record.rerolledIndices, optionIndex)) return fail(state, 'augment-rerolls-exhausted');
  const blocked = [...augmentBlocked].sort();
  const candidates = augmentCandidates(tier, state.augments, [...state.removedAugmentIds, ...choice.offers],openingEncounterId(state), {...recordedOfferFilter(record, 0, !!state.carousel && !!state.multiplayer && state.openingEncounter.mode === 'shared'), blocked});
  if (!candidates.length) return fail(state, 'augment-pool-too-small');
  const draw = drawAugmentCard(candidates, state.choiceRngState);
  const rerollCount = choice.rerollCount + 1;
  const offers = [...choice.offers], rerolledSlots = [...choice.rerolledSlots!];
  offers[optionIndex] = draw.definitionId; rerolledSlots[optionIndex] = true;
  const pendingChoice = {...choice, offers, augmentTier:tier, generation:generation+1,
    rerollCount, rerollsRemaining:3+augmentExtraRerolls(state.augments, choiceId)-rerollCount, rerolledSlots};
  return accept({...state, choiceRngState:draw.choiceRngState, pendingChoice,
    removedAugmentIds:[...state.removedAugmentIds,draw.definitionId],
    augmentOffers:state.augmentOffers.map(entry => entry.choiceId === choiceId
      ? {...entry,rerollCount,rerolledIndices:[...entry.rerolledIndices,optionIndex],externalBlocks:[...entry.externalBlocks,blocked]} : entry)},
    [{type:'choiceOpened',choice:pendingChoice}]);
}
function execute_rerollAnomaly(state: MatchState, choiceId: string, generation: number): MatchCommandResult {
  const reason = choiceFailure(state, choiceId, generation); if (reason) return fail(state, reason);
  const choice = state.pendingChoice!;
  if (choice.kind !== 'anomaly' || choice.step !== 'offer') return fail(state, 'invalid-choice');
  if (!state.preparation.units.some(unit => unit.id === choice.targetId && unit.team === 'player')) return fail(state, 'invalid-target');
  if (state.gold < 1) return fail(state, 'insufficient-gold');
  const draw = generateAnomalyOffer(anomalyCandidates(!!state.multiplayer).filter(id => !choice.offers.includes(id)&&eligibleD14Target(state.preparation.units.find(u=>u.id===choice.targetId),id)), state.choiceRngState);
  return accept(recordShopAnomalyReroll(state,{ ...state, gold: state.gold - 1, choiceRngState: draw.choiceRngState,
    pendingChoice: { ...choice, offers: draw.offers, generation: generation + 1, rerollCount: choice.rerollCount + 1 } }),
    [{ type: 'anomalyRerolled', choiceId, generation: generation + 1, cost: 1 }]);
}
function generateAnomalyOffer(ids: readonly string[], rngState: number): { offers: string[]; choiceRngState: number } {
  const pool = [...ids].sort(), draw = nextRandom(rngState);
  return { offers: [pool[Math.floor(draw.word * pool.length / 0x100000000)]], choiceRngState: draw.state };
}

const multiplayerFail = (state: MatchState, reason: MultiplayerFailure): MultiplayerCommandResult => ({ok:false,state,reason});
/** Historical name retained by T3: choose the first offer, skipping only an empty anomaly target. */
function execute_forfeitPendingChoice(state: MatchState, expectedRound: number,
  expectedChoiceId: string | null, expectedGeneration: number | null, unitLootPolicy?: UnitLootPolicy): MultiplayerCommandResult {
  if (!state.multiplayer) {
    const c=state.pendingChoice;
    if(c?.payload?.source!=='anvil-unit')return multiplayerFail(state,'multiplayer-required');
    if(expectedRound!==state.round)return multiplayerFail(state,'stale-round');
    if(c.choiceId!==expectedChoiceId||c.generation!==expectedGeneration)return multiplayerFail(state,'stale-choice');
    const selected=completeMechanicChoice(state,choiceTimeoutOption(c)!,true,unitLootPolicy);
    if(!selected.ok)return selected;
    const timed=accept(selected.state,[{type:'choiceTimedOut',choiceId:c.choiceId,resolution:'default-option'}]);
    return timed.ok?{...timed,events:[...selected.events,...timed.events]}:timed;
  }
  if (state.multiplayer.status === 'eliminated') return multiplayerFail(state,'seat-eliminated');
  if (expectedRound !== state.round) return multiplayerFail(state,'stale-round');
  const choice = state.pendingChoice;
  if (choice ? choice.choiceId !== expectedChoiceId || choice.generation !== expectedGeneration
    : expectedChoiceId !== null || expectedGeneration !== null) return multiplayerFail(state,'stale-choice');
  if (!choice) {
    if (!needsAnomalyRecruitment(state)) return multiplayerFail(state,'no-pending-choice');
    const ids = getRoundSchedule(state.round).filter(e=>e.kind==='anomaly'
      && !state.scheduleReceipts.some(r=>r.eventId===e.id)).map(e=>e.id);
    return accept({...state,multiplayer:{...state.multiplayer,
      forfeitedChoices:[...new Set([...state.multiplayer.forfeitedChoices,...ids])]}},
      ids.map(choiceId=>({type:'choiceTimedOut' as const,choiceId,resolution:'empty-anomaly' as const})));
  }
  if (state.phase !== 'choice') return multiplayerFail(state,'wrong-phase');
  try {
    let current: MatchState = state;
    const events: MatchEvent[] = [];
    if (choice.kind === 'anomaly' && choice.step === 'target') {
      const target = state.preparation.units.filter(u=>u.team==='player'&&choice.offers.every(id=>eligibleD14Target(u,id))).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)[0];
      if (!target) return accept({...state,phase:choice.returnPhase ?? 'preparation',combat:null,pendingChoice:null,
        multiplayer:{...state.multiplayer,forfeitedChoices:[...new Set([...state.multiplayer.forfeitedChoices,choice.eventId])]}} as MatchState,
        [{type:'choiceTimedOut',choiceId:choice.choiceId,resolution:'empty-anomaly'}]);
      const selected = selectAnomalyTarget(current,choice.choiceId,choice.generation,target.id);
      if (!selected.ok) return multiplayerFail(state,selected.reason);
      current=selected.state; events.push(...selected.events);
    }
    if (isMechanicChoice(choice)) {
      const selected=completeMechanicChoice(state,choiceTimeoutOption(choice)!,true,unitLootPolicy);
      if (!selected.ok) return multiplayerFail(state,selected.reason);
      const marked=accept(selected.state,[{type:'choiceTimedOut',choiceId:choice.choiceId,resolution:'default-option'}]);
      return marked.ok ? {...marked,events:[...selected.events,...marked.events]} : fail(state,marked.reason);
    }
    const pending=current.pendingChoice!;
    if (!pending.offers.length) return multiplayerFail(state,'invalid-choice');
    const selected=selectChoice(current,pending.choiceId,pending.generation,pending.offers[0],unitLootPolicy);
    if (!selected.ok) return multiplayerFail(state,selected.reason);
    if (!Number.isSafeInteger(selected.state.gold)) return multiplayerFail(state,'invalid-choice');
    // Existing choice commands already stamp their events; append only the new timeout marker.
    const marked=accept(selected.state,[{type:'choiceTimedOut',choiceId:choice.choiceId,resolution:'first-offer'}]);
    return marked.ok ? {...marked,events:[...events,...selected.events,...marked.events]} : fail(state,marked.reason);
  } catch { return multiplayerFail(state,'invalid-choice'); }
}

/** Trusted match-finalization hook: the room may end while surviving seats are
 * still in preparation/combat/settlement. Do not run acquisition/choice hooks. */
function execute_forfeitTerminalOrbs(state: MatchState): MatchStep {
  const result = forfeitUnclaimedOrbs(state);
  return result.events.length ? stampMatchEvents(result.state, result.events) : result;
}

function execute_claimOrb(state: MatchState, orbId: string, expectedRound: number, unitLootPolicy?: UnitLootPolicy): MultiplayerCommandResult {
  try {
    const result=planOrbClaim(state,orbId,expectedRound,unitLootPolicy);
    if(!result.ok)return result;
    // Queue acceptance must not run resource/equipment/choice hooks during combat.
    if(isCombatRosterLocked(state)||result.state===state&&soloShopOrb(state,orbId)&&!result.events.length)return result;
    const events=[...result.events],drained=drainG23Rewards(result.state,unitLootPolicy,events);
    events.push(...mechanicGrantEvents(result.state,drained));
    return acceptEquipment(drained,events);
  } catch { return multiplayerFail(state,'invalid-loot'); }
}
/** Deadline resolves original choices only; multiplayer orbs survive until explicitly claimed. */
function execute_claimOrDiscardLoot(state: MatchState, expectedRound: number, unitLootPolicy?: UnitLootPolicy): MultiplayerCommandResult {
  if (!state.multiplayer) return multiplayerFail(state,'multiplayer-required');
  if (state.multiplayer.status === 'eliminated') return multiplayerFail(state,'seat-eliminated');
  if (expectedRound !== state.round) return multiplayerFail(state,'stale-round');
  if (state.phase !== 'settlement' && !(state.phase==='choice' && state.pendingChoice?.returnPhase==='settlement')) return multiplayerFail(state,'wrong-phase');
  try {
    let current: MatchState=state;
    const events: MatchEvent[]=[];
    // A revealed component choice is earned; use the same deterministic first-offer policy.
    for (const descriptor of unresolvedLootChoices(current)) {
      const first=makeLootPendingChoice(descriptor).offers[0];
      const granted=grantLootChoice(current,descriptor,first,'player-choice');
      current=granted.state; events.push(...granted.events);
    }
    const granted=grantDirectLoot(current,false,unitLootPolicy);
    current=granted.state; events.push(...granted.events);
    const discarded=current.multiplayer ? [] : current.m8.loot.direct.filter(d=>d.status==='pending-capacity');
    if (discarded.length) {
      const ids=new Set(discarded.map(d=>d.dropId));
      current={...current,m8:{...current.m8,loot:{...current.m8.loot,
        direct:current.m8.loot.direct.map(d=>ids.has(d.dropId)?{dropId:d.dropId,status:'forfeited' as const,receiptId:null}:d)}}};
      events.push(...discarded.map(d=>({type:'lootForfeited' as const,dropId:d.dropId})));
    }
    const wasLootChoice=state.pendingChoice && unresolvedLootChoices(state).some(d=>makeLootPendingChoice(d).choiceId===state.pendingChoice!.choiceId);
    if (wasLootChoice) {
      const entered=enterScheduledEvents({...current,phase:'settlement',pendingChoice:null} as MatchState,'after');
      current=entered.state; events.push(...entered.events);
    }
    const drained=drainG23Rewards(current,unitLootPolicy,events);events.push(...mechanicGrantEvents(current,drained));current=drained;
    if (current===state && events.length===0) return {ok:true,state,events:[]};
    return acceptEquipment(current,events);
  } catch { return multiplayerFail(state,'invalid-loot'); }
}
/** G2-3 forge/blackMarket/armory: resolve through seat-mechanics, then continue the round's schedule like any choice. */
function completeMechanicChoice(state: MatchState, optionId: string, timedOut: boolean,unitLootPolicy?:UnitLootPolicy): MatchCommandResult {
  const choice = state.pendingChoice!;
  const resolved = choice.payload?.source === 'masterwork-upgrade'
    ? completeMasterworkChoice(state, optionId, timedOut) : resolveMechanicChoice(state, optionId, timedOut);
  if (!resolved.ok) return fail(state, resolved.reason);
  const hookEvents:MatchEvent[]=[];
  const completed=drainG23Rewards(finishG23Choice(state,resolved.state,optionId),unitLootPolicy,hookEvents);
  const entered = enterScheduledEvents(completed, choice.returnPhase === 'settlement' ? 'after' : 'before');
  return acceptEquipment(entered.state, [...resolved.events,...mechanicGrantEvents(resolved.state,completed), ...hookEvents,...entered.events]);
}
function execute_selectChoice(state: MatchState, choiceId: string, generation: number, definitionId: string, unitLootPolicy?: UnitLootPolicy): MatchCommandResult {
  const reason = choiceFailure(state, choiceId, generation); if (reason) return fail(state, reason);
  const choice = state.pendingChoice!;
  if (isMechanicChoiceKind(choice.kind)) return completeMechanicChoice(state, definitionId, false,unitLootPolicy);
  if (typeof definitionId !== 'string' || choice.step !== 'offer' || !choice.offers.includes(definitionId)) return fail(state, 'invalid-choice');
  const descriptor=unresolvedLootChoices(state)[0];
  if (descriptor && makeLootPendingChoice(descriptor).choiceId===choiceId) {
    if (choice.kind!=='component' || generation!==0 || !state.combat || state.combat.status!=='finished') return fail(state,'invalid-choice');
    const granted=grantLootChoice(state,descriptor,definitionId,'player-choice');
    const selected:MatchState={...granted.state,phase:'settlement',combat:state.combat,pendingChoice:null};
    const next=enterLootChoice(selected);
    const events:MatchEvent[]=[...granted.events,{type:'choiceSelected',choiceId,definitionId,unitId:null},...next.events];
    if (next.state.phase==='choice') return accept(next.state,events);
    const capacity=grantDirectLoot(next.state,false,unitLootPolicy);
    const entered=enterScheduledEvents(capacity.state,'after');
    return acceptEquipment(entered.state,[...events,...capacity.events,...entered.events]);
  }
  if (!getRoundSchedule(state.round).some(event=>event.id===choice.eventId && event.kind===choice.kind)) return fail(state,'invalid-choice');
  if(choice.kind==='anomaly'&&!eligibleD14Target(state.preparation.units.find(u=>u.id===choice.targetId),definitionId))return fail(state,'invalid-target');
  if (choice.kind === 'anomaly' && !state.preparation.units.some(unit => unit.id === choice.targetId && unit.team === 'player')) return fail(state, 'invalid-target');
  const grantDefinition = choice.kind === 'component' ? definitionId : choice.kind === 'augment' ? P3_AUGMENT_ITEMS[definitionId] : undefined;
  const granted = grantDefinition ? planPermanentItemGrant(state, { definitionId: grantDefinition, receiptId: choice.eventId }, state.scheduleReceipts.map(receipt => receipt.eventId)) : null;
  if (granted && !granted.ok) return fail(state, 'invalid-choice');
  const itemId = granted?.ok ? granted.grantedItemIds[0] : null;
  const acquisitionGold = choice.kind === 'augment' || choice.kind === 'anomaly' ? choiceAcquisitionGold((choice.kind === 'augment'?AUGMENT_DEFINITIONS:ANOMALY_DEFINITIONS)[definitionId], state.round) : 0;
  const receipt: ScheduleReceipt = { eventId: choice.eventId, round: state.round, kind: choice.kind,
    itemIds: itemId ? [itemId] : [], gold: acquisitionGold, unitId: choice.targetId, definitionId };
  const acquisitionProgress = grantXp(state.level,state.xp,choice.kind==='augment'?choiceAcquisitionXp(AUGMENT_DEFINITIONS[definitionId])+outcomeAcquisitionXp(state,{definitionId,choiceId,acquiredRound:state.round})+(definitionId==='at-what-cost'?atWhatCostGrant(state.level,state.xp):0):0);
  let selected: MatchState = { ...state, pendingChoice: null, gold: state.gold + acquisitionGold, level:acquisitionProgress.level, xp:acquisitionProgress.xp,
    scheduleReceipts: [...state.scheduleReceipts, receipt],
    resourceProvenance:itemId?appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,{kind:'item-acquired',itemId,source:{kind:'schedule',eventId:choice.eventId}}):state.resourceProvenance,
    items: granted?.ok ? granted.state.items : state.items,
    nextItemSerial: granted?.ok ? granted.state.nextItemSerial : state.nextItemSerial,
    augments: choice.kind === 'augment' ? [...state.augments, { definitionId, choiceId, acquiredRound: state.round }] : state.augments,
    anomalyBinding: choice.kind === 'anomaly' ? { definitionId, unitId: choice.targetId!, choiceId, boundRound: state.round } : state.anomalyBinding };
  const beforeHistoryAcquisition = selected;
  if (choice.kind === 'augment') selected = recordAugmentAcquisition(state, selected);
  selected = applyLevelUpHealth(state, selected);
  if (choice.kind === 'augment') selected = applyAcquisitionHealthLoss(selected, selected.augments.at(-1)!);
  const events: MatchEvent[] = [{ type: 'choiceSelected', choiceId, definitionId, unitId: choice.targetId }, ...mechanicGrantEvents(beforeHistoryAcquisition,selected)];
  if(choice.kind==='augment'){
    if(definitionId==='why-not-both')selected={...selected,resourceProvenance:appendResourceProvenance(selected.resourceProvenance,selected.roundDefinitionId,{kind:'form-swapper-selected',choiceId})};
    if(definitionId==='called-shot')selected={...selected,streak:batch5Streak(selected,selected.round,selected.streak)};
    selected=recordAcquisitionLevel(selected,selected.augments.at(-1)!);
    if(definitionId==='dual-purpose')selected={...selected,resourceProvenance:appendResourceProvenance(selected.resourceProvenance,selected.roundDefinitionId,{
      kind:'dual-purpose-selected',choiceId,level:selected.level,xp:selected.xp,
    })};
    const gifted=drainP2Gifts(selected,unitLootPolicy);
    events.push(...mechanicGrantEvents(selected,gifted));selected=gifted;
  }
  if (choice.kind === 'component' && getRoundKind(state.round) === 'supply') {
    selected = settleRound(selected, null); events.push({ type: 'roundSettled', round: state.round });
    return accept(selected, events);
  }
  if(choice.kind==='anomaly'){selected=acquireD14(selected);const granted=grantAnomalyAcquisition(selected);selected=granted.state;events.push(...granted.events);}
  if(choice.kind==='augment'){const granted=grantAugmentAcquisition(selected,selected.augments.at(-1)!);selected=granted.state;events.push(...granted.events);}
  if(choice.kind==='augment')selected=recordShopAcquisition(state,selected);
  if(!selected.sharedPool&&subscriptionAcquired(state,selected))selected=drawSoloAugmentShop(selected,sixCostShopContext(selected),true);
  const entered = enterScheduledEvents(selected, choice.returnPhase === 'settlement' ? 'after' : 'before');
  const forge=openAugmentForge(entered.state);
  return acceptEquipment(forge.state, [...events, ...entered.events,...forge.events]);
}

/** Compatibility domain entrypoints use the same pending choices and generic receipts. */
function execute_chooseG23Junker(state:MatchState,menuId:string,upgrade:G23JunkerUpgrade):MatchCommandResult{
 if(state.pendingChoice?.choiceId!==menuId||state.pendingChoice.kind!=='armory')return fail(state,'stale-choice');
 return selectChoice(state,menuId,state.pendingChoice.generation,upgrade);
}
function execute_chooseG23BlackMarket(state:MatchState,offerId:string,take:boolean):MatchCommandResult{
 if(state.pendingChoice?.choiceId!==offerId||state.pendingChoice.kind!=='blackMarket')return fail(state,'stale-choice');
 return selectChoice(state,offerId,state.pendingChoice.generation,take?state.pendingChoice.offers[0]:'@skip');
}
function execute_claimG23Reward(state:MatchState,atomId:string,definitionId:string,policy?:UnitLootPolicy):MatchCommandResult{
 if(state.phase!=='preparation'||isCombatRosterLocked(state))return fail(state,'wrong-phase');
 const granted=claimG23Atom(state,atomId,definitionId,policy);
 return granted.ok?accept(granted.state,granted.events):fail(state,granted.reason);
}

export {readItemSummons,moveItemSummon} from './g2-4b-voidspawn';

export function deployMatchUnit(...args: Parameters<typeof execute_deployMatchUnit>): ReturnType<typeof execute_deployMatchUnit> {
  return traceHistoryCommand('deployMatchUnit', args, () => execute_deployMatchUnit(...args));
}

export function buyUnit(...args: Parameters<typeof execute_buyUnit>): ReturnType<typeof execute_buyUnit> {
  return traceHistoryCommand('buyUnit', args, () => execute_buyUnit(...args));
}

export function openAnvil(...args: Parameters<typeof execute_openAnvil>): ReturnType<typeof execute_openAnvil> {
  return traceHistoryCommand('openAnvil', args, () => execute_openAnvil(...args));
}

export function sellUnit(...args: Parameters<typeof execute_sellUnit>): ReturnType<typeof execute_sellUnit> {
  return traceHistoryCommand('sellUnit', args, () => execute_sellUnit(...args));
}

export function setShopLock(...args: Parameters<typeof execute_setShopLock>): ReturnType<typeof execute_setShopLock> {
  return traceHistoryCommand('setShopLock', args, () => execute_setShopLock(...args));
}

export function rerollShop(...args: Parameters<typeof execute_rerollShop>): ReturnType<typeof execute_rerollShop> {
  return traceHistoryCommand('rerollShop', args, () => execute_rerollShop(...args));
}

export function buyXp(...args: Parameters<typeof execute_buyXp>): ReturnType<typeof execute_buyXp> {
  return traceHistoryCommand('buyXp', args, () => execute_buyXp(...args));
}

export function startMatchCombat(...args: Parameters<typeof execute_startMatchCombat>): ReturnType<typeof execute_startMatchCombat> {
  return traceHistoryCommand('startMatchCombat', args, () => execute_startMatchCombat(...args));
}

export function stepMatch(...args: Parameters<typeof execute_stepMatch>): ReturnType<typeof execute_stepMatch> {
  return traceHistoryCommand('stepMatch', args, () => execute_stepMatch(...args));
}

export function nextRound(...args: Parameters<typeof execute_nextRound>): ReturnType<typeof execute_nextRound> {
  return traceHistoryCommand('nextRound', args, () => execute_nextRound(...args));
}

export function useConsumable(...args: Parameters<typeof execute_useConsumable>): ReturnType<typeof execute_useConsumable> {
  return traceHistoryCommand('useConsumable', args, () => execute_useConsumable(...args));
}

export function combineItems(...args: Parameters<typeof execute_combineItems>): ReturnType<typeof execute_combineItems> {
  return traceHistoryCommand('combineItems', args, () => execute_combineItems(...args));
}

export function equipItem(...args: Parameters<typeof execute_equipItem>): ReturnType<typeof execute_equipItem> {
  return traceHistoryCommand('equipItem', args, () => execute_equipItem(...args));
}

export function selectAnomalyTarget(...args: Parameters<typeof execute_selectAnomalyTarget>): ReturnType<typeof execute_selectAnomalyTarget> {
  return traceHistoryCommand('selectAnomalyTarget', args, () => execute_selectAnomalyTarget(...args));
}

export function rerollAugment(...args: Parameters<typeof execute_rerollAugment>): ReturnType<typeof execute_rerollAugment> {
  return traceHistoryCommand('rerollAugment', args, () => execute_rerollAugment(...args));
}

export function rerollAnomaly(...args: Parameters<typeof execute_rerollAnomaly>): ReturnType<typeof execute_rerollAnomaly> {
  return traceHistoryCommand('rerollAnomaly', args, () => execute_rerollAnomaly(...args));
}

export function forfeitPendingChoice(...args: Parameters<typeof execute_forfeitPendingChoice>): ReturnType<typeof execute_forfeitPendingChoice> {
  return traceHistoryCommand('forfeitPendingChoice', args, () => execute_forfeitPendingChoice(...args));
}

export function forfeitTerminalOrbs(...args: Parameters<typeof execute_forfeitTerminalOrbs>): ReturnType<typeof execute_forfeitTerminalOrbs> {
  return traceHistoryCommand('forfeitTerminalOrbs', args, () => execute_forfeitTerminalOrbs(...args));
}

export function claimOrb(...args: Parameters<typeof execute_claimOrb>): ReturnType<typeof execute_claimOrb> {
  return traceHistoryCommand('claimOrb', args, () => execute_claimOrb(...args));
}

export function claimOrDiscardLoot(...args: Parameters<typeof execute_claimOrDiscardLoot>): ReturnType<typeof execute_claimOrDiscardLoot> {
  return traceHistoryCommand('claimOrDiscardLoot', args, () => execute_claimOrDiscardLoot(...args));
}

export function selectChoice(...args: Parameters<typeof execute_selectChoice>): ReturnType<typeof execute_selectChoice> {
  return traceHistoryCommand('selectChoice', args, () => execute_selectChoice(...args));
}

export function chooseG23Junker(...args: Parameters<typeof execute_chooseG23Junker>): ReturnType<typeof execute_chooseG23Junker> {
  return traceHistoryCommand('chooseG23Junker', args, () => execute_chooseG23Junker(...args));
}

export function chooseG23BlackMarket(...args: Parameters<typeof execute_chooseG23BlackMarket>): ReturnType<typeof execute_chooseG23BlackMarket> {
  return traceHistoryCommand('chooseG23BlackMarket', args, () => execute_chooseG23BlackMarket(...args));
}

export function claimG23Reward(...args: Parameters<typeof execute_claimG23Reward>): ReturnType<typeof execute_claimG23Reward> {
  return traceHistoryCommand('claimG23Reward', args, () => execute_claimG23Reward(...args));
}

export function advanceMultiplayerRound(...args: Parameters<typeof execute_advanceMultiplayerRound>): ReturnType<typeof execute_advanceMultiplayerRound> {
  return traceHistoryCommand('advanceMultiplayerRound', args, () => execute_advanceMultiplayerRound(...args));
}

export function lockMatchCombatRoster(...args: Parameters<typeof execute_lockMatchCombatRoster>): ReturnType<typeof execute_lockMatchCombatRoster> {
  return traceHistoryCommand('lockMatchCombatRoster', args, () => execute_lockMatchCombatRoster(...args));
}

export function autoDeployToCap(...args: Parameters<typeof execute_autoDeployToCap>): ReturnType<typeof execute_autoDeployToCap> {
  return traceHistoryCommand('autoDeployToCap', args, () => execute_autoDeployToCap(...args));
}

export function openMatchCombatStream(...args: Parameters<typeof execute_openMatchCombatStream>): ReturnType<typeof execute_openMatchCombatStream> {
  return traceHistoryCommand('openMatchCombatStream', args, () => execute_openMatchCombatStream(...args));
}

export function stepMatchCombatStream(...args: Parameters<typeof execute_stepMatchCombatStream>): ReturnType<typeof execute_stepMatchCombatStream> {
  return traceHistoryCommand('stepMatchCombatStream', args, () => execute_stepMatchCombatStream(...args));
}

export function revealMatchCombatStreamTerminal(...args: Parameters<typeof execute_revealMatchCombatStreamTerminal>): ReturnType<typeof execute_revealMatchCombatStreamTerminal> {
  return traceHistoryCommand('revealMatchCombatStreamTerminal', args, () => execute_revealMatchCombatStreamTerminal(...args));
}

export function settleMatchCombatStream(...args: Parameters<typeof execute_settleMatchCombatStream>): ReturnType<typeof execute_settleMatchCombatStream> {
  return traceHistoryCommand('settleMatchCombatStream', args, () => execute_settleMatchCombatStream(...args));
}

export function createMatch(...args: Parameters<typeof execute_createMatch>): MatchState {
  return initializeAugmentTrace(execute_createMatch(...args));
}
