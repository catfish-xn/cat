import { resolveM5Choices } from './match-helpers';
import { describe, expect, it } from 'vitest';
import { createMatch, startMatchCombat, nextRound, rerollShop, createCarouselMatch } from '../src/simulation/match';
import { OPENING_ENCOUNTERS, createOpeningEncounter, readOpeningEncounterView, applyOpeningEffects,
  planOpeningRound, validateOpeningEncounterState } from '../src/server-entry';
import { createSharedPool, initializeSharedSeat, refreshSharedShops, restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import type { MatchState } from '../src/simulation/match-types';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { generateShop } from '../src/simulation/shop';
import { selectOpeningUnit } from '../src/simulation/opening-unit';
import { prepareMatchLoot } from '../src/simulation/loot-runtime';
import { initializeStreams } from '../src/simulation/m8/equipment';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { M8_VERSION } from '../src/simulation/m8/version';
import { validateBattleCollection } from '../src/replay';
import { validateEnvelope } from '../src/persistence/format';
import { readCompatibility } from '../src/persistence/compatibility';
import type { SaveEnvelope } from '../src/m6/contracts';

const seeds = new Map<string,number>();
for (let seed=0;seeds.size<16 && seed<20000;seed++) {
  const id=createOpeningEncounter(seed).selection.encounterId;
  if (!seeds.has(id)) seeds.set(id,seed);
}
const cases=OPENING_ENCOUNTERS.map(e => ({id:e.id,seed:seeds.get(e.id)!}));
function envelope(match: MatchState): SaveEnvelope {
  return {kind:'hex-autobattler-save',saveFormatVersion:M8_VERSION.saveFormatVersion,replayFormatVersion:M8_VERSION.replayFormatVersion,
    runId:'opening-test',createdAt:'2026-10-22T00:00:00.000Z',match,battles:[],currentBattle:null};
}
function room(seed: number, carousel=false) {
  let pool=createSharedPool('opening-test',seed); const states:MatchState[]=[];
  for(let i=0;i<8;i++) {
    const unbound=carousel?createCarouselMatch(100+i):createMatch(100+i,{mode:'shared-deferred'});
    expect(unbound.openingEncounter).toEqual({mode:'shared-deferred'});
    expect(readOpeningEncounterView(unbound)).toBeNull();
    const result=initializeSharedSeat(pool,unbound,`seat-${i}`,i);
    if(!result.ok)throw new Error(result.reason);
    pool=result.pool;states.push(result.state);
  }
  return {pool,states};
}

describe('opening encounter PR1 lifecycle, privacy and no-effect contract', () => {
  it.each(cases.filter(c => !OPENING_ENCOUNTERS.find(e => e.id === c.id)!.enabled || c.id === 'none'))('$id: survives save/restore and every round hook without effects or RNG consumption', ({id,seed}) => {
    const state=createMatch(seed),before=JSON.stringify(state);
    expect(readOpeningEncounterView(state)?.encounterId).toBe(id);
    const context=createOpeningEncounter(seed);
    for (const round of ROUND_CATALOG) {
      const plan=planOpeningRound(context,round.roundId), result=applyOpeningEffects(state,plan.facts);
      expect(result).toEqual({ok:true,state,events:[]});expect(result.state).toBe(state);
    }
    expect(JSON.stringify(state)).toBe(before);
    const restored=restoreMatch(serializeMatch(state));
    expect(restored).toEqual(state);expect(restored).not.toBe(state);
    expect(readOpeningEncounterView(restored)).toEqual(readOpeningEncounterView(state));
    // Exercise actual settlement and Continue: encounter is retained, never reselected.
    const empty={...state,preparation:{...state.preparation,units:state.preparation.units.filter(u=>u.team!=='player')}};
    const settled=startMatchCombat(empty);if(!settled.ok)throw Error(settled.reason);
    const advanced=nextRound(settled.state,settled.state.round);if(!advanced.ok)throw Error(advanced.reason);
    expect(advanced.state.openingEncounter).toBe(state.openingEncounter);
    expect(advanced.state.items).toEqual([]);expect(advanced.state.augments).toEqual([]);
  });
  it.each(cases)('$id: leaves shop, loot, equipment, opening unit and legacy RNG streams unchanged', ({seed}) => {
    const state=createMatch(seed),shop=generateShop(seed,1,1);
    expect(state.shop).toEqual(shop.shop);expect(state.rngState).toBe(shop.rngState);
    expect(state.choiceRngState).toBe((seed^0x9e3779b9)>>>0);
    expect(state.battleSeedRngState).toBe((seed^0x9e3779b9)>>>0);
    expect(state.rewardRngState).toBe((seed^0x85ebca6b)>>>0);
    expect(state.equipmentState.equipment).toEqual(initializeStreams(seed).equipment);
    expect(state.m8.loot).toEqual(prepareMatchLoot(seed,1));
    expect(state.preparation.units.find(u=>u.team==='player')?.definitionId).toBe(selectOpeningUnit(seed));
    const rerolled=rerollShop({...resolveM5Choices(state),gold:20});
    if(!rerolled.ok)throw Error(rerolled.reason);
    expect(rerolled.state.shop).toEqual(generateShop(state.rngState,2,1).shop);
    expect(rerolled.state.openingEncounter).toBe(state.openingEncounter);
  });
  it.each(cases)('$id: all eight seats use the same result as solo with the root seed', ({seed}) => {
    const {pool,states}=room(seed);
    const expected=readOpeningEncounterView(createMatch(seed));
    for (const state of states) {
      expect(readOpeningEncounterView(state)).toEqual(expected);
      expect(()=>validateOpeningEncounterState(state,pool.openingEncounter)).not.toThrow();
    }
  });
  it.each([false,true])('shares the root selection across eight different seat seeds (carousel=%s)', carousel => {
    const {pool,states}=room(42,carousel),publicView=readOpeningEncounterView(createMatch(42));
    for(const state of states) {
      expect(readOpeningEncounterView(state)).toEqual(publicView);
      expect(toPrivateSeatView(state).openingEncounter).toEqual(publicView);
      expect(state.openingEncounter).not.toHaveProperty('context');
      expect(state.openingEncounter).not.toHaveProperty('selectionRng');
      expect(restoreSharedOrbSnapshot(pool,JSON.stringify(state))).toEqual(state);
      expect(applyOpeningEffects(state,[],pool.openingEncounter)).toEqual({ok:true,state,events:[]});
    }
    const generated=refreshSharedShops(pool,states,1);if(!generated.ok)throw Error(generated.reason);
    expect(generated.pool.openingEncounter).toBe(pool.openingEncounter);
    for(const [i,state] of generated.states.entries()) {
      let expected=100+i;for(let n=0;n<10;n++)expected=(Math.imul(expected,1664525)+1013904223)>>>0;
      expect(state.rngState).toBe(expected);
      expect(readOpeningEncounterView(state)).toEqual(publicView);
    }
  });
  it('uses an explicit public whitelist even when secrets are injected', () => {
    const state=structuredClone(createMatch(42));
    if(state.openingEncounter.mode!=='solo')throw Error('solo');
    Object.assign(state.openingEncounter.context,{futureReward:'DO_NOT_SEND',privateSeed:42});
    Object.assign(state.openingEncounter.context.selection,{futureReward:'DO_NOT_SEND'});
    const view=readOpeningEncounterView(state)!;
    expect(Object.keys(view).sort()).toEqual(['configVersion','encounterId','sourceEncounterId','portalId','champion','nameZh','nameEn',
      'enabled','effectStatus','readiness','descriptionZh','statusTextZh','revealedFacts'].sort());
    expect(JSON.stringify(view)).not.toMatch(/seed|Rng|DO_NOT_SEND|receipt/i);
    expect(toPrivateSeatView(state).openingEncounter).toEqual(view);
    expect(view.enabled).toBe(false);expect(view.statusTextZh).toContain('尚未启用');
    expect(view.encounterId).not.toBe('none');
  });
  it('rejects missing fields, forged state/progress and legacy identity without migration', async () => {
    const state=createMatch(42),raw=JSON.parse(serializeMatch(state));
    delete raw.openingEncounter;
    expect(()=>restoreMatch(raw)).toThrow('opening-context-mismatch');
    expect(()=>restoreMatch({...state,schemaVersion:11,rulesVersion:'s13-g2-3-v20-live-combat'})).toThrow('unsupported-version');
    const original=envelope(state), saved=await validateEnvelope(original,validateBattleCollection);
    expect(saved.match.openingEncounter).toEqual(state.openingEncounter);
    expect(readCompatibility({...original,saveFormatVersion:7}).canResume).toBe(false);
    for(const openingEncounter of [
      {mode:'shared-deferred'}, {...state.openingEncounter,receipts:[{receiptId:'fake'}]},
      {mode:'solo',context:createOpeningEncounter(123),receipts:[]},
    ]) expect(()=>restoreMatch({...state,openingEncounter})).toThrow('opening-context-mismatch');
  });
  it('fails atomically for forged effects, wrong global context and shared restore bindings', () => {
    const state=createMatch(42),before=JSON.stringify(state);
    const result=applyOpeningEffects(state,[{factId:'fake',effectKey:'gold',nodeId:'1-2'}]);
    expect(result).toEqual({ok:false,state,reason:'invalid-opening-effect'});expect(result.state).toBe(state);
    expect(result).not.toHaveProperty('events');expect(JSON.stringify(state)).toBe(before);
    const {pool,states}=room(42),shared=states[0];
    const rejected=applyOpeningEffects(shared,[],createOpeningEncounter(123));
    expect(rejected).toEqual({ok:false,state:shared,reason:'opening-context-mismatch'});expect(rejected.state).toBe(shared);
    expect(()=>validateOpeningEncounterState(shared)).toThrow('opening-context-mismatch');
    expect(()=>restoreSharedOrbSnapshot({...pool,openingEncounter:createOpeningEncounter(123)},shared)).toThrow('invalid-pool');
    expect(()=>restoreSharedOrbSnapshot(pool,{...shared,openingEncounter:state.openingEncounter})).toThrow('invalid-seat-state');
    const unbound=createMatch(1,{mode:'shared-deferred'}),badPool={...createSharedPool('bad',42),openingEncounter:createOpeningEncounter(123)};
    const initialized=initializeSharedSeat(badPool,unbound,'seat-0',0);
    expect(initialized).toEqual({ok:false,pool:badPool,state:unbound,reason:'invalid-pool'});
    expect(initialized.pool).toBe(badPool);expect(initialized.state).toBe(unbound);
  });
});
