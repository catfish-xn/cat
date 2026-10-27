import { pipelineGiftPlan, pipelineGoldPlan, validatePipelineHistory } from './augment-pool-batch5-g5-pipeline';
import type { MatchState } from './match-types';
import type { OwnedAugment } from './strategy-types';
import { planAugmentGifts } from './augment-gift-plan';
import { EXPECTED_UNEXPECTEDNESS_REWARDS, type ExpectedDiceBand } from './content/augment-pool-batch5-g5';
import { deriveOrbStream } from './orb-stage-plan';
import { nextRandom } from './rng';
import { getMultiplayerRoundById, getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { grantMechanicGold } from './seat-mechanics/grants';
import { isAnvil } from './content/anvils';

export const BATCH5_G5_SOURCE = 'augment-pool-batch5-g5';
/** Independent, reproducible stream; high-bit buckets avoid the LCG low-bit parity correlation for dice.
 * Rejection makes every admitted bucket equally sized. No live shop/combat/loot RNG is consumed. */
export function batch5G5Draws(state: Pick<MatchState, 'seed' | 'multiplayer'>, identity: readonly string[], sizes: readonly number[]): number[] {
  let rng = deriveOrbStream(BATCH5_G5_SOURCE, state.seed, state.multiplayer?.seatId ?? 'solo', ...identity).state;
  return sizes.map(size => {
    if (!Number.isSafeInteger(size) || size < 1 || size > 0x100000000) throw new RangeError('Invalid batch5 g5 draw');
    const bucket = Math.floor(0x100000000 / size), limit = bucket * size;
    for (;;) { const draw = nextRandom(rng); rng = draw.state; if (draw.word < limit) return Math.floor(draw.word / bucket); }
  });
}
export function expectedDiceBand(dice: readonly number[]): ExpectedDiceBand {
  if (dice.length !== 3 || dice.some(n => !Number.isInteger(n) || n < 1 || n > 6)) throw new RangeError('Invalid expected dice');
  if (dice.every(n => n === dice[0])) return 'jackpot';
  const sum = dice.reduce((n, d) => n + d, 0);
  return sum <= 8 ? 'economy' : sum <= 11 ? 'units' : sum <= 15 ? 'forge' : 'equipment';
}
/** Three fixed tables, acquired at 2-1 and paid before input unlock at 3-1/4-1. */
export function expectedUnexpectednessRolls(state: MatchState) {
  const owner = state.augments.find(a => a.definitionId === 'expected-unexpectedness');
  if (!owner) return [];
  return ([2, 3, 4] as const).flatMap(stage => {
    const round = stage === 2 ? owner.acquiredRound : getMultiplayerRoundById(`${stage}-1`).ordinal;
    if (round > state.round) return [];
    const dice = batch5G5Draws(state, [owner.choiceId, 'dice', String(stage)], [6, 6, 6]).map(n => n + 1);
    const band = expectedDiceBand(dice), reward = EXPECTED_UNEXPECTEDNESS_REWARDS[stage][band];
    const giftOwner: OwnedAugment = { ...owner, acquiredRound: round, choiceId: JSON.stringify([owner.choiceId, 'expected-unexpectedness', stage]) };
    return [{ stage, round, dice, band, reward, giftOwner,
      receiptId: JSON.stringify([BATCH5_G5_SOURCE, owner.choiceId, 'dice', stage]) }];
  });
}
export function batch5G5GiftPlan(state: MatchState) {
  return expectedUnexpectednessRolls(state).flatMap(r => planAugmentGifts(state, r.giftOwner, r.reward.gifts)).concat(pipelineGiftPlan(state));
}
export function expectedUnexpectednessRerolls(state: MatchState): number {
  return expectedUnexpectednessRolls(state).reduce((n, r) => n + (r.reward.rerolls ?? 0), 0);
}
export function drainBatch5G5Gold(initial: MatchState): MatchState {
  let state = initial;
  for (const r of [...expectedUnexpectednessRolls(state), ...pipelineGoldPlan(state)]) {
    if (!r.reward.gold || state.seatMechanics?.receipts.some(p => p.receiptId === r.receiptId)) continue;
    const result = grantMechanicGold(state, { source: BATCH5_G5_SOURCE, receiptId: r.receiptId, amount: r.reward.gold });
    if (!result.ok) throw new RangeError(`Batch5 g5 gold: ${result.reason}`);
    state = result.state;
  }
  return state;
}
export function validateBatch5G5Rewards(state: MatchState): void {
  validatePipelineHistory(state);
  const plan = [...expectedUnexpectednessRolls(state), ...pipelineGoldPlan(state)].filter(r => r.reward.gold);
  const actual = (state.seatMechanics?.receipts ?? []).filter(r => r.source === BATCH5_G5_SOURCE || r.receiptId.startsWith(`["${BATCH5_G5_SOURCE}",`));
  if (actual.length !== plan.length || new Set(actual.map(r => r.receiptId)).size !== actual.length || actual.some(r => !plan.some(p => p.receiptId === r.receiptId && r.source === BATCH5_G5_SOURCE
    && r.kind === 'gold' && r.amount === p.reward.gold && r.round === p.round && r.roundId === getMultiplayerRoundByOrdinal(p.round).roundId)))
    throw new RangeError('Invalid batch5 g5 reward authority');
  // Online heroes always have an escrow receipt. Anvils retain the existing full-bench pending-gift policy.
  if (state.multiplayer && batch5G5GiftPlan(state).some(g => g.kind === 'unit' && !isAnvil(g.definitionId)
    && !state.seatMechanics?.receipts.some(r => r.receiptId === g.receiptId)))
    throw new RangeError('Invalid batch5 g5 missing gift');
}
