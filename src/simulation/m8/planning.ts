import type { AbilityOperation, AbilityPlan, DamageType, Effect } from './contracts';
import type { TargetEnvironment, TargetUnit } from './targeting';
import { chooseRandomCenter, selectAbilityTargets } from './targeting';
import type { ResolutionFacts } from './triggers';
/** A deterministic binding separates RNG selection from interpreting finite operations. */
export interface PlanBindings { readonly centers: Readonly<Record<number,string|null>> }
export interface PlannedEffects { readonly targetId:string; readonly effects:readonly Effect[]; readonly operationIndex:number }
export function samplePlanBindings(plan:AbilityPlan,env:TargetEnvironment,draw:()=>number):PlanBindings{
  const centers:Record<number,string|null>={};
  plan.operations.forEach((op,index)=>{
    if(op.kind==='center-and-area'&&op.center.kind==='random-enemy-center')centers[index]=chooseRandomCenter(env,draw);
    else if((op.kind==='effects'||op.kind==='primary-and-area')&&op.targeting.kind==='random-enemy-center')centers[index]=chooseRandomCenter(env,draw);
  });
  return{centers};
}
export function planEffectApplications(plan:AbilityPlan,env:TargetEnvironment,bindings:PlanBindings):{effects:PlannedEffects[];operations:readonly Exclude<AbilityOperation,{kind:'effects'|'primary-and-area'|'center-and-area'}>[]} {
  const effects:PlannedEffects[]=[],operations:Exclude<AbilityOperation,{kind:'effects'|'primary-and-area'|'center-and-area'}>[]=[];
  plan.operations.forEach((op,index)=>{
    const current={...env,randomCenterId:bindings.centers[index]};
    if(op.kind==='effects'||op.kind==='primary-and-area'){
      const selected=selectAbilityTargets(op.targeting,current);
      for(const targetId of selected.targetIds)effects.push({targetId,effects:op.kind==='effects'?op.effects:targetId===op.primaryId?op.primaryEffects:op.otherEffects,operationIndex:index});
    }else if(op.kind==='center-and-area'){
      const selected=selectAbilityTargets(op.center,current);
      for(const targetId of selected.targetIds)effects.push({targetId,effects:op.areaEffects,operationIndex:index});
      const center=selected.centerId??env.boundTargetIds?.[0];
      if(center)effects.push({targetId:center,effects:op.centerEffects,operationIndex:index});
    }else operations.push(op);
  });
  return{effects,operations};
}
/** Per-target classification seam, before constructing a request. No M9 policy is enabled. */
export function damageTypeForTarget(declared:DamageType,_target:TargetUnit,_facts:ResolutionFacts):DamageType{return declared;}
