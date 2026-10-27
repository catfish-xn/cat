import { afterAll, beforeAll, expect, it } from 'vitest';
import { SEATS, TIMINGS, runUntil, claimAllOrbs, answerOpenChoices } from './server/helpers';
import { getDeploymentCap } from '../src/simulation/match';
import { isAnvil } from '../src/simulation/content/anvils';
import { Room, ROOM_TIMING_DEFAULTS } from '../src/server/room/room';
import { ManualClock } from '../src/server/room/clock';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../src/server/room/carousel';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { drainBatch5H8Deaths } from '../src/simulation/augment-pool-batch5-h8-deaths';
import { canonicalContent } from '../src/simulation/content';
import { checkH8CarouselRestore } from './augment-pool-batch5-h8-restore-helpers';
const clock=new ManualClock();
const room=new Room(SEATS.map(s=>({...s,kind:'human' as const})),{...ROOM_TIMING_DEFAULTS,...TIMINGS,roomId:'h8-test-room',seed:9,clock,resolver:new TwoSidedBattleResolver(),carousel:CAROUSEL_RULES_BINDING});
beforeAll(()=>{room.start();});
for(let round=2;round<=19;round++)beforeAll(()=>{runUntil(room,clock,s=>s.round>=round&&s.phase==='preparation');});
afterAll(()=>room.dispose());
let id='';
it('selects Malicious Monetization through the room',()=>{
 for(const candidate of ['s0','s1','s2','s3','s4','s5','s6','s7']){
  let seat=room.state.seats.find(s=>s.seatId===candidate)!;if(!seat.alive||seat.match.pendingChoice?.kind!=='augment')continue;
  for(let slot=0;slot<3&&!seat.match.pendingChoice!.offers.includes('mirrored-monetization');slot++){
   const c=seat.match.pendingChoice!;room.handle(candidate,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot});seat=room.state.seats.find(s=>s.seatId===candidate)!;
  }
  const c=seat.match.pendingChoice!;if(!c.offers.includes('mirrored-monetization'))continue;
  const gold=seat.match.gold;expect(room.handle(candidate,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'mirrored-monetization'})).toMatchObject({ok:true});
  expect(room.state.seats.find(s=>s.seatId===candidate)!.match.gold).toBe(gold+2);id=candidate;break;
 }
 expect(id).not.toBe('');
});
it('fields and equips a real purchased army before the kill witness',()=>{
 const mine=()=>room.state.seats.find(s=>s.seatId===id)!.match;
 claimAllOrbs(room,[id]);answerOpenChoices(room,[id]);
 while(mine().level<8&&mine().gold>=4)expect(room.handle(id,{type:'buyXp'})).toMatchObject({ok:true});
 for(let slot=0;slot<5;slot++)if(mine().shop.slots[slot].status==='available')room.handle(id,{type:'buy',slot,generation:mine().shop.generation});
 answerOpenChoices(room,[id]);
 for(const unit of mine().preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'&&!isAnvil(u.definitionId))){
  const board=mine().preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');if(board.length>=getDeploymentCap(mine()))break;
  const used=new Set(board.flatMap(u=>u.location.kind==='board'?[`${u.location.cell.col},${u.location.cell.row}`]:[]));
  const cell=Array.from({length:28},(_,i)=>({col:i%7,row:4+Math.floor(i/7)})).find(c=>!used.has(`${c.col},${c.row}`))!;
  expect(room.handle(id,{type:'deploy',unitId:unit.id,target:{kind:'board',cell}})).toMatchObject({ok:true});answerOpenChoices(room,[id]);
 }
 for(const item of mine().items.filter(i=>i.location.kind==='inventory')){
  let equipped=false;
  for(const unit of mine().preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board')){
   for(let slot=0;slot<3;slot++)if(room.handle(id,{type:'equip',itemId:item.id,unitId:unit.id,slot}).ok){equipped=true;break;}
   if(equipped)break;
  }
 }
 expect(mine().preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').length).toBeGreaterThan(1);
});
it('records and pays the authoritative room battle deaths',()=>{
 runUntil(room,clock,s=>s.round===19&&s.phase==='settlement');
 const match=room.state.seats.find(s=>s.seatId===id)!.match;
 const deaths=requireAugmentFacts(match,'deaths',19).flatMap(f=>f.deaths).filter(d=>d.ordinaryHero&&d.ownerSeatId!==id);
 expect(deaths.length).toBeGreaterThan(0);
 const receipts=match.seatMechanics!.receipts.filter(r=>r.source==='augment-batch5-h8-monetization');
 expect(receipts).toMatchObject([{kind:'gold',amount:2*deaths.length}]);
 expect(room.state.seats.find(s=>s.seatId===id)!.serverEvents!.events.filter(e=>e.type==='mechanicGranted'&&e.receipt.receiptId===receipts[0].receiptId)).toHaveLength(1);
 const authority=room.augmentHistoryAuthority(id);
 for(const input of [match,JSON.stringify(match)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(match);
 const bad=structuredClone(match);(bad.augmentHistory!.facts.find(f=>f.kind==='deaths') as any).completeThroughTick++;
 for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority)).toThrow();
});

it('rejects missing history, enemy attribution, summon and payout edits at the online restore entries',()=>{
 const match=room.state.seats.find(s=>s.seatId===id)!.match,authority=room.augmentHistoryAuthority(id);
 for(const edit of ['history','owner','ordinary','event','gold','receipt','combined'] as const){
  const bad=structuredClone(match) as any;
  const death=bad.augmentHistory.facts.filter((f:any)=>f.kind==='deaths').flatMap((f:any)=>f.deaths).find((d:any)=>d.ordinaryHero&&d.ownerSeatId!==id);
  if(edit==='history')delete bad.augmentHistory;
  if(edit==='owner')death.ownerSeatId=id;
  if(edit==='ordinary')death.ordinaryHero=false;
  if(edit==='event')death.eventSeq++;
  if(edit==='gold')bad.gold+=2;
  if(edit==='receipt')bad.seatMechanics.receipts=bad.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-batch5-h8-monetization');
  if(edit==='combined'){
   death.ordinaryHero=false;bad.gold-=2;
   bad.seatMechanics.receipts.find((r:any)=>r.source==='augment-batch5-h8-monetization').amount-=2;
  }
  for(const input of [bad,JSON.stringify(bad),canonicalContent(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority),edit).toThrow();
 }
 expect(drainBatch5H8Deaths(match)).toBe(match);
});

it.each([20,21,22])('uses natural rounds, including supply, for expiry at online round %i',round=>{
 if(round===21){
  runUntil(room,clock,s=>s.round===21&&s.phase==='carousel');
  checkH8CarouselRestore(room,id,s=>{s.augmentHistory.facts.find((f:any)=>f.kind==='deaths').completeThroughTick++;});
 }
 runUntil(room,clock,s=>s.round===round&&s.phase==='settlement');
 const match=room.state.seats.find(s=>s.seatId===id)!.match;
 expect(match.round).toBe(round);
 const receipts=match.seatMechanics!.receipts.filter(r=>r.source==='augment-batch5-h8-monetization');
 for(const result of match.roundResults.filter(r=>r.round>=19&&r.round<=round)){
  const deaths=result.roundKind==='supply'?[]:requireAugmentFacts(match,'deaths',result.round).flatMap(f=>f.deaths).filter(d=>d.ordinaryHero&&d.ownerSeatId!==id);
  const paid=receipts.filter(r=>r.round===result.round);
  expect(paid).toHaveLength(result.round<22&&deaths.length>0?1:0);
  if(paid.length)expect(paid[0]).toMatchObject({kind:'gold',amount:2*deaths.length});
  if(result.round===22)expect(deaths.length).toBeGreaterThan(0);
 }
 const authority=room.augmentHistoryAuthority(id);
 expect(restoreSharedOrbSnapshot(room.state.pool,canonicalContent(match),authority)).toEqual(match);
 expect(drainBatch5H8Deaths(match)).toBe(match);
});
