import {expect,it} from 'vitest';
import {drawIndex} from '../src/simulation/orb-layout';
import {ORB_STAGE_PLAN,orbBoxId} from '../src/simulation/content/orbs';
it('v17 uses exact original stage weights and Plus boundaries',()=>{
 expect(ORB_STAGE_PLAN.highOdds).toEqual([630,300,58,10,2]);
 expect(ORB_STAGE_PLAN.stages[0].high.reduce((n,r)=>n+r.weight,0)).toBe(110);
 expect(orbBoxId('gray',2)).toBe('copper');expect(orbBoxId('gray',3)).toBe('copperPlus');
 expect(orbBoxId('blue',3)).toBe('silver');expect(orbBoxId('blue',4)).toBe('silverPlus');
 expect(orbBoxId('gold',3)).toBe('gold');expect(orbBoxId('gold',4)).toBe('goldPlus');
 for(let stage=1;stage<=4;stage++)expect(orbBoxId('prismatic',stage)).toBe('ultraPlus');
});
it('P5 rejection draw consumes the rejected word and keeps the legacy modulo cursor',()=>{
 // Inverse LCG seed: first word 0xffffffff, rejected for size 100.
 const draw=drawIndex({state:653637408,draws:7},100);
 expect(draw).toEqual({index:98,rng:{state:1012239698,draws:9}});
});
