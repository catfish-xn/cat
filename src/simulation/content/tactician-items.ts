import type { ItemDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
/** Retained raw 14.24b map22 + en_us/zh_cn stringtables, source/s13-14.24b/raw.
 * Ring = Cape, Scepter = Shield; runtime names must not be guessed from those API suffixes.
 */
export const TACTICIAN_ITEM_SOURCE=freezeContent({
 TFT_Item_TacticiansRing:{name:'金锅铲冠冕',enName:"Tactician's Cape",values:{MaxArmySizeIncrease:1,PercentGoldChance:10,Timer:10},description:'你的队伍获得+1最大队伍规模。在战斗10秒后，有10%几率掉落1金币。'},
 TFT_Item_TacticiansScepter:{name:'金锅锅冠冕',enName:"Tactician's Shield",values:{MaxArmySizeIncrease:1,PercentGoldChance:10},description:'你的队伍获得+1最大队伍规模。在携带者阵亡时，有10%几率掉落1金币。'},
});
export const TACTICIAN_ITEMS:Readonly<Record<string,ItemDefinition>>=freezeContent(Object.fromEntries(Object.entries(TACTICIAN_ITEM_SOURCE).map(([id,row])=>[id,{
 id,apiName:id,name:row.name,kind:'completed',unique:false,slotCost:1,evidenceStatus:'source-reviewed',recipe:id==='TFT_Item_TacticiansRing'?['spatula','frying-pan']:['frying-pan','frying-pan'],
 effects:[{kind:'mechanic',mechanic:'g23Tactician',values:{goldChanceBps:row.values.PercentGoldChance*100,timerTicks:'Timer' in row.values?row.values.Timer*20:0}}],combatProgram:{},effectDescriptions:[row.description],
}])));
export const TACTICIAN_SIZE_ITEMS=['TFT_Item_ForceOfNature',...Object.keys(TACTICIAN_ITEMS)] as readonly string[];
