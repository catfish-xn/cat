import {sellUnit,createMatch,buyXp,deployMatchUnit,startMatchCombat,stepMatch,nextRound,selectChoice,selectAnomalyTarget,claimOrb,type MatchState} from '../../src/simulation/match';
import {readLootView} from '../../src/simulation/loot-view';
import {grantMechanicGold,grantMechanicUnit} from '../../src/simulation/seat-mechanics';
import {readG23Progress,writeG23Progress} from '../../src/simulation/g2-3-state';
import {createG23Progress} from '../../src/simulation/g2-3-match-progress';
import {advanceG23Economy} from '../../src/simulation/g2-3-economy';
import {g23BattlePayouts} from '../../src/simulation/g2-3-settlement';
import {P2_ITEM_GRANTS} from '../../src/simulation/content/s13-augments-p2';
import {isAnvil} from '../../src/simulation/content/anvils';

export const accepted=<T extends {ok:boolean;state:MatchState}>(result:T):MatchState=>{
 if(!result.ok)throw Error('Fixture command refused: '+('reason' in result?result.reason:'unknown')+' at '+result.state.roundDefinitionId+'/'+result.state.phase);return result.state;
};
/** v22 anvil units (docs/ANVIL_UNITS.md): Conqueror forges no longer pop up. Claim every waiting G2-3 anvil orb onto
 * the bench and open the first Conqueror anvil by selling it (sell = openAnvil). Returns null when none is waiting. */
export function openConquerorAnvil(input:MatchState):{state:MatchState;receiptId:string}|null{
 let state=input;
 for(const orb of readLootView(state).unclaimedOrbs??[])if(orb.orbId.startsWith('g23-anvil:'))state=accepted(claimOrb(state,orb.orbId,state.round));
 for(const unit of state.preparation.units.filter(u=>u.team==='player'&&isAnvil(u.definitionId))){
  const birth=state.seatMechanics!.receipts.find(r=>r.kind==='unit'&&r.unitId===unit.id);
  if(birth?.receiptId.startsWith('g23:conqueror:'))return {state:accepted(sellUnit(state,unit.id)),receiptId:birth.receiptId};
 }
 return null;
}
let cached:Map<number,MatchState>|undefined;
let tier4Preparation:MatchState|undefined;
export function naturalTier4Preparation():MatchState{
 naturalForgeStates();return tier4Preparation!;
}
/** Real solo combats, explicit generic grants only: no forged progress/history/settlement. */
export function naturalForgeStates():Map<number,MatchState>{
 if(cached)return cached;
 const states=new Map<number,MatchState>();let state=createMatch(42),recruited=false;
 for(let guard=0;guard<60000;guard++){
  if(state.phase==='choice'){
   let c=state.pendingChoice!;
   if(c.kind==='anomaly'&&c.step==='target'){
    state=accepted(selectAnomalyTarget(state,c.choiceId,c.generation,state.preparation.units.find(u=>u.team==='player')!.id));c=state.pendingChoice!;
   }
   // Prefer Going Long over Radiant Relics at seed42's v14 4-2 node to keep the forge item serials.
   const augmentPriorities=['going-long'];
   const id=c.kind==='augment'?augmentPriorities.find(id=>c.offers.includes(id))??c.offers.find(id=>!(id in P2_ITEM_GRANTS))??c.offers[0]:c.offers[0];
   state=accepted(selectChoice(state,c.choiceId,c.generation,id));continue;
  }
  if(state.phase==='combat'){
   state=stepMatch(state).state;
   if(!states.has(4)&&readG23Progress(state)!.conquest.chestsOpened>=4)states.set(4,state);
   continue;
  }
  // v22 anvil units (docs/ANVIL_UNITS.md): the 4-7 component anvil is a bench unit and selling it would open its
  // forge, so the bench clean-up only sells heroes and the anvil stays unopened on the bench.
  if(state.phase==='settlement'){
   // Earlier Conqueror anvils (tier 9) resolve through the choice branch with their first offer, as the old popup did.
   const opened=openConquerorAnvil(state);
   if(opened){if(opened.receiptId==='g23:conqueror:10:atom:0:copy:0'){states.set(10,opened.state);cached=states;return states;}state=opened.state;continue;}
   while(state.m8.loot.direct.some(d=>d.status==='pending-capacity')){const extra:MatchState['preparation']['units'][number]=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&!isAnvil(u.definitionId))!;state=accepted(sellUnit(state,extra.id));}state=accepted(nextRound(state,state.round));continue;}
  if(state.phase!=='preparation')throw Error(`Unexpected solo fixture phase ${state.phase} at ${state.round}, stacks ${readG23Progress(state)!.conquest.stacks}`);
  if(state.round===1&&!recruited){
   state=accepted(grantMechanicGold(state,{receiptId:'fixture:gold',source:'fixture',amount:150}));
   while(state.level<6)state=accepted(buyXp(state));
   for(const u of state.preparation.units.filter(u=>u.team==='player'))state=accepted(deployMatchUnit(state,u.id,{kind:'bench',slot:0}));
   for(const [col,definitionId] of ['darius','draven','rell','swain','ambessa','mordekaiser'].entries()){
    for(let copy=0;copy<9;copy++)state=accepted(grantMechanicUnit(state,{receiptId:`fixture:${definitionId}:${copy}`,source:'fixture',definitionId}));
    const unit=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===definitionId&&u.starLevel===3)!;
    state=accepted(deployMatchUnit(state,unit.id,{kind:'board',cell:{col,row:4}}));
   }
   recruited=true;
  }
  for(const u of state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'&&u.id!=='unit-1'&&!isAnvil(u.definitionId)))state=accepted(sellUnit(state,u.id));
  if(state.round===6)tier4Preparation=state;
  state=accepted(startMatchCombat(state));
 }
 throw Error('Natural forge fixture budget');
}

/** Tier 14 is beyond the six-Conqueror solo trajectory. This save uses the
 * historical authority boundary's tier-9/30-takedown settlement vector, not a
 * claim that six heroes naturally earned 1200 stacks. All bundles/gold use the
 * economy planners; the surrounding save retains real solo rounds and assets. */
export function receiptVectorTier14Save():MatchState{
 const pending=naturalForgeStates().get(10)!,choice=pending.pendingChoice!;
 let state=accepted(selectChoice(pending,choice.choiceId,choice.generation,choice.offers[0]));
 const original=readG23Progress(state)!;let replay=createG23Progress(state.seed);
 for(const receipt of original.economyReceipts){
  if(receipt.kind!=='battle')throw Error('Unexpected fixture market');
  const facts=receipt.facts.round===state.round?{...receipt.facts,conquerorTier:9,conquestTakedowns:Array.from({length:30},(_,i)=>`vector-enemy-${i}`)}:receipt.facts;
  replay=advanceG23Economy(replay,facts).progress;
 }
 state=writeG23Progress(state,{...original,...replay});
 const last=replay.economyReceipts.at(-1)!;
 if(last.kind!=='battle')throw Error('Expected final battle');
 for(const payout of g23BattlePayouts(last.facts,replay.conquest.chestsOpened,original.conquest.chestsOpened))state=accepted(grantMechanicGold(state,payout));
 state=accepted(nextRound(state,state.round));
 // The support trial also opens tiers 11/13 before tier 14.
 while(state.phase==='choice'&&state.pendingChoice!.choiceId!=='g23:conqueror:14:atom:1:copy:0'){
  const pending=state.pendingChoice!;state=accepted(selectChoice(state,pending.choiceId,pending.generation,pending.offers[0]));
 }
 if(state.pendingChoice?.choiceId!=='g23:conqueror:14:atom:1:copy:0')throw Error('Missing tier14 vector window');
 return state;
}
