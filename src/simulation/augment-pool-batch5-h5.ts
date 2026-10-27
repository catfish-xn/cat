import { requireAugmentFacts } from './augment-history';
import { getCatalogRoundById } from './round-selectors';
import { nextRandom } from './rng';
import { AUGMENT_BATCH5_H5 } from './content/augment-pool-batch5-h5';
import type { CarouselState } from './carousel-types';
import type { MatchState } from './match-types';

const CAROUSEL_ROUNDS = ['2-4', '3-4', '4-4', '5-4', '6-4'] as const;

/** Resolve priority from the acquisition evidence, not a client-supplied flag. */
export function carouselPriorityChoice(state: MatchState): string | null {
  const owner = state.augments.find(a => a.definitionId === 'young-and-wild-and-free');
  if (!owner) return null;
  const rows = requireAugmentFacts(state, 'acquire', owner.acquiredRound)
    .filter(f => f.choiceId === owner.choiceId && f.definitionId === owner.definitionId);
  if (rows.length !== 1) throw new RangeError('Invalid carousel priority history');
  return owner.choiceId;
}

/** A plan only: the caller must commit it through grantAdditionalCarouselPick. */
export function tableScrapsPick(state: MatchState, carousel: CarouselState): {choiceId: string; slot: number} | null {
  const owner = state.augments.find(a => a.definitionId === 'table-scraps');
  if (!owner || carousel.status !== 'closed' || !state.sharedPool || !state.carousel) return null;
  if (carousel.roundId !== state.roundDefinitionId || state.sharedPool.seatId !== state.multiplayer?.seatId)
    throw new RangeError('Invalid table scraps carousel');
  const rounds = CAROUSEL_ROUNDS.map(id => getCatalogRoundById(id).ordinal)
    .filter(round => round > owner.acquiredRound && round <= state.round);
  for (const round of rounds) {
    const normal = requireAugmentFacts(state, 'carousel', round).filter(f => f.source !== 'augment' && f.eligibilityChoiceIds.includes(owner.choiceId));
    if (normal.length !== 1) throw new RangeError('Invalid table scraps carousel history');
  }
  if (rounds.length === 0 || rounds.length > AUGMENT_BATCH5_H5['table-scraps'].source.values.NumStages) return null;
  const current = requireAugmentFacts(state, 'carousel', state.round);
  if (current.some(f => f.source === 'augment' && f.choiceId === owner.choiceId)) return null;
  const available = carousel.slots.filter(slot => slot.pickedBy === null);
  if (!available.length) return null;
  const seat = carousel.participants.find(p => p.seatId === state.sharedPool!.seatId);
  if (!seat) throw new RangeError('Invalid table scraps participant');
  // Independent, reproducible stream keyed by the carousel and fixed seat. Rejection
  // sampling avoids introducing a modulo bias when the number of slots is not a power of two.
  let seed = (carousel.rngAfter.state ^ 0x42533535 ^ seat.seatIndex) >>> 0;
  for (const char of owner.choiceId) seed = Math.imul(seed ^ char.charCodeAt(0), 0x01000193) >>> 0;
  const limit = Math.floor(0x100000000 / available.length) * available.length;
  let draw;
  do { draw = nextRandom(seed); seed = draw.state; } while (draw.word >= limit);
  return {choiceId: owner.choiceId, slot: available[draw.word % available.length].slot};
}
