import { nextRandom, validateSeed } from './rng';
/** Isolated, reproducible lcg32-v1 substream. No Match RNG is advanced. */
export function openingSeatDraw(seed:number, seat:string, effect:string):()=>number {
 validateSeed(seed);
 const name=`opening-encounter-v1/seat/${seat}/${effect}`;
 let hash=0x811c9dc5;
 for(let i=0;i<name.length;i++)hash=Math.imul(hash^name.charCodeAt(i),0x01000193)>>>0;
 let rng=(seed^hash)>>>0;
 return ()=>{const d=nextRandom(rng);rng=d.state;return d.word;};
}
export function weightedOpeningIndex(word:number,weights:readonly number[]):number {
 validateSeed(word);
 let ticket=Math.floor(word*10000/4294967296);
 for(let i=0;i<weights.length;i++){ticket-=weights[i];if(ticket<0)return i;}
 throw new RangeError('Invalid opening weights');
}
