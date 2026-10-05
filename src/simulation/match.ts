import { createCombatWithEvents, stepCombat, validateCombatStart, type CombatState } from './combat';
import { createGame, deployUnit, getPlayerDeploymentCount, validateDeployment } from './game';
import { UNIT_DEFINITIONS, type UnitLocation } from './units';
import { DEFAULT_MATCH_SEED, MATCH_RULES } from './match-rules';
import { validateSeed } from './rng';
import { generateShop } from './shop';
import { grantXp } from './progression';
import { getUnitSellPrice } from './unit-stats';
import { planPurchase, transferUpgradeResources } from './upgrades';
import { createRoundEnemies } from './round-enemies';
import { validateContent } from './validate-content';
import { planCombine, planEquip, returnUnitItems } from './inventory';
import { buildStrategySnapshot } from './strategy-snapshot';
import { getRoundSchedule } from './round-schedule';
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
function enterScheduledEvents(initial: MatchState): { state: MatchState; events: MatchEvent[] } {
  let state = initial; const events: MatchEvent[] = [];
  for (const event of getRoundSchedule(state.round)) {
    if (state.scheduleReceipts.some(receipt => receipt.eventId === event.id)) continue;
    if (event.kind === 'reward') {
      const { receipt, ...plan } = planReward(state, event);
      state = { ...state, ...plan, scheduleReceipts: [...state.scheduleReceipts, receipt] };
      events.push({ type: 'rewardGranted', receipt });
      continue;
    }
    let choiceRngState = state.choiceRngState; let offers: readonly string[] = [];
    if (event.kind === 'augment') {
      const drawn = generateChoices(Object.keys(AUGMENT_DEFINITIONS).filter(id => !state.augments.some(a => a.definitionId === id)), choiceRngState);
      offers = drawn.offers; choiceRngState = drawn.choiceRngState;
    }
    const pendingChoice = { kind: event.kind, step: event.kind === 'augment' ? 'offer' as const : 'target' as const,
      choiceId: event.id, eventId: event.id, generation: 0, offers, targetId: null, rerollCount: 0 };
    state = { ...state, choiceRngState, phase: 'choice', combat: null, pendingChoice };
    events.push({ type: 'choiceOpened', choice: pendingChoice });
    return { state, events };
  }
  return { state: { ...state, phase: 'preparation', combat: null, pendingChoice: null }, events };
}

export function createMatch(seed = DEFAULT_MATCH_SEED): MatchState {
  validateSeed(seed);
  validateContent();
  const initial: MatchState = { schemaVersion: 4, rulesVersion: 'm4-v1', contentVersion: 'm4-slice-v1', contentDigest: CONTENT_DIGEST, seed,
    items: [], nextItemSerial: 1, augments: [], anomalyBinding: null, pendingChoice: null, scheduleReceipts: [],
    choiceRngState: (seed ^ 0x9e3779b9) >>> 0, rewardRngState: (seed ^ 0x85ebca6b) >>> 0, nextMatchEventSeq: 0,
    ...generateShop(seed, 1, MATCH_RULES.initialLevel), round: 1, gold: MATCH_RULES.initialGold,
    level: MATCH_RULES.initialLevel, xp: 0, playerHp: MATCH_RULES.initialHp, nextUnitSerial: 6,
    preparation: structuredClone(createGame()), roundResults: [], phase: 'preparation', combat: null };
  const entered = enterScheduledEvents(initial);
  const result = accept(entered.state, entered.events);
  return result.state;
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
  return accept({ ...state, items: resources.items, anomalyBinding: resources.anomalyBinding, gold: state.gold - cost, nextUnitSerial: state.nextUnitSerial + 1,
    preparation: plan.preparation,
    shop: { ...state.shop, slots: state.shop.slots.map((item, index) => index === slotIndex ? { status: 'purchased' } : item) },
  }, [...plan.events, ...resources.events]);
}
export function sellUnit(state: MatchState, unitId: string): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  const unit = state.preparation.units.find(unit => unit.id === unitId);
  if (!unit) return fail(state, 'unknown-unit');
  if (unit.team !== 'player') return fail(state, 'enemy-unit');
  const returned = returnUnitItems(state.items, unitId);
  const removesBinding = state.anomalyBinding?.unitId === unitId;
  return accept({ ...state, items: returned.items, anomalyBinding: removesBinding ? null : state.anomalyBinding, gold: state.gold + getUnitSellPrice(unit),
    preparation: { ...state.preparation, units: state.preparation.units.filter(unit => unit.id !== unitId) } }, [...returned.events, ...(removesBinding ? [{ type: 'anomalyRemoved' as const, unitId }] : [])]);
}
export function rerollShop(state: MatchState): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  if (state.gold < MATCH_RULES.rerollCost) return fail(state, 'insufficient-gold');
  return accept({ ...state, gold: state.gold - MATCH_RULES.rerollCost,
    ...generateShop(state.rngState, state.shop.generation + 1, state.level) });
}
export function buyXp(state: MatchState): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  if (state.level >= MATCH_RULES.maxLevel) return fail(state, 'max-level');
  if (state.gold < MATCH_RULES.xpPurchaseCost) return fail(state, 'insufficient-gold');
  const progression = grantXp(state.level, state.xp, MATCH_RULES.xpPurchaseAmount);
  return accept({ ...state, gold: state.gold - MATCH_RULES.xpPurchaseCost, level: progression.level, xp: progression.xp });
}
export function matchStartFailure(state: MatchState): MatchFailure | undefined {
  if (state.phase !== 'preparation') return 'wrong-phase';
  if (getPlayerDeploymentCount(state.preparation) > getDeploymentCap(state)) return 'population-cap';
  const reason = validateCombatStart(state.preparation);
  // An empty deployment may concede the round, preventing a zero-gold/empty-roster soft lock.
  return reason === 'missing-player' ? undefined : reason;
}
/** The only settlement write: income, XP, HP and history commit together, including tick-zero defeats. */
function withCombat(state: MatchState, combat: CombatState): MatchState {
  if (combat.status === 'running') return { ...state, phase: 'combat', combat: combat as RunningCombat };
  if (combat.result === null || state.roundResults.some(record => record.round >= state.round)) throw new Error('Invalid settlement transition');
  const progression = grantXp(state.level, state.xp, MATCH_RULES.roundXp);
  const gold = state.gold + MATCH_RULES.roundIncome;
  const baseDamage = 2 + 2 * Math.floor((state.round - 1) / 3);
  const survivingEnemyCount = combat.units.filter(unit => unit.alive && unit.team === 'enemy').length;
  const playerDamage = combat.result === 'playerWin' ? 0 : baseDamage + (combat.result === 'enemyWin' ? 2 * survivingEnemyCount : 0);
  const playerHp = Math.max(0, state.playerHp - playerDamage);
  return { ...state, phase: playerHp === 0 ? 'gameOver' : 'settlement', combat: combat as FinishedCombat,
    gold, playerHp, level: progression.level, xp: progression.xp,
    roundResults: [...state.roundResults, { round: state.round, result: combat.result, combatTicks: combat.tick,
      income: MATCH_RULES.roundIncome, goldBefore: state.gold, goldAfter: gold,
      xpAwarded: progression.xpApplied, levelBefore: state.level, levelAfter: progression.level, xpBefore: state.xp, xpAfter: progression.xp,
      hpBefore: state.playerHp, hpAfter: playerHp, baseDamage, survivingEnemyCount, playerDamage, hpLost: state.playerHp - playerHp }] };
}
export function startMatchCombat(state: MatchState): MatchCommandResult {
  const reason = matchStartFailure(state);
  if (reason) return fail(state, reason);
  const started = createCombatWithEvents(state.preparation, buildStrategySnapshot(state), `round-${state.round}`);
  const next = withCombat(state, started.state);
  return accept(next, [...started.events, ...(next.phase !== 'combat' ? [{ type: 'roundSettled' as const, round: state.round }] : [])]);
}
export function stepMatch(state: MatchState): MatchStep {
  if (state.phase !== 'combat') return { state, events: [] };
  const next = stepCombat(state.combat);
  const settled = withCombat(state, next.state);
  const result = accept(settled, [...next.events, ...(settled.phase !== 'combat' ? [{ type: 'roundSettled' as const, round: state.round }] : [])]);
  return { state: result.state, events: result.ok ? result.events : [] };
}
export function nextRound(state: MatchState, expectedRound: number): MatchCommandResult {
  if (state.phase !== 'settlement') return fail(state, 'wrong-phase');
  if (expectedRound !== state.round) return fail(state, 'stale-round');
  if (state.roundResults.length !== state.round || state.roundResults.at(-1)?.round !== state.round) return fail(state, 'unsettled-round');
  const round = state.round + 1;
  const entered = enterScheduledEvents({ ...state, round, phase: 'preparation', combat: null,
    preparation: { ...state.preparation, units: [...state.preparation.units.filter(unit => unit.team === 'player'), ...createRoundEnemies(round)] },
    ...generateShop(state.rngState, state.shop.generation + 1, state.level) });
  return accept(entered.state, entered.events);
}

export function combineItems(state: MatchState, aId: string, bId: string): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  const plan = planCombine(state.items, state.nextItemSerial, aId, bId);
  return plan.ok ? accept({ ...state, items: plan.items, nextItemSerial: plan.nextItemSerial }, plan.events) : fail(state, plan.reason);
}
export function equipItem(state: MatchState, itemId: string, unitId: string, slot: number): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
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
  const draw = generateChoices(Object.keys(ANOMALY_DEFINITIONS), state.choiceRngState);
  return accept({ ...state, choiceRngState: draw.choiceRngState, pendingChoice: { ...choice, step: 'offer', targetId: unitId, offers: draw.offers, generation: generation + 1 } },
    [{ type: 'anomalyTargetSelected', choiceId, unitId }]);
}
export function rerollAnomaly(state: MatchState, choiceId: string, generation: number): MatchCommandResult {
  const reason = choiceFailure(state, choiceId, generation); if (reason) return fail(state, reason);
  const choice = state.pendingChoice!;
  if (choice.kind !== 'anomaly' || choice.step !== 'offer') return fail(state, 'invalid-choice');
  if (!state.preparation.units.some(unit => unit.id === choice.targetId && unit.team === 'player')) return fail(state, 'invalid-target');
  if (state.gold < 2) return fail(state, 'insufficient-gold');
  const draw = generateChoices(Object.keys(ANOMALY_DEFINITIONS).filter(id => !choice.offers.includes(id)), state.choiceRngState);
  return accept({ ...state, gold: state.gold - 2, choiceRngState: draw.choiceRngState,
    pendingChoice: { ...choice, offers: draw.offers, generation: generation + 1, rerollCount: choice.rerollCount + 1 } },
    [{ type: 'anomalyRerolled', choiceId, generation: generation + 1, cost: 2 }]);
}
export function selectChoice(state: MatchState, choiceId: string, generation: number, definitionId: string): MatchCommandResult {
  const reason = choiceFailure(state, choiceId, generation); if (reason) return fail(state, reason);
  const choice = state.pendingChoice!;
  if (choice.step !== 'offer' || !choice.offers.includes(definitionId)) return fail(state, 'invalid-choice');
  if (choice.kind === 'anomaly' && !state.preparation.units.some(unit => unit.id === choice.targetId && unit.team === 'player')) return fail(state, 'invalid-target');
  const receipt: ScheduleReceipt = { eventId: choice.eventId, round: state.round, kind: choice.kind, itemIds: [], gold: 0, unitId: choice.targetId, definitionId };
  const selected: MatchState = { ...state, pendingChoice: null, scheduleReceipts: [...state.scheduleReceipts, receipt],
    augments: choice.kind === 'augment' ? [...state.augments, { definitionId, choiceId, acquiredRound: state.round }] : state.augments,
    anomalyBinding: choice.kind === 'anomaly' ? { definitionId, unitId: choice.targetId!, choiceId, boundRound: state.round } : state.anomalyBinding };
  const entered = enterScheduledEvents(selected);
  return accept(entered.state, [{ type: 'choiceSelected', choiceId, definitionId, unitId: choice.targetId }, ...entered.events]);
}
