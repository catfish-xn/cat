import { canonicalContent } from './content';
import { getCatalogRoundById } from './round-selectors';
import type { MatchState, MatchEvent } from './match-types';
import { G24_FORGE_POLICY, resolveG24ForgePool } from './content/g2-4-forges';
import { sampleG24Reward } from './g2-3-rewards';
import { openMechanicChoice } from './seat-mechanics/choices';
import { grantMechanicItem } from './seat-mechanics/grants';
export const EPIC_REWARD_NAMES = Object.freeze({TFT_ArmoryKeyCompleted:'成装锻造器',TFT_ArmoryKeyComponent:'基础装备锻造器',TFT_ArmoryKeySupport:'辅助装锻造器',TFT_ArmoryKeyOrnn:'神器装备锻造器',TFT_Item_ForceOfNature:'金铲铲冠冕'});
export const epicForgeId=(receiptId:string)=>JSON.stringify(['epic-forge',receiptId]);
export function epicForgeOffers(seed:number,receiptId:string,selector:string):readonly string[]{
  return sampleG24Reward(resolveG24ForgePool(selector),`${seed}:${epicForgeId(receiptId)}`,G24_FORGE_POLICY.choices);
}
export function pendingEpicForges(state:MatchState){
  return state.m8.loot.receipts.filter(r=>r.payload.kind==='forge'&&r.resolution!=='forfeited'
    &&!state.seatMechanics?.receipts.some(m=>m.receiptId===epicForgeId(r.receiptId)));
}
export function openEpicForge(state:MatchState):{state:MatchState;events:readonly MatchEvent[]}{
  if(state.pendingChoice||!['preparation','settlement'].includes(state.phase)||state.m8.round.kind==='supply')return {state,events:[]};
  const receipt=pendingEpicForges(state)[0];if(!receipt||receipt.payload.kind!=='forge')return {state,events:[]};
  const offers=epicForgeOffers(state.seed,receipt.receiptId,receipt.payload.definitionId);
  const opened=openMechanicChoice(state,{choiceId:epicForgeId(receipt.receiptId),offers,returnPhase:state.phase as 'preparation'|'settlement',payload:{kind:'forge',source:'epic-loot',timeoutOption:offers[0]}});
  if(!opened.ok)throw new RangeError('Invalid epic forge entry');return opened;
}
/** A terminal solo round cannot open a popup. Retain the existing first-offer terminal policy. */
export function settleTerminalEpicForges(initial:MatchState):{state:MatchState;events:MatchEvent[]}{
  let state=initial;const events:MatchEvent[]=[];
  if(state.phase!=='gameOver'||state.multiplayer)return {state,events};
  for(const r of pendingEpicForges(state)){
    if(r.payload.kind!=='forge')continue;
    const grant=grantMechanicItem(state,{receiptId:epicForgeId(r.receiptId),source:'epic-loot',definitionId:epicForgeOffers(state.seed,r.receiptId,r.payload.definitionId)[0]});
    if(!grant.ok)throw new RangeError('Invalid terminal epic forge');state=grant.state;events.push(...grant.events);
  }
  return {state,events};
}
export function validateEpicForges(state:MatchState):void{
  const check=(ok:unknown)=>{if(!ok)throw new RangeError('Invalid epic forge receipt');};
  const choice=state.pendingChoice;
  if(choice&&(choice.payload?.source==='epic-loot'||choice.choiceId.startsWith('["epic-forge",'))){
    const expected=openEpicForge({...state,phase:choice.returnPhase,pendingChoice:null} as MatchState).state.pendingChoice;
    check(expected&&canonicalContent(expected)===canonicalContent(choice));
  }
  if(state.phase==='gameOver'&&!state.multiplayer)check(pendingEpicForges(state).length===0);
  for(const m of state.seatMechanics?.receipts??[])if(m.source==='epic-loot'||m.receiptId.startsWith('["epic-forge",')){
    const r=state.m8.loot.receipts.find(r=>epicForgeId(r.receiptId)===m.receiptId);
    check(r&&r.payload.kind==='forge'&&r.resolution!=='forfeited');if(!r||r.payload.kind!=='forge')continue;
    const offers=epicForgeOffers(state.seed,r.receiptId,r.payload.definitionId);
    check(m.source==='epic-loot'&&m.round>=getCatalogRoundById(r.claimedRoundId??JSON.parse(JSON.parse(r.dropId)[0])[1]).ordinal);
    check(m.kind==='choice'?m.choiceKind==='forge'&&!m.skipped&&m.price===0&&offers.includes(m.optionId)&&(!m.timedOut||m.optionId===offers[0]):m.kind==='item'&&state.phase==='gameOver'&&m.definitionId===offers[0]);
  }
}
