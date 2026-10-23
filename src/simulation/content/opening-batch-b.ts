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
export const CRAB_GROUPS: Readonly<Record<string, readonly (readonly [number,number,number])[]>> = freezeContent({
 '1-2':[[6,3,250],[6,5,250]],'1-3':[[6,3,250],[6,5,250],[7,2,150]],
 '1-4':[[6,3,250],[6,5,250],[7,2,150],[7,5,150]],'2-7':[[5,1,1200],[7,2,1200],[5,6,1200]],
 '3-7':[[6,4,1300],[8,2,550],[8,3,550],[8,5,550],[8,6,550]],
 '4-7':[[8,4,2400],[6,2,1450],[7,2,1450],[7,5,1450],[6,6,1450]],
 '5-7':[[5,4,10000]],'6-7':[[5,4,10000]],
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
