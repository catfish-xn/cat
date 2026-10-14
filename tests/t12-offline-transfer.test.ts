import {expect,it} from 'vitest';
import {equipItem,startMatchCombat,stepMatch,useConsumable,serializeMatch,restoreMatch} from '../src/server-entry';
import {accepted,transferPreparation} from './fixtures/t13-loot-public';
it('T12 offline loot upgrade migrates latest equipment and restores overflow of a frozen donor item',async()=>{
  let state=await transferPreparation();
  const survivor='unit-22',donor='unit-25',tg=state.items.find(i=>i.definitionId==='thiefs-gloves')!,vest=state.items.find(i=>i.definitionId==='vest')!;
  state=accepted(useConsumable(state,state.consumables.find(c=>c.definitionId==='magnetic-remover')!.consumableId,{kind:'unit',unitId:donor}));
  state=accepted(equipItem(state,vest.id,donor,0));
  state=accepted(startMatchCombat(state));
  state=accepted(equipItem(state,tg.id,survivor,0));
  let resumed=restoreMatch(serializeMatch(state));
  while(state.phase==='combat'){
    const live=stepMatch(state),copy=stepMatch(resumed);expect(copy).toEqual(live);state=live.state;resumed=copy.state;
  }
  expect(state.preparation.units.find(u=>u.id===survivor)?.starLevel).toBe(2);
  expect(state.items.find(i=>i.id===vest.id)!.location).toEqual({kind:'inventory'});
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
  const forged=structuredClone(state);
  Object.assign(forged.items.find(i=>i.definitionId==='thiefs-gloves')!,{location:{kind:'inventory'}});
  Object.assign(forged,{temporaryEquipment:[]});
  expect(()=>restoreMatch(forged)).toThrow(/finished resource projection/);
// T13 full public acquisition + every-tick resumption measured 5.45s on one worker.
}, 15000);
