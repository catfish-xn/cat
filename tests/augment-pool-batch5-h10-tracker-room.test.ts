import { canonicalContent } from '../src/simulation/content';
import { historyRoster } from '../src/simulation/augment-history';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Room, ROOM_TIMING_DEFAULTS } from '../src/server/room/room';
import { ManualClock } from '../src/server/room/clock';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { SEATS, TIMINGS, runUntil, answerOpenChoices } from './server/helpers';
import { installB1Offers } from './fixtures/b1-scripted-offers';
import { trackerGiftPlan, trackerActiveTraits } from '../src/simulation/augment-pool-batch5-h10-tracker';
import { restoreSharedOrbSnapshot, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { toPlayerView, toSeatPrivateView } from '../src/server/room/projection';
import type { WireCommand } from '../src/server/protocol';
const TARGET=['draven','gangplank','maddie','nami','steb','swain','trundle'];
describe.each(['deploy','reroll-after-auto-deploy'])('tracker online via %s',trigger=>{
const clock=new ManualClock();
// Documented Room test pool narrows availability, but purchases, XP, payment, draws and holdings all use real commands.
const room=new Room(SEATS.map(s=>({...s,kind:'human'})),{...ROOM_TIMING_DEFAULTS,...TIMINGS,roomId:'h10-tracker',seed:8,clock,resolver:new TwoSidedBattleResolver(),poolCapacities:Object.fromEntries(TARGET.map(id=>[id,['gangplank','nami','swain'].includes(id)?18:30]))});
let seatId='s1';
const seat=()=>room.state.seats.find(s=>s.seatId===seatId)!;
const command=(c:WireCommand)=>{const r=room.handle(seatId,c);expect(r,r.ok?'':JSON.stringify(r)).toMatchObject({ok:true});if(!r.ok)throw new Error(r.reason);return r;};
let restoreTrackerOffers: () => void;
beforeAll(()=>room.start());
beforeAll(()=>{ restoreTrackerOffers = installB1Offers(['trait-tracker']); });
afterAll(()=>{ restoreTrackerOffers(); room.dispose(); });
for(let round=2;round<=12;round++)beforeAll(()=>{
 runUntil(room,clock,s=>s.round===round&&(s.phase==='preparation'||s.roundKind==='supply'));
 if(round!==12)answerOpenChoices(room);
});
beforeAll(()=>{
 const offered=room.state.seats.find(s=>s.match.pendingChoice?.offers.includes('trait-tracker'));
 if(offered)seatId=offered.seatId;
 else for(const candidate of room.state.seats){
  seatId=candidate.seatId;
  for(let slot=0;slot<3&&!seat().match.pendingChoice!.offers.includes('trait-tracker');slot++){
   const c=seat().match.pendingChoice!;
   command({type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot});
  }
  if(seat().match.pendingChoice!.offers.includes('trait-tracker'))break;
 }
 const c=seat().match.pendingChoice!;expect(c.offers).toContain('trait-tracker'); // fixture self-check under installB1Offers
 command({type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'trait-tracker'});answerOpenChoices(room);
});
function prepare(){
 for(const u of seat().match.preparation.units.filter(u=>u.team==='player'&&!TARGET.includes(u.definitionId)))command({type:'sell',unitId:u.id});
 while(seat().match.level<7&&seat().match.gold>=20)command({type:'buyXp'});
 for(let roll=0;roll<30;roll++){
  for(let i=0;i<5;i++){
   const s=seat().match,o=s.shop.slots[i];
   if(o.status==='available'&&TARGET.includes(o.definitionId)&&!s.preparation.units.some(u=>u.team==='player'&&u.definitionId===o.definitionId))command({type:'buy',slot:i,generation:s.shop.generation});
  }
  const s=seat().match;
  if(s.preparation.units.filter(u=>u.team==='player').length===7||s.gold<12||s.level<7)break;
  command({type:'reroll'});
 }
 for(const u of seat().match.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench')){
  const s=seat().match,used=new Set(s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').map(u=>u.location.kind==='board'?`${u.location.cell.col},${u.location.cell.row}`:''));
  if(used.size>=s.level||trigger==='reroll-after-auto-deploy'&&used.size>=6)break;
  const cell=Array.from({length:28},(_,i)=>({col:i%7,row:4+Math.floor(i/7)})).find(c=>!used.has(`${c.col},${c.row}`))!;
  command({type:'deploy',unitId:u.id,target:{kind:'board',cell}});
 }
}
beforeAll(()=>prepare());
beforeAll(()=>{if(!trackerGiftPlan(seat().match).length&&(trigger==='deploy'||seat().match.level<7||seat().match.preparation.units.filter(u=>u.team==='player').length<7)){runUntil(room,clock,s=>s.round===13&&s.phase==='preparation');prepare();}});
beforeAll(()=>{
 if(trigger!=='reroll-after-auto-deploy')return;
 const s=seat().match;
 expect(s.preparation.units.filter(u=>u.team==='player')).toHaveLength(7);
 expect(trackerActiveTraits(historyRoster(s)).length).toBeLessThan(8);
 expect(trackerGiftPlan(s)).toHaveLength(0);
 const round=s.round;
 runUntil(room,clock,s=>s.round===round&&s.phase==='settlement');
 expect(trackerActiveTraits(historyRoster(seat().match))).toHaveLength(8);
 expect(trackerGiftPlan(seat().match)).toHaveLength(0);
});
beforeAll(()=>{
 if(trigger!=='reroll-after-auto-deploy')return;
 const round=seat().match.round;
 runUntil(room,clock,s=>s.round>round&&s.phase==='preparation'&&s.roundKind!=='supply');
 const before=seat().match,pool=room.state.pool;
 expect(trackerGiftPlan(before)).toHaveLength(0);
 expect(room.handle(seatId,{type:'buy',slot:0,generation:-1})).toMatchObject({ok:false});
 expect(seat().match).toBe(before);expect(room.state.pool).toBe(pool);
 const receipt=command({type:'reroll'});
 expect(receipt.events.filter(e=>e.type==='mechanicGranted')).toHaveLength(6);
});
afterAll(()=>room.dispose());
it('real room commands grant six distinct emblems exactly once and keep the shared pool conserved',()=>{
 const s=seat().match,gifts=trackerGiftPlan(s);expect(gifts).toHaveLength(6);expect(new Set(gifts.map(g=>g.definitionId)).size).toBe(6);
 expect(s.augmentHistory!.facts.filter(f=>f.kind==='trait-activation')).toHaveLength(1);
 const count=s.items.length;command({type:'shopLock',locked:!s.shop.locked,generation:s.shop.generation});expect(seat().match.items).toHaveLength(count);
 assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match));
});
it('authenticates online object/JSON/serialized restore, rejects fact/reward tampering and missing or forged authority',()=>{
 const s=seat().match,authority=room.augmentHistoryAuthority(seatId);
 for(const entry of ['object','JSON','serialized']){
  const input=(x:unknown)=>entry==='object'?x:entry==='JSON'?JSON.stringify(x):canonicalContent(x);
  expect(restoreSharedOrbSnapshot(room.state.pool,input(s),authority)).toEqual(s);
  for(const edit of [(x:any)=>{delete x.augmentHistory;},(x:any)=>{x.augmentHistory.facts.find((f:any)=>f.kind==='trait-activation').roster.units.pop();},(x:any)=>{x.seatMechanics.receipts.pop();}]){
   const bad=structuredClone(s);edit(bad);expect(()=>restoreSharedOrbSnapshot(room.state.pool,input(bad),authority)).toThrow();
  }
 }
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,s)).toThrow('missing independent server authority');
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,s,{kind:'server-augment-history-authority'})).toThrow('missing independent server authority');
 expect(JSON.stringify(toPlayerView(room.state,seatId,clock.now()))).not.toContain('augmentHistory');
 expect(JSON.stringify(toSeatPrivateView(seat().match))).not.toContain('augmentHistory');
});

});
