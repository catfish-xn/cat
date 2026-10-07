import {describe,it,expect} from 'vitest';
import {selectTargets,selectAbilityTargets,chooseRandomCenter,coneCells,selectConeTargets,startingRows} from '../src/simulation/m8/targeting';
import {DEFAULT_BOARD} from '../src/simulation/board';
import {selector} from './fixtures/m8-contract-cases';
const unit=(id:string,col:number,row:number,team:'player'|'enemy'='enemy')=>({id,cell:{col,row},team,hp:100,maxHp:100,alive:true,untargetable:false});
const units=[unit('h',3,4,'player'),unit('p',3,3),unit('a',3,2),unit('b',4,3),unit('c',3,1),unit('d',6,3)];
const env={board:DEFAULT_BOARD,units,holderId:'h',primaryId:'p',tick:1};
describe('G10 frozen geometry and explicit random selection boundary',()=>{
 it('A04 fixed primary anchor givesp,a,b,c regardless of candidate input order; no RNG',()=>{
  const s=selector({primary:'first-required',relation:'enemy',anchor:'primary-target',maxTargets:4});
  expect(selectTargets(s,env)).toEqual(['p','a','b','c']);expect(selectTargets(s,{...env,units:[...units].reverse()})).toEqual(['p','a','b','c']);
  expect(selectTargets(s,{...env,units:units.map(u=>u.id==='p'?{...u,alive:false}:u)})).toEqual([]);
 });
 it('event-actor never falls back to closer units and a missing previous anchor has no candidates',()=>{
  expect(selectTargets(selector({candidates:'event-actor',relation:'enemy'}),{...env,eventActorId:'c'})).toEqual(['c']);
  expect(selectTargets(selector({candidates:'event-target',relation:'enemy'}),env)).toEqual([]);
  expect(selectTargets(selector({anchor:'previous-target',relation:'enemy'}),env)).toEqual([]);
 });
 it('Lux compares absoluteHP then distance/ID, healing uses ratio thenID',()=>{
  const world={...env,units:[unit('h',3,4,'player'),{...unit('a',3,3,'player'),hp:50,maxHp:100},{...unit('b',4,4,'player'),hp:60,maxHp:1000}]};
  expect(selectTargets(selector({relation:'ally',excludeSelf:true,order:'hp-absolute-distance-id'}),world)).toEqual(['a']);
  expect(selectTargets(selector({relation:'ally',excludeSelf:true,order:'hp-ratio-id'}),world)).toEqual(['b']);
 });
 it('Caitlyn one raw word modulo sorted count, selection separated from deterministic area expansion',()=>{
  let draws=0;const binding=chooseRandomCenter({...env,units:units.filter(u=>['h','a','b','c'].includes(u.id))},()=>{draws++;return 0xffffffff;});
  expect(binding).toBe('a');expect(draws).toBe(1);
  const target={kind:'random-enemy-center',areaOrder:'id',radius:1,rng:'combat',mapping:'word-modulo-id-sorted-count',draws:1} as const;
  expect(selectAbilityTargets(target,{...env,randomCenterId:binding}).targetIds).toEqual(['a','c','p']);
  expect(chooseRandomCenter({...env,units:[units[0]]},()=>{throw Error('empty draws0');})).toBeNull();
 });
 it('four-cell axial cone odd/even rows is finite, not radius; selects at most2 by primary distance/ID',()=>{
  expect(coneCells(DEFAULT_BOARD,{col:2,row:2},{col:3,row:2})).toEqual([{col:4,row:2},{col:5,row:2},{col:4,row:1},{col:4,row:3}]);
  expect(coneCells(DEFAULT_BOARD,{col:2,row:3},{col:3,row:3})).toEqual([{col:4,row:3},{col:5,row:3},{col:5,row:2},{col:5,row:4}]);
  const world={...env,units:[unit('h',2,2,'player'),unit('p',3,2),unit('b',4,2),unit('a',4,1),unit('c',5,2),unit('outside',3,3)]};
  expect(selectConeTargets(world)).toEqual(['b','a']);
  expect(coneCells(DEFAULT_BOARD,{col:5,row:2},{col:6,row:2})).toEqual([]);
 });
 it('front/back rows mirror player4/5,6/7 and enemy2/3,0/1',()=>{
  expect([4,5,6,7].map(row=>startingRows('player',row))).toEqual(['front-two','front-two','back-two','back-two']);
  expect([0,1,2,3].map(row=>startingRows('enemy',row))).toEqual(['back-two','back-two','front-two','front-two']);
 });
});
