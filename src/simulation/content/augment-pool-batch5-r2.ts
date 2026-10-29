import { freezeContent } from './freeze';
import { ITEM_DEFINITIONS as ORDINARY_ITEMS } from './items';
import { modifier, stat, trigger } from './item-programs';
import type { ChoiceDefinition, ItemDefinition } from '../strategy-types';

/** 14.24 archive + P-B5-21 (2026-10-27). Special catalogues are deliberately excluded. */
export const AUGMENT_BATCH5_R2 = freezeContent({
  'anger-issues': { apiName:'TFT_Augment_OopsAllRageblades', tier:'prismatic',
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{AttacksPerStack:2,ResistStackValue:45,StackValue:1}} },
  'another-anomaly': {apiName:'TFT13_Augment_AnotherAnomaly',tier:'gold',
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{}}},
} as const);
export const AUGMENT_BATCH5_R2_DEFINITIONS: Readonly<Record<string,ChoiceDefinition>> = freezeContent({
  'anger-issues': {id:'anger-issues',name:'狂暴到底',description:'当前和未来的普通成装变为鬼索的狂暴之刃，额外提供45双抗；每2层提供1%攻击力和1法强。',
    effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]},
  'another-anomaly': {id:'another-anomaly',name:'又一个异常突变',description:'4-6选择异常后立即获得便携异常装备：250生命、20%攻击力、25法强，携带者获得所选异常的效果。',
    effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]},
});
export const AUGMENT_BATCH5_R2_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_R2).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_R2_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_R2).map(([id,row])=>[id,row.apiName])));
export const isAngerIssuesConvertibleItem = (id:string):boolean => !!ORDINARY_ITEMS[id]?.recipe && ORDINARY_ITEMS[id].kind==='completed';

/** ExcludedAugments in 14.24 map22; P-B5-81 applies the entire six-entry list. */
export const PORTABLE_ANOMALY_EXCLUDED = freezeContent(['ultimate-hero','calling-card','identity-crisis','into-the-unknown','miniaturize','dual-wielding']);
export const PORTABLE_ANOMALY_PREFIX = 'TFT13_AnotherAnomaly_Item:';
export const portableAnomalyId = (id:string):string|null => id.startsWith(PORTABLE_ANOMALY_PREFIX)?id.slice(PORTABLE_ANOMALY_PREFIX.length):null;

/** Per physical item: the normal attack-completed trigger, plus one AD/AP award every two attacks.
 * Odd stacks carry forward; the existing item kernel activates growth on the next tick. */
export const ANGER_RAGEBLADE: ItemDefinition = freezeContent({
  ...ORDINARY_ITEMS.rageblade,
  effects:[...ORDINARY_ITEMS.rageblade.effects,{kind:'statFlat',stat:'armor',amount:45},{kind:'statFlat',stat:'magicResist',amount:45}],
  combatProgram:{...ORDINARY_ITEMS.rageblade.combatProgram,triggers:[...ORDINARY_ITEMS.rageblade.combatProgram?.triggers??[],
    trigger({id:'anger-growth',counters:[{id:'anger-attacks',events:[{event:'attack-completed',listener:{subject:'actor',relationToHolder:'self',withinHexes:null},qualifies:'completed-event'}],scope:'source-instance',reset:'combat-start',cap:null}],
      gate:{kind:'every-n',counterId:'anger-attacks',everyN:2,firstAt:2},effects:[
        {...stat(modifier('attackDamage',100,'bps'),null,'next-tick'),stackPolicy:{kind:'add-stacks',cap:10000}},
        {...stat(modifier('abilityPower',1),null,'next-tick'),stackPolicy:{kind:'add-stacks',cap:10000}},
      ]})]},
});
