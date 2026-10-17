import {expect,it} from 'vitest';
import {createMatch,deployMatchUnit,equipItem,getDeploymentCap,selectChoice,startMatchCombat,stepMatch,type MatchState} from '../src/simulation/match';
import {getPlayerDeploymentCount} from '../src/simulation/game';
import {TACTICIANS_CROWN_ID} from '../src/simulation/deployment-cap';
import {readG23Progress,validateG23MechanicLinks} from '../src/simulation/g2-3-state';
import {validateG23Progress,createG23Progress} from '../src/simulation/g2-3-match-progress';
import {advanceG23Economy,validateG23BattleFacts,type G23EconomyAction} from '../src/simulation/g2-3-economy';
import {rollG23CrownGold} from '../src/simulation/g2-3-progress';
import {G23_POLICY} from '../src/simulation/content/g2-3-policy';
import {snapshotForBattle} from '../src/simulation/two-sided-snapshot';
import {compileBattle,proposeSettlement,resolveTwoSidedBattle} from '../src/simulation/two-sided-battle';
import {commitG23Settlement} from '../src/simulation/g2-3-settlement';
import {openG23Choice} from '../src/simulation/g2-3-runtime';
import type {G23BattleFacts} from '../src/simulation/g2-3-economy';
import {accepted,board} from './t10-helpers';
import {catalogPreparation} from './t5r-helpers';

const facts=(round:number):G23BattleFacts=>({battleId:'crown-battle-'+round,round,roundKind:'pve',result:'win',conquerorTier:9,
 conquestTakedowns:Array.from({length:30},(_,i)=>'enemy-'+i),chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0});
function crowned(battles:number,seed=42):MatchState{
 let state:MatchState={...catalogPreparation('2-1',seed),level:3,gold:100};
 for(let round=1;round<=battles;round++)state=commitG23Settlement(state,facts(round));
 state=openG23Choice(state).state;
 while(state.pendingChoice){const c=state.pendingChoice;state=accepted(selectChoice(state,c.choiceId,c.generation,c.offers[0]));}
 return state;
}
const own=(state:MatchState)=>state.preparation.units.filter(u=>u.team==='player');
const crowns=(state:MatchState)=>state.items.filter(i=>i.definitionId===TACTICIANS_CROWN_ID);
/** Three crowns (tier 15), the first `holders` of them equipped on deployed units. */
function deployed(seed:number,holders:number,where:'board'|'bench'='board'):MatchState{
 let state=crowned(3,seed);
 const free=[0,2,3,4,5,6].map(col=>board(col));
 for(const unit of own(state).filter(u=>u.location.kind==='bench')){if(getPlayerDeploymentCount(state.preparation)>=getDeploymentCap(state))break;state=accepted(deployMatchUnit(state,unit.id,free.shift()!));}
 const targets=own(state).filter(u=>u.location.kind===where);
 crowns(state).slice(0,holders).forEach((c,i)=>{state=accepted(equipItem(state,c.id,targets[i].id,0));});
 return state;
}
function fight(state:MatchState):MatchState{state=accepted(startMatchCombat(state));while(state.phase==='combat')state=stepMatch(state).state;return state;}
const lastBattle=(state:MatchState)=>readG23Progress(state)!.economyReceipts.at(-1) as G23EconomyAction;
const crownReceipts=(state:MatchState)=>state.seatMechanics!.receipts.filter(r=>r.source==='tacticians-crown');

it('the source 10% chance is one lcg32 draw per crown, deterministic per state',()=>{
 expect(G23_POLICY.crownGold).toMatchObject({chanceBps:1000,gold:1});
 expect(rollG23CrownGold(3,12345)).toEqual(rollG23CrownGold(3,12345));
 expect(rollG23CrownGold(3,12345).draws).toBe(3);
 let state=987654321,hits=0;
 for(let i=0;i<1000;i++){const roll=rollG23CrownGold(1,state);state=roll.rngState;hits+=roll.gold;}
 expect(hits).toBeGreaterThan(70);expect(hits).toBeLessThan(130);
 expect(()=>rollG23CrownGold(0,1)).toThrow();
});

it('economy rolls only on a win with crowns, for PvE and PvP alike, and the receipt replays',()=>{
 const p=createG23Progress(42),base=facts(1);
 const noCrown=advanceG23Economy(p,{...base,conquerorTier:0,conquestTakedowns:[]});
 expect(noCrown.progress.rngDraws).toBe(p.rngDraws);expect(lastBattle({...{} as MatchState,g23:noCrown.progress} as never).crownGold).toBeUndefined();
 for(const roundKind of ['pve','pvp'] as const){
  const won=advanceG23Economy(p,{...base,conquerorTier:0,conquestTakedowns:[],roundKind,crowns:30});
  const roll=rollG23CrownGold(30,p.rngState);
  expect(won.progress.rngDraws).toBe(p.rngDraws+30);expect(won.progress.rngState).toBe(roll.rngState);
  expect(roll.gold).toBeGreaterThan(0);expect(won.gold).toBe(roll.gold);
  expect((won.progress.economyReceipts[0] as G23EconomyAction).crownGold).toBe(roll.gold);
  expect(()=>validateG23Progress(won.progress,42,1)).not.toThrow();
  // A forged drop amount does not replay.
  const forged={...won.progress,economyReceipts:[{...won.progress.economyReceipts[0],crownGold:roll.gold+1}]};
  expect(()=>validateG23Progress(forged as never,42,1)).toThrow();
 }
 for(const result of ['loss','draw'] as const){
  const lost=advanceG23Economy(p,{...base,conquerorTier:0,conquestTakedowns:[],result,crowns:3});
  expect(lost.progress.rngDraws).toBe(p.rngDraws);expect((lost.progress.economyReceipts[0] as G23EconomyAction).crownGold).toBeUndefined();
 }
 expect(()=>validateG23BattleFacts({...base,crowns:0})).toThrow();
 expect(()=>validateG23BattleFacts({...base,crowns:31})).toThrow();
});

it('a won battle with deployed crown holders pays the drop through a mechanic gold receipt',()=>{
 let paid=0;
 for(const seed of [1,3,42]){
  const before=deployed(seed,3),after=fight(before),receipt=lastBattle(after);
  expect(after.roundResults.at(-1)!.result).toBe('playerWin');
  expect(receipt.facts.crowns).toBe(3);
  expect(receipt.crownGold).toBe(rollG23CrownGold(3,readG23Progress(before)!.rngState).gold);
  const drops=crownReceipts(after);
  expect(drops).toEqual(receipt.crownGold?[{receiptId:`g23:crown:${receipt.facts.battleId}`,round:receipt.facts.round,roundId:'2-1',source:'tacticians-crown',kind:'gold',amount:receipt.crownGold}]:[]);
  paid+=drops.length;
 }
 expect(paid).toBeGreaterThan(0);
});

it('restore links every drop to its battle receipt; a forged or missing drop is rejected',()=>{
 const won={...facts(1),battleId:'round-1',conquerorTier:0,conquestTakedowns:[],crowns:30};
 const state=commitG23Settlement(createMatch(42),won),drop=crownReceipts(state);
 expect(drop).toHaveLength(1);expect(drop[0].kind==='gold'&&drop[0].amount).toBe(lastBattle(state).crownGold);
 expect(state.gold).toBe(createMatch(42).gold+lastBattle(state).crownGold!);
 expect(()=>validateG23MechanicLinks(state)).not.toThrow();
 const receipts=state.seatMechanics!.receipts,with_=(next:typeof receipts)=>({...state,seatMechanics:{...state.seatMechanics!,receipts:next}}) as MatchState;
 expect(()=>validateG23MechanicLinks(with_(receipts.map(r=>r.source==='tacticians-crown'&&r.kind==='gold'?{...r,amount:r.amount+1}:r)))).toThrow();
 expect(()=>validateG23MechanicLinks(with_(receipts.filter(r=>r.source!=='tacticians-crown')))).toThrow();
 expect(()=>validateG23MechanicLinks(with_([...receipts,{...drop[0],receiptId:'g23:crown:round-2'}]))).toThrow();
 // Settling the same battle again never pays twice.
 expect(commitG23Settlement(state,won)).toBe(state);
});

it('crowns in the inventory or on bench units never roll (约定值 G24-CROWN-GOLD-01)',()=>{
 for(const state of [deployed(42,0),deployed(42,2,'bench')]){
  const after=fight(state),receipt=lastBattle(after);
  expect(receipt.facts).not.toHaveProperty('crowns');expect(receipt.crownGold).toBeUndefined();
  expect(readG23Progress(after)!.rngDraws).toBe(readG23Progress(state)!.rngDraws);expect(crownReceipts(after)).toEqual([]);
 }
 const one=lastBattle(fight(deployed(42,1)));expect(one.facts.crowns).toBe(1);
});

it('PvP settlement proposals carry each side its own deployed crown count',()=>{
 const a=deployed(42,2),b=deployed(42,0);
 const result=resolveTwoSidedBattle(compileBattle(snapshotForBattle(a,'A'),snapshotForBattle(b,'B'),42,{battleId:'crown-pvp'}),5000);
 const proposals=proposeSettlement(result);
 expect(proposals.a.g23Facts!.crowns).toBe(2);expect(proposals.b.g23Facts).not.toHaveProperty('crowns');
});
