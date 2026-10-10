import { freezeCombatInput } from './combat-input';
import { appendResourceProvenance, mergeGrowthLedger, RESOURCE_PROVENANCE_VERSION } from './resource-provenance';
import { prepareMatchLoot, revealMatchLoot, grantDirectLoot, grantLootChoice, unresolvedLootChoices, hasPendingLootCapacity } from './loot-runtime';
import { makeLootPendingChoice } from './loot-choice';
import { createCombatWithEvents, stepCombat, validateCombatStart, type CombatState } from './combat';
import { deployUnit, getPlayerDeploymentCount, validateDeployment } from './game';
import { UNIT_DEFINITIONS, type UnitLocation } from './units';
import { DEFAULT_MATCH_SEED, MATCH_RULES } from './match-rules';
import { nextRandom, validateSeed } from './rng';
import { DEFAULT_BOARD } from './board';
import { planCatalogRoundEconomy, OPENING_INITIAL_STATE } from './opening-economy';
import { getCatalogRoundByOrdinal, getNextCatalogRound } from './round-selectors';
import { freezeContent } from './content/freeze';
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
export { getUnitSellPrice, getUnitStats } from './unit-stats';
const fail = (state: MatchState, reason: MatchFailure): MatchCommandResult => ({ ok: false, state, reason });
const accept = (state: MatchState, events: readonly MatchEvent[] = []): MatchCommandResult => {
  let seq = state.nextMatchEventSeq;
  const stamped = events.map(event => 'tick' in event ? event : { ...event, domain: 'match' as const, eventSeq: seq++ });
  return { ok: true, state: { ...state, nextMatchEventSeq: seq }, events: stamped };
};
function acceptEquipment(state: MatchState, events: readonly MatchEvent[]): MatchCommandResult {
  const planned = planTemporaryEquipment(state);
  return accept(planned.state, [...events, ...planned.events]);
}
/** Only the uncompleted anomaly node may defer choice while its roster is empty. */
export function needsAnomalyRecruitment(state: MatchState): boolean {
  return state.phase === 'preparation' && !state.preparation.units.some(unit => unit.team === 'player')
    && getRoundSchedule(state.round).some(event => event.kind === 'anomaly' && !state.scheduleReceipts.some(receipt => receipt.eventId === event.id));
}
function affordableOffer(state: MatchState, gold = state.gold): boolean {
  return state.shop.slots.some(slot => slot.status === 'available' && UNIT_DEFINITIONS[slot.definitionId].cost <= gold);
}
function enterScheduledEvents(initial: MatchState, timing: 'before' | 'after' = 'before'): { state: MatchState; events: MatchEvent[] } {
  let state = initial; const events: MatchEvent[] = [];
  for (const event of getRoundSchedule(state.round).filter(event => (event.timing ?? 'before') === timing)) {
    if (state.scheduleReceipts.some(receipt => receipt.eventId === event.id)) continue;
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
function prepareRound(seed: number, round: number, previous?: MatchState['m8']['loot']): MatchState['m8'] {
  const definition = getCatalogRoundByOrdinal(round);
  return freezeContent({round:definition,encounterPlan:null,loot:prepareMatchLoot(seed,round,previous),preparation:{
    version:ROUND_PREPARATION_RULES.version,roundId:definition.roundId,encounterId:definition.encounterId,
    contentStatus:definition.kind === 'pve' ? ROUND_PREPARATION_RULES.pveContent : 'not-pve',
    enemies:createRoundEnemies(round),
  }});
}
export function createMatch(seed = DEFAULT_MATCH_SEED): MatchState {
  validateSeed(seed); validateContent();
  const m8 = prepareRound(seed,1);
  const initial: MatchState = { schemaVersion: 5, rulesVersion: 'm5-14.24b-v1', contentVersion: 's13-14.24b-slice-v1',
    commandProtocolVersion: 2, rngAlgorithm: 'lcg32-v1', tickMs: 50,
    m8, combatInputBasis:null, resourceProvenance:appendResourceProvenance({version:RESOURCE_PROVENANCE_VERSION,entries:[]},m8.round.roundId,
      {kind:'unit-acquired',unitId:OPENING_INITIAL_STATE.unit.id,source:{kind:'opening'}}), roundDefinitionId: m8.round.roundId, streak: { kind: null, count: 0 }, outcome: null, persistentGrowth: [],
    augmentProgress: { pumpingRounds: 0, investmentHp: 0 }, battleSeedRngState: (seed ^ 0x9e3779b9) >>> 0,
    contentDigest: CONTENT_DIGEST, seed,
    equipmentState: { equipment: initializeStreams(seed).equipment, rolls: [] }, temporaryEquipment: [],
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
  if (state.phase !== 'preparation') return 'wrong-phase';
  const reason = validateDeployment(state.preparation, unitId, target);
  if (reason) return reason;
  const unit = state.preparation.units.find(unit => unit.id === unitId)!;
  return target.kind === 'board' && unit.location.kind === 'bench'
    && getPlayerDeploymentCount(state.preparation) >= getDeploymentCap(state) ? 'population-cap' : undefined;
}
export function deployMatchUnit(state: MatchState, unitId: string, target: UnitLocation): MatchCommandResult {
  const reason = validateMatchDeployment(state, unitId, target);
  if (reason) return fail(state, reason);
  const result = deployUnit(state.preparation, unitId, target);
  return result.ok ? accept({ ...state, preparation: result.state }) : fail(state, result.reason);
}
export function buyUnit(state: MatchState, slotIndex: number, expectedGeneration: number): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= state.shop.slots.length) return fail(state, 'invalid-slot');
  if (expectedGeneration !== state.shop.generation) return fail(state, 'stale-shop');
  const offer = state.shop.slots[slotIndex];
  if (offer.status !== 'available') return fail(state, 'purchased-slot');
  const cost = UNIT_DEFINITIONS[offer.definitionId].cost;
  if (state.gold < cost) return fail(state, 'insufficient-gold');
  const plan = planUnitAcquisition(state, offer.definitionId,
    { kind: 'shop', generation: expectedGeneration, slotIndex, definitionId: offer.definitionId }, state.resourceProvenance.entries.length);
  if (!plan.ok) return fail(state, plan.reason);
  const purchased: MatchState = { ...state, items: plan.items, anomalyBinding: plan.anomalyBinding, persistentGrowth: mergeGrowthLedger(state.persistentGrowth, plan.upgradeEvents), gold: state.gold - cost, nextUnitSerial: plan.nextUnitSerial,
    resourceProvenance: appendResourceProvenance(state.resourceProvenance, state.roundDefinitionId, plan.facts),
    preparation: plan.preparation,
    shop: { ...state.shop, slots: state.shop.slots.map((item, index) => index === slotIndex ? { status: 'purchased' } : item) },
  };
  const entered = needsAnomalyRecruitment(state) ? enterScheduledEvents(purchased) : { state: purchased, events: [] };
  return acceptEquipment(entered.state, [...plan.events, ...entered.events]);
}
export function sellUnit(state: MatchState, unitId: string): MatchCommandResult {
  const capacity = state.phase === 'settlement' && hasPendingLootCapacity(state) && !unresolvedLootChoices(state).length;
  if (state.phase !== 'preparation' && !capacity) return fail(state, 'wrong-phase');
  const unit = state.preparation.units.find(unit => unit.id === unitId);
  if (!unit) return fail(state, 'unknown-unit');
  if (unit.team !== 'player') return fail(state, 'enemy-unit');
  const returned = returnUnitItems(state.items, unitId), removesBinding = state.anomalyBinding?.unitId === unitId;
  const goldGranted = getUnitSellPrice(unit);
  let sold: MatchState = { ...state, items: returned.items, anomalyBinding: removesBinding ? null : state.anomalyBinding,
    persistentGrowth:state.persistentGrowth.filter(growth=>growth.unitId!==unitId),gold:state.gold+goldGranted,
    resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,
      {kind:'unit-sold',unitId,context:capacity?'settlement-capacity':'preparation',goldGranted}),
    preparation:{...state.preparation,units:state.preparation.units.filter(unit=>unit.id!==unitId)} };
  const events: MatchEvent[] = [...returned.events,...(removesBinding?[{type:'anomalyRemoved' as const,unitId}]:[])];
  if (capacity) { const granted = grantDirectLoot(sold,false); sold=granted.state; events.push(...granted.events); }
  return acceptEquipment(sold,events);
}
export function setShopLock(state: MatchState, locked: boolean, expectedGeneration: number): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  if (typeof locked !== 'boolean') return fail(state, 'invalid-choice');
  if (expectedGeneration !== state.shop.generation) return fail(state, 'stale-shop');
  if (Boolean(state.shop.locked) === locked) return { ok: true, state, events: [] };
  return accept({ ...state, shop: { ...state.shop, locked } });
}
export function rerollShop(state: MatchState): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  if (state.gold < MATCH_RULES.rerollCost) return fail(state, 'insufficient-gold');
  const generated = generateShop(state.rngState, state.shop.generation + 1, state.level);
  if (needsAnomalyRecruitment(state) && !affordableOffer({ ...state, ...generated }, state.gold - MATCH_RULES.rerollCost)) return fail(state, 'insufficient-gold');
  return accept({ ...state, gold: state.gold - MATCH_RULES.rerollCost, ...generated,
    shop: { ...generated.shop, locked: Boolean(state.shop.locked) } });
}
export function buyXp(state: MatchState): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  if (state.level >= MATCH_RULES.maxLevel) return fail(state, 'max-level');
  if (state.gold < MATCH_RULES.xpPurchaseCost) return fail(state, 'insufficient-gold');
  if (needsAnomalyRecruitment(state) && !affordableOffer(state, state.gold - MATCH_RULES.xpPurchaseCost)) return fail(state, 'insufficient-gold');
  const progression = grantXp(state.level, state.xp, MATCH_RULES.xpPurchaseAmount);
  return accept({ ...state, gold: state.gold - MATCH_RULES.xpPurchaseCost, level: progression.level, xp: progression.xp });
}
export function matchStartFailure(state: MatchState): MatchFailure | undefined {
  if (state.phase !== 'preparation') return 'wrong-phase';
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
  const plan = planCatalogRoundEconomy({ roundId, result: combat?.result ?? null, gold: state.gold,
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
  return { ...state, resourceProvenance, phase: terminal ? 'gameOver' : 'settlement', outcome, combat,
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
function withCombat(initial: MatchState, combat: CombatState): { state: MatchState; events: MatchEvent[] } {
  const revealed=revealMatchLoot(initial,combat), events=[...revealed.events];
  if (combat.status === 'running') return { state: { ...revealed.state, phase:'combat',combat:combat as RunningCombat },events };
  if (combat.result === null) throw new Error('Invalid combat result');
  const before:MatchState={...revealed.state,phase:'settlement',combat:combat as FinishedCombat,pendingChoice:null};
  const terminal=before.m8.round.isFinal || planCatalogRoundEconomy({roundId:before.roundDefinitionId,result:combat.result,
    gold:before.gold,streak:before.streak,level:before.level,xp:before.xp,hp:before.playerHp,
    enemySurvivors:combat.units.filter(unit=>unit.team==='enemy'&&unit.alive).length}).hpAfter===0;
  const granted=grantDirectLoot(before,terminal); let state=granted.state; events.push(...granted.events);
  if (terminal) for (const descriptor of unresolvedLootChoices(state)) {
    const fallback=grantLootChoice(state,descriptor,descriptor.terminalFallbackDefinitionId,'terminal-fallback');
    state=fallback.state;events.push(...fallback.events);
  }
  const equipment=planTemporaryEquipment(state); events.push(...equipment.events);
  const settled=settleRound(equipment.state,combat as FinishedCombat,mergeGrowthLedger(combatGrowth(combat),granted.upgradeEvents));
  events.push({type:'roundSettled',round:state.round});
  if (settled.phase==='gameOver') return {state:settled,events};
  const choice=enterLootChoice(settled);
  if (choice.state.phase==='choice') return {state:choice.state,events:[...events,...choice.events]};
  const entered=enterScheduledEvents(settled,'after');
  return {state:entered.state,events:[...events,...entered.events]};
}
export function startMatchCombat(state: MatchState): MatchCommandResult {
  const reason = matchStartFailure(state); if (reason) return fail(state, reason);
  const draw = nextRandom(state.battleSeedRngState);
  const combatInputBasis=freezeCombatInput(state,draw.word,state.resourceProvenance.entries.length);
  const started = createCombatWithEvents(combatInputBasis.inputs.preparation, buildStrategySnapshot(combatInputBasis.inputs), `round-${state.round}`, draw.word);
  const next = withCombat({ ...state, combatInputBasis,battleSeedRngState: draw.state }, started.state);
  return accept(next.state, [...started.events, ...next.events]);
}
export function stepMatch(state: MatchState): MatchStep {
  if (state.phase !== 'combat') return { state, events: [] };
  const next = stepCombat(state.combat), settled = withCombat(state, next.state);
  const result = accept(settled.state, [...next.events, ...settled.events]);
  return { state: result.state, events: result.ok ? result.events : [] };
}
export function nextRound(state: MatchState, expectedRound: number): MatchCommandResult {
  if (state.phase !== 'settlement') return fail(state, 'wrong-phase');
  if (expectedRound !== state.round) return fail(state, 'stale-round');
  if (unresolvedLootChoices(state).length || hasPendingLootCapacity(state)) return fail(state,'unsettled-round');
  if (state.roundResults.length !== state.round || state.roundResults.at(-1)?.round !== state.round) return fail(state, 'unsettled-round');
  const definition = getNextCatalogRound(state.m8.round.roundId);
  if (!definition) return fail(state, 'wrong-phase');
  const round = definition.ordinal, m8 = prepareRound(state.seed,round,state.m8.loot);
  const emptyAnomaly = getRoundSchedule(round).some(event => event.kind === 'anomaly') && !state.preparation.units.some(unit => unit.team === 'player');
  // An exhausted locked shop cannot supply a target. Use this round's normal free refresh.
  const refresh = state.shop.locked && !(emptyAnomaly && !affordableOffer(state)) ? { shop: state.shop, rngState: state.rngState } : generateShop(state.rngState, state.shop.generation + 1, state.level);
  const entered = enterScheduledEvents({ ...state, round, m8, roundDefinitionId: definition.roundId, phase: 'preparation', combat: null, combatInputBasis:null,
    preparation: { ...state.preparation, units: [...state.preparation.units.filter(unit => unit.team === 'player'), ...m8.preparation.enemies] }, ...refresh });
  return acceptEquipment(entered.state, entered.events);
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
  const plan = planEquip(state.items, state.preparation, itemId, unitId, slot);
  return plan.ok ? acceptEquipment({ ...state, items: plan.items }, plan.events) : fail(state, plan.reason);
}
function choiceFailure(state: MatchState, choiceId: string, generation: number): MatchFailure | undefined {
  if (state.phase !== 'choice') return 'wrong-phase';
  if (!state.pendingChoice || state.pendingChoice.choiceId !== choiceId || state.pendingChoice.generation !== generation) return 'stale-choice';
  return undefined;
}
export function selectAnomalyTarget(state: MatchState, choiceId: string, generation: number, unitId: string): MatchCommandResult {
  const reason = choiceFailure(state, choiceId, generation); if (reason) return fail(state, reason);
  const choice = state.pendingChoice!;
  if (choice.kind !== 'anomaly' || choice.step !== 'target') return fail(state, 'invalid-choice');
  const target = state.preparation.units.find(unit => unit.id === unitId);
  if (!target || target.team !== 'player' || state.anomalyBinding !== null) return fail(state, 'invalid-target');
  const draw = generateAnomalyOffer(Object.keys(ANOMALY_DEFINITIONS), state.choiceRngState);
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
export function selectChoice(state: MatchState, choiceId: string, generation: number, definitionId: string): MatchCommandResult {
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
    const capacity=grantDirectLoot(next.state,false);
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
