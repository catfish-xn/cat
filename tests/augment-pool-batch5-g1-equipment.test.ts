import { expect, it } from 'vitest';
import { selectChoice, combineItems, equipItem, deployMatchUnit, useConsumable, startMatchCombat, nextRound } from '../src/simulation/match';
import { grantMechanicConsumable, grantMechanicUnit, grantMechanicItem } from '../src/simulation/seat-mechanics/grants';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { TEMPORARY_EQUIPMENT_POOL, planTemporaryEquipment } from '../src/simulation/temporary-equipment';
import { validateLuckyGlovesEquipment as validateProduction } from '../src/simulation/augment-pool-batch5-g1-equipment';
import { validateLuckyGlovesEquipment as validateOracle, luckyGlovesPair, CATALOG, COST, ROUNDS, xp, entryXp, benchXp } from './fixtures/m5/oracle.g2.cjs';
import { validateRewards } from './fixtures/m5/augment-rewards-oracle.cjs';
import { accepted, emptyBoard, reachRound, readyMatch, resolveM5Choices } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import type { MatchState } from '../src/simulation/match-types';
import { createRequire } from 'node:module';
const { validateTransition } = createRequire(import.meta.url)('./fixtures/m5/lucky-gloves-oracle.cjs') as {
  validateTransition(before: MatchState, after: MatchState, command: unknown): void;
};

it.each(['lucky-gloves','lucky-gloves-plus'])('%s replaces an existing ordinary roll by appending a recommendation cache, preserving the frozen prefix',definitionId=>{
  // Isolated selection vector: existing ordinary and radiant parents use the same immutable ledger protocol.
  for(const parentId of ['thiefs-gloves','TFT5_Item_ThiefsGlovesRadiant']){
    const base=readyMatch(1),holder=base.preparation.units.find(u=>u.team==='player')!;
    const normal=planTemporaryEquipment({...base,items:[{id:'item-100',definitionId:parentId,location:{kind:'unit',unitId:holder.id,slot:0}}]}).state;
    const prefix=structuredClone(normal.equipmentState.rolls);
    const state=planTemporaryEquipment({...normal,augments:[{definitionId,choiceId:'fixture-select',acquiredRound:normal.round}]}).state;
    expect(state.equipmentState.rolls.slice(0,prefix.length)).toEqual(prefix);
    expect(state.equipmentState.rolls).toHaveLength(prefix.length+1);
    const roll=state.equipmentState.rolls.at(-1)!;
    expect(roll.children).toEqual(luckyGlovesPair((state.seed^0x243f6a88)>>>0,roll.rngDrawStart,roll.lucky!.role,parentId!=='thiefs-gloves').children);
    expect(state.temporaryEquipment.map(t=>t.definitionId)).toEqual(roll.children);
    expect(planTemporaryEquipment(state)).toEqual({state,events:[]});
    expect(()=>validateOracle(state)).not.toThrow();
    const badOrdinary=structuredClone(state) as any;badOrdinary.equipmentState.rolls[0].children[0]='sword';
    expect(()=>validateOracle(badOrdinary)).toThrow(/independent equipment pair/);
    // A self-consistent after-state cannot erase the actual pre-command ordinary cache.
    const erasedPrefix=structuredClone(state) as any;
    const first=luckyGlovesPair((state.seed^0x243f6a88)>>>0,0,roll.lucky!.role,parentId!=='thiefs-gloves');
    erasedPrefix.equipmentState.rolls=[{...roll,rngDrawStart:0,rngDrawEnd:first.draws,children:first.children}];
    erasedPrefix.equipmentState.equipment={state:first.state,draws:first.draws};
    erasedPrefix.temporaryEquipment.forEach((item:any,index:number)=>{item.definitionId=first.children[index];});
    expect(erasedPrefix.equipmentState.rolls).toHaveLength(1);
    expect(()=>validateTransition(normal,erasedPrefix,{type:'select',choiceId:'fixture-select',definitionId})).toThrow(/immutable equipment prefix/);
  }
});

it('real equip/remover/deploy commands reuse caches, switch form at start, and produce only corresponding radiants',()=>{
  const open=reachRound('2-1',false,firstNodeSeed('lucky-gloves',101)),c=open.pendingChoice!;
  let state=accepted(selectChoice(open,c.choiceId,c.generation,'lucky-gloves'));
  const gloves=state.items.filter(i=>i.definitionId==='gloves'&&i.location.kind==='inventory');
  state=accepted(combineItems(state,gloves[0].id,gloves[1].id));
  const parent=state.items.find(i=>i.definitionId==='thiefs-gloves')!,first=state.preparation.units.find(u=>u.team==='player')!;
  const beforeFirstEquip=state,firstCommand={type:'equip',itemId:parent.id,unitId:first.id,slot:0};
  state=accepted(equipItem(state,parent.id,first.id,0));
  expect(()=>validateTransition(beforeFirstEquip,state,firstCommand)).not.toThrow();
  const children=state.temporaryEquipment.map(t=>t.definitionId),draws=state.equipmentState.equipment.draws;
  // The fixture grants only the test tools/hero; all equipment, removal, form and radiant effects use public commands.
  const grant=grantMechanicConsumable(state,{receiptId:'g1-test-remover',source:'test',definitionId:'magnetic-remover'});
  expect(grant.ok).toBe(true);if(!grant.ok)throw Error(grant.reason);state=grant.state;
  state=accepted(useConsumable(state,state.consumables.at(-1)!.consumableId,{kind:'unit',unitId:first.id}));
  expect(state.temporaryEquipment).toEqual([]);
  expect(()=>validateOracle(state)).not.toThrow();
  const lostHistory=structuredClone(state) as any;
  lostHistory.equipmentState=structuredClone(beforeFirstEquip.equipmentState);
  expect(()=>validateOracle(lostHistory)).toThrow(/independent required lucky caches/);
  const beforeReuse=state;
  state=accepted(equipItem(state,parent.id,first.id,0));
  expect(()=>validateTransition(beforeReuse,state,firstCommand)).not.toThrow();
  expect(state.temporaryEquipment.map(t=>t.definitionId)).toEqual(children);expect(state.equipmentState.equipment.draws).toBe(draws);

  const anotherRemover=grantMechanicConsumable(state,{receiptId:'g1-test-remover-2',source:'test',definitionId:'magnetic-remover'});
  if(!anotherRemover.ok)throw Error(anotherRemover.reason);state=anotherRemover.state;
  state=accepted(useConsumable(state,state.consumables.at(-1)!.consumableId,{kind:'unit',unitId:first.id}));
  const hero=grantMechanicUnit(state,{receiptId:'g1-test-elise',source:'test',definitionId:'elise'});
  expect(hero.ok).toBe(true);if(!hero.ok)throw Error(hero.reason);state=hero.state;
  const elise=state.preparation.units.find(u=>u.definitionId==='elise')!;
  state=accepted(deployMatchUnit(state,elise.id,{kind:'board',cell:{col:6,row:4}}));
  state=accepted(equipItem(state,parent.id,elise.id,0));
  const melee=state.temporaryEquipment.map(t=>t.definitionId);
  expect(state.equipmentState.rolls.at(-1)?.lucky?.role).toBe('APTank');
  const beforeForm=state,formTarget={kind:'board' as const,cell:{col:6,row:7}};
  state=accepted(deployMatchUnit(state,elise.id,formTarget));
  expect(()=>validateTransition(beforeForm,state,{type:'deploy',id:elise.id,target:formTarget})).not.toThrow();
  const ranged=state.temporaryEquipment.map(t=>t.definitionId),afterForm=state.equipmentState.equipment.draws;
  expect(state.equipmentState.rolls.at(-1)?.lucky?.role).toBe('APCaster');
  state=accepted(deployMatchUnit(state,elise.id,{kind:'board',cell:{col:6,row:4}}));
  expect(state.temporaryEquipment.map(t=>t.definitionId)).toEqual(melee);expect(state.equipmentState.equipment.draws).toBe(afterForm);
  state=accepted(deployMatchUnit(state,elise.id,{kind:'board',cell:{col:6,row:7}}));
  expect(state.temporaryEquipment.map(t=>t.definitionId)).toEqual(ranged);expect(state.equipmentState.equipment.draws).toBe(afterForm);

  const upgrade=grantMechanicConsumable(state,{receiptId:'g1-test-masterwork',source:'test',definitionId:'masterwork-upgrade'});
  expect(upgrade.ok).toBe(true);if(!upgrade.ok)throw Error(upgrade.reason);state=upgrade.state;
  // Keep the existing masterwork exclusion for Thief's Gloves; radiant gloves themselves remain supported.
  const refused=useConsumable(state,state.consumables.at(-1)!.consumableId,{kind:'unit',unitId:elise.id,itemId:parent.id});
  expect(refused.ok).toBe(false);expect(refused.state).toBe(state);
  const radiant=grantMechanicItem(state,{receiptId:'g1-test-radiant',source:'test',definitionId:'TFT5_Item_ThiefsGlovesRadiant'});
  expect(radiant.ok).toBe(true);if(!radiant.ok)throw Error(radiant.reason);state=radiant.state;
  const radiantId=state.items.at(-1)!.id;
  const remove=grantMechanicConsumable(state,{receiptId:'g1-test-remover-3',source:'test',definitionId:'magnetic-remover'});
  if(!remove.ok)throw Error(remove.reason);state=remove.state;
  state=accepted(useConsumable(state,state.consumables.at(-1)!.consumableId,{kind:'unit',unitId:elise.id}));
  state=accepted(equipItem(state,radiantId,elise.id,0));
  expect(state.items.find(i=>i.id===radiantId)!.definitionId).toBe('TFT5_Item_ThiefsGlovesRadiant');
  expect(state.temporaryEquipment).toHaveLength(2);
  expect(state.temporaryEquipment.every(t=>ITEM_DEFINITIONS[t.definitionId].kind==='radiant')).toBe(true);
  expect(state.equipmentState.rolls.at(-1)?.lucky).toMatchObject({role:'APCaster',radiant:true});
  validateProduction(state,TEMPORARY_EQUIPMENT_POOL);validateOracle(state);
  const noChange=planTemporaryEquipment(state);expect(noChange.state).toBe(state);expect(noChange.events).toEqual([]);
  for(const edit of [
    (s:any)=>{s.equipmentState.rolls.at(-1).children[0]='sword';},
    (s:any)=>{s.equipmentState.rolls.at(-1).lucky.role='ADCarry';},
  ]){const bad=structuredClone(state) as MatchState;edit(bad);expect(()=>validateOracle(bad)).toThrow();}
});

it('replays rejection sampling and both ordinary-pool level bands from the original stream',()=>{
  // In the 7-item second pool, 0xffffffff is rejected. These words are independent LCG constants.
  const streamSeed=2480864133,seed=(streamSeed^0x243f6a88)>>>0;
  const base=readyMatch(seed),original=base.preparation.units.find(u=>u.team==='player')!;
  const holder={...original,definitionId:'caitlyn'};
  const preparation={...base.preparation,units:base.preparation.units.map(u=>u.id===holder.id?holder:u)};
  const parent={id:'sample-parent',definitionId:'thiefs-gloves',location:{kind:'unit' as const,unitId:holder.id,slot:0 as const}};
  const lucky=planTemporaryEquipment({...base,preparation,items:[parent],
    augments:[{definitionId:'lucky-gloves',choiceId:'sample-choice',acquiredRound:base.round}]}).state;
  expect(lucky.equipmentState.rolls[0].children).toEqual(['guardbreaker','infinity-edge']);
  expect(lucky.equipmentState.equipment).toEqual({state:1012239698,draws:3});
  expect(()=>validateOracle(lucky)).not.toThrow();
  const badCount=structuredClone(lucky) as any;badCount.equipmentState.rolls[0].rngDrawEnd=2;
  expect(()=>validateOracle(badCount)).toThrow(/independent equipment draw end/);
  for(const level of [6,7]){
    const normal=planTemporaryEquipment({...base,preparation,items:[parent],level}).state;
    const augmented=planTemporaryEquipment({...normal,augments:[{definitionId:'lucky-gloves',choiceId:'sample-choice',acquiredRound:base.round}]}).state;
    expect(()=>validateOracle(augmented)).not.toThrow();
    const wrong=structuredClone(augmented) as any;wrong.equipmentState.rolls[0].playerLevelSnapshot=level===6?7:6;
    expect(()=>validateOracle(wrong)).toThrow(/independent equipment pair/);
  }
});

it('selecting Lucky Gloves over a worn ordinary parent preserves the real prior cache',()=>{
  const open=reachRound('2-1',false,firstNodeSeed('lucky-gloves',101));
  const c=open.pendingChoice!,holder=open.preparation.units.find(u=>u.team==='player')!;
  const parent={id:'choice-parent',definitionId:'thiefs-gloves',location:{kind:'unit' as const,unitId:holder.id,slot:0 as const}};
  const before=planTemporaryEquipment({...open,items:[...open.items,parent]}).state;
  const command={type:'select',choiceId:c.choiceId,generation:c.generation,definitionId:'lucky-gloves'};
  const after=accepted(selectChoice(before,c.choiceId,c.generation,'lucky-gloves'));
  expect(before.equipmentState.rolls).toHaveLength(1);
  expect(after.equipmentState.rolls).toHaveLength(before.equipmentState.rolls.length+1);
  expect(()=>validateTransition(before,after,command)).not.toThrow();
  const forged=structuredClone(after) as any,roll=after.equipmentState.rolls.at(-1)!;
  const shifted=luckyGlovesPair((after.seed^0x243f6a88)>>>0,0,roll.lucky!.role);
  forged.equipmentState.rolls=[{...roll,rngDrawStart:0,rngDrawEnd:shifted.draws,children:shifted.children}];
  forged.equipmentState.equipment={state:shifted.state,draws:shifted.draws};
  forged.temporaryEquipment.forEach((item:any,index:number)=>{item.definitionId=shifted.children[index];});
  expect(()=>validateOracle(forged)).toThrow(/independent required ordinary cache/);
  expect(()=>validateTransition(before,forged,command)).toThrow(/independent required ordinary cache/);
});

it('the full rewards oracle rejects deleting an earlier-round ordinary roll and recomputing the later lucky draw',()=>{
  const seed=firstNodeSeed('lucky-gloves',101);
  let state=readyMatch(seed);
  const item=grantMechanicItem(state,{receiptId:'g1-cross-round-parent',source:'test',definitionId:'thiefs-gloves'});
  if(!item.ok)throw Error(item.reason);state=item.state;
  const parent=state.items.at(-1)!,holder=state.preparation.units.find(u=>u.team==='player')!;
  state=accepted(equipItem(state,parent.id,holder.id,0));
  const earlierRound=state.roundDefinitionId,ordinary=state.equipmentState.rolls[0];
  expect(ordinary.lucky).toBeUndefined();
  const tool=grantMechanicConsumable(state,{receiptId:'g1-cross-round-remover',source:'test',definitionId:'magnetic-remover'});
  if(!tool.ok)throw Error(tool.reason);state=tool.state;
  state=accepted(useConsumable(state,state.consumables.at(-1)!.consumableId,{kind:'unit',unitId:holder.id}));
  while(state.roundDefinitionId!=='2-1'){
    state=resolveM5Choices(state);
    if(state.phase==='preparation')state=accepted(startMatchCombat(emptyBoard(state)));
    state=resolveM5Choices(state);
    expect(state.phase).toBe('settlement');
    state=accepted(nextRound(state,state.round));
  }
  const choice=state.pendingChoice!;
  expect(choice.offers).toContain('lucky-gloves');
  state=accepted(selectChoice(state,choice.choiceId,choice.generation,'lucky-gloves'));
  const before=state,command={type:'equip' as const,itemId:parent.id,unitId:holder.id,slot:0 as const};
  const equipped=equipItem(before,parent.id,holder.id,0);
  const after=accepted(equipped);
  if(!equipped.ok)throw Error(equipped.reason);
  expect(before.equipmentState.rolls).toEqual([ordinary]);
  expect(earlierRound).not.toBe(after.roundDefinitionId);
  expect(after.equipmentState.rolls).toHaveLength(2);
  const roll=after.equipmentState.rolls[1];
  expect(roll.lucky).toBeDefined();
  const env={CATALOG,COST,ROUNDS,xp,entryXp,benchXp};
  expect(()=>validateRewards(before,after,command,equipped.events,env)).not.toThrow();
  const wrongCommand={...command,itemId:'g1-nonexistent-parent'};
  expect(()=>validateRewards(before,after,wrongCommand,equipped.events,env)).toThrow(/independent equip command item/);
  const otherItem=before.items.find(item=>item.definitionId==='gloves'&&item.location.kind==='inventory')!;
  expect(otherItem).toBeDefined();
  expect(()=>validateRewards(before,after,{...command,itemId:otherItem.id},equipped.events,env)).toThrow(/independent equip cache count/);

  const forged=structuredClone(after) as any;
  const shifted=luckyGlovesPair((after.seed^0x243f6a88)>>>0,0,roll.lucky!.role);
  forged.equipmentState.rolls=[{...roll,rngDrawStart:0,rngDrawEnd:shifted.draws,children:shifted.children}];
  forged.equipmentState.equipment={state:shifted.state,draws:shifted.draws};
  forged.temporaryEquipment.forEach((child:any,index:number)=>{child.definitionId=shifted.children[index];});
  // In isolation the forged after-state is coherent; only the actual pre-command prefix exposes the deletion.
  expect(()=>validateOracle(forged)).not.toThrow();
  expect(()=>validateTransition(before,forged,command)).toThrow(/immutable equipment prefix/);
  expect(()=>validateRewards(before,forged,command,equipped.events,env)).toThrow(/immutable equipment prefix/);

  // A normal deploy cannot append a self-consistent ordinary roll for a parent that never existed.
  const target={kind:'board' as const,cell:{col:3,row:4}},deployCommand={type:'deploy' as const,id:holder.id,target};
  const moved=deployMatchUnit(after,holder.id,target),afterDeploy=accepted(moved);
  if(!moved.ok)throw Error(moved.reason);
  expect(()=>validateRewards(after,afterDeploy,deployCommand,moved.events,env)).not.toThrow();
  const fakeHolder={...afterDeploy.preparation.units.find(u=>u.id===holder.id)!,id:'g1-fake-holder',definitionId:'training-dummy'};
  const fakeParent={id:'g1-fake-parent',definitionId:'thiefs-gloves',location:{kind:'unit' as const,unitId:fakeHolder.id,slot:0 as const}};
  const fakeStream=planTemporaryEquipment({...afterDeploy,items:[...afterDeploy.items,fakeParent],
    preparation:{...afterDeploy.preparation,units:[...afterDeploy.preparation.units,fakeHolder]}}).state.equipmentState;
  expect(fakeStream.rolls).toHaveLength(afterDeploy.equipmentState.rolls.length+1);
  expect(fakeStream.rolls.at(-1)?.lucky).toBeUndefined();
  const extra={...afterDeploy,equipmentState:fakeStream};
  expect(()=>validateOracle(extra)).not.toThrow();
  expect(()=>validateRewards(after,extra,deployCommand,moved.events,env)).toThrow(/independent command ordinary cache/);
});

it('the full rewards oracle accepts a parent formed by equipping a second glove',()=>{
  const open=reachRound('2-1',false,firstNodeSeed('lucky-gloves',101)),choice=open.pendingChoice!;
  let state=accepted(selectChoice(open,choice.choiceId,choice.generation,'lucky-gloves'));
  const holder=state.preparation.units.find(u=>u.team==='player')!;
  const gloves=state.items.filter(item=>item.definitionId==='gloves'&&item.location.kind==='inventory');
  expect(gloves.length).toBeGreaterThanOrEqual(2);
  const env={CATALOG,COST,ROUNDS,xp,entryXp,benchXp};
  for(const glove of gloves.slice(0,2)){
    const before=state,command={type:'equip' as const,itemId:glove.id,unitId:holder.id,slot:0 as const};
    const result=equipItem(before,glove.id,holder.id,0);state=accepted(result);
    if(!result.ok)throw Error(result.reason);
    expect(()=>validateRewards(before,state,command,result.events,env)).not.toThrow();
  }
  expect(state.items.find(item=>item.location.kind==='unit'&&item.location.unitId===holder.id)?.definitionId).toBe('thiefs-gloves');
  expect(state.equipmentState.rolls).toHaveLength(1);
});
