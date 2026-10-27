import { checkStarryRoom, checkStarryRules } from './fixtures/batch5-r5-checks';
import { expect, it } from 'vitest';
import { starryChanceBps, starryUpgrade } from '../src/simulation/augment-pool-batch5-r5';
import { createMatch } from '../src/simulation/match';
checkStarryRules('starry-night-plus');
checkStarryRoom('starry-night-plus',11,'s2');
it('the plus variant changes only the acquisition gold, never the upgrade probability or draw',()=>{
 const base=createMatch(2,{mode:'shared-deferred'});
 for(let level=1;level<=10;level++){
  const normal={...base,level,augments:[{definitionId:'starry-night',choiceId:'same-choice',acquiredRound:1}]};
  const plus={...normal,augments:[{...normal.augments[0],definitionId:'starry-night-plus'}]};
  expect(starryChanceBps(plus)).toBe(starryChanceBps(normal));
  for(let generation=1;generation<=8;generation++)for(let slot=0;slot<5;slot++)for(const id of ['irelia','rell'])
   expect(starryUpgrade(plus,generation,slot,id)).toBe(starryUpgrade(normal,generation,slot,id));
 }
});
