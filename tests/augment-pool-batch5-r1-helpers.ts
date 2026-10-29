import { createMatch } from '../src/simulation/match';
import { createSharedPool, initializeSharedSeat, refreshSharedShops, nextSharedRound, runSharedMatchCommand } from '../src/simulation/shared-pool';
import { ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import { resolveRoundEconomy } from '../src/simulation/round-economy';
import { augmentNeedsHistory } from '../src/simulation/augment-history-owners';
import { historyRoster, prepareAugmentAcquisition, recordAugmentTable } from '../src/simulation/augment-history';
import type { HistorySeat } from '../src/simulation/augment-history-types';
import type { MatchState } from '../src/simulation/match-types';
import type { SharedPoolState, SharedMatchCommand } from '../src/simulation/shared-pool-types';

export function selfTable(state: MatchState): readonly HistorySeat[] {
  return [{ ...historyRoster(state), seatId: 's0', index: 0, hp: state.playerHp, alive: true, rank: 1, eliminatedRound: null }];
}
/** Real shared commands and authoritative settlements; no injected augment, offer, RNG or reward receipt. */
export function onlineOffer(seed: number) {
  let pool = createSharedPool('tomb-raider-test', seed, { seatCount: 1 });
  const initialized = initializeSharedSeat(pool, createMatch(seed, { mode: 'shared-deferred' }), 's0', 0);
  if (!initialized.ok) throw new Error(initialized.reason);
  pool = initialized.pool;
  const initial = refreshSharedShops(pool, [initialized.state], 1);
  if (!initial.ok) throw new Error(initial.reason);
  pool = initial.pool;
  let state = initial.states[0];
  const command = (cmd: SharedMatchCommand) => {
    const result = runSharedMatchCommand(pool, state, cmd);
    if (!result.ok) throw new Error(`${state.roundDefinitionId}/${cmd.type}: ${result.reason}`);
    state = result.state; pool = result.pool;
  };
  const answer = () => {
    for (let n = 0; state.pendingChoice && n < 32; n++) {
      const c = state.pendingChoice;
      if (c.kind === 'augment') prepareAugmentAcquisition(state, { status: 'none' }, 0, selfTable(state));
      const option = c.kind === 'augment'
        ? c.offers.find(id => !augmentNeedsHistory(id) && !['kingslayer', 'dummify', 'golemify'].includes(id)) ?? c.offers[0]
        : c.offers[0];
      command({ type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: option });
    }
    if (state.pendingChoice) throw new Error('Unresolved fixture choice');
  };
  while (state.roundDefinitionId !== '4-2') {
    answer();
    if (state.phase === 'preparation') {
      if (state.m8.round.kind === 'pvp') {
        const plan = resolveRoundEconomy({ augments: state.augments, roundId: state.roundDefinitionId, result: 'playerWin',
          gold: state.gold, streak: state.streak, level: state.level, xp: state.xp, hp: state.playerHp, enemySurvivors: 0 });
        command({ type: 'settleRound', receipt: { version: ROUND_SETTLEMENT_VERSION, settlementId: `fixture:${state.round}`,
          battleId: `battle:${state.round}`, seatId: 's0', round: state.round, roundId: state.roundDefinitionId,
          settlementEligible: true, result: 'win', damage: plan.playerDamage, baseDamage: plan.baseDamage,
          opposingSurvivors: 0, growth: [], combatTicks: 1, combatEventCount: 1 } });
      } else {
        command({ type: 'startCombat' });
        while ((state as MatchState).phase === 'combat') command({ type: 'step' });
      }
    }
    answer();
    const next = nextSharedRound(pool, [state], state.round);
    if (!next.ok) throw new Error(`${state.roundDefinitionId}: ${next.reason}`);
    pool = next.pool; state = next.states[0];
    if (state.augmentHistory) state = recordAugmentTable(state, 'entry', selfTable(state));
  }
  return { pool, state };
}

export function chooseInPool(pool: SharedPoolState, state: MatchState, definitionId: string) {
  const c = state.pendingChoice!;
  const result = runSharedMatchCommand(pool, state, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId });
  if (!result.ok) throw new Error(result.reason);
  return result;
}
