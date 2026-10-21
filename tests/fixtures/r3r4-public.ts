import { combineItems, createMatch, buyUnit, rerollShop, deployMatchUnit, selectChoice, startMatchCombat, stepMatch, nextRound, sellUnit } from '../../src/simulation/match';
import type { MatchState, MatchCommandResult } from '../../src/simulation/match-types';
export function accepted(result:MatchCommandResult):MatchState { if(!result.ok) throw Error(result.reason); return result.state; }
export function finish(state:MatchState):MatchState {
  state=accepted(startMatchCombat(state));
  for(let i=0;state.phase==='combat'&&i<1201;i++)state=stepMatch(state).state;
  if(state.phase!=='settlement')throw Error(`Unexpected phase ${state.phase}`);return state;
}
const cached = new Map<number,MatchState>();
/** Seed 26 has a signed 2-7 prismatic package. Every asset is acquired by public commands. */
export function publicConsumables(seed=27566):MatchState {
  if(seed===162)seed=27566; // v17 independent oracle: two gloves, remover and reforger through 2-7.
  if(cached.has(seed))return structuredClone(cached.get(seed)!);
  let state=createMatch(seed);
  while(state.round<=10){
    while(state.phase==='choice'){
      const c=state.pendingChoice!;state=accepted(selectChoice(state,c.choiceId,c.generation,c.offers.find(id=>id==='bulky-buddies-i')??c.offers[0]));
    }
    if(state.phase==='preparation'){
      if(state.round===10)while(state.gold>=2){
        const slot:number=state.shop.slots.findIndex(o=>o.status==='available'&&['irelia','maddie','lux','darius','zyra'].includes(o.definitionId!));
        const result:MatchCommandResult=slot<0?rerollShop(state):buyUnit(state,slot,state.shop.generation);if(!result.ok)break;state=result.state;
      }
      for(const u of state.preparation.units.filter(u=>u.team==='player')){
        if(u.location.kind==='board')continue;
        const held=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');if(held.length>=state.level)break;
        const col=[3,2,4,1,5,0,6].find(col=>!held.some(u=>u.location.kind==='board'&&u.location.cell.col===col&&u.location.cell.row===7))!;
        state=accepted(deployMatchUnit(state,u.id,{kind:'board',cell:{col,row:7}}));
      }
      state=finish(state);
    }
    if(state.round===10)break;
    if(state.phase==='settlement')state=accepted(nextRound(state,state.round));
  }
  const gloves=state.items.filter(i=>i.definitionId==='gloves'&&i.location.kind==='inventory');
  if(gloves.length>=2)state=accepted(combineItems(state,gloves[0].id,gloves[1].id));
  while(state.m8.loot.direct.some(d=>d.status==='pending-capacity')){const reserve=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench')!;state=accepted(sellUnit(state,reserve.id));}
  cached.set(seed,state);return structuredClone(state);
}
