import { hash } from '../scripts/m4-evidence.cjs';
import { describe, expect, it, vi } from 'vitest';
import { MAX_BATTLE_RECORDS } from '../src/m6/limits';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { createMatch, deployMatchUnit, nextRound, selectChoice, startMatchCombat, stepMatch } from '../src/simulation/match';
import { prepareB6Opening } from '../scripts/b6-public-preparation.cjs';
import { B6_APPLICATION_CAPACITY, b6DeferredBrowserRounds, validateB6BrowserBoundary, skipB6Dependency } from '../scripts/b6-deferred-assertions.cjs';

// Domain-backed adapter checks setup commands and income only. It is explicitly
// NOT native browser evidence: CI separately exercises the real locator path.
function pageAdapter(seed=42) {
  let state=createMatch(seed);
  const accepted=result=>{expect(result.ok,result.reason).toBe(true);state=result.state;};
  return {
    evaluate:async()=>state,
    waitForTimeout:async()=>{},
    waitForFunction:async()=>{while(state.phase==='combat')state=stepMatch(state).state;},
    locator:selector=>({click:async()=>{
      const id=selector.match(/data-debug="([^"]+)"/)[1];
      if(id==='panel:units'||id==='mobile:unit:unit-1')return;
      if(id==='mobile:bench:0')accepted(deployMatchUnit(state,'unit-1',{kind:'bench',slot:0}));
      else if(id==='deploy:1,4')accepted(deployMatchUnit(state,'unit-1',{kind:'board',cell:{col:1,row:4}}));
      else if(id==='mobile:start-combat')accepted(startMatchCombat(state));
      else if(id==='mobile:continue')accepted(nextRound(state,state.round));
      else if(id.startsWith('choice:'))accepted(selectChoice(state,state.pendingChoice.choiceId,state.pendingChoice.generation,id.slice(7)));
      else throw Error(`Unexpected public setup selector ${id}`);
    }}),
  };
}
describe('B6 gate preparation and explicit dependency metadata',()=>{
  for(const [roundId,gold,hp] of [['1-3',2,97],['1-4',5,94],['2-1',10,91]])it(`earns ${gold}G legally before ${roundId}`,async()=>{
    const state=await prepareB6Opening(pageAdapter(),roundId);
    expect(state.m8.round.roundId).toBe(roundId);expect(state.phase).toBe('preparation');
    expect(state.gold).toBe(gold);expect(state.playerHp).toBe(hp);
    expect(state.preparation.units.find(unit=>unit.id==='unit-1').location).toEqual({kind:'board',cell:{col:1,row:4}});
  });
  it('stops on the real 2-1 augment rather than silently omitting modal coverage',async()=>{
    const state=await prepareB6Opening(pageAdapter(),'2-1',{resolveChoices:false,redeploy:false});
    expect(state.phase).toBe('choice');expect(state.pendingChoice.kind).toBe('augment');expect(state.gold).toBe(10);
  });
  it('obtains one actual 2-4 supply component and reaches the next legal equipment phase',async()=>{
    const state=await prepareB6Opening(pageAdapter(),'2-5');
    expect(state.phase).toBe('preparation');expect(state.m8.round.roundId).toBe('2-5');expect(state.items).toHaveLength(1);
    expect(state.scheduleReceipts.some(receipt=>receipt.kind==='component'&&receipt.itemIds[0]===state.items[0].id)).toBe(true);
  });
  it('reproduces public opening setup for the same seed',async()=>{
    expect(await prepareB6Opening(pageAdapter(4294967295),'1-3')).toEqual(await prepareB6Opening(pageAdapter(4294967295),'1-3'));
  });
  it('limits browser deferrals to the exact three B9 tail combats',()=>{
    expect(B6_APPLICATION_CAPACITY).toBe(MAX_BATTLE_RECORDS);
    const route={rounds:ROUND_CATALOG.filter(round=>round.kind!=='supply').map(round=>({roundDefinitionId:round.roundId,round:round.ordinal}))};
    expect(b6DeferredBrowserRounds(route).map(round=>round.roundDefinitionId)).toEqual(['6-5','6-6','6-7']);
    expect(()=>b6DeferredBrowserRounds({rounds:route.rounds.slice(1)})).toThrow('Unapproved B9 browser omission set');
  });
  it('rejects unknown browser omissions, missing prefix checkpoints and false full-route claims',()=>{
    // Synthetic metadata unit vectors only, never emitted as browser acceptance evidence.
    const rounds=ROUND_CATALOG.filter(round=>round.kind!=='supply').map(round=>{
      const after={phase:round.isFinal?'gameOver':'settlement',round:round.ordinal};
      return {roundDefinitionId:round.roundId,round:round.ordinal,after,stateHash:hash(after)};
    });
    // Start's immediate command state differs from the runner's settled observation.
    const actions=rounds.map((round,index)=>({index,round:round.round,command:{type:'start'},beforeHash:`before-${index}`,afterHash:hash({phase:'combat',round:round.round})}));
    const route={rounds,actions},deferred=rounds.slice(B6_APPLICATION_CAPACITY).map(round=>round.roundDefinitionId);
    const manifest={deferredBrowserRounds:deferred,completedBrowserRounds:rounds.slice(0,B6_APPLICATION_CAPACITY).map(round=>round.roundDefinitionId),
      applicationBoundary:{completedBattles:B6_APPLICATION_CAPACITY,roundId:'6-5',phase:'preparation',stateHash:'before-30'},
      checkpoints:actions.slice(0,B6_APPLICATION_CAPACITY).map(entry=>({index:entry.index,stateHash:rounds.find(round=>round.round===entry.round).stateHash})),fullApplicationRoutePassed:false,
      skipped:[...deferred.map(id=>({status:'skipped',owner:'B9',id:`browser-round-${id}`})),{status:'skipped',owner:'B9',id:'browser-complete-application-route'}]};
    expect([...validateB6BrowserBoundary(manifest,route)]).toEqual(rounds.slice(B6_APPLICATION_CAPACITY).map(round=>round.round));
    for(const mutate of [value=>value.deferredBrowserRounds.shift(),value=>value.completedBrowserRounds.pop(),value=>value.checkpoints.pop(),
      value=>value.applicationBoundary.stateHash='wrong',value=>value.checkpoints[0].stateHash=actions[0].afterHash,value=>value.fullApplicationRoutePassed=true,value=>value.skipped.push({status:'skipped',owner:'B8',id:'extra'})]){
      const invalid=structuredClone(manifest);mutate(invalid);expect(()=>validateB6BrowserBoundary(invalid,route)).toThrow();
    }
    const forged=structuredClone(route);forged.rounds[0].after.phase='combat';
    expect(()=>validateB6BrowserBoundary(manifest,forged)).toThrow('completed domain state hash');
    const duplicate=structuredClone(route);duplicate.rounds[1].round=duplicate.rounds[0].round;
    expect(()=>validateB6BrowserBoundary(manifest,duplicate)).toThrow('exactly one');
    // Non-Start commands still compare their immediate public-command result.
    const withDeploy=structuredClone(route),withDeployManifest=structuredClone(manifest);
    withDeploy.actions.splice(1,0,{index:1,round:rounds[0].round,command:{type:'deploy'},beforeHash:rounds[0].stateHash,afterHash:'deploy-after'});
    withDeploy.actions.forEach((action,index)=>action.index=index);
    withDeployManifest.checkpoints.splice(1,0,{index:1,stateHash:'deploy-after'});
    withDeployManifest.checkpoints.forEach((checkpoint,index)=>checkpoint.index=index);
    expect(()=>validateB6BrowserBoundary(withDeployManifest,withDeploy)).not.toThrow();
    withDeployManifest.checkpoints[1].stateHash=rounds[0].stateHash;
    expect(()=>validateB6BrowserBoundary(withDeployManifest,withDeploy)).toThrow('observed domain phase');
  });
  it('records skipped ownership without executing or labeling the body passed',()=>{
    const body=vi.fn(),report={};const log=vi.spyOn(console,'log').mockImplementation(()=>{});
    try{skipB6Dependency(report,'B8','opening-loot','B8 integration pending',body);
      expect(body).not.toHaveBeenCalled();expect(report).toEqual({skipped:[{status:'skipped',owner:'B8',id:'opening-loot',reason:'B8 integration pending'}]});
      expect(log).toHaveBeenCalledWith('SKIPPED [B8] opening-loot: B8 integration pending');
      expect(()=>skipB6Dependency(report,'B6','anything','not authorized',body)).toThrow();
    }finally{log.mockRestore();}
  });
});
