import { getUnitForm } from './seat-mechanics/forms';
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
      if(augment.definitionId==='betrayal'&&!['maddie','ambessa'].includes(unit.definitionId))return [];
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
      const equipment=g22Equipment(state),converted=augment.definitionId==='scrap-recycling'?scrapConversions(board,traits,equipment,ITEM_DEFINITIONS):null;
      const marker=converted?{...effect,values:{enabled:1,converted:[...converted.keys()].filter(id=>equipment.some(e=>e.id===id&&e.unitId===unit.id)).length}}:effect;
      return [marker,...(augment.definitionId==='enforce'?[{kind:'statPercentBps' as const,stat:'attackDamage' as const,bps:Math.round(spec.source.values.BonusAD!*10000)}]:[]),...(augment.definitionId==='sentinel-slam'?(['armor','magicResist'] as const).map(stat=>({kind:'statPercentBps' as const,stat,bps:Math.round(spec.source.values.PercGain!*10000)})):[])];
    }
    case 'acquisitionXp': return [];
    case 's13P2Augment': return p2AugmentEffects(augment.definitionId,unit,board,state);
    case 's13P3': return [mechanic('s13P3',{...v,stage:getMultiplayerRoundByOrdinal(state.round).stage})];
    case 'pumpingUp': {
      // I retains its established receipt-validated counter; II/III count completed
      // combat nodes from acquisition, including online overtime, never supply nodes.
      const count=augment.definitionId==='pumping-up-i'?state.augmentProgress.pumpingRounds
        :ROUND_CATALOG.filter(r=>r.ordinal>=augment.acquiredRound&&r.ordinal<state.round&&r.kind!=='supply').length
          +Math.max(0,state.round-Math.max(ROUND_CATALOG.at(-1)!.ordinal+1,augment.acquiredRound));
      return [speed(count*v.attackSpeedBpsPerRound)];
    }
    case 'mentorship': return allies.some(other=>other.id!==unit.id&&UNIT_DEFINITIONS[other.definitionId].cost>UNIT_DEFINITIONS[unit.definitionId].cost&&other.location.kind==='board'&&unit.location.kind==='board'&&hexDistance(other.location.cell,unit.location.cell)===1)?[flat('maxHp',v.health),speed(v.attackSpeedBps)]:[];
    case 'itemCollector': {
      const ids=new Set(allies.map(u=>u.id));
      const count=new Set([...state.items.filter(i=>i.location.kind==='unit'&&ids.has(i.location.unitId)).map(i=>i.definitionId),...state.temporaryEquipment.filter(i=>ids.has(i.holderId)).map(i=>i.definitionId)]).size;
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
