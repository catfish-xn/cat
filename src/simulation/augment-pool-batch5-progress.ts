import { atWhatCostHistoricalXp } from './augment-pool-batch5-s1b';
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
import { grantXp } from './progression';
import { resolveRoundEconomy } from './round-economy';
import { batch4B4xpRecordedExtra } from './augment-pool-batch4-b4xp-progress';

export const BATCH5_SOURCE='augment-pool-batch5';
const totalXp=(level:number,xp:number)=>xp+Object.entries(XP_TO_NEXT_LEVEL).filter(([l])=>Number(l)<level).reduce((n,[,v])=>n+v,0);
/** Successful owned purchases, including combat/choice/settlement; never infer purchases from free XP. */
export function batch5XpPurchases(state:MatchState,round:number):number {
 return state.resourceProvenance.entries.filter(e=>e.kind==='dual-purpose-xp-purchased'&&getMultiplayerRoundById(e.roundId).ordinal===round).length;
}
/** Authenticate the ordered facts against acquisition, every pre/post-settlement XP boundary and the live XP.
 * RoundResult remains immutable. Settlement rewards are applied once between the two purchase segments; the next
 * entry starts from the purchased settlement XP, so it cannot be misattributed to the next round's preparation. */
function validateXpPurchases(state:MatchState):void {
 const fail=()=>{throw new RangeError('Invalid batch5 XP authority');};
 const checkedXp=(level:number,xp:number)=>{grantXp(level,xp,0);return totalXp(level,xp);};
 const cap=totalXp(MATCH_RULES.maxLevel,0),owner=state.augments.find(a=>a.definitionId==='dual-purpose');
 const facts=state.resourceProvenance.entries.filter(e=>e.kind==='dual-purpose-selected'||e.kind==='dual-purpose-xp-purchased');
 if(!owner){if(facts.length)fail();return;}
 const markers=facts.filter(e=>e.kind==='dual-purpose-selected');
 if(markers.length!==1)fail();
 const marker=markers[0];
 if(marker.choiceId!==owner.choiceId||getMultiplayerRoundById(marker.roundId).ordinal!==owner.acquiredRound
   ||!state.scheduleReceipts.some(r=>r.kind==='augment'&&r.eventId===owner.choiceId&&r.definitionId==='dual-purpose'&&r.round===owner.acquiredRound))fail();
 const purchases=facts.filter(e=>e.kind==='dual-purpose-xp-purchased');
 let generation=0,sequence=marker.sequence,lastRound=owner.acquiredRound;
 for(const e of facts){
  const keys=e.kind==='dual-purpose-selected'?['kind','sequence','roundId','choiceId','level','xp']:['kind','sequence','roundId','levelBefore','xpBefore','generation','settled'];
  if(Object.keys(e).length!==keys.length||Object.keys(e).some(k=>!keys.includes(k)))fail();
  if(!Number.isSafeInteger(e.sequence)||state.resourceProvenance.entries[e.sequence]!==e)fail();
 }
 for(const e of purchases){
  const round=getMultiplayerRoundById(e.roundId).ordinal;
  if(e.sequence<=sequence||round<lastRound||round>state.round||typeof e.settled!=='boolean'
    ||!Number.isSafeInteger(e.generation)||e.generation<=generation||e.generation>state.shop.generation)fail();
  if(checkedXp(e.levelBefore,e.xpBefore)>=cap)fail();
  generation=e.generation;sequence=e.sequence;lastRound=round;
 }
 const acquisitionXp=(round:number)=>atWhatCostHistoricalXp(state,round)+augmentAcquisitionXpAtRound(state.augments,round)
  +state.augments.filter(a=>a.acquiredRound===round).reduce((n,a)=>n+outcomeAcquisitionXp(state,a),0);
 const entryXp=(round:number)=>readAugmentIncome(state.augments.filter(a=>a.acquiredRound<round)).roundXp+batch3EntryXp(state.augments,state.roundResults,round);
 const previous=state.roundResults.find(r=>r.round===owner.acquiredRound-1);
 const baseline=Math.min(cap,(previous?checkedXp(previous.levelAfter,previous.xpAfter):totalXp(OPENING_INITIAL_STATE.level,OPENING_INITIAL_STATE.xp))+entryXp(owner.acquiredRound)+acquisitionXp(owner.acquiredRound));
 let cursor=checkedXp(marker.level,marker.xp);
 // Online purchases before the pick are legal, but do not trigger an augment not yet owned.
 if(cursor<baseline||(cursor!==cap&&(cursor-baseline)%xpPurchaseAmount(state.augments,owner.acquiredRound)!==0))fail();
 for(let round=owner.acquiredRound;round<=state.round;round++){
  const result=state.roundResults.find(r=>r.round===round),rows=purchases.filter(e=>getMultiplayerRoundById(e.roundId).ordinal===round);
  let acquired=0;
  if(round>owner.acquiredRound){cursor=Math.min(cap,cursor+entryXp(round));acquired=acquisitionXp(round);}
  const before=rows.filter(e=>!e.settled),after=rows.filter(e=>e.settled),amount=xpPurchaseAmount(state.augments,round);
  if(after.length&&(!result||before.some(e=>e.sequence>after[0].sequence)))fail();
  for(const e of before){
   const xp=checkedXp(e.levelBefore,e.xpBefore);
   // A later augment's acquisition XP can arrive between online commands while its choice stays open.
   if(xp<cursor||xp>Math.min(cap,cursor+acquired))fail();
   acquired-=xp-cursor;cursor=Math.min(cap,xp+amount);
  }
  cursor=Math.min(cap,cursor+acquired);
  if(result){
   if(cursor!==checkedXp(result.levelBefore,result.xpBefore))fail();
   const economy=resolveRoundEconomy({augments:state.augments.filter(a=>a.acquiredRound<=round),roundId:result.roundId,
    result:result.result==='supply'?null:result.result,gold:result.goldBefore,streak:result.streakBefore,
    level:result.levelBefore,xp:result.xpBefore,hp:result.hpBefore,enemySurvivors:result.survivingEnemyCount});
   // Ordinary XP is rule-derived; conditional bench/item XP must match an owned reward subset.
   // Offline restoration additionally replays those historical conditions through the existing batch4 path.
   batch4B4xpRecordedExtra(state,result,economy.progression.xpRequested);
   const settled=grantXp(result.levelBefore,result.xpBefore,result.xpRequested);
   if(settled.level!==result.levelAfter||settled.xp!==result.xpAfter||settled.xpApplied!==result.xpAwarded)fail();
   cursor=checkedXp(result.levelAfter,result.xpAfter);
   for(const e of after){if(checkedXp(e.levelBefore,e.xpBefore)!==cursor)fail();cursor=Math.min(cap,cursor+amount);}
  }
 }
 if(cursor!==checkedXp(state.level,state.xp))fail();
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
 validateXpPurchases(state);
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
