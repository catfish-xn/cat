import {expect,it} from 'vitest';
import {sampleOrbTemplate,drawIndex} from '../src/simulation/orb-layout';
import {ORB_RULES} from '../src/simulation/content/orbs';
it('P5 frozen cumulative weights match every legacy index, including all requested boundaries',()=>{
 expect(ORB_RULES.openingWeights).toEqual([50,50]);expect(ORB_RULES.equipmentWeights).toEqual([90,9,1]);
 for(const index of [0,49,50,89,90,98,99,...Array.from({length:100},(_,i)=>i)]) {
  expect(sampleOrbTemplate('opening-bonus',index)).toEqual(index<50?{templateId:'component',tier:'blue'}:{templateId:'opening-gold',tier:'gray'});
  expect(sampleOrbTemplate('equipment',index)).toEqual(index<90?{templateId:'blue-pair',tier:'blue'}:index<99?{templateId:'gold-pair',tier:'gold'}:{templateId:'prismatic-standard',tier:'prismatic'});
 }
 expect(()=>sampleOrbTemplate('equipment',100)).toThrow();expect(()=>sampleOrbTemplate('opening-bonus',-1)).toThrow();
});
it('P5 rejection draw consumes the rejected word and keeps the legacy modulo cursor',()=>{
 // Inverse LCG seed: first word 0xffffffff, rejected for size 100.
 const draw=drawIndex({state:653637408,draws:7},100);
 expect(draw).toEqual({index:98,rng:{state:1012239698,draws:9}});
});
