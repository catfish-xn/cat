import { openEpicForge } from './epic-forges';
import {recordG23GrantEvidence} from './g2-3-grant-evidence';
import {drainP2Gifts} from './s13-augments-p2-grants';
import {transferUpgradeResources} from './upgrades';
import type {MatchState,MatchEvent,MatchFailure} from './match-types';
import type {UnitLootPolicy} from './loot-runtime';
import {readG23Progress,writeG23Progress} from './g2-3-state';
import {g23RewardAtoms} from './g2-3-rewards';
import {decideG23Market} from './g2-3-economy';
import {G23_BLACK_MARKETS} from './content/g2-3-policy';
import {g23JunkerMenu,G23_JUNKER_PAID,type G23JunkerUpgrade} from './g2-3-junker';
import {grantMechanicGold,grantMechanicItem,grantMechanicUnit,appendMechanicReceipt,openMechanicChoice} from './seat-mechanics';
export function mechanicGrantEvents(before:MatchState,after:MatchState):MatchEvent[]{
 const ids=new Set(before.seatMechanics?.receipts.map(r=>r.receiptId));
 const facts=after.resourceProvenance.entries.slice(before.resourceProvenance.entries.length);
 const births=new Set(facts.filter(f=>f.kind==='unit-acquired'&&f.source.kind==='mechanic').map(f=>f.sequence));
 const upgrades=facts.flatMap(f=>f.kind==='unit-upgraded'&&births.has(f.acquisitionSequence)?[f.event]:[]);
 return [...upgrades,...transferUpgradeResources(before.items,before.anomalyBinding,upgrades).events,
  ...(after.seatMechanics?.receipts??[]).filter(r=>!ids.has(r.receiptId)).map(receipt=>({type:'mechanicGranted' as const,receipt}))];
}
export function claimG23Atom(state:MatchState,atomId:string,definitionId:string,policy?:UnitLootPolicy):{ok:true;state:MatchState;events:readonly MatchEvent[]}|{ok:false;state:MatchState;reason:MatchFailure}{
 const p=readG23Progress(state),bundle=p?.rewards.find(b=>g23RewardAtoms(b,p.seed,!!state.multiplayer).some(a=>a.id===atomId)),atom=bundle&&g23RewardAtoms(bundle,p!.seed,!!state.multiplayer).find(a=>a.id===atomId);
 if(state.sharedPool&&!policy&&bundle?.source==='family'&&atom?.kind==='unit')return {ok:false,state,reason:'invalid-mechanic-state'};
 if(!p||!bundle||!atom||atom.kind==='item'&&atom.options.length>1)return {ok:false,state,reason:'stale-choice'};
 const copy=p.rewardClaims.filter(c=>c.atomId===atom.id).length;
 if(copy>=atom.quantity||atom.kind!=='gold'&&!atom.options.includes(definitionId)||atom.kind==='gold'&&definitionId!=='')return {ok:false,state,reason:'stale-choice'};
 if(atom.duplicatorDefinitionId==='TFT13_Crime_Consumable_LesserShimmerDuplicator'
   &&!state.preparation.units.some(u=>u.team==='player'&&u.definitionId===definitionId))return {ok:false,state,reason:'stale-choice'};
 const request={receiptId:`${atom.id}:copy:${copy}`,source:bundle.source,definitionId,...(bundle.source==='family'?{immediate:true}:{}),...(atom.starLevel?{starLevel:atom.starLevel}:{})};
 if(atom.kind==='tool'){
  const consumableId=`consumable-${state.nextConsumableSerial}`;
  const receipt={...request,kind:'consumable' as const,round:state.round,roundId:state.roundDefinitionId,consumableId};
  const granted=appendMechanicReceipt({...state,nextConsumableSerial:state.nextConsumableSerial+1,consumables:[...state.consumables,{consumableId,definitionId:definitionId as import('./consumable-types').ConsumableDefinitionId}]},receipt);
  return {ok:true,state:granted,events:[{type:'mechanicGranted',receipt}]};
 }
 const granted=atom.kind==='item'?grantMechanicItem(state,request):atom.kind==='gold'?grantMechanicGold(state,{...request,amount:atom.gold}):grantMechanicUnit(state,request,policy);
 if(!granted.ok)return granted;
 return {ok:true,state:granted.state,events:granted.events};
}
/** Unresolved item/target selections stay pending. Online heroes enqueue orbs; offline capacity retries remain. */
export function drainG23Rewards(initial:MatchState,policy?:UnitLootPolicy,events:MatchEvent[]=[]):MatchState{
 let state=drainP2Gifts(initial,policy);const p=readG23Progress(state);if(!p)return state;
 for(const bundle of p.rewards.filter(b=>b.source!=='family'))for(const atom of g23RewardAtoms(bundle,p.seed,!!state.multiplayer)){
  if(atom.options.length>1&&atom.kind!=='duplicator')continue;
  while(readG23Progress(state)!.rewardClaims.filter(c=>c.atomId===atom.id).length<atom.quantity){
   const definitionId=atom.kind==='duplicator'?atom.options.find(id=>state.preparation.units.some(u=>u.team==='player'&&u.definitionId===id)):atom.options[0]??'';
   if(definitionId===undefined)break;
   const result=claimG23Atom(state,atom.id,definitionId,policy);
   if(!result.ok){if(result.reason==='bench-full')break;events.push({type:'mechanicFailed',hook:'rewards',reason:result.reason});return state;}state=result.state;
  }
 }
 return state;
}
/** Automatic popup at preparation/settlement; no permanent armory shop. */
export function openG23Choice(state:MatchState):{state:MatchState;events:readonly MatchEvent[]}{
 const epic=openEpicForge(state);if(epic.state!==state)return epic;
 const p=readG23Progress(state);if(!p||state.pendingChoice||!['preparation','settlement'].includes(state.phase)||state.m8.round.kind==='supply')return {state,events:[]};
 const returnPhase=state.phase as 'preparation'|'settlement';
 // Black market is one weighted source bundle: the first item identifies accepting that bundle.
 const offer=p.chem.offer;
 if(offer){
  const reward=G23_BLACK_MARKETS[offer.tier-1].options.find(o=>o.id===offer.optionId)!.reward;
  const atom=g23RewardAtoms({id:offer.id,round:offer.round,source:'black-market',tier:offer.tier,reward},p.seed,!!state.multiplayer).find(a=>a.kind==='item');
  {const opened=openMechanicChoice(state,{choiceId:offer.id,returnPhase,offers:atom?.options??[offer.optionId],payload:{kind:'blackMarket',...(atom?{}:{grantItem:false}),source:'black-market',skippable:true,skipReward:{kind:'health-per-skip',amount:1},timeoutOption:'@skip'}});if(!opened.ok)return {state,events:[{type:'mechanicFailed',hook:'choice',reason:opened.reason}]};return opened;}
 }
 const menu=returnPhase==='preparation'?g23JunkerMenu(state):null;
 if(menu){
  const prices=Object.fromEntries(menu.choices.map(c=>[c,(G23_JUNKER_PAID as readonly string[]).includes(c)?5:0]));
  const timeoutOption=menu.choices.find(c=>prices[c]===0)!;
  const opened=openMechanicChoice(state,{choiceId:menu.id,returnPhase,offers:menu.choices,payload:{kind:'armory',source:'junker-king',prices,timeoutOption}});
  if(!opened.ok)return {state,events:[{type:'mechanicFailed',hook:'choice',reason:opened.reason}]};return opened;
 }
 for(const b of p.rewards)for(const atom of g23RewardAtoms(b,p.seed,!!state.multiplayer)){
  const copy=p.rewardClaims.filter(c=>c.atomId===atom.id).length;
  if(atom.kind!=='item'||atom.options.length<2||copy>=atom.quantity)continue;
  const opened=openMechanicChoice(state,{choiceId:`${atom.id}:copy:${copy}`,returnPhase,offers:atom.options,payload:{kind:'forge',source:b.source,timeoutOption:atom.options[0]}});
  if(!opened.ok)return {state,events:[{type:'mechanicFailed',hook:'choice',reason:opened.reason}]};return opened;
 }
 return {state,events:[]};
}
export function finishG23Choice(before:MatchState,after:MatchState,optionId:string):MatchState{
 const choice=before.pendingChoice!,p=readG23Progress(before);if(!p)return after;
 if(choice.kind==='armory'&&choice.payload?.source==='junker-king'&&choice.choiceId.startsWith('g23:junker:')){
  const menu=g23JunkerMenu(before);if(!menu||menu.id!==choice.choiceId)throw Error('Stale armory');
  const receipt=after.seatMechanics!.receipts.at(-1)!;
  if(receipt.kind!=='choice')throw Error('Armory receipt');
  return recordG23GrantEvidence(before,writeG23Progress(after,{...p,junkerPurchases:[...p.junkerPurchases,{id:menu.id,round:before.round,unitId:menu.unitId,upgrade:optionId as G23JunkerUpgrade,cost:receipt.price}]}),menu.id);
 }
 if(choice.kind==='blackMarket'&&p.chem.offer?.id===choice.choiceId){
  const next=writeG23Progress(after,decideG23Market(p,choice.choiceId,optionId!=='@skip',before.round));
  return next;
 }
 return after;
}
