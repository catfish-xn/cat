import {expect,it} from 'vitest';
import {equipItem,startMatchCombat,stepMatch,serializeMatch,restoreMatch} from '../src/server-entry';
import anchor from './fixtures/v24-online-rules-transfer-route.json';
import {accepted,transferPreparation} from './fixtures/t13-loot-public';
it('T12 offline loot upgrade migrates latest equipment and restores overflow of a frozen donor item',async()=>{
  let state=await transferPreparation({equipGloves:false});
  // Same authenticated v20 seed-4 route pinned by m8-b8-live-transfer.
  const {survivor,donor}=anchor,tg=state.items.find(i=>i.definitionId==='thiefs-gloves')!,vest=state.items.find(i=>i.definitionId==='vest')!;
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
// Random-opening public acquisition + every-tick resumption takes about 9s alone;
// allow the same four-worker contention budget as other full public routes.
}, 60000);
