import {createMatch,forfeitPendingChoice,startMatchCombat,stepMatch,nextRound,claimOrDiscardLoot,buyXp,deployMatchUnit,claimOrb,type MatchState} from '../../src/simulation/match';
import {enableMultiplayerSettlement,applyRoundSettlement,ROUND_SETTLEMENT_VERSION} from '../../src/simulation/round-settlement';
import {grantMechanicGold,grantMechanicUnit} from '../../src/simulation/seat-mechanics';
import {validateG23Restoration} from '../../src/simulation/g2-3-restore';
import {validateSeatMechanicsState} from '../../src/simulation/seat-mechanics/state';
import {validateMechanicPendingChoice} from '../../src/simulation/seat-mechanics/choices';
import {openG23Choice} from '../../src/simulation/g2-3-runtime';
export const accepted=<T extends {ok:boolean;state:MatchState}>(r:T):MatchState=>{if(!r.ok)throw Error(JSON.stringify(r));return r.state;};
let cached:Map<number,MatchState>|undefined;
/** Server-authoritative settlement vectors: real opening/history/commands and generic grant provenance.
 * Six heroes are granted explicitly; each PvP receipt supplies 30 distinct takedowns. This tests the
 * domain's trusted receipt boundary, not an assertion that the fixture is a natural combat trajectory. */
export function forgeStates():Map<number,MatchState>{
 if(cached)return cached;
 const states=new Map<number,MatchState>();
 let state=accepted(enableMultiplayerSettlement(createMatch(5),'A')),recruited=false;
 for(let guard=0;guard<15000;guard++){
  if(state.phase==='choice'){
   const c=state.pendingChoice!;
   if(c.choiceId==='g23:conqueror:10:atom:0:copy:0')states.set(10,state);
   if(c.choiceId==='g23:conqueror:11:atom:0:copy:0')states.set(11,state);
   if(c.choiceId==='g23:conqueror:14:atom:1:copy:0'){states.set(14,state);cached=states;return states;}
   state=accepted(forfeitPendingChoice(state,state.round,c.choiceId,c.generation));continue;
  }
  if(state.phase==='combat'){state=stepMatch(state).state;continue;}
  if(state.phase==='settlement'){state=accepted(claimOrDiscardLoot(state,state.round));if(state.phase==='settlement')state=accepted(nextRound(state,state.round));continue;}
  if(state.phase!=='preparation')throw Error('Unexpected fixture phase '+state.phase);
  if(state.round===4&&!recruited){
   state=accepted(grantMechanicGold(state,{receiptId:'fixture:gold',source:'fixture',amount:150}));
   while(state.level<6)state=accepted(buyXp(state));
   for(const u of state.preparation.units.filter(u=>u.team==='player'))state=accepted(deployMatchUnit(state,u.id,{kind:'bench',slot:0}));
   for(const [col,definitionId] of ['darius','draven','rell','swain','ambessa','mordekaiser'].entries()){
    const result=grantMechanicUnit(state,{receiptId:'fixture:'+definitionId,source:'fixture',definitionId});state=accepted(result);
    if(!result.ok||result.receipt.kind!=='unit'||!result.receipt.orbId)throw Error('fixture hero');
    const serial=state.nextUnitSerial;state=accepted(claimOrb(state,result.receipt.orbId,state.round));
    state=accepted(deployMatchUnit(state,`unit-${serial}`,{kind:'board',cell:{col,row:4}}));
   }
   recruited=true;
  }
  if(state.m8.round.kind==='pvp'){
   const battleId='forge-battle-'+state.round;
   state=accepted(applyRoundSettlement(state,{version:ROUND_SETTLEMENT_VERSION,settlementId:'forge-settlement-'+state.round,battleId,
    seatId:'A',round:state.round,roundId:state.roundDefinitionId,settlementEligible:true,result:'win',damage:0,
    baseDamage:state.m8.round.stage===2?2:5,opposingSurvivors:0,growth:[],combatTicks:100,combatEventCount:30,
    g23Facts:{battleId,round:state.round,roundKind:'pvp',result:'win',conquerorTier:6,conquestTakedowns:Array.from({length:30},(_,i)=>'enemy-'+i),chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0}}));
   state=openG23Choice(state).state;
  }else state=accepted(startMatchCombat(state));
 }
 throw Error('forge fixture budget');
}

export function restoreDomain(input:unknown):MatchState{
 const state=JSON.parse(JSON.stringify(input)) as MatchState;
 validateSeatMechanicsState(state.seatMechanics);if(state.pendingChoice?.kind==='forge')validateMechanicPendingChoice(state);validateG23Restoration(state);return state;
}

