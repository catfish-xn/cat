import { it, expect } from 'vitest';
import { generateShop } from '../src/simulation/shop';
import { shop } from './fixtures/m5/oracle.g2.cjs';

it('matches independent six-cost cost-interval arithmetic at unlock, late rounds and all levels, including exact integer boundaries',()=>{
  const inverse=(word:bigint)=>Number(((word-1013904223n)*4276115653n%4294967296n+4294967296n)%4294967296n);
  for(const round of [1,22,23,24,38,50])for(let level=1;level<=10;level++){
    const p=round<23?0:20+(round-23)*4+(level===10?160:0),cut=BigInt(p)*4294967296n/10000n;
    const seeds=[0,42,0xffffffff,...[0n,cut>0?cut-1n:0n,cut,cut+1n,4294967295n].map(inverse)];
    for(const seed of seeds)expect(generateShop(seed,1,level,round)).toEqual(shop(seed,1,level,false,round));
  }
});
