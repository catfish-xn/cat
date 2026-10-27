import { grantMechanicItem } from '../src/simulation/seat-mechanics/grants';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { pandoraPick } from './fixtures/m5/augment-inventory-oracle.cjs';
import { expect,it } from 'vitest';
import { boundedFirstNodeOffer } from './augment-stage-helpers';
import { accepted,resolveM5Choices,emptyBoard,fieldBench } from './match-helpers';
import { selectChoice,combineItems,equipItem,nextRound,startMatchCombat,setShopLock,stepMatch,type MatchState } from '../src/simulation/match';
import { serializeMatch,restoreMatch } from '../src/simulation/serialization';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { G24_FORGE_POOLS } from '../src/simulation/content/g2-4-forges';
import { batch5InventoryPlan } from '../src/simulation/augment-pool-batch5-s3a';
function trip(s:MatchState){const text=serializeMatch(s);expect(restoreMatch(text)).toEqual(s);expect(restoreMatch(JSON.parse(text))).toEqual(s);expect(restoreMatch(s)).toEqual(s);}
function reject(s:MatchState,mutate:(x:any)=>void){const x=JSON.parse(serializeMatch(s));mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();}
function advance(s:MatchState){s=resolveM5Choices(s);if(s.phase==='preparation')s=accepted(startMatchCombat(emptyBoard(s)));s=resolveM5Choices(s);return resolveM5Choices(accepted(nextRound(s,s.round)));}
function chosen(){const open=boundedFirstNodeOffer('pandoras-items',true),c=open.pendingChoice!;const state=accepted(selectChoice(open,c.choiceId,c.generation,'pandoras-items'));expect(state.items.length-open.items.length).toBe(1);return state;}
it('B5-16 offers at all three nodes and respects its existing incompatibilities',()=>{
 for(const node of ['2-1','3-2','4-2'])expect(augmentOfferAllowed('pandoras-items',[],{node,fieldedTraits:[],blocked:[]})).toBe(true);
 expect(augmentOfferAllowed('pandoras-items',[{definitionId:'fine-vintage',choiceId:'test',acquiredRound:4}])).toBe(false);
});
it('B5-16 rerolls each inventory category once on entry; equipped items stay, repeat commands cannot reroll',()=>{
 let s=chosen();trip(s);expect(s.items.length).toBeGreaterThanOrEqual(3);
 s=accepted(combineItems(s,s.items[0].id,s.items[1].id));const completed=s.items.at(-1)!,component=s.items.find(i=>G24_FORGE_POOLS.TFT_ArmoryKeyComponent.includes(i.definitionId))!;
 const held=accepted(equipItem(s,completed.id,s.preparation.units.find(u=>u.team==='player')!.id,0));
 let equippedNext=advance(held);expect(equippedNext.items.find(i=>i.id===completed.id)).toEqual(held.items.find(i=>i.id===completed.id));trip(equippedNext);
 const before=s;s=advance(s);expect(s.nextItemSerial).toBe(before.nextItemSerial);expect(s.items.map(i=>i.id)).toEqual(before.items.map(i=>i.id));
 expect(G24_FORGE_POOLS.TFT_ArmoryKeyCompleted).toContain(s.items.find(i=>i.id===completed.id)!.definitionId);
 expect(G24_FORGE_POOLS.TFT_ArmoryKeyComponent).toContain(s.items.find(i=>i.id===component.id)!.definitionId);
 expect(batch5InventoryPlan(s).conversions.filter(c=>c.round===s.round)).toHaveLength(before.items.length);
 for(const item of before.items){const pool=G24_FORGE_POOLS.TFT_ArmoryKeyComponent.includes(item.definitionId)?G24_FORGE_POOLS.TFT_ArmoryKeyComponent:G24_FORGE_POOLS.TFT_ArmoryKeyCompleted;expect(s.items.find(i=>i.id===item.id)!.definitionId).toBe(pandoraPick(s.seed,'solo',s.augments.find(a=>a.definitionId==='pandoras-items')!.choiceId,s.round,item.id,pool));}trip(s);
 const stable=s.items;s=accepted(setShopLock(s,true,s.shop.generation));expect(s.items).toEqual(stable);trip(s);
 reject(s,x=>{x.items.find((i:any)=>i.id===component.id).definitionId='blue-buff';});
 reject(s,x=>{x.items.find((i:any)=>i.id===completed.id).definitionId='sword';});
 // Real equip after the reroll binds the new definition to battle inputs and restore history.
 s=accepted(equipItem(s,completed.id,s.preparation.units.find(u=>u.team==='player')!.id,0));trip(s);
 const settled=accepted(startMatchCombat(emptyBoard(s)));trip(settled);
});
it('B5-16 a rerolled component still combines using its new definition and all three restore entries reject a forged recipe',()=>{
 let s=advance(chosen());const parts=s.items.filter(i=>G24_FORGE_POOLS.TFT_ArmoryKeyComponent.includes(i.definitionId));expect(parts.length).toBeGreaterThanOrEqual(2);
 s=accepted(combineItems(s,parts[0].id,parts[1].id));trip(s);
 reject(s,x=>{x.resourceProvenance.entries.findLast((e:any)=>e.kind==='item-combined').event.definitionId='invalid-recipe';});
});

it('B5-16 excludes emblems, crowns, artifacts, support, radiant and crafting tools',()=>{
 let s=chosen();
 const excluded=['TFT13_Item_FamilyEmblemItem','TFT_Item_ForceOfNature','spatula','frying-pan',
  G24_FORGE_POOLS.TFT_ArmoryKeyOrnn[0],G24_FORGE_POOLS.TFT_ArmoryKeySupport[0],Object.values(ITEM_DEFINITIONS).find(d=>d.kind==='radiant')!.id];
 const ids:string[]=[];
 for(const definitionId of excluded){const g=grantMechanicItem(s,{source:'boundary-fixture',receiptId:`boundary:${definitionId}`,definitionId});expect(g.ok).toBe(true);if(!g.ok)throw new Error(g.reason);s=g.state;ids.push(`item-${s.nextItemSerial-1}`);}
 const before=s.items.filter(i=>ids.includes(i.id));s=advance(s);expect(s.items.filter(i=>ids.includes(i.id))).toEqual(before);
});
it('B5-16 running combat and equipment basis restore after an actual reroll',()=>{
 let s=advance(chosen());s=accepted(equipItem(s,s.items[0].id,s.preparation.units.find(u=>u.team==='player')!.id,0));
 s=accepted(startMatchCombat(fieldBench(s)));expect(s.phase).toBe('combat');s=stepMatch(s).state;trip(s);
 reject(s,x=>{x.combatInputBasis.inputs.items[0].definitionId='invalid-item';});
});
