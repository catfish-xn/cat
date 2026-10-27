import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeRoom, runUntil } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { readAugmentGrowth } from '../../src/simulation/augment-history';
import { snapshotForBattle } from '../../src/simulation/two-sided-snapshot';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';

const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:1});
const mine=()=>room.state.seats.find(s=>s.seatId==='s3')!;
let fighterId:string;
beforeAll(()=>room.start());
for(const round of ['1-3','1-4','2-1'])beforeAll(()=>{runUntil(room,clock,s=>s.roundId===round&&s.phase==='preparation');});
beforeAll(()=>{
 const choice=mine().match.pendingChoice!;expect(choice.offers).toContain('no-scout-no-pivot');
 expect(room.handle('s3',{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'no-scout-no-pivot'})).toMatchObject({ok:true});
});
beforeAll(()=>{runUntil(room,clock,s=>s.roundId==='2-1'&&s.phase==='settlement');});
afterAll(()=>room.dispose());
it('No Scout uses a real room choice, PvP roster and settlement',()=>{
 const match=mine().match,fact=match.augmentHistory!.facts.find(f=>f.kind==='pvp-roster'&&f.round===match.round)!;
 expect(fact.kind).toBe('pvp-roster');if(fact.kind!=='pvp-roster')throw new Error('missing roster');
 const fighter=fact.seats.find(s=>s.seatId==='s3')!.units.find(u=>u.location.kind==='board')!;
 expect(fighter).toBeDefined();fighterId=fighter.id;
 expect(readAugmentGrowth(match,fighter.id)).toMatchObject({healthFlat:20,attackDamageBps:150,abilityPowerCenti:150});
 expect(room.state.fault).toBeNull();
});
it('room snapshots restore only against independent authority and reject altered growth',()=>{
 const match=mine().match,authority=room.augmentHistoryAuthority('s3');
 for(const input of [match,JSON.stringify(match)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(match);
 const forged=structuredClone(match) as any;forged.augmentHistory.facts.find((f:any)=>f.kind==='growth').deltas[0].healthFlat++;
 for(const input of [forged,JSON.stringify(forged)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority)).toThrow();
});
describe('next round',()=>{
 beforeAll(()=>{runUntil(room,clock,s=>s.roundId==='2-2'&&s.phase==='preparation');});
 it('refuses selling and benching the fighter through the room',()=>{
  expect(room.handle('s3',{type:'sell',unitId:fighterId})).toMatchObject({ok:false,reason:'unit-not-sellable'});
  const occupied=new Set(mine().match.preparation.units.flatMap(u=>u.location.kind==='bench'?[u.location.slot]:[]));
  const slot=Array.from({length:mine().match.preparation.benchSize},(_,i)=>i).find(i=>!occupied.has(i))!;expect(slot).toBeDefined();
  expect(room.handle('s3',{type:'deploy',unitId:fighterId,target:{kind:'bench',slot}})).toMatchObject({ok:false,reason:'unit-not-sellable'});
  expect(room.state.fault).toBeNull();
 });
 it('carries the authenticated growth into the next online combat snapshot',()=>{
  const snapshot=snapshotForBattle(mine().match,'s3');
  expect(snapshot.augmentHistoryGrowth).toContainEqual({unitId:fighterId,healthFlat:20,healthBps:0,attackDamageBps:150,abilityPowerCenti:150});
 });
});
