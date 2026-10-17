import {freezeContent} from './freeze';
import type {UnitDefinition} from '../unit-types';
import type {S13AbilityData} from './abilities';
/** Riot14.6 HP + Riot14.7 total AD/star rows carried forward to14.24b.
 * Stage1/late clamp and treating rows as totals are pending conventions. */
export const G24_VOIDSPAWN_POLICY=freezeContent({
 health:[1000,1500,2000,2500,3000],attack:[80,80,120,180,180],stars:[1,1,2,3,3],
 source:['Riot14.6','Riot14.7','raw14.24'],convention:'G24-VOIDSPAWN-STAGES-01',
});
export const G24_VOIDSPAWN_UNITS:Readonly<Record<string,UnitDefinition>>=freezeContent({
 'g24-voidspawn':{id:'g24-voidspawn',name:'虚空生物',symbol:'虚',color:10466749,cost:1,traits:[],
  summon:{sellable:false,countsTowardPopulation:false,fixedStarStats:true},
  baseStats:{health:1000,attack:80,armor:30,magicResist:30},attackRange:1,attackIntervalTicks:27,
  baseAttackSpeedBps:7500,baseCritChanceBps:2500,baseCritMultiplierBps:14000,
  initialMana:0,maxMana:0,abilityId:'g24-voidspawn-ability'},
});
export const G24_VOIDSPAWN_ABILITIES:Readonly<Record<string,S13AbilityData>>=freezeContent({
 'g24-voidspawn-ability':{id:'g24-voidspawn-ability',championId:'g24-voidspawn',name:'虚空生物普攻',
  description:'Attack-only summoned unit. No taunt after Riot14.6.',variables:{}},
});
