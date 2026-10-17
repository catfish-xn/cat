import { beforeAll, describe, expect, it } from 'vitest';
import { createMatch, startMatchCombat, stepMatch, nextRound, selectChoice, selectAnomalyTarget,
  buyUnit, sellUnit, rerollShop, buyXp, setShopLock, deployMatchUnit, type MatchCommandResult } from '../../src/simulation/match';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';
import { BattleHistory, validateBattleCollection } from '../../src/replay/history';
import { validateEnvelope, validateFile } from '../../src/persistence/format';
import { M8_VERSION } from '../../src/simulation/m8/version';
import { grantXp } from '../../src/simulation/progression';
import { MAX_COMBAT_TICKS } from '../../src/simulation/combat-types';
import type { SaveEnvelope } from '../../src/m6/contracts';
import { accepted, resolveM5Choices, emptyBoard, reachRound } from '../match-helpers';

function firstBattleEnvelope(seed: number): SaveEnvelope {
  let state = createMatch(seed);
  const history = new BattleHistory(`ledger-${seed}`);
  function apply(result: MatchCommandResult | ReturnType<typeof stepMatch>) {
    if ('ok' in result && !result.ok) throw Error(result.reason);
    history.observe({before:state,after:result.state,events:result.events.filter(e=>e.domain==='combat'),reason:state.phase==='combat'?'tick':'command'});
    state=result.state;
  }
  for (let guard=0; guard<MAX_COMBAT_TICKS+30; guard++) {
    if (state.phase==='choice') {
      const c=state.pendingChoice!;
      apply(c.step==='target'?selectAnomalyTarget(state,c.choiceId,c.generation,state.preparation.units.find(u=>u.team==='player')!.id)
        :selectChoice(state,c.choiceId,c.generation,c.offers[0]));
    } else if(state.phase==='preparation') {
      if(history.completedRecords.length) break;
      apply(startMatchCombat(state));
    } else if(state.phase==='combat') apply(stepMatch(state));
    else if(state.phase==='settlement') apply(nextRound(state,state.round));
    else throw Error('unexpected terminal');
  }
  expect(state.phase).toBe('preparation');
  expect(history.completedRecords).toHaveLength(1);
  expect(history.completedRecords[0].endTick).toBeGreaterThan(0);
  return {kind:'hex-autobattler-save', saveFormatVersion:M8_VERSION.saveFormatVersion,
    replayFormatVersion:M8_VERSION.replayFormatVersion,runId:`ledger-${seed}`,createdAt:'2026-10-17T00:00:00Z',
    match:state,battles:history.completedRecords,currentBattle:null};
}

describe.each([42,1])('previous battle plus next preparation seed %s', seed=>{
  let envelope:SaveEnvelope;
  beforeAll(()=>{envelope=firstBattleEnvelope(seed);});
  it('accepts the original full collection and file',async()=>{
    await expect(validateBattleCollection(envelope)).resolves.toBeUndefined();
    expect(await validateEnvelope(envelope,validateBattleCollection)).toEqual(envelope);
    expect(await validateFile(new Blob([JSON.stringify(envelope)]),validateBattleCollection)).toEqual(envelope);
  });
  it.each(['object','json'])('rejects only gold +1 in %s restore with the original history unchanged',kind=>{
    const bad=structuredClone(envelope.match) as any; bad.gold++;
    expect(()=>restoreMatch(kind==='json'?JSON.stringify(bad):bad)).toThrow('Invalid Match save: preparation-ledger-gold');
  });
  it('rejects XP and gold changed together to imitate an unrecorded purchase',()=>{
    const bad=structuredClone(reachRound('2-2',true,seed)) as any;expect(bad.gold).toBeGreaterThanOrEqual(4);
    const xp=grantXp(bad.level,bad.xp,4);bad.level=xp.level;bad.xp=xp.xp;bad.gold-=4;
    for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreMatch(input)).toThrow('preparation-ledger-gold');
  });
  it('rejects only gold +1 through collection/envelope/file, even with an empty history callback',async()=>{
    const bad=structuredClone(envelope) as any;bad.match.gold++;
    expect(bad.battles).toEqual(envelope.battles);
    await expect(validateBattleCollection(bad)).rejects.toThrow('preparation-ledger-gold');
    await expect(validateEnvelope(bad,validateBattleCollection)).rejects.toThrow('preparation-ledger-gold');
    await expect(validateEnvelope(bad,()=>{})).rejects.toThrow('preparation-ledger-gold');
    await expect(validateFile(new Blob([JSON.stringify(bad)]),validateBattleCollection)).rejects.toThrow('preparation-ledger-gold');
  });
});

describe('preparation command ledger invariants',()=>{
  it('keeps failed and true no-op commands completely unchanged',()=>{
    const state=resolveM5Choices(createMatch(42));
    const failed=buyUnit(state,-1,state.shop.generation);expect(failed.ok).toBe(false);expect(failed.state).toBe(state);
    const noop=setShopLock(state,Boolean(state.shop.locked),state.shop.generation);expect(noop.state).toBe(state);
    expect(stepMatch(state).state).toBe(state);
    expect(restoreMatch(state)).toEqual(state);
  });
  it('rebuilds paid multi-round trading, refresh and experience, then resumes tick-for-tick',()=>{
    let state=resolveM5Choices(createMatch(42));
    let purchases=0,sales=0,refreshes=0,xpBuys=0;
    for(let round=0;round<5;round++) {
      if(state.phase==='settlement')state=resolveM5Choices(accepted(nextRound(state,state.round)));
      if(state.phase==='preparation') {
        const slot=state.shop.slots.findIndex(s=>s.status==='available' && s.definitionId!==state.preparation.units.find(u=>u.team==='player')?.definitionId);
        const bought=buyUnit(state,slot,state.shop.generation);
        if(bought.ok){const newId=`unit-${state.nextUnitSerial}`;state=bought.state;purchases++;const sold=sellUnit(state,newId);if(sold.ok){state=sold.state;sales++;}}
        const xp=buyXp(state);if(xp.ok){state=xp.state;xpBuys++;}
        const refreshed=rerollShop(state);if(refreshed.ok){state=refreshed.state;refreshes++;}
        for(const input of [state,JSON.stringify(state)])expect(restoreMatch(input)).toEqual(state);
        state=resolveM5Choices(accepted(startMatchCombat(emptyBoard(state))));
      }
    }
    expect(purchases).toBeGreaterThan(1);expect(sales).toBeGreaterThan(1);expect(refreshes).toBeGreaterThan(1);expect(xpBuys).toBeGreaterThan(0);
    state=resolveM5Choices(accepted(nextRound(state,state.round)));
    const unit=state.preparation.units.find(u=>u.team==='player')!;
    state=accepted(deployMatchUnit(state,unit.id,{kind:'board',cell:{col:3,row:4}}));
    state=accepted(startMatchCombat(state));expect(state.phase).toBe('combat');
    state=stepMatch(state).state;
    const object=restoreMatch(state),json=restoreMatch(serializeMatch(state));
    let objectState=object,jsonState=json;
    while(state.phase==='combat') {
      const direct=stepMatch(state),a=stepMatch(objectState),b=stepMatch(jsonState);
      expect(a).toEqual(direct);expect(b).toEqual(direct);
      state=direct.state;objectState=a.state;jsonState=b.state;
    }
  });
  it('rejects a forged unbounded compressed tick count before any repeated dispatch',()=>{
    const original=firstBattleEnvelope(42).match;
    const bad=structuredClone(original) as any;
    const ticks=bad.preparationLedger.commands.find((c:any)=>c.name==='stepMatch');expect(ticks).toBeDefined();
    ticks.repeats=1_000_000_000;
    for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreMatch(input)).toThrow('preparation-ledger-repeat-bound');
  });
  it.each(['gold','preparationLedger'] as const)('rejects %s altered only during final object detachment', property=>{
    const state=firstBattleEnvelope(42).match, raw=structuredClone(state) as any;
    const original=raw[property];let changed=false;
    Object.defineProperty(raw,property,{enumerable:true,configurable:true,get(){
      if(new Error().stack?.includes('structuredClone')) {
        changed=true;
        return property==='gold'?original+1:{...original,commands:[...original.commands,{name:'grantMechanicGold',args:[1],repeats:1}]};
      }
      return original;
    }});
    expect(()=>restoreMatch(raw)).toThrow(`preparation-ledger-${property==='gold'?'gold':'command'}`);
    expect(changed).toBe(true);
  });
  it('rejects omitted, forged and renamed match events and external grant commands',()=>{
    const state=firstBattleEnvelope(42).match;
    expect(state.preparationLedger.events.length).toBeGreaterThan(0);
    const deleted=structuredClone(state) as any;deleted.preparationLedger.events.pop();
    expect(()=>restoreMatch(deleted)).toThrow('preparation-ledger-event-history');
    const renamed=structuredClone(state) as any;renamed.preparationLedger.events[0].type='forged';
    expect(()=>restoreMatch(renamed)).toThrow('preparation-ledger-event-history');
    const fake=structuredClone(state) as any;fake.preparationLedger.commands.push({name:'grantMechanicGold',args:[100],repeats:1});
    expect(()=>restoreMatch(fake)).toThrow('preparation-ledger-command');
  });
});
