import {afterEach,expect,it,vi} from 'vitest';
import {createMatch,startMatchCombat,stepMatch} from '../../src/simulation/match';
import {restoreMatch,serializeMatch} from '../../src/simulation/serialization';
import * as rewards from '../../src/simulation/g2-3-rewards';
import {G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../../src/simulation/content/g2-3-policy';
afterEach(()=>vi.restoreAllMocks());
it.each(['ThreeCostUnit','FourCostUnit','FiveCostUnit'])('rejects a forged %s count before invoking any atom expansion',key=>{
 const state=structuredClone(createMatch(42));
 Object.assign(state.seatMechanics!.seat.conqueror!,{rewards:[{id:'g23:conqueror:4',round:1,source:'conqueror',tier:4,reward:{[key]:1000}}]});
 const spy=vi.spyOn(rewards,'g23RewardAtoms');
 for(const input of [state,JSON.stringify(state)])expect(()=>restoreMatch(input)).toThrow('G23 reward authority');
 expect(spy).not.toHaveBeenCalled();
});
it('atom preview itself admits only the frozen tier descriptor before sampling',()=>{
 for(const value of [1000,Number.MAX_SAFE_INTEGER,-1])expect(()=>rewards.g23RewardAtoms({id:'g23:conqueror:4',round:1,source:'conqueror',tier:4,reward:{ThreeCostUnit:value}},42)).toThrow('frozen reward descriptor');
});
it.each(['id','tier','source','round'])('rejects an unearned frozen bundle with forged %s before expansion',key=>{
 const state=structuredClone(createMatch(42)),{Gold:_paid,...reward}=g23ConquerorReward(G23_CONQUEROR_CHESTS[3]);
 const bundle={id:'g23:conqueror:4',round:1,source:'conqueror',tier:4,reward};
 Object.assign(bundle,{[key]:key==='tier'?3:key==='round'?2:key==='source'?'black-market':'different'});
 Object.assign(state.seatMechanics!.seat.conqueror!,{rewards:[bundle]});
 const spy=vi.spyOn(rewards,'g23RewardAtoms');
 expect(()=>restoreMatch(JSON.stringify(state))).toThrow('G23 reward authority');expect(spy).not.toHaveBeenCalled();
});
it('legal public settlement still restores with its regenerated reward authority',()=>{
 let state=startMatchCombat(createMatch(42)).state;while(state.phase==='combat')state=stepMatch(state).state;
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
});
