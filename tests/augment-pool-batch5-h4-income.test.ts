import { accepted, reachRound, resolveM5Choices } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import { beforeAll, expect, it } from 'vitest';
import { nextRound, startMatchCombat, stepMatch, buyUnit, deployMatchUnit, rerollShop, sellUnit, type MatchState, type MatchCommandResult } from '../src/simulation/match';
import { deferredRoundIncome } from '../src/simulation/deferred-income';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
let advanced:MatchState,previous:MatchState,result:MatchCommandResult;
beforeAll(()=>{
 const roster=['irelia','rell','vex','morgana','akali'];
 let s=reachRound('3-1',true,firstNodeSeed('diversified-portfolio'),['diversified-portfolio']);
 for(const unit of s.preparation.units.filter(u=>u.team==='player'&&!roster.includes(u.definitionId)))s=accepted(sellUnit(s,unit.id));
 const owns=(id:string)=>s.preparation.units.some(u=>u.team==='player'&&u.definitionId===id);
 for(let rolls=0;rolls<=30&&!roster.every(owns);rolls++){
  for(const [slot,offer]of s.shop.slots.entries())if(offer.status==='available'&&roster.includes(offer.definitionId)&&!owns(offer.definitionId))s=accepted(buyUnit(s,slot,s.shop.generation));
  if(!roster.every(owns)&&rolls<30)s=accepted(rerollShop(s));
 }
 expect(roster.every(owns)).toBe(true);
 for(const [col,id]of roster.entries()){
  const unit=s.preparation.units.find(u=>u.team==='player'&&u.definitionId===id)!;
  s=accepted(deployMatchUnit(s,unit.id,{kind:'board',cell:{col,row:4}}));
 }
 s=accepted(startMatchCombat(s));while(s.phase==='combat')s=stepMatch(s).state;
 previous=resolveM5Choices(s);result=nextRound(previous,previous.round);advanced=accepted(result);
});
it('B5-32 pays exactly one gold for three real active traits at the next entry',()=>{
 expect(advanced.roundDefinitionId).toBe('3-2');
 const active=deriveTraits(previous.preparation,'player',TRAIT_DEFINITIONS,undefined,previous.items).filter(t=>t.tier>0&&!(TRAIT_DEFINITIONS[t.traitId].tiers.length===1&&TRAIT_DEFINITIONS[t.traitId].tiers[0].threshold===1)).map(t=>t.traitId);
 expect(active).toEqual(['rebel','sentinel','visionary']);
 expect(advanced.gold).toBe(previous.gold+deferredRoundIncome(previous.roundResults.at(-1)!)+1);
 expect(advanced.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch5-h4')).toMatchObject([{round:advanced.round,kind:'gold',amount:1}]);
 expect(result.ok&&result.events.some(e=>e.type==='mechanicGranted'&&e.receipt.source==='augment-pool-batch5-h4')).toBe(true);
 expect(nextRound(advanced,previous.round)).toMatchObject({ok:false,state:advanced});
});
let serialized:string;
it('B5-32 serializes the real recurring reward',()=>{serialized=serializeMatch(advanced);expect(typeof serialized).toBe('string');});
for(const format of ['object','json','serialized'] as const){
 const input=(v:MatchState)=>format==='object'?v:format==='serialized'&&v===advanced?serialized:JSON.stringify(v);
 it(`B5-32 ${format} round trip`,()=>expect(restoreMatch(input(advanced))).toEqual(advanced));
 for(const [name,mutate] of [
  ['reward',(v:any)=>{v.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5-h4').amount++;}],
  ['history',(v:any)=>{v.augmentHistory.facts.find((f:any)=>f.kind==='round-entry'&&f.round===v.round).roster.units.pop();}],
 ] as const) it(`B5-32 ${format} rejects edited ${name}`,()=>{
  const bad=structuredClone(advanced);mutate(bad);expect(()=>restoreMatch(input(bad))).toThrow();
 });
}
