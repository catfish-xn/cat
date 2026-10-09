import {beforeAll,describe,expect,it} from 'vitest';
import * as api from '../src/simulation/match';
import {accepted,reachRound,readyMatch,finish,emptyBoard} from './match-helpers';
import type {MatchState,MatchCommandResult} from '../src/simulation/match-types';
const states={} as Record<MatchState['phase'],MatchState>;
beforeAll(()=>{
 states.choice=reachRound('2-1',false);states.preparation=readyMatch();
 states.combat=accepted(api.startMatchCombat(states.preparation));states.settlement=finish(states.combat);
 // Explicit HP boundary fixture; never counted as a natural-route victory.
 states.gameOver=accepted(api.startMatchCombat(emptyBoard({...states.preparation,playerHp:1})));
 for(const [phase,state] of Object.entries(states))expect(state.phase).toBe(phase);
});
const preparationCommands:Record<string,(s:MatchState)=>MatchCommandResult>={
 buy:s=>api.buyUnit(s,0,s.shop.generation),sell:s=>api.sellUnit(s,'unit-1'),
 reroll:api.rerollShop,xp:api.buyXp,lock:s=>api.setShopLock(s,true,s.shop.generation),
 deploy:s=>api.deployMatchUnit(s,'unit-1',{kind:'bench',slot:0}),
 combine:s=>api.combineItems(s,'item-1','item-2'),equip:s=>api.equipItem(s,'item-1','unit-1',0),start:api.startMatchCombat,
};
function rejectUnchanged(state:MatchState,command:(s:MatchState)=>MatchCommandResult){
 const before=JSON.stringify(state),result=command(state);
 expect(result).toEqual({ok:false,state,reason:'wrong-phase'});expect(result.state).toBe(state);
 expect(JSON.stringify(state)).toBe(before);expect('events' in result).toBe(false);
}
describe('all phase-restricted commands preserve the entire rejected domain',()=>{
 it.each(['choice','combat','settlement','gameOver'] as const)('%s rejects every preparation command',phase=>{
  for(const command of Object.values(preparationCommands))rejectUnchanged(states[phase],command);
 });
 it.each(['preparation','combat','settlement','gameOver'] as const)('%s rejects every choice command',phase=>{
  const commands=[(s:MatchState)=>api.selectChoice(s,'old',0,'belt'),
   (s:MatchState)=>api.selectAnomalyTarget(s,'old',0,'unit-1'),(s:MatchState)=>api.rerollAnomaly(s,'old',0)];
  for(const command of commands)rejectUnchanged(states[phase],command);
 });
 it.each(['choice','preparation','combat','gameOver'] as const)('%s rejects Continue',phase=>{
  rejectUnchanged(states[phase],s=>api.nextRound(s,s.round));
 });
});
