import {HISTORY_AUGMENT_ROOM_ROUTES} from '../augment-stage-helpers';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {Room,ROOM_TIMING_DEFAULTS} from '../../src/server/room/room';
import {ManualClock} from '../../src/server/room/clock';
import {TwoSidedBattleResolver} from '../../src/server/room/two-sided-resolver';
import {runUntil,answerOpenChoices} from './helpers';
import {CABAL_HEROES,cabalGiftPlan,cabalGrowthPlan,readCabalGrowth,settleCabalGrowth} from '../../src/simulation/augment-pool-batch5-h9-cabal';
import {requireAugmentFacts} from '../../src/simulation/augment-history';
import {restoreSharedOrbSnapshot,assertSharedPoolConservation,rerollSharedShop} from '../../src/simulation/shared-pool';
import {canonicalContent} from '../../src/simulation/content';
import {compileBattle} from '../../src/simulation/two-sided-battle';
import {snapshotForBattle} from '../../src/simulation/two-sided-snapshot';
import type {MatchState} from '../../src/simulation/match';
import type {AugmentHistoryAuthority} from '../../src/simulation/augment-history';
import type {SharedPoolState} from '../../src/simulation/shared-pool';
for(const streaming of [false,true])describe(`forbidden-magic streaming=${streaming}`,()=>{

const clock=new ManualClock(),room=new Room(Array.from({length:8},(_,i)=>({seatId:`s${i}`,name:`s${i}`,kind:'human' as const})),
 {...ROOM_TIMING_DEFAULTS,combatStreaming:streaming,preparationMs:1000,choiceMs:500,settlementMs:200,battleTailMs:100,maxSettlementExtensions:2,roomId:'h9-cabal',seed:HISTORY_AUGMENT_ROOM_ROUTES['forbidden-magic'].seed,clock,resolver:new TwoSidedBattleResolver()});
const seatId='s2',mine=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
let acquired:MatchState,paid:MatchState,authority:AugmentHistoryAuthority,pool:SharedPoolState;
beforeAll(()=>room.start());
for(const round of [2,3,4,5,6,8,9,10,11])beforeAll(()=>runUntil(room,clock,s=>s.round===round&&s.phase==='preparation'));
afterAll(()=>room.dispose());
it('fields real shop Black Rose heroes before the tailored 3-2 offer',()=>{
 for(const seat of room.state.seats){
  const slot=seat.match.shop.slots.findIndex(s=>s.status==='available'&&CABAL_HEROES.includes(s.definitionId!));
  if(slot<0)continue;
  expect(room.handle(seat.seatId,{type:'buy',slot,generation:seat.match.shop.generation})).toMatchObject({ok:true});
  const m=room.state.seats.find(s=>s.seatId===seat.seatId)!.match,u=m.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&CABAL_HEROES.includes(u.definitionId));
  if(u)expect(room.handle(seat.seatId,{type:'deploy',unitId:u.id,target:{kind:'board',cell:{col:0,row:4}}})).toMatchObject({ok:true});
 }
});
it('chooses Cabal through the room, queues three exact gifts and claims them without minting shared-pool copies',()=>{
 runUntil(room,clock,s=>s.round===12&&s.phase==='preparation');
 const c=mine().pendingChoice!;expect(c.offers).toContain('forbidden-magic');
 expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'forbidden-magic'})).toMatchObject({ok:true});
 acquired=mine();const gifts=cabalGiftPlan(acquired);expect(gifts).toHaveLength(3);
 const receipts=acquired.seatMechanics!.receipts.filter(r=>gifts.some(g=>g.receiptId===r.receiptId));
 expect(receipts.map(r=>r.kind==='unit'?r.definitionId:null)).toEqual(gifts.map(g=>g.definitionId));
 expect(receipts.every(r=>r.kind==='unit'&&r.resolution==='orb')).toBe(true);
 for(const r of receipts){if(r.kind!=='unit'||r.resolution!=='orb')throw Error('missing gift orb');
  expect(room.handle(seatId,{type:'claimOrb',round:mine().round,orbId:r.orbId!})).toMatchObject({ok:true});}
 expect(()=>assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match))).not.toThrow();
 expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'forbidden-magic'})).toMatchObject({ok:false});
 expect(readCabalGrowth(mine())).toEqual({healthFlat:0,attackDamageBps:0});
});
for(const round of [12,13,15,16,17])it(`round ${round} records actual participants and exactly-once permanent Sion growth`,()=>{
 runUntil(room,clock,s=>s.round===round&&s.phase==='settlement');expect(room.state.fault).toBeNull();
 const state=mine(),rows=requireAugmentFacts(state,'deaths',round);
 expect(rows.flatMap(f=>f.deaths).every(d=>Array.isArray(d.takedowns))).toBe(true);
 const plan=cabalGrowthPlan(state),growth=state.augmentHistory!.facts.filter(f=>f.kind==='summon-growth');
 expect(growth.map(f=>({receiptId:f.receiptId,stacks:f.stacks,healthFlat:f.healthFlat,attackDamageBps:f.attackDamageBps})))
  .toEqual(plan.map(p=>({receiptId:p.receiptId,stacks:p.stacks,healthFlat:p.healthFlat,attackDamageBps:p.attackDamageBps})));
 expect(settleCabalGrowth(state)).toBe(state);
 if(round===17){expect(plan.reduce((n,p)=>n+p.stacks,0)).toBeGreaterThan(0);paid=state;authority=room.augmentHistoryAuthority(seatId);pool=room.state.pool;}
});
it('projects authenticated prior growth into the next frozen PvP snapshot and real Sion compiler',()=>{
 runUntil(room,clock,s=>s.round===18&&s.phase==='preparation');answerOpenChoices(room,[seatId]);
 const growth=readCabalGrowth(mine())!,snapshot=snapshotForBattle(mine(),seatId);
 expect(growth.healthFlat).toBeGreaterThan(0);expect(snapshot.cabalGrowth).toEqual(growth);
 expect(growth.attackDamageBps).toBe(growth.healthFlat*15);
 const opponent=room.state.seats.find(s=>s.seatId!==seatId&&s.alive)!;
 const other=snapshotForBattle(opponent.match,opponent.seatId);
 const input=compileBattle(snapshot,other,42),baseline=compileBattle({...snapshot,cabalGrowth:{healthFlat:0,attackDamageBps:0}},other,42);
 const id=input.preparation.units.find(u=>u.team==='player'&&u.definitionId==='g23-sion')!.id;
 const boosted=input.strategy.units.find(u=>u.unitId===id)!,plain=baseline.strategy.units.find(u=>u.unitId===id)!;
 expect(boosted.stats.health-plain.stats.health).toBe(growth.healthFlat);
 expect(boosted.attackDamagePercentBps!-plain.attackDamagePercentBps!).toBe(growth.attackDamageBps);
 expect(boosted.stats.attack).toBeGreaterThan(plain.stats.attack);
 runUntil(room,clock,s=>s.round===18&&s.phase==='settlement');
 const battle=room.state.battles.find(b=>b.kind==='two-sided'&&b.participants.includes(seatId));
 if(!battle||battle.kind!=='two-sided')throw Error('missing real PvP');
 const team=battle.battle.a.seatId===seatId?'player':'enemy';
 const sion=battle.battle.initial.units.find(u=>u.definitionId==='g23-sion'&&u.team===team)!;
 expect(sion.maxHp).toBe(boosted.stats.health);
 expect(sion.attackDamage).toBe(boosted.stats.attack);

});
for(const entry of ['object','JSON','serialized'] as const){
 const encode=(s:MatchState)=>entry==='object'?s:entry==='JSON'?JSON.stringify(s):canonicalContent(s);
 it(`${entry}: round-trips paid facts and continues the same public command`,()=>{
  const copy=restoreSharedOrbSnapshot(pool,encode(paid),authority);expect(copy).toEqual(paid);
  const continued=rerollSharedShop(pool,copy,copy.shop.generation);expect(continued.ok).toBe(true);
  expect(continued).toEqual(rerollSharedShop(pool,paid,paid.shop.generation));
  expect(()=>restoreSharedOrbSnapshot(pool,encode(paid))).toThrow('missing independent server authority');
 });
 for(const kind of ['missing','version','seat','takedowns','eligibility','actor','growth','growth-removal','input-growth','receipt','gifts'] as const)it(`${entry}: rejects tampered ${kind}`,()=>{
  const bad:any=structuredClone(paid),facts=bad.augmentHistory.facts;
  const death=facts.filter((f:any)=>f.kind==='deaths').flatMap((f:any)=>f.deaths).find((d:any)=>d.takedowns.length);
  if(kind==='missing')delete bad.augmentHistory;
  if(kind==='version')bad.augmentHistory.version='augment-history-v2';
  if(kind==='seat')bad.augmentHistory.seatId='s0';
  if(kind==='takedowns')delete death.takedowns;
  if(kind==='eligibility')death.takedowns[0].eligible=!death.takedowns[0].eligible;
  if(kind==='actor')death.takedowns[0].unitId='forged';
  if(kind==='growth')facts.find((f:any)=>f.kind==='summon-growth').attackDamageBps+=150;
  if(kind==='growth-removal'){bad.augmentHistory.facts=facts.filter((f:any)=>f.kind!=='summon-growth');bad.augmentHistory.facts.forEach((f:any,i:number)=>f.sequence=i);}
  if(kind==='input-growth')bad.combatInputBasis.inputs.cabalGrowth.healthFlat+=10;
  if(kind==='receipt')facts.find((f:any)=>f.kind==='summon-growth').receiptId+='forged';
  if(kind==='gifts')bad.seatMechanics.receipts=bad.seatMechanics.receipts.filter((r:any)=>!cabalGiftPlan(bad).some(g=>g.receiptId===r.receiptId));
  expect(()=>restoreSharedOrbSnapshot(pool,encode(bad),authority)).toThrow();
 });
}
});
