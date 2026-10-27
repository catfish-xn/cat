import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUGMENT_BATCH5_G6, CARRY_GOLEM } from '../src/simulation/content/augment-pool-batch5-g6';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { getUnitStats } from '../src/simulation/unit-stats';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { carryGolemEffects, carryGolemStar, growCarryGolem, validateCarryGolem } from '../src/simulation/augment-pool-batch5-g6';
import { createMatch, selectChoice, startMatchCombat, stepMatch, useConsumable, combineItems, equipItem } from '../src/simulation/match';
import { getMultiplayerRoundById } from '../src/simulation/multiplayer-round';
import { validateContent } from '../src/simulation/validate-content';
import { accepted, reachRound } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { applyG23Radiant } from '../src/simulation/g2-3-radiant';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { EMPTY_G23_CONQUEST, planG23Conquest } from '../src/simulation/g2-3-progress';
import { masterworkCandidates, previewUseConsumable } from '../src/simulation/consumables';
import { grantMechanicItem, grantMechanicConsumable } from '../src/simulation/seat-mechanics';
import { canonicalContent } from '../src/simulation/content';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { readCombatStrategyInputs } from '../src/simulation/combat-input';
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
    const equipped={...s,items:['crownguard','bloodthirster','titans-resolve'].map((definitionId,slot)=>({
      id:`item-${slot+1}`,definitionId,location:{kind:'unit' as const,unitId:unit.id,slot},
    }))};
    expect(buildStrategySnapshot(readCombatStrategyInputs(equipped)).units.find(u=>u.unitId===unit.id)?.stats)
      .toMatchObject({health:expected.equippedHealth,attack:expected.equippedAttack,armor:80,magicResist:60});
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

it('derives the grant serial from a resource prefix containing combination, replacement and unchanged consumable outputs',()=>{
  let state=reachRound('2-1',false,firstNodeSeed(id,101));
  const c=state.pendingChoice!,champion=state.preparation.units[0];
  const componentIds:string[]=[];
  for(const definitionId of ['rod','vest']){
    const grant=grantMechanicItem(state,{receiptId:`g6-prefix:${definitionId}`,source:'test',definitionId});
    expect(grant.ok).toBe(true);if(!grant.ok||grant.receipt.kind!=='item')throw Error('missing prefix component');
    state=grant.state;componentIds.push(grant.receipt.itemId);
  }
  const combined=combineItems(state,componentIds[0],componentIds[1]);state=accepted(combined);
  expect(combined.ok&&combined.events.some(e=>e.type==='itemCombined')).toBe(true);
  state=accepted(equipItem(state,`item-${state.nextItemSerial-1}`,champion.id,0));
  for(const definitionId of ['reforger','magnetic-remover']){
    const grant=grantMechanicConsumable(state,{receiptId:`g6-prefix:${definitionId}`,source:'test',definitionId});
    expect(grant.ok).toBe(true);if(!grant.ok||grant.receipt.kind!=='consumable')throw Error('missing prefix tool');
    state=grant.state;
    if(definitionId==='magnetic-remover')state=accepted(equipItem(state,`item-${state.nextItemSerial-1}`,champion.id,0));
    state=accepted(useConsumable(state,grant.receipt.consumableId,{kind:'unit',unitId:champion.id}));
  }
  const prefixSerial=state.nextItemSerial;
  state=accepted(selectChoice(state,c.choiceId,c.generation,id));
  const golem=state.preparation.units.find(u=>u.definitionId==='carry-golem')!;
  expect(state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===golem.id).map(i=>i.id))
    .toEqual([0,1,2].map(slot=>`item-${prefixSerial+slot}`));
  expect(()=>validateCarryGolem(state)).not.toThrow();
  for(const input of [state,JSON.stringify(state),canonicalContent(state)])expect(restoreMatch(input)).toEqual(state);
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
    (s:any)=>{s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-pool-batch5-g6');},
    (s:any)=>{s.preparation.units.find((u:any)=>u.definitionId==='carry-golem').location.cell={col:99,row:99};},
    (s:any)=>{
      const golem=s.preparation.units.find((u:any)=>u.definitionId==='carry-golem');
      for(const [slot,item] of s.items.filter((i:any)=>i.location.kind==='unit'&&i.location.unitId===golem.id).entries()){
        const old=item.id,next=`item-${20000+slot}`;item.id=next;
        for(const r of s.seatMechanics.receipts)if(r.kind==='item'&&r.itemId===old)r.itemId=next;
        for(const f of s.resourceProvenance.entries)if('itemId' in f&&f.itemId===old)f.itemId=next;
      }
      s.nextItemSerial=20003;
    }]){
    const bad=structuredClone(state);mutate(bad);expect(()=>restoreMatch(bad)).toThrow();expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();
  }
});

it.each([false,true])('conqueror tier 15 preserves the fixed loadout for new-item filtering=%s while converting ordinary equipment',newItemsOnly=>{
  const before=reachRound('2-1',false,firstNodeSeed(id,101)),c=before.pendingChoice!;
  let state=accepted(selectChoice(before,c.choiceId,c.generation,id));
  const golem=state.preparation.units.find(u=>u.definitionId==='carry-golem')!;
  const champion=state.preparation.units.find(u=>u.definitionId!=='carry-golem')!;
  const granted=grantMechanicItem(state,{receiptId:'g6-conversion-control',source:'test',definitionId:'crownguard'});
  expect(granted.ok).toBe(true);if(!granted.ok||granted.receipt.kind!=='item')throw Error('missing control item');
  const ordinaryId=granted.receipt.itemId;
  state={...granted.state,items:granted.state.items.map(i=>i.id===ordinaryId?{...i,location:{kind:'unit',unitId:champion.id,slot:0}}:i)};
  const conquest=planG23Conquest(EMPTY_G23_CONQUEST,'conversion',9,Array.from({length:75},(_,i)=>`victim-${i}`));
  expect(conquest.radiantConversion).toBe(true);
  state=writeG23Progress(state,{...readG23Progress(state)!,conquest});
  const converted=applyG23Radiant(state,newItemsOnly?new Set(state.items.map(i=>i.id)):undefined);
  const kit=state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===golem.id);
  expect(converted.items.filter(i=>kit.some(k=>k.id===i.id))).toEqual(kit);
  expect(converted.items.find(i=>i.id===ordinaryId)?.definitionId).toBe('TFT5_Item_CrownguardRadiant');
  expect(converted.resourceProvenance.entries.slice(state.resourceProvenance.entries.length)).toEqual([
    {kind:'g23-item-converted',itemId:ordinaryId,from:'crownguard',to:'TFT5_Item_CrownguardRadiant',receiptId:'g23:conqueror:15',
      sequence:state.resourceProvenance.entries.length,roundId:state.roundDefinitionId},
  ]);
  expect(()=>validateCarryGolem(converted)).not.toThrow();
  expect(applyG23Radiant(converted,newItemsOnly?new Set(state.items.map(i=>i.id)):undefined)).toBe(converted);
});

it('all consumable conversions reject the fixed set atomically, including the masterwork candidate query',()=>{
  const before=reachRound('2-1',false,firstNodeSeed(id,101)),c=before.pendingChoice!;
  let state=accepted(selectChoice(before,c.choiceId,c.generation,id));
  const golem=state.preparation.units.find(u=>u.definitionId==='carry-golem')!;
  for(const definitionId of ['magnetic-remover','reforger','masterwork-upgrade','TFT_Consumable_NeekosHelp'] as const){
    const grant=grantMechanicConsumable(state,{receiptId:`g6-tool:${definitionId}`,source:'test',definitionId});
    expect(grant.ok).toBe(true);if(!grant.ok||grant.receipt.kind!=='consumable')throw Error('missing tool');
    state=grant.state;
    expect(previewUseConsumable(state,grant.receipt.consumableId,{kind:'unit',unitId:golem.id})).toEqual({ok:false,reason:'invalid-consumable-target'});
    const result=useConsumable(state,grant.receipt.consumableId,{kind:'unit',unitId:golem.id});
    expect(result.ok).toBe(false);expect(result.state).toBe(state);expect('events' in result?result.events:[]).toEqual([]);
  }
  expect(masterworkCandidates(state,golem.id)).toEqual([]);
});

it('restoring mid-combat preserves the continued terminal state and complete event suffix',()=>{
  const before=reachRound('2-1',false,firstNodeSeed(id,101)),c=before.pendingChoice!;
  let state=accepted(startMatchCombat(accepted(selectChoice(before,c.choiceId,c.generation,id))));
  for(let tick=0;tick<8;tick++)state=stepMatch(state).state;
  expect(state.phase).toBe('combat');
  const continueBattle=(input:typeof state)=>{
    let next=input;const events=[];
    while(next.phase==='combat'){const result=stepMatch(next);events.push(...result.events);next=result.state;}
    return {state:next,events};
  };
  const expected=continueBattle(state);
  for(const input of [state,JSON.stringify(state),canonicalContent(state)])expect(continueBattle(restoreMatch(input))).toEqual(expected);
});
