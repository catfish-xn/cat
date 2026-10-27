import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
/** Values from the 14.24 archive; execution follows P-B5-37 (2026-10-27). */
export const AUGMENT_BATCH5_H6 = freezeContent({
  'scoreboard-scrapper': { apiName:'TFT11_Augment_ScoreboardScrapper', name:'冲榜战士', description:'每个后续回合开始时，排名后四的当前英雄永久获得1.5%攻击力与1.5法术强度；排名前四时本回合英雄获得10%生命值。', tier:'gold' as const,
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{BottomHalf:4,LoserBoost:0.014999999664723873,UpperHalf:4,WinningStatBoost:0.10000000149011612}} },
  contested: { apiName:'TFT_Augment_Contested', name:'纷争', description:'每次玩家对战回合后，每有2名其他存活玩家在开战时登场你备战席最左英雄的同名英雄，获得2金币。', tier:'gold' as const,
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{GoldPerInstance:2,PlayerPerInstance:2}} },
});
export const AUGMENT_BATCH5_H6_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H6).map(([id,row])=>[id,{id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]}])));
export const AUGMENT_BATCH5_H6_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H6).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_H6_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H6).map(([id,row])=>[id,row.apiName])));
