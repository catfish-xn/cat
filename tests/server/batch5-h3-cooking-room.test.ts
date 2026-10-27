import { afterAll, beforeAll, expect, it } from 'vitest';
import { makeRoom, runUntil } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { readAugmentGrowth, requireAugmentFacts } from '../../src/simulation/augment-history';
import { snapshotForBattle } from '../../src/simulation/two-sided-snapshot';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';

// First integrated-pool seed offering the card to s2 within two rerolls.
const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:1});
const mine=()=>room.state.seats.find(s=>s.seatId==='s2')!.match;
let target:string;
beforeAll(()=>room.start());
for(const round of ['1-3','1-4','2-1'])beforeAll(()=>{runUntil(room,clock,s=>s.roundId===round&&s.phase==='preparation');});
beforeAll(()=>{
 for(let slot=0;slot<2&&!mine().pendingChoice!.offers.includes('cooking-pot');slot++){const c=mine().pendingChoice!;expect(room.handle('s2',{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot})).toMatchObject({ok:true});}
 const c=mine().pendingChoice!;expect(c.offers).toContain('cooking-pot');
 expect(room.handle('s2',{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'cooking-pot'})).toMatchObject({ok:true});
 const pan=mine().items.find(i=>i.definitionId==='frying-pan'&&i.location.kind==='inventory');expect(pan).toBeDefined();
 const slot=mine().shop.slots.findIndex(o=>o.status==='available'&&UNIT_DEFINITIONS[o.definitionId].cost<=mine().gold);expect(slot).toBeGreaterThanOrEqual(0);
 expect(room.handle('s2',{type:'buy',slot,generation:mine().shop.generation})).toMatchObject({ok:true});
 const units=mine().preparation.units.filter(u=>u.team==='player'&&UNIT_DEFINITIONS[u.definitionId]&&!UNIT_DEFINITIONS[u.definitionId].summon&&UNIT_DEFINITIONS[u.definitionId].unitKind!=='neutral');expect(units.length).toBeGreaterThanOrEqual(2);
 for(let i=0;i<2;i++){const result=room.handle('s2',{type:'deploy',unitId:units[i].id,target:{kind:'board',cell:{col:2+i,row:4}}});expect(result,result.ok?'':result.reason).toMatchObject({ok:true});}
 expect(room.handle('s2',{type:'equip',itemId:pan!.id,unitId:units[0].id,slot:0})).toMatchObject({ok:true});target=units[1].id;
});
beforeAll(()=>{runUntil(room,clock,s=>s.roundId==='2-1'&&s.phase==='settlement');});
beforeAll(()=>{runUntil(room,clock,s=>s.roundId==='2-2'&&s.phase==='preparation');});
afterAll(()=>room.dispose());
it('room entry records the held pan and grants the adjacent champion 50 HP once',()=>{
 const s=mine();expect(requireAugmentFacts(s,'round-entry',s.round)).toHaveLength(1);
 expect(readAugmentGrowth(s,target)).toMatchObject({healthFlat:50,attackDamageBps:0,abilityPowerCenti:0});
 expect(s.augmentHistory!.facts.filter(f=>f.kind==='growth'&&f.round===s.round)).toHaveLength(1);expect(room.state.fault).toBeNull();
 expect(snapshotForBattle(s,'s2').augmentHistoryGrowth).toContainEqual({unitId:target,healthFlat:50,healthBps:0,attackDamageBps:0,abilityPowerCenti:0});
});
it('server restore uses independent authority and rejects a forged entry',()=>{
 const s=mine(),authority=room.augmentHistoryAuthority('s2');
 for(const input of [s,JSON.stringify(s)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(s);
 const bad=structuredClone(s) as any;bad.augmentHistory.facts.find((f:any)=>f.kind==='growth').deltas[0].healthFlat++;
 for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority)).toThrow();
});
