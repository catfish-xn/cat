import { usableBenchSlots } from './bench-capacity';
import { augmentLevelCap } from './augment-pool-batch5-h12-progression';
import { AUGMENT_BATCH4_B4XP } from './content/augment-pool-batch4-b4xp';
import type { MatchState, RoundResult } from './match-types';
import type { RoundEconomyPlan } from './economy';
import { grantXp } from './progression';
import { UNIT_DEFINITIONS } from './units';

/** P-B4XP: inspect the live seat at combat end, before settlement loot and deferred upgrades.
 * Summons/anvils are not champions; consumables have their own inventory and do not count as items. */
export function batch4B4xpSettlementXp(state:MatchState):number {
 if(state.m8.round.kind!=='pvp')return 0;
 const champions=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'&&!UNIT_DEFINITIONS[u.definitionId]?.summon).length;
 return state.augments.reduce((sum,a)=>{
  const row=AUGMENT_BATCH4_B4XP[a.definitionId];if(!row||a.acquiredRound>state.round)return sum;
  const eligible=row.condition==='empty-champion-bench'?champions===0:row.condition==='full-champion-bench'?champions===usableBenchSlots(state.preparation):
   !state.items.some(i=>i.location.kind==='inventory');
  return sum+(eligible?row.source.values.XP!:0);
 },0);
}
/** One atomic settlement progression, including ordinary XP and the augment entitlement (cap handled once). */
export function withBatch4B4xp(state:Pick<MatchState,'level'|'xp'>&Partial<Pick<MatchState,'augments'>>,plan:RoundEconomyPlan,extra:number):RoundEconomyPlan {
 return extra?{...plan,progression:grantXp(state.level,state.xp,plan.progression.xpRequested+extra,augmentLevelCap(state.augments??[]))}:plan;
}
/** Structural preflight only: an archived settlement may request exactly a subset of its owned condition rewards.
 * Full restore must replay battles to establish which conditions actually held; the candidate is never its own proof.
 * Reuses RoundResult and BattleRecord verbatim, without a new save field or format. */
export function batch4B4xpRecordedExtra(state:Pick<MatchState,'augments'>,result:RoundResult,base:number):number {
 let allowed=new Set([0]);
 if(result.roundKind==='pvp')for(const a of state.augments){
  const row=AUGMENT_BATCH4_B4XP[a.definitionId];if(!row||a.acquiredRound>result.round)continue;
  allowed=new Set([...allowed,...[...allowed].map(n=>n+row.source.values.XP!)]);
 }
 const extra=result.xpRequested-base;
 if(!allowed.has(extra))throw new RangeError('Invalid batch4 b4xp settlement XP');
 return extra;
}
/** Even zero-XP outcomes assert a historical bench condition and need the existing replay evidence. */
export function needsBatch4B4xpHistory(state:Pick<MatchState,'augments'|'roundResults'>):boolean {
 return state.roundResults.some(r=>r.roundKind==='pvp'&&state.augments.some(a=>a.acquiredRound<=r.round&&Object.hasOwn(AUGMENT_BATCH4_B4XP,a.definitionId)));
}
