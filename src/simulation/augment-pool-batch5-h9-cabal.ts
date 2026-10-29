import type { MatchBase, MatchState } from './match-types';
import type { Effect, TraitSnapshot } from './strategy-types';
import type { Unit } from './unit-types';
import type { CombatUnit } from './combat-types';
import type { AugmentTakedownActor } from './augment-history-types';
import type { AugmentGiftSpec } from './augment-gift-plan';
import { planAugmentGifts } from './augment-gift-plan';
import { UNIT_DEFINITIONS } from './units';
import { AUGMENT_BATCH5_H9 } from './content/augment-pool-batch5-h9';
import { appendAugmentFact, historyCheck, historySeatId, requireAugmentFacts } from './augment-history';

export const FORBIDDEN_MAGIC = 'forbidden-magic';
export const CABAL_GROWTH_SOURCE = 'augment-b5-forbidden-magic';
export interface CabalGrowth { readonly healthFlat: number; readonly attackDamageBps: number }
const values = AUGMENT_BATCH5_H9['forbidden-magic'].source.values;
export const CABAL_ATTACK_BPS = Math.round(values.SionADPercentPerStack * 10000);
export const CABAL_HEROES = Object.freeze(Object.values(UNIT_DEFINITIONS).filter(u => !u.summon && u.unitKind !== 'neutral' && u.traits.includes('black-rose')).map(u => u.id).sort());
export function cabalGiftPlan(state: MatchState) {
  const specs: readonly AugmentGiftSpec[] = [{kind:'random-unit-pool',definitions:CABAL_HEROES,count:3}];
  return state.augments.filter(a=>a.definitionId===FORBIDDEN_MAGIC).flatMap(a=>planAugmentGifts(state,a,specs));
}
/** Freeze eligibility even below the trait activation threshold, including emblem membership.
 * The marker travels in ordinary compiler sources, so two-sided remapping and combat restore use it too. */
export function cabalEffects(unit: Unit, traits: readonly TraitSnapshot[], growth: CabalGrowth): readonly Effect[] {
  const eligible = unit.definitionId==='g23-sion' || traits.some(t=>t.team===unit.team&&t.traitId==='black-rose'&&(t.memberUnitIds?.includes(unit.id)??t.memberDefinitionIds.includes(unit.definitionId)));
  return [{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:eligible?1:0}},
    ...(unit.definitionId==='g23-sion'?[{kind:'statFlat' as const,stat:'maxHp' as const,amount:growth.healthFlat},
      {kind:'statPercentBps' as const,stat:'attackDamage' as const,bps:growth.attackDamageBps}]:[])];
}
export function tracksCabalTakedowns(units: readonly CombatUnit[]): boolean {
  return units.some(u=>u.mechanics?.some(m=>m.source.definitionId===FORBIDDEN_MAGIC));
}
/** Detached actual contributors; an ineligible proxy never becomes a formal champion. */
export function sampleCabalTakedowns(units: readonly CombatUnit[], victimId: string, ids: readonly string[]): readonly AugmentTakedownActor[] {
  const victim=units.find(u=>u.id===victimId)!;
  return [...new Set(ids)].sort().flatMap(id=>{
    const u=units.find(u=>u.id===id);
    if(!u||u.team===victim.team)return [];
    return [{unitId:u.id,definitionId:u.definitionId,team:u.team,
      eligible:!u.itemSummon&&!u.anomalySummon&&(u.definitionId==='g23-sion'||!!UNIT_DEFINITIONS[u.definitionId]&&!UNIT_DEFINITIONS[u.definitionId].summon&&u.unitKind!=='neutral')
        &&u.mechanics?.some(m=>m.source.definitionId===FORBIDDEN_MAGIC&&m.values.enabled===1)===true}];
  });
}
/** Each participant/victim pair counts once per battle, even if a victim revives. The remainder is player-owned. */
export function cabalGrowthPlan(state: MatchState): readonly {receiptId:string;choiceId:string;round:number;stacks:number;healthFlat:number;attackDamageBps:number}[] {
  const a=state.augments.find(a=>a.definitionId===FORBIDDEN_MAGIC);if(!a)return [];
  let takedowns=0,paid=0;
  return state.roundResults.filter(r=>r.round>=a.acquiredRound&&r.result!=='supply').flatMap(r=>{
    const rows=requireAugmentFacts(state,'deaths',r.round);
    historyCheck(rows.some(f=>f.completeThroughTick>=r.combatTicks),'cabal incomplete combat');
    const seen=new Set<string>();
    for(const f of rows)for(const d of f.deaths){
      historyCheck(Array.isArray(d.takedowns),'cabal missing takedowns');
      const hostile=state.multiplayer&&r.roundKind==='pvp'?d.ownerSeatId!==historySeatId(state):d.team==='enemy';
      if(!hostile)continue;
      for(const actor of d.takedowns!)if(actor.eligible&&actor.team!==d.team){
        const key=JSON.stringify([f.battleId,d.unitId,actor.unitId]);
        if(!seen.has(key)){seen.add(key);takedowns++;}
      }
    }
    const stacks=Math.floor(takedowns/values.NumTakedownsPerStack),delta=stacks-paid;paid=stacks;
    return delta?[{receiptId:JSON.stringify([CABAL_GROWTH_SOURCE,a.choiceId,r.round]),choiceId:a.choiceId,round:r.round,
      stacks:delta,healthFlat:delta*values.SionHealthPerStack,attackDamageBps:delta*CABAL_ATTACK_BPS}]:[];
  });
}
export function settleCabalGrowth(initial:MatchState):MatchState {
  let s=initial;
  for(const p of cabalGrowthPlan(initial)){
    const previous=s.augmentHistory!.facts.find(f=>f.kind==='summon-growth'&&f.receiptId===p.receiptId);
    if(previous){historyCheck(previous.kind==='summon-growth'&&previous.choiceId===p.choiceId&&previous.stacks===p.stacks&&previous.healthFlat===p.healthFlat&&previous.attackDamageBps===p.attackDamageBps,'cabal growth receipt conflict');continue;}
    historyCheck(p.round===s.round,'cabal late growth');
    s=appendAugmentFact(s,{kind:'summon-growth',choiceId:p.choiceId,receiptId:p.receiptId,definitionId:'g23-sion',stacks:p.stacks,healthFlat:p.healthFlat,attackDamageBps:p.attackDamageBps});
  }
  return s;
}
/** Battle N reads only completed growth from rounds < N, never its own new kills. */
export function readCabalGrowth(state: Pick<MatchBase,'round'|'augments'|'augmentHistory'>): CabalGrowth | undefined {
  const a=state.augments.find(a=>a.definitionId===FORBIDDEN_MAGIC);if(!a)return undefined;
  historyCheck(state.augmentHistory,'missing cabal history');
  let healthFlat=0,attackDamageBps=0;
  for(const round of new Set(state.augmentHistory.facts.filter(f=>f.kind==='summon-growth'&&f.round<state.round).map(f=>f.round)))
    for(const f of requireAugmentFacts(state as MatchState,'summon-growth',round))if(f.choiceId===a.choiceId&&f.definitionId==='g23-sion'){healthFlat+=f.healthFlat;attackDamageBps+=f.attackDamageBps;}
  historyCheck(Number.isSafeInteger(healthFlat)&&Number.isSafeInteger(attackDamageBps),'cabal growth overflow');
  return {healthFlat,attackDamageBps};
}
