import { createCombat, stepCombat, validateCombatStart, type CombatState } from './combat';
import { createGame, deployUnit } from './game';
import type { Unit, UnitLocation } from './units';
import { DEFAULT_MATCH_SEED, MATCH_RULES } from './match-rules';
import { validateSeed } from './rng';
import { generateShop } from './shop';
import type { FinishedCombat, MatchCommandResult, MatchFailure, MatchState, MatchStep, RunningCombat } from './match-types';
export * from './match-types';
export { DEFAULT_MATCH_SEED, MATCH_RULES } from './match-rules';

const fail = (state: MatchState, reason: MatchFailure): MatchCommandResult => ({ ok: false, state, reason });
const accept = (state: MatchState): MatchCommandResult => ({ ok: true, state });

export function createMatch(seed = DEFAULT_MATCH_SEED): MatchState {
  validateSeed(seed);
  return { seed, ...generateShop(seed, 1), round: 1, gold: MATCH_RULES.initialGold, nextUnitSerial: 6,
    preparation: structuredClone(createGame()), roundResults: [], phase: 'preparation', combat: null };
}

export function deployMatchUnit(state: MatchState, unitId: string, target: UnitLocation): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  const result = deployUnit(state.preparation, unitId, target);
  return result.ok ? accept({ ...state, preparation: result.state }) : fail(state, result.reason);
}

export function buyUnit(state: MatchState, slotIndex: number, expectedGeneration: number): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= state.shop.slots.length) return fail(state, 'invalid-slot');
  if (expectedGeneration !== state.shop.generation) return fail(state, 'stale-shop');
  const offer = state.shop.slots[slotIndex];
  if (offer.status !== 'available') return fail(state, 'purchased-slot');
  if (state.gold < MATCH_RULES.buyPrice) return fail(state, 'insufficient-gold');
  const occupied = new Set(state.preparation.units.flatMap(unit => unit.location.kind === 'bench' ? [unit.location.slot] : []));
  let slot = 0;
  while (slot < state.preparation.benchSize && occupied.has(slot)) slot++;
  if (slot === state.preparation.benchSize) return fail(state, 'bench-full');
  const unit: Unit = { id: `unit-${state.nextUnitSerial}`, definitionId: offer.definitionId, team: 'player', location: { kind: 'bench', slot } };
  return accept({ ...state, gold: state.gold - MATCH_RULES.buyPrice, nextUnitSerial: state.nextUnitSerial + 1,
    preparation: { ...state.preparation, units: [...state.preparation.units, unit] },
    shop: { ...state.shop, slots: state.shop.slots.map((offer, index) => index === slotIndex ? { status: 'purchased' } : offer) } });
}

export function sellUnit(state: MatchState, unitId: string): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  const unit = state.preparation.units.find(unit => unit.id === unitId);
  if (!unit) return fail(state, 'unknown-unit');
  if (unit.team !== 'player') return fail(state, 'enemy-unit');
  return accept({ ...state, gold: state.gold + MATCH_RULES.sellPrice,
    preparation: { ...state.preparation, units: state.preparation.units.filter(unit => unit.id !== unitId) } });
}

export function rerollShop(state: MatchState): MatchCommandResult {
  if (state.phase !== 'preparation') return fail(state, 'wrong-phase');
  if (state.gold < MATCH_RULES.rerollCost) return fail(state, 'insufficient-gold');
  return accept({ ...state, gold: state.gold - MATCH_RULES.rerollCost, ...generateShop(state.rngState, state.shop.generation + 1) });
}

export function matchStartFailure(state: MatchState): MatchFailure | undefined {
  return state.phase !== 'preparation' ? 'wrong-phase' : validateCombatStart(state.preparation);
}

/** Only match simulation commits a terminal battle's result and income, in one transition. */
function withCombat(state: MatchState, combat: CombatState): MatchState {
  if (combat.status === 'running') return { ...state, phase: 'combat', combat: combat as RunningCombat };
  if (combat.result === null || state.roundResults.some(record => record.round >= state.round)) {
    throw new Error('Invalid settlement transition');
  }
  const gold = state.gold + MATCH_RULES.roundIncome;
  return { ...state, phase: 'settlement', combat: combat as FinishedCombat, gold,
    roundResults: [...state.roundResults, { round: state.round, result: combat.result, combatTicks: combat.tick,
      income: MATCH_RULES.roundIncome, goldBefore: state.gold, goldAfter: gold }] };
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
  return accept({ ...state, round: state.round + 1, phase: 'preparation', combat: null,
    ...generateShop(state.rngState, state.shop.generation + 1) });
}
