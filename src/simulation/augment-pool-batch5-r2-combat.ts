import { shareP2Energy } from './s13-augments-p2-combat';
import { ANGER_RAGEBLADE, isAngerIssuesConvertibleItem } from './content/augment-pool-batch5-r2';
import { modifier } from './content/item-programs';
import type { CombatUnit } from './combat-types';
import type { ItemProgram } from './m8/item-program';
import { S13_ANOMALIES } from './anomalies/registry';
import { seedAnomalyStream } from './anomalies/summons';
import { ad } from './combat-s13-state';
import type { AbilityContext } from './combat-s13-abilities';

export function hasAngerIssues(unit:Pick<CombatUnit,'mechanics'>):boolean {
  return !!unit.mechanics?.some(m=>m.source.sourceKind==='augment'&&m.source.definitionId==='anger-issues');
}
export function angerCombatItem(unit:Pick<CombatUnit,'mechanics'>,definitionId:string):string {
  return hasAngerIssues(unit)&&isAngerIssuesConvertibleItem(definitionId)?'rageblade':definitionId;
}
/** Chest grants have no preparation slots. Preserve their random draw/ordinal and bind the converted program. */
export function angerGrantedProgram(unit:Pick<CombatUnit,'mechanics'>,id:string,program:ItemProgram):ItemProgram {
  return id==='rageblade'&&hasAngerIssues(unit)?{...program,
    modifiers:[...program.modifiers??[],modifier('armor',45),modifier('magicResist',45)],
    triggers:[...program.triggers??[],...ANGER_RAGEBLADE.combatProgram!.triggers!]}:program;
}

/** First effective tick of a battle installation: run only this item's start hooks, with fresh holder state. */
export function startR2PortableCopies(ctx:AbilityContext):void {
  const pending=ctx.units.filter(u=>u.pendingEquipmentSources?.length&&u.mechanics?.some(m=>m.source.sourceKind==='anomaly'&&m.source.parentItemInstanceId&&u.pendingEquipmentSources!.includes(m.source.parentItemInstanceId)));
  if(!pending.length)return;
  ctx.anomalyOpening=ctx.units.map(u=>({id:u.id,health:u.maxHp,attackDamage:ad(u)}));
  for(const unit of pending)for(const module of S13_ANOMALIES){
    const source=unit.mechanics?.find(m=>m.mechanic==='s13Anomaly'&&m.source.definitionId===module.definition.id
      &&m.source.parentItemInstanceId&&unit.pendingEquipmentSources!.includes(m.source.parentItemInstanceId))?.source;
    if(!source||!unit.alive||unit.hp<=0)continue;
    module.start?.(ctx,unit,source);
    if(unit.anomalyState?.absentUntilTick!==undefined)unit.anomalyState.absentUntilTick+=ctx.tick;
  }
  if(pending.some(u=>u.mechanics?.some(m=>m.mechanic==='s13P2Anomaly'&&m.source.definitionId==='share-your-energy')))
    shareP2Energy(ctx,new Set(pending.flatMap(u=>u.pendingEquipmentSources??[])));
  for(const unit of ctx.units)if(unit.anomalySummon&&unit.anomalySummon.bornAtTick===ctx.tick&&unit.anomalySummon.kind!=='crab')
    (unit.anomalyState??={}).attackStream=seedAnomalyStream(ctx.anomalySeed??0,unit.id);
}
