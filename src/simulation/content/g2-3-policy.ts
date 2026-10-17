import { freezeContent } from './freeze';
import { G23_LOOT_SOURCE } from './g2-3-loot-source';

type LootObject = { readonly pointer: string; readonly values: Readonly<Record<string, unknown>> };
const objects: Readonly<Record<string, LootObject>> = G23_LOOT_SOURCE;
/** Only enabled standard-game chests. Unreferenced tables 16–20 are archival data. */
export const G23_CONQUEROR_CHESTS = freezeContent(Array.from({length:15}, (_, i) => {
  const tier = i + 1, table = `ArmoryTable_TFT13_Warband_Cashout${tier}`;
  const enabled = Object.entries(objects[table].values).filter(([, weight]) => typeof weight === 'number' && weight > 0);
  if (enabled.length !== 1) throw new RangeError(`Expected one enabled Conqueror reward: ${tier}`);
  const [option, weight] = enabled[0];
  return {tier, threshold:objects.ArmoryTable_TFT13_Warband_CashoutBreakpoints.values[table] as number,
    table, option, weight:weight as number, reward:objects[option].values,estimatedGold:objects.ArmoryTable_TFT13_Warband_CashoutEstimatedGoldValues.values[table] as number};
}));
/** 约定值: user2026-10-16 13:46, narrowed by G2-4a (user 2026-10-17): Thief's Gloves, the completed-item anvil, the
 * lesser duplicator and Tactician's Crown are granted as sourced. Replace only still-deferred rewards (artifact/support
 * anvils, support items); floor total cash at source whole-tier estimate. */
export const G23_DEFERRED_CONQUEROR_ITEMS=freezeContent(['TFT_ArmoryKeyOrnn','TFT_ArmoryKeySupport','TFT_Item_ZekesHerald','TFT_Item_Chalice','TFT_Item_LocketOfTheIronSolari']);
export function g23ConquerorReward(chest:typeof G23_CONQUEROR_CHESTS[number]):Readonly<Record<string,unknown>>{
 const reward:Record<string,unknown>={};let deferred=false;
 // 约定值 (G2-4a review): a duplicator resolves after the chest's heroes, so tier 4 can copy the 3-cost hero it grants.
 const entries=Object.entries(chest.reward),duplicates=(value:unknown)=>Array.isArray(value)&&value.some(api=>String(api).includes('ChampionDuplicator'));
 for(const [key,value] of [...entries.filter(([,v])=>!duplicates(v)),...entries.filter(([,v])=>duplicates(v))]){
  if(['Item','ItemByKey','ExactItem','MeepTypeUnit'].includes(key)&&Array.isArray(value)){
   const keep=value.filter(api=>!G23_DEFERRED_CONQUEROR_ITEMS.includes(api));deferred ||=keep.length!==value.length;if(keep.length)reward[key]=keep;
  }else reward[key]=value;
 }
 if(deferred)reward.Gold=Math.max(Number(chest.reward.Gold??0),chest.estimatedGold);
 return reward;
}
export const G23_BLACK_MARKETS = freezeContent(Array.from({length:8}, (_, i) => {
  const table = `TFT13_Crime_BlackMarket${i + 1}`;
  return {tier:i+1,table,options:Object.entries(objects[table].values).map(([id,weight]) => ({id,weightBps:Math.round((weight as number)*10000),reward:objects[id].values}))};
}));
export const G23_POLICY = freezeContent({
  revision:'g2-4a-v5', rngAlgorithm:'lcg32-v1', seedXor:0x67323370,
  conqueror:{radiantPoolExclusions:['TFT5_Item_ThiefsGlovesRadiant'],chests:G23_CONQUEROR_CHESTS,transitionalRewards:G23_CONQUEROR_CHESTS.map(g23ConquerorReward),deferredPolicy:'whole-tier-gold-floor-only-affected-v2', growthPerChestBps:500, progressCap:null,
    stacksPerTakedown:{2:1,4:3,6:6,9:20},radiantConversion:'equipped-board-and-bench-then-new-combinations'},
  highRoller:{first:[3500,3500,2000,1000],triple:[4000,3500,2450,50],mods:['rocket','shield','coin'],tripleMods:['blue-flamethrower','knockout-punch','quadruple-chomp','jackpot'],
    rockets:8,rocketPhysicalDamage:100,shield:500,shieldTicks:80,gold:3,durabilityBps:8000,durabilityTicks:30},
  rumble:{selfDestructResistBps:[16000,24000,2000000]},
  academy:{memberBaseBps:500,stacking:'per-matching-copy-base-once',grantsAtDistinctTier:[3,4,5]},
  blackMarkets:G23_BLACK_MARKETS,
});
