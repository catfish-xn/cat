import { ROUND_CATALOG } from './content/round-catalog';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
/** Reward/shop stage clock only; existing overtime combat/economy schedule stays unchanged. */
export function openingStage(round: number): {stage:number;subround:number} {
  const last=ROUND_CATALOG.at(-1)!;
  if(round<=last.ordinal){const r=getMultiplayerRoundByOrdinal(round);return {stage:r.stage,subround:r.subround};}
  if(!Number.isSafeInteger(round))throw new RangeError('Invalid opening round');
  const n=round-last.ordinal-1;
  return {stage:7+Math.floor(n/7),subround:n%7+1};
}
