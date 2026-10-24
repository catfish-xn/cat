import type { UnitDefinition } from '../unit-types';
import type { S13AbilityData } from './abilities';
import { freezeContent } from './freeze';
/** Sion: 14.24 TFT13_Sion root record (750 HP, 50 AD, 0 armor, 120/120 mana, 0.7 AS, melee) and TFT13_SionSpell values.
 * Forge: 约定值, no source stat block. */
export const G23_SUMMON_UNITS:Readonly<Record<string,UnitDefinition>>=freezeContent({
 'g23-sion':{id:'g23-sion',name:'Sion',symbol:'S',color:10466749,cost:1,traits:[],summon:{sellable:false,countsTowardPopulation:false},baseStats:{health:750,attack:50,armor:0,magicResist:0},attackRange:1,attackIntervalTicks:29,baseAttackSpeedBps:7000,initialMana:120,maxMana:120,abilityId:'g23-sion-ability'},
 'g23-forge':{id:'g23-forge',name:'Hextech Forge',symbol:'F',color:10466749,cost:1,traits:[],summon:{sellable:false,countsTowardPopulation:false},baseStats:{health:1000,attack:0,armor:0,magicResist:0},attackRange:1,attackIntervalTicks:1200,baseAttackSpeedBps:167,initialMana:0,maxMana:1,abilityId:'g23-forge-ability'},
});
export const G23_SUMMON_ABILITIES:Readonly<Record<string,S13AbilityData>>=freezeContent({
 'g23-sion-ability':{id:'g23-sion-ability',championId:'g23-sion',name:'Decimating Smash',description:'Gain a shield, then damage and stun enemies in a line. Unshackled Sion charges the nearest enemy.',variables:{PercentAttackDamage:[3,3,3],Shield:[175,175,175],ShieldDuration:[3,3,3],StunDuration:[1,1,1],ChargeADPercent:[1,1,1],ChargeKnockupDuration:[0.5,0.5,0.5],NovaAbilityPower:[100,100,100],PercentReviveHealth:[0.75,0.75,0.75],PercentAttackSpeed:[3,3,3],PercentOmnivamp:[0.4,0.4,0.4]}},
 'g23-forge-ability':{id:'g23-forge-ability',championId:'g23-forge',name:'Hextech Forge',description:'A stationary, non-attacking forge; Jayce revives it on cast.',variables:{}},
});
export const G23_SUMMON_POLICY=freezeContent({classification:'约定值',nonCombatants:['g23-forge','g23-barrel'],survivorDamage:'roster-only',forgePlacement:'owner-coordinates-then-mirror',sion:{base:G23_SUMMON_UNITS['g23-sion'],starHealthBps:1500,starAttackBps:1200,resistsByTier:{3:40,4:45,5:50,7:100},tier5ShieldAp:75,reviveDelayTicks:20,stageOrdinalAssignment:[2,3,4,5,6],tier3StageBps:[10000,10000,10000,10000,10000],tier4StageBps:[9000,12500,20000,27000,35000],tier5StageBps:[10000,14000,21000,30000,36500],unlockCasts:5,unlockHpBps:6500},forge:{health:1000,armor:0,magicResist:0,attacks:false,reviveBps:10000,expires:'combat-end'}});
