import { isAngerIssuesConvertibleItem } from './content/augment-pool-batch5-r2';
import { getUnitForm } from './seat-mechanics/forms';
import { EMBLEM_ITEMS } from './content/emblems';
import { HERO_UNITS, magicRollKind } from './content/augment-pool-batch3';
import { TACTICIAN_SIZE_ITEMS } from './content/tactician-items';
import { AUGMENT_BATCH1 } from './content/augment-pool-batch1';
import { scrapConversions, g22Equipment } from './strategy-g2-2';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { AUGMENT_BATCH2_ENABLED } from './content/augment-pool-batch2';
import { isTraitSnapshotMember } from './traits/effective-membership';
import type { CombatStrategyInputs } from './combat-input';
import type { Unit } from './unit-types';
import type { Effect, OwnedAugment, TraitSnapshot } from './strategy-types';
import { UNIT_DEFINITIONS } from './units';
import { hexDistance } from './board';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { ROUND_CATALOG } from './content/round-catalog';
import { AUGMENT_BRONZE_THRESHOLDS } from './content/augment-policy';
import { p2AugmentEffects } from './s13-augments-p2-strategy';
const flat = (stat: 'maxHp'|'armor'|'magicResist'|'abilityPower', amount:number):Effect => ({kind:'statFlat',stat,amount});
const speed = (bps:number):Effect => ({kind:'attackSpeedBps',bps});
const mechanic = (name:string,values:Record<string,number>):Effect => ({kind:'mechanic',mechanic:name,values});
const serialOf=(id:string)=>{const m=/(\d+)$/.exec(id);return m?Number(m[1]):Number.MAX_SAFE_INTEGER;};
/** The established Pumping Up counter, shared by combat and the owner-only display. */
export function pumpingUpRounds(state:Pick<CombatStrategyInputs,'round'|'augmentProgress'>, augment:OwnedAugment):number {
  return augment.definitionId==='pumping-up-i'?state.augmentProgress.pumpingRounds
    :ROUND_CATALOG.filter(r=>r.ordinal>=augment.acquiredRound&&r.ordinal<state.round&&r.kind!=='supply').length
      +Math.max(0,state.round-Math.max(ROUND_CATALOG.at(-1)!.ordinal+1,augment.acquiredRound));
}
/** P-AG5 (P, 2026-10-24): one Vander and one Silco on board bind; with several copies
 * the earliest acquired (lowest unit serial, then ID) of each binds. */
export function bloodBrothersPair(allies:readonly Unit[]):readonly [string,string]|undefined {
  const first=(def:string)=>allies.filter(u=>u.definitionId===def&&u.location.kind==='board').sort((a,b)=>serialOf(a.id)-serialOf(b.id)||(a.id<b.id?-1:a.id>b.id?1:0))[0]?.id;
  const vander=first('vander'),silco=first('silco');
  return vander&&silco?[vander,silco]:undefined;
}
/** P-AG5: permanent growth belongs to the player, summed from authenticated battle facts since acquisition. */
export function bloodBrothersTotals(state:Pick<CombatStrategyInputs,'g23'>,augment:OwnedAugment):{casts:number;deaths:number} {
  let casts=0,deaths=0;
  for(const r of state.g23?.economyReceipts??[]){
    if(r.kind!=='battle'||r.facts.round<augment.acquiredRound)continue;
    casts+=r.facts.batch2?.find(x=>x.definitionId==='blood-brothers')?.count??0;
    deaths+=r.facts.batch2?.find(x=>x.definitionId==='blood-brothers-deaths')?.count??0;
  }
  return {casts,deaths};
}
/** Pure compilation: all conditions are sampled from the frozen start input. */
export function compileAugmentEffect(effect:Effect,state:CombatStrategyInputs,unit:Unit,augment:OwnedAugment,board:readonly Unit[],traits:readonly TraitSnapshot[]):Effect[] {
  if(effect.kind!=='mechanic') return [effect];
  const v=effect.values, allies=board.filter(u=>u.team===unit.team), zone=state.preparation.board.deploymentZones.player;
  const row=(u:Unit)=>u.location.kind==='board'?u.location.cell.row:-1;
  switch(effect.mechanic){
    case 'coronation': {
      const count=state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===unit.id&&TACTICIAN_SIZE_ITEMS.includes(i.definitionId)).length+state.temporaryEquipment.filter(i=>i.holderId===unit.id&&TACTICIAN_SIZE_ITEMS.includes(i.definitionId)).length;
      const v=AUGMENT_BATCH1.coronation.source.values;
      return count?[{kind:'attackSpeedBps',bps:count*Math.round(v.BonusAS!*10000)},{kind:'statPercentBps',stat:'attackDamage',bps:count*Math.round(v.BonusAD!*10000)},{kind:'statFlat',stat:'abilityPower',amount:count*v.BonusAP!}]:[];
    }
    case 'traitAugmentB2': {
      const spec=AUGMENT_BATCH2_ENABLED[augment.definitionId];
      if(!spec||!traits.some(t=>t.team===unit.team&&spec.traits.includes(t.traitId)&&isTraitSnapshotMember(t,unit)))return [];
      if(augment.definitionId==='betrayal'&&(!['maddie','ambessa'].includes(unit.definitionId)||!['maddie','ambessa'].every(def=>allies.some(u=>u.definitionId===def&&u.location.kind==='board'))))return [];
      if(augment.definitionId==='blood-brothers'){
        const pair=bloodBrothersPair(allies);
        if(!pair||!pair.includes(unit.id))return [];
        const totals=bloodBrothersTotals(state,augment);
        return [effect,unit.definitionId==='vander'?flat('maxHp',totals.casts*spec.source.values.MaxHealthGainPerCast!):flat('abilityPower',totals.deaths*spec.source.values.APGainPerDeath!)];
      }
      if(augment.definitionId==='why-not-both'){
        const form=getUnitForm(unit,state.preparation.board);
        if(!form||!allies.some(other=>other.id!==unit.id&&other.definitionId===unit.definitionId&&getUnitForm(other,state.preparation.board)!==null&&getUnitForm(other,state.preparation.board)!==form))return [];
        const amount=spec.source.values.BonusStats!;
        return [effect,flat('abilityPower',amount),flat('armor',amount),flat('magicResist',amount),{kind:'statPercentBps',stat:'attackDamage',bps:amount*100}];
      }
      if(augment.definitionId==='pit-fighter-prizefighter'){
        const battles=state.g23?.economyReceipts.filter(r=>r.kind==='battle'&&r.facts.round>=augment.acquiredRound)??[];
        const wins=battles.filter(r=>r.kind==='battle'&&r.facts.result==='win').length,losses=battles.filter(r=>r.kind==='battle'&&r.facts.result==='loss').length;
        return [effect,{kind:'statFlat',stat:'maxHp',amount:wins*spec.source.values.HealthPerWin!},{kind:'statPercentBps',stat:'attackDamage',bps:losses*Math.round(spec.source.values.ADPerLoss!*10000)}];
      }
      const equipment=g22Equipment(state),converted=augment.definitionId==='scrap-recycling'?scrapConversions(board,traits,equipment,ITEM_DEFINITIONS,{seed:state.g23?.seed??0,round:state.round}):null;
      const marker=converted?{...effect,values:{enabled:1,converted:[...converted.keys()].filter(id=>equipment.some(e=>e.id===id&&e.unitId===unit.id)).length}}:effect;
      return [marker,...(augment.definitionId==='enforce'?[{kind:'statPercentBps' as const,stat:'attackDamage' as const,bps:Math.round(spec.source.values.BonusAD!*10000)}]:[]),...(augment.definitionId==='sentinel-slam'?(['armor','magicResist'] as const).map(stat=>({kind:'statPercentBps' as const,stat,bps:Math.round(spec.source.values.PercGain!*10000)})):[])];
    }
    case 'flexible': {
      const ids=new Set(allies.filter(u=>u.location.kind==='board').map(u=>u.id));
      const held=state.items.filter(i=>i.location.kind==='unit'&&ids.has(i.location.unitId)&&Object.hasOwn(EMBLEM_ITEMS,i.definitionId)).length;
      return held?[flat('maxHp',held*v.healthPerEmblem)]:[];
    }
    case 'forming': {
      // Dummify/Golemify (P 2026-10-24): the summon's health (and the golem's attack) become the removed champions'
      // totals × HealthPercent/ADPercent, plus HPPerStage for every stage start (x-1) after acquisition.
      if(unit.definitionId!==(v.golem?'augment-golem':'forming-dummy'))return [];
      const total=state.augmentProgress.forming?.[v.golem?'golemify':'dummify'];if(!total)return [];
      let stages=0;for(let r=augment.acquiredRound+1;r<=state.round;r++)if(getMultiplayerRoundByOrdinal(r).subround===1)stages++;
      const base=UNIT_DEFINITIONS[unit.definitionId].baseStats;
      const health=Math.max(0,Math.floor(total.health*v.healthBps/10000)+stages*v.healthPerStage-base.health);
      const attack=Math.max(0,Math.floor(total.attack*v.attackBps/10000)-base.attack);
      return [...(health?[flat('maxHp',health)]:[]),...(v.golem&&attack?[{kind:'statFlat' as const,stat:'attackDamage' as const,amount:attack}]:[])];
    }
    case 'magicRoll': {
      // A Magic Roll of 4–8 (P 2026-10-24 precedence, the S14 table): every ally permanently gains {3b0ef232} health.
      const dice=state.augmentProgress.magicRoll;
      return dice&&magicRollKind(dice)==='health'?[flat('maxHp',v.health)]:[];
    }
    case 'heroCarry': {
      // P 2026-10-24: "strongest" = highest star, then most equipped items, then lowest id, among this side's board copies.
      const id=HERO_UNITS[v.hero],held=(x:Unit)=>state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===x.id).length;
      const strongest=allies.filter(x=>x.definitionId===id&&x.location.kind==='board').sort((a,b)=>b.starLevel-a.starLevel||held(b)-held(a)||(a.id<b.id?-1:a.id>b.id?1:0))[0];
      if(!strongest||strongest.id!==unit.id)return [];
      const star=Math.min(3,unit.starLevel) as 1|2|3,picked:Record<string,number>={...v,star};
      for(const key of Object.keys(v))if(/[123]$/.test(key))delete picked[key];
      for(const base of ['dashAd','dashAp','near'])if(v[base+'1']!==undefined)picked[base]=v[base+star];
      return [mechanic('heroCarryLive',picked),...(v.attackSpeedBps?[speed(v.attackSpeedBps)]:[]),...(v.attackMana?[mechanic('extraAttackMana',{amount:v.attackMana})]:[])];
    }
    case 'towerDefense': {
      if(unit.definitionId!=='tower-dummy')return [];
      const stage=getMultiplayerRoundByOrdinal(state.round).stage,tier=stage>=v.upgrade2Stage?2:stage>=v.upgrade1Stage?1:0;
      return [mechanic('towerDefenseLive',{apRatio:[v.apRatio1,v.apRatio2,v.apRatio3][tier],extraBps:tier>=2?v.upgrade2Bps:0}),...(tier>=1?[speed(v.upgrade1AsBps)]:[])];
    }
    case 'superstars': return [mechanic('damageAmp',{bps:v.baseBps+allies.filter(u=>u.location.kind==='board'&&u.starLevel===3).length*v.per3StarBps})];
    case 'acquisitionXp': return [];
    case 's13P2Augment': return p2AugmentEffects(augment.definitionId,unit,board,state);
    case 's13P3': return [mechanic('s13P3',{...v,stage:getMultiplayerRoundByOrdinal(state.round).stage})];
    case 'pumpingUp': {
      // I retains its established receipt-validated counter; II/III count completed
      // combat nodes from acquisition, including online overtime, never supply nodes.
      const count=pumpingUpRounds(state,augment);
      return [speed(count*v.attackSpeedBpsPerRound)];
    }
    case 'mentorship': return allies.some(other=>other.id!==unit.id&&UNIT_DEFINITIONS[other.definitionId].cost>UNIT_DEFINITIONS[unit.definitionId].cost&&other.location.kind==='board'&&unit.location.kind==='board'&&hexDistance(other.location.cell,unit.location.cell)===1)?[flat('maxHp',v.health),speed(v.attackSpeedBps)]:[];
    case 'itemCollector': {
      const ids=new Set(allies.map(u=>u.id));
      const converted=(id:string)=>state.augments.some(a=>a.definitionId==='anger-issues')&&isAngerIssuesConvertibleItem(id)?'rageblade':id;
      const count=new Set([...state.items.filter(i=>i.location.kind==='unit'&&ids.has(i.location.unitId)).map(i=>i.definitionId),...state.temporaryEquipment.filter(i=>ids.has(i.holderId)).map(i=>i.definitionId)].map(converted)).size;
      return [flat('maxHp',v.baseHealth+count*v.healthPerItem),{kind:'statPercentBps',stat:'attackDamage',bps:count*v.adBpsPerItem},mechanic('fractionalFlat',{armorCenti:0,magicResistCenti:0,abilityPowerCenti:count*v.apCentiPerItem})];
    }
    case 'backup': return allies.filter(u=>row(u)>=zone.lastRow-1).length>=v.minimum?[speed(v.attackSpeedBps)]:[];
    case 'lineup': {const amount=allies.filter(u=>row(u)<=zone.firstRow+1).length*v.resistCentiPerUnit;return [mechanic('fractionalFlat',{armorCenti:amount,magicResistCenti:amount,abilityPowerCenti:0})];}
    case 'findCenter': return unit.location.kind==='board'&&unit.location.cell.col===Math.floor(state.preparation.board.columns/2)&&unit.location.cell.row===zone.firstRow+Math.floor((zone.lastRow-zone.firstRow)/2)?[{kind:'statPercentBps',stat:'maxHp',bps:v.healthBps},mechanic('damageAmp',{bps:v.damageAmpBps})]:[];
    case 'littleBuddies': {const cost=UNIT_DEFINITIONS[unit.definitionId].cost,count=allies.filter(u=>UNIT_DEFINITIONS[u.definitionId].cost<=2).length;return cost===4||cost===5?[flat('maxHp',count*v.health),speed(count*v.attackSpeedBps)]:[];}
    case 'bronzeForLife': {const count=traits.filter(t=>t.team===unit.team&&(AUGMENT_BRONZE_THRESHOLDS[t.traitId]??[]).includes(t.tier)).length;return [mechanic('damageAmp',{bps:count*v.damageAmpBps}),...(v.durabilityBps?[mechanic('watcher',{reductionBps:count*v.durabilityBps,healthyReductionBps:count*v.durabilityBps,thresholdBps:0})]:[])];}
    case 'builtDifferent': {if(traits.some(t=>t.tier>0&&isTraitSnapshotMember(t,unit)))return [];const stage=Math.max(2,Math.min(5,getMultiplayerRoundByOrdinal(state.round).stage));return [flat('maxHp',v[`health${stage}`]),speed(v[`speed${stage}`])];}
    default:return [effect];
  }
}
