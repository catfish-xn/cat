import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

/** D1 effect declaration; D5 registers catalogue, tier and stage tags. */
export const WHAT_YOU_REALLY_ARE = freezeContent({
  id:'what-you-really-are', apiName:'TFT13_Augment_Grant6Cost_Warwick', tier:'prismatic',
  name:'真心本色', description:'获得一个【饮血剑】。在你对其他玩家造成35伤害后，获得一个【沃里克】和一个【斯特拉克的挑战护手】。\n(当前：〔对局动态值〕)\n',
  source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{PlayerDamage:35},
    description_en_us:"Gain a Bloodthirster. After you deal 35 damage to other players, gain a Warwick and a Sterak's Gage.\n(Current: 〔对局动态值〕)\n",
    item_tags_raw:['{cf1fd3af}','{d02ae323}','{d12ae4b6}','{b72bd3bf}','{92e7310e}','{86d6da1b}','{7aaa3b47}']},
  gifts:[{kind:'item',definitionId:'bloodthirster'}] as readonly AugmentGiftSpec[],
  rewards:[{kind:'unit',definitionId:'warwick'},{kind:'item',definitionId:'steraks-gage'}] as readonly AugmentGiftSpec[],
} as const);
export const WHAT_YOU_REALLY_ARE_DEFINITION:ChoiceDefinition = freezeContent({
  id:WHAT_YOU_REALLY_ARE.id,name:WHAT_YOU_REALLY_ARE.name,description:WHAT_YOU_REALLY_ARE.description,
  effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}],
});
