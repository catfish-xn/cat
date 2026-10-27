import { draftPool, reconcileHoldings } from '../src/simulation/shared-pool-ledger';
import { createSharedPool } from '../src/simulation/shared-pool';
import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { AUGMENT_BATCH5_R6 } from '../src/simulation/content/augment-pool-batch5-r6';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { transformPandorasBench } from '../src/simulation/augment-pool-batch5-r6';
import { recordAugmentAcquisition, recordAugmentRoundEntry } from '../src/simulation/augment-history';
import { createMatch } from '../src/simulation/match';
import { enableMultiplayerSettlement } from '../src/simulation/round-settlement';
import { augmentPool, batch5TransformPlan as batch5Transforms } from './fixtures/m5/oracle.g2.cjs';
import type { Unit } from '../src/simulation/units';
import type { MatchState } from '../src/simulation/match-types';

const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
const id = 'pandoras-bench';
const unit = (id: string, definitionId: string, slot: number, starLevel: 1|2|3 = 1): Unit => ({ id, definitionId, starLevel, team: 'player', location: { kind: 'bench', slot } });
function fixture(units: Unit[]): MatchState {
  const r = enableMultiplayerSettlement(createMatch(22), 's0'); if (!r.ok) throw Error(r.reason);
  const before = {...r.state,round:4,roundDefinitionId:'2-1',preparation:{...r.state.preparation,units}} as MatchState;
  const selected = recordAugmentAcquisition(before,{...before,augments:[{definitionId:id,choiceId:'round:2-1:augment',acquiredRound:4}]});
  return recordAugmentRoundEntry({...selected,round:5,roundDefinitionId:'2-2'});
}
it('B5-27 source numbers and all three silver offer nodes match the independent oracle',()=>{
  const rows=(existsSync(RESEARCH_FILE)?JSON.parse(readFileSync(RESEARCH_FILE,'utf8')):[{apiName:'TFT7_Augment_PandorasBench',effects:{ BenchSlots: 3, Gold: 2 }}]);
  expect(AUGMENT_BATCH5_R6[id].source.values).toEqual(rows.find((r:any)=>r.apiName==='TFT7_Augment_PandorasBench').effects);
  expect(AUGMENT_TIERS[id]).toBe('silver');
  for(const node of ['2-1','3-2','4-2']) {
    expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(true);
    expect(augmentPool('silver',[],[],`round:${node}:augment`,[])).toContain(id);
  }
});
it.each([1,2,3] as const)('preserves %i-star identity, equipment and permanent growth; exchanges complete copies',star=>{
  let s=fixture([unit('a','tristana',6,star),unit('left','amumu',5),{...unit('board','amumu',0),location:{kind:'board',cell:{col:0,row:4}}}]);
  s={...s,sharedPool:{poolId:'p',seatId:'s0',revision:0},items:[{id:'item-1',definitionId:'sword',location:{kind:'unit',unitId:'a',slot:0}}],persistentGrowth:[{unitId:'a',attackDamageBps:375}],
    anomalyBinding:{unitId:'a',definitionId:'bulwark',choiceId:'anomaly',boundRound:4}};
  const copies=3**(star-1), stock={tristana:0,rell:copies};
  const expected=batch5Transforms(s,id,stock), r=transformPandorasBench(s,stock);
  expect(r.state.preparation.units).toEqual(expected.units);
  expect(r.state.preparation.units.find(u=>u.id==='a')).toMatchObject({definitionId:'rell',starLevel:star,location:{kind:'bench',slot:6}});
  expect(r.state.items).toEqual(s.items);expect(r.state.persistentGrowth).toEqual(s.persistentGrowth);expect(r.state.anomalyBinding).toBeNull();
  expect(r.state.rngState).toBe(s.rngState);expect(r.state.choiceRngState).toBe(s.choiceRngState);expect(stock).toEqual({tristana:0,rell:copies});
  expect(expected.available).toEqual({tristana:copies,rell:0});
  const pool=draftPool(createSharedPool('p',22,{seatCount:1}));pool.available={...stock};
  pool.holdings=[{seatId:'s0',unitId:'a',definitionId:'tristana',sources:Array.from({length:copies},(_,i)=>`copy-${i}`)}];
  reconcileHoldings(pool,s,r.state,[]);expect(pool.available).toEqual(expected.available);
  expect(pool.holdings[0].definitionId).toBe('rell');expect(pool.holdings[0].sources).toHaveLength(copies);
  expect(transformPandorasBench(r.state,stock)).toEqual({state:r.state,events:[]});
});
it('short stock is a no-op for that unit, including its anomaly; empty slots and anvils do not transform',()=>{
  const units=[unit('a','amumu',6,2),unit('anvil','TFT_ArmoryKeyComponent',7)];let s=fixture(units);
  s={...s,anomalyBinding:{unitId:'a',definitionId:'bulwark',choiceId:'anomaly',boundRound:4}};
  const r=transformPandorasBench(s,{amumu:0,darius:2});
  expect(r.state.preparation.units).toEqual(units);expect(r.state.anomalyBinding).toEqual(s.anomalyBinding);
  expect(r.state.resourceProvenance.entries.filter(e=>e.kind==='unit-transformed')).toEqual([]);
});
it('processes slots 6,7,8 before any merge, even when slot 6 temporarily makes a triple',()=>{
  const s=fixture([unit('c','darius',8),unit('a','amumu',6),unit('b','darius',7)]), stock={amumu:0,darius:1};
  const expected=batch5Transforms(s,id,stock),r=transformPandorasBench(s,stock);
  expect(r.state.preparation.units).toEqual(expected.units);
  const facts=r.state.resourceProvenance.entries.filter(e=>e.kind==='unit-transformed');
  expect(facts.map(e=>e.unitId)).toEqual(['a','b','c']);
  expect(facts.map(e=>e.to)).toEqual(['darius','amumu','darius']);
  expect(r.state.preparation.units).toHaveLength(3);expect(r.events).toEqual([]);
});
it('merges only after the batch and carries growth and equipment into its survivor',()=>{
  const s=fixture([unit('a','amumu',0),unit('b','amumu',1),unit('c','darius',6)]);
  const r=transformPandorasBench({...s,persistentGrowth:[{unitId:'c',attackDamageBps:125}],items:[{id:'item-1',definitionId:'sword',location:{kind:'unit',unitId:'c',slot:0}}]},{darius:0,amumu:1});
  expect(r.state.preparation.units).toEqual([unit('a','amumu',0,2)]);
  expect(r.state.persistentGrowth).toEqual([{unitId:'a',attackDamageBps:125}]);
  expect(r.state.items[0].location).toEqual({kind:'unit',unitId:'a',slot:0});
  expect(r.state.resourceProvenance.entries.slice(-3).map(e=>e.kind)).toEqual(['unit-transformed','unit-upgraded-after-combat','augment-transform-completed']);
});
it('solo and acquisition-round hooks are safe and do not prematurely transform',()=>{
  const s=fixture([unit('a','amumu',6)]);
  expect(transformPandorasBench({...s,multiplayer:undefined},{amumu:1})).toEqual({state:{...s,multiplayer:undefined},events:[]});
  expect(transformPandorasBench({...s,round:4},{amumu:1}).state.preparation).toBe(s.preparation);
});
