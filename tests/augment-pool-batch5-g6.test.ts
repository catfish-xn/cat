import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUGMENT_BATCH5_G6, CARRY_GOLEM } from '../src/simulation/content/augment-pool-batch5-g6';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { getUnitStats } from '../src/simulation/unit-stats';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { carryGolemEffects, carryGolemStar, growCarryGolem } from '../src/simulation/augment-pool-batch5-g6';
import { createMatch, selectChoice } from '../src/simulation/match';
import { getMultiplayerRoundById } from '../src/simulation/multiplayer-round';
import { validateContent } from '../src/simulation/validate-content';
import { accepted, reachRound } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
const require = createRequire(import.meta.url);
const oracle = require('./fixtures/m5/augment-pool-batch5-g6-oracle.cjs');
const id = 'im-the-carry-now';

it('registers only B5-83, preserves its 14.24 raw values, and respects all three existing offer nodes', () => {
  expect(Object.keys(AUGMENT_BATCH5_G6)).toEqual([id]);
  expect(AUGMENT_BATCH5_G6[id].source.values).toEqual({'{2d6883d7}':0.20000000298023224,'{8715634f}':475,'{92c6e7f9}':null});
  const file = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
  if (existsSync(file)) {
    const row = JSON.parse(readFileSync(file,'utf8')).find((r: {apiName:string}) => r.apiName === AUGMENT_BATCH5_G6[id].apiName);
    expect(row.effects).toEqual(AUGMENT_BATCH5_G6[id].source.values);
    expect(row.item_tags_raw).toEqual(['{b72bd3bf}','{cf1fd3af}']);
  }
  for (const node of ['2-1','3-2','4-2']) {
    const filter = {node,fieldedTraits:[],blocked:[]};
    expect(augmentCandidates('prismatic',[],[],null,filter)).toContain(id);
    expect(augmentCandidates('prismatic',[{definitionId:id,choiceId:'prior',acquiredRound:4}],[],null,filter)).not.toContain(id);
    expect(augmentCandidates('gold',[],[],null,filter)).not.toContain(id);
  }
  expect(() => validateContent()).not.toThrow();
});

describe('prototype and stage arithmetic, independent of receipts', () => {
  for (const stage of [2,3,4,5,6]) it(`stage ${stage}: star cap and cumulative growth`, () => {
    const round = getMultiplayerRoundById(`${stage}-1`).ordinal, expected = oracle.panel(stage);
    const star = carryGolemStar(round,4), stats = getUnitStats('carry-golem',star);
    expect(star).toBe(expected.star);
    expect(stats).toMatchObject({health:expected.health,attack:Math.floor(expected.attackCenti/100),attackRemainderCenti:expected.attackCenti%100,
      armor:40,magicResist:40,initialMana:30,maxMana:100,attackRange:1,baseAttackSpeedBps:5500});
    expect(resolveAbility('carry-golem-ability',star)).toMatchObject({variables:{Damage:expected.damage*10000}});
    const owner = {definitionId:id,choiceId:'round:2-1:augment',acquiredRound:4};
    const unit = {id:'unit-2',definitionId:'carry-golem',team:'player' as const,starLevel:star,location:{kind:'board' as const,cell:{col:3,row:4}}};
    expect(carryGolemEffects(round,owner,unit)).toEqual([{kind:'statFlat',stat:'maxHp',amount:expected.healthFlat},{kind:'statPercentBps',stat:'attackDamage',bps:expected.attackDamageBps}]);
    const s = {...createMatch(0),round,augments:[owner],preparation:{...createMatch(0).preparation,units:[unit]}};
    expect(growCarryGolem(s)).toBe(s);
    expect(CARRY_GOLEM.items).toEqual(['crownguard','bloodthirster','titans-resolve']);
    expect(carryGolemEffects(round,owner,{...unit,definitionId:'irelia'})).toEqual([]);
  });
  it('does not open four-star ordinary heroes',()=> {
    expect(()=>getUnitStats('irelia',4)).toThrow('star');
    expect(()=>resolveAbility('irelia-ability',4)).toThrow('star');
  });
  it('late acquisition starts at one, and existing stage-six overtime adds no new stage growth',()=>{
    for(const node of ['3-2','4-2']){
      const acquired=getMultiplayerRoundById(node).ordinal;
      expect(carryGolemStar(acquired,acquired)).toBe(1);
      expect(carryGolemStar(getMultiplayerRoundById(`${Number(node[0])+1}-1`).ordinal,acquired)).toBe(2);
    }
    const round=getMultiplayerRoundById('overtime-20').ordinal;
    expect(carryGolemStar(round,4)).toBe(4);
    const owner={definitionId:id,choiceId:'round:2-1:augment',acquiredRound:4};
    expect(carryGolemEffects(round,owner,{id:'unit-2',definitionId:'carry-golem',team:'player',starLevel:4,location:{kind:'board',cell:{col:3,row:4}}}))
      .toEqual([{kind:'statFlat',stat:'maxHp',amount:1900},{kind:'statPercentBps',stat:'attackDamage',bps:8000}]);
  });
});

it('solo smoke: real selection, exactly-once grant, and the three existing restore inputs',()=>{
  const seed=firstNodeSeed(id,101),before=reachRound('2-1',false,seed),c=before.pendingChoice!;
  const result=selectChoice(before,c.choiceId,c.generation,id),state=accepted(result);
  if(!result.ok)throw Error(result.reason);
  oracle.validateTransition(before,state,{type:'select',choiceId:c.choiceId,generation:c.generation,definitionId:id},result.events);
  const base=require('./fixtures/m5/oracle.g2.cjs');
  require('./fixtures/m5/augment-rewards-oracle.cjs').validateRewards(before,state,
    {type:'select',choiceId:c.choiceId,generation:c.generation,definitionId:id},result.events,{...base,lootReceipts:[]});
  const forged=structuredClone(state),item=forged.items.find(i=>i.definitionId==='crownguard')!;
  const grant=forged.seatMechanics!.receipts.find(r=>r.kind==='item'&&r.itemId===item.id)!;
  Object.assign(item,{definitionId:'rageblade'});Object.assign(grant,{definitionId:'rageblade'});
  expect(()=>oracle.validateTransition(before,forged,{type:'select',definitionId:id},result.events)).toThrow();
  const retry=selectChoice(state,c.choiceId,c.generation,id);expect(retry.ok).toBe(false);expect(retry.state).toBe(state);expect('events' in retry?retry.events:[]).toEqual([]);
  for(const input of [state,JSON.stringify(state),serializeMatch(state)])expect(restoreMatch(input)).toEqual(state);
  for(const mutate of [(s:any)=>{s.preparation.units.find((u:any)=>u.definitionId==='carry-golem').starLevel=2;},
    (s:any)=>{s.items.find((i:any)=>i.definitionId==='crownguard').definitionId='rageblade';},
    (s:any)=>{s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-pool-batch5-g6');}]){
    const bad=structuredClone(state);mutate(bad);expect(()=>restoreMatch(bad)).toThrow();expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();
  }
});
