import {afterEach,expect,it,vi} from 'vitest';
import {createMatch,startMatchCombat,stepMatch} from '../../src/simulation/match';
import {restoreMatch,serializeMatch} from '../../src/simulation/serialization';
import * as rewards from '../../src/simulation/g2-3-rewards';
import {G23_BLACK_MARKETS,G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../../src/simulation/content/g2-3-policy';
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

it('all frozen reward descriptors admit their canonical key order without changing sampled atoms',()=>{
 const bundles=[
  ...G23_BLACK_MARKETS.flatMap(m=>m.options.map(o=>({id:o.id,round:1,source:'black-market' as const,tier:m.tier,reward:o.reward}))),
  ...G23_CONQUEROR_CHESTS.flatMap(c=>{
   const full=g23ConquerorReward(c),{Gold:_paid,...escrow}=full;
   return [full,escrow].map(reward=>({id:`g23:conqueror:${c.tier}`,round:1,source:'conqueror' as const,tier:c.tier,reward}));
  }),
 ];
 for(const bundle of bundles){
  const first=rewards.g23RewardAtoms(bundle,42);
  const reversed={...bundle,reward:Object.fromEntries(Object.entries(bundle.reward).reverse())};
  expect(rewards.g23RewardAtoms(reversed,42)).toEqual(first);
  expect(rewards.g23RewardAtoms(JSON.parse(JSON.stringify(bundle)),42)).toEqual(first);
 }
});
it('a warmed atom cache cannot admit an edited descriptor or mutate the frozen source',()=>{
 const bundle={id:'g23:conqueror:4',round:1,source:'conqueror' as const,tier:4,reward:g23ConquerorReward(G23_CONQUEROR_CHESTS[3])};
 const before=JSON.stringify(bundle),atoms=rewards.g23RewardAtoms(bundle,42);
 expect(Object.isFrozen(atoms)).toBe(true);expect(atoms.every(a=>Object.isFrozen(a)&&Object.isFrozen(a.options))).toBe(true);
 expect(()=>rewards.g23RewardAtoms({...bundle,reward:{...bundle.reward,ThreeCostUnit:1000}},42)).toThrow('frozen reward descriptor');
 expect(JSON.stringify(bundle)).toBe(before);expect(rewards.g23RewardAtoms(bundle,42)).toBe(atoms);
});
