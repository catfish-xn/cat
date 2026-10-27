import type { MatchState } from './match-types';
import type { OwnedAugment } from './strategy-types';
import { grantXp } from './progression';
import { MATCH_RULES } from './match-rules';

/** P-B5-84: no downgrade; the acquisition command rejects levels above seven. */
export function augmentLevelCap(augments:readonly OwnedAugment[],round=Infinity):number {
 return augments.some(a=>a.definitionId==='max-cap'&&a.acquiredRound<=round)?7:MATCH_RULES.maxLevel;
}
export function grantMatchXp(state:Pick<MatchState,'augments'|'level'|'xp'>,amount:number) {
 return grantXp(state.level,state.xp,amount,augmentLevelCap(state.augments));
}
export function h12OfferAllowed(id:string,owned:readonly OwnedAugment[],level?:number):boolean {
 if(id==='max-cap'&&(level!==undefined&&level>7||owned.some(a=>a.definitionId==='level-up')))return false;
 return !(id==='level-up'&&owned.some(a=>a.definitionId==='max-cap'));
}
export function h12SelectionAllowed(state:Pick<MatchState,'augments'|'level'>,id:string):boolean {
 return h12OfferAllowed(id,state.augments,state.level);
}
/** A level-filtered offer also requires evidence when declined or filtered out.
 * Conditional v1 activation preserves every earlier/non-prismatic no-owner save. */
export function maxCapOfferNeedsHistory(state:Pick<MatchState,'augmentOffers'>):boolean {
 return state.augmentOffers?.some(r=>r.choiceId==='round:4-2:augment'&&r.tier==='prismatic')??false;
}
