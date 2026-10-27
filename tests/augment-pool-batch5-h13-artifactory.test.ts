import {existsSync,readFileSync} from 'node:fs';
import {it,expect,beforeAll} from 'vitest';
import {AUGMENT_BATCH5_H13} from '../src/simulation/content/augment-pool-batch5-h13';
import {RESEARCH_FILE} from './augment-pool-source-expectations';
import {AUGMENT_TIERS} from '../src/simulation/content/augment-policy';
import {augmentOfferAllowed} from '../src/simulation/augment-offers';
import {augmentPool} from './fixtures/m5/oracle.g2.cjs';
import {selectChoice,combineItems,startMatchCombat,nextRound,openAnvil,type MatchState} from '../src/simulation/match';
import {accepted,reachRound,resolveM5Choices,emptyBoard} from './match-helpers';
import {requireAugmentFacts} from '../src/simulation/augment-history';
import {enterH13ItemRound,h13RoundItemPool} from '../src/simulation/augment-pool-batch5-h13-entry';
import {G24_FORGE_POOLS} from '../src/simulation/content/g2-4-forges';
import {trip,reject} from './augment-pool-batch5-h13-helpers';
import {ITEM_DEFINITIONS} from '../src/simulation/content/items';
import {ITEM_DEFINITIONS as ALL_ITEMS} from '../src/simulation/content/g2-3-item-registry';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
let acquired:MatchState,ready:MatchState,advanced:MatchState;
beforeAll(()=>{
 // Seed 47 has the real 3-2 offer; selecting a quiet first augment yields ordinary components through public choices.
 const open=reachRound('3-2',false,47),c=open.pendingChoice!;expect(c.offers).toContain('artifactory');
 acquired=accepted(selectChoice(open,c.choiceId,c.generation,'artifactory'));ready=acquired;
});
it.skipIf(!existsSync(RESEARCH_FILE))('B5-22 retains source counts and unused Health=50',()=>{
 const row=AUGMENT_BATCH5_H13.artifactory,raw=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===row.apiName);
 expect(row.source.values).toEqual(raw.effects);expect([row.name,row.description,row.source.description_en_us]).toEqual([raw.name_zh_cn,raw.description_zh_cn,raw.description_en_us]);
});
it('B5-22 only offers 3-2/4-2; grants one anvil and two usable removers, never Health=50',()=>{
 expect(AUGMENT_TIERS.artifactory).toBe('prismatic');for(const node of ['2-1','3-2','4-2']){expect(augmentOfferAllowed('artifactory',[],{node,fieldedTraits:[],blocked:[]})).toBe(node!=='2-1');expect(augmentPool('prismatic',[],[],`round:${node}:augment`,[]).includes('artifactory')).toBe(node!=='2-1');}
 const a=acquired.augments.find(a=>a.definitionId==='artifactory')!,rs=acquired.seatMechanics!.receipts.filter(r=>r.receiptId.includes(a.choiceId)&&r.receiptId.includes('artifactory'));
 expect(rs.map(r=>r.kind)).toEqual(['unit','consumable','consumable']);expect(rs.flatMap(r=>'definitionId' in r?[r.definitionId]:[])).toEqual(['TFT_ArmoryKeyOrnn','magnetic-remover','magnetic-remover']);trip(acquired);
 const anvil=acquired.preparation.units.find(u=>u.definitionId==='TFT_ArmoryKeyOrnn')!;
 const opened=accepted(openAnvil(acquired,anvil.id));expect(opened.pendingChoice!.offers).toHaveLength(4);ready=resolveM5Choices(opened);trip(ready);
});
it('B5-22 preserves all special classes and honours mutual exclusion in both directions',()=>{
 for(const item of Object.values(ALL_ITEMS))expect(h13RoundItemPool('artifactory',item.id)).toEqual(ITEM_DEFINITIONS[item.id]?.recipe?G24_FORGE_POOLS.TFT_ArmoryKeyOrnn:null);
 for(const other of ['pandoras-items-iii','salvage-bin-plus'])for(const [id,owned] of [['artifactory',other],[other,'artifactory']]){
  expect(augmentOfferAllowed(id,[{definitionId:owned,choiceId:'round:3-2:augment',acquiredRound:12}],{node:'4-2',fieldedTraits:[],blocked:[]})).toBe(false);
 }
});
it('B5-22 converts inventory ordinary completed items on next entry, leaves artifact/emblems/equipped items alone and restores',()=>{
 // A legal zero-input entry still has a completion marker and cannot reroll twice.
 const ended=resolveM5Choices(accepted(startMatchCombat(emptyBoard(ready))));advanced=accepted(nextRound(ended,ended.round));
 expect(requireAugmentFacts(advanced,'inventory-transform-entry',advanced.round)).toHaveLength(1);expect(enterH13ItemRound(advanced)).toBe(advanced);trip(advanced);
 expect(nextRound(restoreMatch(serializeMatch(ended)),ended.round)).toEqual(nextRound(ended,ended.round));
 for(const item of ready.items.filter(i=>i.definitionId.startsWith('TFT')||i.location.kind==='unit'))expect(advanced.items).toContainEqual(item);
});
it('B5-22 real component combination becomes one supported artifact on entry; output forgery is rejected',()=>{
 const ended=resolveM5Choices(accepted(startMatchCombat(emptyBoard(advanced))));
 let supply=resolveM5Choices(accepted(nextRound(ended,ended.round)));
 const components=supply.items.filter(i=>i.location.kind==='inventory'&&ITEM_DEFINITIONS[i.definitionId]?.kind==='component');expect(components.length).toBeGreaterThanOrEqual(2);
 supply=accepted(combineItems(supply,components[0].id,components[1].id));const original=supply.items.at(-1)!;
 advanced=accepted(nextRound(supply,supply.round));
 const f=requireAugmentFacts(advanced,'augment-item-transform',advanced.round).find(f=>f.input.id===original.id)!;
 expect(f.input).toEqual(original);expect(f.outputs).toHaveLength(1);expect(G24_FORGE_POOLS.TFT_ArmoryKeyOrnn).toContain(f.outputs[0].definitionId);
 // Independent integer hash/LCG arithmetic, not the production draw helper.
 const owner=advanced.augments.find(a=>a.definitionId==='artifactory')!;let hash=2166136261n;
 for(const char of JSON.stringify(['batch5-h13','solo',owner.choiceId,advanced.round,original.id]))hash=((hash^BigInt(char.charCodeAt(0)))*16777619n)%4294967296n;
 const word=((BigInt(advanced.seed)^hash)*1664525n+1013904223n)%4294967296n;
 expect(f.outputs[0].definitionId).toBe(G24_FORGE_POOLS.TFT_ArmoryKeyOrnn[Number(word*BigInt(G24_FORGE_POOLS.TFT_ArmoryKeyOrnn.length)/4294967296n)]);
 expect(advanced.items).toContainEqual(f.outputs[0]);expect(advanced.items.some(i=>i.id===original.id)).toBe(false);trip(advanced);
 expect(nextRound(restoreMatch(serializeMatch(supply)),supply.round)).toEqual(nextRound(supply,supply.round));
 reject(advanced,x=>{x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform').outputs[0].definitionId='sword';});
 reject(advanced,x=>{const f=x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform');const e=x.resourceProvenance.entries.find((e:any)=>e.kind==='augment-item-transform');const id=f.outputs[0].id;f.outputs[0].definitionId=e.outputs[0].definitionId='sword';x.items.find((i:any)=>i.id===id).definitionId='sword';});
 reject(advanced,x=>{const f=x.augmentHistory.facts.find((f:any)=>f.kind==='augment-item-transform');const e=x.resourceProvenance.entries.find((e:any)=>e.kind==='augment-item-transform');const other=G24_FORGE_POOLS.TFT_ArmoryKeyOrnn.find(id=>id!==f.outputs[0].definitionId)!;f.outputs[0].definitionId=e.outputs[0].definitionId=x.items.find((i:any)=>i.id===f.outputs[0].id).definitionId=other;});
});
it('B5-22 rejects removed/changed entry snapshot, completion marker, grants and proof through all restore entries',()=>{
 reject(advanced,x=>{delete x.augmentHistory;});reject(advanced,x=>{x.augmentHistory.facts.find((f:any)=>f.kind==='round-entry').roster.items=[];});
 reject(advanced,x=>{x.augmentHistory.facts.find((f:any)=>f.kind==='inventory-transform-entry').itemIds.push('fake');});
 reject(advanced,x=>{x.augmentHistory.facts=x.augmentHistory.facts.filter((f:any)=>f.kind!=='inventory-transform-entry');x.augmentHistory.facts.forEach((f:any,i:number)=>f.sequence=i);});
 reject(acquired,x=>{x.consumables.pop();});reject(advanced,x=>{x.augmentHistory.proof.commands.pop();});
});
