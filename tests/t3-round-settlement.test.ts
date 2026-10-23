import { describe, expect, it } from 'vitest';
import { createMatch, enableMultiplayerSettlement, applyRoundSettlement, forfeitPendingChoice,
  claimOrDiscardLoot, startMatchCombat, stepMatch, nextRound, restoreMatch, snapshotForBattle,
  compileBattle, resolveTwoSidedBattle, proposeSettlement, ROUND_SETTLEMENT_VERSION,
  type MatchState, type MultiplayerCommandResult, type RoundSettlementReceipt } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { prepareMatchLoot } from '../src/simulation/loot-runtime';
import { createRoundEnemies } from '../src/simulation/round-enemies';
import { freeze } from './combat-helpers';

export function accepted(result: MultiplayerCommandResult): MatchState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
function timeout(state: MatchState): MatchState {
  return accepted(forfeitPendingChoice(state,state.round,state.pendingChoice?.choiceId??null,state.pendingChoice?.generation??null));
}
// Reach 2-1 through public commands: no fabricated opening receipts or history.
export function opening(seatId='A'): MatchState {
  let state=accepted(enableMultiplayerSettlement(createMatch(5),seatId));
  while (state.roundDefinitionId!=='2-1') {
    if (state.phase==='choice') state=timeout(state);
    else if (state.phase==='preparation') state=accepted(startMatchCombat(state));
    else if (state.phase==='combat') state=stepMatch(state).state;
    else state=accepted(nextRound(accepted(claimOrDiscardLoot(state,state.round)),state.round));
  }
  return state.phase==='choice'?timeout(state):state;
}
// Advanced transaction vectors isolate settlement from combat; not a restorable single-player save.
export function atRound(base:MatchState, roundId:string):MatchState {
  const round=getCatalogRoundById(roundId), enemies=createRoundEnemies(round.ordinal);
  return {...base,round:round.ordinal,roundDefinitionId:roundId,phase:'preparation',combat:null,pendingChoice:null,
    m8:{...base.m8,round,loot:prepareMatchLoot(base.seed,round.ordinal),preparation:{...base.m8.preparation,roundId,encounterId:round.encounterId,enemies}},
    preparation:{...base.preparation,units:[...base.preparation.units.filter(u=>u.team==='player'),...enemies]},
    roundResults:Array.from({length:round.ordinal-1},(_,i)=>({...base.roundResults[0],round:i+1}))};
}
export function receipt(state:MatchState, extra:Partial<RoundSettlementReceipt>={}):RoundSettlementReceipt {
  const baseDamage=state.m8.round.stage===4?8:2;
  return {version:ROUND_SETTLEMENT_VERSION,settlementId:`${state.round}:A`,battleId:`battle:${state.round}`,
    seatId:state.multiplayer!.seatId,round:state.round,roundId:state.roundDefinitionId,settlementEligible:true,
    result:'win',damage:0,baseDamage,opposingSurvivors:0,growth:[],combatTicks:88,combatEventCount:20,...extra};
}
const rejection=(state:MatchState,r:unknown,reason:string)=>{
  const before=JSON.stringify(state), result=applyRoundSettlement(freeze(state),r);
  expect(result).toEqual({ok:false,state,reason}); expect(result.state).toBe(state); expect(JSON.stringify(state)).toBe(before);
};

describe('T3 atomic round receipt',()=>{
  it('independent economy oracle commits gold, XP, growth and one event together without RNG',()=>{
    const base=opening();
    const state:MatchState={...base,gold:19,level:3,xp:0,streak:{kind:'win',count:1},
      preparation:{...base.preparation,units:[{id:'unit-1',definitionId:'tristana',team:'player',starLevel:1,location:{kind:'board',cell:{col:3,row:4}}}]},
      persistentGrowth:[{unitId:'unit-1',attackDamageBps:250}],
      augments:[{definitionId:'pumping-up-i',choiceId:'p',acquiredRound:4},{definitionId:'investment-strategy-i',choiceId:'i',acquiredRound:4}],
      augmentProgress:{pumpingRounds:2,investmentHp:8}};
    const r=receipt(state,{growth:[{unitId:'unit-1',attackDamageBps:125}]}), result=applyRoundSettlement(freeze(state),r), next=accepted(result);
    expect(next.gold).toBe(20); expect(next.xp).toBe(2); expect(next.level).toBe(3);
    expect(next.roundResults.at(-1)).toMatchObject({income:9,incomeBreakdown:{base:5,win:1,interest:2,streak:1},interestBasis:20});
    expect(next.persistentGrowth).toEqual([{unitId:'unit-1',attackDamageBps:375}]);
    expect(next.augmentProgress).toEqual({pumpingRounds:3,investmentHp:8});
    expect(result.ok&&result.events).toEqual([{type:'roundSettled',round:4,domain:'match',eventSeq:state.nextMatchEventSeq}]);
    for(const key of ['rngState','choiceRngState','rewardRngState','battleSeedRngState','equipmentState'] as const) expect(next[key]).toEqual(state[key]);
    expect(next.roundResults).toHaveLength(state.roundResults.length+1);
    rejection(next,r,'duplicate-settlement');
    rejection(next,{...r,settlementId:'different-id'},'already-settled');
    rejection(JSON.parse(JSON.stringify(next)),{...r,damage:999},'duplicate-settlement');
    const advanced=accepted(nextRound(next,next.round));
    expect(advanced.gold).toBe(28); expect(advanced.augmentProgress.investmentHp).toBe(24);
    expect(snapshotForBattle(advanced,'A').persistentGrowth).toEqual(next.persistentGrowth);
    expect(()=>restoreMatch(next)).toThrow('multiplayer-state');
  });
  it.each(['loss','draw'] as const)('%s uses existing loss streak and XP cap; raw damage survives HP clipping',result=>{
    const state={...opening(),gold:19,level:10,xp:0,playerHp:1,streak:{kind:'loss' as const,count:1}};
    const next=accepted(applyRoundSettlement(state,receipt(state,{result,damage:9,opposingSurvivors:7})));
    expect(next).toMatchObject({phase:'settlement',outcome:null,playerHp:0,gold:19,level:10,xp:0,multiplayer:{status:'eliminated'}});
    expect(next.roundResults.at(-1)).toMatchObject({playerDamage:9,hpLost:1,hpAfter:0,xpAwarded:0,streakAfter:{kind:'loss',count:2}});
    expect(nextRound(next,next.round).ok).toBe(false);
  });
  it('settles ten opposing survivors and natural XP from level nine to ten once',()=>{
    const state={...opening(),level:9,xp:67};
    const r=receipt(state,{result:'loss',damage:12,opposingSurvivors:10});
    const next=accepted(applyRoundSettlement(freeze(state),r));
    expect(next).toMatchObject({playerHp:state.playerHp-12,level:10,xp:0});
    expect(next.roundResults.at(-1)).toMatchObject({survivingEnemyCount:10,playerDamage:12,xpRequested:2,xpAwarded:1});
    rejection(next,r,'duplicate-settlement');
    rejection(state,{...r,opposingSurvivors:11,damage:13},'invalid-receipt');
  });
  it('rejects stale, mirror, missing, extra, invalid numeric and wrong-owner proposals unchanged',()=>{
    const state=opening(),r=receipt(state);
    rejection(state,{...r,round:3},'stale-round'); rejection(state,{...r,settlementEligible:false},'mirror-settlement');
    for(const patch of [{damage:-1},{damage:0.5},{damage:Number.MAX_SAFE_INTEGER+1},{combatTicks:1201},{seatId:'B'},
      {growth:[{unitId:'foreign',attackDamageBps:125}]},{extra:1},{settlementEligible:null},{opposingSurvivors:11}]) rejection(state,{...r,...patch},'invalid-receipt');
    for(const key of Object.keys(r)) {const missing={...r} as Record<string,unknown>;delete missing[key];rejection(state,missing,'invalid-receipt');}
    rejection({...state,gold:Number.MAX_SAFE_INTEGER},r,'invalid-receipt');
    rejection({...state,roundResults:[]},r,'unsettled-round');
    expect(startMatchCombat(state)).toEqual({ok:false,state,reason:'wrong-phase'});
  });
  it('stages both T2 proposals, discards a failed whole-round attempt, and retries deterministically',()=>{
    const a=opening('A'),b=opening('B'), before=JSON.stringify([a,b]);
    const battle=resolveTwoSidedBattle(compileBattle(snapshotForBattle(a,'A'),snapshotForBattle(b,'B'),42,{battleId:'pair'}),1201);
    const proposals=proposeSettlement(battle);
    const make=(s:MatchState,p:typeof proposals.a)=>receipt(s,{settlementId:`pair:${p.seatId}`,battleId:battle.battleId,
      result:p.result,damage:p.damage,baseDamage:p.baseDamage,opposingSurvivors:p.opposingSurvivors,
      growth:p.growth,combatTicks:battle.terminal.tick,combatEventCount:battle.events.length});
    const ra=make(a,proposals.a),rb=make(b,proposals.b);
    const staged=applyRoundSettlement(a,ra);expect(staged.ok).toBe(true);
    rejection(b,{...rb,round:3},'stale-round');expect(JSON.stringify([a,b])).toBe(before);
    const committed=[accepted(applyRoundSettlement(a,ra)),accepted(applyRoundSettlement(b,rb))];
    expect(committed[0]).toEqual(staged.state);
    for(const s of committed) {expect(s.multiplayer!.receipts).toHaveLength(1);expect(nextRound(s,s.round).ok).toBe(true);}
    expect(applyRoundSettlement(accepted(nextRound(committed[0],4)),ra)).toMatchObject({ok:false,reason:'duplicate-settlement'});
  });
  it('timeout resolves an empty anomaly without buying, and the receipt then permits nextRound',()=>{
    const base=atRound(opening(),'4-6'),state={...base,preparation:{...base.preparation,units:[]}};
    rejection(state,receipt(state),'wrong-phase');
    const skipped=timeout(state); expect(skipped.gold).toBe(state.gold);expect(skipped.multiplayer!.forfeitedChoices).toHaveLength(1);
    expect(forfeitPendingChoice(skipped,skipped.round,null,null)).toMatchObject({ok:false,reason:'no-pending-choice'});
    const settled=accepted(applyRoundSettlement(skipped,receipt(skipped,{result:'draw',damage:8})));
    expect(nextRound(settled,settled.round).ok).toBe(true);
  });
});

describe('T3 timeout default-first project rule',()=>{
  it('auto-selects the first augment, including its acquisition gold, exactly once',()=>{
    const base=opening(),choiceId='round:2-1:augment';
    const state:MatchState={...base,phase:'choice',combat:null,pendingChoice:{kind:'augment',step:'offer',choiceId,eventId:choiceId,generation:2,
      offers:['placebo','pumping-up-i'],targetId:null,rerollCount:0,returnPhase:'preparation'},
      scheduleReceipts:base.scheduleReceipts.filter(r=>r.eventId!==choiceId),augments:[]};
    const overflow={...state,gold:Number.MAX_SAFE_INTEGER};
    expect(forfeitPendingChoice(freeze(overflow),overflow.round,choiceId,2)).toEqual({ok:false,state:overflow,reason:'invalid-choice'});
    const next=timeout(freeze(state));
    expect(next.gold).toBe(state.gold+8); expect(next.augments.map(a=>a.definitionId)).toEqual(['placebo']);
    expect(next.scheduleReceipts.filter(r=>r.eventId===choiceId)).toHaveLength(1);
    expect(forfeitPendingChoice(next,next.round,choiceId,2)).toMatchObject({ok:false,state:next,reason:'stale-choice'});
    expect(nextRound(accepted(applyRoundSettlement(next,receipt(next))),next.round).ok).toBe(true);
  });
  it('selects the lowest unit ID and first anomaly offer without a paid reroll',()=>{
    const base=atRound(opening(),'4-6'),choiceId='round:4-6:anomaly';
    const state:MatchState={...base,phase:'choice',combat:null,pendingChoice:{kind:'anomaly',step:'target',choiceId,eventId:choiceId,generation:0,
      offers:[],targetId:null,rerollCount:0,returnPhase:'preparation'}};
    const result=forfeitPendingChoice(freeze(state),state.round,choiceId,0),next=accepted(result);
    expect(next.anomalyBinding?.unitId).toBe(state.preparation.units.filter(u=>u.team==='player').map(u=>u.id).sort()[0]);
    expect(next.gold).toBe(state.gold);expect(next.choiceRngState).not.toBe(state.choiceRngState);
    expect(result.ok&&result.events.some(e=>e.type==='anomalyRerolled')).toBe(false);
    expect(nextRound(accepted(applyRoundSettlement(next,receipt(next))),next.round).ok).toBe(true);
    const empty:MatchState={...state,preparation:{...state.preparation,units:[]}};
    const skipped=timeout(empty);expect(skipped.pendingChoice).toBeNull();expect(skipped.gold).toBe(empty.gold);
    expect(nextRound(accepted(applyRoundSettlement(skipped,receipt(skipped,{result:'draw',damage:8}))),skipped.round).ok).toBe(true);
  });
  it('selects the first supply component and settles supply income/XP once',()=>{
    const before=atRound(opening(),'2-3');
    const settled=accepted(applyRoundSettlement(before,receipt(before)));
    const supply=accepted(nextRound(settled,settled.round));
    expect(supply.roundDefinitionId).toBe('2-4');expect(supply.phase).toBe('choice');
    const first=supply.pendingChoice!.offers[0],next=timeout(supply);
    expect(next.items).toHaveLength(supply.items.length+1);expect(next.items.at(-1)?.definitionId).toBe(first);
    expect(next.roundResults).toHaveLength(supply.round);
    expect(next.gold).toBe(supply.gold);
    expect(accepted(nextRound(next,next.round)).gold).toBeGreaterThan(supply.gold);
    expect(forfeitPendingChoice(next,next.round,supply.pendingChoice!.choiceId,0)).toMatchObject({ok:false,reason:'stale-choice'});
    expect(nextRound(next,next.round).ok).toBe(true);
  });
  it('rejects stale timeout commands without changing resources or RNG',()=>{
    const state=opening();
    expect(forfeitPendingChoice(state,state.round-1,null,null)).toEqual({ok:false,state,reason:'stale-round'});
    expect(claimOrDiscardLoot(state,state.round-1)).toEqual({ok:false,state,reason:'stale-round'});
    expect(claimOrDiscardLoot(state,state.round)).toEqual({ok:false,state,reason:'wrong-phase'});
    const offline=createMatch(5);
    expect(forfeitPendingChoice(offline,1,null,null)).toMatchObject({ok:false,state:offline,reason:'multiplayer-required'});
    expect(claimOrDiscardLoot(offline,1)).toMatchObject({ok:false,state:offline,reason:'multiplayer-required'});
  });
});
