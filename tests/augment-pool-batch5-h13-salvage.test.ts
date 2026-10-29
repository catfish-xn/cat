import { offerFor } from './augment-stage-helpers';
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_H13 } from '../src/simulation/content/augment-pool-batch5-h13';
import { salvageRecipe } from '../src/simulation/augment-pool-batch5-h13-salvage';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { ITEM_DEFINITIONS as ALL_ITEMS } from '../src/simulation/content/g2-3-item-registry';
import { RESEARCH_FILE } from './augment-pool-source-expectations';

it.skipIf(!existsSync(RESEARCH_FILE))('B5-20 retains the 14.24 source values and descriptions', () => {
  const row = AUGMENT_BATCH5_H13['salvage-bin-plus'];
  const source = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')).find((x: {apiName: string}) => x.apiName === row.apiName);
  expect(row.source.values).toEqual(source.effects);
  expect([row.name, row.description, row.source.description_en_us]).toEqual([source.name_zh_cn, source.description_zh_cn, source.description_en_us]);
});
it('B5-20 recognises only ordinary permanent component recipes', () => {
  expect(salvageRecipe('rageblade')).toEqual(['bow', 'rod']);
  expect(salvageRecipe('deathblade')).toEqual(['sword', 'sword']);
  for (const item of Object.values(ITEM_DEFINITIONS)) {
    if (item.kind === 'completed' && item.recipe) expect(salvageRecipe(item.id)).toEqual(item.recipe);
  }
  expect(salvageRecipe('sword')).toBeNull();
  expect(salvageRecipe('TFT_Item_ForceOfNature')).toBeNull();
  expect(salvageRecipe('TFT5_Item_BlueBuffRadiant')).toBeNull();
  expect(salvageRecipe('missing')).toBeNull();
  for(const item of Object.values(ALL_ITEMS))if(!ITEM_DEFINITIONS[item.id])expect(salvageRecipe(item.id),item.id).toBeNull();
});

import { beforeAll } from 'vitest';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { equipItem,sellUnit,selectChoice,nextRound,startMatchCombat,type MatchState } from '../src/simulation/match';
import { accepted,resolveM5Choices,emptyBoard } from './match-helpers';
import { trip,reject } from './augment-pool-batch5-h13-helpers';
import { restoreMatch,serializeMatch } from '../src/simulation/serialization';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { salvageSoldItems } from '../src/simulation/augment-pool-batch5-h13-salvage';
import { validateHistoricalEquipment } from '../src/simulation/b8-restore';
let chosen:MatchState,sold:MatchState;
beforeAll(()=>{
 const open=offerFor('salvage-bin-plus'),c=open.pendingChoice!;
 expect(c.offers).toContain('salvage-bin-plus');chosen=accepted(selectChoice(open,c.choiceId,c.generation,'salvage-bin-plus'));
 const item=chosen.items.find(i=>salvageRecipe(i.definitionId))!,holder=chosen.preparation.units.find(u=>u.team==='player')!;
 expect(item).toBeDefined();const equipped=accepted(equipItem(chosen,item.id,holder.id,0));sold=accepted(sellUnit(equipped,holder.id));
});
it('B5-20 offers at 3-2 and 4-2 only, using the independent gold oracle',()=>{
 expect(AUGMENT_TIERS['salvage-bin-plus']).toBe('gold');
 for(const node of ['2-1','3-2','4-2']){expect(augmentOfferAllowed('salvage-bin-plus',[],{node,fieldedTraits:[],blocked:[]})).toBe(node!=='2-1');expect(augmentPool('gold',[],[],`round:${node}:augment`,[]).includes('salvage-bin-plus')).toBe(node!=='2-1');}
});
it('B5-20 grants one completed item; real sale consumes it and creates exactly its two recipe components',()=>{
 const a=chosen.augments.find(a=>a.definitionId==='salvage-bin-plus')!;
 expect(chosen.seatMechanics!.receipts.filter(r=>r.receiptId.includes(a.choiceId)&&r.receiptId.includes('salvage-bin-plus'))).toHaveLength(1);
 const f=requireAugmentFacts(sold,'augment-item-transform',sold.round)[0];expect(f.outputs.map(i=>i.definitionId)).toEqual(salvageRecipe(f.input.definitionId));
 expect(sold.items.some(i=>i.id===f.input.id)).toBe(false);expect(f.outputs.every(i=>sold.items.some(x=>x.id===i.id))).toBe(true);
 const repeat=sellUnit(sold,chosen.preparation.units.find(u=>u.team==='player')!.id);expect(repeat.ok).toBe(false);expect(repeat.state).toBe(sold);
 trip(chosen);trip(sold);
 const settled=resolveM5Choices(accepted(startMatchCombat(emptyBoard(sold))));trip(settled);
 expect(requireAugmentFacts(settled,'settled-combat',sold.round)).toHaveLength(1);
 const advanced=accepted(nextRound(settled,settled.round));trip(advanced);expect(nextRound(advanced,settled.round).ok).toBe(false);
 expect(sellUnit(restoreMatch(serializeMatch(chosen)),'missing')).toEqual(sellUnit(chosen,'missing'));
 expect(()=>validateHistoricalEquipment(chosen,sold)).not.toThrow();
});
it('B5-20 sale boundary only splits permanent ordinary parents, including double-glove recipes',()=>{
 // Isolated item-class matrix; the real command/restore route above supplies the authentication coverage.
 const holder=chosen.preparation.units.find(u=>u.team==='player')!;
 for(const definitionId of ['thiefs-gloves','deathblade','TFT_Item_ForceOfNature','TFT5_Item_BlueBuffRadiant','sword']){
  const item={id:`item-${chosen.nextItemSerial}`,definitionId,location:{kind:'unit' as const,unitId:holder.id,slot:0}};
  const before={...chosen,items:[item],nextItemSerial:chosen.nextItemSerial+1};
  const returned={...before,items:[{...item,location:{kind:'inventory' as const}}]};
  const after=salvageSoldItems(before,returned,holder.id),recipe=salvageRecipe(definitionId);
  expect(after.items.map(i=>i.definitionId)).toEqual(recipe??[definitionId]);
  expect(after.temporaryEquipment).toBe(before.temporaryEquipment);
  if(!recipe)expect(after).toBe(returned);
 }
});
it('B5-20 rejects missing/altered/duplicated transform history, paired ledger forgery, outputs and commands at all three restore entries',()=>{
 reject(sold,x=>{delete x.augmentHistory;});
 reject(sold,x=>{x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform').outputs[0].definitionId='bow';});
 reject(sold,x=>{x.augmentHistory.facts=x.augmentHistory.facts.filter((f:any)=>f.kind!=='augment-item-transform');x.augmentHistory.facts.forEach((f:any,i:number)=>f.sequence=i);});
 reject(sold,x=>{const f=x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform');x.augmentHistory.facts.push({...f,sequence:x.augmentHistory.facts.length});});
 reject(sold,x=>{const f=x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform');const e=x.resourceProvenance.entries.find((e:any)=>e.kind==='augment-item-transform');f.outputs[0].definitionId=e.outputs[0].definitionId='missing';});
 reject(sold,x=>{const f=x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform');const e=x.resourceProvenance.entries.find((e:any)=>e.kind==='augment-item-transform');const id=f.outputs[0].id,other=f.outputs[0].definitionId==='sword'?'bow':'sword';f.outputs[0].definitionId=e.outputs[0].definitionId=x.items.find((i:any)=>i.id===id).definitionId=other;});
 reject(sold,x=>{x.items.pop();});reject(sold,x=>{x.nextItemSerial++;});reject(sold,x=>{x.augmentHistory.proof.commands.pop();});
});
