import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH5_S1B } from '../src/simulation/content/augment-pool-batch5-s1b';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { rerollTransferCredits } from '../src/simulation/augment-pool-batch5-s1b';
import { freeRerollsAvailable } from '../src/simulation/free-rerolls';
import { createMatch, nextRound, rerollAugment, rerollShop, selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, resolveM5Choices } from './match-helpers';

it.skipIf(!existsSync(RESEARCH_FILE))('Reroll Transfer source values',()=>{
 const row=AUGMENT_BATCH5_S1B['reroll-transfer'];const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((x:any)=>x.apiName===row.apiName);
 expect(row.source.values).toEqual(source.effects);expect(row.tier).toBe(['silver','gold','prismatic'][source.tier-1]);
});
it('offers only at 2-1',()=>{for(const node of ['2-1','3-2','4-2']){
 const filter={node,fieldedTraits:[],blocked:[]};expect(augmentOfferAllowed('reroll-transfer',[],filter)).toBe(node==='2-1');
 expect(augmentCandidates('silver',[],[],null,filter).includes('reroll-transfer')).toBe(node==='2-1');
}});
it('counts only closed later choices, including every remaining-budget value and cumulative nodes',()=>{
 const base=createMatch(0), owner={definitionId:'reroll-transfer',choiceId:'round:2-1:augment',acquiredRound:4};
 for(const used of [0,1,2,3]){
  const offer={choiceId:'round:3-2:augment',rerollCount:used};
  const s={...base,round:11,augments:[owner],augmentOffers:[offer],scheduleReceipts:[{kind:'augment',eventId:offer.choiceId,round:11}]} as unknown as MatchState;
  expect(rerollTransferCredits(s)).toBe((3-used)*3);
  expect(rerollTransferCredits({...s,scheduleReceipts:[]})).toBe(0);
  expect(rerollTransferCredits({...s,round:4})).toBe(0);
 }
 const s={...base,round:17,augments:[owner],augmentOffers:[{choiceId:'round:3-2:augment',rerollCount:1},{choiceId:'round:4-2:augment',rerollCount:2}],scheduleReceipts:[{kind:'augment',eventId:'round:3-2:augment',round:11},{kind:'augment',eventId:'round:4-2:augment',round:17}]} as unknown as MatchState;
 expect(rerollTransferCredits(s)).toBe(9);
});
let state:MatchState;
for(const stop of ['1-2','1-3','2-1'])it(`public route to ${stop}`,()=>{
 state ??= createMatch(101); // First direct offer on the merged 250-card pool; no runtime seed scan.
 while(state.roundDefinitionId!==stop){state=resolveM5Choices(state);if(state.phase==='preparation'){state=accepted(startMatchCombat(emptyBoard(state)));while(state.phase==='combat')state=stepMatch(state).state;}state=resolveM5Choices(state);state=accepted(nextRound(state,state.round));}
});
it('acquisition gives 3 gold and excludes its own node',()=>{
 const c=state.pendingChoice!,gold=state.gold;state=accepted(selectChoice(state,c.choiceId,c.generation,'reroll-transfer'));
 expect(state.gold-gold).toBe(3);expect(rerollTransferCredits(state)).toBe(0);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
});
for(const stop of ['2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2'])it(`public route to ${stop}`,()=>{
 while(state.roundDefinitionId!==stop){state=resolveM5Choices(state);if(state.phase==='preparation'){state=accepted(startMatchCombat(emptyBoard(state)));while(state.phase==='combat')state=stepMatch(state).state;}state=resolveM5Choices(state);state=accepted(nextRound(state,state.round));}
});
it('unused later rerolls become spendable only after selection and restore rejects tampering',()=>{
 expect(state.pendingChoice?.kind).toBe('augment');const c=state.pendingChoice!;
 state=accepted(rerollAugment(state,c.choiceId,c.generation,0));expect(rerollTransferCredits(state)).toBe(0);
 const choice=state.pendingChoice!;state=accepted(selectChoice(state,choice.choiceId,choice.generation,choice.offers[0]));
 expect(rerollTransferCredits(state)).toBe(6);const before=state;state=accepted(rerollShop(state));expect(state.gold).toBe(before.gold);expect(freeRerollsAvailable(state)).toBeGreaterThanOrEqual(5);
 const text=serializeMatch(state);expect(restoreMatch(text)).toEqual(state);expect(restoreMatch(JSON.parse(text))).toEqual(state);expect(restoreMatch(structuredClone(state))).toEqual(state);
 for(const mutate of [
  (x:any)=>{x.augmentOffers.at(-1).rerollCount=0;},
  (x:any)=>{x.scheduleReceipts.find((r:any)=>r.definitionId==='reroll-transfer').gold++;},
  (x:any)=>{x.seatMechanics.seat['free-shop-rerolls'].used++;},
  (x:any)=>{delete x.shopHistory;},
 ]){const x=JSON.parse(text);mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();}
});
