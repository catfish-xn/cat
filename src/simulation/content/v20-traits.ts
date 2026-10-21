import { freezeContent } from './freeze';
import type { ChoiceDefinition, TraitDefinition } from '../strategy-types';

/** Approved custom execution; archived 14.24b source tables remain unchanged. */
export const V20_TRAITS = freezeContent({
  revision:'v20-traits-review-fixes-1', classification:'魔改',
  movementEligibility:'ordinary-and-trait-dash-shared-current-tick-control-channel-roots-proxy-bound-forge',
  quickstriker:{movementTenths:3,initialCreditTenths:7,creditCapTenths:13,dash:'next-tick-nearest-target-adjacent-reserved'},
  firelight:{periodTicks:120,windowTicks:20,escapeHexes:2,attackSpeedBps:35000,classification:'工程取值',damage:'actual-hp-only',blockedMovement:'window-and-heal-still-apply'},
  mentorship:{partners:['ambessa','caitlyn'],name:'军事管制',apiName:'TFT13_TeamupAugment_Mentorship'},
  reunion:{partners:['vi','ekko'],name:'重新联合',apiName:'TFT13_TeamupAugment_Reunion'},
  geniuses:{partners:['heimerdinger','ekko'],name:'天才',apiName:'TFT13_TeamupAugment_Geniuses'},
  menaces:{partners:['powder','silco'],name:'危险人物',apiName:'TFT13_TeamupAugment_Menaces'},
  'unlikely-duo':{partners:['jinx','sevika'],name:'意外搭档',apiName:'TFT13_TeamupAugment_UnlikelyDuo'},
  execution:{adShareBps:2500,attackBps:22500,reunionEchoBps:5000,waveBps:15000,geniusEchoBps:3300,missileBps:12000,
    duoAdBps:1000,duoHealth:100,duoMana:10,luckBps:1000,monstrosities:3,cooperationDelayTicks:1,monkeyImpactDelayTicks:1,minionTarget:'nearest-current-id-ties',minionBody:'untargetable-nonoccupying-attack-agent',steelArm:'existing-abstract-bucket-to-corresponding-triple-no-jackpot-upweight',
    partners:'opening-items-desc-stars-desc-id',derived:'damage-only-no-cast-no-basic-attack',family:'count-and-death-membership-but-suppress-powder-benefits-including-reunion-star'},
});
export const TEAMUP_IDS = ['mentorship','reunion','geniuses','menaces','unlikely-duo'] as const;
export type TeamupId = typeof TEAMUP_IDS[number];
export const V20_TEAMUP_TRAITS:Readonly<Record<string,TraitDefinition>> = freezeContent(Object.fromEntries(TEAMUP_IDS.map(id=>[id,{
  id,name:V20_TRAITS[id].name,target:'members',tiers:[{threshold:2,effects:[{kind:'mechanic',mechanic:'v20Teamup',values:{enabled:1}},...(id==='unlikely-duo'?[{kind:'statPercentBps',stat:'attackDamage',bps:1000} as const,{kind:'statFlat',stat:'maxHp',amount:100} as const]:[])]}],
}])));
export const V20_TEAMUP_AUGMENTS:Readonly<Record<string,ChoiceDefinition>> = freezeContent(Object.fromEntries(TEAMUP_IDS.map(id=>[id,{
  id,name:V20_TRAITS[id].name,description:`获得${V20_TRAITS[id].partners.join('、')}。两种伙伴在场时解锁${V20_TRAITS[id].name}（魔改，执行细则见规则契约）。`,effects:[{kind:'mechanic',mechanic:'v20Unlock',values:{enabled:1}}],
}])));
