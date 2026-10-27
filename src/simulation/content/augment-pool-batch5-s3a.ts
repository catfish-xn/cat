import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

/** 14.24 source; P-B5-S3A (2026-10-27). */
export const B5_13_CONTENT = freezeContent({
  apiName: 'TFT9_Augment_CustomerIsAlwaysRight',
  name: '基础装备自助餐',
  description: '每当你将要获得一件基础装备时，转而获得1个【基础装备锻造器】。获得1个随机的基础装备。\n\n这个锻造器提供4个选项。',
  tier: 'silver' as const,
  source: {
    patch: '14.24',
    archive: 'augments-research-2026-10-23/data/augments-14.24.json',
    values: {},
  },
  gifts: [{kind:'random-item',pool:'component',count:1}] as readonly AugmentGiftSpec[],
  anvilChoices: 4,
});

export const AUGMENT_BATCH5_S3A: Readonly<Record<string, {readonly apiName:string;readonly name:string;readonly description:string;readonly tier:'silver';readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>};readonly gifts:readonly AugmentGiftSpec[]}>> = freezeContent({
  'component-buffet': B5_13_CONTENT,
  'pandoras-items': {apiName:'TFT6_Augment_PandorasItems',name:'潘朵拉的装备',description:'回合开始时：你备战席上的装备会随机变化。\n\n获得1件随机基础装备。',tier:'silver',source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{NumComponents:1}},gifts:[{kind:'random-item',pool:'component',count:1}]},
  'fine-vintage': {apiName:'TFT11_Augment_FineVintage',name:'精致古董',description:'备战席上的成装会在放置4个回合后转化为【辅助装锻造器】。',tier:'silver',source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{rounds:4}},gifts:[]},
});
export const AUGMENT_BATCH5_S3A_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S3A).map(([id,row])=>[id,{id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]}])));
export const AUGMENT_BATCH5_S3A_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S3A).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_S3A_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S3A).map(([id,row])=>[id,row.apiName])));

/** Executable project scope, independent of source-stage eligibility. */
export const BATCH5_S3A_POLICY=freezeContent({
 version:'batch5-s3a-inventory-v1',convention:'P-B5-S3A-2026-10-27',
 componentBuffet:{initialComponent:1,anvilChoices:4,exclude:['existing-item-movement','forge-choice-results'],newSources:['schedule','loot','mechanic','carousel','reforge-new-output']},
 fineVintage:{entries:4,countSupply:true,countPve:true,reset:['leave-inventory','new-instance','definition-change'],sourceDisabled:true},
 pandora:{initialComponents:1,firstEntry:'after-acquisition',pools:['ordinary-components','ordinary-recipe-completed'],allowSame:true,stream:'seed-xor-fnv1a32-utf16(source,seat,choice,round,item)-lcg32-v1',liveRngDraws:0},
 anvils:{fullBench:'derived-escrow',supplyAndCombat:'defer-unit-birth',offers:'existing-augmentAnvilOffers'},
 history:'existing-item-births-equipment-consumables-upgrades-and-round-boundaries',
});
