import {existsSync,readFileSync} from 'node:fs';
import {it,expect,beforeAll} from 'vitest';
import {AUGMENT_BATCH5_H13} from '../src/simulation/content/augment-pool-batch5-h13';
import {RESEARCH_FILE} from './augment-pool-source-expectations';
import {AUGMENT_TIERS} from '../src/simulation/content/augment-policy';
import {augmentOfferAllowed} from '../src/simulation/augment-offers';
import {augmentPool} from './fixtures/m5/oracle.g2.cjs';
import {selectChoice,combineItems,equipItem,startMatchCombat,nextRound,type MatchState} from '../src/simulation/match';
import {accepted,reachRoundFielded,resolveM5Choices,emptyBoard} from './match-helpers';
import {firstNodeSeed} from './augment-stage-helpers';
import {requireAugmentFacts} from '../src/simulation/augment-history';
import {enterH13ItemRound,h13RoundItemPool,h13ItemDraw} from '../src/simulation/augment-pool-batch5-h13-entry';
import {G24_FORGE_POOLS} from '../src/simulation/content/g2-4-forges';
import {ITEM_DEFINITIONS as ORDINARY} from '../src/simulation/content/items';
import {trip,reject} from './augment-pool-batch5-h13-helpers';
import {ITEM_DEFINITIONS} from '../src/simulation/content/g2-3-item-registry';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
let acquired:MatchState,advanced:MatchState;
beforeAll(()=>{const open=reachRoundFielded('2-1',firstNodeSeed('pandoras-items-iii',101)),c=open.pendingChoice!;expect(c.offers).toContain('pandoras-items-iii');acquired=accepted(selectChoice(open,c.choiceId,c.generation,'pandoras-items-iii'));});
it.skipIf(!existsSync(RESEARCH_FILE))('B5-23 preserves all source fields including empty effects',()=>{
 const row=AUGMENT_BATCH5_H13['pandoras-items-iii'],raw=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===row.apiName);
 expect(row.source.values).toEqual(raw.effects);expect([row.name,row.description,row.source.description_en_us]).toEqual([raw.name_zh_cn,raw.description_zh_cn,raw.description_en_us]);
});
it('B5-23 offers all nodes and grants exactly one radiant directly, without an anvil choice',()=>{
 expect(AUGMENT_TIERS['pandoras-items-iii']).toBe('prismatic');for(const node of ['2-1','3-2','4-2']){expect(augmentOfferAllowed('pandoras-items-iii',[],{node,fieldedTraits:[],blocked:[]})).toBe(true);expect(augmentPool('prismatic',[],[],`round:${node}:augment`,[]).includes('pandoras-items-iii')).toBe(true);}
 const rs=acquired.seatMechanics!.receipts.filter(r=>r.receiptId.includes('pandoras-items-iii'));expect(rs).toHaveLength(1);expect(rs[0].kind).toBe('item');expect(acquired.pendingChoice).toBeNull();expect(acquired.items.filter(i=>ITEM_DEFINITIONS[i.definitionId].kind==='radiant')).toHaveLength(1);trip(acquired);
});
it('B5-23 category matrix excludes special items, allows unchanged results and leaves live RNG untouched',()=>{
 for(const item of Object.values(ITEM_DEFINITIONS)){
  const ordinary=ORDINARY[item.id];
  const expected=ordinary?.kind==='component'?G24_FORGE_POOLS.TFT_ArmoryKeyComponent:ordinary?.recipe?G24_FORGE_POOLS.TFT_ArmoryKeyCompleted:null;
  expect(h13RoundItemPool('pandoras-items-iii',item.id),item.id).toEqual(expected);
 }
 const owner=acquired.augments.find(a=>a.definitionId==='pandoras-items-iii')!,before=structuredClone(acquired);
 const pool=G24_FORGE_POOLS.TFT_ArmoryKeyComponent,draw=h13ItemDraw(acquired,owner.choiceId,'item-1',pool);
 expect(h13RoundItemPool('pandoras-items-iii',draw)).toContain(draw);
 expect(h13ItemDraw(acquired,owner.choiceId,'item-1',pool)).toBe(draw);
 expect(acquired).toEqual(before);
});
it('B5-23 real nextRound rerolls inventory components in category and leaves the radiant/equipped items unchanged',()=>{
 const components=acquired.items.filter(i=>i.location.kind==='inventory'&&ITEM_DEFINITIONS[i.definitionId].kind==='component');expect(components.length).toBeGreaterThanOrEqual(1);
 const ended=resolveM5Choices(accepted(startMatchCombat(emptyBoard(acquired))));advanced=accepted(nextRound(ended,ended.round));
 const facts=requireAugmentFacts(advanced,'augment-item-transform',advanced.round);expect(facts).toHaveLength(components.length);
 for(const f of facts){expect(f.outputs).toHaveLength(1);expect(ITEM_DEFINITIONS[f.outputs[0].definitionId].kind).toBe('component');expect(advanced.items.some(i=>i.id===f.input.id)).toBe(false);}
 for(const item of acquired.items.filter(i=>ITEM_DEFINITIONS[i.definitionId].kind==='radiant'))expect(advanced.items).toContainEqual(item);
 expect(enterH13ItemRound(advanced)).toBe(advanced);trip(advanced);expect(nextRound(restoreMatch(serializeMatch(ended)),ended.round)).toEqual(nextRound(ended,ended.round));
});
it('B5-23 completed-item category and equipped-item exemption use actual combine/equip/continue commands',()=>{
 let s=advanced;
 // Reach the next component supply if the opening only supplied one component.
 while(s.items.filter(i=>i.location.kind==='inventory'&&ITEM_DEFINITIONS[i.definitionId].kind==='component').length<2){
  if(s.phase==='preparation')s=resolveM5Choices(accepted(startMatchCombat(emptyBoard(s))));s=resolveM5Choices(accepted(nextRound(s,s.round)));
 }
 const cs=s.items.filter(i=>i.location.kind==='inventory'&&ITEM_DEFINITIONS[i.definitionId].kind==='component');
 s=accepted(combineItems(s,cs[0].id,cs[1].id));const complete=s.items.at(-1)!;
 // Reroll the crafted item on the next actual entry, then equip it and keep it next entry.
 if(s.phase==='preparation')s=resolveM5Choices(accepted(startMatchCombat(emptyBoard(s))));s=resolveM5Choices(accepted(nextRound(s,s.round)));
 const f=requireAugmentFacts(s,'augment-item-transform',s.round).find(f=>f.input.id===complete.id)!;expect(ITEM_DEFINITIONS[f.outputs[0].definitionId].kind).toBe('completed');trip(s);
 const holder=s.preparation.units.find(u=>u.team==='player')!;s=accepted(equipItem(s,f.outputs[0].id,holder.id,0));const held=s.items.find(i=>i.id===f.outputs[0].id)!;
 if(s.phase==='preparation')s=resolveM5Choices(accepted(startMatchCombat(emptyBoard(s))));advanced=resolveM5Choices(accepted(nextRound(s,s.round)));expect(advanced.items).toContainEqual(held);trip(advanced);
});
it('B5-23 three restore entries reject altered/removed/duplicated history, wrong categories and paired ledger/output forgery',()=>{
 reject(advanced,x=>{delete x.augmentHistory;});reject(advanced,x=>{x.augmentHistory.proof.commands.pop();});
 reject(advanced,x=>{x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform').outputs[0].definitionId='TFT_Item_ForceOfNature';});
 reject(advanced,x=>{const f=x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform');x.augmentHistory.facts.push({...f,sequence:x.augmentHistory.facts.length});});
 reject(advanced,x=>{x.augmentHistory.facts=x.augmentHistory.facts.filter((f:any)=>f.kind!=='inventory-transform-entry');x.augmentHistory.facts.forEach((f:any,i:number)=>f.sequence=i);});
 reject(advanced,x=>{const f=x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform');const e=x.resourceProvenance.entries.find((e:any)=>e.kind==='augment-item-transform');f.outputs[0].definitionId=e.outputs[0].definitionId='TFT_Item_ForceOfNature';});
 reject(advanced,x=>{const f=x.augmentHistory.facts.findLast((f:any)=>f.kind==='augment-item-transform');const e=x.resourceProvenance.entries.find((e:any)=>e.kind==='augment-item-transform'&&e.receiptId===f.receiptId);const other=h13RoundItemPool('pandoras-items-iii',f.input.definitionId)!.find(id=>id!==f.outputs[0].definitionId)!;f.outputs[0].definitionId=e.outputs[0].definitionId=other;const item=x.items.find((i:any)=>i.id===f.outputs[0].id);if(item)item.definitionId=other;});
 reject(acquired,x=>{x.seatMechanics.receipts.find((r:any)=>r.receiptId.includes('pandoras-items-iii')).definitionId='sword';});
});
