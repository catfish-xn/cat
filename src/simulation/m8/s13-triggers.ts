import { startingRows } from './targeting';
import type { AbilityContext, S13Packet } from '../combat-s13-abilities';
import type { Trigger, TriggerContext } from './contracts';
import { EMPTY_FACTS, EMPTY_TRIGGER_LEDGER, dispatchTriggers, type ResolutionFacts, type TriggerSignal, type TriggerUnit } from './triggers';
import { executeMechanismEffect, selectMechanismTargets } from './s13-mechanisms';
import { canonicalSource, compareCodePoints } from './identity';
/** One call represents one completed occurrence, never one packet masquerading as an attack. */
type TriggerInput = TriggerContext extends infer T ? T extends TriggerContext ? Omit<T, 'eventSeq'> : never : never;
export function hasMechanismSubscriber(units: AbilityContext['units'], event: Trigger): boolean {
  return units.some(u => u.mechanismDefinitions?.eventTriggers?.some(d => d.event === event || d.counters.some(c => c.events.some(e => e.event === event))));
}
export function emitMechanismSignal(ctx: AbilityContext, context: TriggerInput, facts: ResolutionFacts = EMPTY_FACTS, aggregation: TriggerSignal['aggregation'] = 'event', onlyItemSources?: ReadonlySet<string>): void {
  if (!hasMechanismSubscriber(ctx.units, context.event)) return;
  if (onlyItemSources && !ctx.units.some(u => u.mechanismDefinitions?.eventTriggers?.some(d =>
    (d.source.sourceKind === 'item' && onlyItemSources.has(d.source.instanceId)||d.source.sourceKind==='anomaly'&&!!d.source.parentItemInstanceId&&onlyItemSources.has(d.source.parentItemInstanceId)) && d.event === context.event))) return;
  const signal: TriggerSignal = {context:{...context,eventSeq:ctx.nextTriggerEventSeq ?? 0},facts,aggregation};
  ctx.nextTriggerEventSeq=(ctx.nextTriggerEventSeq ?? 0)+1;
  const invocations=[];
  // Dispatch only replaces trigger ledgers; effects run after every holder has
  // selected. Sample the small listener/condition view once per signal, including
  // virtual HP, instead of spreading the whole combat graph for each holder.
  const samples: TriggerUnit[] = ctx.units.map(u => ({ id: u.id, team: u.team, cell: u.cell,
    hp: ctx.virtualHp?.get(u.id) ?? u.hp, maxHp: u.maxHp, alive: u.alive,
    startingRows: startingRows(u.team, u.startingCell?.row ?? u.cell.row) ?? undefined }));
  for(const holder of ctx.units) {
    const definitions=(holder.mechanismDefinitions?.eventTriggers ?? []).filter(d => !onlyItemSources || (d.source.sourceKind === 'item' && onlyItemSources.has(d.source.instanceId)||d.source.sourceKind==='anomaly'&&!!d.source.parentItemInstanceId&&onlyItemSources.has(d.source.parentItemInstanceId)));if(!definitions.length) continue;
    const result=dispatchTriggers(ctx.combatId ?? 'standalone',definitions,holder.triggerLedger ?? EMPTY_TRIGGER_LEDGER,signal,samples,(d,s)=>{
      return selectMechanismTargets(holder, ctx.units, d.selector, undefined, d.source, {
        board: ctx.board, tick: ctx.tick, eventActorId: s.context.actorId, eventTargetId: s.context.targetId,
        eventActorCell: s.context.cast?.completionCell, eligibility: 'new-selection',
      }).map(u => u.id);
    }, ctx.defenses ? id => ctx.defenses!(ctx.units.find(u => u.id === id)!, false) : undefined);
    holder.triggerLedger=result.ledger;
    for(const invocation of result.invocations) invocations.push({holder,invocation});
  }
  invocations.sort((a,b)=>compareCodePoints(canonicalSource(a.invocation.definition.source),canonicalSource(b.invocation.definition.source)));
  for(const {holder,invocation} of invocations) for(const targetId of invocation.targetIds) {
    const target=ctx.units.find(u=>u.id===targetId)!;
    const beforeDamage: NonNullable<S13Packet['beforeDamage']> = [];
    for(const [index,effect] of invocation.definition.effects.entries()) {
      if(!invocation.effectIndices.includes(index)) continue;
      const source={...invocation.definition.source,effectIndex:invocation.definition.source.effectIndex+index};
      // A status prefix belongs to the following packet, not the earlier root packets
      // still waiting in the damage queue. Status-only listeners keep their event boundary.
      const ordinal = ctx.packets.length + 100000;
      if ((context.event === 'attack-completed' || context.event === 'cast-completed') && effect.kind === 'apply-status' && effect.status.activation === 'immediate'
        && invocation.effectIndices.some(i => i > index && invocation.definition.effects[i].kind === 'damage')) {
        beforeDamage.push({ source, effect, ordinal }); continue;
      }
      executeMechanismEffect(ctx,holder,source,target,effect,context.actionSeq,ctx.packets.length+100000,undefined,undefined,undefined,facts.brokenShield,
        {area:invocation.targetIds.length>1,triggeringCastActionSeq:context.event==='cast-completed'?context.actionSeq:null,
          cast:signal.context.cast ?? undefined,facts,counters:invocation.counters});
      if (effect.kind === 'damage' && beforeDamage.length) ctx.packets[ctx.packets.length - 1].beforeDamage = beforeDamage.splice(0);
    }
  }
}
