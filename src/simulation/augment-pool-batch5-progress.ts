import { planCombatStreak } from './economy';
import type { MatchState } from './match-types';
import type { OwnedAugment } from './strategy-types';
import { AUGMENT_BATCH5 } from './content/augment-pool-batch5';
import { batch4RerollEntryGold } from './augment-pool-batch4-b4reroll-progress';
import { getMultiplayerRoundByOrdinal, getMultiplayerRoundById } from './multiplayer-round';
import { planAugmentGifts } from './augment-gift-plan';
import { grantMechanicGold } from './seat-mechanics/grants';
import { MATCH_RULES, OPENING_INITIAL_STATE, XP_TO_NEXT_LEVEL } from './match-rules';
import { readAugmentIncome } from './augment-income';
import { batch3EntryXp, xpPurchaseAmount } from './augment-xp';
import { augmentAcquisitionXpAtRound } from './choice-acquisition';
import { outcomeAcquisitionXp } from './augment-pool-batch3-progress';

export const BATCH5_SOURCE='augment-pool-batch5';
const totalXp=(level:number,xp:number)=>xp+Object.entries(XP_TO_NEXT_LEVEL).filter(([l])=>Number(l)<level).reduce((n,[,v])=>n+v,0);
/** Paid XP is the preparation XP delta, excluding every existing passive/acquisition source. At cap the last
 * purchase can truncate, so ceil is intentional. No separate client-writable counter or saved field. */
export function batch5XpPurchases(state:MatchState,round:number):number {
 const previous=state.roundResults.find(r=>r.round===round-1),result=state.roundResults.find(r=>r.round===round);
 const before=Math.min(totalXp(MATCH_RULES.maxLevel,0),(previous?totalXp(previous.levelAfter,previous.xpAfter):totalXp(OPENING_INITIAL_STATE.level,OPENING_INITIAL_STATE.xp))
  +readAugmentIncome(state.augments.filter(a=>a.acquiredRound<round)).roundXp+batch3EntryXp(state.augments,state.roundResults,round)
  +augmentAcquisitionXpAtRound(state.augments,round)+state.augments.filter(a=>a.acquiredRound===round).reduce((n,a)=>n+outcomeAcquisitionXp(state,a),0));
 const after=result?totalXp(result.levelBefore,result.xpBefore):totalXp(state.level,state.xp);
 return Math.max(0,Math.ceil((after-before)/xpPurchaseAmount(state.augments,round)));
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
function goldPlan(state:MatchState) {
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
export function validateBatch5Gold(state:MatchState):void {
 if(state.augments.some(a=>a.definitionId==='called-shot')){
  let streak:MatchState['streak']={kind:null,count:0};
  const same=(a:MatchState['streak'],b:MatchState['streak'])=>a?.kind===b?.kind&&a?.count===b?.count;
  for(const r of state.roundResults){
   streak=batch5Streak(state,r.round,streak);
   if(!same(r.streakBefore,streak))throw new RangeError('Invalid batch5 streak authority');
   streak=planCombatStreak(streak,r.result==='supply'?null:r.result).streakAfter;
   if(!same(r.streakAfter,streak))throw new RangeError('Invalid batch5 streak authority');
  }
  if(!state.roundResults.some(r=>r.round===state.round))streak=batch5Streak(state,state.round,streak);
  if(!same(state.streak,streak))throw new RangeError('Invalid batch5 streak authority');
 }
 const plan=goldPlan(state),actual=(state.seatMechanics?.receipts??[]).filter(r=>r.source===BATCH5_SOURCE||r.receiptId.startsWith(`["${BATCH5_SOURCE}",`));
 if(actual.length!==plan.length||new Set(actual.map(r=>r.receiptId)).size!==actual.length)throw new RangeError('Invalid batch5 gold authority');
 for(const r of actual){const p=plan.find(p=>p.receiptId===r.receiptId);if(!p||r.kind!=='gold'||r.source!==p.source||r.round!==p.round||r.amount!==p.amount)throw new RangeError('Invalid batch5 gold authority');}
 // Structural lower bound: each successful XP purchase contributes a generation beside other refreshes.
 const purchases=state.augments.filter(a=>a.definitionId==='dual-purpose').reduce((n,a)=>{for(let r=a.acquiredRound;r<=state.round;r++)n+=batch5XpPurchases(state,r);return n;},0);
 if(purchases>state.shop.generation)throw new RangeError('Invalid batch5 shop generation');
}
