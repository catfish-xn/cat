import { describe, expect, it } from 'vitest';
import { createMatch, decideBotAction, getDeploymentCap, type MatchState, type Unit } from '../src/server-entry';
import { accepted, context, execute } from './t7-helpers';

// Live v26 playtest: with the 魔像训练师 opening every bot bought units that never left the bench.
const golem=(cell:{col:number;row:number}):Unit=>({id:'u-golem',definitionId:'trainer-golem',team:'player',starLevel:1,location:{kind:'board',cell}});
const bench=(id:string,definitionId:string,slot:number,starLevel:1|2|3=1):Unit=>({id,definitionId,team:'player',starLevel,location:{kind:'bench',slot}});
function seat(level:number,units:readonly Unit[]):MatchState {
  const base=createMatch(42);
  return {...base,level,xp:0,gold:0,preparation:{...base.preparation,units:[...units,...base.preparation.units.filter(u=>u.team==='enemy')]}};
}
function settle(state:MatchState):MatchState {
  for(let i=0;i<40;i++) {
    const d=decideBotAction(state,context(state),0);
    if(d.action==='done'||d.action.type!=='deploy') return state;
    state=accepted(execute(state,d.action));
  }
  throw new Error('Formation did not converge');
}
const fielded=(state:MatchState)=>state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&u.definitionId!=='trainer-golem');
const zoneFront=(state:MatchState)=>{const z=state.preparation.board.deploymentZones.player,e=state.preparation.board.deploymentZones.enemy;return e.firstRow>z.lastRow?z.lastRow:z.firstRow;};

describe('bot formation around a board-locked trainer golem',()=>{
  it('fields bench units up to the cap; the golem neither blocks a cell nor takes a population slot',()=>{
    const probe=seat(1,[]),row=zoneFront(probe);
    for(const level of [1,2,3,4]) {
      const units=[golem({col:3,row}),bench('u-a','maddie',0),bench('u-b','lux',1),bench('u-c','maddie',2),bench('u-d','lux',3),bench('u-e','maddie',4)];
      const state=settle(seat(level,units)),cap=getDeploymentCap(state);
      expect(fielded(state)).toHaveLength(Math.min(cap,5));
      const g=state.preparation.units.find(u=>u.id==='u-golem')!;
      expect(g.location).toEqual({kind:'board',cell:{col:3,row}});
    }
  });
  it('still fields units when the golem sits on any other front cell',()=>{
    const probe=seat(2,[]),columns=probe.preparation.board.columns,z=probe.preparation.board.deploymentZones.player;
    for(let row=z.firstRow;row<=z.lastRow;row++) for(let col=0;col<columns;col++) {
      const state=settle(seat(2,[golem({col,row}),bench('u-a','maddie',0),bench('u-b','lux',1),bench('u-c','maddie',2)]));
      expect(fielded(state)).toHaveLength(getDeploymentCap(state));
    }
  });
});
