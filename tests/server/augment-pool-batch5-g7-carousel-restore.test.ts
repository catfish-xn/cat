import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import { restoreCarousel, restoreCarouselSeat } from '../../src/simulation/carousel';
import { canonicalContent } from '../../src/simulation/content';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { installB1Offers } from '../fixtures/b1-scripted-offers';
import { answerOpenChoices, claimAllOrbs, makeRoom, runUntil } from './helpers';
import type { MatchState } from '../../src/simulation/match-types';

const ID = 'loot-explosion', SEAT = 's3';
const forms = ['object', 'json', 'serialized'] as const;
const encode = (state: MatchState, form: typeof forms[number]) => form === 'object' ? state : form === 'json' ? JSON.stringify(state) : canonicalContent(state);

for (const claimed of [false, true]) describe(`B5-69 gifts at the real carousel, claimed=${claimed}`, () => {
  // Script the eligible Loot Explosion draw and replay it in restore's offer-history check.
  let restoreOffers: () => void;
  beforeEach(() => { restoreOffers = installB1Offers([ID]); });
  afterEach(() => restoreOffers());
  const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 65, carousel: CAROUSEL_RULES_BINDING });
  const own = () => room.state.seats.find(s => s.seatId === SEAT)!.match;
  let alternative = '';
  afterAll(() => room.dispose());

  it('starts the room', () => { room.start(); });
  for (const roundId of ['1-3', '1-4', '2-1']) it(`reaches ${roundId}`, () => {
    runUntil(room, clock, s => s.roundId === roundId && s.phase === 'preparation');
  });
  it('selects Loot Explosion and leaves no army that could earn combat rewards', () => {
    const choice = own().pendingChoice!;
    // Fixture self-check under installB1Offers, not evidence of a real-RNG draw.
    expect(choice.offers).toContain(ID);
    // v26 D5 (7953c99a) moved seed 65's real 2-1 draw: crownguard-spirit (the old forged replacement) is no longer
    // offered, so the forged save would now fail the earlier offer-history check. Forge with another card actually
    // offered beside Loot Explosion instead, so the gift-authority / server-facts checks still decide.
    alternative = choice.offers.find(id => id !== ID)!;
    expect(alternative).toBeDefined();
    expect(room.handle(SEAT, { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: ID })).toMatchObject({ ok: true });
    answerOpenChoices(room);
    if (claimed) claimAllOrbs(room, [SEAT]);
    // Sold gifts retain independent pool evidence; the other route leaves both gift orbs unclaimed.
    for (const unit of own().preparation.units.filter(u => u.team === 'player'))
      expect(room.handle(SEAT, { type: 'sell', unitId: unit.id })).toMatchObject({ ok: true });
    expect(own().preparation.units.filter(u => u.team === 'player')).toHaveLength(0);
  });
  for (const roundId of ['2-2', '2-3', '2-4']) it(`continues to ${roundId}`, () => {
    runUntil(room, clock, s => s.roundId === roundId && s.phase === (roundId === '2-4' ? 'carousel' : 'preparation'));
  });
  it.each(forms)('authenticates gifts through both multiplayer restore entries, via %s', form => {
    expect(room.state.fault).toBeNull();
    const original = own(), carousel = room.state.carousel!.state, pool = room.state.pool;
    const authority = room.augmentHistoryAuthority(SEAT);
    expect(original.seatMechanics!.receipts.filter(r => r.receiptId.includes(ID)))
      .toMatchObject([{ kind: 'unit', definitionId: 'camille', resolution: 'orb' }, { kind: 'unit', definitionId: 'powder', resolution: 'orb' }]);
    expect(original.seatMechanics!.receipts.filter(r => r.source === 'augment-pool-batch5-g7')).toHaveLength(0);
    expect([...pool.pending, ...pool.rewards].filter(r => r.seatId === SEAT && r.dropId.includes(ID))).toHaveLength(claimed ? 2 : 0);
    // A carousel-only save has no Match claims; its separately restored seat still needs gift validation.
    const restoredCarousel = restoreCarousel(form === 'object' ? carousel : form === 'json' ? JSON.stringify(carousel) : canonicalContent(carousel));
    expect(restoredCarousel).toEqual(carousel);
    expect(restoreSharedOrbSnapshot(pool, encode(original, form), authority)).toEqual(original);
    expect(restoreCarouselSeat(restoredCarousel, encode(original, form), authority)).toEqual(original);
    for (const rewriteSource of [false, true]) {
      const { augmentHistory: _history, ...rest } = structuredClone(original);
      const bad = { ...rest, gold: rest.gold + 123, augments: rest.augments.map(a => a.definitionId === ID ? { ...a, definitionId: alternative } : a),
        seatMechanics: { ...rest.seatMechanics!, receipts: rest.seatMechanics!.receipts.map(r => rewriteSource && r.receiptId.includes(ID) ? { ...r, source: 'academy' } : r) } };
      const missingAuthority = claimed ? /missing independent server authority/ : /Invalid augment batch1 gift authority/;
      expect(() => restoreSharedOrbSnapshot(pool, encode(bad, form))).toThrow(missingAuthority);
      expect(() => restoreCarouselSeat(restoredCarousel, encode(bad, form))).toThrow(missingAuthority);
      expect(() => restoreSharedOrbSnapshot(pool, encode(bad, form), authority)).toThrow(/server facts\/state mismatch/);
      expect(() => restoreCarouselSeat(restoredCarousel, encode(bad, form), authority)).toThrow(/server facts\/state mismatch/);
      if (claimed) {
        const erased = { ...bad, seatMechanics: { ...bad.seatMechanics, receipts: bad.seatMechanics.receipts.filter(r => !r.receiptId.includes(ID)) } };
        expect(() => restoreSharedOrbSnapshot(pool, encode(erased, form))).toThrow(/missing independent server authority/);
        expect(() => restoreCarouselSeat(restoredCarousel, encode(erased, form))).toThrow(/missing independent server authority/);
      }
    }
    expect(own()).toBe(original);
    expect(room.state.pool).toBe(pool);
    expect(room.state.carousel!.state).toBe(carousel);
  });
});
