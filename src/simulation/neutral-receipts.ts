import type { CombatEvent, CombatStep } from './combat-types';
export const NEUTRAL_RUNTIME_VERSION = 'm8-b7-neutral-receipts-v1';
export interface NeutralReceipts {
  readonly deaths: readonly { readonly unitId:string; readonly tick:number; readonly eventSeq:number }[];
  readonly controls: readonly {
    readonly key:string; readonly targetId:string; readonly appliedEventSeq:number;
    readonly removedAtTick:number|null; readonly removedEventSeq:number|null;
    readonly removedReason:Extract<CombatEvent,{type:'statusChanged'}>['reason']|null;
  }[];
}
/** B7 adapter records already committed domain facts. It never applies an effect or changes events. */
export function recordNeutralReceipts(step: CombatStep): CombatStep {
  const previous=step.state.neutralReceipts;
  if(!previous) return step;
  let changed=false;
  const deaths=[...previous.deaths],controls=[...previous.controls];
  for(const e of step.events) {
    if(e.type==='death' && step.state.units.some(u=>u.id===e.unitId && u.unitKind==='neutral'))
      { changed=true;deaths.push({unitId:e.unitId,tick:e.tick,eventSeq:e.eventSeq!}); }
    if(e.type!=='statusChanged' || e.status.kind!=='stun' || !step.state.units.some(u=>u.id===e.status.source.ownerId && u.unitKind==='neutral')) continue;
    changed=true;
    if(e.reason==='applied') controls.push({key:e.status.key,targetId:e.unitId,appliedEventSeq:e.eventSeq!,removedAtTick:null,removedEventSeq:null,removedReason:null});
    else {
      const index=controls.findIndex(c=>c.key===e.status.key);
      if(index>=0) controls[index]={...controls[index],removedAtTick:e.tick,removedEventSeq:e.eventSeq!,removedReason:e.reason};
    }
  }
  return changed ? {...step,state:{...step.state,neutralReceipts:{deaths,controls}}} : step;
}
