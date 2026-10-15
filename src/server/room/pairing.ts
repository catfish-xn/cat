/**
 * PvP pairing for one round. Deterministic: the same survivors, history and rng state always
 * produce the same pairings. Nobody fights themself and nobody appears twice; with an odd
 * number of survivors exactly one seat fights the frozen mirror of another survivor
 * (V2 D6: the mirror only affects the tested seat; the source is not a participant).
 *
 * G1-P6 (pairing preview): during preparation every seat sees its possible opponents
 * (`candidateOpponents`); the real pairing is drawn only when the round freezes, inside those
 * candidates. The policy is a placeholder (`avoidRecentRounds: 2`) until the rules side fixes
 * the 14.24b definition (docs/S13_RULES_GAP.md §10); only the number changes then.
 */
import { nextRandom } from '../../simulation/rng';
import type { Pairing } from './types';

export interface PairingPlan { readonly pairings: readonly Pairing[]; readonly rngState: number }
export interface PairingPolicy {
  /** Opponents of this many most recent PvP rounds are avoided; relaxed one round at a time when nobody is left. */
  readonly avoidRecentRounds: number;
}
/** Placeholder until S13_RULES_GAP §10 lands (see the file comment). */
export const DEFAULT_PAIRING_POLICY: PairingPolicy = { avoidRecentRounds: 2 };
/**
 * Per seat, the opponents of its past PvP rounds, oldest first. A mirror battle is recorded under the
 * mirror's source for the seat that fought it; the source itself records only its own real opponent.
 * PvE and supply rounds record nothing.
 */
export type PairingHistory = Readonly<Record<string, readonly string[]>>;
/** Entries kept per seat; far above any avoidance span the policy may use. */
export const PAIRING_HISTORY_LIMIT = 8;
/** Possible opponents of every alive seat this round, by seat id (see `planCandidates`). */
export type CandidateMap = Readonly<Record<string, readonly string[]>>;

/** Uniform-enough index draw: the high half of the lcg word, the low bits cycle. */
function drawIndex(rngState: number, bound: number): { readonly index: number; readonly state: number } {
  const draw = nextRandom(rngState);
  return { index: (draw.word >>> 16) % bound, state: draw.state };
}

function assertUnique(aliveSeatIds: readonly string[]): void {
  if (new Set(aliveSeatIds).size !== aliveSeatIds.length) throw new RangeError('duplicate seat id');
}

/**
 * Possible opponents of one seat, in the order of `aliveSeatIds` (never itself, only alive seats): every survivor
 * it has not fought in its last `avoidRecentRounds` PvP rounds; when that leaves nobody, the span shrinks one
 * round at a time; with a span of 0 every other survivor is a candidate.
 */
export function candidateOpponents(aliveSeatIds: readonly string[], seatId: string, history: PairingHistory, policy: PairingPolicy = DEFAULT_PAIRING_POLICY): string[] {
  const others = aliveSeatIds.filter(candidate => candidate !== seatId);
  const past = history[seatId] ?? [];
  for (let span = Math.max(0, Math.trunc(policy.avoidRecentRounds)); span > 0; span--) {
    const recent = new Set(past.slice(-span));
    const left = others.filter(candidate => !recent.has(candidate));
    if (left.length > 0) return left;
  }
  return others;
}

/** a and b may fight each other: each is a candidate of the other. */
const mutual = (candidates: CandidateMap, a: string, b: string): boolean => (candidates[a]?.includes(b) ?? false) && (candidates[b]?.includes(a) ?? false);

/**
 * Pairs `order` under `candidates`: the first open seat takes the first allowed open seat after it, backtracking when
 * the rest cannot be paired; with an odd count one seat (the latest possible in `order`) is left for the mirror.
 * Returns the pairs and the left-out seat, or null when no arrangement exists.
 */
function arrange(order: readonly string[], candidates: CandidateMap): { readonly pairs: readonly (readonly [string, string])[]; readonly odd: string | null } | null {
  const open = new Set(order);
  const pairs: (readonly [string, string])[] = [];
  let odd: string | null = null;
  const solve = (): boolean => {
    const first = order.find(seatId => open.has(seatId));
    if (first === undefined) return true;
    open.delete(first);
    for (const partner of order) {
      if (!open.has(partner) || !mutual(candidates, first, partner)) continue;
      open.delete(partner); pairs.push([first, partner]);
      if (solve()) return true;
      pairs.pop(); open.add(partner);
    }
    // Odd count: this seat sits out (fights a mirror) if the others can still be paired among themselves.
    if (order.length % 2 === 1 && odd === null) {
      odd = first;
      if (solve()) return true;
      odd = null;
    }
    open.add(first);
    return false;
  };
  return solve() ? { pairs, odd } : null;
}

/**
 * The candidates the room shows and pairs under this round: each seat's `candidateOpponents` under the policy; when
 * those sets admit no full pairing, the span shrinks for everybody one round at a time (2 → 1 → 0), so the real
 * opponent drawn at the freeze is always one of the candidates the seat was shown. No rng is used.
 */
export function planCandidates(aliveSeatIds: readonly string[], history: PairingHistory, policy: PairingPolicy = DEFAULT_PAIRING_POLICY): CandidateMap {
  assertUnique(aliveSeatIds);
  const build = (span: number): CandidateMap =>
    Object.fromEntries(aliveSeatIds.map(seatId => [seatId, candidateOpponents(aliveSeatIds, seatId, history, { avoidRecentRounds: span })] as const));
  for (let span = Math.max(0, Math.trunc(policy.avoidRecentRounds)); span > 0; span--) {
    const candidates = build(span);
    if (aliveSeatIds.length < 2 || arrange(aliveSeatIds, candidates)) return candidates;
  }
  return build(0);
}

/**
 * Shuffles the survivors with the room's rng, then pairs them inside `planCandidates(history, policy)`; the odd seat's
 * mirror source is drawn from its own candidates. With an empty history this is exactly the unconstrained shuffle.
 */
export function planPairings(aliveSeatIds: readonly string[], rngState: number, battleIdPrefix: string, history: PairingHistory = {}, policy: PairingPolicy = DEFAULT_PAIRING_POLICY): PairingPlan {
  assertUnique(aliveSeatIds);
  if (aliveSeatIds.length < 2) return { pairings: [], rngState };
  const candidates = planCandidates(aliveSeatIds, history, policy);
  const order = [...aliveSeatIds];
  let state = rngState;
  // Fisher-Yates with the room's rng.
  for (let i = order.length - 1; i > 0; i--) {
    const draw = drawIndex(state, i + 1); state = draw.state;
    [order[i], order[draw.index]] = [order[draw.index]!, order[i]!];
  }
  // planCandidates guarantees an arrangement exists for any order; the plain fallback only guards a broken invariant.
  const arranged = arrange(order, candidates) ?? arrange(order, planCandidates(aliveSeatIds, {}, { avoidRecentRounds: 0 }))!;
  const pairings: Pairing[] = [];
  let battle = 0;
  for (const [a, b] of arranged.pairs) {
    const battleId = `${battleIdPrefix}:b${battle++}`;
    pairings.push({ battleId, seatId: a, opponent: { kind: 'seat', seatId: b } });
    pairings.push({ battleId, seatId: b, opponent: { kind: 'seat', seatId: a } });
  }
  if (arranged.odd !== null) {
    const odd = arranged.odd;
    const sources = candidates[odd]!;
    const draw = drawIndex(state, sources.length); state = draw.state;
    pairings.push({ battleId: `${battleIdPrefix}:b${battle}`, seatId: odd, opponent: { kind: 'mirror', sourceSeatId: sources[draw.index]! } });
  }
  return { pairings, rngState: state };
}

/** Appends this round's opponents (mirror: its source) to every paired seat's history, keeping the last PAIRING_HISTORY_LIMIT. */
export function recordPairings(history: PairingHistory, pairings: readonly Pairing[]): PairingHistory {
  if (pairings.length === 0) return history;
  const next: Record<string, readonly string[]> = { ...history };
  for (const pairing of pairings) {
    const opponent = pairing.opponent.kind === 'seat' ? pairing.opponent.seatId : pairing.opponent.sourceSeatId;
    next[pairing.seatId] = [...(history[pairing.seatId] ?? []), opponent].slice(-PAIRING_HISTORY_LIMIT);
  }
  return next;
}

/** The pairing row of one seat, if it fights this round. */
export function findPairing(pairings: readonly Pairing[], seatId: string): Pairing | null {
  return pairings.find(pairing => pairing.seatId === seatId) ?? null;
}
