// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { G23_CONQUEROR_CHESTS, g23ConquerorReward } from '../content/g2-3-policy';
import { canonicalContent } from '../content/index';
import { type G23MatchProgress, replayG23Economy } from '../g2-3-match-progress';
import { g23RewardAtoms } from '../g2-3-rewards';
import { g23SoloFacts } from '../g2-3-settlement';
import { readG23Progress } from '../g2-3-state';
import { rememberG23Sources, reusedG23Sources } from '../g23-restore-reuse';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundByOrdinal } from '../multiplayer-round';
import { UNIT_DEFINITIONS } from '../units';

/** Generic receipts authorize every grant; internal selectors can never mint a second resource birth. */
export function validateG23MechanicLinks(state:MatchState):void{
 const p=readG23Progress(state);if(!p)throw new RangeError('Missing G23 mechanics');
 const check=(v:unknown)=>{if(!v)throw new RangeError('Invalid G23 mechanic receipt link');};
 const receipts=state.seatMechanics!.receipts;
 const expectedGold=new Map<string,{amount:number;round:number;source:string}>();
 for(const action of p.economyReceipts)if(action.kind==='battle'){
  for(const payout of action.facts.itemGoldPayouts??[]){check(!expectedGold.has(payout.receiptId));expectedGold.set(payout.receiptId,{amount:payout.amount,round:action.facts.round,source:payout.source});}
  if(action.facts.highRollerGold)expectedGold.set(`g23:high-roller:${action.facts.battleId}`,{amount:action.facts.highRollerGold,round:action.facts.round,source:'high-roller'});
  if(action.crownGold)expectedGold.set(`g23:crown:${action.facts.battleId}`,{amount:action.crownGold,round:action.facts.round,source:'tacticians-crown'});
  for(const bundleId of action.bundles.filter(id=>id.startsWith('g23:conqueror:'))){
   const chest=G23_CONQUEROR_CHESTS[Number(bundleId.split(':').at(-1))-1],amount=Number(g23ConquerorReward(chest).Gold??0);
   if(amount)expectedGold.set(`${bundleId}:gold`,{amount,round:action.facts.round,source:'conqueror-chest'});
  }
 }
 for(const [id,expected] of expectedGold){const r=receipts.find(r=>r.receiptId===id);check(r?.kind==='gold'&&r.amount===expected.amount&&r.round===expected.round&&r.source===expected.source);}
 for(const claim of p.rewardClaims){
  const r=receipts.find(r=>r.receiptId===claim.id);check(r&&r.round===claim.round);
  if(!r)continue;
  const bundle=p.rewards.find(b=>b.id===claim.bundleId)!,atom=g23RewardAtoms(bundle,p.seed,!!state.multiplayer).find(a=>a.id===claim.atomId)!;
  check(r.source===bundle.source);
  if(claim.kind==='anvil')check(r.kind==='unit'&&r.definitionId===atom.forgeDefinitionId&&r.resolution==='held'&&r.gold===0);
  else if(claim.kind==='item'){
   if(atom.options.length>1)check(r.kind==='choice'&&r.choiceKind==='forge'&&r.optionId===claim.definitionId&&r.itemId!==null&&r.itemId===claim.instanceId
    &&!r.skipped&&r.price===0&&(!r.timedOut||r.optionId===atom.options[0]));
   else check(r.kind==='item'&&r.definitionId===claim.definitionId&&r.itemId===claim.instanceId);
  }
  else if(claim.kind==='unit'||claim.kind==='duplicator')check(r.kind==='unit'&&r.definitionId===claim.definitionId&&r.unitId===claim.instanceId&&(r.starLevel??1)===(atom.starLevel??1)&&(r.resolution!=='gold'||r.gold===UNIT_DEFINITIONS[r.definitionId]?.cost));
  else if(claim.kind==='tool')check(r.kind==='consumable'&&r.definitionId===claim.definitionId&&r.consumableId===claim.instanceId);
  else check(r.kind==='gold'&&r.amount===claim.gold);
 }
 for(const decision of p.economyReceipts)if(decision.kind==='market'){
  const r=receipts.find(r=>r.receiptId===decision.offerId);
  check(r?.kind==='choice'&&r.choiceKind==='blackMarket'&&r.source==='black-market'&&r.round===decision.round
   &&r.skipped===!decision.take&&r.optionId===(decision.take?decision.optionId:'@skip')&&r.itemId===null&&r.price===0);
 }
 for(const purchase of p.junkerPurchases){const r=receipts.find(r=>r.receiptId===purchase.id);check(r?.kind==='choice'&&r.choiceKind==='armory'&&r.optionId===purchase.upgrade&&r.price===purchase.cost&&r.round===purchase.round);}
 for(const r of receipts){
  check(r.round<=state.round&&r.roundId===getMultiplayerRoundByOrdinal(r.round).roundId);
  if(r.source==='high-roller'||r.source==='conqueror-chest'||r.source==='tacticians-crown'||r.source==='g24-item-gold')check(expectedGold.has(r.receiptId));
  if(r.source==='conqueror'||r.source==='black-market'||r.source==='family')check(p.rewardClaims.some(c=>c.id===r.receiptId)||(r.kind==='choice'&&r.choiceKind==='blackMarket'&&p.economyReceipts.some(e=>e.kind==='market'&&e.offerId===r.receiptId)));
 }
}

/** No DTO/atom construction may precede this restore admission. The replay only
 * reads bounded battle facts and frozen reward tables, never candidate rewards. */
export function validateG23RewardSources(state:MatchState):void{
 if(reusedG23Sources(state))return;
 const m=state.seatMechanics;
 const h=m?.hidden.progress as {seed:number;economyReceipts:G23MatchProgress['economyReceipts']}|undefined;
 const c=m?.seat.conqueror as {rewards:G23MatchProgress['rewards']}|undefined;
 if(!h||h.seed!==state.seed||!Array.isArray(h.economyReceipts)||!c||!Array.isArray(c.rewards))throw new RangeError('Invalid G23 reward authority');
 for(const r of h.economyReceipts){
  if(r.kind==='battle'){
   const f=r.facts,history=state.roundResults.find(h=>h.round===f.round);
   if(!history||f.round>state.round||history.roundKind==='supply'||f.roundKind!==(history.roundKind==='pvp'?'pvp':'pve')
    ||f.result!==(history.result==='playerWin'?'win':history.result==='enemyWin'?'loss':'draw'))throw new RangeError('Invalid G23 reward facts');
   if(f.family&&f.family.stage!==getMultiplayerRoundByOrdinal(f.round).stage)throw new RangeError('Invalid family stage');
   const online=state.multiplayer?.receipts.find(m=>m.round===f.round);
   if(online?canonicalContent(online.g23Facts)!==canonicalContent(f):f.battleId!==`round-${f.round}`)throw new RangeError('Invalid G23 reward facts');
   if(!state.multiplayer&&f.round===state.round&&state.combat?.status==='finished'
    &&canonicalContent(f)!==canonicalContent(g23SoloFacts(state,state.combat)))throw new RangeError('Invalid G23 reward facts');
  }else if(!['market','family-start','mel-save'].includes(r.kind)||!Number.isSafeInteger(r.round)||r.round<1||r.round>state.round)throw new RangeError('Invalid G23 reward facts');
 }
 const replay=replayG23Economy(state.seed,h.economyReceipts);
 if(canonicalContent(h.economyReceipts)!==canonicalContent(replay.economyReceipts))throw new RangeError('Invalid G23 reward facts');
 if(canonicalContent(c.rewards)!==canonicalContent(replay.rewards))throw new RangeError('Invalid G23 reward authority');
 rememberG23Sources(state);
}
