import {it,expect,vi} from 'vitest';
import {createMatch} from '../../src/simulation/match';
import {restoreMatch} from '../../src/simulation/serialization';
import * as rewardModule from '../../src/simulation/g2-3-rewards';
it('unverified reward quantity creates 1000 atoms before restoration eventually rejects it',()=>{
 const legal=createMatch(42);expect(restoreMatch(legal)).toEqual(legal);
 const forged=structuredClone(legal);
 const conqueror=forged.seatMechanics!.seat.conqueror as unknown as {rewards:unknown[]};
 conqueror.rewards=[{id:'audit-unearned-large-reward',round:1,source:'conqueror',tier:1,reward:{ThreeCostUnit:1000}}];
 const original=rewardModule.g23RewardAtoms;let produced=0;
 const spy=vi.spyOn(rewardModule,'g23RewardAtoms').mockImplementation((bundle,seed)=>{
  const result=original(bundle,seed);
  if(bundle.id==='audit-unearned-large-reward')produced=result.length;
  return result;
 });
 try {expect(()=>restoreMatch(forged)).toThrow();expect(produced).toBe(1000);}finally{spy.mockRestore();}
});
