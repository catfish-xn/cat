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
