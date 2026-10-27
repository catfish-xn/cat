import { snapshotForBattle, restorePlayerBattleSnapshot } from '../src/simulation/two-sided-snapshot';
import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { AUGMENT_BATCH5_R6 } from '../src/simulation/content/augment-pool-batch5-r6';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { transformRecombobulator, bindBatch5R6Stock } from '../src/simulation/augment-pool-batch5-r6';
import { recordAugmentAcquisition, recordAugmentGrowth, readAugmentGrowth } from '../src/simulation/augment-history';
import { createMatch } from '../src/simulation/match';
import { enableMultiplayerSettlement } from '../src/simulation/round-settlement';
import { draftPool, reconcileHoldings } from '../src/simulation/shared-pool-ledger';
import { createSharedPool } from '../src/simulation/shared-pool';
import { augmentPool, batch5TransformPlan as batch5Transforms } from './fixtures/m5/oracle.g2.cjs';
import type { Unit } from '../src/simulation/units';
import type { MatchState } from '../src/simulation/match-types';
const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
const id='recombobulator';
const unit=(id:string,definitionId:string,col:number,starLevel:1|2|3=1):Unit=>({id,definitionId,starLevel,team:'player',location:{kind:'board',cell:{row:4,col}}});
function fixture(units:Unit[]):MatchState {
  const r=enableMultiplayerSettlement(createMatch(22),'s0');if(!r.ok)throw Error(r.reason);
  const before={...r.state,round:12,roundDefinitionId:'3-2',preparation:{...r.state.preparation,units}} as MatchState;
  return recordAugmentAcquisition(before,{...before,augments:[{definitionId:id,choiceId:'round:3-2:augment',acquiredRound:12}]});
}
const policy=(stock:Record<string,number>)=>bindBatch5R6Stock(drop=>drop.payload,stock);
it('B5-28 source gives exactly two removers; silver offers are 3-2/4-2 only',()=>{
 const source=(existsSync(RESEARCH_FILE)?JSON.parse(readFileSync(RESEARCH_FILE,'utf8')):[{apiName:'TFT6_Augment_Recombobulator',effects:{ NumRemovers: 2 }}]).find((r:any)=>r.apiName==='TFT6_Augment_Recombobulator');
 expect(AUGMENT_BATCH5_R6[id].source.values).toEqual(source.effects);expect(AUGMENT_BATCH5_R6[id].gifts).toEqual([{kind:'consumable',definitionId:'magnetic-remover',count:2}]);
 expect(AUGMENT_TIERS[id]).toBe('silver');
 for(const node of ['2-1','3-2','4-2']){expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(node!=='2-1');expect(augmentPool('silver',[],[],`round:${node}:augment`,[]).includes(id)).toBe(node!=='2-1');}
});
it.each([1,2,3] as const)('preserves %i-star equipment/growth, drops anomaly, and exchanges 1/3/9 real pool copies',star=>{
 let s=fixture([unit('unit-1','tristana',0,star),{...unit('bench','amumu',0),location:{kind:'bench',slot:8}}]);
 s={...s,items:[{id:'item-1',definitionId:'sword',location:{kind:'unit',unitId:'unit-1',slot:0}}],persistentGrowth:[{unitId:'unit-1',attackDamageBps:375}],anomalyBinding:{unitId:'unit-1',definitionId:'bulwark',choiceId:'anomaly',boundRound:12},sharedPool:{poolId:'p',seatId:'s0',revision:0}};
 s=recordAugmentGrowth(s,'round:3-2:augment','fixture-growth',[{unitId:'unit-1',healthFlat:50,healthBps:100,attackDamageBps:150,abilityPowerCenti:150}]);
 const copies=3**(star-1),pool=draftPool(createSharedPool('p',22,{seatCount:1}));
 // A finite test inventory: one complete target, no other stocked tier-3 definitions.
 for(const key of Object.keys(pool.available))pool.available[key]=0;
 pool.available.gangplank=copies;pool.holdings=[{seatId:'s0',unitId:'unit-1',definitionId:'tristana',sources:Array.from({length:copies},(_,i)=>`copy-${i}`)}];
 const expected=batch5Transforms(s,id,pool.available),r=transformRecombobulator(s,policy(pool.available));
 expect(r.state.preparation.units).toEqual(expected.units);expect(r.state.items).toEqual(s.items);expect(r.state.persistentGrowth).toEqual(s.persistentGrowth);expect(r.state.anomalyBinding).toBeNull();
 expect(readAugmentGrowth(r.state,'unit-1')).toEqual(readAugmentGrowth(s,'unit-1'));
 const snapshot=snapshotForBattle(r.state,'s0');expect(snapshot.persistentGrowth).toEqual(s.persistentGrowth);
 expect(restorePlayerBattleSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
 reconcileHoldings(pool,s,r.state,[]);
 expect(pool.available).toEqual(expected.available);expect(pool.holdings[0]).toMatchObject({unitId:'unit-1',definitionId:'gangplank'});expect(pool.holdings[0].sources).toHaveLength(copies);
 expect(pool.available.tristana).toBe(copies);expect(pool.available.gangplank).toBe(0);
 expect(transformRecombobulator(r.state,policy(pool.available))).toEqual({state:r.state,events:[]});
 expect(r.state.rngState).toBe(s.rngState);expect(r.state.choiceRngState).toBe(s.choiceRngState);
});
it('caps five-cost output, leaves six-cost inputs, bench and summons untouched',()=>{
 const s=fixture([unit('five','caitlyn',0),unit('six','mel',1),unit('dummy','training-dummy',2),{...unit('bench','amumu',0),location:{kind:'bench',slot:6}}]);
 const stock={caitlyn:0,jinx:1,mel:3,viktor:3,rell:1},expected=batch5Transforms(s,id,stock),r=transformRecombobulator(s,policy(stock));
 expect(r.state.preparation.units).toEqual(expected.units);expect(r.state.preparation.units.find(u=>u.id==='five')!.definitionId).toBe('jinx');
 for(const id of ['six','dummy','bench'])expect(r.state.preparation.units.find(u=>u.id===id)).toEqual(s.preparation.units.find(u=>u.id===id));
 expect(r.state.resourceProvenance.entries.filter(e=>e.kind==='unit-transformed')).toHaveLength(1);
});
it('rejects partial target stars without changing the unit or its anomaly',()=>{
 const s={...fixture([unit('unit-1','amumu',0,3)]),anomalyBinding:{unitId:'unit-1',definitionId:'bulwark',choiceId:'anomaly',boundRound:12}};
 const r=transformRecombobulator(s,policy({rell:8,amumu:0}));expect(r.state.preparation).toEqual(s.preparation);expect(r.state.anomalyBinding).toEqual(s.anomalyBinding);
 expect(r.state.resourceProvenance.entries.filter(e=>e.kind==='unit-transformed')).toEqual([]);
});
it('defers board triples until every original target is processed',()=>{
 const s=fixture([unit('unit-1','amumu',0),unit('b','amumu',1),unit('c','amumu',2)]),stock={amumu:0,rell:3};
 const expected=batch5Transforms(s,id,stock),r=transformRecombobulator(s,policy(stock));expect(r.state.preparation.units).toEqual(expected.units);
 expect(r.state.preparation.units).toEqual([unit('unit-1','rell',0,2)]);
 expect(r.state.resourceProvenance.entries.slice(-5).map(e=>e.kind)).toEqual(['unit-transformed','unit-transformed','unit-transformed','unit-upgraded-after-combat','augment-transform-completed']);
});
it('solo and absent-owner calls remain safe',()=>{
 const s=fixture([unit('unit-1','amumu',0)]);expect(transformRecombobulator({...s,multiplayer:undefined}).events).toEqual([]);expect(transformRecombobulator({...s,augments:[]},policy({rell:1})).state.augments).toEqual([]);
});
