import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

/** 14.24 archive values; P-B5-S3B defines the project's execution convention. */
interface Row { readonly apiName:string; readonly name:string; readonly description:string; readonly tier:'gold'; readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>}; readonly gifts:readonly AugmentGiftSpec[] }
export const AUGMENT_BATCH5_S3B:Readonly<Record<string,Row>> = freezeContent({
  'salvage-bin': {
    apiName:'TFT6_Augment_SalvageBin',name:'打捞桶',tier:'gold',
    description:'立刻获得1件随机成装，完成7次玩家对战后获得1件随机基础装备。出售弈子时将其普通永久成装拆为基础装备；特殊装备原样返回。',
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{NumRounds:7}},
    gifts:[{kind:'random-item',pool:'completed',count:1}],
  },
  'pandoras-items-ii': {
    apiName:'TFT9_Augment_PandorasItems2',name:'潘朵拉的装备 II',tier:'gold',
    description:'回合开始时，将库存中的普通组件和普通可合成成装分别随机变化（可保持原样）。获得2件随机基础装备。',
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{NumCompletedItems:null,NumComponents:2}},
    gifts:[{kind:'random-item',pool:'component',count:2}],
  },
  'academic-research': {
    apiName: 'TFT13_Augment_Academy',
    name: '学术研究',
    description: '每当你合成一件普通成装时，转而获得一个锻造器，提供该成装和一件不同的皮城学院赞助装备。获得1件随机基础装备、拉克丝和伊泽瑞尔。',
    tier: 'gold',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { NumItems: 1, NumOptions: 2 } },
    gifts: [ { kind: 'random-item', pool: 'component', count: 1 }, { kind: 'unit', definitionId: 'lux' }, { kind: 'unit', definitionId: 'ezreal' } ] as readonly AugmentGiftSpec[],
  },
} as const);

export const AUGMENT_BATCH5_S3B_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S3B).map(([id,row])=>[id,{id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]}])));
export const AUGMENT_BATCH5_S3B_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S3B).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_S3B_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S3B).map(([id,row])=>[id,row.apiName])));
