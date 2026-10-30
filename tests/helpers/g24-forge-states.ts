import {createMatch,forfeitPendingChoice,startMatchCombat,stepMatch,nextRound,claimOrDiscardLoot,claimOrb,buyXp,deployMatchUnit,sellUnit,rerollAugment,selectChoice,type MatchState} from '../../src/simulation/match';
import {augmentNeedsHistory} from '../../src/simulation/augment-history-owners';
import {h12SelectionAllowed} from '../../src/simulation/augment-pool-batch5-h12-progression';
import {readLootView} from '../../src/simulation/loot-view';
import {isAnvil} from '../../src/simulation/content/anvils';
import { validateAnvils } from '../../src/simulation/restore-checks/anvils-check';
import {enableMultiplayerSettlement,applyRoundSettlement,ROUND_SETTLEMENT_VERSION} from '../../src/simulation/round-settlement';
import {grantMechanicGold,grantMechanicUnit} from '../../src/simulation/seat-mechanics';
import {validateG23Restoration} from '../../src/simulation/g2-3-restore';
import {validateSeatMechanicsState} from '../../src/simulation/seat-mechanics/state';
import {validateMechanicPendingChoice} from '../../src/simulation/seat-mechanics/choices';
import {openG23Choice} from '../../src/simulation/g2-3-runtime';
export const accepted=<T extends {ok:boolean;state:MatchState}>(r:T):MatchState=>{if(!r.ok)throw Error(JSON.stringify(r));return r.state;};
/** The conqueror forge atom whose anvil unit each captured tier opens. */
export const FORGE_ATOM_IDS:Readonly<Record<number,string>>={10:'g23:conqueror:10:atom:0',11:'g23:conqueror:11:atom:0',14:'g23:conqueror:14:atom:1'};
/** The same seat just before the tier's anvil unit was opened (anvil still on the bench). */
export interface ForgeAnvil {readonly before:MatchState;readonly unitId:string}
let cached:Map<number,MatchState>|undefined;
let cachedAnvils:Map<number,ForgeAnvil>|undefined;
/** v22 anvil units (docs/ANVIL_UNITS.md): conqueror forges no longer auto-open. Claim every waiting G2-3 anvil
 * orb onto the bench and open each anvil unit by selling it (sell = openAnvil), recording the tiers under test. */
function openConquerorAnvils(input:MatchState,anvils:Map<number,ForgeAnvil>,states:Map<number,MatchState>):MatchState{
 let state=input;
 for(const orb of readLootView(state).unclaimedOrbs??[])if(orb.orbId.startsWith('g23-anvil:'))state=accepted(claimOrb(state,orb.orbId,state.round));
 const unit=state.preparation.units.find(u=>u.team==='player'&&isAnvil(u.definitionId));
 if(!unit)return state;
 const birth=state.seatMechanics!.receipts.find(r=>r.kind==='unit'&&r.unitId===unit.id)!;
 const tier=Object.entries(FORGE_ATOM_IDS).find(([,atomId])=>birth.receiptId===`${atomId}:copy:0`)?.[0];
 const opened=accepted(sellUnit(state,unit.id));
 if(tier!==undefined){anvils.set(Number(tier),{before:state,unitId:unit.id});states.set(Number(tier),opened);}
 return opened;
}
/** Server-authoritative settlement vectors: real opening/history/commands and generic grant provenance.
 * Six heroes are granted explicitly; each PvP receipt supplies 30 distinct takedowns. This tests the
 * domain's trusted receipt boundary, not an assertion that the fixture is a natural combat trajectory. */
export function forgeStates():Map<number,MatchState>{
 if(cached)return cached;
 const states=new Map<number,MatchState>(),anvils=new Map<number,ForgeAnvil>();
 let state=accepted(enableMultiplayerSettlement(createMatch(5),'A')),recruited=false;
 for(let guard=0;guard<15000;guard++){
  if(state.phase==='choice'){
   const c=state.pendingChoice!;
   if(states.has(14)){cached=states;cachedAnvils=anvils;return states;}
   // D5 registration (catalog 310) makes seed 5's forfeited 2-1 card scoreboard-scrapper.
   // This harness is one multiplayer-flagged seat, not a room, so nobody publishes the
   // entry table. The next PvE (2-7, ordinal 10) then rejects startMatchCombat. Forfeit
   // still takes the first legal card when that card does not need augment history;
   // otherwise take the first history-free offer after the existing per-slot rerolls.
   if(c.kind==='augment'){
    const quiet=(offers:readonly string[])=>offers.find(id=>h12SelectionAllowed(state,id)&&!augmentNeedsHistory(id));
    const forfeited=c.offers.find(id=>h12SelectionAllowed(state,id));
    if(forfeited&&augmentNeedsHistory(forfeited)){
     let choice=c;
     for(let slot=0;slot<3&&!quiet(choice.offers);slot++){
      if(choice.rerolledSlots?.[slot])continue;
      const rolled=rerollAugment(state,choice.choiceId,choice.generation,slot);
      if(!rolled.ok)break;
      state=rolled.state;choice=state.pendingChoice!;
     }
     const id=quiet(choice.offers);
     if(!id)throw Error('Forge fixture has no history-free augment at '+state.roundDefinitionId+': '+choice.offers.join(','));
     state=accepted(selectChoice(state,choice.choiceId,choice.generation,id));
     continue;
    }
   }
   state=accepted(forfeitPendingChoice(state,state.round,c.choiceId,c.generation));continue;
  }
  if(state.phase==='combat'){state=stepMatch(state).state;continue;}
  if(state.phase==='settlement'){
   const opened=openConquerorAnvils(state,anvils,states);
   if(opened!==state){state=opened;continue;}
   state=accepted(claimOrDiscardLoot(state,state.round));if(state.phase==='settlement')state=accepted(nextRound(state,state.round));continue;
  }
  if(state.phase!=='preparation')throw Error('Unexpected fixture phase '+state.phase);
  if(state.round===4&&!recruited){
   state=accepted(grantMechanicGold(state,{receiptId:'fixture:gold',source:'fixture',amount:150}));
   while(state.level<6)state=accepted(buyXp(state));
   for(const u of state.preparation.units.filter(u=>u.team==='player'))state=accepted(deployMatchUnit(state,u.id,{kind:'bench',slot:0}));
   for(const [col,definitionId] of ['darius','draven','rell','swain','ambessa','mordekaiser'].entries()){
    const result=grantMechanicUnit(state,{receiptId:'fixture:'+definitionId,source:'fixture',definitionId});state=accepted(result);
    if(!result.ok||result.receipt.kind!=='unit'||result.receipt.resolution!=='orb')throw Error('fixture hero orb');
    expectOrbUnallocated(state, definitionId);
    state=accepted(claimOrb(state,result.receipt.orbId!,state.round));
    const unit=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===definitionId)!;
    if(!unit)throw Error('fixture claimed hero');
    state=accepted(deployMatchUnit(state,unit.id,{kind:'board',cell:{col,row:4}}));
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

function expectOrbUnallocated(state:MatchState,definitionId:string):void{
 if(state.preparation.units.some(u=>u.team==='player'&&u.definitionId===definitionId))throw Error('fixture hero allocated before claim');
}

export function forgeAnvils():Map<number,ForgeAnvil>{forgeStates();return cachedAnvils!;}

export function restoreDomain(input:unknown):MatchState{
 const state=JSON.parse(JSON.stringify(input)) as MatchState;
 // Anvil-unit forges (v22) are authenticated by the anvil ledger: birth receipt, opening fact, offers and choice receipt.
 validateSeatMechanicsState(state.seatMechanics);if(state.pendingChoice?.kind==='forge')validateMechanicPendingChoice(state);validateG23Restoration(state);validateAnvils(state);return state;
}

