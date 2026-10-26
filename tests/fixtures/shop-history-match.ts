import { AUGMENT_SHOP } from '../../src/simulation/content/augment-pool-shop';
import { expect } from 'vitest';
import { selectChoice, type MatchState } from '../../src/simulation/match';
import { accepted, reachRound } from '../match-helpers';

/** Fixed seeds discovered once; acquisition always uses the actual offered card. */
export function shopOwner(seed:number,id:string,node='2-1'):MatchState {
 const state=reachRound(node,false,seed,[],Object.keys(AUGMENT_SHOP)),c=state.pendingChoice!;
 expect(c.offers).toContain(id);
 return accepted(selectChoice(state,c.choiceId,c.generation,id));
}
