import { describe, expect, it } from 'vitest';
import { candidateOpponents, DEFAULT_PAIRING_POLICY, PAIRING_HISTORY_LIMIT, planCandidates, planPairings, recordPairings } from '../../src/server/room/pairing';
import type { Pairing } from '../../src/server/room/types';

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

describe('G1-P6 candidateOpponents', () => {
  const alive = ids(8);
  it('excludes the last two opponents, alive only, never itself, in seat order', () => {
    expect(candidateOpponents(alive, 's0', {})).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
    expect(candidateOpponents(alive, 's0', { s0: ['s5', 's3', 's1'] })).toEqual(['s2', 's4', 's5', 's6', 's7']);
    expect(candidateOpponents(['s0', 's2', 's3'], 's0', { s0: ['s1', 's4'] })).toEqual(['s2', 's3']);
    expect(DEFAULT_PAIRING_POLICY).toEqual({ avoidRecentRounds: 2 });
  });
  it('steps back 2 → 1 → all survivors when the window leaves nobody', () => {
    // Three alive: both others fought in the last two rounds → only the last one is avoided.
    expect(candidateOpponents(['s0', 's1', 's2'], 's0', { s0: ['s1', 's2'] })).toEqual(['s1']);
    // Two alive: the only other seat is the last opponent → everybody.
    expect(candidateOpponents(['s0', 's1'], 's0', { s0: ['s1', 's1'] })).toEqual(['s1']);
    expect(candidateOpponents(alive, 's0', { s0: ['s1', 's2'] }, { avoidRecentRounds: 0 })).toHaveLength(7);
  });
  it('a mirror is recorded under its source for the seat that fought it only', () => {
    const history = recordPairings({ s0: ['s9'] }, [
      { battleId: 'b0', seatId: 's1', opponent: { kind: 'seat', seatId: 's2' } },
      { battleId: 'b0', seatId: 's2', opponent: { kind: 'seat', seatId: 's1' } },
      { battleId: 'b1', seatId: 's0', opponent: { kind: 'mirror', sourceSeatId: 's1' } },
    ]);
    expect(history).toEqual({ s0: ['s9', 's1'], s1: ['s2'], s2: ['s1'] });
    expect(recordPairings(history, [])).toBe(history);
    let long = {};
    for (let round = 0; round < PAIRING_HISTORY_LIMIT + 3; round++) long = recordPairings(long, [{ battleId: `b${round}`, seatId: 's0', opponent: { kind: 'seat', seatId: `s${round % 7 + 1}` } }]);
    expect((long as Record<string, string[]>).s0).toHaveLength(PAIRING_HISTORY_LIMIT);
  });
});

describe('G1-P6 planPairings under candidates', () => {
  /** Plays `rounds` PvP rounds on the given survivors, recording each, and checks every pairing against the shown candidates. */
  function play(alive: readonly string[], rounds: number, seed: number) {
    let history = {}, rng = seed;
    const log: { candidates: Record<string, readonly string[]>; pairings: readonly Pairing[] }[] = [];
    for (let round = 0; round < rounds; round++) {
      const candidates = planCandidates(alive, history);
      const plan = planPairings(alive, rng, `r${round}`, history);
      for (const pairing of plan.pairings) {
        const opponent = pairing.opponent.kind === 'seat' ? pairing.opponent.seatId : pairing.opponent.sourceSeatId;
        expect(candidates[pairing.seatId]).toContain(opponent);
      }
      log.push({ candidates, pairings: plan.pairings });
      history = recordPairings(history, plan.pairings); rng = plan.rngState;
    }
    return { log, history };
  }
  it.each([8, 7, 6, 5, 4, 3, 2])('%i survivors over 12 rounds: the real opponent is always a shown candidate', count => {
    const { log } = play(ids(count), 12, 2026);
    for (const { pairings } of log) {
      expect(pairings.map(pairing => pairing.seatId).sort()).toEqual(ids(count).sort());
      expect(pairings.filter(pairing => pairing.opponent.kind === 'mirror')).toHaveLength(count % 2);
    }
  });
  it('8 survivors: nobody meets one of its last two opponents while others are left', () => {
    const { log } = play(ids(8), 10, 7);
    const seen: Record<string, string[]> = {};
    for (const { pairings } of log) {
      for (const pairing of pairings) {
        const opponent = (pairing.opponent as { seatId: string }).seatId;
        expect((seen[pairing.seatId] ?? []).slice(-2)).not.toContain(opponent);
      }
      for (const pairing of pairings) (seen[pairing.seatId] ??= []).push((pairing.opponent as { seatId: string }).seatId);
    }
  });
  it('odd survivors draw the mirror source from the odd seat\'s candidates', () => {
    const alive = ids(5);
    const history = { s0: ['s1', 's2'], s1: ['s0', 's3'], s2: ['s4', 's0'], s3: ['s4', 's1'], s4: ['s2', 's3'] };
    for (let seed = 1; seed < 40; seed++) {
      const candidates = planCandidates(alive, history);
      const mirror = planPairings(alive, seed, 'r9', history).pairings.find(pairing => pairing.opponent.kind === 'mirror')!;
      expect(candidates[mirror.seatId]).toContain((mirror.opponent as { sourceSeatId: string }).sourceSeatId);
    }
  });
  it('relaxes the window for everybody when the candidate sets admit no pairing', () => {
    // 4 seats, last two rounds s0–s1/s2–s3 then s0–s2/s1–s3: under a 2-round window s0 may only meet s3 and s1 only s2.
    const alive = ids(4);
    const history = { s0: ['s1', 's2'], s1: ['s0', 's3'], s2: ['s3', 's0'], s3: ['s2', 's1'] };
    expect(planCandidates(alive, history)).toEqual({ s0: ['s3'], s1: ['s2'], s2: ['s1'], s3: ['s0'] });
    // Every seat's only candidate is mutual here, so the 2-round window holds.
    const plan = planPairings(alive, 5, 'r3', history).pairings;
    expect(plan.find(pairing => pairing.seatId === 's0')!.opponent).toEqual({ kind: 'seat', seatId: 's3' });
    // A one-sided set (s0 wants only s3, s3 wants only s1) cannot be paired at 2; at 1 (s0:{s1,s3} s1:{s2,s3} s2:{s0,s3}
    // s3:{s0,s1}) s0–s3 leaves s1–s2 (s2 avoids s1) and s1–s3 leaves s0–s2 (s0 avoids s2) → 0: every survivor.
    const lopsided = { s0: ['s1', 's2'], s1: ['s2', 's0'], s2: ['s0', 's1'], s3: ['s0', 's2'] };
    expect(candidateOpponents(alive, 's0', lopsided)).toEqual(['s3']);
    expect(candidateOpponents(alive, 's3', lopsided)).toEqual(['s1']);
    const relaxed = planCandidates(alive, lopsided);
    expect(relaxed).toEqual({ s0: ['s1', 's2', 's3'], s1: ['s0', 's2', 's3'], s2: ['s0', 's1', 's3'], s3: ['s0', 's1', 's2'] });
    // One step is enough when it admits a pairing: at 2, s0/s1/s2 may only meet s3; at 1 s0–s1 and s2–s3 work.
    const oneStep = { s0: ['s1', 's2'], s1: ['s0', 's2'], s2: ['s0', 's1'], s3: ['s0', 's1'] };
    expect(candidateOpponents(alive, 's0', oneStep)).toEqual(['s3']);
    expect(planCandidates(alive, oneStep)).toEqual({ s0: ['s1', 's3'], s1: ['s0', 's3'], s2: ['s0', 's3'], s3: ['s0', 's2'] });
    const paired = planPairings(alive, 11, 'r3', lopsided).pairings;
    for (const pairing of paired) expect(relaxed[pairing.seatId]).toContain((pairing.opponent as { seatId: string }).seatId);
  });
  it('same survivors, history and rng → same plan; an empty history is the plain shuffle', () => {
    const history = { s0: ['s1', 's2'], s3: ['s4'] };
    expect(planPairings(ids(7), 31, 'r5', history)).toEqual(planPairings(ids(7), 31, 'r5', history));
    expect(planPairings(ids(8), 42, 'r1', {})).toEqual(planPairings(ids(8), 42, 'r1'));
    expect(planCandidates(['s0'], {})).toEqual({ s0: [] });
  });
});
