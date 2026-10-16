import type { UnitDefinition } from '../unit-types';
import type { S13AbilityData } from './abilities';
import { freezeContent } from './freeze';
/** 约定值: full source stat blocks are unavailable; these finite bodies are explicitly project data. */
export const G23_SUMMON_UNITS:Readonly<Record<string,UnitDefinition>>=freezeContent({
 'g23-sion':{id:'g23-sion',name:'Sion',symbol:'S',color:10466749,cost:1,traits:[],summon:{sellable:false,countsTowardPopulation:false},baseStats:{health:1000,attack:100,armor:40,magicResist:40},attackRange:1,attackIntervalTicks:27,baseAttackSpeedBps:7500,initialMana:0,maxMana:100,abilityId:'g23-sion-ability'},
 'g23-forge':{id:'g23-forge',name:'Hextech Forge',symbol:'F',color:10466749,cost:1,traits:[],summon:{sellable:false,countsTowardPopulation:false},baseStats:{health:1000,attack:0,armor:0,magicResist:0},attackRange:1,attackIntervalTicks:1200,baseAttackSpeedBps:167,initialMana:0,maxMana:1,abilityId:'g23-forge-ability'},
});
export const G23_SUMMON_ABILITIES:Readonly<Record<string,S13AbilityData>>=freezeContent({
 'g23-sion-ability':{id:'g23-sion-ability',championId:'g23-sion',name:'Decimating Smash',description:'Project finite Sion: shield, line damage and stun. Base stats and stage assignment are conventions.',variables:{PercentAttackDamage:[3,3,3],Shield:[175,175,175],ShieldDuration:[5,5,5],StunDuration:[1.5,1.5,1.5]}},
 'g23-forge-ability':{id:'g23-forge-ability',championId:'g23-forge',name:'Hextech Forge',description:'A stationary, non-attacking forge; Jayce revives it on cast.',variables:{}},
});
export const G23_SUMMON_POLICY=freezeContent({classification:'约定值',nonCombatants:['g23-forge','g23-barrel'],survivorDamage:'roster-only',forgePlacement:'owner-coordinates-then-mirror',sion:{base:G23_SUMMON_UNITS['g23-sion'],starHealthBps:1500,stageOrdinalAssignment:[2,3,4,5,6],tier3StageBps:[10000,10000,10000,10000,10000],tier4StageBps:[9000,12500,20000,27000,35000],tier5StageBps:[10000,14000,21000,30000,36500],unlockCasts:5,unlockHpBps:6500},forge:{health:1000,armor:0,magicResist:0,attacks:false,reviveBps:10000,expires:'combat-end'}});
