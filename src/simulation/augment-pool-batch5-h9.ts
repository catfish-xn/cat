import { settleCabalGrowth } from './augment-pool-batch5-h9-cabal';
import type { MatchState, MatchStep, MatchEvent } from './match-types';
import { AUGMENT_BATCH5_H9 } from './content/augment-pool-batch5-h9';

import { historyCheck, historySeatId, requireAugmentFacts } from './augment-history';
import { grantMechanicGold } from './seat-mechanics/grants';
import { UNIT_DEFINITIONS } from './units';

/** Credits begin at acquisition, remain available until used, and cannot be backdated. */
export function batch5H9FreeRerolls(state: Pick<MatchState, 'augments' | 'round'>): number {
  return state.augments.reduce((sum, augment) => sum + (
    augment.definitionId === 'a-golden-find' && augment.acquiredRound <= state.round
      ? AUGMENT_BATCH5_H9['a-golden-find'].source.values.FreeRerolls : 0
  ), 0);
}


export const GOLDEN_FIND_SOURCE = 'augment-b5-golden-find';

/** The input facts must have been produced by the real combat transaction. Restores authenticate
 * them by command replay (solo) or by a separately held room authority (online). */
export function goldenFindGoldPlan(state: MatchState): readonly {receiptId: string; source: string; round: number; amount: number}[] {
  const owner = state.augments.find(a => a.definitionId === 'a-golden-find');
  if (!owner) return [];
  historyCheck(state.augmentHistory, 'missing golden find history');
  let kills = 0, paidStacks = 0;
  const plan: {receiptId: string; source: string; round: number; amount: number}[] = [];
  const values = AUGMENT_BATCH5_H9['a-golden-find'].source.values;
  for (const result of state.roundResults.filter(r => r.round >= owner.acquiredRound && r.result !== 'supply')) {
    const bindings = requireAugmentFacts(state, 'combat-binding', result.round);
    historyCheck(bindings.length === 1, 'golden find combat binding');
    const {battleId, binding} = bindings[0];
    const deaths = requireAugmentFacts(state, 'deaths', result.round).filter(f => f.battleId === battleId);
    historyCheck(deaths.length > 0 && deaths.reduce((tick, f) => Math.max(tick, f.completeThroughTick), 0) >= result.combatTicks, 'golden find incomplete combat');
    if (binding) {
      const onlinePvp = !!state.multiplayer && result.roundKind === 'pvp';
      const rosters = onlinePvp
        ? requireAugmentFacts(state, 'pvp-roster', result.round).filter(f => f.battleId === battleId).flatMap(f => f.seats.filter(s => s.seatId === historySeatId(state)))
        : requireAugmentFacts(state, 'combat-roster', result.round).filter(f => f.battleId === battleId).map(f => f.roster);
      historyCheck(rosters.length === 1, 'golden find roster');
      const unit = rosters[0].units.find(u => u.id === binding.unitId && u.team === 'player' && u.location.kind === 'board');
      if (unit && UNIT_DEFINITIONS[unit.definitionId] && !UNIT_DEFINITIONS[unit.definitionId].summon && UNIT_DEFINITIONS[unit.definitionId].unitKind !== 'neutral') {
        const actor = onlinePvp ? JSON.stringify(['t2', historySeatId(state), 'unit', binding.unitId]) : binding.unitId;
        for (const death of deaths.flatMap(f => f.deaths)) {
          historyCheck(Object.hasOwn(death, 'killer'), 'golden find missing killer');
          const hostile = onlinePvp ? death.ownerSeatId !== historySeatId(state) : death.team === 'enemy';
          if (hostile && death.killer?.ownerId === actor) kills++;
        }
      }
    }
    const stacks = Math.floor(kills / values.NumKillsRequirement);
    if (stacks > paidStacks) plan.push({receiptId: JSON.stringify([GOLDEN_FIND_SOURCE, owner.choiceId, result.round]),
      source: GOLDEN_FIND_SOURCE, round: result.round, amount: (stacks - paidStacks) * values.GoldPerRequirement});
    paidStacks = stacks;
  }
  return plan;
}

export function drainGoldenFindGold(initial: MatchState): MatchState {
  let state = initial;
  for (const grant of goldenFindGoldPlan(initial)) {
    if (state.seatMechanics?.receipts.some(r => r.receiptId === grant.receiptId)) continue;
    historyCheck(grant.round === state.round, 'golden find late grant');
    const result = grantMechanicGold(state, grant);
    if (!result.ok) throw new RangeError(result.reason);
    state = result.state;
  }
  return state;
}

/** Called only after the complete combat history has been recorded by the successful settlement transaction. */
export function settleBatch5H9History(initial: MatchState): MatchStep {
  const state = settleCabalGrowth(drainGoldenFindGold(initial));
  if (state === initial) return {state, events: []};
  let seq = state.nextMatchEventSeq;
  const events: MatchEvent[] = (state.seatMechanics?.receipts ?? []).slice(initial.seatMechanics?.receipts.length ?? 0)
    .map(receipt => ({type: 'mechanicGranted', receipt, domain: 'match', eventSeq: seq++}));
  return {state: {...state, nextMatchEventSeq: seq}, events};
}
