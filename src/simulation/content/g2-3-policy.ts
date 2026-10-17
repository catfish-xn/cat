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
/** 约定值: user2026-10-16 13:46. Replace only deferred rewards; floor total cash at source whole-tier estimate. */
export function g23ConquerorReward(chest:typeof G23_CONQUEROR_CHESTS[number]):Readonly<Record<string,unknown>>{
 const reward:Record<string,unknown>={};let deferred=false;
 const delayed=(api:string)=>api.includes('ArmoryKey')||api.includes('ForceOfNature')||api.includes('ThiefsGloves')||api.includes('ChampionDuplicator')||['TFT_Item_ZekesHerald','TFT_Item_Chalice','TFT_Item_LocketOfTheIronSolari'].includes(api);
 for(const [key,value] of Object.entries(chest.reward)){
  if(['MeepTypeUnit','Consumables'].includes(key)){deferred=true;continue;}
  if(['Item','ItemByKey','ExactItem'].includes(key)&&Array.isArray(value)){
   const keep=value.filter(api=>!delayed(api));deferred ||=keep.length!==value.length;if(keep.length)reward[key]=keep;
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
  revision:'g2-4b-mechanisms-wip-v10', rngAlgorithm:'lcg32-v1', seedXor:0x67323370,
  g24Items:{status:'eleven-runtime-entries-wip',trench:{thresholdBps:5000,healthBps:3000,copies:3,trigger:'surviving-post-damage-barrier',placement:'nearest-free-friendly-half-atomic-three',fullBoard:'defer-without-partial-spawn',inheritance:'static-declarations-reset-transient-state-no-recursive-coat',originalEarnedFacts:'retain-once',survivorDamage:'excluded',convention:'G24-TRENCH-INHERIT-01'},zephyr:{durationTicks:100,convention:'G24-ZEPHYR-ABSENCE-01'},voidspawn:{preparation:'movable-persistent-item-position',population:0,traitCount:0,stageHp:[1000,1500,2000,2500,3000],stageAd:[80,80,120,180],stageBounds:'stage1-as2-stage6plus-last',convention:'G24-VOIDSPAWN-STAGES-01'},mogul:{stackCap:35,healthPerStack:7,resistPerStack:1,gold:1,intervalTicks:160,hit:'positive-hp-or-shield-packet',convention:'G24-MOGUL-STACK-01'},gambler:{speedPerGoldBps:100,goldLimit:30,chanceBps:500,gold:1,bank:'frozen-opening-plus-own-side-battle-receipts',settlement:'end-of-combat',convention:'G24-ITEM-GOLD-01'},collector:{executeBps:1200,chanceBps:4000,gold:1,trigger:'execution-only',timing:'post-positive-ordinary-packet',execute:'bypass-shield-and-deferral',restore:'independent-combat-replay',convention:'G24-COLLECTOR-EXECUTE-01'},itemGoldSettlement:'positive-battle-item-receipts-once-v1',mirror:{healthBps:7000,manaIncreaseBps:1000,inheritance:'actual-owner-opening-hp-and-mana-other-stats-naked-same-star-form-active-traits',convention:'G24-MIRROR-INHERIT-01',placement:'nearest-free-friendly-cell-row-column',fullBoard:'no-spawn'},defiance:{fractionBps:5000,durationTicks:80,barrier:'post-shield',nonlethalExcess:'discard',bleedProcs:'none',convention:'G24-DEFIANCE-ORDER-01'},cutlass:{durationTicks:160,convention:'G24-CUTLASS-CELL-01'},shroud:{costIncreaseBps:3000,convention:'G24-SHROUD-BEAM-01'},fishbones:{targetPool:'living-targetable-in-effective-range',rangeStacking:'double-once-per-holder',streamSalt:0x66697368,selection:'sorted-id-floor-word-times-length-div-2pow32',draws:'one-per-actual-basic-attack',convention:'G24-FISHBONES-TARGET-01'}},
  conqueror:{radiantPoolExclusions:['TFT5_Item_ThiefsGlovesRadiant'],chests:G23_CONQUEROR_CHESTS,transitionalRewards:G23_CONQUEROR_CHESTS.map(g23ConquerorReward),deferredPolicy:'whole-tier-gold-floor-only-affected-v1', growthPerChestBps:500, progressCap:null,
    stacksPerTakedown:{2:1,4:3,6:6,9:20},radiantConversion:'equipped-board-and-bench-then-new-combinations'},
  highRoller:{first:[3500,3500,2000,1000],triple:[4000,3500,2450,50],mods:['rocket','shield','coin'],tripleMods:['blue-flamethrower','knockout-punch','quadruple-chomp','jackpot'],
    rockets:8,rocketPhysicalDamage:100,shield:500,shieldTicks:80,gold:3,durabilityBps:8000,durabilityTicks:30},
  rumble:{selfDestructResistBps:[16000,24000,2000000]},
  academy:{memberBaseBps:500,stacking:'per-matching-copy-base-once',grantsAtDistinctTier:[3,4,5]},
  blackMarkets:G23_BLACK_MARKETS,
});
