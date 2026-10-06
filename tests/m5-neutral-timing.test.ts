import {describe,expect,it} from 'vitest';
import {createCombat,stepCombat} from '../src/simulation/combat';
import {readCombatStats} from '../src/simulation/combat-s13';
import {DEFAULT_BOARD} from '../src/simulation/board';

// R7 publishes exact integer neutral intervals, not rounded attacks/second.
// This is a small numerical fixture, not a normal-acquisition route.
describe('M5 PvE authored integer attack timing',()=>{
 it.each([[2,25],[3,23],[4,22],[5,20],[6,18]])('stage %i attacks every %i ticks',(stage,period)=>{
  let state=createCombat({board:DEFAULT_BOARD,benchSize:9,units:[
   {id:'p',definitionId:'irelia',team:'player',starLevel:1,location:{kind:'board',cell:{col:3,row:4}}},
   {id:'e',definitionId:`neutral-stage-${stage}`,team:'enemy',starLevel:1,location:{kind:'board',cell:{col:3,row:3}}},
  ]});
  state={...state,units:state.units.map(u=>u.id==='p'?{...u,hp:100000,maxHp:100000,attackDamage:0,attackDamageBase:0,mana:0,cooldownTicks:1000}:u)};
  const neutral=state.units.find(u=>u.id==='e')!;
  expect(readCombatStats(neutral,state).attackIntervalTicks).toBe(period);
  const attacks:number[]=[];
  for(let i=0;i<period*2+1;i++){
   const step=stepCombat(state);state=step.state;
   for(const event of step.events)if(event.type==='attack'&&event.attackerId==='e')attacks.push(event.tick);
  }
  expect(attacks).toEqual([1,1+period,1+2*period]);
 });
});
