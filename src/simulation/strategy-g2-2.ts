import { G23_TRAIT_SOURCE } from './content/g2-3-trait-runtime';
import { g23ConquerorBonusBps } from './g2-3-progress';
import type { CombatStrategyInputs } from './combat-input';
import type { Unit } from './unit-types';
import type { Effect, ItemDefinition, TraitSnapshot, TraitTier } from './strategy-types';
import { readRoundEnemyProjection, type EnemyItem } from './round-enemies';
import { G22_CONVENTIONS } from './content/g2-2-traits';
import { priorPvpWins } from './g2-2-pvp-history';
import { SCRAP_CHAMPION_ROLES, SCRAP_LUCKY_POLICY, SCRAP_ROLE_ITEMS } from './content/scrap-lucky';
import { G23_RADIANT_MAPPING } from './content/g2-3-special-item-runtime';
export interface G22Equipment { id:string; unitId:string; definitionId:string }
export function g22Equipment(state:CombatStrategyInputs,enemyItems?:readonly EnemyItem[]):G22Equipment[] {
  return [...state.items.flatMap(i=>i.location.kind==='unit'?[{id:i.id,unitId:i.location.unitId,definitionId:i.definitionId}]:[]),
    ...state.temporaryEquipment.map(i=>({id:i.temporaryId,unitId:i.holderId,definitionId:i.definitionId})),
    ...(enemyItems??(state.preparation.units.some(u=>u.team==='enemy')?readRoundEnemyProjection(state.round).items:[])).map(i=>({id:`enemy:${state.round}:${i.unitId}:${i.slot}`,unitId:i.unitId,definitionId:i.definitionId}))];
}
const roleItems=new Map<Readonly<Record<string,ItemDefinition>>,ReadonlyMap<string,readonly string[]>>();
/** Recommended items by unit definition, resolved from client apiNames to this catalog's ids (client order). */
function recommendedItems(catalog:Readonly<Record<string,ItemDefinition>>):ReadonlyMap<string,readonly string[]> {
  let cached=roleItems.get(catalog);
  if(!cached){
    const byApi=new Map(Object.values(catalog).flatMap(d=>d.apiName?[[d.apiName,d.id] as const]:[]));
    cached=new Map(Object.entries(SCRAP_CHAMPION_ROLES).map(([unit,role])=>[unit,(SCRAP_ROLE_ITEMS[role]??[]).flatMap(api=>byApi.has(api)?[byApi.get(api)!]:[])]));
    roleItems.set(catalog,cached);
  }
  return cached;
}
/** P scrap-lucky-v1 fallback word: FNV-1a over the item instance id, salted by seed and round, then murmur3 fmix32. */
export function scrapLuckyWord(seed:number,round:number,itemId:string):number {
  let x=(0x811c9dc5^seed^Math.imul(round,0x9e3779b1))>>>0;
  for(let i=0;i<itemId.length;i++)x=Math.imul(x^itemId.charCodeAt(i),0x01000193)>>>0;
  x=Math.imul(x^(x>>>16),0x85ebca6b)>>>0;x=Math.imul(x^(x>>>13),0xc2b2ae35)>>>0;
  return (x^(x>>>16))>>>0;
}
export interface ScrapLuckContext { readonly seed:number; readonly round:number }
/** Frozen combat-only conversion; no item grants, receipts, slots or RNG state are mutated.
 * Tiers 2/4: lexicographically first legal recipe. Tier 6+ (P scrap-lucky-v1): the holder's recommended items first,
 * else a derived uniform draw; spatula/frying pan stay. Tier 9: produced items become their radiant version. */
export function scrapConversions(units:readonly Unit[],traits:readonly TraitSnapshot[],equipment:readonly G22Equipment[],catalog:Readonly<Record<string,ItemDefinition>>,luck:ScrapLuckContext={seed:0,round:0}):Map<string,string> {
  const result=new Map<string,string>(),base=new Map<string,string>();
  for(const trait of traits.filter(t=>t.traitId==='scrap'&&t.tier>0)){
    let left=trait.tier>=6?20:trait.tier>=4?3:1;
    const lucky=trait.tier>=SCRAP_LUCKY_POLICY.luckyFromTier,radiant=trait.tier>=SCRAP_LUCKY_POLICY.radiantFromTier;
    for(const item of [...equipment].sort((a,b)=>a.id<b.id?-1:1)){
      const owner=units.find(u=>u.id===item.unitId);
      if(!left||!owner||owner.team!==trait.team||!trait.targetUnitIds.includes(owner.id)||catalog[item.definitionId]?.kind!=='component')continue;
      if(lucky&&(SCRAP_LUCKY_POLICY.excludedComponents as readonly string[]).includes(item.definitionId))continue;
      const held=equipment.filter(i=>i.unitId===owner.id).map(i=>base.get(i.id)??i.definitionId);
      const candidates=Object.values(catalog).filter(d=>d.kind==='completed'&&!d.emblemTrait&&d.recipe?.includes(item.definitionId)&&d.slotCost!==3&&(!d.unique||!held.includes(d.id))).sort((a,b)=>a.id<b.id?-1:1);
      if(!candidates.length)continue;
      let chosen=candidates[0].id;
      if(lucky){
        const recommended=(recommendedItems(catalog).get(owner.definitionId)??[]).find(id=>candidates.some(c=>c.id===id));
        chosen=recommended??candidates[Math.floor(scrapLuckyWord(luck.seed,luck.round,item.id)*candidates.length/4294967296)].id;
      }
      const shown=radiant&&Object.hasOwn(G23_RADIANT_MAPPING,chosen)?(G23_RADIANT_MAPPING as Readonly<Record<string,string>>)[chosen]:chosen;
      base.set(item.id,chosen);result.set(item.id,Object.hasOwn(catalog,shown)?shown:chosen);left--;
    }
  }
  return result;
}
export function g22TraitEffects(state:CombatStrategyInputs,unit:Unit,trait:TraitSnapshot,tier:TraitTier,
  board:readonly Unit[],equipment:readonly G22Equipment[],_converted:ReadonlyMap<string,string>,catalog:Readonly<Record<string,ItemDefinition>>):Effect[] {
  const result:Effect[]=[];
  if(trait.traitId==='chem-baron'&&unit.team==='player')result.push({kind:'statFlat',stat:'maxHp',amount:(state.g23?.chem.skips??0)*(G23_TRAIT_SOURCE['chem-baron'].tiers.find(t=>t.threshold===trait.tier)?.values.HealthPerSkip??0)});
  const member=trait.memberUnitIds?trait.memberUnitIds.includes(unit.id):trait.memberDefinitionIds.includes(unit.definitionId);
  for(const e of [...tier.effects,...(member?tier.memberEffects??[]:[])]) {
    if(e.kind!=='mechanic'){
      if(trait.traitId==='conqueror'&&unit.team==='player'){
        const opened=state.g23?.conquest.chestsOpened??0;
        if(e.kind==='statPercentBps'&&e.stat==='attackDamage'){result.push({...e,bps:g23ConquerorBonusBps(e.bps,opened)});continue;}
        if(e.kind==='statFlat'&&e.stat==='abilityPower'){result.push({kind:'mechanic',mechanic:'fractionalFlat',values:{abilityPowerCenti:g23ConquerorBonusBps(e.amount*100,opened),armorCenti:0,magicResistCenti:0}});continue;}
      }
      result.push(e);continue;
    }
    if(e.mechanic==='academy'){
      const sponsored=state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===unit.id&&(state.g23?.sponsored ?? G22_CONVENTIONS.academy.sponsored as readonly string[]).includes(i.definitionId)||i.location.kind==='unit'&&i.location.unitId===unit.id&&catalog[i.definitionId]?.emblemTrait==='academy').length;
      if(sponsored){const bps=sponsored*e.values.sponsoredBps*(member?2:1)+(member?e.values.memberBaseBps:0);result.push({kind:'statPercentBps',stat:'maxHp',bps},{kind:'mechanic',mechanic:'damageAmp',values:{bps}});}continue;
    }
    if(e.mechanic==='emissary'){
      if(trait.memberDefinitionIds.includes('nami'))result.push({kind:'mechanic',mechanic:'extraAttackMana',values:{amount:e.values.mana}});
      if(trait.memberDefinitionIds.includes('tristana'))result.push({kind:'attackSpeedBps',bps:e.values.starSpeedBps*(state.d14Combat?.unitId===unit.id&&state.d14Combat.phase==='promoted'?4:unit.starLevel)});
      if(trait.memberDefinitionIds.includes('ambessa')){
        const wins=unit.team!=='player'?0:state.priorPvpWins??priorPvpWins(state.roundResults??[],state.round),amount=wins*e.values.armorPerWin;
        result.push({kind:'statFlat',stat:'armor',amount},{kind:'statFlat',stat:'magicResist',amount});
      }
      // Freeze actual maximum health after every opening stat contribution, then broadcast once.
      if(unit.definitionId==='garen'&&trait.memberDefinitionIds.includes('garen')&&member)
        result.push({kind:'mechanic',mechanic:'v19Garen',values:{healthBps:e.values.healthBps}});
      continue;
    }
    if(e.mechanic==='scrap'){
      const holders=new Set(board.filter(u=>u.team===unit.team).map(u=>u.id));
      const componentCount=equipment.filter(i=>holders.has(i.unitId)).reduce((n,i)=>n+(catalog[i.definitionId]?.kind==='component'?1:catalog[i.definitionId]?2:0),0);
      result.push({...e,values:{...e.values,componentCount}});continue;
    }
    result.push(e);
  }
  return result;
}
