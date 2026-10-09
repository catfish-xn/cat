import type { ScheduleEvent } from './strategy-types';
import { freezeContent } from './content/freeze';
import { ROUND_CATALOG, ROUND_SEMANTIC_NODES } from './content/round-catalog';
import { getCatalogRoundByOrdinal } from './round-selectors';
export type RoundKind = 'pvp' | 'pve' | 'supply';
export const ROUND_RULES_VERSION = 'm8-b6-round-opening-v1';
export const FINAL_ROUND = ROUND_CATALOG.at(-1)!.ordinal;
export const ROUND_PREPARATION_RULES = freezeContent({version:'m8-b7-preparation-v1',pveContent:'ready-b7-pending-b8'} as const);
const fixed: {readonly round:number;readonly event:ScheduleEvent}[] = ROUND_CATALOG.flatMap(round =>
  (ROUND_SEMANTIC_NODES[round.roundId] ?? []).map(node => ({round:round.ordinal,event:{
    id:`round:${round.roundId}:${node}`,kind:node === 'supply' ? 'component' as const : node,
    priority:node === 'augment' ? 20 : node === 'anomaly' ? 30 : 10,timing:'before' as const,
  }})));
/** B8 owns PvE drops. No legacy opening package or x-7 reward is synthesized here. */
export const ROUND_SCHEDULE=freezeContent({fixed,fallbackDefinitionId:'irelia',finalRound:FINAL_ROUND,
  recurring:{fromRound:FINAL_ROUND+1,everyRounds:7,randomComponents:0},
});
export function getStageRound(round:number):{readonly stage:number;readonly round:number} {
  const definition=getCatalogRoundByOrdinal(round);return {stage:definition.stage,round:definition.subround};
}
export function getRoundKind(round:number):RoundKind {return getCatalogRoundByOrdinal(round).kind;}
export function getRoundSchedule(round:number):ScheduleEvent[] {
  getCatalogRoundByOrdinal(round);return ROUND_SCHEDULE.fixed.filter(entry=>entry.round===round).map(({event})=>event.kind==='reward'?{...event,components:[...event.components]}:{...event});
}
