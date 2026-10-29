
import type { MatchState } from './match-types';
import type { OwnedAugment } from './strategy-types';
import { AUGMENT_BATCH5 } from './content/augment-pool-batch5';
import { batch4RerollEntryGold } from './augment-pool-batch4-b4reroll-progress';
import { getMultiplayerRoundByOrdinal, getMultiplayerRoundById } from './multiplayer-round';
import { planAugmentGifts } from './augment-gift-plan';
import { grantMechanicGold } from './seat-mechanics/grants';

export const BATCH5_SOURCE='augment-pool-batch5';

/** Successful owned purchases, including combat/choice/settlement; never infer purchases from free XP. */
export function batch5XpPurchases(state:MatchState,round:number):number {
 return state.resourceProvenance.entries.filter(e=>e.kind==='dual-purpose-xp-purchased'&&getMultiplayerRoundById(e.roundId).ordinal===round).length;
}

/** Only genuine component-combination facts create credits. Receipt/loot grants and reforges never do. */
export function batch5RerollsGranted(state:MatchState):number {
 const a=state.augments.find(a=>a.definitionId==='crafted-crafting');if(!a)return 0;
 return state.resourceProvenance.entries.filter(e=>e.kind==='item-combined'&&getMultiplayerRoundById(e.roundId).ordinal>=a.acquiredRound&&getMultiplayerRoundById(e.roundId).ordinal<=state.round).length*AUGMENT_BATCH5[a.definitionId].source.values.Rerolls!;
}
/** Called Shot overwrites, including a prior winning streak above four. */
export function batch5Streak(state:Pick<MatchState,'augments'>,round:number,streak:MatchState['streak']):MatchState['streak'] {
 return state.augments.some(a=>a.definitionId==='called-shot'&&a.acquiredRound===round)?{kind:'win',count:AUGMENT_BATCH5['called-shot'].source.values.Streak!}:streak;
}
/** P-B5: round entry means the existing pre-entry-grant bank; acquisition never retroactively qualifies its entry.
 * A PvP victory in the selection round does qualify. Both conditions persist, in either order. */
export function batch5FateRound(state:MatchState,a:OwnedAugment):number|undefined {
 let bank:number|undefined;
 for(let round=a.acquiredRound+1;round<=state.round;round++)if(batch4RerollEntryGold(state,round)>=AUGMENT_BATCH5[a.definitionId].source.values.RoundGold!){bank=round;break;}
 const win=state.roundResults.find(r=>r.round>=a.acquiredRound&&r.roundKind==='pvp'&&r.result==='playerWin')?.round;
 return bank!==undefined&&win!==undefined?Math.max(bank,win):undefined;
}
export function batch5RewardPlan(state:MatchState) {
 return state.augments.flatMap(a=>{
  if(a.definitionId!=='a-change-of-fate')return [];
  const due=batch5FateRound(state,a);if(due===undefined)return [];
  const owner=(round:number,part:string)=>({...a,choiceId:JSON.stringify([a.choiceId,'batch5-fate',part]),acquiredRound:round});
  let unitRound=due;while(getMultiplayerRoundByOrdinal(unitRound).kind==='supply')unitRound++;
  return [...planAugmentGifts(state,owner(due,'item'),[{kind:'item',definitionId:'gunblade'}]),
   ...(unitRound<=state.round?planAugmentGifts(state,owner(unitRound,'unit'),[{kind:'unit',definitionId:'mel'}]):[])];
 });
}
export function goldPlan(state:MatchState) {
 return state.augments.flatMap(a=>{
  if(a.definitionId!=='dual-purpose')return [];
  const plan=[];
  for(let round=a.acquiredRound;round<=state.round;round++)if(batch5XpPurchases(state,round)>0)plan.push({receiptId:JSON.stringify([BATCH5_SOURCE,a.choiceId,round]),source:BATCH5_SOURCE,round,amount:AUGMENT_BATCH5[a.definitionId].source.values.goldtogive!});
  return plan;
 });
}
export function drainBatch5Gold(initial:MatchState):MatchState {
 let state=initial;
 for(const p of goldPlan(state))if(!state.seatMechanics?.receipts.some(r=>r.receiptId===p.receiptId)){
  const granted=grantMechanicGold(state,p);if(!granted.ok)throw new RangeError(granted.reason);state=granted.state;
 }
 return state;
}

