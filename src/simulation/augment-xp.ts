import { batch5S6cSettlementHealth } from './augment-pool-batch5-s6c';
import { AUGMENT_BATCH4 } from './content/augment-pool-batch4';
import type { MatchState, RoundResult } from './match-types';
import type { OwnedAugment } from './strategy-types';
import { AUGMENT_BATCH3_XP, batch3XpValue } from './content/augment-pool-batch3-xp';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { MATCH_RULES } from './match-rules';
import { grantXp } from './progression';
import { readSeatMechanic, writeSeatMechanic } from './seat-mechanics/state';

/** Owner-visible acquisition levels, `{choiceId: level}`, of the augments that count later level-ups. */
export const AUGMENT_ACQUISITION_LEVEL_KEY='augment-acquisition-levels';
type AcquisitionLevels=Readonly<Record<string,number>>;
const stageStart=(round:number)=>getMultiplayerRoundByOrdinal(round).subround===1;
const countsLevels=(a:OwnedAugment)=>{const row=AUGMENT_BATCH3_XP[a.definitionId];return !!AUGMENT_BATCH4[a.definitionId]||row?.levelUpRerolls!==undefined||row?.levelUpHealth!==undefined||row?.acquisitionHealthLoss!==undefined;};

/** XP granted on entering `round`, beside the passive round XP. Derived only from owned augments and settled history:
 * Epoch at each stage start after acquisition; Patient Study for the previous round's player combat if it was fought
 * on or after acquisition (P: paid at this entry; a draw is a loss, as for streaks). */
export function batch3EntryXp(augments:readonly OwnedAugment[],history:readonly Pick<RoundResult,'round'|'roundKind'|'result'>[],round:number):number {
 let xp=0;
 for(const a of augments){
  const row=AUGMENT_BATCH3_XP[a.definitionId];if(!row||a.acquiredRound>=round)continue;
  if(row.stageXp&&stageStart(round))xp+=batch3XpValue(a.definitionId,row.stageXp);
  const fought=history.find(r=>r.round===round-1);
  if(row.pvpXp&&fought&&fought.roundKind==='pvp'&&fought.round>=a.acquiredRound)
   xp+=batch3XpValue(a.definitionId,fought.result==='playerWin'?row.pvpXp.win:row.pvpXp.loss);
 }
 return xp;
}
/** XP from one purchase in `round`; Level Up! counts from its acquisition round (offline acquisition precedes any purchase). */
export function xpPurchaseAmount(augments:readonly OwnedAugment[],round:number):number {
 return augments.reduce<number>((sum,a)=>{const row=AUGMENT_BATCH3_XP[a.definitionId];return sum+(row?.purchaseXp&&a.acquiredRound<=round?batch3XpValue(a.definitionId,row.purchaseXp):0);},MATCH_RULES.xpPurchaseAmount);
}
export function acquisitionLevels(state:Pick<MatchState,'seatMechanics'>):AcquisitionLevels {
 return readSeatMechanic<AcquisitionLevels>(state,AUGMENT_ACQUISITION_LEVEL_KEY)??{};
}
/** Record the level right after a newly selected augment's own acquisition XP. */
export function recordAcquisitionLevel(state:MatchState,a:OwnedAugment):MatchState {
 if(!countsLevels(a))return state;
 return writeSeatMechanic(state,AUGMENT_ACQUISITION_LEVEL_KEY,{...acquisitionLevels(state),[a.choiceId]:state.level});
}
/** Free rerolls from this batch: Epoch now and at each later stage start; Shopping Spree the new level at every level-up. */
export function batch3XpFreeRerolls(state:Pick<MatchState,'augments'|'round'|'level'|'seatMechanics'>):number {
 const levels=acquisitionLevels(state);let credits=0;
 for(const a of state.augments){
  const row=AUGMENT_BATCH3_XP[a.definitionId];if(!row)continue;
  if(row.stageRerolls){
   const per=batch3XpValue(a.definitionId,row.stageRerolls);credits+=per;
   for(let round=a.acquiredRound+1;round<=state.round;round++)if(stageStart(round))credits+=per;
  }
  if(row.levelUpRerolls){
   const from=levels[a.choiceId]??state.level;
   for(let level=from+1;level<=state.level;level++)credits+=row.levelUpRerolls==='level'?level:batch3XpValue(a.definitionId,row.levelUpRerolls);
  }
 }
 return credits;
}
/** Gold for one XP purchase; Upward Mobility counts from its acquisition round. */
export function xpPurchaseCost(augments:readonly OwnedAugment[],round:number):number {
 return Math.max(0,augments.reduce<number>((cost,a)=>cost-(a.acquiredRound<=round?AUGMENT_BATCH3_XP[a.definitionId]?.xpCostReduction??0:0),MATCH_RULES.xpPurchaseCost));
}
const healthPerLevel=(a:OwnedAugment)=>{const key=AUGMENT_BATCH3_XP[a.definitionId]?.levelUpHealth;return key?batch3XpValue(a.definitionId,key):0;};
const heal=(hp:number,amount:number)=>hp>0&&amount>0?Math.min(MATCH_RULES.initialHp,hp+amount):hp;
/** Upward Mobility: a living player heals per level gained from `before` to `after` (P: capped at 100). */
export function applyLevelUpHealth(before:Pick<MatchState,'level'>,after:MatchState):MatchState {
 const amount=after.augments.reduce((n,a)=>n+healthPerLevel(a),0)*Math.max(0,after.level-before.level);
 const playerHp=heal(after.playerHp,amount);
 return playerHp===after.playerHp?after:{...after,playerHp};
}
/** Restore: level-up health during round `round`'s settlement (settlement XP), applied to the settled HP. */
export function settlementLevelUpHealth(state:MatchState,round:number,hp:number):number {
 const result=state.roundResults.find(r=>r.round===round);if(!result)return hp;
 return batch5S6cSettlementHealth(state,round,heal(hp,state.augments.filter(a=>a.acquiredRound<=round).reduce((n,a)=>n+healthPerLevel(a),0)*(result.levelAfter-result.levelBefore)));
}
/** Restore: level-up health from the previous settlement to round `round`'s battle (entry XP, acquisition XP, purchases).
 * Levels before an acquisition in this round never heal: offline, the recorded level is the round-entry level. */
export function preparationLevelUpHealth(state:MatchState,round:number,hp:number,segment:{readonly from?:number;readonly to?:number}={}):number {
 const result=state.roundResults.find(r=>r.round===round),end=result?.levelBefore??(state.round===round?state.level:undefined);
 if(end===undefined)return hp;
 const start=state.roundResults.find(r=>r.round===round-1)?.levelAfter??MATCH_RULES.initialLevel,levels=acquisitionLevels(state);
 return heal(hp,state.augments.reduce((n,a)=>{
  if(a.acquiredRound>round||!healthPerLevel(a))return n;
  const low=Math.max(a.acquiredRound===round?levels[a.choiceId]??end:start,segment.from??-Infinity),high=Math.min(end,segment.to??Infinity);
  return n+healthPerLevel(a)*Math.max(0,high-low);
 },0));
}
/** Risky Moves: health lost on selection, never below 1 (P), never to a player already at 0. */
export function applyAcquisitionHealthLoss(state:MatchState,a:OwnedAugment):MatchState {
 const key=AUGMENT_BATCH3_XP[a.definitionId]?.acquisitionHealthLoss;
 if(!key||state.playerHp<=0)return state;
 return {...state,playerHp:Math.max(1,state.playerHp-batch3XpValue(a.definitionId,key))};
}
/** Restore: the Risky Moves selection inside round `round`'s preparation, as the level reached at that point and the loss. */
export function preparationHealthLoss(state:MatchState,round:number):{readonly level:number;readonly augment:OwnedAugment}|undefined {
 const levels=acquisitionLevels(state);
 const a=state.augments.find(a=>a.acquiredRound===round&&AUGMENT_BATCH3_XP[a.definitionId]?.acquisitionHealthLoss);
 return a&&Object.hasOwn(levels,a.choiceId)?{level:levels[a.choiceId],augment:a}:undefined;
}
/** Level reached by `total` experience from level 1. */
export function levelAtExperience(total:number):number {
 return grantXp(1,0,total).level;
}
/** Shape and bounds; the offline chain additionally checks each value against its acquisition round entry. */
export function validateAcquisitionLevels(state:MatchState):void {
 const raw=state.seatMechanics?.seat[AUGMENT_ACQUISITION_LEVEL_KEY],owners=state.augments.filter(countsLevels);
 if(raw===undefined&&!owners.length)return;
 const fail=()=>{throw new RangeError('Invalid augment acquisition levels');};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail();
 const levels=raw as AcquisitionLevels;
 if(Object.keys(levels).sort().join('\n')!==owners.map(a=>a.choiceId).sort().join('\n'))fail();
 for(const a of owners){const level=levels[a.choiceId];if(!Number.isSafeInteger(level)||level<1||level>state.level)fail();}
}
