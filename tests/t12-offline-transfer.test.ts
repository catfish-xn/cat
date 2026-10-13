import {expect,it} from 'vitest';
import {buyUnit,rerollShop,deployMatchUnit,equipItem,startMatchCombat,stepMatch,nextRound,serializeMatch,restoreMatch} from '../src/server-entry';
import {publicEquipmentPreparation,finishPublicEquipmentBattle,resolvePublicEquipmentChoices} from './fixtures/b8-public-equipment';
import {accepted,board} from './t10-helpers';
it('T12 offline loot upgrade migrates latest equipment and restores overflow of a frozen donor item',()=>{
  let state=publicEquipmentPreparation(['gloves','gloves','vest','sword'],{seed:26});
  while(state.roundDefinitionId!=='3-7')state=accepted(nextRound(resolvePublicEquipmentChoices(finishPublicEquipmentBattle(state)),state.round));
  const drop=state.m8.loot.frozen.rounds.at(-1)!.encounterPlan.drops.find(d=>d.payload.kind==='unit')!;
  expect(drop.payload).toMatchObject({kind:'unit',definitionId:'tristana'});
  const count=(id:string)=>state.preparation.units.filter(u=>u.team==='player'&&u.definitionId===id).reduce((n,u)=>n+3**(u.starLevel-1),0);
  for(let budget=0;count('tristana')<2||count('irelia')<3;budget++){
    expect(budget).toBeLessThan(80);
    const slot=state.shop.slots.findIndex(s=>s.status==='available'&&((s.definitionId==='tristana'&&count('tristana')<2)||(s.definitionId==='irelia'&&count('irelia')<3)));
    state=accepted(slot<0?rerollShop(state):buyUnit(state,slot,state.shop.generation));
  }
  const [survivor,donor]=state.preparation.units.filter(u=>u.team==='player'&&u.definitionId==='tristana');
  for(const [i,u]of state.preparation.units.filter(u=>u.team==='player'&&u.id!==donor.id).entries())
    state=accepted(deployMatchUnit(state,u.id,{kind:'board',cell:{col:i,row:u.definitionId==='irelia'?4:7}}));
  const vest=state.items.find(i=>i.definitionId==='vest')!,gloves=state.items.filter(i=>i.definitionId==='gloves');
  state=accepted(equipItem(state,vest.id,donor.id,0));
  state=accepted(deployMatchUnit(state,survivor.id,board(5)));
  state=accepted(startMatchCombat(state));
  state=accepted(equipItem(state,gloves[0].id,survivor.id,0));
  state=accepted(equipItem(state,gloves[1].id,survivor.id,0));
  let resumed=restoreMatch(serializeMatch(state));
  while(state.phase==='combat'){
    const live=stepMatch(state),copy=stepMatch(resumed);expect(copy).toEqual(live);state=live.state;resumed=copy.state;
  }
  expect(state.preparation.units.find(u=>u.id===survivor.id)?.starLevel).toBe(2);
  expect(state.items.find(i=>i.id===vest.id)!.location).toEqual({kind:'inventory'});
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
  // Removing the survivor's exclusive blocker cannot justify returning a frozen donor item.
  const forged=structuredClone(state);
  Object.assign(forged.items.find(i=>i.definitionId==='thiefs-gloves')!,{location:{kind:'inventory'}});
  Object.assign(forged,{temporaryEquipment:[]});
  expect(()=>restoreMatch(forged)).toThrow(/finished resource projection/);
});
