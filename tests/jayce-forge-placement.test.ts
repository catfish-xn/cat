import {expect,it,vi} from 'vitest';
import {snapshotForBattle,compileBattle,startTwoSidedCombat,enableMultiplayerSettlement} from '../src/server-entry';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
import {createMatch,deployMatchUnit,startMatchCombat,stepMatch,readItemSummons,moveItemSummon} from '../src/simulation/match';
import {grantMechanicUnit} from '../src/simulation/seat-mechanics';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import type {MatchState} from '../src/simulation/match-types';
vi.setConfig({ testTimeout: 20_000 });

/** P (user 2026-10-24): Jayce's Hextech Forge is on the board in preparation and the player moves it. */
function withJayce(cell={col:3,row:5},base=createMatch(42)){
 // Level 1: the opening Irelia goes to the bench so Jayce is the one fielded unit.
 const opening=deployMatchUnit(base,'unit-1',{kind:'bench',slot:0});if(!opening.ok)throw Error(opening.reason);
 const born=grantMechanicUnit(opening.state,{receiptId:'jayce',source:'test',definitionId:'jayce'});if(!born.ok)throw Error(born.reason);
 const jayce=born.state.preparation.units.find(u=>u.definitionId==='jayce')!;
 const deployed=deployMatchUnit(born.state,jayce.id,{kind:'board',cell});if(!deployed.ok)throw Error(deployed.reason);
 return {state:deployed.state,jayce:jayce.id};
}
const forgeOf=(state:MatchState)=>readItemSummons(state).find(s=>s.kind==='forge');

it('shows the forge behind its deployed Jayce in preparation, never as a roster unit, and not for a benched Jayce',()=>{
 const {state,jayce}=withJayce();
 const forge=forgeOf(state)!;
 expect(forge).toMatchObject({kind:'forge',ownerId:jayce,itemInstanceId:jayce,unit:{id:`${jayce}:g23-forge`,definitionId:'g23-forge',team:'player',location:{kind:'board',cell:{col:3,row:6}}}});
 expect(state.preparation.units.some(u=>u.id===forge.unit.id)).toBe(false);
 const benched=deployMatchUnit(state,jayce,{kind:'bench',slot:5});if(!benched.ok)throw Error(benched.reason);
 expect(forgeOf(benched.state)).toBeUndefined();
});

it('moves the forge to a free cell of my rows, keeps it there into combat and through save/restore',()=>{
 const {state,jayce}=withJayce();
 expect(moveItemSummon(state,jayce,{col:0,row:0})).toMatchObject({ok:false,reason:'outside-deployment-zone'});
 expect(moveItemSummon(state,jayce,{col:3,row:5})).toMatchObject({ok:false,reason:'occupied'});
 const moved=moveItemSummon(state,jayce,{col:6,row:7});if(!moved.ok)throw Error(moved.reason);
 expect(forgeOf(moved.state)!.unit.location).toEqual({kind:'board',cell:{col:6,row:7}});
 expect(moved.state.preparation).toEqual(state.preparation);
 expect(restoreMatch(serializeMatch(moved.state))).toEqual(moved.state);
 const started=startMatchCombat(moved.state);if(!started.ok)throw Error(started.reason);
 let current=started.state;
 expect(current.combat!.units.find(u=>u.id===`${jayce}:g23-forge`)!.cell).toEqual({col:6,row:7});
 for(let n=0;n<40&&current.phase==='combat';n++){
  if(n%20===0)expect(restoreMatch(serializeMatch(current))).toEqual(current);
  current=stepMatch(current).state;
 }
});

it('gives way to a unit placed on its cell (nearest free cell) and returns to its saved cell when Jayce comes back',()=>{
 const {state,jayce}=withJayce();
 const moved=moveItemSummon(state,jayce,{col:0,row:7});if(!moved.ok)throw Error(moved.reason);
 const other=moved.state.preparation.units.find(u=>u.team==='player'&&u.id!==jayce&&u.location.kind==='bench')!;
 const covered=deployMatchUnit({...moved.state,level:2},other.id,{kind:'board',cell:{col:0,row:7}});if(!covered.ok)throw Error(covered.reason);
 const cell=(forgeOf(covered.state)!.unit.location as {cell:{col:number;row:number}}).cell;
 expect(cell).not.toEqual({col:0,row:7});expect(Math.abs(cell.col-0)+Math.abs(cell.row-7)).toBeLessThanOrEqual(2);
 const benched=deployMatchUnit(moved.state,jayce,{kind:'bench',slot:5});if(!benched.ok)throw Error(benched.reason);
 const back=deployMatchUnit(benched.state,jayce,{kind:'board',cell:{col:2,row:4}});if(!back.ok)throw Error(back.reason);
 expect(forgeOf(back.state)!.unit.location).toEqual({kind:'board',cell:{col:0,row:7}});
});

it('carries the saved cell into a two-sided battle, mirrored for the upper seat',()=>{
 const base=createMatch(42),round=getCatalogRoundById('2-1');
 const {state,jayce}=withJayce(undefined,{...base,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round}});
 const moved=moveItemSummon(state,jayce,{col:6,row:7});if(!moved.ok)throw Error(moved.reason);
 const enabled=enableMultiplayerSettlement(moved.state,'A');if(!enabled.ok)throw Error(enabled.reason);
 const a=snapshotForBattle(enabled.state,'A'),b=snapshotForBattle(moved.state,'B');
 expect(a.itemSummonPositions).toEqual({[jayce]:{col:6,row:7}});
 const combat=startTwoSidedCombat(compileBattle(a,b,7));
 const forges=combat.units.filter(u=>u.definitionId==='g23-forge').map(u=>[u.team,u.cell]);
 expect(forges).toEqual(expect.arrayContaining([['player',{col:6,row:7}],['enemy',{col:6,row:0}]]));
});
