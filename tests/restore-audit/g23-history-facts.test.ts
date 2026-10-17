import {describe,it,expect} from 'vitest';
import {createMatch,startMatchCombat,stepMatch,nextRound,selectChoice,type MatchState} from '../../src/simulation/match';
import {restoreMatch,serializeMatch} from '../../src/simulation/serialization';
import {createG23Progress} from '../../src/simulation/g2-3-match-progress';
import {readG23Progress,writeG23Progress} from '../../src/simulation/g2-3-state';
import {advanceG23Economy,type G23BattleFacts} from '../../src/simulation/g2-3-economy';
const ok=(r: {ok:boolean;state:MatchState;reason?:string})=>{if(!r.ok)throw Error(r.reason);return r.state;};
function preparationAfterFirstBattle(){
 let s=ok(startMatchCombat(createMatch(42)));
 while(s.phase==='combat')s=stepMatch(s).state;
 while(s.phase==='choice')s=ok(selectChoice(s,s.pendingChoice!.choiceId,s.pendingChoice!.generation,s.pendingChoice!.offers[0]));
 s=ok(nextRound(s,s.round));
 expect(s.round).toBe(2);expect(s.combat).toBeNull();
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
 return s;
}
function falsifyHistoricalFacts(s:MatchState,change:Partial<G23BattleFacts>){
 const p=readG23Progress(s)!,receipt=p.economyReceipts[0];
 if(receipt.kind!=='battle')throw Error('expected public battle receipt');
 const facts={...receipt.facts,...change};
 const forged=advanceG23Economy(createG23Progress(s.seed),facts).progress;
 return writeG23Progress(structuredClone(s),forged);
}
describe('read-only audit: historical G23 facts are not independently bound',()=>{
 it('accepts a nonexistent Conqueror participant and fabricated victim in a completed historical battle',()=>{
  const s=preparationAfterFirstBattle();
  const f=falsifyHistoricalFacts(s,{conquerorTier:2,conquestTakedowns:['audit-nonexistent-victim']});
  expect(readG23Progress(s)!.conquest.stacks).toBe(0);
  expect(readG23Progress(f)!.conquest.stacks).toBeGreaterThan(0);
  expect(restoreMatch(f)).toEqual(f);
  expect(restoreMatch(JSON.stringify(f))).toEqual(f);
 });
 it('accepts fabricated Chem Baron participation and Shimmer with no such opening trait',()=>{
  const s=preparationAfterFirstBattle();
  const f=falsifyHistoricalFacts(s,{chemBaronTier:3,alliedDeaths:0});
  expect(readG23Progress(s)!.chem.shimmer).toBe(0);
  expect(readG23Progress(f)!.chem.shimmer).toBeGreaterThan(0);
  expect(restoreMatch(f)).toEqual(f);
  expect(restoreMatch(JSON.stringify(f))).toEqual(f);
 });
 it('accepts fabricated Rumble participation and advances his armory round counter',()=>{
  const s=preparationAfterFirstBattle();
  const f=falsifyHistoricalFacts(s,{rumbleStar:1});
  expect(readG23Progress(s)!.junkerRounds).toBe(0);
  expect(readG23Progress(f)!.junkerRounds).toBe(1);
  expect(restoreMatch(f)).toEqual(f);
  expect(restoreMatch(JSON.stringify(f))).toEqual(f);
 });
});
