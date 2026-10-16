import { OPENING_INITIAL_STATE, SHOP_CATALOG_BY_COST } from './match-rules';
import { nextRandom, validateSeed } from './rng';

/** Independent one-word lcg32-v1 stream; UTF-16 FNV-1a namespace derivation. */
export function selectOpeningUnit(seed: number, seatId = 'solo'): string {
  validateSeed(seed);
  if (typeof seatId !== 'string' || seatId.length === 0) throw new RangeError('Invalid opening seat');
  let hash = 0x811c9dc5;
  const name = `opening-unit-v1/${seatId}`;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 0x01000193) >>> 0;
  const state = (seed ^ hash ^ OPENING_INITIAL_STATE.unit.definitionId.seedXor) >>> 0;
  return SHOP_CATALOG_BY_COST[1][Math.floor(nextRandom(state).word * SHOP_CATALOG_BY_COST[1].length / 4294967296)];
}
