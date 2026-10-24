import type { MatchState } from './match-types';
import { AUGMENT_BATCH3_XP, batch3XpValue } from './content/augment-pool-batch3-xp';
import { grantMechanicGold } from './seat-mechanics/grants';

export const KINGSLAYER_SOURCE='augment-kingslayer';
const owners=(state:Pick<MatchState,'augments'>)=>state.augments.filter(a=>AUGMENT_BATCH3_XP[a.definitionId]?.kingslayer);
/** Whether a seat settling `round` must carry the opponent's health on its trusted settlement receipt. */
export function needsOpponentHp(augments:MatchState['augments'],round:number):boolean {
 return augments.some(a=>AUGMENT_BATCH3_XP[a.definitionId]?.kingslayer&&a.acquiredRound<=round);
}
/** One gold receipt per player-combat win from the acquisition round on. The opponent's health comes only from the
 * room's settlement receipt (frozen battle snapshot); an offline opponent is not a player and never counts as higher. */
function plan(state:MatchState) {
 return owners(state).flatMap(a=>{
  const row=AUGMENT_BATCH3_XP[a.definitionId].kingslayer!;
  return state.roundResults.filter(r=>r.roundKind==='pvp'&&r.result==='playerWin'&&r.round>=a.acquiredRound).map(r=>{
   const opponentHp=state.multiplayer?.receipts.find(x=>x.round===r.round)?.opponentHp;
   const amount=batch3XpValue(a.definitionId,opponentHp!==undefined&&opponentHp>r.hpBefore?row.bonus:row.win);
   return {receiptId:JSON.stringify([KINGSLAYER_SOURCE,a.choiceId,r.round]),source:KINGSLAYER_SOURCE,amount,round:r.round};
  });
 });
}
export function drainKingslayerGold(initial:MatchState):MatchState {
 let state=initial;
 for(const p of plan(state)){
  if(state.seatMechanics?.receipts.some(r=>r.receiptId===p.receiptId))continue;
  const result=grantMechanicGold(state,p);if(!result.ok)throw new RangeError(result.reason);state=result.state;
 }
 return state;
}
export function validateKingslayerGold(state:MatchState):void {
 const expected=plan(state),receipts=state.seatMechanics?.receipts??[];
 for(const r of receipts.filter(r=>r.source===KINGSLAYER_SOURCE||r.receiptId.startsWith(`["${KINGSLAYER_SOURCE}",`))){
  const p=expected.find(p=>p.receiptId===r.receiptId);
  if(!p||r.kind!=='gold'||r.source!==p.source||r.amount!==p.amount||r.round!==p.round)throw new RangeError('Invalid Kingslayer gold authority');
 }
 for(const p of expected)if(!receipts.some(r=>r.receiptId===p.receiptId))throw new RangeError('Missing Kingslayer gold receipt');
}
