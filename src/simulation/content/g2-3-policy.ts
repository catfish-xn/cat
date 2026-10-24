import { freezeContent } from './freeze';
import { G23_LOOT_SOURCE } from './g2-3-loot-source';
import { G24_FORGE_POLICY } from './g2-4-forges';
import { G23_SPECIAL_ITEM_SOURCE } from './g2-3-special-item-runtime';

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
 * lesser duplicator and Tactician's Crown are granted as sourced. G2-4b restores artifact/support anvils and the fixed
 * supports (tiers 10/11/13/14), so no Conqueror reward is deferred; the whole-tier cash floor stays for any future deferral. */
export const G23_DEFERRED_CONQUEROR_ITEMS=freezeContent<string[]>([]);
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
  revision:'g2-4b-v20-black-market', rngAlgorithm:'lcg32-v1', seedXor:0x67323370, forges:G24_FORGE_POLICY,
  // User2026-10-17: retain source identity; only the black-market duplicator requires Chem-Baron.
  duplicators:{
    TFT_Consumable_NeekosHelp:{name:'英雄复制器',maxCost:null,traitId:null},
    TFT_Consumable_ChampionDuplicator_III:{name:'次级英雄复制器',maxCost:3,traitId:null},
    TFT13_Crime_Consumable_LesserShimmerDuplicator:{name:'次级微光复制器',maxCost:3,traitId:'chem-baron'},
  },
  g24Items:{status:'eleven-runtime-entries-wip',trench:{thresholdBps:5000,healthBps:3000,copies:3,trigger:'surviving-post-damage-barrier',placement:'nearest-free-friendly-half-atomic-three',fullBoard:'defer-without-partial-spawn',inheritance:'static-declarations-reset-transient-state-no-recursive-coat',originalEarnedFacts:'retain-once',survivorDamage:'excluded',convention:'G24-TRENCH-INHERIT-01'},zephyr:{durationTicks:100,convention:'G24-ZEPHYR-ABSENCE-01'},voidspawn:{preparation:'movable-persistent-item-position',population:0,traitCount:0,stageHp:[1000,1500,2000,2500,3000],stageAd:[80,80,120,180],stageBounds:'stage1-as2-stage6plus-last',convention:'G24-VOIDSPAWN-STAGES-01'},mogul:{stackCap:35,healthPerStack:7,resistPerStack:1,gold:1,intervalTicks:160,hit:'positive-hp-or-shield-packet',convention:'G24-MOGUL-STACK-01'},gambler:{speedPerGoldBps:100,goldLimit:30,chanceBps:500,gold:1,bank:'frozen-opening-plus-own-side-battle-receipts',settlement:'end-of-combat',convention:'G24-ITEM-GOLD-01'},collector:{executeBps:1200,chanceBps:4000,gold:1,trigger:'execution-only',timing:'post-positive-ordinary-packet',execute:'bypass-shield-and-deferral',restore:'independent-combat-replay',convention:'G24-COLLECTOR-EXECUTE-01'},itemGoldSettlement:'positive-battle-item-receipts-once-v1',mirror:{healthBps:7000,manaIncreaseBps:1000,inheritance:'actual-owner-opening-hp-and-mana-other-stats-naked-same-star-form-active-traits',convention:'G24-MIRROR-INHERIT-01',placement:'nearest-free-friendly-cell-row-column',fullBoard:'no-spawn'},defiance:{fractionBps:5000,durationTicks:80,barrier:'post-shield',nonlethalExcess:'discard',bleedProcs:'none',convention:'G24-DEFIANCE-ORDER-01'},cutlass:{durationTicks:160,convention:'G24-CUTLASS-CELL-01'},shroud:{costIncreaseBps:3000,convention:'G24-SHROUD-BEAM-01'},fishbones:{targetPool:'living-targetable-in-effective-range',rangeStacking:'double-once-per-holder',streamSalt:0x66697368,selection:'sorted-id-floor-word-times-length-div-2pow32',draws:'one-per-actual-basic-attack',convention:'G24-FISHBONES-TARGET-01'}},
  conqueror:{radiantPoolExclusions:['TFT5_Item_ThiefsGlovesRadiant'],chests:G23_CONQUEROR_CHESTS,transitionalRewards:G23_CONQUEROR_CHESTS.map(g23ConquerorReward),deferredPolicy:'whole-tier-gold-floor-only-affected-v2', growthPerChestBps:500, progressCap:null,
    stacksPerTakedown:{2:1,4:3,6:6,9:20},radiantConversion:'equipped-board-and-bench-then-new-combinations'},
  highRoller:{first:[3500,3500,2000,1000],triple:[4000,3500,2450,50],mods:['rocket','shield','coin'],tripleMods:['blue-flamethrower','knockout-punch','quadruple-chomp','jackpot'],
    rockets:8,rocketPhysicalDamage:100,shield:500,shieldTicks:80,gold:3,durabilityBps:8000,durabilityTicks:30},
  rumble:{selfDestructResistBps:[16000,24000,2000000]},
  academy:{memberBaseBps:500,stacking:'per-matching-copy-base-once',grantsAtDistinctTier:[3,4,5]},
  // 14.24b Take All / Save Shimmer evidence (user 2026-10-22); source weights unchanged.
  // One weighted draw equals the former first candidate; no discarded RNG draws.
  chemBaron:{candidateCount:1,sampling:'weighted-single-bundle',shimmerRounds:'pvp-only',keep:'skip-retains-shimmer',equipment:'concrete-at-open-existing-reward-atom-substreams-v1'},
  blackMarkets:G23_BLACK_MARKETS,
  /** Source PercentGoldChance per crown; 约定值 G24-CROWN-GOLD-01..05 (deployed holder, PvE and PvP wins, one roll per crown). */
  crownGold:{chanceBps:G23_SPECIAL_ITEM_SOURCE.TFT_Item_ForceOfNature.values.PercentGoldChance*100,gold:1,holders:'equipped-on-deployed-unit-at-combat-start',results:['win'],roundKinds:['pve','pvp'],rolls:'one-per-crown-after-black-market'},
});
