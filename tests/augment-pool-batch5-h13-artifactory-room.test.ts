import {beforeAll,afterAll,it,expect} from 'vitest';
import {makeRoom,runUntil,claimAllOrbs} from './server/helpers';
import {TwoSidedBattleResolver} from '../src/server/room/two-sided-resolver';
import {restoreSharedOrbSnapshot} from '../src/simulation/shared-pool';
import {requireAugmentFacts} from '../src/simulation/augment-history';
import {ITEM_DEFINITIONS} from '../src/simulation/content/items';
import {G24_FORGE_POOLS} from '../src/simulation/content/g2-4-forges';
const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:28});
const seatId='s0',match=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
beforeAll(()=>room.start());
for(let round=2;round<=12;round++)beforeAll(()=>{runUntil(room,clock,s=>s.round===round&&(s.phase==='preparation'||s.roundKind==='supply'));});
afterAll(()=>room.dispose());
let originalId:string;
it('B5-22 room chooses, claims components and combines through public commands',()=>{
 const hp=match().playerHp;
 let c=match().pendingChoice!;
 for (const slot of [0,1,2]) {
  if (c.offers.includes('artifactory')) break;
  expect(room.handle(seatId,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot}).ok).toBe(true);
  c=match().pendingChoice!;
 }
 expect(c.offers).toContain('artifactory');
 expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'artifactory'}).ok).toBe(true);
 expect(match().consumables.filter(c=>c.definitionId==='magnetic-remover').length).toBeGreaterThanOrEqual(2);
 expect(match().playerHp).toBe(hp);
 const anvil=match().preparation.units.find(u=>u.definitionId==='TFT_ArmoryKeyOrnn')!;
 expect(anvil).toBeDefined();expect(room.handle(seatId,{type:'openAnvil',unitId:anvil.id}).ok).toBe(true);
 c=match().pendingChoice!;expect(c.offers).toHaveLength(4);
 expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]}).ok).toBe(true);
 claimAllOrbs(room,[seatId]);
 const components=match().items.filter(i=>i.location.kind==='inventory'&&ITEM_DEFINITIONS[i.definitionId]?.kind==='component');expect(components.length).toBeGreaterThanOrEqual(2);
 expect(room.handle(seatId,{type:'combine',a:components[0].id,b:components[1].id}).ok).toBe(true);originalId=match().items.at(-1)!.id;
 const holder=match().preparation.units.find(u=>u.team==='player'&&u.definitionId!=='trainer-golem')!;
 expect(room.handle(seatId,{type:'equip',itemId:originalId,unitId:holder.id,slot:0}).ok).toBe(true);
 const remover=match().consumables.find(c=>c.definitionId==='magnetic-remover')!;
 expect(room.handle(seatId,{type:'useConsumable',consumableId:remover.consumableId,target:{kind:'unit',unitId:holder.id}}).ok).toBe(true);
 expect(match().items.find(i=>i.id===originalId)!.location.kind).toBe('inventory');
 expect(match().consumables.some(c=>c.consumableId===remover.consumableId)).toBe(false);
});
it('B5-22 room round advancement performs conversion and independent authority verifies both online restore entries',()=>{
 runUntil(room,clock,s=>s.round===13&&s.phase==='preparation');const s=match(),authority=room.augmentHistoryAuthority(seatId);
 const f=requireAugmentFacts(s,'augment-item-transform',13).find(f=>f.input.id===originalId)!;
 expect(f).toBeDefined();expect(G24_FORGE_POOLS.TFT_ArmoryKeyOrnn).toContain(f.outputs[0].definitionId);
 for(const input of [s,JSON.stringify(s)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(s);
 for(const edit of [(x:any)=>{delete x.augmentHistory;},(x:any)=>{x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform').outputs[0].definitionId='sword';},(x:any)=>{x.augmentHistory.facts.find((f:any)=>f.kind==='inventory-transform-entry').itemIds=[];}])for(const json of [false,true]){const bad=structuredClone(s);edit(bad);expect(()=>restoreSharedOrbSnapshot(room.state.pool,json?JSON.stringify(bad):bad,authority)).toThrow();}
});
