import type { Team } from '../board';
import type { Effect, Source } from './contracts';
import { canonicalSource, compareCodePoints } from './identity';
import { integer } from './stats';
export interface CompanionMember { readonly id: string; readonly team: Team; readonly unitKind?: 'champion'|'neutral'; readonly encounterId?: string; readonly monsterFamily?: string }
export interface CompanionDefinition { readonly source: Source; readonly maxReactions?: number; readonly effects: readonly Extract<Effect,{kind:'heal'|'modify-stat'}>[] }
export interface DeathFact { readonly combatId: string; readonly tick: number; readonly deadUnitId: string; readonly team: Team; readonly encounterId: string; readonly monsterFamily: string; readonly eventId: string }
export interface CompanionReaction {
  readonly key: string; readonly source: Source; readonly deadUnitId: string; readonly deathEventId: string;
  readonly targetId: string; readonly registeredAtTick: number; readonly executeAtTick: number;
  readonly status: 'pending'|'executed'|'cancelled'; readonly effects: CompanionDefinition['effects'];
}
export interface CompanionState {
  readonly combatId: string;
  readonly bindings: readonly { readonly source: Source; readonly maxReactions: number; readonly members: readonly string[]; readonly team: Team; readonly encounterId: string; readonly monsterFamily: string; readonly effects: CompanionDefinition['effects'] }[];
  readonly reactions: readonly CompanionReaction[];
}
export function freezeCompanions(combatId: string, members: readonly CompanionMember[], definitions: readonly CompanionDefinition[]): CompanionState {
  const bindings=definitions.map(d=>{
    const owner=members.find(m=>m.id===d.source.ownerId);
    if(!owner || owner.unitKind!=='neutral' || !owner.encounterId || !owner.monsterFamily) throw new RangeError('Missing formal neutral classification');
    if (d.maxReactions !== undefined) integer(d.maxReactions, 1);
    return {source:d.source,maxReactions:d.maxReactions ?? members.length,team:owner.team,encounterId:owner.encounterId,monsterFamily:owner.monsterFamily,effects:d.effects,
      members:members.filter(m=>m.id!==owner.id&&m.unitKind==='neutral'&&m.team===owner.team&&m.encounterId===owner.encounterId&&m.monsterFamily===owner.monsterFamily).map(m=>m.id).sort(compareCodePoints)};
  }).sort((a,b)=>compareCodePoints(canonicalSource(a.source),canonicalSource(b.source)));
  if(new Set(bindings.map(b=>canonicalSource(b.source))).size!==bindings.length) throw new RangeError('Duplicate companion source');
  return {combatId,bindings,reactions:[]};
}
export function registerDeaths(state: CompanionState, deaths: readonly DeathFact[], livingAfterCleanup: readonly string[]): CompanionState {
  const live=new Set(livingAfterCleanup), keys=new Set(state.reactions.map(r=>r.key)), additions:CompanionReaction[]=[];
  const seen=new Set<string>();
  for(const death of [...deaths].sort((a,b)=>compareCodePoints(a.deadUnitId,b.deadUnitId))) {
    if(death.combatId!==state.combatId || seen.has(death.deadUnitId) || live.has(death.deadUnitId)) throw new RangeError('Invalid death batch');
    integer(death.tick);seen.add(death.deadUnitId);
    for(const b of state.bindings) {
      if(!live.has(b.source.ownerId)||!b.members.includes(death.deadUnitId)||b.team!==death.team||b.encounterId!==death.encounterId||b.monsterFamily!==death.monsterFamily) continue;
      const key=JSON.stringify([state.combatId,b.source.ownerId,canonicalSource(b.source),death.deadUnitId]);
      if(keys.has(key) || [...state.reactions,...additions].filter(r => canonicalSource(r.source) === canonicalSource(b.source)).length >= b.maxReactions) continue;keys.add(key);
      additions.push({key,source:b.source,deadUnitId:death.deadUnitId,deathEventId:death.eventId,targetId:b.source.ownerId,registeredAtTick:death.tick,executeAtTick:death.tick+1,status:'pending',effects:b.effects});
    }
  }
  return additions.length ? {...state,reactions:[...state.reactions,...additions]} : state;
}
/** Maintenance dequeues finite plans; heal effects still settle in the ordinary post-damage phase. */
export function advanceReactions(state: CompanionState, tick: number, living: readonly string[], combatEnded: boolean): { state: CompanionState; ready: CompanionReaction[] } {
  const ready:CompanionReaction[]=[],live=new Set(living);
  const reactions=state.reactions.map(r=>{
    if(r.status!=='pending') return r;
    if(combatEnded || !live.has(r.source.ownerId)) return {...r,status:'cancelled' as const};
    if(r.executeAtTick>tick) return r;
    const next={...r,status:'executed' as const};ready.push(next);return next;
  });
  return {state:{...state,reactions},ready};
}
export function validateCompanionState(state: CompanionState, combatId: string, definitions: readonly CompanionDefinition[], members: readonly CompanionMember[]): void {
  if (JSON.stringify(state.bindings) !== JSON.stringify(freezeCompanions(combatId, members, definitions).bindings)) throw new RangeError('Opening companion roster mismatch');
  if(state.combatId!==combatId) throw new RangeError('Companion combat mismatch');
  const seen=new Set<string>();
  for(const b of state.bindings) {
    const d=definitions.find(d=>canonicalSource(d.source)===canonicalSource(b.source));
    if(!d || JSON.stringify(d.effects)!==JSON.stringify(b.effects) || new Set(b.members).size!==b.members.length || b.members.includes(b.source.ownerId)) throw new RangeError('Invalid companion binding');
  }
  for(const r of state.reactions) {
    const b=state.bindings.find(b=>canonicalSource(b.source)===canonicalSource(r.source));
    integer(r.registeredAtTick);integer(r.executeAtTick);
    if(!b || !b.members.includes(r.deadUnitId) || r.targetId!==r.source.ownerId || !r.deathEventId || r.executeAtTick!==r.registeredAtTick+1 || !['pending','executed','cancelled'].includes(r.status)
      || JSON.stringify(r.effects)!==JSON.stringify(b.effects) || r.key!==JSON.stringify([combatId,r.targetId,canonicalSource(r.source),r.deadUnitId]) || seen.has(r.key)) throw new RangeError('Invalid companion reaction');
    seen.add(r.key);
  }
}
