import { beforeAll, expect, it } from 'vitest';
import { createMatch, selectChoice, nextRound, startMatchCombat, stepMatch, buyUnit, deployMatchUnit, buyXp, getDeploymentCap, type MatchState, type MatchCommandResult } from '../src/simulation/match';
import { deferredRoundIncome } from '../src/simulation/deferred-income';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
let advanced:MatchState,previous:MatchState,result:MatchCommandResult;
beforeAll(()=>{
 let s=createMatch(61);
 for(let guard=0;guard<20&&s.roundDefinitionId!=='2-4';guard++){
  while(s.phase==='choice'){const c=s.pendingChoice!,selected=c.offers.includes('diversified-portfolio')?'diversified-portfolio':c.offers[0];const r=selectChoice(s,c.choiceId,c.generation,selected);if(!r.ok)throw Error(r.reason);s=r.state;}
  if(s.phase==='settlement'){previous=s;result=nextRound(s,s.round);if(!result.ok)throw Error(result.reason);s=result.state;continue;}
  if(s.phase!=='preparation')throw Error(s.phase);
  if(s.augments.some(a=>a.definitionId==='diversified-portfolio')){
   for(const slot of s.shop.slots){if(slot.status!=='available'||s.gold<2||s.preparation.units.some(u=>u.team==='player'&&u.definitionId===slot.definitionId))continue;
    const r=buyUnit(s,s.shop.slots.indexOf(slot),s.shop.generation);if(r.ok)s=r.state;}
   while(s.gold>=4&&getDeploymentCap(s)<5){const r=buyXp(s);if(!r.ok)break;s=r.state;}
  }
  for(const u of s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench')){
   if(s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').length>=getDeploymentCap(s))break;
   for(let col=0;col<7;col++){if(s.preparation.units.some(v=>v.team==='player'&&v.location.kind==='board'&&v.location.cell.col===col&&v.location.cell.row===4))continue;
    const r=deployMatchUnit(s,u.id,{kind:'board',cell:{col,row:4}});if(r.ok){s=r.state;break;}}
  }
  const battle=startMatchCombat(s);if(!battle.ok)throw Error(battle.reason);s=battle.state;while(s.phase==='combat')s=stepMatch(s).state;
 }
 advanced=s;
});
it('B5-32 pays exactly one gold for three real active traits at the next entry',()=>{
 expect(advanced.roundDefinitionId).toBe('2-4');
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
