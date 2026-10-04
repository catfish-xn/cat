import { nextRandom } from './rng';
/** Exactly three LCG words, independent of pool size and UI refreshes. */
export function generateChoices(ids: readonly string[], rngState: number): { offers: string[]; choiceRngState: number } {
  const pool = [...ids].sort();
  if (pool.length < 3 || new Set(pool).size !== pool.length) throw new Error('Choice pool must contain at least three unique IDs');
  for (let i = 0; i < 3; i++) {
    const draw = nextRandom(rngState); rngState = draw.state;
    const j = i + draw.word % (pool.length - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { offers: pool.slice(0, 3), choiceRngState: rngState };
}
