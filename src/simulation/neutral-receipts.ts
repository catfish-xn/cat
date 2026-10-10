import type { CombatEvent, CombatStep } from './combat-types';
export const NEUTRAL_RUNTIME_VERSION = 'm8-b7-neutral-receipts-v1';
export interface NeutralReceipts {
  readonly deaths: readonly { readonly unitId:string; readonly tick:number; readonly eventSeq:number }[];
  readonly controls: readonly {
    readonly key:string; readonly targetId:string; readonly appliedEventSeq:number;
    readonly removedAtTick:number|null; readonly removedEventSeq:number|null;
    readonly removedReason:Exclude<Extract<CombatEvent,{type:'statusChanged'}>['reason'],'applied'|'refreshed'>|null;
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
    // B9 replay2: statusChanged carries the frozen StatusGroup. Applied/refreshed groups are the
    // post-change state (a new neutral stun contribution opens a receipt); end events list exactly
    // the contributions that ended (closing the open receipt with the same contribution key).
    if(e.type!=='statusChanged' || e.group.kind!=='stun') continue;
    const neutral=(ownerId:string)=>step.state.units.some(u=>u.id===ownerId && u.unitKind==='neutral');
    for(const c of e.group.contributions) {
      if(!neutral(c.source.ownerId)) continue;
      if(e.reason==='applied' || e.reason==='refreshed') {
        if(controls.some(x=>x.key===c.key)) continue;
        changed=true;controls.push({key:c.key,targetId:e.group.targetId,appliedEventSeq:e.eventSeq!,removedAtTick:null,removedEventSeq:null,removedReason:null});
      } else {
        const index=controls.findIndex(x=>x.key===c.key && x.removedAtTick===null);
        if(index>=0) { changed=true;controls[index]={...controls[index],removedAtTick:e.tick,removedEventSeq:e.eventSeq!,removedReason:e.reason}; }
      }
    }
  }
  return changed ? {...step,state:{...step.state,neutralReceipts:{deaths,controls}}} : step;
}
