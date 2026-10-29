import { expect, it } from 'vitest';
import { createMatch, nextRound, selectChoice, startMatchCombat, stepMatch, type MatchState, type MatchEvent } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { ownBattleRecord, deepFreeze, recordVersion } from '../src/simulation/battle-record-validation';
import { digestContent } from '../src/simulation/content';
import type { BattleRecord } from '../src/m6/contracts';
import { accepted, emptyBoard, resolveM5Choices } from './match-helpers';
import { batch5S3bSeed } from './augment-stage-helpers';
import { salvageRewardPlan } from '../src/simulation/augment-pool-batch5-s3b-salvage';

const history:BattleRecord[]=[];
let state=createMatch(batch5S3bSeed('salvage-bin'));
function fight(context:MatchState):MatchState{
 const started=startMatchCombat(context);let s=accepted(started);const initial=s.combat!,events:MatchEvent[]=[...(started.ok?started.events:[])];
 while(s.phase==='combat'){const result=stepMatch(s);s=result.state;events.push(...result.events);}
 const terminal=s.combat!,ledger=events.filter((e):e is BattleRecord['events'][number]=>e.domain==='combat');
 history.push(ownBattleRecord(deepFreeze({version:recordVersion(context),roundId:context.roundDefinitionId,runId:'s3b-history',combatId:terminal.combatId!,context,initial,events:ledger,endTick:terminal.tick,nextEventSeq:terminal.nextEventSeq!,result:terminal.result,stateHash:digestContent(terminal),eventHash:digestContent(ledger)})));
 return resolveM5Choices(s);
}
function advance(){state=resolveM5Choices(state);if(state.phase==='preparation')state=fight(emptyBoard(state));state=resolveM5Choices(state);state=accepted(nextRound(state,state.round));}
for(const stop of ['1-3','1-4','2-1'])it(`Salvage recorded public opening ${stop}`,()=>{while(state.roundDefinitionId!==stop)advance();});
it('Salvage acquisition gives no retroactive PvE credit',()=>{
 const c=state.pendingChoice!;expect(c.offers).toContain('salvage-bin');state=accepted(selectChoice(state,c.choiceId,c.generation,'salvage-bin'));expect(salvageRewardPlan(state)).toEqual([]);
 expect(restoreMatch(serializeMatch(state,history),history)).toEqual(state);
});
for(const stop of ['2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2'])it(`Salvage counts completed PvP only through ${stop}`,()=>{
 while(state.roundDefinitionId!==stop)advance();
 expect(salvageRewardPlan(state)).toEqual([]);
});
let threshold:MatchState,text:string;
it('Salvage awards one component at the seventh completed PvP, including the acquisition round',()=>{
 state=resolveM5Choices(state);state=fight(emptyBoard(state));threshold=state;
 const a=state.augments.find(a=>a.definitionId==='salvage-bin')!,pvp=state.roundResults.filter(r=>r.round>=a.acquiredRound&&r.roundKind==='pvp');expect(pvp).toHaveLength(7);
 const rewards=salvageRewardPlan(state);expect(rewards).toHaveLength(1);expect(rewards[0].acquiredRound).toBe(state.round);
 expect(state.seatMechanics!.receipts.filter(r=>r.receiptId===rewards[0].receiptId)).toHaveLength(1);
 text=serializeMatch(state,history);
});
it.each(['object','json','serialized'] as const)('Salvage seventh-combat %s restore replays history and rejects forged/missing reward or combat',mode=>{
 expect(mode==='serialized'?serializeMatch(restoreMatch(text,history),history):restoreMatch(mode==='json'?text:threshold,history)).toEqual(mode==='serialized'?text:threshold);
 expect(()=>restoreMatch(text)).toThrow('missing historical evidence');
 const reward=salvageRewardPlan(threshold)[0];
 for(const mutate of [
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.receiptId===reward.receiptId).definitionId='blue-buff';},
  (x:any)=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>r.receiptId!==reward.receiptId);},
  (x:any)=>{x.roundResults.find((r:any)=>r.roundKind==='pvp').roundKind='pve';},
 ]){
  const x=JSON.parse(text);mutate(x);expect(()=>mode==='serialized'?serializeMatch(x,history):restoreMatch(mode==='json'?JSON.stringify(x):x,history)).toThrow();
 }
 expect(()=>restoreMatch(text,history.slice(1))).toThrow();
});
it('Salvage continuation and restore never pay a second threshold reward',()=>{
 const reward=salvageRewardPlan(state)[0];state=accepted(nextRound(state,state.round));expect(state.roundDefinitionId).toBe('3-3');
 expect(salvageRewardPlan(state)).toEqual([reward]);expect(state.seatMechanics!.receipts.filter(r=>r.receiptId===reward.receiptId)).toHaveLength(1);
 expect(restoreMatch(serializeMatch(state,history),history)).toEqual(state);
});
