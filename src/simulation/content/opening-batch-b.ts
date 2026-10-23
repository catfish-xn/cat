import { freezeContent } from './freeze';
import type { UnitDefinition } from '../unit-types';
// 2026-10-23 approved A1–A5, W1–W4, J1–J5. Evidence lives in the report.
export const TRAINER_ID = 'trainer-golem';
export const TRAINER_EMBLEMS = freezeContent('Cabal Crime Experiment Family Hoverboard Rebel Squad Warband Academy Automata Scrap Ambusher Bruiser Challenger Invoker PitFighter Sorcerer Demolitionist Sniper Titan Watcher Infused'.split(' ').map(s => `TFT13_Item_${s}EmblemItem`));
export const TRAINER_HEALTH = [600,1080,1944] as const;
export const TRAINER_ATTACK_CENTI = [5500,8250,12375] as const;
export const TRAINER_DAMAGE = [300,480,750] as const;
export const TRAINER_UNIT: UnitDefinition = freezeContent({id:TRAINER_ID,name:'魔像',symbol:'像',color:9993582,cost:1,traits:[],
  summon:{sellable:false,countsTowardPopulation:false,fixedStarStats:true},baseStats:{health:600,attack:55,armor:40,magicResist:40},
  attackRange:1,attackIntervalTicks:37,baseAttackSpeedBps:5500,initialMana:30,maxMana:100,abilityId:'trainer-golem-ability'});
export const WARWICK_DROP_BPS = 3000;
export const WARWICK_COMMON_BPS = 9500;
export const WARWICK_RARE_BPS = 500;
export const WARWICK_COMMON_WEIGHTS = [8300,1500,200] as const;
export const WARWICK_RARE_WEIGHTS = [5000,2900,1000,500,500,100] as const;
export const WARWICK_EXCLUDED_AUGMENTS = ['TFT9_Augment_DravenSpoilsOfWar','TFT9_Augment_DravenSpoilsOfWar2','TFT9_Augment_DravenSpoilsOfWar3'] as const;
export const CRAB_MOVE_TICKS = 80;
export const GIANT_CRAB_HEALTH = 20000;
export const GIANT_CRAB_ARMOR = 100;
export const GIANT_CRAB_MAGIC_RESIST = 100;
export const GIANT_CRAB_FIRST_JUMP_TICKS = 40;
export const GIANT_CRAB_JUMP_INTERVAL_TICKS = 40;
export const GIANT_CRAB_JUMP_DAMAGE = 100;
export const GIANT_CRAB_FROM_STAGE = 5;
export const GIANT_CRAB_ANVILS = 2;
export const GIANT_CRAB_SILVER_BOXES = 2;
export const GIANT_CRAB_BASIC_ATTACK = false;
// Raw row, raw column, HP. Project mapping: col=column-1, row=8-row.
// P (10-24, coordinator for the user): scuttle HP is unverified in the research, so each round's crabs split
// the replaced authored neutrals' total HP (remainder to the first crabs): 220/440/760/1200/2700/4800/6000/9000.
export const CRAB_GROUPS: Readonly<Record<string, readonly (readonly [number,number,number])[]>> = freezeContent({
 '1-2':[[6,3,110],[6,5,110]],'1-3':[[6,3,147],[6,5,147],[7,2,146]],
 '1-4':[[6,3,190],[6,5,190],[7,2,190],[7,5,190]],'2-7':[[5,1,400],[7,2,400],[5,6,400]],
 '3-7':[[6,4,540],[8,2,540],[8,3,540],[8,5,540],[8,6,540]],
 '4-7':[[8,4,960],[6,2,960],[7,2,960],[7,5,960],[6,6,960]],
 '5-7':[[5,4,6000]],'6-7':[[5,4,9000]],
});
export const isCrabEncounter = (id: string|null|undefined) => id==='scuttle-puddle'||id==='crab-rave';
export const trainerStar = (stage:number):1|2|3 => stage>=6?3:stage>=4?2:1;
export const giantCrabDamage = (jump:number):number => {
 if(!Number.isSafeInteger(jump)||jump<1)throw new RangeError('Invalid crab jump');
 return GIANT_CRAB_JUMP_DAMAGE*jump;
};

export const OPENING_BATCH_B_POLICY=freezeContent({version:'opening-batch-b-20261023-v1',
 trainer:{emblems:TRAINER_EMBLEMS,health:TRAINER_HEALTH,attackCenti:TRAINER_ATTACK_CENTI,damage:TRAINER_DAMAGE},
 warwick:{dropBps:WARWICK_DROP_BPS,commonBps:WARWICK_COMMON_BPS,rareBps:WARWICK_RARE_BPS,common:WARWICK_COMMON_WEIGHTS,rare:WARWICK_RARE_WEIGHTS,excluded:WARWICK_EXCLUDED_AUGMENTS},
 crabs:{groups:CRAB_GROUPS,moveTicks:CRAB_MOVE_TICKS,giant:{fromStage:GIANT_CRAB_FROM_STAGE,basicAttack:GIANT_CRAB_BASIC_ATTACK,health:GIANT_CRAB_HEALTH,armor:GIANT_CRAB_ARMOR,magicResist:GIANT_CRAB_MAGIC_RESIST,first:GIANT_CRAB_FIRST_JUMP_TICKS,period:GIANT_CRAB_JUMP_INTERVAL_TICKS,damage:GIANT_CRAB_JUMP_DAMAGE,anvils:GIANT_CRAB_ANVILS,silver:GIANT_CRAB_SILVER_BOXES}},
});
