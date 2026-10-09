import { describe, expect, it, vi } from 'vitest';
import { createMatch, deployMatchUnit, nextRound, selectChoice, startMatchCombat, stepMatch } from '../src/simulation/match';
import { prepareB6Opening } from '../scripts/b6-public-preparation.cjs';
import { skipB6Dependency } from '../scripts/b6-deferred-assertions.cjs';

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
  it('records skipped ownership without executing or labeling the body passed',()=>{
    const body=vi.fn(),report={};const log=vi.spyOn(console,'log').mockImplementation(()=>{});
    try{skipB6Dependency(report,'B8','opening-loot','B8 integration pending',body);
      expect(body).not.toHaveBeenCalled();expect(report).toEqual({skipped:[{status:'skipped',owner:'B8',id:'opening-loot',reason:'B8 integration pending'}]});
      expect(log).toHaveBeenCalledWith('SKIPPED [B8] opening-loot: B8 integration pending');
      expect(()=>skipB6Dependency(report,'B6','anything','not authorized',body)).toThrow();
    }finally{log.mockRestore();}
  });
});
