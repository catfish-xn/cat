import { ORB_RULES, ORB_STAGE_PLAN, type OrbStageCombination } from './content/orbs';
import { drawIndex } from './orb-layout';
import type { RngStream } from './m8/contracts';
import { validateSeed } from './rng';

export function deriveOrbStream(namespace:string,seed:number,...identity:readonly string[]):RngStream {
  validateSeed(seed);
  const text=JSON.stringify([namespace,seed,...identity]);let state=2166136261;
  for(let i=0;i<text.length;i++)state=Math.imul(state^text.charCodeAt(i),16777619)>>>0;
  return {state,draws:0};
}
export interface OrbStagePlan {
  readonly stages:readonly OrbStageCombination[]; readonly highStages:readonly number[];
  readonly attempts:number; readonly fallback:boolean; readonly rng:RngStream;
}
export function orbPlanTotals(stages:readonly OrbStageCombination[]):{components:number;bonus:number} {
  return stages.reduce((sum,row,i)=>({components:sum.components+row.components,
    bonus:sum.bonus+(['gray','blue','gold','prismatic'] as const).reduce((n,tier)=>n+row[tier]*ORB_STAGE_PLAN.points[tier][i+1>=ORB_STAGE_PLAN.upgradeStage[tier]?1:0],0)}),{components:0,bonus:0});
}
export function orbHighStageSets(k:number):readonly (readonly number[])[] {
  const result:number[][]=[];
  const visit=(next:number,chosen:number[])=>{if(chosen.length===k){result.push(chosen);return;}for(let s=next;s<=4;s++)visit(s+1,[...chosen,s]);};
  visit(1,[]);return result;
}
/** Pure and ephemeral: future rows are never persisted. Optional draw tests bounded retries. */
export function sampleOrbStagePlan(seed:number,draw:typeof drawIndex=drawIndex):OrbStagePlan {
  let rng=deriveOrbStream(ORB_RULES.planStream,seed);
  const pick=(n:number)=>{const result=draw(rng,n);rng=result.rng;return result.index;};
  const weighted=<T>(rows:readonly T[],weights:readonly number[]):T=>{
    let index=pick(weights.reduce((a,b)=>a+b,0));
    for(let i=0;i<rows.length;i++){if(index<weights[i])return rows[i];index-=weights[i];}throw new RangeError('Invalid orb plan draw');
  };
  for(let attempts=1;attempts<=ORB_STAGE_PLAN.maxAttempts;attempts++) {
    const k=weighted([0,1,2,3,4],ORB_STAGE_PLAN.highOdds),sets=orbHighStageSets(k);
    const highStages=sets[k===0||k===4?0:pick(sets.length)];
    const stages=ORB_STAGE_PLAN.stages.map((stage,i)=>{const rows=highStages.includes(i+1)?stage.high:stage.base;return weighted(rows,rows.map(r=>r.weight));});
    const total=orbPlanTotals(stages);
    if(total.components>=ORB_STAGE_PLAN.minItems&&total.components<=ORB_STAGE_PLAN.maxItems&&total.bonus>=ORB_STAGE_PLAN.minBonus&&total.bonus<=ORB_STAGE_PLAN.maxBonus)
      return {stages,highStages,attempts,fallback:false,rng};
  }
  return {stages:ORB_STAGE_PLAN.stages.map(s=>s.base[0]),highStages:[],attempts:ORB_STAGE_PLAN.maxAttempts,fallback:true,rng};
}
