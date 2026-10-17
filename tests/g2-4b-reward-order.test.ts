import {expect,it} from 'vitest';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {G23_BLACK_MARKETS,G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import type {G23RewardBundle} from '../src/simulation/g2-3-economy';

it('source descriptor order survives canonical/reversed keys on cache misses and hits across every reward',()=>{
 const bundles:G23RewardBundle[]=[
  ...G23_CONQUEROR_CHESTS.map(chest=>{
   const {Gold:_gold,...reward}=g23ConquerorReward(chest);
   return {id:`g23:conqueror:${chest.tier}`,round:8,source:'conqueror' as const,tier:chest.tier,reward};
  }),
  ...G23_BLACK_MARKETS.flatMap(m=>m.options.map(o=>({id:`g23:market:${o.id}`,round:8,source:'black-market' as const,tier:m.tier,reward:o.reward}))),
 ];
 for(const [index,bundle] of bundles.entries()){
  // IDs don't depend on round: establish a source-order oracle under a different
  // cache key, then populate the real key with reordered descriptors first.
  const seed=0x5a240000+index,expected=g23RewardAtoms({...bundle,round:7},seed);
  for(const entries of [Object.entries(bundle.reward).reverse(),Object.entries(bundle.reward).sort(([a],[b])=>a.localeCompare(b))]){
   expect(g23RewardAtoms({...bundle,reward:Object.fromEntries(entries)},seed)).toEqual(expected);
  }
  expect(g23RewardAtoms(bundle,seed)).toEqual(expected);
  if(bundle.source==='conqueror'&&bundle.tier===4)expect(expected.map(a=>a.kind)).toEqual(['unit','duplicator']);
  if(bundle.source==='conqueror'&&bundle.tier===14)expect(expected.map(a=>[a.kind,a.options.length])).toEqual([['item',1],['item',4],['tool',1]]);
 }
});
