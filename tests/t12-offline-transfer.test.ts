import {beforeAll,expect,it} from 'vitest';
import {ROUND_CATALOG} from '../src/simulation/content/round-catalog';
import {roundRouteCache} from './fixtures/round-route-cache';
import type {MatchState} from '../src/simulation/match';
import {equipItem,startMatchCombat,stepMatch,serializeMatch,restoreMatch} from '../src/server-entry';
import anchor from './fixtures/v25-online-rules-transfer-route.json';
import {accepted,transferPreparation} from './fixtures/t13-loot-public';
import {validateB8Resources} from '../src/simulation/b8-restore';
// Pause the same public route at bounded tick boundaries; 4-1's real restore
// shortens the proof created by the unrelated 4-2 prismatic offer.
let prepared:MatchState | undefined;
const progress=roundRouteCache(async onProgress => {
  prepared=await transferPreparation({equipGloves:false,checkpointRound:'4-1',onProgress});
  return prepared;
});
const targetRound=ROUND_CATALOG.find(r=>r.roundId==='4-7')!.ordinal;
for(let round=1;round<targetRound;round++)for(const tick of [150,300,450,600,750,900,1050,1200,1201])beforeAll(async()=>{
  await progress.through(round-1+tick/1201);
});
beforeAll(async()=>{await progress.finish();});
it('T12 offline loot upgrade migrates latest equipment and restores overflow of a frozen donor item',async()=>{
  if(!prepared)throw new Error('T12 transfer preparation not completed');
  let state=prepared;
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
  // The v25 augment-history gate rejects this first; independently retain the
  // original finished-projection assertion on the same forged state.
  expect(()=>validateB8Resources(forged)).toThrow(/finished resource projection/);
  expect(()=>restoreMatch(forged)).toThrow(/Invalid augment history: replayed facts\/state mismatch/);
// The assertion budget is unchanged; the public route is prepared in bounded hooks.
}, 60000);
