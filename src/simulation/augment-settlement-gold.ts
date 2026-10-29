import type { MatchState } from './match-types';
import { AUGMENT_BATCH3_XP, batch3XpValue } from './content/augment-pool-batch3-xp';
import { grantMechanicGold } from './seat-mechanics/grants';

export const KINGSLAYER_SOURCE='augment-kingslayer';
export const RISKY_MOVES_SOURCE='augment-risky-moves';
const owners=(state:Pick<MatchState,'augments'>)=>state.augments.filter(a=>AUGMENT_BATCH3_XP[a.definitionId]?.kingslayer);
/** Whether a seat settling `round` must carry the opponent's health on its trusted settlement receipt. */
export function needsOpponentHp(augments:MatchState['augments'],round:number):boolean {
 return augments.some(a=>AUGMENT_BATCH3_XP[a.definitionId]?.kingslayer&&a.acquiredRound<=round);
}
/** Settlement gold derived from settled history only.
 * Kingslayer: one receipt per player-combat win from the acquisition round on. The opponent's health comes only from the
 * room's settlement receipt (frozen battle snapshot); an offline opponent is not a player and never counts as higher.
 * Risky Moves: one receipt at the settlement of the PlayerCombatNum-th player combat (any result) from the acquisition round. */
export function plan(state:MatchState) {
 const risky=state.augments.flatMap(a=>{
  const row=AUGMENT_BATCH3_XP[a.definitionId]?.pvpCombatGold;if(!row)return [];
  const due=state.roundResults.filter(r=>r.roundKind==='pvp'&&r.round>=a.acquiredRound)[batch3XpValue(a.definitionId,row.combats)-1];
  return due?[{receiptId:JSON.stringify([RISKY_MOVES_SOURCE,a.choiceId]),source:RISKY_MOVES_SOURCE,amount:batch3XpValue(a.definitionId,row.gold),round:due.round}]:[];
 });
 return risky.concat(owners(state).flatMap(a=>{
  const row=AUGMENT_BATCH3_XP[a.definitionId].kingslayer!;
  return state.roundResults.filter(r=>r.roundKind==='pvp'&&r.result==='playerWin'&&r.round>=a.acquiredRound).map(r=>{
   const opponentHp=state.multiplayer?.receipts.find(x=>x.round===r.round)?.opponentHp;
   const amount=batch3XpValue(a.definitionId,opponentHp!==undefined&&opponentHp>r.hpBefore?row.bonus:row.win);
   return {receiptId:JSON.stringify([KINGSLAYER_SOURCE,a.choiceId,r.round]),source:KINGSLAYER_SOURCE,amount,round:r.round};
  });
 }));
}
export function drainSettlementGold(initial:MatchState):MatchState {
 let state=initial;
 for(const p of plan(state)){
  if(state.seatMechanics?.receipts.some(r=>r.receiptId===p.receiptId))continue;
  const result=grantMechanicGold(state,p);if(!result.ok)throw new RangeError(result.reason);state=result.state;
 }
 return state;
}

