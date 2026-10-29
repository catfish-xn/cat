import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import { restoreCarouselSeat } from '../../src/simulation/carousel';
import { assertSharedPoolConservation, restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { validateMultiplayerOrbLedger } from '../../src/simulation/orb-restore';
import { lootEntryId, lootOrbId, lootReceiptId } from '../../src/simulation/loot-identity';
import { canonicalContent } from '../../src/simulation/content';
import { withB1Offers } from '../fixtures/b1-scripted-offers';

const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 21, carousel: CAROUSEL_RULES_BINDING });
const seatId = 's0';
afterAll(() => room.dispose());
it('starts the carousel-enabled G3 room', () => { room.start(); });
for (const round of ['1-3', '1-4', '2-1']) it(`reaches ${round}`, () => withB1Offers(['aerial-warfare'], () => {
  runUntilClaiming(room, clock, s => s.roundId === round && s.phase === 'preparation');
}));
it('selects G3 through a real room command', () => withB1Offers(['aerial-warfare'], () => {
  const choice = room.state.seats.find(s => s.seatId === seatId)!.match.pendingChoice!;
  // Fixture self-check: the draw is scripted; candidate eligibility and commands remain real.
  expect(choice.offers).toContain('aerial-warfare');
  expect(room.handle(seatId, { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: 'aerial-warfare' })).toMatchObject({ ok: true });
}));
for (const round of ['2-2', '2-3']) it(`reaches ${round}`, () => withB1Offers(['aerial-warfare'], () => {
  runUntilClaiming(room, clock, s => s.roundId === round && s.phase === 'preparation');
}));
it('opens the real shared carousel', () => withB1Offers(['aerial-warfare'], () => {
  runUntilClaiming(room, clock, s => s.roundId === '2-4' && s.phase === 'carousel');
}));
it('authenticates G3 gift receipts through both shared and carousel restore formats', () => withB1Offers(['aerial-warfare'], () => {
  const state = room.state.seats.find(s => s.seatId === seatId)!.match;
  const carousel = room.state.carousel!.state;
  const gift = state.seatMechanics!.receipts.find(r => r.source === 'augment-pool-batch1');
  expect(gift).toMatchObject({ kind: 'unit', definitionId: 'scar' });
  if (!gift || gift.kind !== 'unit') throw new Error('missing G3 gift');
  // Rename every linked identity, preserving generic orb and pool consistency.
  const tuple = JSON.parse(gift.receiptId); tuple[3] = 99;
  const nextReceiptId = JSON.stringify(tuple), nextOrbId = lootOrbId(gift.roundId, 'mechanic', nextReceiptId, 0);
  const dropId = lootEntryId(gift.orbId!, 0), nextDropId = lootEntryId(nextOrbId, 0);
  const replacements = new Map([[gift.receiptId, nextReceiptId], [gift.orbId!, nextOrbId], [dropId, nextDropId], [lootReceiptId(dropId), lootReceiptId(nextDropId)]]);
  const bad = JSON.parse(JSON.stringify(state), (_key, value: unknown) => typeof value === 'string' ? replacements.get(value) ?? value : value);
  expect(() => validateMultiplayerOrbLedger(bad)).not.toThrow();
  expect(() => assertSharedPoolConservation(room.state.pool, [bad])).not.toThrow();
  for (const encode of [(s: unknown) => s, (s: unknown) => JSON.stringify(s), (s: unknown) => canonicalContent(s)]) {
    expect(restoreSharedOrbSnapshot(room.state.pool, encode(state))).toEqual(state);
    expect(restoreCarouselSeat(carousel, encode(state))).toEqual(state);
    expect(() => restoreSharedOrbSnapshot(room.state.pool, encode(bad))).toThrow('Invalid augment batch1 gift authority');
    expect(() => restoreCarouselSeat(carousel, encode(bad))).toThrow('Invalid augment batch1 gift authority');
  }
}));
