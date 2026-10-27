import { AUGMENT_SHOP } from './content/augment-pool-shop';
import { BATCH5_R5_STARRY_POLICY } from './content/augment-pool-batch5-r5';
import type { MatchState } from './match-types';
import { nextRandom } from './rng';
import { UNIT_DEFINITIONS } from './units';

const owner = (state: Pick<MatchState, 'augments'>) =>
  state.augments.find(a => AUGMENT_SHOP[a.definitionId]?.rule === 'starry');

/** P-B5-08/09: one probability for both eligible costs, zero at levels 1 and 2. */
export function starryChanceBps(state: Pick<MatchState, 'augments' | 'level'>): number {
  return owner(state) ? BATCH5_R5_STARRY_POLICY.chanceBpsByLevel[state.level - 1] ?? 0 : 0;
}

/** Pure, seat/choice/generation/slot-bound LCG draw. The shared transaction reserves
 * three copies atomically, or keeps the ordinary one-star offer if stock is short.
 * Neither purchase nor restore consumes live RNG to repeat this decision. */
export function starryUpgrade(state: Pick<MatchState, 'augments' | 'level' | 'seed' | 'multiplayer'>,
  generation: number, slot: number, definitionId: string): boolean {
  const a = owner(state);
  if (!a || UNIT_DEFINITIONS[definitionId].cost > BATCH5_R5_STARRY_POLICY.maxCost) return false;
  const namespace = JSON.stringify(['augment-pool-shop', state.multiplayer?.seatId ?? 'solo', 'starry', a.choiceId, generation, slot]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < namespace.length; i++) hash = Math.imul(hash ^ namespace.charCodeAt(i), 0x01000193) >>> 0;
  const word = nextRandom((state.seed ^ hash) >>> 0).word;
  return Math.floor(word * 10000 / 4294967296) < starryChanceBps(state);
}

/** A shared snapshot must not authenticate acquisition gold using its own receipt.
 * Shop history checks subsequent cash flow; bind this initial receipt to content. */
export function validateBatch5R5ShopAcquisition(state: MatchState): void {
  const owners = state.augments.filter(a => AUGMENT_SHOP[a.definitionId]?.rule === 'starry');
  const receipts = state.scheduleReceipts.filter(r => r.definitionId && AUGMENT_SHOP[r.definitionId]?.rule === 'starry');
  const fail = () => { throw new RangeError('Invalid Starry Night acquisition'); };
  if (owners.length > 1 || receipts.length !== owners.length) fail();
  for (const a of owners) {
    const r = receipts.find(r => r.eventId === a.choiceId);
    if (!r || r.kind !== 'augment' || r.definitionId !== a.definitionId || r.round !== a.acquiredRound
      || r.gold !== AUGMENT_SHOP[a.definitionId].source.values.Gold || r.itemIds.length || r.unitId !== null) fail();
  }
}
