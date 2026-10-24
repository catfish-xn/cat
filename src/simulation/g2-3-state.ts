import { TACTICIAN_SIZE_ITEMS } from './content/tactician-items';
import { activateFamily, familyDisplay } from './family-heist';
import { getCatalogRoundById } from './round-selectors';
import {g23SoloFacts} from './g2-3-settlement';
import {canonicalContent} from './content';
import {replayG23Economy} from './g2-3-match-progress';
import {G23_CONQUEROR_CHESTS,g23ConquerorReward} from './content/g2-3-policy';
import {g23RewardAtoms,type G23RewardClaim} from './g2-3-rewards';
import {UNIT_DEFINITIONS} from './units';
import {getMultiplayerRoundByOrdinal} from './multiplayer-round';
import type {MatchState} from './match-types';
import type {G23MatchProgress} from './g2-3-match-progress';
import {emptySeatMechanics} from './seat-mechanics/state';
import {g23Laboratories} from './g2-3-experiment';
import {deriveTraits} from './trait-snapshot';
/** Settled economy receipts only. Expands no reward atoms, so restore-time readers that run before
 * validateG23RewardSources never sample an unauthenticated reward descriptor. */
export function readG23EconomyReceipts(state:Pick<MatchState,'seatMechanics'>):G23MatchProgress['economyReceipts']{
 const m=state.seatMechanics;if(!m?.seat.academy||!m.seat.junkerKing||!m.seat.alchemist)return [];
 return (m.hidden.progress as {economyReceipts?:G23MatchProgress['economyReceipts']}|undefined)?.economyReceipts??[];
}
/** The DTO is reconstructed from disjoint container fields; never persisted alongside them. */
export function readG23Progress(state:{readonly seatMechanics?:MatchState['seatMechanics'];readonly g23?:G23MatchProgress;readonly multiplayer?:MatchState['multiplayer'];readonly m8?:MatchState['m8'];readonly resourceProvenance?:MatchState['resourceProvenance']}):G23MatchProgress|undefined{
 if(state.g23)return state.g23; // immutable combat-input DTO, never a MatchState field
 const m=state.seatMechanics;if(!m?.seat.academy||!m.seat.junkerKing||!m.seat.alchemist)return undefined;
 const h=(m.hidden.progress??{version:'g2-3-progress-v1',seed:0,rngState:0,rngDraws:0,economyReceipts:[]}) as Omit<G23MatchProgress,'conquest'|'sponsored'|'chem'|'junkerRounds'|'junkerPurchases'|'itemReceipts'|'rewardClaims'|'rewards'>;
 const {rewards:storedRewards,...c}=m.seat.conqueror as Omit<G23MatchProgress['conquest'],'radiantConversion'>&{rewards:G23MatchProgress['rewards']};
 const rewards=m.hidden.progress?storedRewards:storedRewards.filter(b=>b.source!=='family');
 const a=m.seat.academy as {sponsored:readonly string[]};
 const j=m.seat.junkerKing as {rounds:number;purchases:G23MatchProgress['junkerPurchases']};
 const rewardClaims:G23RewardClaim[]=[];
 const bundles=rewards.map(b=>({b,atoms:g23RewardAtoms(b,h.seed,!!state.multiplayer)}));
 for(const r of m.receipts)for(const {b,atoms} of bundles){
  for(const atom of atoms){
   const prefix=atom.id+':copy:';
   if(!r.receiptId.startsWith(prefix))continue;
   const copy=Number(r.receiptId.slice(prefix.length));
   const definitionId=r.kind==='item'||r.kind==='unit'||r.kind==='consumable'?r.definitionId:r.kind==='choice'?r.optionId:'';
   const instanceId=r.kind==='item'||r.kind==='choice'?r.itemId:r.kind==='unit'?r.unitId:r.kind==='consumable'?r.consumableId:null;
   rewardClaims.push({id:r.receiptId,bundleId:b.id,atomId:atom.id,copy,round:r.round,kind:atom.kind,definitionId,instanceId,gold:atom.gold});
  }
 }
 const epicCrowns=[...(state.m8?.loot.receipts.filter(r=>r.payload.kind==='item'&&r.payload.definitionId==='TFT_Item_ForceOfNature'&&r.resolution!=='forfeited').map(r=>({receiptId:r.receiptId,round:getCatalogRoundById(r.claimedRoundId??JSON.parse(JSON.parse(r.dropId)[0])[1]).ordinal}))??[]),...m.receipts.filter(r=>r.kind==='item'&&TACTICIAN_SIZE_ITEMS.includes(r.definitionId)&&!rewardClaims.some(c=>c.id===r.receiptId&&c.definitionId==='TFT_Item_ForceOfNature')).map(r=>({receiptId:r.receiptId,round:r.round})),...(state.resourceProvenance?.entries.flatMap(e=>e.kind==='item-combined'&&TACTICIAN_SIZE_ITEMS.includes(e.event.definitionId)?[{receiptId:JSON.stringify(['crafted-tactician',e.sequence]),round:getCatalogRoundById(e.roundId).ordinal}]:[])??[])];
 return {...h,...(epicCrowns?.length?{epicCrowns}:{}),rewards,rewardClaims,conquest:{...c,radiantConversion:m.seat.radiantConversion as boolean},sponsored:a.sponsored,chem:m.seat.alchemist as G23MatchProgress['chem'],junkerRounds:j.rounds,junkerPurchases:j.purchases,
 itemReceipts:m.receipts.flatMap(r=>r.kind==='item'&&(r.source==='academy'||r.receiptId.startsWith('g23:academy:'))?[{id:r.receiptId,kind:'academy' as const,tier:Number(r.receiptId.split(':').at(-1)),round:r.round,itemId:r.itemId,definitionId:r.definitionId}]:[])};
}
export function writeG23Progress<T extends Pick<MatchState,'seatMechanics'>>(state:T,p:G23MatchProgress):T{
 const m=state.seatMechanics??emptySeatMechanics();
 const {conquest,sponsored,chem,junkerRounds,junkerPurchases,itemReceipts:_derived,rewardClaims:_selectors,epicCrowns:_epic,rewards,...hidden}=p;
 const {radiantConversion,...conqueror}=conquest;
 return {...state,seatMechanics:{...m,seat:{...m.seat,conqueror:{...conqueror,rewards},academy:{sponsored},alchemist:chem,junkerKing:{rounds:junkerRounds,purchases:junkerPurchases},radiantConversion,...(p.mel?{melRescue:{pvpCasts:p.mel.pvpCasts,saved:p.mel.savedBattleId!==null}}:{}),...(p.family?{familyHeist:familyDisplay(p.family)}:{})},hidden:{...m.hidden,progress:hidden}}};
}
export function updateG23Cells(state:MatchState):MatchState{
 let p=readG23Progress(state);if(!p)return state;
 if(!p.family&&state.phase==='preparation'&&!state.multiplayer?.combatRosterLocked&&(deriveTraits(state.preparation,'player',undefined,undefined,state.items).find(t=>t.traitId==='family')?.tier??0)>=5){p=activateFamily(p,state.round);state=writeG23Progress(state,p);}
 const tier=deriveTraits(state.preparation,'player',undefined,undefined,state.items).find(t=>t.traitId==='experiment')?.tier??0;
 return {...state,seatMechanics:{...state.seatMechanics!,seat:{...state.seatMechanics!.seat,experimentCells:g23Laboratories(p.seed,'player',tier)}}};
}
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
}

/** Receipt-backed permanent population at an authenticated resource prefix, including same-round online claims. */
export function epicCrownsAtResourcePrefix(state:MatchState,prefixLength:number):NonNullable<G23MatchProgress['epicCrowns']>{
 const granted=new Set(state.resourceProvenance.entries.slice(0,prefixLength).flatMap(e=>e.kind==='item-combined'&&TACTICIAN_SIZE_ITEMS.includes(e.event.definitionId)?[JSON.stringify(['crafted-tactician',e.sequence])]:e.kind==='item-acquired'&&(e.source.kind==='loot'||e.source.kind==='mechanic')?[e.source.receiptId]:[]));
 return (readG23Progress(state)?.epicCrowns??[]).filter(c=>granted.has(c.receiptId));
}
