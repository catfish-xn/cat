import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import type { Room } from '../../src/server/room/room';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { ANOMALY_DEFINITIONS } from '../../src/simulation/content/anomalies';
import { restoreCarouselSeat } from '../../src/simulation/carousel';
import type { MatchState } from '../../src/simulation/match-types';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { makeRoom } from './helpers';

// Real seed-24 route from carousel-room: s1–s3 are taken over, s0 keeps the published sell/buy script.
// Stop at the 5-4 carousel. s2/s3/s7 have no augment history there; a candidate must not retitle the anomaly.
const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { carousel: CAROUSEL_RULES_BINDING, seed: 24 });
const seatOf = (seatId: string) => room.state.seats.find(seat => seat.seatId === seatId)!;
const unitsOf = (seatId: string) => seatOf(seatId).match.preparation.units.filter(unit => unit.team === 'player');
const HISTORY_FREE = ['s2', 's3', 's7'] as const;

function buyAll(target: Room, seatId: string): void {
  const bench = () => unitsOf(seatId).filter(unit => unit.location.kind === 'bench').length;
  for (let slot = 0; slot < 5 && bench() < 9; slot++) target.handle(seatId, { type: 'buy', slot, generation: seatOf(seatId).match.shop.generation });
}

beforeAll(() => {
  room.start();
  for (const seatId of ['s1', 's2', 's3']) { room.setConnected(seatId, false); expect(room.takeOver(seatId)).toBe(true); }
  const prepared = new Set<string>();
  for (let fired = 0; fired < 200_000 && room.state.phase !== 'ended'; fired++) {
    if (room.state.phase === 'carousel' && room.state.roundId === '5-4') return;
    if (room.state.phase === 'preparation' && seatOf('s0').alive && !prepared.has(room.state.roundId)) {
      prepared.add(room.state.roundId);
      const receipts = seatOf('s0').match.carousel!.receipts;
      const picks = new Set(receipts.map(receipt => receipt.unitId));
      if (room.state.roundId < '3-2') picks.add('unit-1');
      for (const unit of unitsOf('s0').filter(unit => !picks.has(unit.id))) expect(room.handle('s0', { type: 'sell', unitId: unit.id }).ok).toBe(true);
      if (room.state.roundId === '2-1') buyAll(room, 's0');
    }
    if (!clock.runNext()) break;
  }
}, 120_000);
afterAll(() => room.dispose());

function forgeDefinition(match: MatchState, alsoQuote: boolean): MatchState {
  const current = match.anomalySelection?.definitionId;
  const definitionId = Object.keys(ANOMALY_DEFINITIONS).find(id => id !== current);
  if (!definitionId || !match.anomalySelection || !match.anomalyBinding) throw new Error('missing anomaly entitlement');
  const forged = structuredClone(match);
  const draft = forged as unknown as {
    anomalySelection: NonNullable<MatchState['anomalySelection']>;
    anomalyBinding: NonNullable<MatchState['anomalyBinding']>;
    scheduleReceipts: MatchState['scheduleReceipts'][number][];
    anomalyOfferHistory: NonNullable<MatchState['anomalyOfferHistory']>;
  };
  draft.anomalySelection = { ...draft.anomalySelection, definitionId };
  draft.anomalyBinding = { ...draft.anomalyBinding, definitionId };
  draft.scheduleReceipts = draft.scheduleReceipts.map(receipt => receipt.kind === 'anomaly' ? { ...receipt, definitionId } : receipt);
  if (alsoQuote) {
    const facts = draft.anomalyOfferHistory.facts;
    const last = facts[facts.length - 1];
    if (last?.kind !== 'anomaly-offer') throw new Error('missing anomaly quote');
    draft.anomalyOfferHistory = { ...draft.anomalyOfferHistory, facts: facts.map((fact, index) => index === facts.length - 1 ? { ...fact, definitionId } : fact) };
  }
  return forged;
}

describe('seed 24, stage 5-4 carousel restore', () => {
  it('is the open 5-4 carousel and s2/s3/s7 have no augment history', () => {
    expect(room.state.fault).toBeNull();
    expect(room.state.phase).toBe('carousel');
    expect(room.state.roundId).toBe('5-4');
    for (const seatId of HISTORY_FREE) {
      const match = seatOf(seatId).match;
      expect(match.augmentHistory, `${seatId} augments ${match.augments.map(augment => augment.definitionId).join(',')}`).toBeUndefined();
      expect(match.anomalySelection?.definitionId).toEqual(match.anomalyBinding?.definitionId);
      expect(match.scheduleReceipts.find(receipt => receipt.kind === 'anomaly')?.definitionId).toBe(match.anomalySelection?.definitionId);
    }
  });

  it.each(HISTORY_FREE)('rejects a forged anomaly definition for %s without authority', seatId => {
    const match = seatOf(seatId).match;
    const carousel = room.state.carousel!.state;
    const pool = room.state.pool;
    const authority = room.augmentHistoryAuthority(seatId);
    for (const input of [match, JSON.stringify(match)]) {
      expect(restoreCarouselSeat(carousel, input, authority)).toEqual(match);
      expect(restoreSharedOrbSnapshot(pool, input, authority)).toEqual(match);
      expect(() => restoreCarouselSeat(carousel, input)).toThrow(/missing independent server authority/);
      expect(() => restoreSharedOrbSnapshot(pool, input)).toThrow(/missing independent server authority/);
    }
    for (const alsoQuote of [false, true]) {
      const forged = forgeDefinition(match, alsoQuote);
      for (const input of [forged, JSON.stringify(forged)]) {
        expect(() => restoreCarouselSeat(carousel, input)).toThrow(/missing independent server authority/);
        expect(() => restoreSharedOrbSnapshot(pool, input)).toThrow(/missing independent server authority/);
        expect(() => restoreCarouselSeat(carousel, input, authority)).toThrow(/server facts\/state mismatch/);
        expect(() => restoreSharedOrbSnapshot(pool, input, authority)).toThrow(/server facts\/state mismatch/);
      }
    }
    expect(seatOf(seatId).match).toBe(match);
    expect(room.state.carousel!.state).toBe(carousel);
  });
});
