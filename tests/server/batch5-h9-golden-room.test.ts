import {HISTORY_AUGMENT_ROOM_ROUTES} from '../augment-stage-helpers';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {Room,ROOM_TIMING_DEFAULTS} from '../../src/server/room/room';
import {ManualClock} from '../../src/server/room/clock';
import {TwoSidedBattleResolver} from '../../src/server/room/two-sided-resolver';
import {runUntil} from './helpers';
import {freeRerollsAvailable} from '../../src/simulation/free-rerolls';
import {requireAugmentFacts} from '../../src/simulation/augment-history';
import {restoreSharedOrbSnapshot,assertSharedPoolConservation} from '../../src/simulation/shared-pool';
import {claimAllOrbs,answerOpenChoices} from './helpers';
import {goldenFindGoldPlan,GOLDEN_FIND_SOURCE} from '../../src/simulation/augment-pool-batch5-h9';
for(const streaming of [false,true])describe(`a-golden-find streaming=${streaming}`,()=>{
const clock=new ManualClock();
const room=new Room(Array.from({length:8},(_,i)=>({seatId:`s${i}`,name:`s${i}`,kind:'human' as const})),
 {...ROOM_TIMING_DEFAULTS,combatStreaming:streaming,preparationMs:1000,choiceMs:500,settlementMs:200,battleTailMs:100,maxSettlementExtensions:2,roomId:'h9',seed:HISTORY_AUGMENT_ROOM_ROUTES['a-golden-find'].seed,clock,resolver:new TwoSidedBattleResolver()});
let anomalyTarget='unit-1';
const mine=()=>room.state.seats[0].match;
beforeAll(()=>room.start());
for(const round of [2,3,4,5,6,8,9,10,11,12,13,15,16,17,18,19])beforeAll(()=>runUntil(room,clock,s=>s.round===round&&s.phase==='preparation'));
afterAll(()=>room.dispose());
it('room choose and reroll use the real Golden Find credits and record authoritative two-sided kills',()=>{
 const c=mine().pendingChoice!;expect(c.offers).toContain('a-golden-find');
 expect(room.handle('s0',{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'a-golden-find'})).toMatchObject({ok:true});
 expect(freeRerollsAvailable(mine())).toBe(10);const before=mine();
 expect(room.handle('s0',{type:'reroll'})).toMatchObject({ok:true});expect(mine().gold).toBe(before.gold);expect(freeRerollsAvailable(mine())).toBe(9);
});
it('settles actual room PvP and authenticates attributed deaths against independent room authority',()=>{
 runUntil(room,clock,s=>s.round===19&&s.phase==='settlement');
 expect(room.state.fault).toBeNull();const s=mine(),authority=room.augmentHistoryAuthority('s0');
 const rows=requireAugmentFacts(s,'deaths',19);expect(rows).toHaveLength(1);expect(rows[0].deaths.length).toBeGreaterThan(0);
 expect(rows[0].deaths.every(d=>Object.hasOwn(d,'killer'))).toBe(true);
 expect(requireAugmentFacts(s,'combat-binding',19)[0].binding).toBeNull();
 expect(()=>assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match))).not.toThrow();
 for(const encode of [(s:any)=>s,(s:any)=>JSON.stringify(s)]){
  expect(restoreSharedOrbSnapshot(room.state.pool,encode(s),authority)).toEqual(s);
  for(const field of ['killer','binding','history','credits']){
   const bad:any=structuredClone(s);
   if(field==='killer')bad.augmentHistory.facts.find((f:any)=>f.kind==='deaths'&&f.deaths.length).deaths[0].killer=null;
   if(field==='binding')bad.augmentHistory.facts.find((f:any)=>f.kind==='combat-binding').binding={unitId:'unit-1',definitionId:'slow-cooker',choiceId:'forged',boundRound:19};
   if(field==='history')delete bad.augmentHistory;
   if(field==='credits')bad.seatMechanics.seat['free-shop-rerolls'].used=0;
   expect(()=>restoreSharedOrbSnapshot(room.state.pool,encode(bad),authority)).toThrow();
  }
 }
});

it('builds the anomaly army through room XP, orb, shop and equipment commands',()=>{
 runUntil(room,clock,s=>s.round===20&&s.phase==='preparation');
 claimAllOrbs(room,['s0']);answerOpenChoices(room,['s0']);
 while(mine().gold>=4&&mine().level<8)expect(room.handle('s0',{type:'buyXp'})).toMatchObject({ok:true});
 for(let slot=0;slot<5;slot++)if(mine().shop.slots[slot].status==='available'&&mine().gold>=5)expect(room.handle('s0',{type:'buy',slot,generation:mine().shop.generation})).toMatchObject({ok:true});
 for(const item of mine().items.filter(i=>i.location.kind==='inventory'))for(let slot=0;slot<3;slot++)if(room.handle('s0',{type:'equip',itemId:item.id,unitId:'unit-1',slot}).ok)break;
});
for(const round of [22,23])it(`reaches online round ${round} through real room timers`,()=>{
 runUntil(room,clock,s=>s.round===round&&(s.phase==='preparation'||s.phase==='choice'));
 expect(room.state.fault).toBeNull();
 if(round===23){
  const kills=new Map<string,number>();
  for(const d of requireAugmentFacts(mine(),'deaths',22).flatMap(f=>f.deaths))if(d.ownerSeatId!=='s0'&&d.killer?.ownerId.startsWith('[\"t2\",\"s0\"')){const id=JSON.parse(d.killer.ownerId)[3];kills.set(id,(kills.get(id)??0)+1);}
  anomalyTarget=[...kills].sort((a,b)=>b[1]-a[1])[0]?.[0]??anomalyTarget;
  let c=mine().pendingChoice!;expect(c.step).toBe('target');
  expect(room.handle('s0',{type:'anomalyTarget',choiceId:c.choiceId,generation:c.generation,unitId:anomalyTarget})).toMatchObject({ok:true});
  c=mine().pendingChoice!;expect(room.handle('s0',{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]})).toMatchObject({ok:true});
 }
});
for(const round of [23,24,25,26,27,29,30])it(`online round ${round} pays authenticated kills once and restores the paid state`,()=>{
 runUntil(room,clock,s=>s.round===round&&s.phase==='settlement');
 const state=mine();expect(room.state.fault).toBeNull();
 expect(requireAugmentFacts(state,'combat-binding',round)[0].binding?.unitId).toBe(anomalyTarget);
 const plan=goldenFindGoldPlan(state);
 if(round===30)expect(plan.reduce((n,r)=>n+r.amount,0),JSON.stringify({target:anomalyTarget,hp:state.playerHp,units:state.preparation.units.filter(u=>u.team==='player'),deaths:state.augmentHistory!.facts.filter(f=>f.kind==='deaths'&&f.round>=23).flatMap(f=>f.kind==='deaths'?f.deaths.map(d=>[d.definitionId,d.ownerSeatId,d.killer?.ownerId]):[])})).toBeGreaterThanOrEqual(2);
 expect(state.seatMechanics!.receipts.filter(r=>r.source===GOLDEN_FIND_SOURCE).map(r=>r.kind==='gold'?r.amount:0)).toEqual(plan.map(r=>r.amount));
 const authority=room.augmentHistoryAuthority('s0');
 for(const encode of [(s:any)=>s,(s:any)=>JSON.stringify(s)]){
  expect(restoreSharedOrbSnapshot(room.state.pool,encode(state),authority)).toEqual(state);
  if(plan.length){const bad:any=structuredClone(state);bad.seatMechanics.receipts.find((r:any)=>r.source===GOLDEN_FIND_SOURCE).amount+=2;expect(()=>restoreSharedOrbSnapshot(room.state.pool,encode(bad),authority)).toThrow();}
 }
});
});
