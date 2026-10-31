import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH5_S3B } from '../src/simulation/content/augment-pool-batch5-s3b';
import { academicResearchOffers } from '../src/simulation/augment-pool-batch5-s3b';
import { G24_FORGE_POOLS } from '../src/simulation/content/g2-4-forges';
import { createG23Progress } from '../src/simulation/g2-3-match-progress';

it.skipIf(!existsSync(RESEARCH_FILE))('academic research preserves 14.24 numeric effects', () => {
  const source = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')).find((r: {apiName:string}) => r.apiName === AUGMENT_BATCH5_S3B['academic-research'].apiName);
  expect(AUGMENT_BATCH5_S3B['academic-research'].source.values).toEqual(source.effects);
});
it('academic research offers the craft and a distinct sponsor deterministically', () => {
  for (let seed = 0; seed <= 100; seed++) {
    const sponsors = createG23Progress(seed).sponsored;
    for (const crafted of G24_FORGE_POOLS.TFT_ArmoryKeyCompleted) {
      const offers = academicResearchOffers(seed, 'craft:1', crafted, sponsors);
      expect(offers).toHaveLength(2);
      expect(offers[0]).toBe(crafted);
      expect(sponsors).toContain(offers[1]);
      expect(offers[1]).not.toBe(crafted);
      expect(academicResearchOffers(seed, 'craft:1', crafted, sponsors)).toEqual(offers);
    }
  }
  expect(() => academicResearchOffers(0, 'craft:1', 'not-an-item', ['a', 'b', 'c'])).toThrow();
});

import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { combineItems, equipItem, selectChoice, sellUnit, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, finish, reachRoundFielded, resolveM5Choices } from './match-helpers';
import { batch5S3bSeed, boundedFirstNodeOffer } from './augment-stage-helpers';
import { academicGiftPlan } from '../src/simulation/augment-pool-batch5-s3b';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';

function chooseAcademic(){
 const s=reachRoundFielded('2-1',batch5S3bSeed('academic-research')),c=s.pendingChoice!;
 expect(c.offers).toContain('academic-research');return accepted(selectChoice(s,c.choiceId,c.generation,'academic-research'));
}
function trip(s:MatchState){const text=serializeMatch(s);expect(restoreMatch(text)).toEqual(s);expect(restoreMatch(JSON.parse(text))).toEqual(s);expect(restoreMatch(s)).toEqual(s);}
function reject(s:MatchState,mutate:(x:any)=>void){const x=JSON.parse(serializeMatch(s));mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();}
it('academic research is offered only at 2-1 and 3-2, including the independent oracle',()=>{
 for(const node of ['2-1','3-2','4-2']){
  // A matching fielded trait satisfies tailoring at later nodes.
  const context={node,fieldedTraits:['academy'],blocked:[]};
  expect(augmentOfferAllowed('academic-research',[],context)).toBe(node!=='4-2');
  expect(augmentPool('gold',[],[],`round:${node}:augment`,['academy']).includes('academic-research')).toBe(node!=='4-2');
 }
});
it.each(['inventory','equipped'] as const)('academic research converts a real %s craft, opens two choices, restores and rejects tampering',mode=>{
 let s=chooseAcademic();trip(s);
 const initial=s.items.length,parts=s.items.filter(i=>i.location.kind==='inventory');expect(parts.length).toBeGreaterThanOrEqual(2);
 if(mode==='inventory')s=accepted(combineItems(s,parts[0].id,parts[1].id));
 else {const holder=s.preparation.units.find(u=>u.team==='player')!;s=accepted(equipItem(s,parts[0].id,holder.id,0));s=accepted(equipItem(s,parts[1].id,holder.id,0));}
 expect(s.items).toHaveLength(initial-2);
 const gifts=academicGiftPlan(s);expect(gifts).toHaveLength(1);
 const r=s.seatMechanics!.receipts.find(r=>r.receiptId===gifts[0].receiptId)!;expect(r.kind).toBe('unit');if(r.kind!=='unit')throw Error('unit');
 trip(s);
 reject(s,x=>{x.seatMechanics.receipts.find((r:any)=>r.receiptId===gifts[0].receiptId).definitionId='TFT_ArmoryKeyOrnn';});
 reject(s,x=>{
  const entries=x.resourceProvenance.entries,receipt=x.seatMechanics.receipts.find((r:any)=>r.receiptId===gifts[0].receiptId);
  const birthIndex=entries.findIndex((e:any)=>e.kind==='unit-acquired'&&e.source.receiptId===receipt.receiptId),craftIndex=entries.findIndex((e:any)=>e.kind==='item-combined');
  const [birth]=entries.splice(birthIndex,1);entries.splice(craftIndex,0,birth);entries.forEach((e:any,i:number)=>e.sequence=i);
  const key=JSON.parse(receipt.receiptId);key[4]=craftIndex+1;receipt.receiptId=JSON.stringify(key);birth.source.receiptId=receipt.receiptId;
 });
 reject(s,x=>{x.resourceProvenance.entries.find((e:any)=>e.kind==='item-combined').event.definitionId='blue-buff';});
 s=accepted(sellUnit(s,r.unitId!));expect(s.pendingChoice!.offers).toHaveLength(2);trip(s);
 reject(s,x=>{x.pendingChoice.offers.reverse();});
 const c=s.pendingChoice!,picked=c.offers[1];s=accepted(selectChoice(s,c.choiceId,c.generation,picked));expect(s.items.at(-1)!.definitionId).toBe(picked);trip(s);
 reject(s,x=>{x.items.at(-1).definitionId='blue-buff';});
 const repeated=selectChoice(s,c.choiceId,c.generation,picked);expect(repeated.ok).toBe(false);expect(repeated.state).toBe(s);
});

import { startMatchCombat, stepMatch, deployMatchUnit } from '../src/simulation/match';
it('academic research removes a combat craft from the battle equipment transcript and defers its anvil until settlement',()=>{
 // v26 fielded 2-1 of the whole bench crossed the 5s case limit under CI load (5164ms).
 // One board unit still crafts during combat and defers the anvil until settlement.
 let s=emptyBoard(chooseAcademic());
 s=accepted(deployMatchUnit(s,s.preparation.units.find(u=>u.team==='player')!.id,{kind:'board',cell:{col:1,row:4}}));
 const parts=s.items.filter(i=>i.location.kind==='inventory'),u=s.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;
 expect(parts.length).toBeGreaterThanOrEqual(2);
 s=accepted(equipItem(s,parts[0].id,u.id,0));s=accepted(startMatchCombat(s));expect(s.phase).toBe('combat');
 s=accepted(equipItem(s,parts[1].id,u.id,0));expect(s.items.some(i=>i.location.kind==='unit'&&i.location.unitId===u.id&&i.location.slot===0)).toBe(false);
 expect(academicGiftPlan(s)).toHaveLength(1);trip(s);
 s=stepMatch(s).state;trip(s);
 reject(s,x=>{x.combat.equipmentReceipts[0].resourceSequence--;});
 s=finish(s);expect(s.seatMechanics!.receipts.some(r=>r.receiptId===academicGiftPlan(s)[0].receiptId)).toBe(true);trip(s);
});

import { nextRound } from '../src/simulation/match';
import { pandoraItem, pandoraConversions, pandoraRoundEntry, isS3bConversion, validS3bConversion } from '../src/simulation/augment-pool-batch5-s3b-conversions';
import { s3bInventoryReplay, s3bHistoricalEquipmentParent } from '../src/simulation/augment-pool-batch5-s3b-restore';
import type { ResourceProvenanceEntry } from '../src/simulation/resource-provenance';
it.skipIf(!existsSync(RESEARCH_FILE))('Pandora II preserves the two components and null completed-item source field',()=>{
 const row=AUGMENT_BATCH5_S3B['pandoras-items-ii'];
 const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===row.apiName);expect(row.source.values).toEqual(source.effects);
});
it('Pandora II is allowed at all three nodes and excludes Slammin in both directions',()=>{
 for(const node of ['2-1','3-2','4-2']){
  expect(augmentOfferAllowed('pandoras-items-ii',[],{node,fieldedTraits:[],blocked:[]})).toBe(true);
  expect(augmentPool('gold',[],[],`round:${node}:augment`,[])).toContain('pandoras-items-ii');
 }
 expect(augmentOfferAllowed('pandoras-items-ii',[{definitionId:'slammin',choiceId:'test',acquiredRound:4}],{node:'3-2',fieldedTraits:[],blocked:[]})).toBe(false);
 expect(augmentOfferAllowed('slammin',[{definitionId:'pandoras-items-ii',choiceId:'test',acquiredRound:4}],{node:'2-1',fieldedTraits:[],blocked:[]})).toBe(false);
});
it('Pandora II grants two components, rerolls only inventory at the next entry, keeps RNG and restores all three entries',()=>{
 const open=boundedFirstNodeOffer('pandoras-items-ii',true),c=open.pendingChoice!;
 let s=accepted(selectChoice(open,c.choiceId,c.generation,'pandoras-items-ii'));expect(s.items.length-open.items.length).toBe(2);trip(s);
 const holder=s.preparation.units.find(u=>u.team==='player')!,part=s.items.find(i=>i.location.kind==='inventory')!;
 s=accepted(equipItem(s,part.id,holder.id,0));s=resolveM5Choices(accepted(startMatchCombat(emptyBoard(s))));expect(s.phase).toBe('settlement');
 const before=s,expected=independent.pandoraChanges(s,s.round+1);
 expect(pandoraConversions(s,s.items,s.round+1)).toEqual(expected);
 const converted=pandoraRoundEntry(s,s.round+1,'2-2');
 expect([converted.rngState,converted.choiceRngState,converted.rewardRngState,converted.battleSeedRngState,converted.reforgeState]).toEqual([s.rngState,s.choiceRngState,s.rewardRngState,s.battleSeedRngState,s.reforgeState]);
 expect(expected.length).toBeGreaterThanOrEqual(1);
 s=accepted(nextRound(s,s.round));expect(s.items.find(i=>i.id===part.id)).toEqual(before.items.find(i=>i.id===part.id));
 const facts=s.resourceProvenance.entries.filter(isS3bConversion);expect(facts).toHaveLength(expected.length);
 for(const f of expected)expect(s.items.find(i=>i.id===f.itemId)?.definitionId).toBe(f.to);
 expect(()=>independent.validatePandora(before,s,{type:'continue'})).not.toThrow();
 trip(s);
 reject(s,x=>{x.resourceProvenance.entries.find(isS3bConversion).to='blue-buff';});
 reject(s,x=>{x.resourceProvenance.entries=x.resourceProvenance.entries.filter((e:any)=>!isS3bConversion(e));x.resourceProvenance.entries.forEach((e:any,i:number)=>e.sequence=i);x.items=structuredClone(before.items);});
 reject(s,x=>{x.resourceProvenance.entries.find(isS3bConversion).receiptId='["augment-pool-batch5-s3b","wrong"]';});
 expect(nextRound(s,before.round)).toMatchObject({ok:false,state:s});
});
it('Pandora category pools allow no-op rolls and exclude special items and equipped components',()=>{
 const state={seed:0,augments:[{definitionId:'pandoras-items-ii',choiceId:'test',acquiredRound:4}]};
 const ids=['sword','blue-buff','spatula','frying-pan','TFT_Item_ForceOfNature','TFT13_Item_AcademyEmblemItem','TFT4_Item_OrnnDeathsDefiance','TFT4_Item_OrnnObsidianCleaver'];
 const items=ids.map((definitionId,i)=>({id:`item-${i+1}`,definitionId,location:{kind:'inventory' as const}}));
 const facts=pandoraConversions(state,[...items,{id:'held',definitionId:'bow',location:{kind:'unit',unitId:'u',slot:0}}],5);
 expect(facts.map(f=>f.itemId)).toEqual(['item-1','item-2']);
 expect(pandoraConversions(state,items,4)).toEqual([]);
 let unchanged=false;for(let seed=0;seed<=100;seed++)unchanged ||= pandoraItem(seed,'same-roll','sword')==='sword';expect(unchanged).toBe(true);
 for(const from of ['sword','blue-buff'])for(let seed=0;seed<=100;seed++)expect(from==='sword'?G24_FORGE_POOLS.TFT_ArmoryKeyComponent:G24_FORGE_POOLS.TFT_ArmoryKeyCompleted).toContain(pandoraItem(seed,'roll',from));
});

import { salvagePlan, salvageRewardPlan } from '../src/simulation/augment-pool-batch5-s3b-salvage';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
it.skipIf(!existsSync(RESEARCH_FILE))('Salvage Bin preserves the seven-combat source value',()=>{
 const row=AUGMENT_BATCH5_S3B['salvage-bin'];const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===row.apiName);expect(row.source.values).toEqual(source.effects);
});
it('Salvage Bin is offered only at 2-1, including the independent oracle',()=>{
 for(const node of ['2-1','3-2','4-2']){
  expect(augmentOfferAllowed('salvage-bin',[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='2-1');
  expect(augmentPool('gold',[],[],`round:${node}:augment`,[]).includes('salvage-bin')).toBe(node==='2-1');
 }
});
it('Salvage Bin grants a completed item, splits the real equipped sale exactly once, and authenticates both component identities',()=>{
 const open=reachRoundFielded('2-1',batch5S3bSeed('salvage-bin')),c=open.pendingChoice!;
 let s=accepted(selectChoice(open,c.choiceId,c.generation,'salvage-bin'));expect(s.items.length-open.items.length).toBe(1);trip(s);
 const item=s.items.at(-1)!,recipe=ITEM_DEFINITIONS[item.definitionId].recipe!,u=s.preparation.units.find(u=>u.team==='player')!;
 expect(G24_FORGE_POOLS.TFT_ArmoryKeyCompleted).toContain(item.definitionId);s=accepted(equipItem(s,item.id,u.id,0));
 const before=s,sale=sellUnit(s,u.id);s=accepted(sale);expect(s.items.length-before.items.length).toBe(1);
 expect(()=>independent.validateSalvage(before,s,{type:'sell',unitId:u.id},sale.ok?sale.events:[])).not.toThrow();
 expect(s.items.find(i=>i.id===item.id)).toEqual({...item,definitionId:recipe[0]});expect(s.items.at(-1)?.definitionId).toBe(recipe[1]);
 expect(salvageRewardPlan(s)).toEqual([]);trip(s);
 reject(s,x=>{x.resourceProvenance.entries.find(isS3bConversion).to='bow';});
 reject(s,x=>{x.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5-s3b').definitionId='sword';});
 reject(s,x=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-pool-batch5-s3b');});
 reject(s,x=>{x.resourceProvenance.entries.find(isS3bConversion).receiptId='["augment-pool-batch5-s3b","wrong"]';});
 const again=sellUnit(s,u.id);expect(again.ok).toBe(false);expect(again.state).toBe(s);
});
it('Salvage Bin leaves special permanent items and unowned crafts alone',()=>{
 const s=chooseAcademic(),sale={kind:'unit-sold' as const,unitId:'holder',context:'preparation' as const,goldGranted:1,sequence:s.resourceProvenance.entries.length,roundId:s.roundDefinitionId};
 const items=['TFT_Item_ForceOfNature','TFT13_Item_AcademyEmblemItem','TFT4_Item_OrnnDeathsDefiance','TFT4_Item_OrnnObsidianCleaver'].map((definitionId,slot)=>({id:'special'+slot,definitionId,location:{kind:'unit' as const,unitId:'holder',slot}}));
 expect(salvagePlan(s,items,sale)).toEqual([]);
 const open=reachRoundFielded('2-1',batch5S3bSeed('salvage-bin')),c=open.pendingChoice!,owned=accepted(selectChoice(open,c.choiceId,c.generation,'salvage-bin'));
 expect(salvagePlan(owned,items,{...sale,sequence:owned.resourceProvenance.entries.length})).toEqual([]);
});

import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics/grants';
it('academic research preserves pre-selection same-round crafts and special recipes',()=>{
 let open=reachRoundFielded('2-1',batch5S3bSeed('academic-research'));const parts=open.items.filter(i=>i.location.kind==='inventory');expect(parts.length).toBeGreaterThanOrEqual(2);
 open=accepted(combineItems(open,parts[0].id,parts[1].id));const craft=open.items.at(-1)!;
 const c=open.pendingChoice!;let s=accepted(selectChoice(open,c.choiceId,c.generation,'academic-research'));
 expect(s.items).toContainEqual(craft);expect(academicGiftPlan(s)).toEqual([]);trip(s);
 for(const definitionId of ['spatula','sword'])s=accepted(grantMechanicItem(s,{source:'test',receiptId:`s3b-special:${definitionId}`,definitionId}));
 const special=s.items.slice(-2);s=accepted(combineItems(s,special[0].id,special[1].id));
 expect(s.items.at(-1)?.definitionId).toBe('TFT13_Item_WarbandEmblemItem');expect(academicGiftPlan(s)).toEqual([]);trip(s);
});
it('academic research escrows its anvil at full bench and grants once when a real sale frees capacity',()=>{
 let s=chooseAcademic();
 for(const definitionId of ['amumu','darius','draven','irelia','maddie','morgana','powder','singed','steb']){
  if(s.preparation.units.filter(u=>u.location.kind==='bench').length===s.preparation.benchSize)break;
  s=accepted(grantMechanicUnit(s,{source:'test',receiptId:`s3b-capacity:${definitionId}`,definitionId}));
 }
 expect(s.preparation.units.filter(u=>u.location.kind==='bench')).toHaveLength(s.preparation.benchSize);
 const parts=s.items.filter(i=>i.location.kind==='inventory');s=accepted(combineItems(s,parts[0].id,parts[1].id));const gift=academicGiftPlan(s)[0];
 expect(s.seatMechanics!.receipts.some(r=>r.receiptId===gift.receiptId)).toBe(false);trip(s);
 s=accepted(sellUnit(s,s.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench')!.id));
 expect(s.seatMechanics!.receipts.filter(r=>r.receiptId===gift.receiptId)).toHaveLength(1);trip(s);
});

import { createRequire } from 'node:module';
const independent=createRequire(import.meta.url)('./fixtures/m5/augment-batch5-s3b-oracle.cjs');
it.each([[39,'overtime-1'],[46,'overtime-8']] as const)('S3B authenticates Pandora entry and historical gloves at %s / %s', (round,roundId)=>{
 // Isolated replay boundary vector, not a synthetic whole-match save. The independent oracle supplies the conversion.
 const base=chooseAcademic(),item={id:'item-1',definitionId:'thiefs-gloves',location:{kind:'inventory' as const}};
 const previous:MatchState={...base,round:round-1,items:[item],augments:[{definitionId:'pandoras-items-ii',choiceId:'overtime-pandora',acquiredRound:4}],
  resourceProvenance:{...base.resourceProvenance,entries:[]}};
 const fact:ResourceProvenanceEntry={...independent.pandoraChanges(previous,round)[0],sequence:0,roundId};
 const items=[{...item,definitionId:fact.kind==='g23-item-converted'?fact.to:item.definitionId}];
 const next:MatchState={...previous,round,items,resourceProvenance:{...previous.resourceProvenance,entries:[fact]}};
 if(fact.kind!=='g23-item-converted')throw Error('conversion');
 expect(validS3bConversion(next,fact,roundId)).toBe(true);
 expect(validS3bConversion(next,{...fact,to:'spatula'},roundId)).toBe(false);
 const replay=s3bInventoryReplay(next,previous);
 expect(()=>{replay.beforeFact(fact,previous.items,2);replay.finish(items);}).not.toThrow();
 expect(s3bHistoricalEquipmentParent(next,item.id,round===39?'6-7':'overtime-7')).toEqual(item);
 expect(s3bHistoricalEquipmentParent(next,item.id,roundId)).toBeUndefined();
 const bad={...fact,to:'spatula'},tampered={...next,resourceProvenance:{...next.resourceProvenance,entries:[bad]}};
 expect(()=>s3bInventoryReplay(tampered,previous).beforeFact(bad,previous.items,2)).toThrow('conversion coverage/order');
 expect(()=>s3bInventoryReplay(next,previous).finish(previous.items)).toThrow('missing inventory conversions');
});
it('independent ordinary recipes cover the exact conversion category and component pairs',()=>{
 expect(Object.keys(independent.RECIPES).sort()).toEqual([...G24_FORGE_POOLS.TFT_ArmoryKeyCompleted].sort());
 for(const [id,recipe] of Object.entries(independent.RECIPES))expect(ITEM_DEFINITIONS[id].recipe).toEqual(recipe);
});

import { validateContent } from '../src/simulation/validate-content';
it('S3B registry additions preserve the full content validation contract',()=>expect(()=>validateContent()).not.toThrow());

it('Salvage Bin splits permanent Thief’s Gloves but never pays for its temporary children',()=>{
 const open=reachRoundFielded('2-1',batch5S3bSeed('salvage-bin')),c=open.pendingChoice!;
 let s=accepted(selectChoice(open,c.choiceId,c.generation,'salvage-bin'));
 s=accepted(grantMechanicItem(s,{source:'test',receiptId:'s3b-thiefs',definitionId:'thiefs-gloves'}));const item=s.items.at(-1)!;
 const u=s.preparation.units.find(u=>u.team==='player')!;s=accepted(equipItem(s,item.id,u.id,0));expect(s.temporaryEquipment.filter(i=>i.holderId===u.id)).toHaveLength(2);trip(s);
 const count=s.items.length;s=accepted(sellUnit(s,u.id));expect(s.items).toHaveLength(count+1);expect(s.items.find(i=>i.id===item.id)?.definitionId).toBe('gloves');expect(s.items.at(-1)?.definitionId).toBe('gloves');expect(s.temporaryEquipment.filter(i=>i.holderId===u.id)).toEqual([]);trip(s);
});

it('Pandora retains authenticated historical Thief’s Gloves rolls after rerolling the returned inventory parent',()=>{
 const open=boundedFirstNodeOffer('pandoras-items-ii',true),c=open.pendingChoice!;
 let s=accepted(selectChoice(open,c.choiceId,c.generation,'pandoras-items-ii'));
 s=accepted(grantMechanicItem(s,{source:'test',receiptId:'s3b-pandora-thiefs',definitionId:'thiefs-gloves'}));const item=s.items.at(-1)!;
 const u=s.preparation.units.find(u=>u.team==='player')!;s=accepted(equipItem(s,item.id,u.id,0));expect(s.temporaryEquipment.filter(i=>i.holderId===u.id)).toHaveLength(2);
 s=accepted(sellUnit(s,u.id));s=resolveM5Choices(accepted(startMatchCombat(emptyBoard(s))));const rolls=s.equipmentState.rolls;
 s=accepted(nextRound(s,s.round));expect(s.equipmentState.rolls).toEqual(rolls);expect(s.items.find(i=>i.id===item.id)?.definitionId).not.toBe('thiefs-gloves');trip(s);
 reject(s,x=>{x.equipmentState.rolls.at(-1).roundId=x.roundDefinitionId;});
});
