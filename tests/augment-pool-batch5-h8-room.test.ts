import { installB1Offers } from './fixtures/b1-scripted-offers';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { SEATS, TIMINGS, runUntil } from './server/helpers';
import { Room, ROOM_TIMING_DEFAULTS } from '../src/server/room/room';
import { ManualClock } from '../src/server/room/clock';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../src/server/room/carousel';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { drainBatch5H8Gold } from '../src/simulation/augment-pool-batch5-h8';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { canonicalContent } from '../src/simulation/content';
import { checkH8CarouselRestore } from './augment-pool-batch5-h8-restore-helpers';

const clock=new ManualClock();
const room=new Room(SEATS.map(s=>({...s,kind:'human' as const})),{...ROOM_TIMING_DEFAULTS,...TIMINGS,roomId:'h8-forward-room',seed:4,clock,resolver:new TwoSidedBattleResolver(),carousel:CAROUSEL_RULES_BINDING});
let restoreOffers:()=>void;
// Pool expansion moved the old offer. Script only the eligible draw; selection and restore share this scope.
// Finding the target below is fixture self-checking, not a claim about the real RNG draw.
beforeAll(()=>{restoreOffers=installB1Offers(['forward-thinking']);room.start();});
for(let round=2;round<=12;round++)beforeAll(()=>{runUntil(room,clock,s=>s.round>=round&&s.phase==='preparation');});
afterAll(()=>{room.dispose();restoreOffers();});
let holder = '', principal = 0;
it('selects Forward Thinking through the room and authenticates its bank',()=>{
 let picked=false;
 for(const id of ['s0','s1','s2','s3','s4','s5','s6','s7']){
  let seat=room.state.seats.find(s=>s.seatId===id)!;
  if(!seat.alive||seat.match.pendingChoice?.kind!=='augment')continue;
  for(let slot=0;slot<3&&!seat.match.pendingChoice!.offers.includes('forward-thinking');slot++){
   const c=seat.match.pendingChoice!;room.handle(id,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot});seat=room.state.seats.find(s=>s.seatId===id)!;
  }
  const c=seat.match.pendingChoice!;if(!c.offers.includes('forward-thinking'))continue;
  const gold=seat.match.gold;
  expect(room.handle(id,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'forward-thinking'})).toMatchObject({ok:true});
  const match=room.state.seats.find(s=>s.seatId===id)!.match;
  expect(match.gold).toBe(0);expect(match.augmentHistory!.facts.find(f=>f.kind==='acquire')).toMatchObject({goldBefore:gold});
  const authority=room.augmentHistoryAuthority(id);
  for(const input of [match,JSON.stringify(match)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(match);
  const bad=structuredClone(match);(bad.augmentHistory!.facts[0] as any).goldBefore++;
  for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority)).toThrow();
  holder=id;principal=gold;picked=true;break;
 }
 expect(picked,`forward-thinking at 3-2: ${JSON.stringify(room.state.seats.map(s=>({id:s.seatId,alive:s.alive,offers:s.match.pendingChoice?.offers})))}`).toBe(true);
});

it.each([12,13,14,15,16,17,18,19])('settles online round %i, retaining later income until the sixth PvP',round=>{
 if(round===14){
  runUntil(room,clock,s=>s.round===14&&s.phase==='carousel');
  checkH8CarouselRestore(room,holder,s=>{s.augmentHistory.facts.find((f:any)=>f.kind==='acquire').goldBefore++;});
 }
 runUntil(room,clock,s=>s.round===round&&s.phase==='settlement');
 const seat=room.state.seats.find(s=>s.seatId===holder)!;
 const match=seat.match;
 expect(seat.alive).toBe(true);
 const completed=match.roundResults.filter(r=>r.round>=12&&r.roundKind==='pvp');
 const payouts=(match.seatMechanics?.receipts??[]).filter(r=>r.source==='augment-batch5-h8-forward-thinking');
 expect(payouts).toHaveLength(completed.length>=6?1:0);
 if(round===12){
  expect(match.roundResults.at(-1)!.goldBefore).toBe(0);
  expect(match.roundResults.at(-1)!.incomeBreakdown.interest).toBe(0);
 }
 if(round===13)expect(match.roundResults.at(-1)!.goldBefore).toBeGreaterThan(0);
 if(completed.length===6){
  expect(payouts[0]).toMatchObject({kind:'gold',amount:principal+70,round:completed[5].round});
  expect(requireAugmentFacts(match,'acquire',12).find(f=>f.choiceId==='round:3-2:augment')!.goldBefore).toBe(principal);
  expect(room.state.seats.find(s=>s.seatId===holder)!.serverEvents!.events.filter(e=>e.type==='mechanicGranted'&&e.receipt.receiptId===payouts[0].receiptId)).toHaveLength(1);
  expect(drainBatch5H8Gold(match)).toBe(match);
 }
});

it('authenticates the online repayment and rejects coordinated payout/evidence edits',()=>{
 const match=room.state.seats.find(s=>s.seatId===holder)!.match;
 expect(match.roundResults.filter(r=>r.round>=12&&r.roundKind==='pvp')).toHaveLength(6);
 const authority=room.augmentHistoryAuthority(holder);
 for(const input of [match,JSON.stringify(match),canonicalContent(match)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(match);
 for(const edit of ['principal','missing-history','missing-roster','payout','missing-payout'] as const){
  const bad=structuredClone(match) as any;
  if(edit==='principal')bad.augmentHistory.facts.find((f:any)=>f.kind==='acquire').goldBefore++;
  if(edit==='missing-history')delete bad.augmentHistory;
  if(edit==='missing-roster')bad.augmentHistory.facts=bad.augmentHistory.facts.filter((f:any)=>f.kind!=='pvp-roster');
  if(edit==='payout'){bad.seatMechanics.receipts.find((r:any)=>r.source==='augment-batch5-h8-forward-thinking').amount++;bad.gold++;}
  if(edit==='missing-payout'){bad.seatMechanics.receipts=bad.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-batch5-h8-forward-thinking');bad.gold-=principal+70;}
  for(const input of [bad,JSON.stringify(bad),canonicalContent(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority),edit).toThrow();
 }
});
