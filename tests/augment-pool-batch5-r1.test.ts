import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
import { AUGMENT_BATCH5_R1 } from '../src/simulation/content/augment-pool-batch5-r1';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { tombRaiderCandidates, tombRaiderOpportunities } from '../src/simulation/augment-pool-batch5-r1';
import type { HistorySeat } from '../src/simulation/augment-history-types';
import type { MatchState } from '../src/simulation/match-types';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { G24_FORGE_POOLS } from '../src/simulation/content/g2-4-forges';

const hero = Object.values(UNIT_DEFINITIONS).find(u => !u.summon && u.unitKind !== 'neutral')!.id;
const item = G24_FORGE_POOLS.TFT_ArmoryKeyCompleted[0];
function seat(id:string, rank:number, alive=true, equipped=true):HistorySeat {
  return {seatId:id,index:rank-1,hp:alive?10:0,alive,rank,eliminatedRound:alive?null:5,
    units:[{id:`u-${id}`,definitionId:hero,team:'player',starLevel:1,location:{kind:'bench',slot:0}}],
    items:equipped?[{id:`i-${id}`,definitionId:item,location:{kind:'unit',unitId:`u-${id}`,slot:0}}]:[]};
}
function history(id:'tomb-raider-1'|'tomb-raider-2'):MatchState {
  const seats=[seat('self',1),seat('old',8,false),seat('a',7),seat('b',6),seat('c',5),seat('d',4)];
  const dead=(s:HistorySeat)=>({...s,alive:false,hp:0,eliminatedRound:5});
  return {augments:[{definitionId:id,choiceId:'choice',acquiredRound:4}],augmentHistory:{version:'augment-history-v1',seatId:'self',proof:{kind:'server'},facts:[
    {kind:'acquire',sequence:0,seatId:'self',round:4,choiceId:'choice'},
    {kind:'table',stage:'acquire',sequence:1,seatId:'self',round:4,seats},
    {kind:'table',stage:'settlement',sequence:2,seatId:'self',round:5,seats:seats.map(s=>s.seatId==='a'?{...dead(s),items:[]}:s.seatId==='b'?dead(s):s)},
    {kind:'table',stage:'settlement',sequence:3,seatId:'self',round:6,seats:seats.map(s=>['a','b','c','d'].includes(s.seatId)?dead(s):s)},
  ]}} as unknown as MatchState;
}
describe('B5-39 candidate planner',()=>{
 it.skipIf(!existsSync(RESEARCH_FILE))('matches the independent 14.24 source values',()=>{
  const archive=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')) as {apiName:string;effects:unknown;tier:number}[];
  const row=archive.find(x=>x.apiName==='TFT_Augment_TombRaider1');
  expect(row?.effects).toEqual({NumDead:3}); expect(row?.tier).toBe(2);
  expect(AUGMENT_BATCH5_R1['tomb-raider-1'].values).toEqual(row?.effects);
 });
 it('counts an empty opportunity, sorts simultaneous eliminations by rank, and stops after three',()=>{
  const r=tombRaiderOpportunities(history('tomb-raider-1'),'choice');
  expect(r.map(x=>x.seatId)).toEqual(['a','b','c']);
  expect(r[0].candidates).toEqual([]);
  expect(r[1].candidates).toEqual([{itemId:'i-b',definitionId:item,unitId:'u-b'}]);
 });
 it('excludes inventory, components and nonhero holders while preserving all eligible copies',()=>{
  const s=seat('x',1);
  const unit=s.units[0];
  const v:HistorySeat={...s,units:[unit,{...unit,id:'enemy',team:'enemy'}],items:[...s.items,
   {id:'copy',definitionId:item,location:{kind:'unit',unitId:unit.id,slot:1}},
   {id:'inventory',definitionId:item,location:{kind:'inventory'}},
   {id:'component',definitionId:'bow',location:{kind:'unit',unitId:unit.id,slot:2}},
   {id:'enemy-item',definitionId:item,location:{kind:'unit',unitId:'enemy',slot:0}}]};
  expect(tombRaiderCandidates(v).map(x=>x.itemId)).toEqual(['i-x','copy']);
 });
});
describe('B5-40 candidate planner',()=>{
 it.skipIf(!existsSync(RESEARCH_FILE))('matches the source value without using it as an opportunity cap',()=>{
  const archive=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')) as {apiName:string;effects:unknown;tier:number}[];
  const row=archive.find(x=>x.apiName==='TFT_Augment_TombRaider2');
  expect(row?.effects).toEqual({NumDead:9}); expect(row?.tier).toBe(3);
  expect(AUGMENT_BATCH5_R1['tomb-raider-2'].values).toEqual(row?.effects);
 });
 it('excludes every registered emblem and radiant, artifact and support pool member',()=>{
  const excluded=Object.values(ITEM_DEFINITIONS).filter(d=>d.kind==='radiant'||d.emblemTrait).map(d=>d.id)
    .concat([...G24_FORGE_POOLS.TFT_ArmoryKeyOrnn,...G24_FORGE_POOLS.TFT_ArmoryKeySupport]);
  expect(excluded.length).toBeGreaterThan(0);
  const base=seat('x',1), holder=base.units[0].id;
  const v:HistorySeat={...base,items:excluded.map((definitionId,i)=>({id:`special-${i}`,definitionId,location:{kind:'unit',unitId:holder,slot:i}}))};
  expect(tombRaiderCandidates(v)).toEqual([]);
 });
 it('does not count prior eliminations and has no three-player cap',()=>{
  expect(tombRaiderOpportunities(history('tomb-raider-2'),'choice').map(x=>x.seatId)).toEqual(['a','b','c','d']);
 });
});
