/**
 * PvP pairing for one round. Deterministic: the same survivors and rng state always
 * produce the same pairings. Nobody fights themself and nobody appears twice; with an
 * odd number of survivors exactly one seat fights the frozen mirror of another survivor
 * (V2 D6: the mirror only affects the tested seat; the source is not a participant).
 */
import { nextRandom } from '../../simulation/rng';
import type { Pairing } from './types';

export interface PairingPlan { readonly pairings: readonly Pairing[]; readonly rngState: number }

/** Uniform-enough index draw: the high half of the lcg word, the low bits cycle. */
function drawIndex(rngState: number, bound: number): { readonly index: number; readonly state: number } {
  const draw = nextRandom(rngState);
  return { index: (draw.word >>> 16) % bound, state: draw.state };
}

export function planPairings(aliveSeatIds: readonly string[], rngState: number, battleIdPrefix: string): PairingPlan {
  if (new Set(aliveSeatIds).size !== aliveSeatIds.length) throw new RangeError('duplicate seat id');
  if (aliveSeatIds.length < 2) return { pairings: [], rngState };
  const order = [...aliveSeatIds];
  let state = rngState;
  // Fisher-Yates with the room's rng.
  for (let i = order.length - 1; i > 0; i--) {
    const draw = drawIndex(state, i + 1); state = draw.state;
    [order[i], order[draw.index]] = [order[draw.index]!, order[i]!];
  }
  const pairings: Pairing[] = [];
  let battle = 0;
  for (let i = 0; i + 1 < order.length; i += 2) {
    const battleId = `${battleIdPrefix}:b${battle++}`;
    pairings.push({ battleId, seatId: order[i]!, opponent: { kind: 'seat', seatId: order[i + 1]! } });
    pairings.push({ battleId, seatId: order[i + 1]!, opponent: { kind: 'seat', seatId: order[i]! } });
  }
  if (order.length % 2 === 1) {
    const odd = order[order.length - 1]!;
    const sources = aliveSeatIds.filter(seatId => seatId !== odd);
    const draw = drawIndex(state, sources.length); state = draw.state;
    pairings.push({ battleId: `${battleIdPrefix}:b${battle}`, seatId: odd, opponent: { kind: 'mirror', sourceSeatId: sources[draw.index]! } });
  }
  return { pairings, rngState: state };
}

/** The pairing row of one seat, if it fights this round. */
export function findPairing(pairings: readonly Pairing[], seatId: string): Pairing | null {
  return pairings.find(pairing => pairing.seatId === seatId) ?? null;
}
