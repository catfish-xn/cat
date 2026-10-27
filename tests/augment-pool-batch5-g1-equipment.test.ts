import { expect, it } from 'vitest';
import { selectChoice, combineItems, equipItem, deployMatchUnit, useConsumable } from '../src/simulation/match';
import { grantMechanicConsumable, grantMechanicUnit, grantMechanicItem } from '../src/simulation/seat-mechanics/grants';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { TEMPORARY_EQUIPMENT_POOL, planTemporaryEquipment } from '../src/simulation/temporary-equipment';
import { validateLuckyGlovesEquipment as validateProduction } from '../src/simulation/augment-pool-batch5-g1-equipment';
import { validateLuckyGlovesEquipment as validateOracle, luckyGlovesPair } from './fixtures/m5/oracle.g2.cjs';
import { accepted, reachRound, readyMatch } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import type { MatchState } from '../src/simulation/match-types';

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
  }
});

it('real equip/remover/deploy commands reuse caches, switch form at start, and produce only corresponding radiants',()=>{
  const open=reachRound('2-1',false,firstNodeSeed('lucky-gloves',101)),c=open.pendingChoice!;
  let state=accepted(selectChoice(open,c.choiceId,c.generation,'lucky-gloves'));
  const gloves=state.items.filter(i=>i.definitionId==='gloves'&&i.location.kind==='inventory');
  state=accepted(combineItems(state,gloves[0].id,gloves[1].id));
  const parent=state.items.find(i=>i.definitionId==='thiefs-gloves')!,first=state.preparation.units.find(u=>u.team==='player')!;
  state=accepted(equipItem(state,parent.id,first.id,0));
  const children=state.temporaryEquipment.map(t=>t.definitionId),draws=state.equipmentState.equipment.draws;
  // The fixture grants only the test tools/hero; all equipment, removal, form and radiant effects use public commands.
  const grant=grantMechanicConsumable(state,{receiptId:'g1-test-remover',source:'test',definitionId:'magnetic-remover'});
  expect(grant.ok).toBe(true);if(!grant.ok)throw Error(grant.reason);state=grant.state;
  state=accepted(useConsumable(state,state.consumables.at(-1)!.consumableId,{kind:'unit',unitId:first.id}));
  expect(state.temporaryEquipment).toEqual([]);
  state=accepted(equipItem(state,parent.id,first.id,0));
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
  state=accepted(deployMatchUnit(state,elise.id,{kind:'board',cell:{col:6,row:7}}));
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
