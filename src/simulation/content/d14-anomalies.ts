import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
/** Source identity/values: docs/evidence/d14-anomalies/source-excerpts.json.
 * Scaling, timing, return placement and sale are project conventions, not original facts. */
export const D14_POLICY = freezeContent({revision:'d14-production-v16',numRounds:3,gainedADBps:5000,gainedAP:50,
  ultimateBaseBps:58320,ultimatePhysicalStar:3,ultimateShares:9,
  timing:'last-settled-plus-three-real-ordinals',target:'board-champion;ultimate-one-cost-physical-three-star',
  effectiveStars:'combat-bully,emissary,sion,fourth-ability;survivor-damage-count-unchanged',
  friendship:'three-star-special-otherwise-star-count',returnPlacement:'bench-ascending-then-board-row-col-within-cap',
  fullSeat:'hold-same-instance-retry-after-resource-command',copy:'no-certificate',sale:'same-definition-three-star-price;retire-certificate'} as const);
export const D14_ANOMALIES: Readonly<Record<string,ChoiceDefinition>> = freezeContent({
  'ultimate-hero':{id:'ultimate-hero',name:'终极英雄',description:'仅限场上3星1费英雄。3次真实回合结算后永久晋升为有效4星；物理仍为3星、9份，售价与该英雄三星同价。',effects:[{kind:'mechanic',mechanic:'d14Anomaly',values:{enabled:1}}]},
  'into-the-unknown':{id:'into-the-unknown',name:'进入未知',description:'场上英雄携装备离场；3次真实回合结算后有空位时归来，永久获得50%攻击力和50法强。',effects:[{kind:'mechanic',mechanic:'d14Anomaly',values:{enabled:1}}]},
});
