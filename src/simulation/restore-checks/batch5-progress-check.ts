// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { requireAugmentFacts } from '../augment-history';
import { readAugmentIncome } from '../augment-income';
import { outcomeAcquisitionXp } from '../augment-pool-batch3-progress';
import { batch4B4xpRecordedExtra } from '../augment-pool-batch4-b4xp-progress';
import { augmentLevelCap } from '../augment-pool-batch5-h12-progression';
import { BATCH5_SOURCE, batch5Streak, batch5XpPurchases, goldPlan } from '../augment-pool-batch5-progress';
import { atWhatCostHistoricalXp } from '../augment-pool-batch5-s1b';
import { batch3EntryXp, xpPurchaseAmount } from '../augment-xp';
import { augmentAcquisitionXpAtRound } from '../choice-acquisition';
import { planCombatStreak } from '../economy';
import { MATCH_RULES, OPENING_INITIAL_STATE, XP_TO_NEXT_LEVEL } from '../match-rules';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundById } from '../multiplayer-round';
import { grantXp } from '../progression';
import { resolveRoundEconomy } from '../round-economy';

const totalXp=(level:number,xp:number)=>xp+Object.entries(XP_TO_NEXT_LEVEL).filter(([l])=>Number(l)<level).reduce((n,[,v])=>n+v,0);

/** Authenticate the ordered facts against acquisition, every pre/post-settlement XP boundary and the live XP.
 * RoundResult remains immutable. Settlement rewards are applied once between the two purchase segments; the next
 * entry starts from the purchased settlement XP, so it cannot be misattributed to the next round's preparation. */
function validateXpPurchases(state:MatchState):void {
 const fail=()=>{throw new RangeError('Invalid batch5 XP authority');};
 const checkedXp=(level:number,xp:number)=>{grantXp(level,xp,0);return totalXp(level,xp);};
 let cap=totalXp(MATCH_RULES.maxLevel,0);const owner=state.augments.find(a=>a.definitionId==='dual-purpose');
 const facts=state.resourceProvenance.entries.filter(e=>e.kind==='dual-purpose-selected'||e.kind==='dual-purpose-xp-purchased');
 if(!owner){if(facts.length)fail();return;}
 const markers=facts.filter(e=>e.kind==='dual-purpose-selected');
 if(markers.length!==1)fail();
 const marker=markers[0];
 if(marker.choiceId!==owner.choiceId||getMultiplayerRoundById(marker.roundId).ordinal!==owner.acquiredRound
   ||!state.scheduleReceipts.some(r=>r.kind==='augment'&&r.eventId===owner.choiceId&&r.definitionId==='dual-purpose'&&r.round===owner.acquiredRound))fail();
 const purchases=facts.filter(e=>e.kind==='dual-purpose-xp-purchased');
 const capOwner=state.augments.find(a=>a.definitionId==='max-cap');
 const capAcquisition=capOwner?requireAugmentFacts(state,'acquire',capOwner.acquiredRound).find(f=>f.choiceId===capOwner.choiceId):undefined;
 if(capOwner&&!capAcquisition)fail();
 // Online XP purchases while the 4-2 offer is still pending precede the cap's acquisition.
 const purchaseCap=(round:number,sequence:number)=>augmentLevelCap(state.augments,
  capAcquisition?.round===round&&sequence<capAcquisition.resourcePrefix?round-1:round);
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
  if(checkedXp(e.levelBefore,e.xpBefore)>=totalXp(purchaseCap(round,e.sequence),0))fail();
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
  cap=totalXp(augmentLevelCap(state.augments,round-1),0);cursor=Math.min(cursor,cap);
  const result=state.roundResults.find(r=>r.round===round),rows=purchases.filter(e=>getMultiplayerRoundById(e.roundId).ordinal===round);
  let acquired=0;
  if(round>owner.acquiredRound){cursor=Math.min(cap,cursor+entryXp(round));acquired=acquisitionXp(round);}
  const before=rows.filter(e=>!e.settled),after=rows.filter(e=>e.settled),amount=xpPurchaseAmount(state.augments,round);
  if(after.length&&(!result||before.some(e=>e.sequence>after[0].sequence)))fail();
  for(const e of before){
   cap=totalXp(purchaseCap(round,e.sequence),0);cursor=Math.min(cursor,cap);
   const xp=checkedXp(e.levelBefore,e.xpBefore);
   // A later augment's acquisition XP can arrive between online commands while its choice stays open.
   if(xp<cursor||xp>Math.min(cap,cursor+acquired))fail();
   acquired-=xp-cursor;cursor=Math.min(cap,xp+amount);
  }
  cap=totalXp(augmentLevelCap(state.augments,round),0);
  cursor=Math.min(cap,cursor+acquired);
  if(result){
   if(cursor!==checkedXp(result.levelBefore,result.xpBefore))fail();
   const economy=resolveRoundEconomy({augments:state.augments.filter(a=>a.acquiredRound<=round),roundId:result.roundId,
    result:result.result==='supply'?null:result.result,gold:result.goldBefore,streak:result.streakBefore,
    level:result.levelBefore,xp:result.xpBefore,hp:result.hpBefore,enemySurvivors:result.survivingEnemyCount});
   // Ordinary XP is rule-derived; conditional bench/item XP must match an owned reward subset.
   // Offline restoration additionally replays those historical conditions through the existing batch4 path.
   batch4B4xpRecordedExtra(state,result,economy.progression.xpRequested);
   const settled=grantXp(result.levelBefore,result.xpBefore,result.xpRequested,augmentLevelCap(state.augments,round));
   if(settled.level!==result.levelAfter||settled.xp!==result.xpAfter||settled.xpApplied!==result.xpAwarded)fail();
   cursor=checkedXp(result.levelAfter,result.xpAfter);
   for(const e of after){if(checkedXp(e.levelBefore,e.xpBefore)!==cursor)fail();cursor=Math.min(cap,cursor+amount);}
  }
 }
 if(cursor!==checkedXp(state.level,state.xp))fail();
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
