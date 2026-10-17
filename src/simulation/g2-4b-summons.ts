import type { GameState } from './game';
import type { Unit } from './unit-types';
import type { HexCell } from './board';
import type { StrategySnapshot, StrategyUnitSnapshot } from './strategy-types';
import { nearestItemCell } from './g2-4b-item-kernel';
import { g23FormStats } from './g2-3-forms';
import { resolveAbility } from './combat-abilities';
import { effectKey, resolveEffects } from './effects';

/** Combat-only provenance, derived by the strategy compiler. Never an asset. */
export interface ItemSummonOrigin {
  readonly kind:'mirror';
  readonly ownerId:string;
  readonly itemInstanceId:string;
  readonly unit:Unit;
  readonly formCell:HexCell;
  readonly healthBps:number;
}
export function scaleItemSummonHp(unit:{readonly itemSummon?:ItemSummonOrigin}, health:number):number {
  return unit.itemSummon ? Math.max(1,Number(BigInt(health)*BigInt(unit.itemSummon.healthBps)/10000n)) : health;
}

/** Pending inheritance convention: naked same-star/form champion + the owner's
 * active trait declarations; no equipment, anomaly, augment or persistent growth.
 * Counts/tier thresholds stay frozen from the original army. */
export function appendMirrorSummons(preparation:GameState,strategy:StrategySnapshot):StrategySnapshot {
  const holders=strategy.units.filter(u=>u.mechanics?.some(m=>m.mechanic==='g24Mirror'));
  if(!holders.length)return strategy;
  const occupied=new Set(preparation.units.flatMap(u=>u.location.kind==='board'?[`${u.location.cell.col}:${u.location.cell.row}`]:[]));
  const clones:StrategyUnitSnapshot[]=[];
  for(const holder of holders){
    const owner=preparation.units.find(u=>u.id===holder.unitId)!;
    if(owner.location.kind!=='board')throw new RangeError('Mirror owner not deployed');
    const item=holder.mechanics!.find(m=>m.mechanic==='g24Mirror')!;
    const zone=preparation.board.deploymentZones[owner.team];
    const cells=Array.from({length:zone.lastRow-zone.firstRow+1},(_,r)=>Array.from({length:preparation.board.columns},(_,col)=>({col,row:zone.firstRow+r}))).flat();
    const cell=nearestItemCell(owner.location.cell,cells.filter(c=>!occupied.has(`${c.col}:${c.row}`)));
    if(!cell)continue; // explicit no-space convention; no overlap or partial asset
    occupied.add(`${cell.col}:${cell.row}`);
    const id=JSON.stringify(['g24-summon','mirror',owner.id,item.source.instanceId]);
    if(preparation.units.some(u=>u.id===id)||clones.some(u=>u.unitId===id))throw new RangeError('Duplicate mirror identity');
    const sources=holder.sources.filter(s=>s.source.sourceKind==='trait').map(s=>{
      const source={...s.source,ownerId:id};return {...s,source,key:effectKey(source)};
    });
    const base=g23FormStats(owner.definitionId,owner.starLevel,owner.team,owner.location.cell.row);
    const resolved=resolveEffects(base,resolveAbility(base.abilityId,owner.starLevel),sources);
    const family=resolved.mechanics?.find(m=>m.mechanic==='family');
    const maxMana=Math.ceil(Math.floor(resolved.stats.maxMana*(10000-(family?.values.manaReductionBps??0))/10000)*(10000+item.values.manaIncreaseBps)/10000);
    const itemSummon:ItemSummonOrigin={kind:'mirror',ownerId:owner.id,itemInstanceId:item.source.instanceId,
      unit:{...owner,id,location:{kind:'board',cell}},formCell:{...owner.location.cell},healthBps:item.values.healthBps};
    const itemPrograms=holder.itemPrograms?.filter(p=>p.source.sourceKind==='trait').map(p=>({...p,source:{...p.source,ownerId:id}}));
    clones.push({unitId:id,...resolved,itemSummon,
      stats:{...resolved.stats,health:scaleItemSummonHp({itemSummon},resolved.stats.health),maxMana,initialMana:Math.min(maxMana,resolved.stats.initialMana)},
      ...(itemPrograms?.length?{itemPrograms}:{}),
      mechanics:[...resolved.mechanics??[],...holder.mechanics!.filter(m=>m.source.sourceKind==='ability').map(m=>({...m,source:{...m.source,ownerId:id}}))]});
  }
  return {units:[...strategy.units,...clones],traits:strategy.traits.map(t=>({...t,
    targetUnitIds:[...t.targetUnitIds,...clones.filter(c=>t.targetUnitIds.includes(c.itemSummon!.ownerId)).map(c=>c.unitId)]}))};
}

export function projectItemSummons(preparation:GameState,strategy?:StrategySnapshot):GameState {
  const summons=strategy?.units.flatMap(u=>u.itemSummon?[u.itemSummon.unit]:[])??[];
  const added=summons.filter(s=>!preparation.units.some(u=>u.id===s.id));
  return added.length?{...preparation,units:[...preparation.units,...added]}:preparation;
}
