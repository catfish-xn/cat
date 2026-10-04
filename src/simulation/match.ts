import { createCombat, stepCombat, validateCombatStart, type CombatState } from './combat';
import { createGame, deployUnit, getPlayerDeploymentCount, validateDeployment } from './game';
import { UNIT_DEFINITIONS, type UnitLocation } from './units';
import { DEFAULT_MATCH_SEED, MATCH_RULES } from './match-rules';
import { validateSeed } from './rng';
import { generateShop } from './shop';
import { grantXp } from './progression';
import { getUnitSellPrice } from './unit-stats';
import { planPurchase } from './upgrades';
import { createRoundEnemies } from './round-enemies';
import { validateContent } from './validate-content';
import type { FinishedCombat, MatchCommandResult, MatchEvent, MatchFailure, MatchState, MatchStep, RunningCombat } from './match-types';
export * from './match-types';
export { DEFAULT_MATCH_SEED, MATCH_RULES } from './match-rules';
export { getXpToNextLevel, getShopOdds } from './progression';
export { getUnitSellPrice, getUnitStats } from './unit-stats';
const fail = (state: MatchState, reason: MatchFailure): MatchCommandResult => ({ ok: false, state, reason });
const accept = (state: MatchState, events: readonly MatchEvent[] = []): MatchCommandResult => ({ ok: true, state, events });

export function createMatch(seed = DEFAULT_MATCH_SEED): MatchState {
  validateSeed(seed);
  validateContent();
  return { schemaVersion: 3, rulesVersion: 'm3-v1', contentVersion: 'm3-content-v1', seed,
    ...generateShop(seed, 1, MATCH_RULES.initialLevel), round: 1, gold: MATCH_RULES.initialGold,
    level: MATCH_RULES.initialLevel, xp: 0, playerHp: MATCH_RULES.initialHp, nextUnitSerial: 6,
    preparation: structuredClone(createGame()), roundResults: [], phase: 'preparation', combat: null };
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
  return accept({ ...state, gold: state.gold - cost, nextUnitSerial: state.nextUnitSerial + 1,
    preparation: plan.preparation,
    shop: { ...state.shop, slots: state.shop.slots.map((item, index) => index === slotIndex ? { status: 'purchased' } : item) },
  }, plan.events);
}
export function sellUnit(state: MatchState, unitId: string): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  const unit = state.preparation.units.find(unit => unit.id === unitId);
  if (!unit) return fail(state, 'unknown-unit');
  if (unit.team !== 'player') return fail(state, 'enemy-unit');
  return accept({ ...state, gold: state.gold + getUnitSellPrice(unit),
    preparation: { ...state.preparation, units: state.preparation.units.filter(unit => unit.id !== unitId) } });
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
  return reason ? fail(state, reason) : accept(withCombat(state, createCombat(state.preparation)));
}
export function stepMatch(state: MatchState): MatchStep {
  if (state.phase !== 'combat') return { state, events: [] };
  const next = stepCombat(state.combat);
  return { state: withCombat(state, next.state), events: next.events };
}
export function nextRound(state: MatchState, expectedRound: number): MatchCommandResult {
  if (state.phase !== 'settlement') return fail(state, 'wrong-phase');
  if (expectedRound !== state.round) return fail(state, 'stale-round');
  if (state.roundResults.length !== state.round || state.roundResults.at(-1)?.round !== state.round) return fail(state, 'unsettled-round');
  const round = state.round + 1;
  return accept({ ...state, round, phase: 'preparation', combat: null,
    preparation: { ...state.preparation, units: [...state.preparation.units.filter(unit => unit.team === 'player'), ...createRoundEnemies(round)] },
    ...generateShop(state.rngState, state.shop.generation + 1, state.level) });
}
