import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH5_H1 } from '../src/simulation/content/augment-pool-batch5-h1';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { twoMuchValueRerolls } from '../src/simulation/augment-pool-batch5-h1-rerolls';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { freeRerollsAvailable } from '../src/simulation/free-rerolls';
import { rerollShop, selectChoice, startMatchCombat, stepMatch, nextRound, type MatchState } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { accepted, fieldBench, reachRound, resolveM5Choices } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import { freeRerollCredits } from './fixtures/m5/oracle.g2.cjs';

it.skipIf(!existsSync(RESEARCH_FILE))('registers source values and both permitted choice nodes',()=>{
 const row=AUGMENT_BATCH5_H1['two-much-value'];const src=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===row.apiName);
 expect(row.source.values).toEqual(src.effects);expect(src.tier).toBe(2);
 for(const node of ['2-1','3-2','4-2']){
  expect(augmentOfferAllowed('two-much-value',[],{node,fieldedTraits:[],blocked:[]})).toBe(node!=='4-2');
  expect(augmentCandidates('gold',[],[],null,{node,fieldedTraits:[],blocked:[]}).includes('two-much-value')).toBe(node!=='4-2');
 }
});
let state:MatchState;
it('selects through the real command and grants exactly two random 2-cost heroes',()=>{
 const s=reachRound('2-1',false,firstNodeSeed('two-much-value',101)),c=s.pendingChoice!;
 expect(c.offers).toContain('two-much-value');state=resolveM5Choices(accepted(selectChoice(s,c.choiceId,c.generation,'two-much-value')));
 const gifts=state.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch1'&&r.receiptId.includes('two-much-value'));
 expect(gifts).toHaveLength(2);expect(gifts.every(r=>r.kind==='unit'&&UNIT_DEFINITIONS[r.definitionId].cost===2)).toBe(true);
 expect(twoMuchValueRerolls(state)).toBe(0);
});
it('credits the next natural round from the actual previous combat roster',()=>{
 state=fieldBench(state);
 const expected=Math.floor(new Set(state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&UNIT_DEFINITIONS[u.definitionId].cost===2).map(u=>u.definitionId)).size/2);
 expect(expected).toBeGreaterThan(0);
 state=accepted(startMatchCombat(state));while(state.phase==='combat')state=stepMatch(state).state;
 state=resolveM5Choices(state);state=resolveM5Choices(accepted(nextRound(state,state.round)));
 expect(twoMuchValueRerolls(state)).toBe(expected);expect(freeRerollCredits(state)).toBe(expected);expect(freeRerollsAvailable(state)).toBeGreaterThanOrEqual(expected);
 const before=state;state=accepted(rerollShop(state));expect(state.gold).toBe(before.gold);
});
it('round trips through object, JSON and serialized saves',()=>{
 const text=serializeMatch(state);expect(restoreMatch(state)).toEqual(state);expect(restoreMatch(JSON.stringify(state))).toEqual(state);expect(restoreMatch(text)).toEqual(state);
});
const attacks: readonly [string,(x:any)=>void][]=[
 ['changed roster',x=>{x.augmentHistory.facts.find((f:any)=>f.kind==='combat-roster').roster.units[0].definitionId='invalid-forgery';}],
 ['missing roster',x=>{x.augmentHistory.facts=x.augmentHistory.facts.filter((f:any)=>f.kind!=='combat-roster');}],
 ['changed gift',x=>{x.seatMechanics.receipts.find((r:any)=>r.receiptId.includes('two-much-value')).definitionId='irelia';}],
 ['missing command',x=>{x.augmentHistory.proof.commands.pop();}],
];
it.each(attacks)('rejects %s at all restore entries',(_name,mutate)=>{
 const x=structuredClone(state);mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();
});

it('counts distinct fielded IDs in PvE, excludes bench and duplicate copies, and does not pay twice across supply',()=>{
 const sample=state.augmentHistory!.facts.find(f=>f.kind==='combat-roster')!;
 if(sample.kind!=='combat-roster')throw Error('missing roster');
 const field=sample.roster.units.find(u=>u.team==='player'&&u.location.kind==='board'&&UNIT_DEFINITIONS[u.definitionId].cost===2)!;
 const another=Object.values(UNIT_DEFINITIONS).find(u=>u.cost===2&&!u.summon&&u.unitKind!=='neutral'&&u.id!==field.definitionId)!;
 const roster={...sample.roster,units:[field,{...field,id:'duplicate'}, {...field,id:'different',definitionId:another.id},
   {...field,id:'benched',location:{kind:'bench' as const,slot:0}}]};
 const fake={...state,round:12,augments:[{definitionId:'two-much-value',choiceId:'fixture',acquiredRound:10}],
  augmentHistory:{...state.augmentHistory!,facts:[{...sample,round:10,roundId:'2-7',roster},{...sample,round:11,roundId:'3-1',roster}]}} as MatchState;
 expect(twoMuchValueRerolls(fake)).toBe(2);
 const supply={...fake,round:8,augments:[{definitionId:'two-much-value',choiceId:'fixture',acquiredRound:6}],
  augmentHistory:{...fake.augmentHistory!,facts:[{...sample,round:6,roundId:'2-3',roster}]}} as MatchState;
 expect(twoMuchValueRerolls(supply)).toBe(1);
});
