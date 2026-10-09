import { createCombatWithEvents, stepCombat, validateCombatStart, type CombatState } from './combat';
import { deployUnit, getPlayerDeploymentCount, validateDeployment } from './game';
import { UNIT_DEFINITIONS, type UnitLocation } from './units';
import { DEFAULT_MATCH_SEED, MATCH_RULES } from './match-rules';
import { nextRandom, validateSeed } from './rng';
import { DEFAULT_BOARD } from './board';
import { planRoundEconomy } from './economy';
import { COMPONENT_IDS } from './content/items';
import { generateShop } from './shop';
import { grantXp } from './progression';
import { getUnitSellPrice } from './unit-stats';
import { planPurchase, transferUpgradeResources } from './upgrades';
import { createRoundEnemies } from './round-enemies';
import { validateContent } from './validate-content';
import { planCombine, planEquip, returnUnitItems } from './inventory';
import { previewCombine, previewEquip } from './item-selectors';
import { buildStrategySnapshot } from './strategy-snapshot';
import { getRoundSchedule, getRoundKind, getStageRound } from './round-schedule';
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
export { getUnitSellPrice, getUnitStats } from './unit-stats';
const fail = (state: MatchState, reason: MatchFailure): MatchCommandResult => ({ ok: false, state, reason });
const accept = (state: MatchState, events: readonly MatchEvent[] = []): MatchCommandResult => {
  let seq = state.nextMatchEventSeq;
  const stamped = events.map(event => 'tick' in event ? event : { ...event, domain: 'match' as const, eventSeq: seq++ });
  return { ok: true, state: { ...state, nextMatchEventSeq: seq }, events: stamped };
};
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
export function createMatch(seed = DEFAULT_MATCH_SEED): MatchState {
  validateSeed(seed); validateContent();
  const initial: MatchState = { schemaVersion: 5, rulesVersion: 'm5-14.24b-v1', contentVersion: 's13-14.24b-slice-v1',
    commandProtocolVersion: 2, rngAlgorithm: 'lcg32-v1', tickMs: 50,
    roundDefinitionId: '2-1', streak: { kind: null, count: 0 }, outcome: null, persistentGrowth: [],
    augmentProgress: { pumpingRounds: 0, investmentHp: 0 }, battleSeedRngState: (seed ^ 0x9e3779b9) >>> 0,
    contentDigest: CONTENT_DIGEST, seed,
    items: [], nextItemSerial: 1, augments: [], anomalyBinding: null, pendingChoice: null, scheduleReceipts: [],
    choiceRngState: (seed ^ 0x9e3779b9) >>> 0, rewardRngState: (seed ^ 0x85ebca6b) >>> 0, nextMatchEventSeq: 0,
    ...generateShop(seed, 1, MATCH_RULES.initialLevel), round: 1, gold: MATCH_RULES.initialGold,
    level: MATCH_RULES.initialLevel, xp: 0, playerHp: MATCH_RULES.initialHp, nextUnitSerial: 4,
    preparation: { board: structuredClone(DEFAULT_BOARD), benchSize: 9, units: [
      ...['irelia', 'maddie', 'lux'].map((definitionId, index) => ({ id: `unit-${index + 1}`, definitionId,
        team: 'player' as const, starLevel: 1 as const, location: { kind: 'board' as const, cell: { col: index * 2 + 1, row: index === 0 ? 4 : 7 } } })),
      ...createRoundEnemies(1)] }, roundResults: [], phase: 'preparation', combat: null };
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
  const plan = planPurchase(state.preparation, offer.definitionId, `unit-${state.nextUnitSerial}`);
  if (!plan.ok) return fail(state, plan.reason);
  const resources = transferUpgradeResources(state.items, state.anomalyBinding, plan.events);
  const purchased: MatchState = { ...state, items: resources.items, anomalyBinding: resources.anomalyBinding, persistentGrowth: mergeGrowth(state, plan.events), gold: state.gold - cost, nextUnitSerial: state.nextUnitSerial + 1,
    preparation: plan.preparation,
    shop: { ...state.shop, slots: state.shop.slots.map((item, index) => index === slotIndex ? { status: 'purchased' } : item) },
  };
  const entered = needsAnomalyRecruitment(state) ? enterScheduledEvents(purchased) : { state: purchased, events: [] };
  return accept(entered.state, [...plan.events, ...resources.events, ...entered.events]);
}
export function sellUnit(state: MatchState, unitId: string): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  const unit = state.preparation.units.find(unit => unit.id === unitId);
  if (!unit) return fail(state, 'unknown-unit');
  if (unit.team !== 'player') return fail(state, 'enemy-unit');
  const returned = returnUnitItems(state.items, unitId);
  const removesBinding = state.anomalyBinding?.unitId === unitId;
  return accept({ ...state, items: returned.items, anomalyBinding: removesBinding ? null : state.anomalyBinding, persistentGrowth: state.persistentGrowth.filter(growth => growth.unitId !== unitId), gold: state.gold + getUnitSellPrice(unit),
    preparation: { ...state.preparation, units: state.preparation.units.filter(unit => unit.id !== unitId) } }, [...returned.events, ...(removesBinding ? [{ type: 'anomalyRemoved' as const, unitId }] : [])]);
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
function mergeGrowth(state: MatchState, events: readonly import('./unit-types').UnitUpgradedEvent[]) {
  let growth = [...state.persistentGrowth];
  for (const event of events) {
    const ids = new Set([event.survivorId, ...event.consumedIds]);
    const attackDamageBps = growth.filter(value => ids.has(value.unitId)).reduce((sum, value) => sum + value.attackDamageBps, 0);
    growth = growth.filter(value => !ids.has(value.unitId));
    if (attackDamageBps) growth.push({ unitId: event.survivorId, attackDamageBps });
  }
  return growth.sort((a,b) => a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0);
}
/** Income, XP, HP, persistent growth and the settlement identity commit once together. */
function settleRound(state: MatchState, combat: FinishedCombat | null): MatchState {
  if (state.roundResults.some(record => record.round >= state.round)) throw new Error('Duplicate settlement');
  const roundKind = getRoundKind(state.round), { stage } = getStageRound(state.round);
  const survivingEnemyCount = combat?.units.filter(unit => unit.alive && unit.team === 'enemy').length ?? 0;
  const plan = planRoundEconomy({ stage, roundKind, result: combat?.result ?? null, gold: state.gold,
    streak: state.streak, level: state.level, xp: state.xp, hp: state.playerHp, enemySurvivors: survivingEnemyCount });
  const growth = new Map(state.persistentGrowth.map(entry => [entry.unitId, entry.attackDamageBps]));
  for (const unit of combat?.units ?? []) if (unit.team === 'player' && (unit.runtime?.permanentAdBps ?? 0) > 0) {
    growth.set(unit.id, (growth.get(unit.id) ?? 0) + unit.runtime!.permanentAdBps);
  }
  const terminal = plan.hpAfter === 0 || state.round === 35;
  const outcome = terminal ? state.round === 35 && plan.hpAfter > 0 && combat?.result === 'playerWin' ? 'victory' as const : 'defeat' as const : null;
  return { ...state, phase: terminal ? 'gameOver' : 'settlement', outcome, combat,
    gold: plan.goldAfter, playerHp: plan.hpAfter, streak: plan.streakAfter, level: plan.progression.level, xp: plan.progression.xp,
    persistentGrowth: [...growth].map(([unitId,attackDamageBps]) => ({unitId,attackDamageBps})).sort((a,b)=>a.unitId.localeCompare(b.unitId)),
    augmentProgress: {
      pumpingRounds: state.augmentProgress.pumpingRounds + (state.augments.some(a => a.definitionId === 'pumping-up-i') ? 1 : 0),
      investmentHp: state.augmentProgress.investmentHp + (state.augments.some(a => a.definitionId === 'investment-strategy-i') ? 8 * plan.incomeBreakdown.interest : 0),
    },
    roundResults: [...state.roundResults, { round: state.round, settlementId: `round-${state.round}-settled`, roundKind,
      result: combat?.result ?? 'supply', combatTicks: combat?.tick ?? 0,
      income: plan.income, incomeBreakdown: plan.incomeBreakdown, interestBasis: plan.interestBasis,
      streakBefore: state.streak, streakAfter: plan.streakAfter, goldBefore: state.gold, goldAfter: plan.goldAfter,
      xpRequested: plan.progression.xpRequested, xpAwarded: plan.progression.xpApplied,
      levelBefore: state.level, levelAfter: plan.progression.level, xpBefore: state.xp, xpAfter: plan.progression.xp,
      hpBefore: state.playerHp, hpAfter: plan.hpAfter, baseDamage: plan.baseDamage, survivingEnemyCount,
      playerDamage: plan.playerDamage, hpLost: plan.hpLost }] };
}
function withCombat(state: MatchState, combat: CombatState): { state: MatchState; events: MatchEvent[] } {
  if (combat.status === 'running') return { state: { ...state, phase: 'combat', combat: combat as RunningCombat }, events: [] };
  if (combat.result === null) throw new Error('Invalid combat result');
  const settled = settleRound(state, combat as FinishedCombat);
  const event = { type: 'roundSettled' as const, round: state.round };
  if (settled.phase === 'gameOver') return { state: settled, events: [event] };
  const entered = enterScheduledEvents(settled, 'after');
  return { state: entered.state, events: [event, ...entered.events] };
}
export function startMatchCombat(state: MatchState): MatchCommandResult {
  const reason = matchStartFailure(state); if (reason) return fail(state, reason);
  const draw = nextRandom(state.battleSeedRngState);
  const started = createCombatWithEvents(state.preparation, buildStrategySnapshot(state), `round-${state.round}`, draw.word);
  const next = withCombat({ ...state, battleSeedRngState: draw.state }, started.state);
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
  if (state.roundResults.length !== state.round || state.roundResults.at(-1)?.round !== state.round) return fail(state, 'unsettled-round');
  if (state.round >= 35) return fail(state, 'wrong-phase');
  const round = state.round + 1, stageRound = getStageRound(round);
  const emptyAnomaly = getRoundSchedule(round).some(event => event.kind === 'anomaly') && !state.preparation.units.some(unit => unit.team === 'player');
  // An exhausted locked shop cannot supply a target. Use this round's normal free refresh.
  const refresh = state.shop.locked && !(emptyAnomaly && !affordableOffer(state)) ? { shop: state.shop, rngState: state.rngState } : generateShop(state.rngState, state.shop.generation + 1, state.level);
  const entered = enterScheduledEvents({ ...state, round, roundDefinitionId: `${stageRound.stage}-${stageRound.round}`, phase: 'preparation', combat: null,
    preparation: { ...state.preparation, units: [...state.preparation.units.filter(unit => unit.team === 'player'), ...createRoundEnemies(round)] }, ...refresh });
  return accept(entered.state, entered.events);
}

export function combineItems(state: MatchState, aId: string, bId: string): MatchCommandResult {
  const preview = previewCombine(state, aId, bId);
  if (!preview.allowed) return fail(state, preview.reason);
  const plan = planCombine(state.items, state.nextItemSerial, aId, bId);
  return plan.ok ? accept({ ...state, items: plan.items, nextItemSerial: plan.nextItemSerial }, plan.events) : fail(state, plan.reason);
}
export function equipItem(state: MatchState, itemId: string, unitId: string, slot: number): MatchCommandResult {
  const preview = previewEquip(state, itemId, unitId, slot);
  if (!preview.allowed) return fail(state, preview.reason);
  const plan = planEquip(state.items, state.preparation, itemId, unitId, slot);
  return plan.ok ? accept({ ...state, items: plan.items }, plan.events) : fail(state, plan.reason);
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
  if (choice.kind === 'anomaly' && !state.preparation.units.some(unit => unit.id === choice.targetId && unit.team === 'player')) return fail(state, 'invalid-target');
  const itemId = choice.kind === 'component' ? `item-${state.nextItemSerial}` : null;
  const acquisitionGold = choice.kind === 'augment' && definitionId === 'placebo' ? 8 : 0;
  const receipt: ScheduleReceipt = { eventId: choice.eventId, round: state.round, kind: choice.kind,
    itemIds: itemId ? [itemId] : [], gold: acquisitionGold, unitId: choice.targetId, definitionId };
  let selected: MatchState = { ...state, pendingChoice: null, gold: state.gold + acquisitionGold,
    scheduleReceipts: [...state.scheduleReceipts, receipt],
    items: itemId ? [...state.items, { id: itemId, definitionId, location: { kind: 'inventory' as const } }] : state.items,
    nextItemSerial: state.nextItemSerial + (itemId ? 1 : 0),
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
