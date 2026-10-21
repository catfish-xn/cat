import { ROUND_CATALOG } from './content/round-catalog';
import { SIX_COST_POLICY } from './content/v19-six-cost';

/** Per-slot combined six-cost odds, integer Bps. Every actual round, including supply/PvE/overtime, advances the schedule. */
export function sixCostOddsBps(round:number,level:number):number {
  if(!Number.isSafeInteger(round)||round<1||!Number.isSafeInteger(level)||level<1||level>10)throw new RangeError('Invalid six-cost shop context');
  const unlock=ROUND_CATALOG.find(r=>r.roundId===SIX_COST_POLICY.odds.unlockRoundId)!.ordinal;
  return round<unlock?0:Math.min(10000,SIX_COST_POLICY.odds.initialBps+(round-unlock)*SIX_COST_POLICY.odds.perRoundBps+(level===10?SIX_COST_POLICY.odds.level10Bps:0));
}
