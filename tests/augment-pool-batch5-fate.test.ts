import { equipItem, deployMatchUnit } from '../src/simulation/match';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics/grants';
import { expect, it } from 'vitest';
import { createMatch, nextRound, rerollAugment, selectChoice, startMatchCombat, stepMatch, type MatchState, type MatchEvent } from '../src/simulation/match';
import { enableMultiplayerSettlement, applyRoundSettlement, ROUND_SETTLEMENT_VERSION, type RoundSettlementReceipt } from '../src/simulation/round-settlement';
import { batch5FateRound, batch5RewardPlan } from '../src/simulation/augment-pool-batch5-progress';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { canonicalContent, digestContent } from '../src/simulation/content';
import { ownBattleRecord, deepFreeze, recordVersion, replayBattleRecord } from '../src/simulation/battle-record-validation';
import type { BattleRecord } from '../src/m6/contracts';
import { accepted, fieldBench, resolveM5Choices } from './match-helpers';
import { rewardPlan } from './fixtures/m5/augment-rewards-oracle.cjs';
import { CATALOG, COST, ROUNDS, xp, entryXp, benchXp } from './fixtures/m5/oracle.g2.cjs';

// The combined v25 pool offers Fate directly at seed 4, retaining enough HP for the loss-first case.
let route=createMatch(4),afterFinalBattle:MatchState;const battles:BattleRecord[]=[];
function fight(context:MatchState,archive:BattleRecord[]=battles):MatchState {
 const started=startMatchCombat(context);let s=accepted(started);const initial=s.combat!,events:MatchEvent[]=[...(started.ok?started.events:[])];
 while(s.phase==='combat'){const step=stepMatch(s);s=step.state;events.push(...step.events);}
 const terminal=s.combat!,ledger=events.filter((e):e is BattleRecord['events'][number]=>e.domain==='combat');
 const record=ownBattleRecord(deepFreeze({version:recordVersion(context),roundId:context.roundDefinitionId,runId:'batch5-fate',combatId:terminal.combatId!,context,initial,events:ledger,endTick:terminal.tick,nextEventSeq:terminal.nextEventSeq!,result:terminal.result,stateHash:digestContent(terminal),eventHash:digestContent(ledger)}));
 replayBattleRecord(record);archive.push(record);
 return resolveM5Choices(s);
}
for(const stop of ['1-2','1-3','2-1','2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2','3-3','3-4','3-5','3-6','3-7','4-1','4-2'])it(`Fate public route ${stop}`,()=>{
 while(route.roundDefinitionId!==stop){route=resolveM5Choices(route);if(route.phase==='preparation')route=fight(fieldBench(route));route=resolveM5Choices(route);if(route.roundDefinitionId==='4-1')afterFinalBattle=route;route=accepted(nextRound(route,route.round));}
 if(stop==='4-1')route=restoreMatch(serializeMatch(route,battles),battles);
});
let selected:MatchState;
it('Fate selects its actual offered card and grants exactly Blue Buff, with no retroactive entry/victory credit',()=>{
 for(let slot=0;slot<3&&!route.pendingChoice!.offers.includes('a-change-of-fate');slot++){const c=route.pendingChoice!;route=accepted(rerollAugment(route,c.choiceId,c.generation,slot));}
 const c=route.pendingChoice!;expect(c.offers).toContain('a-change-of-fate');selected=resolveM5Choices(accepted(selectChoice(route,c.choiceId,c.generation,'a-change-of-fate')));
 expect(selected.playerHp).toBeGreaterThan(8);
 expect(selected.items.filter(i=>i.definitionId==='blue-buff').length-route.items.filter(i=>i.definitionId==='blue-buff').length).toBe(1);
 expect(batch5FateRound(selected,selected.augments.at(-1)!)).toBeUndefined();expect(batch5RewardPlan(selected)).toEqual([]);
 const plan=rewardPlan(selected,{CATALOG,COST,ROUNDS,xp,entryXp,benchXp});expect(plan.gifts.filter(g=>g.definitionId==='blue-buff')).toHaveLength(1);expect(plan.gifts.filter(g=>g.definitionId==='mel')).toHaveLength(0);
});
let savedText:string;
it('serializes Fate with its independently replayed complete battle history',()=>{savedText=serializeMatch(selected,battles);expect(savedText).toBe(canonicalContent(selected));});
for(const mode of ['object','json','serialize'] as const)it(`Fate ${mode} restore entry retains gifts and rejects forged source, missing gift and unearned task reward`,()=>{
 const text=savedText;
 if(mode==='object')expect(restoreMatch(selected,battles)).toEqual(selected);
 else if(mode==='json')expect(restoreMatch(text,battles)).toEqual(selected);
 else expect(serializeMatch(restoreMatch(text,battles),battles)).toBe(text);
 for(const mutate of [
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.definitionId==='blue-buff').definitionId='gunblade';},
  (x:any)=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>r.definitionId!=='blue-buff');},
  (x:any)=>{x.roundResults.at(-1).result='playerWin';},
 ]){const x=JSON.parse(text);mutate(x);expect(()=>mode==='object'?restoreMatch(x,battles):mode==='json'?restoreMatch(JSON.stringify(x),battles):serializeMatch(x,battles)).toThrow();}
});
function receipt(s:MatchState,result:'win'|'loss'):RoundSettlementReceipt {
 return {version:ROUND_SETTLEMENT_VERSION,settlementId:'fate-'+s.round,battleId:'fate-'+s.round,seatId:'fate',round:s.round,roundId:s.roundDefinitionId,settlementEligible:true,result,damage:result==='win'?0:8,baseDamage:8,opposingSurvivors:0,growth:[],combatTicks:10,combatEventCount:2};
}
for(const order of ['win-first','bank-first'] as const)it(`Fate ${order}: real authoritative settlement/round commands pay exactly Mel and Gunblade once`,()=>{
 const enabled=enableMultiplayerSettlement(selected,'fate');expect(enabled.ok).toBe(true);if(!enabled.ok)throw Error(enabled.reason);let s=enabled.state;
 expect(s.gold).toBeGreaterThanOrEqual(60);
 const first=receipt(s,order==='win-first'?'win':'loss'),settled=applyRoundSettlement(s,first);expect(settled.ok).toBe(true);if(!settled.ok)throw Error(settled.reason);s=settled.state;
 expect(batch5RewardPlan(s)).toEqual([]);const advanced=nextRound(s,s.round);s=resolveM5Choices(accepted(advanced));
 if(order==='bank-first'){expect(batch5RewardPlan(s)).toEqual([]);const second=receipt(s,'win'),r=applyRoundSettlement(s,second);expect(r.ok).toBe(true);if(!r.ok)throw Error(r.reason);s=r.state;expect(applyRoundSettlement(s,second)).toEqual({ok:false,state:s,reason:'duplicate-settlement'});}
 const gifts=batch5RewardPlan(s);expect(gifts.map(g=>g.definitionId)).toEqual(['gunblade','mel']);
 for(const g of gifts)expect(s.seatMechanics!.receipts.filter(r=>r.receiptId===g.receiptId)).toHaveLength(1);
 expect(s.seatMechanics!.receipts.find(r=>r.kind==='unit'&&r.definitionId==='mel')).toMatchObject({kind:'unit',definitionId:'mel',resolution:'orb',unitId:null,gold:0});
 const plan=rewardPlan(s,{CATALOG,COST,ROUNDS,xp,entryXp,benchXp});expect(plan.gifts.filter(g=>g.definitionId==='mel')).toHaveLength(1);expect(plan.gifts.filter(g=>g.definitionId==='gunblade')).toHaveLength(1);
 expect(canonicalContent(gifts)).toBe(canonicalContent(batch5RewardPlan({...s,gold:0})));
 // Online snapshots remain outside the offline save format, as before this batch.
 expect(()=>serializeMatch(s,battles)).toThrow('multiplayer-state');
});
it('Fate uses the entry bank at the exact 59/60 boundary, ignores current/combat gold and delays supply-round champion births',()=>{
 const a={definitionId:'a-change-of-fate',choiceId:'boundary',acquiredRound:19},base=createMatch(42);
 const r=(round:number,goldAfter:number,result:string,roundKind='pvp')=>({round,roundId:ROUNDS[round-1].roundId,goldAfter,result,roundKind,mechanicReceiptPrefixLength:0});
 const state={...base,round:21,gold:999,augments:[a],roundResults:[r(19,59,'playerWin'),r(20,60,'enemyWin')]} as unknown as MatchState;
 expect(batch5FateRound({...state,round:20},a)).toBeUndefined();expect(batch5FateRound(state,a)).toBe(21);
 expect(batch5RewardPlan(state).map(g=>[g.definitionId,g.acquiredRound])).toEqual([['gunblade',21]]);
 const next={...state,round:22,roundResults:[...state.roundResults,r(21,60,'supply','supply')]} as MatchState;
 expect(batch5RewardPlan(next).map(g=>[g.definitionId,g.acquiredRound])).toEqual([['gunblade',21],['mel',22]]);
 expect(batch5FateRound({...state,roundResults:[r(18,999,'playerWin'),r(19,59,'enemyWin'),r(20,60,'enemyWin')]} as unknown as MatchState,a)).toBeUndefined();
});
// Place the receipted test witness before H12 starts the 4-2 offer proof. All subsequent history is replayed.
const completedHistory:BattleRecord[]=[];let completed:MatchState,completedText:string;
it('offline Fate completes from a real player-combat victory plus a subsequent 60-gold entry',()=>{
 completedHistory.push(...battles);
 const grant=grantMechanicUnit(afterFinalBattle,{receiptId:'batch5-victory-witness',source:'test',definitionId:'viktor',starLevel:3});expect(grant.ok).toBe(true);if(!grant.ok)throw Error(grant.reason);
 let s=restoreMatch(serializeMatch(grant.state,completedHistory),completedHistory);
 const unit=s.preparation.units.find(u=>u.definitionId==='viktor')!;
 s=accepted(nextRound(s,s.round));
 for(let slot=0;slot<3&&!s.pendingChoice!.offers.includes('a-change-of-fate');slot++){const c=s.pendingChoice!;s=accepted(rerollAugment(s,c.choiceId,c.generation,slot));}
 const c=s.pendingChoice!;expect(c.offers).toContain('a-change-of-fate');s=resolveM5Choices(accepted(selectChoice(s,c.choiceId,c.generation,'a-change-of-fate')));
 const front=s.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;
 s=accepted(deployMatchUnit(s,unit.id,front.location));
 const item=s.items.find(i=>i.definitionId==='blue-buff')!;s=accepted(equipItem(s,item.id,unit.id,0));s=fight(s,completedHistory);expect(s.roundResults.at(-1)?.result).toBe('playerWin');
 completed=resolveM5Choices(accepted(nextRound(s,s.round)));expect(batch5RewardPlan(completed).map(g=>g.definitionId)).toEqual(['gunblade','mel']);
 for(const g of batch5RewardPlan(completed))expect(completed.seatMechanics!.receipts.filter(r=>r.receiptId===g.receiptId)).toHaveLength(1);
 expect(completed.preparation.units.some(u=>u.definitionId==='mel')).toBe(true);
});
it('serializes the completed offline Fate quest against full real battle evidence',()=>{
 completedText=serializeMatch(completed,completedHistory);expect(completedText).toBe(canonicalContent(completed));
 expect(()=>restoreMatch(completed)).toThrow('missing historical evidence');
});
for(const mode of ['object','json','serialize'] as const)it(`completed Fate ${mode} restores once and rejects changing the rewarded unit, item or completion round`,()=>{
 const restore=(x:MatchState)=>mode==='object'?restoreMatch(x,completedHistory):mode==='json'?restoreMatch(canonicalContent(x),completedHistory):restoreMatch(serializeMatch(x,completedHistory),completedHistory);
 expect(restore(completed)).toEqual(completed);
 for(const mutate of [
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.definitionId==='mel').definitionId='warwick';},
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.definitionId==='gunblade').definitionId='blue-buff';},
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.definitionId==='mel').round--;},
 ]){const x=JSON.parse(completedText);mutate(x);expect(()=>restore(x)).toThrow();}
});
