import { startingRows } from './targeting';
import type { AbilityContext } from '../combat-s13-abilities';
import type { TriggerContext } from './contracts';
import { EMPTY_FACTS, EMPTY_TRIGGER_LEDGER, dispatchTriggers, type ResolutionFacts, type TriggerSignal } from './triggers';
import { executeMechanismEffect, selectMechanismTargets } from './s13-mechanisms';
import { canonicalSource, compareCodePoints } from './identity';
/** One call represents one completed occurrence, never one packet masquerading as an attack. */
type TriggerInput = TriggerContext extends infer T ? T extends TriggerContext ? Omit<T, 'eventSeq'> : never : never;
export function emitMechanismSignal(ctx: AbilityContext, context: TriggerInput, facts: ResolutionFacts = EMPTY_FACTS, aggregation: TriggerSignal['aggregation'] = 'event'): void {
  if (!ctx.units.some(u => u.mechanismDefinitions?.eventTriggers?.some(d => d.event === context.event || d.counters.some(c => c.events.some(e => e.event === context.event))))) return;
  const signal: TriggerSignal = {context:{...context,eventSeq:ctx.nextTriggerEventSeq ?? 0},facts,aggregation};
  ctx.nextTriggerEventSeq=(ctx.nextTriggerEventSeq ?? 0)+1;
  const invocations=[];
  for(const holder of ctx.units) {
    const definitions=holder.mechanismDefinitions?.eventTriggers ?? [];if(!definitions.length) continue;
    const result=dispatchTriggers(ctx.combatId ?? 'standalone',definitions,holder.triggerLedger ?? EMPTY_TRIGGER_LEDGER,signal,ctx.units.map(u => ({ ...u, hp: ctx.virtualHp?.get(u.id) ?? u.hp, startingRows: startingRows(u.team, u.startingCell?.row ?? u.cell.row) ?? undefined })),(d,s)=>{
      return selectMechanismTargets(holder, ctx.units, d.selector, undefined, d.source, {
        board: ctx.board, tick: ctx.tick, eventActorId: s.context.actorId, eventTargetId: s.context.targetId,
        eventActorCell: s.context.cast?.completionCell, eligibility: 'new-selection',
      }).map(u => u.id);
    });
    holder.triggerLedger=result.ledger;
    for(const invocation of result.invocations) invocations.push({holder,invocation});
  }
  invocations.sort((a,b)=>compareCodePoints(canonicalSource(a.invocation.definition.source),canonicalSource(b.invocation.definition.source)));
  for(const {holder,invocation} of invocations) for(const targetId of invocation.targetIds) {
    const target=ctx.units.find(u=>u.id===targetId)!;
    for(const [index,effect] of invocation.definition.effects.entries()) {
      // Equipment damage is a single derived layer. State listeners still see its full outcome.
      if(effect.kind==='damage' && effect.delivery==='equipment-proc' && facts.damage.some(o=>o.context.equipmentDepth===1)) continue;
      const source={...invocation.definition.source,effectIndex:invocation.definition.source.effectIndex+index};
      executeMechanismEffect(ctx,holder,source,target,effect,context.actionSeq,ctx.packets.length+100000,undefined,undefined,undefined,undefined,
        {area:invocation.targetIds.length>1,triggeringCastActionSeq:context.event==='cast-completed'?context.actionSeq:null,
          cast:signal.context.cast ?? undefined,facts,counters:invocation.counters});
    }
  }
}
