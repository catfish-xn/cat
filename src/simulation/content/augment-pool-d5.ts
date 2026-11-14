import { freezeContent } from './freeze';
import { WHAT_YOU_REALLY_ARE_DEFINITION } from './augment-d1';
import { BRB_DEFINITION } from './augment-brb';
import { RESTART_MISSION_DEFINITION } from './restart-mission';
import { OVER_ENCUMBERED_DEFINITION } from './over-encumbered';

/** 14.24 research archive; stage tags copied verbatim, with the existing stage-tag interpretation. */
export const AUGMENT_D5 = freezeContent({
  'what-you-really-are': { apiName: 'TFT13_Augment_Grant6Cost_Warwick', tier: 'prismatic',
    item_tags_raw: ['{cf1fd3af}','{d02ae323}','{d12ae4b6}','{b72bd3bf}','{92e7310e}','{86d6da1b}','{7aaa3b47}'] },
  brb: { apiName: 'TFT_Augment_BRB', tier: 'gold',
    item_tags_raw: ['{ce1fd21c}','{b72bd3bf}','{92e7310e}','{24d36c27}','{d12ae4b6}','{d22ae649}','{7aaa3b47}'] },
  'over-encumbered': { apiName: 'TFT11_Augment_OverEncumbered', tier: 'silver',
    item_tags_raw: ['{d11fd6d5}','{b72bd3bf}','{24d36c27}','{d12ae4b6}','{d22ae649}','{7aaa3b47}'] },
  'restart-mission': { apiName: 'TFT_Augment_RestartMission', tier: 'silver',
    item_tags_raw: ['{d11fd6d5}','{92e7310e}','{24d36c27}','{d02ae323}','{d22ae649}','{7aaa3b47}','{b72bd3bf}'] },
} as const);
export const AUGMENT_D5_DEFINITIONS = freezeContent({
  'what-you-really-are': WHAT_YOU_REALLY_ARE_DEFINITION, brb: BRB_DEFINITION,
  'over-encumbered': OVER_ENCUMBERED_DEFINITION, 'restart-mission': RESTART_MISSION_DEFINITION,
});
export const AUGMENT_D5_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_D5).map(([id, row]) => [id, row.apiName])));
export const AUGMENT_D5_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_D5).map(([id, row]) => [id, row.tier])));
