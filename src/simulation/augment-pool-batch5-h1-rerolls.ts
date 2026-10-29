import type { MatchState } from './match-types';
import { requireAugmentFacts } from './augment-history';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { UNIT_DEFINITIONS } from './units';
import { AUGMENT_BATCH5_H1 } from './content/augment-pool-batch5-h1';

/** Credits are derived from the authenticated opening roster of each actual preceding battle. */
export function twoMuchValueRerolls(state: MatchState): number {
  const owner=state.augments.find(a=>a.definitionId==='two-much-value');
  if(!owner)return 0;
  let credits=0;
  for(let round=owner.acquiredRound;round<state.round;round++) {
    if(getMultiplayerRoundByOrdinal(round).kind==='supply')continue;
    // Room PvP records its authoritative table after auto-deployment; other battles record the actual combat roster.
    const roster=state.multiplayer && getMultiplayerRoundByOrdinal(round).kind==='pvp'
      ? requireAugmentFacts(state,'pvp-roster',round)[0].seats.find(s=>s.seatId===state.multiplayer!.seatId)
      : requireAugmentFacts(state,'combat-roster',round)[0].roster;
    if(!roster)throw new RangeError('Invalid augment history: missing battle seat');
    const ids=new Set(roster.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&UNIT_DEFINITIONS[u.definitionId]?.cost===2
      && !UNIT_DEFINITIONS[u.definitionId]?.summon && UNIT_DEFINITIONS[u.definitionId]?.unitKind!=='neutral').map(u=>u.definitionId));
    const v=AUGMENT_BATCH5_H1['two-much-value'].source.values;
    credits+=Math.floor(ids.size/v.UnitCount)*v.FreeRerolls;
  }
  return credits;
}
