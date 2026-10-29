import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming, claimAllOrbs } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { createMatch } from '../src/simulation/match';
import { bindSharedOpeningEncounter, createOpeningEncounter, openingEncounterId } from '../src/simulation/opening-encounter';
import { nextRandom } from '../src/simulation/rng';
import { generateChoices } from '../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { twoMuchValueRerolls } from '../src/simulation/augment-pool-batch5-h1-rerolls';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import type { Unit } from '../src/simulation/units';
import { COST, freeRerollCredits } from './fixtures/m5/oracle.g2.cjs';
import { freeRerollsAvailable, type MatchState } from '../src/server-entry';
import { toPlayerView, toSeatPrivateView } from '../src/server/room/projection';
import { readFreeRerollsAvailable, toDisplayMatch } from '../src/rendering/online/seat-view-adapter';

let found: {seed:number;seatId:string}|undefined;
for(let seed=0;seed<=100&&!found;seed++){
 let rng=seed;
 for(let index=0;index<4;index++){
  const draw=nextRandom(rng);rng=draw.state;
  const state={...createMatch(draw.word,{mode:'shared-deferred'}),augmentTierSeed:seed,openingEncounter:bindSharedOpeningEncounter(createOpeningEncounter(seed),'test-room',`s${index}`)};
  if(generateChoices(augmentCandidates(resolveAugmentTier(state,'round:2-1:augment'),[],[],openingEncounterId(state),{node:'2-1',fieldedTraits:[],blocked:[]}),state.choiceRngState).offers.includes('two-much-value')){found={seed,seatId:`s${index}`};break;}
 }
}
if(!found)throw Error('no room seed in 0..100');
const {seatId}=found;
const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:found.seed});
// Test-owned opening snapshots: expected rewards must not depend on production augment-history facts.
const openingRosters=new Map<number,readonly Unit[]>();
const unsubscribe=room.subscribe(current=>{
 if(current.phase!=='battle'||current.roundKind==='supply'||openingRosters.has(current.round))return;
 const match=current.seats.find(s=>s.seatId===seatId)!.match;
 if(match.augments.some(a=>a.definitionId==='two-much-value'))openingRosters.set(current.round,structuredClone(match.preparation.units.filter(u=>u.team==='player')));
});
const rosterCredits=(units:readonly Unit[])=>Math.floor(new Set(units.filter(u=>u.team==='player'&&u.location.kind==='board'&&COST[u.definitionId]===2).map(u=>u.definitionId)).size/2);
const openingCredits=(round:number)=>[...openingRosters].filter(([ordinal])=>ordinal<round).reduce((sum,[,units])=>sum+rosterCredits(units),0);
function expectProjectedRerolls(match:MatchState,expected:number){
 const view=toSeatPrivateView(match),wire=JSON.parse(JSON.stringify(view)),display=toDisplayMatch(wire);
 expect(view.freeRerollsAvailable).toBe(expected);
 expect(freeRerollsAvailable(match)).toBe(expected);
 expect(readFreeRerollsAvailable(display)).toBe(expected);
 expect(display.augmentHistory).toBeUndefined();
 for(const key of ['augmentHistory','augment-history-v1','pvp-roster','combat-roster','proof','rngState','resourceProvenance'])expect(JSON.stringify(wire)).not.toContain(`"${key}"`);
 expect(JSON.stringify(toPlayerView(room.state,seatId,clock.now()))).not.toContain('"freeRerollsAvailable"');
 // Reconnect/resend reads the same current count without spending anything.
 expect(readFreeRerollsAvailable(toDisplayMatch(JSON.parse(JSON.stringify(toSeatPrivateView(match)))))).toBe(expected);
 return display;
}
afterAll(()=>{unsubscribe();room.dispose();});
it('starts the room',()=>{room.start();});
for(const roundId of ['1-3','1-4','2-1'])it(`reaches room ${roundId}`,()=>{runUntilClaiming(room,clock,s=>s.roundId===roundId&&s.phase==='preparation');});
it('opens the real room choice',()=>{
 const c=room.state.seats.find(s=>s.seatId===seatId)!.match.pendingChoice!;expect(c.offers).toContain('two-much-value');
 expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'two-much-value'})).toMatchObject({ok:true});
 claimAllOrbs(room,[seatId]);
 const match=room.state.seats.find(s=>s.seatId===seatId)!.match;
 const pair=[...new Map(match.preparation.units.filter(u=>u.team==='player'&&COST[u.definitionId]===2).map(u=>[u.definitionId,u])).values()].slice(0,2);
 expect(pair).toHaveLength(2);
 for(const [col,unit] of pair.entries()){
  if(unit.location.kind==='board')continue;
  const units=room.state.seats.find(s=>s.seatId===seatId)!.match.preparation.units;
  const replaced=units.find(u=>u.team==='player'&&u.location.kind==='board'&&!pair.some(p=>p.id===u.id));
  const target=replaced?.location??{kind:'board' as const,cell:{col,row:match.preparation.board.deploymentZones.player.lastRow}};
  expect(room.handle(seatId,{type:'deploy',unitId:unit.id,target})).toMatchObject({ok:true});
 }
 expectProjectedRerolls(room.state.seats.find(s=>s.seatId===seatId)!.match,0);
});
it('uses the frozen room PvP roster on the next round and authenticates the online save',()=>{
 runUntilClaiming(room,clock,s=>s.roundId==='2-2'&&s.phase==='preparation');
 const s=room.state.seats.find(s=>s.seatId===seatId)!.match;expect(s.augmentHistory!.facts.some(f=>f.kind==='pvp-roster'&&f.round===4)).toBe(true);
 const row=s.augmentHistory!.facts.find(f=>f.kind==='pvp-roster'&&f.round===4)!;
 if(row.kind!=='pvp-roster')throw Error('missing PvP roster');
 const own=row.seats.find(x=>x.seatId===seatId)!;
 expect(own.units).toEqual(openingRosters.get(4));
 const expected=openingCredits(s.round);expect(expected).toBeGreaterThan(0);
 expect(twoMuchValueRerolls(s)).toBe(expected);
 const display=expectProjectedRerolls(s,expected);
 // The old HUD reader reproduces the reviewed fault on this very display state.
 expect(()=>freeRerollsAvailable(display)).toThrow('missing augment-history-v1');
 const {augmentHistory:_history,...missing}=s;
 expect(()=>toSeatPrivateView(missing as MatchState)).toThrow('missing augment-history-v1');
 const authority=room.augmentHistoryAuthority(seatId);expect(restoreSharedOrbSnapshot(room.state.pool,s,authority)).toEqual(s);
 const bad=structuredClone(s) as any;bad.augmentHistory.facts.find((f:any)=>f.kind==='pvp-roster').seats[0].hp++;
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,bad,authority)).toThrow();
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(bad),authority)).toThrow();
});
it('projects the remaining count after free and paid room rerolls, including refusal and resend',()=>{
 const before=room.state.seats.find(s=>s.seatId===seatId)!.match;
 const credits=openingCredits(before.round);
 for(let remaining=credits;remaining>0;remaining--){
  const previous=room.state.seats.find(s=>s.seatId===seatId)!.match;
  expect(room.handle(seatId,{type:'reroll'})).toMatchObject({ok:true});
  const current=room.state.seats.find(s=>s.seatId===seatId)!.match;
  expect(current.gold).toBe(previous.gold);expect(current.shop.generation).toBe(previous.shop.generation+1);
  expectProjectedRerolls(current,remaining-1);
 }
 const spent=room.state.seats.find(s=>s.seatId===seatId)!.match;
 expect(room.handle(seatId,{type:'buy',slot:0,generation:spent.shop.generation+1})).toMatchObject({ok:false});
 expect(room.state.seats.find(s=>s.seatId===seatId)!.match).toBe(spent);expectProjectedRerolls(spent,0);
 expect(room.handle(seatId,{type:'reroll'})).toMatchObject({ok:true});
 const paid=room.state.seats.find(s=>s.seatId===seatId)!.match;
 expect(paid.gold).toBe(spent.gold-2);expectProjectedRerolls(paid,0);
});
for(const roundId of ['2-3','2-4','2-5','2-6','2-7'])it(`reaches room ${roundId}`,()=>{
 runUntilClaiming(room,clock,s=>s.roundId===roundId&&(roundId==='2-4'||s.phase==='preparation'));
});
it('uses the actual streamed PvE roster at the next room entry',()=>{
 runUntilClaiming(room,clock,s=>s.roundId==='3-1'&&s.phase==='preparation');
 const s=room.state.seats.find(s=>s.seatId===seatId)!.match;
 const f=s.augmentHistory!.facts.find(f=>f.kind==='combat-roster'&&f.round===10);
 expect(f?.kind).toBe('combat-roster');
 expect(s.augmentHistory!.facts.filter(f=>f.kind==='combat-roster'&&f.round===10)).toHaveLength(1);
 expect(twoMuchValueRerolls(s)).toBe(freeRerollCredits({...s,augments:s.augments.filter(a=>a.definitionId==='two-much-value')}));
 expect([...openingRosters.keys()]).toEqual([4,5,6,8,9,10]);
 expect(twoMuchValueRerolls(s)).toBe(openingCredits(s.round));
 expectProjectedRerolls(s,openingCredits(s.round)-openingCredits(5));
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(s),room.augmentHistoryAuthority(seatId))).toEqual(s);
 const bad=structuredClone(s) as any;bad.augmentHistory.facts.find((x:any)=>x.kind==='combat-roster'&&x.round===10).roster.units=[];
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,bad,room.augmentHistoryAuthority(seatId))).toThrow();
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(bad),room.augmentHistoryAuthority(seatId))).toThrow();
});
