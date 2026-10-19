import {expect,it} from 'vitest';
import {advanceSpectralCutlass} from '../src/simulation/combat-g2-4b';
import {DEFAULT_BOARD} from '../src/simulation/board';
import {EMPTY_RUNTIME,type S13Unit} from '../src/simulation/combat-s13-state';
import type {AbilityContext} from '../src/simulation/combat-s13-abilities';
import {unit} from './combat-helpers';
import {createMatch,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';

function holder(id:string,col:number,row:number):S13Unit {
  return {...unit(id,'player',col,row),startingCell:{col,row},runtime:{...EMPTY_RUNTIME},
    shieldLayers:[],statuses:[],tasks:[],mechanics:[{mechanic:'g24SpectralCutlass',values:{durationTicks:160},
      source:{ownerId:id,sourceKind:'item',definitionId:'TFT_Item_Artifact_SpectralCutlass',instanceId:id+':item',effectIndex:3}}]};
}
const context=(units:S13Unit[],tick=0):AbilityContext=>({tick,board:DEFAULT_BOARD,units,events:[],packets:[],heals:[],draw:()=>{throw Error('Cutlass must not draw RNG');}});

it('teleports at tick zero, returns at tick160, and preserves the home through JSON',()=>{
  const ctx=context([holder('p',1,6)]);
  advanceSpectralCutlass(ctx);
  expect(ctx.units[0].cell).toEqual({col:5,row:1});
  expect(ctx.events).toEqual([{type:'movement',tick:0,unitId:'p',from:{col:1,row:6},to:{col:5,row:1}}]);
  const restored=context(JSON.parse(JSON.stringify(ctx.units)),159);
  advanceSpectralCutlass(restored);expect(restored.events).toHaveLength(0);
  restored.tick=160;advanceSpectralCutlass(restored);
  expect(restored.units[0].cell).toEqual({col:1,row:6});
  expect(restored.events).toHaveLength(1);
  advanceSpectralCutlass(restored);expect(restored.events).toHaveLength(1);
});

it('resolves occupied mirror and home deterministically without moving the occupant',()=>{
  const p=holder('p',1,6),enemy={...holder('enemy',5,1),team:'enemy' as const,mechanics:[]};
  const ctx=context([p,enemy]);advanceSpectralCutlass(ctx);
  expect(p.cell).not.toEqual(enemy.cell);expect(enemy.cell).toEqual({col:5,row:1});
  enemy.cell={col:1,row:6};ctx.tick=160;advanceSpectralCutlass(ctx);
  expect(p.cell).not.toEqual(enemy.cell);expect(enemy.cell).toEqual({col:1,row:6});
  expect(p.startingCell).toEqual({col:1,row:6});
});

it('never revives or returns a dead holder and fails closed without the home snapshot',()=>{
  const dead=holder('p',1,6);dead.alive=false;dead.hp=0;
  const ctx=context([dead],160);advanceSpectralCutlass(ctx);expect(ctx.events).toHaveLength(0);
  const missing=holder('q',1,6);delete missing.startingCell;
  expect(()=>advanceSpectralCutlass(context([missing]))).toThrow('Missing cutlass starting cell');
});

it('restores both the tick-zero and teleported public Match state and rejects forged home cells',()=>{
  const grant=grantMechanicItem(createMatch(42),{receiptId:'cutlass',source:'test',definitionId:'TFT_Item_Artifact_SpectralCutlass'});
  if(!grant.ok)throw Error(grant.reason);
  const owner=grant.state.preparation.units.find(u=>u.team==='player')!;
  const equip=equipItem(grant.state,grant.state.items.at(-1)!.id,owner.id,0);
  if(!equip.ok)throw Error(equip.reason);
  const start=startMatchCombat(equip.state);if(!start.ok)throw Error(start.reason);
  expect(restoreMatch(serializeMatch(start.state))).toEqual(start.state);
  const moved=stepMatch(start.state).state;
  expect(restoreMatch(serializeMatch(moved))).toEqual(moved);
  const forged=structuredClone(moved);
  Object.assign(forged.combat!.units.find(u=>u.id===owner.id)!,{startingCell:{col:0,row:0}});
  expect(()=>restoreMatch(forged)).toThrow();
});
