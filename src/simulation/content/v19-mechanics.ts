import { freezeContent } from './freeze';
/** Local 14.24 archive values; execution/stacking conventions are documented in V19_MECHANICS.md. */
export const V19_MECHANICS = freezeContent({
  revision: 's13-mechanics-v19',
  dominator: {2:2500,4:4500,6:6500},
  garen: {healthBps:1200,sample:'all-opening-stats-before-own-broadcast'},
  sisters: {augmentId:'sisters',apiName:'TFT13_TeamupAugment_Sisters',adBps:4000,adTicks:140,speedBps:7500,speedTicks:100,stacking:'refresh-on-takedown'},
  rebel10: {periodTicks:240,permanentStats:'once',burst:'refresh',stun:'refresh'},
  blackRose: {minimumTier:4,ampBps:800,tierBinding:'inference',mark:'positive-hp-or-shield-damage',stacking:'non-stacking-convention'},
  chainblade: {id:'TFT13_Crime_Prismatic_ExecutionersVorpalblade',executeBps:2000,gold:3,heal:400,buffTicks:200,ampBps:2000,reductionBps:2000,
    goldEligibility:'pvp-enemy-champion-no-summon-or-copy',stacking:'one-per-holder',settlement:'unique-item-gold-receipt',modification:'restricted-gold-eligibility'},
});
