import { freezeContent } from './freeze';
import { CHAMPION_ROLES, ROLE_DISPLAY } from './scrap-lucky-roles';
import type { ChoiceDefinition } from '../strategy-types';

/** 14.24 source numbers; selection is the approved P-B5-53/54 (2026-10-27), not the unused Tier1/2 tables. */
export const AUGMENT_BATCH5_G1 = freezeContent({
  'lucky-gloves': {
    apiName: 'TFT7_Augment_LuckyGloves', name: '幸运手套', tier: 'prismatic',
    description: '【窃贼手套】总会为你的弈子们提供理想的装备。获得2个【拳套】。在5回合后，获得另1个【拳套】。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      description_en_us: "Thief's Gloves will always give your champions ideal items. Gain 2 Sparring Gloves. In 5 rounds, get another Sparring Gloves.",
      values: { NumGloves: 2, NumRounds: 5 } },
    gifts: [{kind:'item',definitionId:'gloves',count:2}],
  },
  'lucky-gloves-plus': {
    apiName: 'TFT7_Augment_LuckyGlovesPlus', name: '幸运手套+', tier: 'prismatic',
    description: '【窃贼手套】总会为你的弈子们提供理想的装备。获得3个【拳套】。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      description_en_us: "Thief's Gloves will always give your champions ideal items. Gain 3 Sparring Gloves.",
      values: { NumGloves: 3 } },
    gifts: [{kind:'item',definitionId:'gloves',count:3}],
  },
} as const);

export const AUGMENT_BATCH5_G1_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(Object.fromEntries(
  Object.entries(AUGMENT_BATCH5_G1).map(([id,row]) => [id, {id,name:row.name,description:row.description,
    effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]}])));
export const AUGMENT_BATCH5_G1_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G1).map(([id,row]) => [id,row.tier])));
export const AUGMENT_BATCH5_G1_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G1).map(([id,row]) => [id,row.apiName])));

/** Archived 14.24 client role cards, in client order. Viktor's hashed seventh entry resolves to Morellonomicon. */
export const LUCKY_GLOVES_ROLE_ITEMS: Readonly<Record<string, readonly string[]>> = freezeContent({
  ...Object.fromEntries(Object.entries(ROLE_DISPLAY).map(([role,row]) => [role,row.items])),
  APCasterViktorS13: ['TFT_Item_JeweledGauntlet','TFT_Item_RabadonsDeathcap','TFT_Item_InfinityEdge','TFT_Item_Deathblade',
    'TFT_Item_MadredsBloodrazor','TFT_Item_UnstableConcoction','TFT_Item_Morellonomicon','TFT_Item_ArchangelsStaff'],
});
export const LUCKY_GLOVES_CHAMPION_ROLES: Readonly<Record<string,string>> = freezeContent({
  ...CHAMPION_ROLES, viktor:'APCasterViktorS13', mel:'APReaper', warwick:'ADFighter',
});
/** P-B5-53/54: apply the ranged role card to the form frozen by the existing Form Swapper rule. */
export const LUCKY_GLOVES_RANGED_ROLES: Readonly<Record<string,string>> = freezeContent({
  elise:'APCaster', swain:'APCaster', gangplank:'ADCaster', jayce:'ADCaster',
});
export const LUCKY_GLOVES_POLICY = freezeContent({
  version:'lucky-gloves-v1', evidence:'P-B5-53-54-2026-10-27',
  selection:'client-order-eight-recommendations-uniform-without-replacement-two',
  radiant:'map-selected-ordinary-items-to-corresponding-radiants',
  form:'current-form-at-combat-start', cache:'parent-round-holder-role-radiant',
  rng:'existing-equipment-lcg32-v1-rejection-sampling', delay:'five-subsequent-natural-round-entries',
});
