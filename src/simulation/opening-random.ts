import { nextRandom, validateSeed } from './rng';
/** Existing opening stream derivation; no legacy stream is consumed. */
export function openingWords(seed: number, path: string, count: number): number[] {
  validateSeed(seed);
  const name = `opening-encounter-v1/${path}`;
  let hash = 0x811c9dc5;
  for (let i=0;i<name.length;i++) hash=Math.imul(hash^name.charCodeAt(i),0x01000193)>>>0;
  let rng=(seed^hash)>>>0;
  return Array.from({length:count},()=>{const d=nextRandom(rng);rng=d.state;return d.word;});
}
export function openingWeightedIndex(word: number, weights: readonly number[]): number {
  validateSeed(word);
  let ticket=Math.floor(word*weights.reduce((a,b)=>a+b,0)/4294967296);
  for(let i=0;i<weights.length;i++){if(ticket<weights[i])return i;ticket-=weights[i];}
  throw new RangeError('Invalid opening weights');
}
