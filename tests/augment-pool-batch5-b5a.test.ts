import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import oracle from './fixtures/m5/augment-pool-batch5-b5a.cjs';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { AUGMENT_BATCH5_B5A } from '../src/simulation/content/augment-pool-batch5-b5a';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { selectChoice, equipItem, type MatchState } from '../src/simulation/match';
import { accepted, reachRound } from './match-helpers';
import { firstNodeSeed, offerFor, STAGE_SEEDS } from './augment-stage-helpers';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { augmentPool, augmentGold } from './fixtures/m5/oracle.g2.cjs';

const ids=['all-that-shimmers','all-that-shimmers-plus'] as const;
it('the public 3-2 route offers the plus version',()=>{
 const state=reachRound('3-2',false,STAGE_SEEDS['all-that-shimmers-plus'].seed);
 expect(state.pendingChoice?.offers).toContain('all-that-shimmers-plus');
});
it.skipIf(!existsSync(RESEARCH_FILE)).each(ids)('%s matches archived source numbers',id=>{
 const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((row:any)=>row.apiName===oracle[id].apiName);
 expect(source.effects).toEqual(oracle[id].values); expect(AUGMENT_BATCH5_B5A[id].source.values).toEqual(oracle[id].values);
});
it.each(ids)('%s follows independent tier, node and exclusion table',id=>{
 for(const node of ['2-1','3-2','4-2']){
  const allowed=oracle[id].allowed.includes(node);
  expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(allowed);
  expect(augmentPool('gold',[],[],`round:${node}:augment`,[]).includes(id)).toBe(allowed);
 }
 const other=ids.find(value=>value!==id)!;
 expect(augmentOfferAllowed(id,[{definitionId:other,choiceId:'x',acquiredRound:1}])).toBe(false);
});
function roundTrip(s:MatchState){ const text=serializeMatch(s);expect(restoreMatch(text)).toEqual(s);expect(restoreMatch(JSON.parse(text))).toEqual(s);expect(restoreMatch(s)).toEqual(s); }
function reject(s:MatchState,mutate:(state:any)=>void){const altered=JSON.parse(serializeMatch(s));mutate(altered);expect(()=>restoreMatch(altered)).toThrow();expect(()=>restoreMatch(JSON.stringify(altered))).toThrow();expect(()=>serializeMatch(altered)).toThrow();}
it.each(ids)('%s grants fixed artifacts, remover and correct gold through real choices and validates restoration',id=>{
 const before=id==='all-that-shimmers'?reachRound('2-1',false,firstNodeSeed(id)):offerFor(id);
 const augment=before.pendingChoice!;expect(augment.offers).toContain(id);
 let state=accepted(selectChoice(before,augment.choiceId,augment.generation,id));
 expect(state.gold-before.gold).toBe(oracle[id].gold);expect(augmentGold(id,before.roundDefinitionId)).toBe(oracle[id].gold);
 const choice=state.pendingChoice!;expect(choice.kind).toBe('forge');expect(choice.offers).toEqual(oracle.items);
 expect(state.consumables.length-before.consumables.length).toBe(1);roundTrip(state);
 reject(state,x=>{x.pendingChoice.offers[0]='deathblade';});
 const result=selectChoice(state,choice.choiceId,choice.generation,'deathblade');expect(result.ok).toBe(false);expect(result.state).toBe(state);
 state=accepted(selectChoice(state,choice.choiceId,choice.generation,choice.offers[1]));
 expect(state.items.some(item=>item.definitionId===oracle.items[1])).toBe(true);roundTrip(state);
 reject(state,x=>{x.seatMechanics.receipts.find((r:any)=>r.receiptId===choice.choiceId).optionId='deathblade';});
 reject(state,x=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>r.receiptId!==choice.choiceId);});
 reject(state,x=>{x.seatMechanics.receipts.find((r:any)=>r.receiptId.endsWith(':remover')).definitionId='reforger';});
});

it.skipIf(!existsSync(RESEARCH_FILE))('Roll the Dice retains the archived source fields',()=>{
 const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((row:any)=>row.apiName===oracle['roll-the-dice'].apiName);
 expect(source.effects).toEqual(oracle['roll-the-dice'].values);expect(AUGMENT_BATCH5_B5A['roll-the-dice'].source.values).toEqual(source.effects);
});
it('Roll the Dice is offered at its 14.24 nodes and grants the existing radiant glove through a real choice',()=>{
 const id='roll-the-dice';for(const node of ['2-1','3-2','4-2']){
  const allowed=oracle[id].allowed.includes(node);expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(allowed);
  expect(augmentPool('prismatic',[],[],`round:${node}:augment`,[]).includes(id)).toBe(allowed);
 }
 const before=offerFor(id),choice=before.pendingChoice!;expect(choice.offers).toContain(id);
 let state=accepted(selectChoice(before,choice.choiceId,choice.generation,id));
 const gift=state.items.find(item=>item.definitionId===oracle[id].item)!;expect(gift).toBeDefined();roundTrip(state);
 reject(state,x=>{x.seatMechanics.receipts.find((r:any)=>r.definitionId===oracle[id].item).definitionId='blue-buff';});
 reject(state,x=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>r.definitionId!==oracle[id].item);});
 const holder=state.preparation.units.find(unit=>unit.team==='player')!;state=accepted(equipItem(state,gift.id,holder.id,0));
 const children=state.temporaryEquipment.filter(item=>item.parentItemInstanceId===gift.id);expect(children).toHaveLength(2);
 expect(children.every(item=>['completed','component'].includes(ITEM_DEFINITIONS[item.definitionId].kind))).toBe(true);roundTrip(state);
 reject(state,x=>{x.equipmentState.rolls.find((r:any)=>r.parentItemInstanceId===gift.id).children[0]='blue-buff';});
});
