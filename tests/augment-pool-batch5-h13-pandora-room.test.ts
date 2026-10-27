import {beforeAll,afterAll,it,expect} from 'vitest';
import {makeRoom,runUntil,claimAllOrbs} from './server/helpers';
import {TwoSidedBattleResolver} from '../src/server/room/two-sided-resolver';
import {restoreSharedOrbSnapshot} from '../src/simulation/shared-pool';
import {requireAugmentFacts} from '../src/simulation/augment-history';
import {ITEM_DEFINITIONS} from '../src/simulation/content/g2-3-item-registry';
const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:76});
let seatId:string;
const match=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
beforeAll(()=>room.start());for(const round of [2,3,4])beforeAll(()=>{runUntil(room,clock,s=>s.round===round&&s.phase==='preparation');});
afterAll(()=>room.dispose());
it('B5-23 room acquires a real offer and directly grants radiant; public claim/combine prepares reroll inputs',()=>{
 for(const seat of room.state.seats){
  for(let slot=-1;slot<3;slot++){
   let s=room.state.seats.find(s=>s.seatId===seat.seatId)!;const c=s.match.pendingChoice!;
   if(slot>=0){expect(room.handle(s.seatId,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot}).ok).toBe(true);s=room.state.seats.find(s=>s.seatId===seat.seatId)!;}
   if(s.match.pendingChoice!.offers.includes('pandoras-items-iii')){seatId=s.seatId;break;}
  }if(seatId)break;
 }
 expect(seatId).toBeDefined();const c=match().pendingChoice!;
 expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'pandoras-items-iii'}).ok).toBe(true);
 expect(match().items.filter(i=>ITEM_DEFINITIONS[i.definitionId].kind==='radiant')).toHaveLength(1);
 claimAllOrbs(room,[seatId]);const cs=match().items.filter(i=>i.location.kind==='inventory'&&ITEM_DEFINITIONS[i.definitionId].kind==='component');expect(cs.length).toBeGreaterThanOrEqual(2);
 expect(room.handle(seatId,{type:'combine',a:cs[0].id,b:cs[1].id}).ok).toBe(true);
});
it('B5-23 room entry rerolls in category; JSON/object restore and independent authority reject changed or absent history',()=>{
 const before=match();runUntil(room,clock,s=>s.round===5&&s.phase==='preparation');const s=match(),authority=room.augmentHistoryAuthority(seatId);
 const fs=requireAugmentFacts(s,'augment-item-transform',5);expect(fs.length).toBeGreaterThan(0);
 for(const f of fs)expect(ITEM_DEFINITIONS[f.outputs[0].definitionId].kind).toBe(ITEM_DEFINITIONS[f.input.definitionId].kind);
 for(const i of before.items.filter(i=>ITEM_DEFINITIONS[i.definitionId].kind==='radiant'))expect(s.items).toContainEqual(i);
 for(const input of [s,JSON.stringify(s)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(s);
 for(const edit of [(x:any)=>{delete x.augmentHistory;},(x:any)=>{x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform').input.definitionId='TFT_Item_ForceOfNature';},(x:any)=>{x.augmentHistory.facts.find((f:any)=>f.kind==='inventory-transform-entry').itemIds=[];}])for(const json of [false,true]){const bad=structuredClone(s);edit(bad);expect(()=>restoreSharedOrbSnapshot(room.state.pool,json?JSON.stringify(bad):bad,authority)).toThrow();}
});
