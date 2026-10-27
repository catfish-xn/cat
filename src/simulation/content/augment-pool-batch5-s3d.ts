import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

/** P-B5-24, user approved 2026-10-27; values from the 14.24 archive. */
export const AUGMENT_BATCH5_S3D = freezeContent({
  'replication': {
    apiName:'TFT_Augment_Replication', name:'反响',
    description:'在3件基础装备中选择1件。在接下来的2回合，获得1件该基础装备。',
    tier:'gold' as const,
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{Gold:null,roundsofbonusitems:2}},
    gifts:[] as readonly AugmentGiftSpec[],
  },
  'quality-over-quantity': {
    apiName:'TFT_Augment_QualityOverQuantity', name:'重质不重量',
    description:'每场战斗开始时，恰持一件永久装备的弈子将可升级的普通成装临时光明化。持有光明装备的弈子获得12%生命值。获得2个装备拆卸器。',
    tier:'prismatic' as const,
    source:{patch:'14.24',archive:'augments-research-2026-10-23/data/augments-14.24.json',values:{BonusHealth:0.11999999731779099,MaxUnits:99,NumRemovers:2}},
    gifts:[{kind:'consumable',definitionId:'magnetic-remover',count:2}] as readonly AugmentGiftSpec[],
  },
});
export const AUGMENT_BATCH5_S3D_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S3D).map(([id,row])=>[id,{id,name:row.name,description:row.description,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]}])));
export const AUGMENT_BATCH5_S3D_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S3D).map(([id,row])=>[id,row.tier])));
export const AUGMENT_BATCH5_S3D_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_S3D).map(([id,row])=>[id,row.apiName])));
