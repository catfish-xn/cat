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
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { freeRerollCredits } from './fixtures/m5/oracle.g2.cjs';

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
afterAll(()=>room.dispose());
it('starts the room',()=>{room.start();});
for(const roundId of ['1-3','1-4','2-1'])it(`reaches room ${roundId}`,()=>{runUntilClaiming(room,clock,s=>s.roundId===roundId&&s.phase==='preparation');});
it('opens the real room choice',()=>{
 const c=room.state.seats.find(s=>s.seatId===seatId)!.match.pendingChoice!;expect(c.offers).toContain('two-much-value');
 expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'two-much-value'})).toMatchObject({ok:true});
 claimAllOrbs(room,[seatId]);
});
it('uses the frozen room PvP roster on the next round and authenticates the online save',()=>{
 runUntilClaiming(room,clock,s=>s.roundId==='2-2'&&s.phase==='preparation');
 const s=room.state.seats.find(s=>s.seatId===seatId)!.match;expect(s.augmentHistory!.facts.some(f=>f.kind==='pvp-roster'&&f.round===4)).toBe(true);
 const row=s.augmentHistory!.facts.find(f=>f.kind==='pvp-roster'&&f.round===4)!;
 if(row.kind!=='pvp-roster')throw Error('missing PvP roster');
 const own=row.seats.find(x=>x.seatId===seatId)!;
 const ids=new Set(own.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&UNIT_DEFINITIONS[u.definitionId]?.cost===2).map(u=>u.definitionId));
 expect(twoMuchValueRerolls(s)).toBe(Math.floor(ids.size/2));
 const authority=room.augmentHistoryAuthority(seatId);expect(restoreSharedOrbSnapshot(room.state.pool,s,authority)).toEqual(s);
 const bad=structuredClone(s) as any;bad.augmentHistory.facts.find((f:any)=>f.kind==='pvp-roster').seats[0].hp++;
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,bad,authority)).toThrow();
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(bad),authority)).toThrow();
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
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(s),room.augmentHistoryAuthority(seatId))).toEqual(s);
 const bad=structuredClone(s) as any;bad.augmentHistory.facts.find((x:any)=>x.kind==='combat-roster'&&x.round===10).roster.units=[];
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,bad,room.augmentHistoryAuthority(seatId))).toThrow();
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(bad),room.augmentHistoryAuthority(seatId))).toThrow();
});
