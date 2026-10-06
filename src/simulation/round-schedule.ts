import type { ScheduleEvent } from './strategy-types';
import { freezeContent } from './content/freeze';
export type RoundKind = 'pvp' | 'pve' | 'supply';
export const FINAL_ROUND = 35;
const fixed: {readonly round:number;readonly event:ScheduleEvent}[] = [
  {round:1,event:{id:'r1-component-1',kind:'component',priority:10,timing:'before'}},
  {round:1,event:{id:'r1-component-2',kind:'component',priority:11,timing:'before'}},
  ...[1,9,16].map(round=>({round,event:{id:`r${round}-augment`,kind:'augment' as const,priority:20,timing:'before' as const}})),
  {round:20,event:{id:'r20-anomaly',kind:'anomaly',priority:30,timing:'before'}},
  ...[4,11,18,25,32].map(round=>({round,event:{id:`r${round}-supply`,kind:'component' as const,priority:10,timing:'before' as const}})),
  ...[7,14,21,28].flatMap(round=>[
    {round,event:{id:`r${round}-reward`,kind:'reward' as const,priority:10,timing:'after' as const,components:[],randomComponents:1,gold:0,recruitIfEmpty:false}},
    {round,event:{id:`r${round}-component`,kind:'component' as const,priority:20,timing:'after' as const}},
  ]),
];
fixed.sort((a,b)=>a.round-b.round || a.event.priority-b.event.priority || (a.event.id<b.event.id?-1:1));
/** All acquisition events are finite. Component choices consume no RNG; after events run only following a live nonterminal settlement. */
export const ROUND_SCHEDULE=freezeContent({fixed,fallbackDefinitionId:'irelia',finalRound:FINAL_ROUND,
  // Retained shape for legacy catalog tooling, explicitly outside the finite schedule.
  recurring:{fromRound:36,everyRounds:7,randomComponents:0},
});
function requireRound(round:number):void {
  if (!Number.isSafeInteger(round)||round<1||round>FINAL_ROUND) throw new RangeError('Round must be an integer from 1 to 35');
}
export function getStageRound(round:number):{readonly stage:number;readonly round:number} {
  requireRound(round);return {stage:2+Math.floor((round-1)/7),round:1+(round-1)%7};
}
export function getRoundKind(round:number):RoundKind {
  const sub=getStageRound(round).round;return sub===4?'supply':sub===7?'pve':'pvp';
}
export function getRoundSchedule(round:number):ScheduleEvent[] {
  requireRound(round);return ROUND_SCHEDULE.fixed.filter(entry=>entry.round===round).map(({event})=>event.kind==='reward'?{...event,components:[...event.components]}:{...event});
}
