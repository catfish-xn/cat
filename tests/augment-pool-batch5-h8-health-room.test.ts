import { afterAll, beforeAll, expect, it } from 'vitest';
import { SEATS, TIMINGS, runUntil } from './server/helpers';
import { Room, ROOM_TIMING_DEFAULTS } from '../src/server/room/room';
import { ManualClock } from '../src/server/room/clock';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../src/server/room/carousel';
import { requireAugmentFacts, readAugmentPlayerHealth, recordAugmentPlayerHealth } from '../src/simulation/augment-history';
import { applyDhampyrSettlement } from '../src/simulation/augment-pool-batch5-h8-health';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { canonicalContent } from '../src/simulation/content';
import { batch2HpAfterSettlement } from '../src/simulation/augment-pool-batch2-health';
import { recordRoomBattleFacts } from '../src/server/room/augment-history';
import type { SettledSeat, TwoSidedBattleResult } from '../src/server/room/types';
import { checkH8CarouselRestore } from './augment-pool-batch5-h8-restore-helpers';
// Seed 15 offers Dhampyr to an injured winner at 3-2; seed 10 only offered it to a full-HP winner.
const clock=new ManualClock();
const room=new Room(SEATS.map(s=>({...s,kind:'human' as const})),{...ROOM_TIMING_DEFAULTS,...TIMINGS,roomId:'h8-health-room',seed:15,clock,resolver:new TwoSidedBattleResolver(),carousel:CAROUSEL_RULES_BINDING});
beforeAll(()=>{room.start();});
for(let round=2;round<=12;round++)beforeAll(()=>{runUntil(room,clock,s=>s.round>=round&&s.phase==='preparation');});
afterAll(()=>room.dispose());
const ids:string[]=[];let healedMatch:import('../src/simulation/match').MatchState;
it('selects Vampiric Vitality through the room',()=>{
 for(const candidate of SEATS.map(s=>s.seatId)){
  let seat=room.state.seats.find(s=>s.seatId===candidate)!;if(!seat.alive||seat.match.pendingChoice?.kind!=='augment')continue;
  for(let slot=0;slot<3&&!seat.match.pendingChoice!.offers.includes('dhampyr');slot++){
   const c=seat.match.pendingChoice!;room.handle(candidate,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot});seat=room.state.seats.find(s=>s.seatId===candidate)!;
  }
  const c=seat.match.pendingChoice!;if(!c.offers.includes('dhampyr'))continue;
  expect(room.handle(candidate,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'dhampyr'})).toMatchObject({ok:true});ids.push(candidate);
 }
 expect(ids.length).toBeGreaterThan(0);
});
it('heals from actual opponent damage after settlement and synchronizes the room HP',()=>{
 runUntil(room,clock,s=>s.round===12&&s.phase==='settlement');
 const seats=ids.map(id=>room.state.seats.find(s=>s.seatId===id)!);
 const healed=seats.find(s=>s.match.augmentHistory?.facts.some(f=>f.kind==='player-health'&&f.round===12));
 expect(healed,`dhampyr needs an injured winner dealing at least 5 actual damage: ${JSON.stringify(seats.map(s=>({id:s.seatId,hp:s.hp,damage:requireAugmentFacts(s.match,'player-damage',12).at(-1)?.actualDamage})))}`).toBeDefined();if(!healed)throw new Error('no holder healed');
 const match=healed.match;healedMatch=match;const damage=requireAugmentFacts(match,'player-damage',12).at(-1)!;
 const hp=requireAugmentFacts(match,'player-health',12).at(-1)!;
 expect(damage.actualDamage).toBeGreaterThan(0);expect(damage.mirror).toBe(false);
 expect(hp.hpAfter).toBe(Math.min(100,hp.hpBefore+Math.floor(damage.actualDamage!*0.2)));
 expect(match.playerHp).toBe(hp.hpAfter);expect(healed.hp).toBe(match.playerHp);
 const opponent=room.state.seats.find(s=>s.seatId===damage.opponentSeatId)!.match.roundResults.at(-1)!;
 expect(damage.actualDamage).toBe(opponent.hpBefore-opponent.hpAfter);
 expect(damage.actualDamage).toBe(opponent.hpLost);
 expect(batch2HpAfterSettlement(match,12,match.roundResults.at(-1)!.hpAfter)).toBe(match.playerHp);
 const authority=room.augmentHistoryAuthority(healed.seatId);
 for(const input of [match,JSON.stringify(match)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(match);
 const bad=structuredClone(match);(bad.augmentHistory!.facts.find(f=>f.kind==='player-damage') as any).actualDamage++;
 for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority)).toThrow();
});

it('runs 12% omnivamp in the real online combat and keeps its healing in the ledger',()=>{
 const heals=room.state.battles.flatMap(result=>result.kind==='two-sided'?result.battle.events:[])
  .filter(event=>event.type==='heal'&&event.outcome.kind==='omnivamp');
 expect(heals.some(event=>event.type==='heal'&&event.outcome.actual>0&&event.outcome.contributions.some(c=>JSON.stringify(c.source).includes('dhampyr')))).toBe(true);
});

it('rejects damage/heal/cap edits, removal and forged authority for every online representation',()=>{
 const match=healedMatch,authority=room.augmentHistoryAuthority(match.multiplayer!.seatId);
 const returned=readAugmentPlayerHealth(match) as any[];returned[0].hpAfter++;
 expect(returned).not.toEqual(readAugmentPlayerHealth(match));
 for(const edit of ['missing','damage','healed','cap','duplicate','remove','owner','combined'] as const){
  const bad=structuredClone(match) as any;
  const health=bad.augmentHistory.facts.find((f:any)=>f.kind==='player-health');
  const damage=bad.augmentHistory.facts.find((f:any)=>f.kind==='player-damage');
  if(edit==='missing')delete bad.augmentHistory;
  if(edit==='damage')damage.actualDamage++;
  if(edit==='healed')health.hpAfter++;
  if(edit==='cap')health.maxHpAfter++;
  if(edit==='duplicate')bad.augmentHistory.facts.push({...health,sequence:bad.augmentHistory.facts.length});
  if(edit==='remove')bad.augmentHistory.facts=bad.augmentHistory.facts.filter((f:any)=>f.kind!=='player-health');
  if(edit==='owner')health.choiceId='round:2-1:augment';
  if(edit==='combined'){damage.actualDamage+=5;health.hpAfter++;bad.playerHp++;}
  for(const input of [bad,JSON.stringify(bad),canonicalContent(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority),edit).toThrow();
 }
 for(const input of [match,JSON.stringify(match),canonicalContent(match)]){
  expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(match);
  expect(()=>restoreSharedOrbSnapshot(room.state.pool,input)).toThrow('missing independent server authority');
  expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,{kind:'server-augment-history-authority'})).toThrow('missing independent server authority');
 }
});

it.each([
 {hp:80,damage:19,mirror:false,expected:83},
 {hp:80,damage:4,mirror:false,expected:80},
 {hp:99,damage:20,mirror:false,expected:100},
 {hp:80,damage:25,mirror:true,expected:80},
 {hp:80,damage:null,mirror:false,expected:80},
 {hp:0,damage:25,mirror:false,expected:0},
])('bounds and deduplicates the healing rule: %j',({hp,damage,mirror,expected})=>{
 const s=structuredClone(healedMatch) as any;s.playerHp=hp;
 s.augmentHistory.facts=s.augmentHistory.facts.filter((f:any)=>f.kind!=='player-health');
 const fact=s.augmentHistory.facts.find((f:any)=>f.kind==='player-damage'&&f.round===s.round);fact.actualDamage=damage;fact.mirror=mirror;
 const result=applyDhampyrSettlement(s);expect(result.playerHp).toBe(expected);
 expect(applyDhampyrSettlement(result)).toBe(result);
});

it('uses the authenticated current max HP and returns detached health evidence',()=>{
 let s=structuredClone(healedMatch) as any;s.playerHp=119;
 s.augmentHistory.facts=s.augmentHistory.facts.filter((f:any)=>f.kind!=='player-health');
 const fact=s.augmentHistory.facts.find((f:any)=>f.kind==='player-damage'&&f.round===s.round);fact.actualDamage=20;
 const owner=s.augments.find((a:any)=>a.definitionId==='dhampyr');
 // Internal rule vector for a prior authenticated max-HP change; restore authenticity is tested separately above.
 s=recordAugmentPlayerHealth(s,{kind:'player-health',choiceId:owner.choiceId,receiptId:'test-max-hp',hpBefore:99,hpAfter:119,maxHpBefore:100,maxHpAfter:120});
 const result=applyDhampyrSettlement(s);
 expect(result.playerHp).toBe(120);
 expect(readAugmentPlayerHealth(result).at(-1)).toMatchObject({hpBefore:119,hpAfter:120,maxHpBefore:120,maxHpAfter:120});
});

it.each([
 {hpBefore:3,hpAfter:0,mirror:false,heal:0},
 {hpBefore:7,hpAfter:1,mirror:false,heal:1},
 {hpBefore:20,hpAfter:0,mirror:true,heal:0},
])('room fact adapter uses final HP after overkill/Mel/mirror: %j',({hpBefore,hpAfter,mirror,heal})=>{
 const ownId=healedMatch.multiplayer!.seatId;
 const result=room.state.battles.find(r=>r.kind==='two-sided'&&r.participants.includes(ownId)) as TwoSidedBattleResult;
 const opponentId=result.battle.a.seatId===ownId?result.battle.b.seatId:result.battle.a.seatId;
 const own=structuredClone(healedMatch) as any;own.playerHp=80;
 own.augmentHistory.facts=own.augmentHistory.facts.filter((f:any)=>f.kind!=='player-health');
 const opponent=structuredClone(room.state.seats.find(s=>s.seatId===opponentId)!.match) as any;
 const record=opponent.roundResults.at(-1)!;
 Object.assign(record,{hpBefore,hpAfter,hpLost:hpBefore-hpAfter,playerDamage:50});
 const settled=(seatId:string,match:typeof healedMatch):SettledSeat=>({seatId,match,hpBefore:match.playerHp,damage:0,hpAfterRaw:match.playerHp,hpAfter:match.playerHp,receipt:null,events:[]});
 const rows=recordRoomBattleFacts([settled(ownId,own),settled(opponentId,opponent)],
  [{...result,battle:{...result.battle,mirrorOfSeatId:mirror?opponentId:null}}]);
 const healed=rows.find(s=>s.seatId===ownId)!;
 expect(requireAugmentFacts(healed.match,'player-damage',12).at(-1)).toMatchObject({actualDamage:mirror?0:hpBefore-hpAfter,mirror});
 expect(healed.match.playerHp).toBe(80+heal);expect(healed.hpAfter).toBe(80+heal);
});

it('continues the healed room through the next PvP without HP divergence or repeated healing',()=>{
 runUntil(room,clock,s=>s.round===13&&s.phase==='settlement');
 const seat=room.state.seats.find(s=>s.seatId===healedMatch.multiplayer!.seatId)!;
 expect(seat.match.roundResults.at(-1)!.hpBefore).toBe(healedMatch.playerHp);
 expect(seat.hp).toBe(seat.match.playerHp);
 expect(readAugmentPlayerHealth(seat.match).filter(f=>f.round===12)).toHaveLength(1);
 expect(applyDhampyrSettlement(seat.match)).toBe(seat.match);
 expect(restoreSharedOrbSnapshot(room.state.pool,canonicalContent(seat.match),room.augmentHistoryAuthority(seat.seatId))).toEqual(seat.match);
});

it('authenticates healing at the carousel restore boundary as well',()=>{
 runUntil(room,clock,s=>s.round===14&&s.phase==='carousel');
 checkH8CarouselRestore(room,healedMatch.multiplayer!.seatId,s=>{s.augmentHistory.facts.find((f:any)=>f.kind==='player-health').hpAfter++;});
});
