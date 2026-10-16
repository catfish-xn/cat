import { resolveCarouselPreparation } from './carousel-units';
import { planConsumable } from './consumables';
import { CONSUMABLE_RULES } from './content/consumables';
import type { LootInitialization, OrbLayoutLedger } from './orb-layout';
import type { ConsumableTarget } from './consumable-types';
export { previewUseConsumable } from './consumables';
import { resolveDeferredUpgrades } from './deferred-upgrades';
import { canOperateMatch, isCombatRosterLocked } from './operation-policy';
import type { UnitLootPolicy } from './loot-runtime';
import type { MultiplayerCommandResult, MultiplayerFailure } from './round-settlement';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { FINAL_ROUND } from './round-schedule';
import { M8_VERSION } from './m8/version';
import { freezeCombatInput } from './combat-input';
import { appendResourceProvenance, mergeGrowthLedger, RESOURCE_PROVENANCE_VERSION } from './resource-provenance';
import { prepareMatchLoot, revealMatchLoot, grantDirectLoot, grantLootChoice, unresolvedLootChoices, hasPendingLootCapacity } from './loot-runtime';
import { makeLootPendingChoice } from './loot-choice';
import { createCombatWithEvents, stepCombat, validateCombatStart, type CombatState } from './combat';
import { toLedgerEvents } from './combat-ledger';
import { deployUnit, getPlayerDeploymentCount } from './game';
import { UNIT_DEFINITIONS, type UnitLocation } from './units';
import { DEFAULT_MATCH_SEED, MATCH_RULES } from './match-rules';
import { nextRandom, validateSeed } from './rng';
import { DEFAULT_BOARD, sameCell } from './board';
import { OPENING_INITIAL_STATE } from './opening-economy';
import { resolveRoundEconomy } from './round-economy';
import { getCatalogRoundByOrdinal, getNextCatalogRound } from './round-selectors';
import { shareGeneratedJson } from './immutable-json';
import { COMPONENT_IDS } from './content/items';
import { generateShop } from './shop';
import { grantXp } from './progression';
import { getUnitSellPrice } from './unit-stats';
import { planUnitAcquisition } from './unit-acquisition';
import { createRoundEnemies } from './round-enemies';
import { validateContent } from './validate-content';
import { planCombine, planEquip, returnUnitItems } from './inventory';
import { previewCombine, previewEquip } from './item-selectors';
import { initializeStreams } from './m8/equipment';
import { planTemporaryEquipment } from './temporary-equipment';
import { planPermanentItemGrant } from './item-grants';
import { buildStrategySnapshot } from './strategy-snapshot';
import { ROUND_PREPARATION_RULES, getRoundSchedule, getRoundKind } from './round-schedule';
import { planReward } from './rewards';
import { CONTENT_DIGEST } from './content';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { ANOMALY_DEFINITIONS } from './content/anomalies';
import { generateChoices } from './choices';
import type { ScheduleReceipt } from './strategy-types';
import type { FinishedCombat, MatchCommandResult, MatchEvent, MatchFailure, MatchState, MatchStep, RunningCombat } from './match-types';
export * from './match-types';
export { DEFAULT_MATCH_SEED, MATCH_RULES } from './match-rules';
export { getXpToNextLevel, getShopOdds } from './progression';
export { readEncounterPreview } from './encounter-selectors';
export { readLootView } from './loot-view';
export { getUnitSellPrice, getUnitStats } from './unit-stats';
const fail = (state: MatchState, reason: MatchFailure): MatchCommandResult => ({ ok: false, state, reason });
const accept = (state: MatchState, events: readonly MatchEvent[] = []): MatchCommandResult => {
  let seq = state.nextMatchEventSeq;
  const stamped = events.map(event => 'tick' in event ? event : { ...event, domain: 'match' as const, eventSeq: seq++ });
  return { ok: true, state: { ...state, nextMatchEventSeq: seq }, events: stamped };
};
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
  return state.shop.slots.some(slot => slot.status === 'available' && UNIT_DEFINITIONS[slot.definitionId].cost <= gold);
}
function enterScheduledEvents(initial: MatchState, timing: 'before' | 'after' = 'before'): { state: MatchState; events: MatchEvent[] } {
  let state = initial; const events: MatchEvent[] = [];
  for (const event of getRoundSchedule(state.round).filter(event => (event.timing ?? 'before') === timing)) {
    if (state.scheduleReceipts.some(receipt => receipt.eventId === event.id)) continue;
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
    if (event.kind === 'augment') {
      const drawn = generateChoices(Object.keys(AUGMENT_DEFINITIONS).filter(id => !state.augments.some(a => a.definitionId === id)), choiceRngState);
      offers = drawn.offers; choiceRngState = drawn.choiceRngState;
    } else if (event.kind === 'component') offers = [...COMPONENT_IDS];
    const pendingChoice = { kind: event.kind, step: event.kind === 'anomaly' ? 'target' as const : 'offer' as const,
      choiceId: event.id, eventId: event.id, generation: 0, offers, targetId: null, rerollCount: 0,
      returnPhase: timing === 'after' || getRoundKind(state.round) === 'supply' ? 'settlement' as const : 'preparation' as const };
    state = { ...state, choiceRngState, phase: 'choice', combat: timing === 'after' ? state.combat : null, pendingChoice } as MatchState;
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
/** Shared opening keeps the free Irelia and existing economy; 1-1 is PortalSelect. */
export function createCarouselMatch(seed=DEFAULT_MATCH_SEED):MatchState {
  const state=createMatch(seed,{mode:'shared-deferred'});
  return {...state,carousel:{receipts:[],pendingUnits:[],heldCarouselUnits:[],preparationReceipts:[]}};
}
export function createMatch(seed = DEFAULT_MATCH_SEED, loot:LootInitialization = {mode:'solo'}): MatchState {
  validateSeed(seed); validateContent();
  const m8 = prepareRound(seed,1,undefined,undefined,loot);
  const initial: MatchState = { schemaVersion: M8_VERSION.schemaVersion, rulesVersion: M8_VERSION.rulesVersion, contentVersion: M8_VERSION.contentVersion,
    commandProtocolVersion: M8_VERSION.commandProtocolVersion, rngAlgorithm: M8_VERSION.rngAlgorithm, tickMs: M8_VERSION.tickMs,
    m8, combatInputBasis:null, resourceProvenance:appendResourceProvenance({version:RESOURCE_PROVENANCE_VERSION,entries:[]},m8.round.roundId,
      {kind:'unit-acquired',unitId:OPENING_INITIAL_STATE.unit.id,source:{kind:'opening'}}), roundDefinitionId: m8.round.roundId, streak: { kind: null, count: 0 }, outcome: null, persistentGrowth: [],
    augmentProgress: { pumpingRounds: 0, investmentHp: 0 }, battleSeedRngState: (seed ^ 0x9e3779b9) >>> 0,
    contentDigest: CONTENT_DIGEST, seed,
    equipmentState: { equipment: initializeStreams(seed).equipment, rolls: [] }, temporaryEquipment: [],
    consumables: [], nextConsumableSerial: 1, reforgeState:{state:(seed^CONSUMABLE_RULES.seedXor)>>>0,draws:0},
    items: [], nextItemSerial: 1, augments: [], anomalyBinding: null, pendingChoice: null, scheduleReceipts: [],
    choiceRngState: (seed ^ 0x9e3779b9) >>> 0, rewardRngState: (seed ^ 0x85ebca6b) >>> 0, nextMatchEventSeq: 0,
    ...generateShop(seed, 1, MATCH_RULES.initialLevel), round: 1, gold: MATCH_RULES.initialGold,
    level: MATCH_RULES.initialLevel, xp: OPENING_INITIAL_STATE.xp, playerHp: MATCH_RULES.initialHp, nextUnitSerial: OPENING_INITIAL_STATE.nextUnitSeq,
    preparation: { board: structuredClone(DEFAULT_BOARD), benchSize: 9, units: [
      { id:OPENING_INITIAL_STATE.unit.id,definitionId:OPENING_INITIAL_STATE.unit.definitionId,
        team:'player',starLevel:OPENING_INITIAL_STATE.unit.starLevel,
        location:{kind:'board',cell:{...OPENING_INITIAL_STATE.unit.cell}} },
      ...m8.preparation.enemies] }, roundResults: [], phase: 'preparation', combat: null };
  const entered = enterScheduledEvents(initial);
  return accept(entered.state, entered.events).state;
}
export function getDeploymentCap(state: MatchState): number { return state.level; }
export function validateMatchDeployment(state: MatchState, unitId: string, target: UnitLocation): MatchFailure | undefined {
  if (!canOperateMatch(state)) return 'wrong-phase';
  if ((state.phase !== 'preparation' || isCombatRosterLocked(state)) && (target?.kind === 'board'
    || state.preparation.units.some(unit => unit.id === unitId && unit.location.kind === 'board'))) return 'wrong-phase';
  const planned = deployUnit(state.preparation, unitId, target);
  if (!planned.ok) return planned.reason;
  // Check the final formation: swapping at the cap does not add a deployed unit.
  return getPlayerDeploymentCount(planned.state) > getDeploymentCap(state) ? 'population-cap' : undefined;
}
export function deployMatchUnit(state: MatchState, unitId: string, target: UnitLocation): MatchCommandResult {
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
  return accept({ ...state, preparation: result.state }, events);
}
/** After PvP snapshots are frozen, protect the live roster while keeping the T3 state shape. */
export function lockMatchCombatRoster(state: MatchState): MatchCommandResult {
  if (!state.multiplayer || state.multiplayer.status !== 'active' || state.phase !== 'preparation'
    || state.m8.round.kind !== 'pvp' || state.pendingChoice !== null) return fail(state, 'wrong-phase');
  if (state.multiplayer.combatRosterLocked) return { ok: true, state, events: [] };
  return { ok: true, state: { ...state, multiplayer: { ...state.multiplayer, combatRosterLocked: true } }, events: [] };
}
/** Server preparation-deadline hook. Never called by the offline Start path. */
export function autoDeployToCap(state: MatchState): MatchCommandResult {
  if (!state.multiplayer || state.multiplayer.status !== 'active' || state.phase !== 'preparation' || isCombatRosterLocked(state)) return fail(state, 'wrong-phase');
  const cap = getDeploymentCap(state), count = getPlayerDeploymentCount(state.preparation);
  if (count > cap) return fail(state, 'population-cap');
  const board = state.preparation.board, zone = board.deploymentZones.player;
  const columns = Array.from({ length: board.columns }, (_, col) => col)
    .sort((a, b) => Math.abs(a - (board.columns - 1) / 2) - Math.abs(b - (board.columns - 1) / 2) || a - b);
  const rows = Array.from({ length: zone.lastRow - zone.firstRow + 1 }, (_, offset) => zone.firstRow + offset);
  if (board.deploymentZones.enemy.firstRow > zone.lastRow) rows.reverse();
  const cells = rows.flatMap(row => columns.map(col => ({ col, row })));
  const reserves = state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'bench')
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
export function buyUnit(state: MatchState, slotIndex: number, expectedGeneration: number): MatchCommandResult {
  if (!canOperateMatch(state)) return fail(state, 'wrong-phase');
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= state.shop.slots.length) return fail(state, 'invalid-slot');
  if (expectedGeneration !== state.shop.generation) return fail(state, 'stale-shop');
  const offer = state.shop.slots[slotIndex];
  if (offer.status !== 'available') return fail(state, 'purchased-slot');
  const cost = UNIT_DEFINITIONS[offer.definitionId].cost;
  if (state.gold < cost) return fail(state, 'insufficient-gold');
  const plan = planUnitAcquisition(state, offer.definitionId,
    { kind: 'shop', generation: expectedGeneration, slotIndex, definitionId: offer.definitionId }, state.resourceProvenance.entries.length, isCombatRosterLocked(state));
  if (!plan.ok) return fail(state, plan.reason);
  const purchased: MatchState = { ...state, items: plan.items, anomalyBinding: plan.anomalyBinding, persistentGrowth: mergeGrowthLedger(state.persistentGrowth, plan.upgradeEvents), gold: state.gold - cost, nextUnitSerial: plan.nextUnitSerial,
    resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId, plan.facts),
    preparation: plan.preparation,
    shop: { ...state.shop, slots: state.shop.slots.map((item, index) => index === slotIndex ? { status: 'purchased' } : item) },
  };
  const entered = needsAnomalyRecruitment(state) ? enterScheduledEvents(purchased) : { state: purchased, events: [] };
  return acceptEquipment(entered.state, [...plan.events, ...entered.events]);
}
export function sellUnit(state: MatchState, unitId: string, unitLootPolicy?: UnitLootPolicy): MatchCommandResult {
  const capacity = state.phase === 'settlement' && hasPendingLootCapacity(state) && !unresolvedLootChoices(state).length;
  if (!canOperateMatch(state) && !(capacity && !state.multiplayer)) return fail(state, 'wrong-phase');
  const unit = state.preparation.units.find(unit => unit.id === unitId);
  if (!unit) return fail(state, 'unknown-unit');
  if (unit.team !== 'player') return fail(state, 'enemy-unit');
  if (state.multiplayer && (state.phase !== 'preparation' || isCombatRosterLocked(state)) && unit.location.kind !== 'bench') return fail(state, 'wrong-phase');
  const returned = returnUnitItems(state.items, unitId), removesBinding = state.anomalyBinding?.unitId === unitId;
  const goldGranted = getUnitSellPrice(unit);
  let sold: MatchState = { ...state, items: returned.items, anomalyBinding: removesBinding ? null : state.anomalyBinding,
    persistentGrowth:state.persistentGrowth.filter(growth=>growth.unitId!==unitId),gold:state.gold+goldGranted,
    resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,
      {kind:'unit-sold',unitId,context:capacity?'settlement-capacity':'preparation',goldGranted}),
    preparation:{...state.preparation,units:state.preparation.units.filter(unit=>unit.id!==unitId)} };
  const events: MatchEvent[] = [...returned.events,...(removesBinding?[{type:'anomalyRemoved' as const,unitId}]:[])];
  if (capacity) { const granted = grantDirectLoot(sold,false,unitLootPolicy); sold=granted.state; events.push(...granted.events); }
  return acceptEquipment(sold,events);
}
export function setShopLock(state: MatchState, locked: boolean, expectedGeneration: number): MatchCommandResult {
  if (!canOperateMatch(state)) return fail(state, 'wrong-phase');
  if (typeof locked !== 'boolean') return fail(state, 'invalid-choice');
  if (expectedGeneration !== state.shop.generation) return fail(state, 'stale-shop');
  if (Boolean(state.shop.locked) === locked) return { ok: true, state, events: [] };
  return accept({ ...state, shop: { ...state.shop, locked } });
}
export function rerollShop(state: MatchState): MatchCommandResult {
  if (!canOperateMatch(state)) return fail(state, 'wrong-phase');
  if (state.gold < MATCH_RULES.rerollCost) return fail(state, 'insufficient-gold');
  const generated = generateShop(state.rngState, state.shop.generation + 1, state.level);
  if (needsAnomalyRecruitment(state) && !affordableOffer({ ...state, ...generated }, state.gold - MATCH_RULES.rerollCost)) return fail(state, 'insufficient-gold');
  return accept({ ...state, gold: state.gold - MATCH_RULES.rerollCost, ...generated,
    shop: { ...generated.shop, locked: Boolean(state.shop.locked) } });
}
export function buyXp(state: MatchState): MatchCommandResult {
  if (!canOperateMatch(state)) return fail(state, 'wrong-phase');
  if (state.level >= MATCH_RULES.maxLevel) return fail(state, 'max-level');
  if (state.gold < MATCH_RULES.xpPurchaseCost) return fail(state, 'insufficient-gold');
  if (needsAnomalyRecruitment(state) && !affordableOffer(state, state.gold - MATCH_RULES.xpPurchaseCost)) return fail(state, 'insufficient-gold');
  const progression = grantXp(state.level, state.xp, MATCH_RULES.xpPurchaseAmount);
  return accept({ ...state, gold: state.gold - MATCH_RULES.xpPurchaseCost, level: progression.level, xp: progression.xp });
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
/** Income, XP, HP, persistent growth and the settlement identity commit once together. */
function settleRound(state: MatchState, combat: FinishedCombat | null, pendingDelta: readonly import('./match-types').PersistentGrowth[] = []): MatchState {
  if (state.roundResults.some(record => record.round >= state.round)) throw new Error('Duplicate settlement');
  const {kind:roundKind,isFinal,roundId} = state.m8.round;
  const survivingEnemyCount = combat?.units.filter(unit => unit.alive && unit.team === 'enemy').length ?? 0;
  const plan = resolveRoundEconomy({ roundId, result: combat?.result ?? null, gold: state.gold,
    streak: state.streak, level: state.level, xp: state.xp, hp: state.playerHp, enemySurvivors: survivingEnemyCount });
  const growth = new Map(state.persistentGrowth.map(entry => [entry.unitId, entry.attackDamageBps]));
  for (const delta of pendingDelta) growth.set(delta.unitId,(growth.get(delta.unitId)??0)+delta.attackDamageBps);
  const resourceProvenance = combat ? appendResourceProvenance(state.resourceProvenance,roundId,{
    kind:'combat-growth-committed',combatId:combat.combatId!,settlementId:`round-${state.round}-settled`,
    combatStartProvenancePrefixLength:state.combatInputBasis!.provenancePrefixLength,
    sourceDeltas:combatGrowth(combat).map(({unitId,attackDamageBps})=>({sourceUnitId:unitId,attackDamageBps})),
  }) : state.resourceProvenance;
  const terminal = plan.hpAfter === 0 || isFinal;
  const outcome = terminal ? isFinal && plan.hpAfter > 0 && combat?.result === 'playerWin' ? 'victory' as const : 'defeat' as const : null;
  return { ...state, resourceProvenance, phase: terminal && !state.multiplayer ? 'gameOver' : 'settlement',
    outcome:state.multiplayer ? null : outcome, combat,
    ...(state.multiplayer ? {multiplayer:{...state.multiplayer,status:plan.hpAfter===0?'eliminated' as const:'active' as const}} : {}),
    gold: plan.goldAfter, playerHp: plan.hpAfter, streak: plan.streakAfter, level: plan.progression.level, xp: plan.progression.xp,
    persistentGrowth: [...growth].map(([unitId,attackDamageBps]) => ({unitId,attackDamageBps})).sort((a,b)=>a.unitId.localeCompare(b.unitId)),
    augmentProgress: {
      pumpingRounds: state.augmentProgress.pumpingRounds + (state.augments.some(a => a.definitionId === 'pumping-up-i') ? 1 : 0),
      investmentHp: state.augmentProgress.investmentHp + (state.augments.some(a => a.definitionId === 'investment-strategy-i') ? 8 * plan.incomeBreakdown.interest : 0),
    },
    roundResults: [...state.roundResults, { round: state.round, roundId, settlementId: `round-${state.round}-settled`, roundKind,
      result: combat?.result ?? 'supply', combatTicks: combat?.tick ?? 0, combatEventCount:combat?.nextEventSeq??0,
      income: plan.income, incomeBreakdown: plan.incomeBreakdown, interestBasis: plan.interestBasis,
      streakBefore: state.streak, streakAfter: plan.streakAfter, goldBefore: state.gold, goldAfter: plan.goldAfter,
      xpRequested: plan.progression.xpRequested, xpAwarded: plan.progression.xpApplied,
      levelBefore: state.level, levelAfter: plan.progression.level, xpBefore: state.xp, xpAfter: plan.progression.xp,
      hpBefore: state.playerHp, hpAfter: plan.hpAfter, baseDamage: plan.baseDamage, survivingEnemyCount,
      playerDamage: plan.playerDamage, hpLost: plan.hpLost }] };
}
function combatGrowth(combat: CombatState): readonly import('./match-types').PersistentGrowth[] {
  return combat.units.filter(unit=>unit.team==='player' && (unit.runtime?.permanentAdBps??0)>0)
    .map(unit=>({unitId:unit.id,attackDamageBps:unit.runtime!.permanentAdBps})).sort((a,b)=>a.unitId<b.unitId?-1:a.unitId>b.unitId?1:0);
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
  const terminal=(!before.multiplayer && before.m8.round.isFinal) || resolveRoundEconomy({roundId:before.roundDefinitionId,result:combat.result,
    gold:before.gold,streak:before.streak,level:before.level,xp:before.xp,hp:before.playerHp,
    enemySurvivors:combat.units.filter(unit=>unit.team==='enemy'&&unit.alive).length}).hpAfter===0;
  const granted=grantDirectLoot(before,terminal,unitLootPolicy); let state=granted.state; events.push(...granted.events);
  if (terminal) for (const descriptor of unresolvedLootChoices(state)) {
    const fallback=grantLootChoice(state,descriptor,descriptor.terminalFallbackDefinitionId,'terminal-fallback');
    state=fallback.state;events.push(...fallback.events);
  }
  const equipment=planTemporaryEquipment(state); events.push(...equipment.events);
  const settledPlan=resolveDeferredUpgrades(settleRound(equipment.state,combat as FinishedCombat,mergeGrowthLedger(combatGrowth(combat),granted.upgradeEvents)));
  const settled=settledPlan.state; events.push(...settledPlan.events);
  events.push({type:'roundSettled',round:state.round});
  if (settled.phase==='gameOver' || settled.multiplayer?.status==='eliminated') return {state:settled,events};
  const choice=enterLootChoice(settled);
  if (choice.state.phase==='choice') return {state:choice.state,events:[...events,...choice.events]};
  const entered=enterScheduledEvents(settled,'after');
  return {state:entered.state,events:[...events,...entered.events]};
}
export function startMatchCombat(state: MatchState, unitLootPolicy?: UnitLootPolicy): MatchCommandResult {
  const reason = matchStartFailure(state); if (reason) return fail(state, reason);
  const draw = nextRandom(state.battleSeedRngState);
  const combatInputBasis=freezeCombatInput(state,draw.word,state.resourceProvenance.entries.length);
  const started = createCombatWithEvents(combatInputBasis.inputs.preparation, buildStrategySnapshot(combatInputBasis.inputs), `round-${state.round}`, draw.word);
  const next = withCombat({ ...state, combatInputBasis,battleSeedRngState: draw.state }, started.state, unitLootPolicy);
  return accept(next.state, [...toLedgerEvents(started.events), ...next.events]);
}
export function stepMatch(state: MatchState, unitLootPolicy?: UnitLootPolicy): MatchStep {
  if (state.phase !== 'combat') return { state, events: [] };
  // Online PvP is resolved only by the two-sided runner and an external receipt.
  if (state.multiplayer && state.m8.round.kind === 'pvp') return {state,events:[]};
  const next = stepCombat(state.combat), settled = withCombat(state, next.state, unitLootPolicy);
  const result = accept(settled.state, [...toLedgerEvents(next.events), ...settled.events]);
  return { state: result.state, events: result.ok ? result.events : [] };
}
/** P7 replaces the supply choice, but keeps that natural round's economy exactly once. */
export function finishCarouselSupply(state:MatchState):MatchCommandResult {
  if(!state.carousel||state.m8.round.kind!=='supply'||state.phase!=='preparation'||state.pendingChoice||!state.carousel.receipts.some(r=>r.carouselId.endsWith(`:carousel:${state.roundDefinitionId}`)&&r.status==='granted'))return fail(state,'wrong-phase');
  const settled=settleRound(state,null);
  return accept({...settled,phase:'settlement',combat:null},[{type:'roundSettled',round:state.round}]);
}
export function nextRound(state: MatchState, expectedRound: number, layout?:OrbLayoutLedger): MatchCommandResult {
  if (state.multiplayer?.status === 'eliminated') return fail(state,'wrong-phase');
  if (state.phase !== 'settlement') return fail(state, 'wrong-phase');
  if (expectedRound !== state.round) return fail(state, 'stale-round');
  if (unresolvedLootChoices(state).length || hasPendingLootCapacity(state)) return fail(state,'unsettled-round');
  if (state.roundResults.length !== state.round || state.roundResults.at(-1)?.round !== state.round) return fail(state, 'unsettled-round');
  const definition = getNextCatalogRound(state.m8.round.roundId);
  if (!definition) return fail(state, 'wrong-phase');
  const round = definition.ordinal, m8 = prepareRound(state.seed,round,state.m8.loot,layout);
  const emptyAnomaly = getRoundSchedule(round).some(event => event.kind === 'anomaly') && !state.preparation.units.some(unit => unit.team === 'player');
  // An exhausted locked shop cannot supply a target. Use this round's normal free refresh.
  const refresh = state.shop.locked && !(emptyAnomaly && !affordableOffer(state)) ? { shop: state.shop, rngState: state.rngState } : generateShop(state.rngState, state.shop.generation + 1, state.level);
  const carousel = resolveCarouselPreparation({ ...state, round, m8, roundDefinitionId: definition.roundId, phase: 'preparation', combat: null, combatInputBasis:null,
    preparation: { ...state.preparation, units: [...state.preparation.units.filter(unit => unit.team === 'player'), ...m8.preparation.enemies] }, ...refresh });
  const entered = enterScheduledEvents(carousel.state);
  return acceptEquipment(entered.state, [...carousel.events,...entered.events]);
}

/** Online advancement. Shared seats must use the all-seat nextSharedRound transaction. */
export function advanceMultiplayerRound(state: MatchState, expectedRound: number, layout?:OrbLayoutLedger): MultiplayerCommandResult {
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
    if (state.round < FINAL_ROUND) return nextRound(state, expectedRound, layout);
    const definition = getMultiplayerRoundByOrdinal(state.round + 1);
    const m8: MatchState['m8'] = { ...state.m8, round: definition, encounterPlan: null,
      preparation: { version: ROUND_PREPARATION_RULES.version, roundId: definition.roundId,
        encounterId: null, contentStatus: 'not-pve', enemies: [] } };
    const refresh = state.shop.locked ? { shop: state.shop, rngState: state.rngState }
      : generateShop(state.rngState, state.shop.generation + 1, state.level);
    return acceptEquipment({ ...state, ...refresh, round: definition.ordinal, roundDefinitionId: definition.roundId,
      m8, phase: 'preparation', combat: null, combatInputBasis: null, pendingChoice: null, outcome: null,
      preparation: { ...state.preparation, units: state.preparation.units.filter(unit => unit.team === 'player') } }, []);
  } catch { return multiplayerFail(state, 'invalid-round'); }
}

export function useConsumable(state:MatchState,consumableId:string,target:ConsumableTarget):MatchCommandResult {
  const plan=planConsumable(state,consumableId,target);
  if(!plan.ok)return fail(state,plan.reason);
  return acceptEquipment({...plan.state,resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,
    {kind:'consumable-used',record:plan.record})},plan.events);
}
export function combineItems(state: MatchState, aId: string, bId: string): MatchCommandResult {
  const preview = previewCombine(state, aId, bId);
  if (!preview.allowed) return fail(state, preview.reason);
  const plan = planCombine(state.items, state.nextItemSerial, aId, bId);
  return plan.ok ? accept({ ...state, items: plan.items, nextItemSerial: plan.nextItemSerial,
    resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,plan.events.filter((event):event is Extract<import('./strategy-types').StrategyEvent,{type:'itemCombined'}>=>event.type==='itemCombined').map(event=>({kind:'item-combined' as const,event}))) }, plan.events) : fail(state, plan.reason);
}
export function equipItem(state: MatchState, itemId: string, unitId: string, slot: number): MatchCommandResult {
  const preview = previewEquip(state, itemId, unitId, slot);
  if (!preview.allowed) return fail(state, preview.reason);
  const plan = planEquip(state.items, state.preparation, itemId, unitId, slot, state.nextItemSerial);
  if (!plan.ok) return fail(state, plan.reason);
  const combined = plan.events.filter((event): event is Extract<import('./strategy-types').StrategyEvent, {type:'itemCombined'}> => event.type === 'itemCombined');
  return acceptEquipment({ ...state, items: plan.items, nextItemSerial: plan.nextItemSerial,
    resourceProvenance: combined.length ? appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId,
      combined.map(event => ({ kind: 'item-combined' as const, event }))) : state.resourceProvenance,
  }, plan.events);
}
function choiceFailure(state: MatchState, choiceId: string, generation: number): MatchFailure | undefined {
  if (state.phase !== 'choice' || isCombatRosterLocked(state)) return 'wrong-phase';
  if (!state.pendingChoice || state.pendingChoice.choiceId !== choiceId || state.pendingChoice.generation !== generation) return 'stale-choice';
  return undefined;
}
export function selectAnomalyTarget(state: MatchState, choiceId: string, generation: number, unitId: string): MatchCommandResult {
  const reason = choiceFailure(state, choiceId, generation); if (reason) return fail(state, reason);
  const choice = state.pendingChoice!;
  if (choice.kind !== 'anomaly' || choice.step !== 'target') return fail(state, 'invalid-choice');
  const target = state.preparation.units.find(unit => unit.id === unitId);
  if (!target || target.team !== 'player' || state.anomalyBinding !== null) return fail(state, 'invalid-target');
  const draw = state.multiplayer && choice.offers.length
    ? {offers:choice.offers,choiceRngState:state.choiceRngState}
    : generateAnomalyOffer(Object.keys(ANOMALY_DEFINITIONS), state.choiceRngState);
  return accept({ ...state, choiceRngState: draw.choiceRngState, pendingChoice: { ...choice, step: 'offer', targetId: unitId, offers: draw.offers, generation: generation + 1 } },
    [{ type: 'anomalyTargetSelected', choiceId, unitId }]);
}
export function rerollAnomaly(state: MatchState, choiceId: string, generation: number): MatchCommandResult {
  const reason = choiceFailure(state, choiceId, generation); if (reason) return fail(state, reason);
  const choice = state.pendingChoice!;
  if (choice.kind !== 'anomaly' || choice.step !== 'offer') return fail(state, 'invalid-choice');
  if (!state.preparation.units.some(unit => unit.id === choice.targetId && unit.team === 'player')) return fail(state, 'invalid-target');
  if (state.gold < 1) return fail(state, 'insufficient-gold');
  const draw = generateAnomalyOffer(Object.keys(ANOMALY_DEFINITIONS).filter(id => !choice.offers.includes(id)), state.choiceRngState);
  return accept({ ...state, gold: state.gold - 1, choiceRngState: draw.choiceRngState,
    pendingChoice: { ...choice, offers: draw.offers, generation: generation + 1, rerollCount: choice.rerollCount + 1 } },
    [{ type: 'anomalyRerolled', choiceId, generation: generation + 1, cost: 1 }]);
}
function generateAnomalyOffer(ids: readonly string[], rngState: number): { offers: string[]; choiceRngState: number } {
  const pool = [...ids].sort(), draw = nextRandom(rngState);
  return { offers: [pool[Math.floor(draw.word * pool.length / 0x100000000)]], choiceRngState: draw.state };
}

const multiplayerFail = (state: MatchState, reason: MultiplayerFailure): MultiplayerCommandResult => ({ok:false,state,reason});
/** Historical name retained by T3: choose the first offer, skipping only an empty anomaly target. */
export function forfeitPendingChoice(state: MatchState, expectedRound: number,
  expectedChoiceId: string | null, expectedGeneration: number | null, unitLootPolicy?: UnitLootPolicy): MultiplayerCommandResult {
  if (!state.multiplayer) return multiplayerFail(state,'multiplayer-required');
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
      const target = state.preparation.units.filter(u=>u.team==='player').sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)[0];
      if (!target) return accept({...state,phase:choice.returnPhase ?? 'preparation',combat:null,pendingChoice:null,
        multiplayer:{...state.multiplayer,forfeitedChoices:[...new Set([...state.multiplayer.forfeitedChoices,choice.eventId])]}} as MatchState,
        [{type:'choiceTimedOut',choiceId:choice.choiceId,resolution:'empty-anomaly'}]);
      const selected = selectAnomalyTarget(current,choice.choiceId,choice.generation,target.id);
      if (!selected.ok) return multiplayerFail(state,selected.reason);
      current=selected.state; events.push(...selected.events);
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

/** Claim only earned drops through existing grant functions, then discard capacity blockers. */
export function claimOrDiscardLoot(state: MatchState, expectedRound: number, unitLootPolicy?: UnitLootPolicy): MultiplayerCommandResult {
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
    const discarded=current.m8.loot.direct.filter(d=>d.status==='pending-capacity');
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
    if (current===state && events.length===0) return {ok:true,state,events:[]};
    return acceptEquipment(current,events);
  } catch { return multiplayerFail(state,'invalid-loot'); }
}
export function selectChoice(state: MatchState, choiceId: string, generation: number, definitionId: string, unitLootPolicy?: UnitLootPolicy): MatchCommandResult {
  const reason = choiceFailure(state, choiceId, generation); if (reason) return fail(state, reason);
  const choice = state.pendingChoice!;
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
  if (choice.kind === 'anomaly' && !state.preparation.units.some(unit => unit.id === choice.targetId && unit.team === 'player')) return fail(state, 'invalid-target');
  const granted = choice.kind === 'component' ? planPermanentItemGrant(state, { definitionId, receiptId: choice.eventId }, state.scheduleReceipts.map(receipt => receipt.eventId)) : null;
  if (granted && !granted.ok) return fail(state, 'invalid-choice');
  const itemId = granted?.ok ? granted.grantedItemIds[0] : null;
  const acquisitionGold = choice.kind === 'augment' && definitionId === 'placebo' ? 8 : 0;
  const receipt: ScheduleReceipt = { eventId: choice.eventId, round: state.round, kind: choice.kind,
    itemIds: itemId ? [itemId] : [], gold: acquisitionGold, unitId: choice.targetId, definitionId };
  let selected: MatchState = { ...state, pendingChoice: null, gold: state.gold + acquisitionGold,
    scheduleReceipts: [...state.scheduleReceipts, receipt],
    resourceProvenance:itemId?appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,{kind:'item-acquired',itemId,source:{kind:'schedule',eventId:choice.eventId}}):state.resourceProvenance,
    items: granted?.ok ? granted.state.items : state.items,
    nextItemSerial: granted?.ok ? granted.state.nextItemSerial : state.nextItemSerial,
    augments: choice.kind === 'augment' ? [...state.augments, { definitionId, choiceId, acquiredRound: state.round }] : state.augments,
    anomalyBinding: choice.kind === 'anomaly' ? { definitionId, unitId: choice.targetId!, choiceId, boundRound: state.round } : state.anomalyBinding };
  const events: MatchEvent[] = [{ type: 'choiceSelected', choiceId, definitionId, unitId: choice.targetId }];
  if (choice.kind === 'component' && getRoundKind(state.round) === 'supply') {
    selected = settleRound(selected, null); events.push({ type: 'roundSettled', round: state.round });
    return accept(selected, events);
  }
  const entered = enterScheduledEvents(selected, choice.returnPhase === 'settlement' ? 'after' : 'before');
  return accept(entered.state, [...events, ...entered.events]);
}
