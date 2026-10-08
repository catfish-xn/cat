import { validateItemProgram } from './m8/item-program';
import { validateComponentPool } from './component-pool';
import { ABILITY_DEFINITIONS, validateAbilityDefinitions } from './combat-abilities';
import { UNIT_DEFINITIONS, M5_UNIT_DEFINITIONS, NEUTRAL_UNIT_DEFINITIONS, validateUnitDefinitions } from './units';
import { SHOP_CATALOG_BY_COST, SHOP_ODDS, XP_TO_NEXT_LEVEL } from './match-rules';
import { TRAIT_DEFINITIONS } from './content/traits';
import { ITEM_DEFINITIONS } from './content/items';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { ANOMALY_DEFINITIONS } from './content/anomalies';
import { S13_ABILITY_DATA } from './content/abilities';
import { ROUND_SCHEDULE } from './round-schedule';
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
  for(const [id,entry] of Object.entries(catalog)) if(!entry||entry.id!==id||!/^[a-z][a-z0-9-]*$/.test(id)) fail(`Invalid ${kind} ID: ${id}`);
}
/** Each finite mechanic has an explicit schema. Unknown names/fields are rejected before play. */
export const MECHANIC_FIELDS:Readonly<Record<string,readonly string[]>>=Object.freeze({
  artillery:['everyN','adBps','radius'],sniper:['damageBpsPerHex'],watcher:['reductionBps','healthyReductionBps','thresholdBps'],
  rageblade:['attackSpeedBps'],damageAmp:['bps'],extraAttackMana:['amount','backRowOnly'],archangel:['periodTicks','abilityPower'],
  dragonClaw:['periodTicks','healMaxHpBps'],gargoyle:['resistPerEnemy'],gunblade:['selfHealBps','allyHealBps'],
  acquisitionGold:['amount'],glassCannon:['startingHealthBps','damageAmpBps','backRowOnly'],pumpingUp:['attackSpeedBpsPerRound'],
  investment:['healthPerInterest'],bulkyBuddies:['health','shieldMaxHpBps','durationTicks'],titanic:['adBps','radius'],mageArmor:['apBps'],killStreak:['mana'],
});
export function validateEffect(effect:Effect):void {
  if(!effect||typeof effect!=='object') fail('Invalid effect');
  if(effect.kind==='mechanic') {
    const fields=MECHANIC_FIELDS[effect.mechanic];
    if(!keysAre(effect,['kind','mechanic','values'])||!fields||!effect.values||!keysAre(effect.values,fields)
      ||fields.some(key=>key!=='backRowOnly'&&!Object.hasOwn(effect.values,key))
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
  // 1200 ticks, at most one AA per tick, three identical items, 35 rounds.
  const maxima={ragebladeStacks:1200*3,archangelTicks:1200/100,interestHp:35*5*8,pumpingBps:35*50};
  if(Object.values(maxima).some(n=>!Number.isSafeInteger(n))) fail('Dynamic bounds overflow');
}
export function validateContent(overrides:Partial<ContentCatalogs>={}):void {
  const content:ContentCatalogs={units:M5_UNIT_DEFINITIONS,abilities:ABILITY_DEFINITIONS,traits:TRAIT_DEFINITIONS,items:ITEM_DEFINITIONS,
    augments:AUGMENT_DEFINITIONS,anomalies:ANOMALY_DEFINITIONS,shopCatalog:SHOP_CATALOG_BY_COST,schedule:ROUND_SCHEDULE,...overrides};
  finiteJson(content);
  for(const kind of ['units','abilities','traits','items','augments','anomalies'] as const) ids<{readonly id:string}>(content[kind],kind);
  if(!Object.keys(overrides).length) for(const [kind,count] of Object.entries({units:19,traits:5,items:44,augments:6,anomalies:3})) {
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
    const members=Object.values(content.units).filter(u=>u.traits.includes(t.id)).length;
    let previous=0;
    for(const tier of t.tiers) {
      if(!integer(tier.threshold,previous+1)||tier.threshold>members||tier.threshold>9) fail('Unreachable trait');
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
    if(!item.name) fail('Missing item name');if(item.effects.length) effects(item.effects); else if(!item.combatProgram) fail('Empty item effects'); if(item.combatProgram) validateItemProgram(item.combatProgram);
    if(item.kind==='component') {if(item.recipe!==undefined) fail('Component recipe');}
    else if(item.kind==='completed') {
      if(!item.recipe||item.recipe.length!==2||item.recipe.some(id=>!components.includes(id))) fail('Invalid item recipe');
      const key=[...item.recipe!].sort().join('|');if(recipes.has(key)) fail('Duplicate recipe');recipes.add(key);
    } else fail('Invalid item kind');
  }
  for(let a=0;a<components.length;a++) for(let b=a;b<components.length;b++) if(!recipes.has([components[a],components[b]].sort().join('|'))) fail('Missing completed recipe');
  if(recipes.size!==36) fail('M8 requires 36 unique recipes');
  if(Object.keys(content.augments).length<5||Object.keys(content.anomalies).length<2) fail('Choice pool exhausted');
  for(const c of [...Object.values(content.augments),...Object.values(content.anomalies)]) {if(!c.name||!c.description) fail('Missing choice text');effects(c.effects);}
  const seen=new Set<string>();let priorRound=0,priorPriority=-1,priorId='';let randomComponents=0,componentChoices=0;
  for(const {round,event:e} of content.schedule.fixed) {
    if(!integer(round,1)||round>35||round<priorRound||!e.id||seen.has(e.id)||!integer(e.priority)
      ||(round===priorRound&&(e.priority<priorPriority||(e.priority===priorPriority&&e.id<=priorId)))) fail('Schedule order or ID');
    seen.add(e.id);priorRound=round;priorPriority=e.priority;priorId=e.id;
    if(!['before','after'].includes(e.timing??'before')) fail('Invalid schedule timing');
    if(e.kind==='reward') {
      if(e.timing!=='after'||![7,14,21,28].includes(round)||e.components.some(id=>!components.includes(id))||!integer(e.randomComponents)||!integer(e.gold)||e.recruitIfEmpty) fail('Invalid PvE reward');
      randomComponents+=e.randomComponents;
    } else if(e.kind==='component') componentChoices++;
    else if(e.kind==='augment') {if(e.timing!=='before'||![1,9,16].includes(round)) fail('Invalid augment schedule');}
    else if(e.kind==='anomaly') {if(e.timing!=='before'||round!==20) fail('Invalid anomaly schedule');}
    else fail('Unknown schedule event');
  }
  const aug=content.schedule.fixed.filter(x=>x.event.kind==='augment').map(x=>x.round).join(',');
  const anomaly=content.schedule.fixed.filter(x=>x.event.kind==='anomaly').map(x=>x.round).join(',');
  if(aug!=='1,9,16'||anomaly!=='20'||randomComponents!==4||componentChoices!==11||!content.units[content.schedule.fallbackDefinitionId]) fail('Incomplete acquisition schedule');
  for(let level=1;level<=9;level++) {
    const row=SHOP_ODDS[level];if(!row||row.length!==5||row.some(x=>!integer(x))||row.reduce((a,b)=>a+b,0)!==100) fail('Invalid shop odds');
    if(level<9&&!integer(XP_TO_NEXT_LEVEL[level],1)) fail('Invalid XP');
  }
  validateStatBounds(content);
}
/** No neutral or legacy unit can accidentally become purchasable. */
export function validateAcquisitionIsolation():void {
  const active=new Set(Object.values(SHOP_CATALOG_BY_COST).flat());
  for(const id of Object.keys(NEUTRAL_UNIT_DEFINITIONS)) if(active.has(id)) fail('Neutral unit in shop');
  for(const id of active) if(!M5_UNIT_DEFINITIONS[id]||UNIT_DEFINITIONS[id]!==M5_UNIT_DEFINITIONS[id]) fail('Invalid active acquisition ID');
}
