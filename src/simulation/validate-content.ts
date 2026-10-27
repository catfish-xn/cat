import { AUGMENT_BATCH5_H4 } from './content/augment-pool-batch5-h4';
import { AUGMENT_BATCH5 } from './content/augment-pool-batch5';
import { AUGMENT_SHOP } from './content/augment-pool-shop';
import { AUGMENT_BATCH4 } from './content/augment-pool-batch4';
import { AUGMENT_BATCH4_B4XP } from './content/augment-pool-batch4-b4xp';
import { AUGMENT_BATCH4_B4REROLL } from './content/augment-pool-batch4-b4reroll';
import { B4COMBAT_FIELDS, AUGMENT_BATCH4_B4COMBAT } from './content/augment-pool-batch4-b4combat';
import { AUGMENT_BATCH2_ENABLED } from './content/augment-pool-batch2';
import { AUGMENT_BATCH1 } from './content/augment-pool-batch1';
import { AUGMENT_BATCH3 } from './content/augment-pool-batch3';
import { AUGMENT_BATCH3_XP } from './content/augment-pool-batch3-xp';
import { validateItemProgram } from './m8/item-program';
import { validateComponentPool } from './component-pool';
import { ABILITY_DEFINITIONS, validateAbilityDefinitions } from './combat-abilities';
import { UNIT_DEFINITIONS, M5_UNIT_DEFINITIONS, NEUTRAL_UNIT_DEFINITIONS, M8_NEUTRAL_UNIT_DEFINITIONS, validateUnitDefinitions } from './units';
import { MATCH_RULES, SHOP_CATALOG_BY_COST, SHOP_ODDS, XP_TO_NEXT_LEVEL } from './match-rules';
import { TRAIT_DEFINITIONS } from './content/traits';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { P3_AUGMENTS, P3_ANOMALIES } from './content/s13-p3';
import { S13_P2_AUGMENTS, S13_P2_ANOMALIES } from './content/s13-augments-p2';
import { ANOMALY_DEFINITIONS } from './content/anomalies';
import { S13_ABILITY_DATA } from './content/abilities';
import { FINAL_ROUND, ROUND_SCHEDULE } from './round-schedule';
import { ROUND_CATALOG } from './content/round-catalog';
import type { AbilityDefinition } from './ability-types';
import type { CostTier, UnitDefinition } from './unit-types';
import type { ChoiceDefinition, Effect, ItemDefinition, ScheduleEvent, Stat, TraitDefinition } from './strategy-types';

export interface ContentCatalogs {
  readonly units: Readonly<Record<string,UnitDefinition>>;
  readonly abilities: Readonly<Record<string,AbilityDefinition>>;
  readonly traits: Readonly<Record<string,TraitDefinition>>;
  readonly items: Readonly<Record<string,ItemDefinition>>;
  readonly augments: Readonly<Record<string,ChoiceDefinition>>;
  readonly anomalies: Readonly<Record<string,ChoiceDefinition>>;
  readonly shopCatalog: Readonly<Record<CostTier,readonly string[]>>;
  readonly schedule: {readonly fixed:readonly {readonly round:number;readonly event:ScheduleEvent}[];
    readonly recurring:{readonly fromRound:number;readonly everyRounds:number;readonly randomComponents:number};
    readonly fallbackDefinitionId:string};
}
const STATS:readonly Stat[]=['maxHp','attackDamage','armor','magicResist','initialMana','abilityAmount','abilityPower'];
const integer=(v:unknown,min=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
const fail=(s:string):never=>{throw new RangeError(s);};
const keysAre=(v:object,keys:readonly string[])=>Object.keys(v).every(key=>keys.includes(key));
function finiteJson(v:unknown,seen=new Set<object>()):void {
  if(v===null||typeof v==='boolean'||typeof v==='string') return;
  if(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=Number.MAX_SAFE_INTEGER) return;
  if(typeof v!=='object'||v===null||(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype)||seen.has(v)) fail('Content must be finite plain JSON');
  if(Object.getOwnPropertySymbols(v as object).length) fail('Symbol keys are forbidden');
  if(Array.isArray(v)) for(let i=0;i<v.length;i++) if(!Object.hasOwn(v,i)) fail('Sparse content');
  seen.add(v as object);for(const x of Object.values(v as object)) finiteJson(x,seen);seen.delete(v as object);
}
function ids<T extends {readonly id:string}>(catalog:Readonly<Record<string,T>>,kind:string):void {
  for(const [id,entry] of Object.entries(catalog)) if(!entry||entry.id!==id||!(/^[a-z][a-z0-9-]*$/.test(id)||kind==='items'&&Object.hasOwn(ITEM_DEFINITIONS,id)||kind==='anomalies'&&Object.hasOwn(ANOMALY_DEFINITIONS,id))) fail(`Invalid ${kind} ID: ${id}`);
}
/** Each finite mechanic has an explicit schema. Unknown names/fields are rejected before play. */
export const MECHANIC_FIELDS:Readonly<Record<string,readonly string[]>>=Object.freeze({
  d14Anomaly:['enabled'],d11Fill:['enabled'],
  s13P2Augment:['enabled'],s13P2Anomaly:['enabled'],s13P2ItemAugment:['enabled'],
  s13Anomaly:['enabled'],
  g24Zephyr:['durationTicks','allyAttackSpeedBps'],
  g24Fishbones:['rangeMultiplier'],
  g24SpectralCutlass:['durationTicks'],
  g24Shroud:['costIncreaseBps','allyHealth'],
  g24DeathsDefiance:['fractionBps','durationTicks'],
  g24Mirror:['healthBps','manaIncreaseBps'],
  g24Trench:['thresholdBps','healthBps'],
  g24Collector:['executeBps'],
  v20Unlock:['enabled'],v20Teamup:['enabled'],v19Chainblade:['executeBps','pvp'],v19Garen:['healthBps'],formSwapper:['frontReductionBps','backAmpBps'],sisters:['adBps','speedBps','adTicks','speedTicks'],sistersUnlock:['enabled'],
  g24Gambler:['goldLimit','speedPerGoldBps'],
  g24Mogul:['stackCap','healthPerStack','resistPerStack','goldIntervalTicks'],
  quickstriker:['minBps','maxBps','shield','durationTicks'],g23Experiment:['warwick','mundo','nunu','zyra','urgot','twitch'],visionary:['manaBps','allyHealingBps'],g23Junker:['flame','rod','repair','death','tank','titan'],g23Sion:['tier'],g23Trait:['tier'], g23Anomaly:['enabled'],
  mentorship:['health', 'attackSpeedBps'],
  itemCollector:['baseHealth', 'healthPerItem', 'adBpsPerItem', 'apCentiPerItem'],
  backup:['minimum', 'attackSpeedBps'],
  lineup:['resistCentiPerUnit'],
  findCenter:['healthBps', 'damageAmpBps'],
  littleBuddies:['health', 'attackSpeedBps'],
  bronzeForLife:['damageAmpBps', 'durabilityBps'],
  builtDifferent:['health2', 'health3', 'health4', 'health5', 'speed2', 'speed3', 'speed4', 'speed5'],
  blisteringStrikes:['durationTicks', 'burnBpsPerSecond', 'woundBps'],
  fractionalFlat:['armorCenti', 'magicResistCenti', 'abilityPowerCenti'],
  clockworkAccelerator:['attackSpeedBps', 'periodTicks'],
  loneHero:['attackSpeedBps', 'durabilityBps'],
  climbLadder:['adBps', 'abilityPower', 'armor', 'magicResist'],
  inspiringEpitaph:['shieldMaxHpBps', 'attackSpeedBps'],
  rebel:['thresholdBps','adApBps','bonusHpBps','stunTicks','attackSpeedBps','durationTicks','forcedPeriodTicks'], enforcer:['shieldBps','wanted','attackSpeedBps'], academy:['sponsoredBps','memberBaseBps'], scrap:['shieldPerComponent','conversions','durationTicks','componentCount'], emissary:['armorPerWin','healthBps','mana','starSpeedBps'],
  automata:['crystals','damage','conversionBps'],firelight:['periodTicks','healBps','attackSpeedBps','dashTicks'],family:['manaReductionBps','damageReductionBps','heist'],
  artillery:['everyN','adBps','radius'],sniper:['damageBpsPerHex'],watcher:['reductionBps','healthyReductionBps','thresholdBps'],
  rageblade:['attackSpeedBps'],damageAmp:['bps'],extraAttackMana:['amount','backRowOnly'],archangel:['periodTicks','abilityPower'],
  dragonClaw:['periodTicks','healMaxHpBps'],gargoyle:['resistPerEnemy'],gunblade:['selfHealBps','allyHealBps'],
  coronation:['enabled'],g23Tactician:['goldChanceBps','timerTicks'],
  ...B4COMBAT_FIELDS,traitAugmentB2:['enabled','converted'],superstars:['baseBps','per3StarBps'],flexible:['healthPerEmblem'],corrosion:['resistLoss','periodTicks'],blazingSoul:['abilityPower','attackSpeedBps','periodTicks'],nobleSacrifice:['baseResists','shareBps'],wealthyRehab:['omnivampBps'],badLuck:['ratioBps'],goldForDummies:['periodTicks'],towerDefense:['apRatio1','apRatio2','apRatio3','upgrade1Stage','upgrade1AsBps','upgrade2Stage','upgrade2Bps'],towerDefenseLive:['apRatio','extraBps'],magicRoll:['health'],forming:['golem','healthBps','attackBps','healthPerStage'],heroCarry:['hero', 'manaReduction', 'hitBps', 'hits', 'omnivampBps', 'attackSpeedBps', 'dashAd1', 'dashAd2', 'dashAd3', 'dashAp1', 'dashAp2', 'dashAp3', 'dashRange', 'speedBps', 'speedTicks', 'permanentAdBps', 'mainBps', 'chargeBps', 'pounceRange', 'damageBps', 'splashBps', 'rangeBonus', 'attackMana', 'ampBps', 'overkillBps', 'near1', 'near2', 'near3'],heroCarryLive:['hero', 'star', 'manaReduction', 'hitBps', 'hits', 'omnivampBps', 'attackSpeedBps', 'dashAd', 'dashAp', 'dashRange', 'speedBps', 'speedTicks', 'permanentAdBps', 'mainBps', 'chargeBps', 'pounceRange', 'damageBps', 'splashBps', 'rangeBonus', 'attackMana', 'ampBps', 'overkillBps', 'near'],
  s13P3:['enabled','stage'],
  acquisitionBundle:['enabled'], incomePolicy:['interestDisabled','interestCap','roundXp','roundGold'], acquisitionXp:['amount'], acquisitionGold:['amount','stage3Amount','stage4Amount'],glassCannon:['startingHealthBps','damageAmpBps','backRowOnly'],pumpingUp:['attackSpeedBpsPerRound'],
  investment:['healthPerInterest'],bulkyBuddies:['health','shieldMaxHpBps','durationTicks'],titanic:['adBps','radius'],mageArmor:['apBps'],killStreak:['mana'],
});
export function validateEffect(effect:Effect):void {
  if(!effect||typeof effect!=='object') fail('Invalid effect');
  if(effect.kind==='mechanic') {
    const fields=MECHANIC_FIELDS[effect.mechanic];
    if(!keysAre(effect,['kind','mechanic','values'])||!fields||!effect.values||!keysAre(effect.values,fields)
      ||fields.some(key=>key!=='backRowOnly'&&key!=='converted' && key!=='roundGold' && key!=='stage3Amount' && key!=='stage4Amount' && key!=='forcedPeriodTicks'&&key!=='warwick'&&!Object.hasOwn(effect.values,key))
      ||Object.values(effect.values).some(value=>!integer(value)||value>1000000)) fail('Invalid mechanic');
    for(const key of ['periodTicks','durationTicks','everyN']) if(Object.hasOwn(effect.values,key)&&!integer(effect.values[key],1)) fail('Invalid mechanic interval');
    if(effect.values.backRowOnly!==undefined&&effect.values.backRowOnly!==1) fail('Invalid row condition');
    return;
  }
  if(effect.kind==='statFlat') {
    if(!keysAre(effect,['kind','stat','amount'])||!STATS.includes(effect.stat)||!integer(effect.amount)||effect.amount>100000) fail('Invalid flat stat');return;
  }
  if(effect.kind==='statPercentBps') {
    if(!keysAre(effect,['kind','stat','bps'])||!STATS.includes(effect.stat)||(effect.stat as string)==='initialMana'||!integer(effect.bps)||effect.bps>40000) fail('Invalid percent stat');return;
  }
  if(effect.kind==='attackSpeedBps') {
    if(!keysAre(effect,['kind','bps'])||!integer(effect.bps)||effect.bps>20000) fail('Invalid attack speed');return;
  }
  if(effect.kind!=='trigger'||!keysAre(effect,['kind','hook','everyN','action'])||!['combatStart','onAttack','onCast','onHpLoss'].includes(effect.hook)
    ||!integer(effect.everyN,1)||(effect.hook==='combatStart'&&effect.everyN!==1)||!effect.action||!integer(effect.action.amount)) fail('Invalid trigger');
  if(effect.kind!=='trigger') return;
  const a=effect.action;
  if(a.kind==='gainMana') {if(!keysAre(a,['kind','amount'])) fail('Invalid mana action');}
  else if(a.kind==='grantShield') {if(!keysAre(a,['kind','amount','durationTicks'])||effect.hook==='onHpLoss'||!integer(a.durationTicks,1)||!integer(a.durationTicks+1200)) fail('Invalid shield action');}
  else if(a.kind==='dealDamage') {if(!keysAre(a,['kind','amount','damageType'])||!['onAttack','onCast'].includes(effect.hook)||!['physical','magic'].includes(a.damageType)) fail('Invalid damage action');}
  else fail('Unknown action');
}
function effects(list:readonly Effect[]):void {if(!Array.isArray(list)||!list.length) fail('Empty effects');for(const e of list) validateEffect(e);}
/** Static bound checks include all three augments and explicit finite dynamic mechanisms. */
export function validateStatBounds(content:ContentCatalogs):void {
  const allEffects = [...Object.values(content.items),...Object.values(content.augments),...Object.values(content.anomalies)].flatMap(entry=>entry.effects)
    .concat(Object.values(content.traits).flatMap(trait=>trait.tiers.flatMap(tier=>[...tier.effects,...(tier.memberEffects??[])])));
  const triggerTotal=allEffects.reduce((sum,e)=>sum+(e.kind==='trigger'?e.action.amount:0),0);
  if(!integer(triggerTotal)||!Number.isSafeInteger(triggerTotal*3*100*56)) fail('Trigger arithmetic bound exceeded');
  for(const unit of Object.values(content.units)) {
    for(const stat of Object.values(unit.baseStats)) if(!integer(stat)||!Number.isSafeInteger(stat*324*56*100000)) fail(`Combat arithmetic bound: ${unit.id}`);
    if(!integer(unit.attackIntervalTicks,1)||!Number.isSafeInteger(unit.attackIntervalTicks*10000)) fail(`Attack speed bound: ${unit.id}`);
    const ability=content.abilities[unit.abilityId];
    if(ability && !Number.isSafeInteger(Math.max(...ability.amountByStar)*10000*56)) fail(`Ability arithmetic bound: ${unit.id}`);
  }
  // Conservative bound over the explicit finite campaign; no ordinal formula.
  const maxima={ragebladeStacks:1200*3,archangelTicks:1200/100,interestHp:ROUND_CATALOG.length*5*8,pumpingBps:ROUND_CATALOG.length*50};
  if(Object.values(maxima).some(n=>!Number.isSafeInteger(n))) fail('Dynamic bounds overflow');
}
export function validateContent(overrides:Partial<ContentCatalogs>={}):void {
  const content:ContentCatalogs={units:M5_UNIT_DEFINITIONS,abilities:ABILITY_DEFINITIONS,traits:TRAIT_DEFINITIONS,items:ITEM_DEFINITIONS,
    augments:AUGMENT_DEFINITIONS,anomalies:ANOMALY_DEFINITIONS,shopCatalog:SHOP_CATALOG_BY_COST,schedule:ROUND_SCHEDULE,...overrides};
  finiteJson(content);
  for(const kind of ['units','abilities','traits','items','augments','anomalies'] as const) ids<{readonly id:string}>(content[kind],kind);
  // Augments: 30 historical + 6 P1 (blinding-speed, portable-forge, radiant-relics, going-long, hedge-fund,
  // investment-strategy-ii) + 14 P2 + 7 P3 + 3 D11; anomalies: 30 historical + 1 P1 (dual-wielding) + 3 P2 + 11 P4 + 7 P3 + 2 D11.
  if(!Object.keys(overrides).length) for(const [kind,count] of Object.entries({units:63,traits:35,items:Object.keys(ITEM_DEFINITIONS).length,augments:Object.keys(AUGMENT_BATCH5_H4).length+Object.keys(AUGMENT_BATCH5).length+Object.keys(AUGMENT_BATCH4_B4COMBAT).length+30+6+Object.keys(AUGMENT_BATCH4_B4REROLL).length+Object.keys(AUGMENT_BATCH2_ENABLED).length+Object.keys(AUGMENT_BATCH1).length+Object.keys(AUGMENT_BATCH3).length+Object.keys(AUGMENT_SHOP).length+Object.keys(AUGMENT_BATCH3_XP).length+Object.keys(AUGMENT_BATCH4).length+Object.keys(AUGMENT_BATCH4_B4XP).length+Object.keys(S13_P2_AUGMENTS).length+Object.keys(P3_AUGMENTS).length+9,anomalies:30+1+Object.keys(S13_P2_ANOMALIES).length+11+Object.keys(P3_ANOMALIES).length+4})) {
    if(Object.keys(content[kind as 'units'|'traits'|'items'|'augments'|'anomalies']).length!==count) fail(`Incorrect M5 ${kind} count`);
  }
  validateUnitDefinitions(content.units,content.shopCatalog);validateAbilityDefinitions(content.abilities);
  const catalogIds=Object.values(content.shopCatalog).flat();
  if(catalogIds.length!==Object.keys(content.units).length||new Set(catalogIds).size!==catalogIds.length) fail('Shop and active units differ');
  for(const ids of Object.values(content.shopCatalog)) if(ids.join('|')!==[...ids].sort().join('|')) fail('Unsorted shop catalog');
  for(const u of Object.values(content.units)) {
    if(!Object.hasOwn(content.abilities,u.abilityId)&&!Object.hasOwn(S13_ABILITY_DATA,u.abilityId)) fail(`Missing ability ${u.abilityId}`);
    for(const t of u.traits) if(!Object.hasOwn(content.traits,t)) fail(`Missing trait ${t}`);
  }
  for(const t of Object.values(content.traits)) {
    if(!t.name||!['team','members'].includes(t.target)||!t.tiers.length) fail('Invalid trait');
    // Emblems allow distinct non-native heroes to reach source tiers up to ten.
    let previous=0;
    for(const tier of t.tiers) {
      if(!integer(tier.threshold,previous+1)||tier.threshold>10) fail('Unreachable trait');
      previous=tier.threshold;effects(tier.effects);if(tier.memberEffects) effects(tier.memberEffects);
    }
  }
  const components=Object.values(content.items).filter(x=>x.kind==='component').map(x=>x.id).sort();
  validateComponentPool(content.items);
  const recipes=new Set<string>();
  for(const item of Object.values(content.items)) {
    const approved=ITEM_DEFINITIONS[item.id];
    if(!approved||item.apiName!==approved.apiName||item.kind!==approved.kind||item.unique!==approved.unique||item.slotCost!==approved.slotCost
      ||[...item.recipe ?? []].sort().join('|')!==[...approved.recipe ?? []].sort().join('|')) fail('Item differs from approved B1 mapping');
    if(!item.name) fail('Missing item name');if(item.effects.length) effects(item.effects); else if(!item.combatProgram) fail('Empty item effects'); if(item.combatProgram) validateItemProgram(item.combatProgram); if(item.isolatedEffects) effects(item.isolatedEffects);
    if(item.kind==='component') {if(item.recipe!==undefined) fail('Component recipe');}
    else if(item.kind==='completed') {
      if(!item.recipe&&(approved.evidenceStatus==='approved-provisional'||approved.emblemTrait))continue;
      if(!item.recipe||item.recipe.length!==2||item.recipe.some(id=>!components.includes(id))) fail('Invalid item recipe');
      const key=[...item.recipe!].sort().join('|');if(recipes.has(key)) fail('Duplicate recipe');recipes.add(key);
    } else if(item.kind==='radiant') {
      // G2-3 radiant: no recipe, one completed base, at most one radiant per base.
      if(item.recipe!==undefined||content.items[item.radiantOf??'']?.kind!=='completed'
        ||Object.values(content.items).filter(other=>other.kind==='radiant'&&other.radiantOf===item.radiantOf).length!==1) fail('Invalid radiant item');
    } else fail('Invalid item kind');
  }
  const ordinaryComponents=components.filter(id=>!content.items[id].craftingOnly);
  for(let a=0;a<ordinaryComponents.length;a++) for(let b=a;b<ordinaryComponents.length;b++) if(!recipes.has([ordinaryComponents[a],ordinaryComponents[b]].sort().join('|'))) fail('Missing completed recipe');
  if(recipes.size!==54) fail('v18 requires 36 ordinary, 16 emblem and 2 tactician recipes');
  if(Object.keys(content.augments).length<5||Object.keys(content.anomalies).length<2) fail('Choice pool exhausted');
  for(const c of [...Object.values(content.augments),...Object.values(content.anomalies)]) {if(!c.name||!c.description) fail('Missing choice text');effects(c.effects);}
  // This development schedule contains only the approved semantic nodes. PvE drops
  // are not installed until B8; any extra/altered node remains invalid content.
  if(content.schedule.fixed.length!==ROUND_SCHEDULE.fixed.length) fail('Incomplete acquisition schedule');
  for(const [index,entry] of content.schedule.fixed.entries()) {
    const expected=ROUND_SCHEDULE.fixed[index];
    if(!integer(entry.round,1)||entry.round>FINAL_ROUND||entry.round!==expected.round
      ||Object.keys(entry.event).length!==Object.keys(expected.event).length
      ||Object.entries(expected.event).some(([key,value])=>entry.event[key as keyof ScheduleEvent]!==value)) fail('Invalid semantic schedule');
  }
  if(content.schedule.recurring.fromRound!==ROUND_SCHEDULE.recurring.fromRound
    ||content.schedule.recurring.everyRounds!==ROUND_SCHEDULE.recurring.everyRounds
    ||content.schedule.recurring.randomComponents!==0
    ||content.schedule.fallbackDefinitionId!==ROUND_SCHEDULE.fallbackDefinitionId) fail('Invalid finite schedule boundary');
  for(let level=1;level<=MATCH_RULES.maxLevel;level++) {
    const row=SHOP_ODDS[level];if(!row||row.length!==5||row.some(x=>!integer(x))||row.reduce((a,b)=>a+b,0)!==100) fail('Invalid shop odds');
    if(level<MATCH_RULES.maxLevel&&!integer(XP_TO_NEXT_LEVEL[level],1)) fail('Invalid XP');
  }
  validateStatBounds(content);
}
/** No neutral or legacy unit can accidentally become purchasable. */
export function validateAcquisitionIsolation():void {
  const active=new Set(Object.values(SHOP_CATALOG_BY_COST).flat());
  for(const id of Object.keys({...NEUTRAL_UNIT_DEFINITIONS,...M8_NEUTRAL_UNIT_DEFINITIONS})) if(active.has(id)) fail('Neutral unit in shop');
  for(const id of active) if(!M5_UNIT_DEFINITIONS[id]||UNIT_DEFINITIONS[id]!==M5_UNIT_DEFINITIONS[id]) fail('Invalid active acquisition ID');
}
