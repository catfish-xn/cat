import { canonicalContent } from '../src/simulation/content';
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { AUGMENT_BATCH5_H10 } from '../src/simulation/content/augment-pool-batch5-h10';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { selectChoice, deployMatchUnit, startMatchCombat, nextRound, rerollShop, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readSniperOpening } from '../src/simulation/augment-pool-batch5-h10-sniper';
import { accepted, reachRound, finish, resolveM5Choices } from './match-helpers';
import { requireAugmentFacts } from '../src/simulation/augment-history';
const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
let acquired:MatchState, opening:MatchState, advanced:MatchState, zeri:string;
beforeAll(()=>{
 const s=reachRound('2-1',false,3),c=s.pendingChoice!;expect(c.offers).toContain('snipers-nest');
 acquired=accepted(selectChoice(s,c.choiceId,c.generation,'snipers-nest'));
 zeri=acquired.preparation.units.find(u=>u.definitionId==='zeri')!.id;
 opening=accepted(startMatchCombat(accepted(deployMatchUnit(acquired,zeri,{kind:'board',cell:{col:1,row:7}}))));
 advanced=accepted(nextRound(resolveM5Choices(finish(opening)),opening.round));
});
it.skipIf(!existsSync(RESEARCH_FILE))('matches the pinned 14.24 numbers and Zeri gift',()=>{
 const row=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName==='TFT13_Augment_Sniper');
 expect(AUGMENT_BATCH5_H10['snipers-nest'].source.values).toEqual(row.effects);
 expect(row.description_en_us).toContain('Gain a Zeri');
});
it('offers gold at all three nodes, with later sniper tailoring',()=>{
 for(const node of ['2-1','3-2','4-2']){
  const pool=(traits:string[])=>augmentCandidates('gold',[],[],null,{node,fieldedTraits:traits,blocked:[]});
  expect(pool(['sniper'])).toContain('snipers-nest');
  expect(pool([]).includes('snipers-nest')).toBe(node==='2-1');
 }
});
it('real select/deploy/start commands grant Zeri and compile 8%, then 16%; move and bench reset',()=>{
 expect(acquired.augmentHistory!.facts[0]).toMatchObject({kind:'acquire',definitionId:'snipers-nest'});
 expect(opening.combat!.strategy!.units.find(u=>u.unitId===zeri)!.mechanics).toContainEqual(expect.objectContaining({mechanic:'damageAmp',values:{bps:800}}));
 expect(requireAugmentFacts(advanced,'combat-roster',opening.round)).toHaveLength(1);
 expect(readSniperOpening(advanced)![zeri]).toBe(1600);
 const moved=accepted(deployMatchUnit(advanced,zeri,{kind:'board',cell:{col:2,row:7}}));
 expect(readSniperOpening(moved)![zeri]).toBe(800);
 const used=new Set(advanced.preparation.units.flatMap(u=>u.location.kind==='bench'?[u.location.slot]:[]));
 const slot=Array.from({length:9},(_,i)=>i).find(i=>!used.has(i))!;
 const benched=accepted(deployMatchUnit(advanced,zeri,{kind:'bench',slot}));
 expect(readSniperOpening(benched)![zeri]).toBeUndefined();
 const back=accepted(deployMatchUnit(benched,zeri,{kind:'board',cell:{col:1,row:7}}));
 expect(readSniperOpening(back)![zeri]).toBe(800);
 expect(restoreMatch(back)).toEqual(back);
 const failure=deployMatchUnit(advanced,'absent',{kind:'bench',slot:0});expect(failure.ok).toBe(false);expect(failure.state).toBe(advanced);expect('events' in failure).toBe(false);
});
const entries=['object','JSON','serialized'] as const;
function restore(s:MatchState,entry:typeof entries[number]) {return restoreMatch(entry==='object'?s:entry==='JSON'?JSON.stringify(s):serializeMatch(s));}
for(const entry of entries)describe(entry,()=>{
 it('round trips acquisition, frozen combat and later opening history; continuation is identical',()=>{
  for(const state of [acquired,opening,advanced])expect(restore(state,entry)).toEqual(state);
  expect(rerollShop(restore(advanced,entry))).toEqual(rerollShop(advanced));
 });
 for(const [name,edit] of [
  ['missing history',(s:any)=>{delete s.augmentHistory;}],
  ['wrong version',(s:any)=>{s.augmentHistory.version='fake';}],
  ['opening cell',(s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='combat-roster').roster.units.find((u:any)=>u.id===zeri).location.cell.col++;}],
  ['removed opening',(s:any)=>{s.augmentHistory.facts=s.augmentHistory.facts.filter((f:any)=>f.kind!=='combat-roster');s.augmentHistory.facts.forEach((f:any,i:number)=>f.sequence=i);}],
  ['frozen damage',(s:any)=>{s.combatInputBasis.inputs.sniperOpening[zeri]=3200;}],
  ['removed gift',(s:any)=>{s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>r.definitionId!=='zeri');}],
 ] as const)it(`rejects ${name}`,()=>{const source=name==='frozen damage'?opening:advanced;const bad=entry==='serialized'?JSON.parse(serializeMatch(source)):structuredClone(source);edit(bad);expect(()=>restoreMatch(entry==='object'?bad:entry==='JSON'?JSON.stringify(bad):canonicalContent(bad))).toThrow();});
});
