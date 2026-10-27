import { augmentCandidates, drawAugmentCard, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { bindSharedOpeningEncounter, createOpeningEncounter, openingEncounterId } from '../src/simulation/opening-encounter';
import { nextRandom } from '../src/simulation/rng';
import type { MatchState } from '../src/simulation/match-types';

/** Only predicts initial 2-1 offers/rerolls; the test must traverse and select through Room.handle. */
export function findG5RoomOffer(id: string, predicate: (state: MatchState) => boolean = () => true) {
  for (let seed = 0; seed <= 100; seed++) {
    let rng = seed;
    for (let index = 0; index < 4; index++) {
      const draw = nextRandom(rng); rng = draw.state;
      const seatId = `s${index}`, openingEncounter = bindSharedOpeningEncounter(createOpeningEncounter(seed), 'test-room', seatId);
      const state = { seed: draw.word, augmentTierSeed: seed, openingEncounter, multiplayer: { seatId }, round: 4,
        augments: [{ definitionId: id, choiceId: 'round:2-1:augment', acquiredRound: 4 }] } as unknown as MatchState;
      if (!predicate(state)) continue;
      const tier = resolveAugmentTier(state, 'round:2-1:augment'), filter = { node: '2-1', fieldedTraits: [], blocked: [] };
      const candidates = (removed: readonly string[]) => augmentCandidates(tier, [], removed, openingEncounterId(state), filter);
      const first = generateChoices(candidates([]), (draw.word ^ 0x9e3779b9) >>> 0);
      let offers = first.offers, choiceRng = first.choiceRngState, removed = [...offers];
      if (offers.includes(id)) return { seed, seatId, rerolls: 0 };
      for (let slot = 0; slot < 3; slot++) {
        const pick = drawAugmentCard(candidates([...removed, ...offers]), choiceRng); choiceRng = pick.choiceRngState;
        offers = [...offers]; offers[slot] = pick.definitionId; removed.push(pick.definitionId);
        if (pick.definitionId === id) return { seed, seatId, rerolls: slot + 1 };
      }
    }
  }
  throw new Error(`No ${id} offer satisfying the test within seeds 0..100`);
}
