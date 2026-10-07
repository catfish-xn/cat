import type { CounterDefinition, DamageOutcome, EffectRuntime, HealOutcome, Source, TriggerContext, TriggerDefinition, TriggerListener } from './contracts';
import type { HexCell, Team } from '../board';
import { hexDistance } from '../board';
import { canonicalSource, compareCodePoints, effectIdentity } from './identity';
import { conditionHolds, integer } from './stats';
/** Full settlement facts are available without turning occurrence counters into amounts. */
export interface ResolutionFacts {
  readonly damage: readonly DamageOutcome[];
  readonly healing: readonly HealOutcome[];
  readonly shieldDecay: readonly { readonly key: string; readonly amount: number }[];
}
export interface TriggerSignal {
  readonly context: TriggerContext;
  readonly facts: ResolutionFacts;
  readonly aggregation: 'event' | 'action-damage-total';
}
export interface TriggerUnit { readonly startingRows?: 'front-two'|'back-two'; readonly id: string; readonly team: Team; readonly cell: HexCell; readonly hp: number; readonly maxHp: number; readonly alive: boolean }
export interface TriggerLedger {
  readonly runtimes: readonly EffectRuntime[];
  readonly processed: Readonly<Record<string, number>>;
  readonly actionCounts: Readonly<Record<string, number>>;
}
export const EMPTY_TRIGGER_LEDGER: TriggerLedger = { runtimes: [], processed: {}, actionCounts: {} };
export const EMPTY_FACTS: ResolutionFacts = { damage: [], healing: [], shieldDecay: [] };
export function counterIdentity(combatId: string, source: Source, id: string): string {
  return JSON.stringify([combatId, source.ownerId, source.sourceKind, source.definitionId, source.instanceId, source.parentItemInstanceId, id]);
}
export function listenerMatches(listener: TriggerListener, holder: TriggerUnit, signal: TriggerSignal, units: readonly TriggerUnit[]): boolean {
  const event = signal.context, id = listener.subject === 'actor' ? event.actorId : event.targetId;
  const subject = units.find(u => u.id === id); if (!subject) return false;
  const relation = listener.relationToHolder;
  if (relation === 'self' && subject.id !== holder.id || relation === 'ally' && subject.team !== holder.team || relation === 'enemy' && subject.team === holder.team) return false;
  const cell = event.event === 'cast-completed' && listener.subject === 'actor' ? event.cast.completionCell : subject.cell;
  return listener.withinHexes === null || hexDistance(holder.cell, cell) <= listener.withinHexes;
}
function runtimeFor(combatId: string, d: TriggerDefinition, tick: number): EffectRuntime {
  return { ...effectIdentity(combatId, d.source, d.source.ownerId), startsAtTick: tick, expiresAtTick: null, stacks: 0,
    triggerCount: 0, counters: {}, consumedRewards: [], nextEligibleTick: 0, consumed: false, stackPolicy: d.stackPolicy };
}
export interface TriggerInvocation { readonly definition: TriggerDefinition; readonly signal: TriggerSignal; readonly targetIds: readonly string[]; readonly counters: Readonly<Record<string, number>> }
/** Selection is an engine dependency, not serializable user code or an effect callback. */
export function dispatchTriggers(combatId: string, definitions: readonly TriggerDefinition[], ledger: TriggerLedger, signal: TriggerSignal,
  units: readonly TriggerUnit[], select: (definition: TriggerDefinition, signal: TriggerSignal) => readonly string[]): { ledger: TriggerLedger; invocations: TriggerInvocation[] } {
  const event = signal.context; integer(event.eventSeq); integer(event.tick); integer(event.actionSeq);
  if (event.event === 'cast-completed' && (!event.cast.completed || event.cast.source.ownerId !== event.actorId || event.cast.actionSeq !== event.actionSeq || event.cast.targetsSampledAtTick !== event.tick)) throw new RangeError('Invalid cast trigger binding');
  const sorted = [...definitions].sort((a,b)=>compareCodePoints(canonicalSource(a.source),canonicalSource(b.source)) || compareCodePoints(a.id,b.id));
  const next = new Map(ledger.runtimes.map(r=>[r.key,r])), processed = { ...ledger.processed }, actionCounts = { ...ledger.actionCounts };
  const invocations: TriggerInvocation[] = [], counters = new Map<string,{ counter: CounterDefinition; owner: TriggerDefinition }>();
  for (const d of sorted) for (const counter of d.counters) {
    const key = counterIdentity(combatId,d.source,counter.id), prior = counters.get(key);
    if (prior && JSON.stringify(prior.counter) !== JSON.stringify(counter)) throw new RangeError('Conflicting shared counter declaration');
    if (!prior) counters.set(key,{counter,owner:d});
  }
  const changed = new Set<string>();
  for (const [key,{counter,owner:d}] of counters) {
    const holder = units.find(u=>u.id===d.source.ownerId); if (!holder?.alive || (processed[key] ?? -1)>=event.eventSeq) continue;
    const eligible = counter.events.some(e=>e.event===event.event && listenerMatches(e.listener,holder,signal,units)
      && (e.qualifies==='completed-event' || signal.facts.damage.some(o=>o.absorbed+o.hpDamage>0)));
    if (!eligible || signal.aggregation !== 'event') continue;
    processed[key]=event.eventSeq;
    const identity = runtimeFor(combatId,d,event.tick), old=next.get(identity.key) ?? identity, count=old.counters[counter.id] ?? 0;
    const value=Math.min(counter.cap ?? Number.MAX_SAFE_INTEGER,count+1); integer(value);
    if(value!==count) { next.set(old.key,{...old,counters:{...old.counters,[counter.id]:value},stacks:value}); changed.add(key); }
  }
  const readCounters = (d: TriggerDefinition) => Object.fromEntries([...counters].filter(([key,{counter}])=>key===counterIdentity(combatId,d.source,counter.id)).map(([,entry])=>[entry.counter.id,next.get(runtimeFor(combatId,entry.owner,event.tick).key)?.counters[entry.counter.id] ?? 0]));
  for(const d of sorted) {
    const holder=units.find(u=>u.id===d.source.ownerId); if(!holder?.alive) continue;
    const values=readCounters(d), derived=d.event==='counter-updated';
    if(derived ? ![...changed].some(k=>[...counters.values()].some(c=>k===counterIdentity(combatId,d.source,c.counter.id))) : d.event!==event.event || d.aggregation!==signal.aggregation) continue;
    const context: TriggerContext = derived ? { event:'counter-updated', eventSeq:event.eventSeq,tick:event.tick,actionSeq:event.actionSeq,actorId:holder.id,targetId:holder.id,cast:null } : event;
    const current={...signal,context};
    if(!listenerMatches(d.listener,holder,current,units)) continue;
    const identity=runtimeFor(combatId,d,event.tick), old=next.get(identity.key) ?? identity;
    const seen=JSON.stringify(['trigger',identity.key,d.id,context.event,signal.aggregation]);
    if((processed[seen] ?? -1)>=event.eventSeq) continue;
    processed[seen]=event.eventSeq;
    const target=units.find(u=>u.id===context.targetId);
    if(!conditionHolds(d.condition,{holder,target,startingRows:holder.startingRows,positiveHpDamage:signal.facts.damage.some(o=>o.hpDamage>0)})) continue;
    if(old.consumed || event.tick<old.nextEligibleTick || d.maxPerCombat!==null && old.triggerCount>=d.maxPerCombat) continue;
    const gate=d.gate, count=gate.kind==='always'?0:values[gate.counterId] ?? 0;
    if(gate.kind==='every-n' && (count<gate.firstAt || (count-gate.firstAt)%gate.everyN!==0)) continue;
    if(gate.kind==='stack-threshold-once' && (count<gate.at || old.consumedRewards.includes(gate.rewardId))) continue;
    const actionKey=JSON.stringify([identity.key,d.id,event.actorId,event.actionSeq]);
    if((actionCounts[actionKey] ?? 0)>=d.maxPerAction) continue;
    const targetIds=select(d,current); if(targetIds.length===0) continue;
    const triggerCount=old.triggerCount+1; integer(triggerCount);
    next.set(old.key,{...old,triggerCount,nextEligibleTick:event.tick+d.internalCooldownTicks,
      consumed:d.maxPerCombat!==null && triggerCount>=d.maxPerCombat,
      consumedRewards:gate.kind==='stack-threshold-once'?[...old.consumedRewards,gate.rewardId]:old.consumedRewards});
    actionCounts[actionKey]=(actionCounts[actionKey] ?? 0)+1;
    invocations.push({definition:d,signal:current,targetIds:[...targetIds],counters:values});
  }
  return {ledger:{runtimes:[...next.values()].sort((a,b)=>compareCodePoints(a.key,b.key)),processed,actionCounts},invocations};
}
export function validateTriggerLedger(ledger: TriggerLedger, combatId: string, definitions: readonly TriggerDefinition[]): void {
  const keys=new Set(definitions.map(d=>runtimeFor(combatId,d,0).key)), seen=new Set<string>();
  for(const r of ledger.runtimes) {
    if(!keys.has(r.key)||seen.has(r.key)) throw new RangeError('Unknown/duplicate trigger runtime'); seen.add(r.key);
    for(const n of [r.triggerCount,r.stacks,r.nextEligibleTick,...Object.values(r.counters)]) integer(n);
    const d=definitions.find(d=>runtimeFor(combatId,d,0).key===r.key)!;
    if(d.maxPerCombat!==null && r.triggerCount>d.maxPerCombat || new Set(r.consumedRewards).size!==r.consumedRewards.length) throw new RangeError('Invalid trigger consumption');
    for(const [id,n] of Object.entries(r.counters)) { const c=d.counters.find(c=>c.id===id); if(!c || c.cap!==null&&n>c.cap) throw new RangeError('Invalid counter'); }
  }
  for(const n of [...Object.values(ledger.processed),...Object.values(ledger.actionCounts)]) integer(n);
}
