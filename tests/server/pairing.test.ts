import { describe, expect, it } from 'vitest';
import { planPairings } from '../../src/server/room/pairing';

const ids = (count: number) => Array.from({ length: count }, (_, index) => `s${index}`);

describe('planPairings', () => {
  it.each([8, 7, 6, 5, 4, 3, 2])('%i survivors: nobody fights themself or twice, odd counts mirror exactly one seat', count => {
    const alive = ids(count);
    const { pairings } = planPairings(alive, 42, 'r1');
    expect(pairings.map(pairing => pairing.seatId).sort()).toEqual([...alive].sort());
    const mirrors = pairings.filter(pairing => pairing.opponent.kind === 'mirror');
    expect(mirrors).toHaveLength(count % 2);
    for (const pairing of pairings) {
      if (pairing.opponent.kind === 'seat') {
        const opponentId = pairing.opponent.seatId;
        expect(opponentId).not.toBe(pairing.seatId);
        const back = pairings.find(other => other.seatId === opponentId)!;
        expect(back.opponent).toEqual({ kind: 'seat', seatId: pairing.seatId });
        expect(back.battleId).toBe(pairing.battleId);
      } else {
        expect(pairing.opponent.sourceSeatId).not.toBe(pairing.seatId);
        expect(alive).toContain(pairing.opponent.sourceSeatId);
      }
    }
    expect(new Set(pairings.map(pairing => pairing.battleId)).size).toBe(Math.ceil(count / 2));
  });
  it('is reproducible for the same input and consumes the rng', () => {
    const first = planPairings(ids(7), 7, 'r4'), second = planPairings(ids(7), 7, 'r4');
    expect(second).toEqual(first);
    expect(first.rngState).not.toBe(7);
    const other = planPairings(ids(7), 99, 'r4');
    expect(other.rngState).not.toBe(first.rngState);
  });
  it('needs at least two survivors and unique ids', () => {
    expect(planPairings(['s0'], 1, 'r1')).toEqual({ pairings: [], rngState: 1 });
    expect(() => planPairings(['s0', 's0'], 1, 'r1')).toThrow(RangeError);
  });
});
