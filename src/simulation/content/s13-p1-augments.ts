import type { ChoiceDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
/** 14.24 CDragon source values; source keys and original text are archived in the P1 reconciliation. */
export const S13_P1_AUGMENTS: Readonly<Record<string, ChoiceDefinition>> = freezeContent<Record<string, ChoiceDefinition>>({
  'blinding-speed': {id:'blinding-speed',name:'炫目之速',description:'获得红霸符、鬼索的狂暴之刃、反曲之弓和一个拆卸器。',effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]},
  'portable-forge': {id:'portable-forge',name:'便携锻炉',description:'从4件随机神器中选择1件。',effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]},
  'radiant-relics': {id:'radiant-relics',name:'光明圣物',description:'从5件光明装备中选择1件，获得一个拆卸器。',effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}]},
  'going-long': { id:'going-long', name:'遥遥领先', description:'不再获得利息。立即获得15金币，每回合开始获得4经验。', effects:[
    {kind:'mechanic',mechanic:'acquisitionGold',values:{amount:15}},
    {kind:'mechanic',mechanic:'incomePolicy',values:{interestDisabled:1,interestCap:0,roundXp:4}},
  ]},
  'hedge-fund': { id:'hedge-fund', name:'对冲基金', description:'获得25金币。最大利息提升至10。', effects:[
    {kind:'mechanic',mechanic:'acquisitionGold',values:{amount:25}},
    {kind:'mechanic',mechanic:'incomePolicy',values:{interestDisabled:0,interestCap:10,roundXp:0}},
  ]},
  'investment-strategy-ii': { id:'investment-strategy-ii', name:'投资策略 II', description:'获得5金币。最大利息提升至7。每获得1利息，全队永久获得9生命值。', effects:[
    {kind:'mechanic',mechanic:'acquisitionGold',values:{amount:5}},
    {kind:'mechanic',mechanic:'incomePolicy',values:{interestDisabled:0,interestCap:7,roundXp:0}},
    {kind:'mechanic',mechanic:'investment',values:{healthPerInterest:9}},
  ]},
});
