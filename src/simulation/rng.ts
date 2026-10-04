/** lcg32-v1: state is the last generated word, including seed zero. */
export function validateSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be a uint32 integer');
}
export function nextRandom(state: number): { readonly word: number; readonly state: number } {
  const word = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return { word, state: word };
}
