import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 data and the approved P-B5-31 execution convention. */
export const AUGMENT_BATCH5_H3 = freezeContent({
  'no-scout-no-pivot': {
    apiName:'TFT_Augment_NoScoutNoPivot', name:'不侦察，不变阵', tier:'gold' as const,
    description:'参与玩家对战后，弈子无法再回到备战席或出售。每次玩家对战后，参战弈子都会获得20生命值、1.5%攻击力和1.5%法术强度。',
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{ADScale:0.014999999664723873,APScale:1.5,HPScale:20,MaxUnits:99,'{eba92878}':null}}, gifts:[],
  },
  'cooking-pot': {
    apiName:'TFT_Augment_CookingPot',name:'金色炊具',tier:'gold' as const,
    description:'在每回合开始时，所有持有【金锅锅】或【金铲铲】装备的弈子都会给予相距最近的弈子50永久生命值。获得1个【金锅锅】。',
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{AbilityPower:1,Health:50}},
    gifts:[{kind:'item' as const,definitionId:'frying-pan'}],
  },
});
export const AUGMENT_BATCH5_H3_DEFINITIONS: Readonly<Record<string,ChoiceDefinition>> = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H3).map(([id,row])=>[id,{id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]}])));
export const AUGMENT_BATCH5_H3_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H3).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_H3_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_H3).map(([id,row])=>[id,row.apiName])));
