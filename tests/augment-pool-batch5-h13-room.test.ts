import {roomOfferFor} from './server/augment-offer-helpers';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {makeRoom,runUntil,answerOpenChoices} from './server/helpers';
import {TwoSidedBattleResolver} from '../src/server/room/two-sided-resolver';
import {restoreSharedOrbSnapshot,assertSharedPoolConservation} from '../src/simulation/shared-pool';
import {salvageRecipe} from '../src/simulation/augment-pool-batch5-h13-salvage';
import {requireAugmentFacts} from '../src/simulation/augment-history';
import {drainBatch1Gifts} from '../src/simulation/augment-pool-grants';
const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:15});
const seatId='s0',match=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
beforeAll(()=>room.start());
for(let round=2;round<=12;round++)beforeAll(()=>{runUntil(room,clock,s=>s.round===round&&(s.phase==='preparation'||s.roundKind==='supply'));});
afterAll(()=>room.dispose());
function onlineTrip(){const s=match(),authority=room.augmentHistoryAuthority(seatId);for(const input of [s,JSON.stringify(s)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(s);return {s,authority};}
it('B5-20 room choose/equip/sell uses the rules and preserves the shared pool; online authority rejects altered transforms',()=>{
 roomOfferFor(room,seatId,'salvage-bin-plus');const c=match().pendingChoice!;expect(c.offers).toContain('salvage-bin-plus');
 expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'salvage-bin-plus'}).ok).toBe(true);
 const s=match(),item=s.items.find(i=>i.location.kind==='inventory'&&salvageRecipe(i.definitionId))!,unit=s.preparation.units.find(u=>u.team==='player'&&u.definitionId!=='trainer-golem')!;
 expect(room.handle(seatId,{type:'equip',itemId:item.id,unitId:unit.id,slot:0}).ok).toBe(true);
 expect(room.handle(seatId,{type:'sell',unitId:unit.id}).ok).toBe(true);
 const {s:sold,authority}=onlineTrip();expect(requireAugmentFacts(sold,'augment-item-transform',12)[0].outputs.map(i=>i.definitionId)).toEqual(salvageRecipe(item.definitionId));
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,sold)).toThrow('missing independent server authority');
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,sold,JSON.parse(JSON.stringify(authority)))).toThrow('missing independent server authority');
 const snapshot=room.state;expect(room.handle(seatId,{type:'sell',unitId:unit.id}).ok).toBe(false);expect(room.state).toBe(snapshot);
 for(const edit of [(x:any)=>{delete x.augmentHistory;},(x:any)=>{x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform').outputs.pop();},(x:any)=>{x.items.pop();}])for(const json of [false,true]){const bad=structuredClone(sold);edit(bad);expect(()=>restoreSharedOrbSnapshot(room.state.pool,json?JSON.stringify(bad):bad,authority)).toThrow();}
 assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match));
});
it('B5-20 room battle-time bench buy/equip/sell splits once without changing the frozen combat inventory',()=>{
 answerOpenChoices(room);runUntil(room,clock,s=>s.round===12&&s.phase==='battle');
 const before=match(),components=before.items.filter(i=>i.location.kind==='inventory'&&['bow','rod','sword','vest','cloak','tear','belt','gloves'].includes(i.definitionId));
 expect(components.length).toBeGreaterThanOrEqual(2);
 expect(room.handle(seatId,{type:'combine',a:components[0].id,b:components[1].id}).ok).toBe(true);
 const item=match().items.at(-1)!;
 const slot=match().shop.slots.findIndex(o=>o.status==='available'&&!match().preparation.units.some(u=>u.team==='player'&&u.definitionId===o.definitionId));
 expect(slot).toBeGreaterThanOrEqual(0);const serial=match().nextUnitSerial;
 expect(room.handle(seatId,{type:'buy',slot,generation:match().shop.generation}).ok).toBe(true);
 const unit=match().preparation.units.find(u=>u.id===`unit-${serial}`)!;expect(unit.location.kind).toBe('bench');
 expect(room.handle(seatId,{type:'equip',itemId:item.id,unitId:unit.id,slot:0}).ok).toBe(true);
 expect(room.handle(seatId,{type:'sell',unitId:unit.id}).ok).toBe(true);
 expect(requireAugmentFacts(match(),'augment-item-transform',12).find(f=>f.input.id===item.id)!.outputs.map(i=>i.definitionId)).toEqual(salvageRecipe(item.definitionId));
 expect(match().combatInputBasis).toEqual(before.combatInputBasis);onlineTrip();
 assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match));
});
for(const round of [12,13,14,15,16])it(`B5-20 real room round ${round}: fourth PvP pays once and restores`,()=>{
 if(room.state.round<round)runUntil(room,clock,s=>s.round===round&&(s.phase==='preparation'||s.roundKind==='supply'));
 answerOpenChoices(room);runUntil(room,clock,s=>s.round===round&&s.phase==='settlement');
 const s=match(),rows=s.augmentHistory!.facts.filter(f=>f.kind==='settled-combat'&&f.roundKind==='pvp');
 const receipts=s.seatMechanics!.receipts.filter(r=>r.receiptId.includes('h13-four-pvp'));
 expect(rows).toHaveLength(round<14?round-11:round-12);expect(receipts).toHaveLength(round===16?1:0);onlineTrip();
 expect(drainBatch1Gifts(s)).toEqual(s);
 if(round===16){const {authority}=onlineTrip();for(const json of [false,true]){const bad:any=structuredClone(s);bad.augmentHistory.facts.find((f:any)=>f.kind==='settled-combat').roundKind='pve';expect(()=>restoreSharedOrbSnapshot(room.state.pool,json?JSON.stringify(bad):bad,authority)).toThrow();}}
});
