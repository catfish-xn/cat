import { it, expect } from 'vitest';
import { generateShop } from '../src/simulation/shop';
import { shop } from './fixtures/m5/oracle.g2.cjs';

// v22 batch A (approved 10-23): ordinary slots never roll six-costs; one seat-stream draw per shop
// replaces one uniform slot with a six-cost member when hit < clamp(5q). q per round [Lv1-9, Lv10]:
const Q: Record<number, readonly [number, number]> = { 1: [0, 0], 22: [0, 0], 23: [16, 126], 24: [16, 126], 25: [19, 129], 38: [58, 168], 50: [400, 510] };
it('matches independent six-cost seat-stream arithmetic at unlock, late rounds and all levels, including exact integer boundaries',()=>{
  const inverse=(word:bigint)=>((word-1013904223n)*4276115653n%4294967296n+4294967296n)%4294967296n;
  // The first seat word is LCG(seed XOR fnv1a32("opening-encounter-v1/seat/solo/six-cost-shop/1")).
  let hash=2166136261n;const name='opening-encounter-v1/seat/solo/six-cost-shop/1';
  for(let i=0;i<name.length;i++)hash=((hash^BigInt(name.charCodeAt(i)))*16777619n)%4294967296n;
  const seedForHit=(hit:bigint)=>Number(inverse(hit)^hash);
  for(const round of [1,22,23,24,25,38,50])for(let level=1;level<=10;level++){
    const p=Math.min(10000,5*Q[round][level===10?1:0]),cut=BigInt(p)*4294967296n/10000n;
    const seeds=[0,42,0xffffffff,...[0n,cut>0n?cut-1n:0n,cut,cut+1n,4294967295n].map(seedForHit)];
    for(const seed of seeds)expect(generateShop(seed,1,level,round)).toEqual(shop(seed,1,level,false,round,{seed,viktor:false}));
  }
});
