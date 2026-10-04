import { beforeAll, describe, expect, it } from 'vitest';
import generateRoute, { type Route, type Command } from '../scripts/generate-m4-route.cjs';
import * as api from '../src/simulation/match';
import { restoreMatch } from '../src/simulation/serialization';
import { freeze } from './match-helpers';
let route: Route;
beforeAll(async () => { route = await generateRoute(); }, 60000);
function dispatch(state:api.MatchState,c:Command):api.MatchCommandResult {
  switch(c.type) {
    case 'buy':return api.buyUnit(state,c.slot,c.generation);case 'sell':return api.sellUnit(state,c.id);
    case 'deploy':return api.deployMatchUnit(state,c.id,c.target);case 'reroll':return api.rerollShop(state);case 'buyXp':return api.buyXp(state);
    case 'combine':return api.combineItems(state,...c.ids);case 'equip':return api.equipItem(state,c.itemId,c.unitId,c.slot);
    case 'select':return api.selectChoice(state,c.choiceId,c.generation,c.definitionId);case 'target':return api.selectAnomalyTarget(state,c.choiceId,c.generation,c.unitId);
    case 'anomalyReroll':return api.rerollAnomaly(state,c.choiceId,c.generation);case 'start':return api.startMatchCombat(state);case 'continue':return api.nextRound(state,c.round);
  }
}
function replay(serialize=false,insert=false) {
  let state=api.createMatch(42), rejected=0;
  function check(expected:api.MatchState) {
    expect(state).toEqual(expected);
    if(serialize)state=restoreMatch(JSON.stringify(state));
    if(insert) {
      const before=structuredClone(state);freeze(state);
      const failures=[api.buyUnit(state,-1,state.shop.generation),api.sellUnit(state,'absent'),api.equipItem(state,'absent','absent',4),api.combineItems(state,'absent','absent'),api.selectChoice(state,'stale',-1,'absent'),api.nextRound(state,-1)];
      if(state.phase==='choice')failures.push(api.rerollShop(state),api.buyXp(state),api.startMatchCombat(state));
      if(state.phase==='preparation')failures.push(api.buyUnit(state,0,state.shop.generation-1));
      for(const result of failures){expect(result.ok).toBe(false);expect(result.state).toBe(state);expect('events' in result).toBe(false);rejected++;}
      expect(state).toEqual(before);
    }
  }
  check(route.initial);
  for(const round of route.rounds) {
    for(const action of round.preparationActions) {const result=dispatch(state,action.command);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason);expect(result.events).toEqual(action.events);state=result.state;check(action.after);}
    const result=api.startMatchCombat(state);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason);state=result.state;check(round.started);
    const events=[...result.events];
    while(state.phase==='combat'){const next=api.stepMatch(state);state=next.state;events.push(...next.events);check(round.atTick.get(state.combat!.tick)!);}
    expect(events).toEqual(round.events);check(round.settled);
    if(round.continuation){const result=dispatch(state,round.continuation.command);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason);expect(result.events).toEqual(round.continuation.events);state=result.state;check(round.continued);}
  }
  expect(state.phase).toBe('gameOver');return rejected;
}
describe('M4 complete versioned trajectory',()=>{
  it('replays every accepted command and tick deterministically',()=>{replay();},60000);
  it('restores validated JSON at every command and tick',()=>{replay(true);},60000);
  it('inserts rejected commands without moving any domain state, RNG, IDs or event sequence',()=>{expect(replay(true,true)).toBeGreaterThan(1000);},60000);
  it('keeps two concurrent sessions independent',()=>{const a=api.createMatch(42),b=api.createMatch(42);const next=api.rerollShop(a);expect(next.ok).toBe(true);expect(b).toEqual(api.createMatch(42));expect(api.createMatch(0).seed).toBe(0);});
  it('restores Game Over with no hidden settlement flag',()=>{const end=restoreMatch(JSON.stringify(route.final));expect(api.stepMatch(end)).toEqual({state:end,events:[]});expect(api.nextRound(end,end.round)).toEqual({ok:false,state:end,reason:'wrong-phase'});});
});
