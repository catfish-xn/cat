import { describe, expect, it } from 'vitest';
import { deployMatchUnit, sellUnit, selectAnomalyTarget, rerollAnomaly, selectChoice, forfeitPendingChoice,
  readAnomalyTargetIds, readAnomalyOfferHistory, buyUnit, buyXp, rerollShop, setShopLock } from '../src/simulation/match';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import type { MatchState } from '../src/simulation/match-types';
import { accepted, catalogPreparation } from './t5r-helpers';
import { enableMultiplayerSettlement } from '../src/simulation/round-settlement';
import { anomalyCandidates } from '../src/simulation/content/anomalies';

function targetState(online = false): MatchState {
  const base = catalogPreparation('4-6');
  const unit = base.preparation.units.find(u => u.team === 'player')!;
  const state: MatchState = { ...base, gold: 500, level: 9, phase: 'choice', combat: null,
    preparation: { ...base.preparation, units: [
      { ...unit, id: 'unit-20', definitionId: 'irelia', location: { kind: 'board', cell: { col: 0, row: 4 } } },
      { ...unit, id: 'unit-3', definitionId: 'vex', location: { kind: 'bench', slot: 0 } },
    ] }, pendingChoice: { kind: 'anomaly', step: 'target', choiceId: 'round:4-6:anomaly', eventId: 'round:4-6:anomaly',
      generation: 0, rerollCount: 0, targetId: null, offers: [], returnPhase: 'preparation' } };
  return online ? accepted(enableMultiplayerSettlement(state, 's0')) : state;
}
const target = (s: MatchState, id = 'unit-20') => accepted(selectAnomalyTarget(s, s.pendingChoice!.choiceId, s.pendingChoice!.generation, id));
const reroll = (s: MatchState) => accepted(rerollAnomaly(s, s.pendingChoice!.choiceId, s.pendingChoice!.generation));
const timeout = (s: MatchState) => accepted(forfeitPendingChoice(s, s.round, s.pendingChoice!.choiceId, s.pendingChoice!.generation));

describe('v26 R1 anomaly planning operations', () => {
  it.each([false, true])('board/bench moves and economy remain legal before confirmation (online=%s)', online => {
    let s = targetState(online);
    s = accepted(deployMatchUnit(s, 'unit-20', { kind: 'bench', slot: 1 }));
    s = accepted(deployMatchUnit(s, 'unit-3', { kind: 'board', cell: { col: 1, row: 4 } }));
    s = accepted(deployMatchUnit(s, 'unit-3', { kind: 'board', cell: { col: 2, row: 4 } }));
    s = accepted(rerollShop(s));
    s = accepted(setShopLock(s, true, s.shop.generation));
    s = accepted(buyXp(s));
    const slot = s.shop.slots.findIndex(c => c.status === 'available');
    s = accepted(buyUnit(s, slot, s.shop.generation));
    expect(s.pendingChoice?.kind).toBe('anomaly');
    expect(s.phase).toBe('choice');
  });
  it.each([false, true])('refuses every sale before target selection and after free/paid quotes, then permits sales after confirmation (online=%s)', online => {
    let s = targetState(online);
    // The sell command also routes anvils to openAnvil; that shortcut must not bypass the refusal.
    s = { ...s, preparation: { ...s.preparation, units: [...s.preparation.units,
      { ...s.preparation.units[0], id: 'anvil', definitionId: 'TFT_ArmoryKeyOrnn', location: { kind: 'bench', slot: 2 } },
    ] } };
    const refuseAll = (state: MatchState) => {
      const before = structuredClone(state);
      for (const unit of state.preparation.units) {
        const result = sellUnit(state, unit.id);
        expect(result).toEqual({ ok: false, state, reason: 'wrong-phase' });
        expect(result.state).toBe(state);
        expect(state).toEqual(before);
      }
    };
    refuseAll(s);
    s = target(s);
    refuseAll(s);
    s = reroll(s);
    refuseAll(s);
    // A locked target may move to the bench, but remains locked and cannot be sold there.
    s = accepted(deployMatchUnit(s, 'unit-20', { kind: 'bench', slot: 1 }));
    s = accepted(deployMatchUnit(s, 'unit-3', { kind: 'board', cell: { col: 1, row: 4 } }));
    refuseAll(s);
    const c = s.pendingChoice!;
    expect(selectAnomalyTarget(s, c.choiceId, c.generation, 'unit-3')).toEqual({ ok: false, reason: 'invalid-choice', state: s });
    s = accepted(deployMatchUnit(s, 'unit-20', { kind: 'board', cell: { col: 0, row: 4 } }));
    s = accepted(selectChoice(s, c.choiceId, c.generation, c.offers[0]));
    expect(s.pendingChoice).toBeNull();
    for (const id of ['unit-20', 'unit-3']) {
      const sold = sellUnit(s, id);
      s = accepted(sold);
      expect(s.preparation.units.some(u => u.id === id)).toBe(false);
      expect(s.resourceProvenance.entries).toContainEqual(expect.objectContaining({ kind: 'unit-sold', unitId: id }));
    }
  });
});

describe('v26 R3 qualification', () => {
  it('projects real manual targets, excludes anvils/enemies, preserves uncertain golem/dummy manual policy', () => {
    const base = targetState(true), u = base.preparation.units[0];
    const ids = ['irelia', 'trainer-golem', 'training-dummy', 'forming-dummy', 'tower-dummy', 'augment-golem', 'TFT_ArmoryKeyOrnn'];
    const s = { ...base, preparation: { ...base.preparation, units: ids.map((definitionId, slot) =>
      ({ ...u, id: definitionId, definitionId, location: { kind: 'bench' as const, slot } })) } };
    const expected = ids.slice(0, -1);
    expect(readAnomalyTargetIds(s)).toEqual(expected);
    expect(toPrivateSeatView(s).anomalyTargetIds).toEqual(expected);
    expect(readAnomalyTargetIds(target(s, 'irelia'))).toEqual([]);
    const result = selectAnomalyTarget(s, s.pendingChoice!.choiceId, 0, 'TFT_ArmoryKeyOrnn');
    expect(result).toMatchObject({ ok: false, reason: 'invalid-target', state: s });
  });
  it('timeout skips a lexicographically earlier summon, including a manually locked one; summon-only skips safely', () => {
    const base = targetState(true), u = base.preparation.units[0];
    const s = { ...base, preparation: { ...base.preparation, units: [
      { ...u, id: '0-summon', definitionId: 'trainer-golem' }, ...base.preparation.units,
    ] } };
    expect(timeout(s).anomalyBinding?.unitId).toBe('unit-20');
    const locked = target(s, '0-summon'), rng = locked.choiceRngState;
    const resolved = timeout(locked);
    expect(resolved.anomalyBinding?.unitId).toBe('unit-20');
    expect(resolved.choiceRngState).toBe(rng);
    expect(readAnomalyOfferHistory(resolved)).toEqual(readAnomalyOfferHistory(locked));
    const only = { ...s, preparation: { ...s.preparation, units: [s.preparation.units[0]] } };
    expect(timeout(only)).toMatchObject({ pendingChoice: null, anomalyBinding: null, multiplayer: { forfeitedChoices: ['round:4-6:anomaly'] } });
    const onlyLocked=target(only,'0-summon');
    const skipped=timeout(onlyLocked);
    expect(skipped.anomalyBinding).toBeNull();
    expect(skipped.choiceRngState).toBe(onlyLocked.choiceRngState);
    expect(readAnomalyOfferHistory(skipped)).toEqual(readAnomalyOfferHistory(onlyLocked));
  });
  it('benching a locked D14 target preserves the R2 lock; moving back restores eligibility without a free quote', () => {
    let s=target(targetState(true));
    for(let i=0;i<200&&!s.pendingChoice!.offers.includes('into-the-unknown');i++)s=reroll(s);
    expect(s.pendingChoice!.offers).toEqual(['into-the-unknown']);
    const c=s.pendingChoice!,rng=s.choiceRngState,history=readAnomalyOfferHistory(s);
    s=accepted(deployMatchUnit(s,'unit-20',{kind:'bench',slot:1}));
    expect(s.pendingChoice).toEqual(c);
    expect(selectAnomalyTarget(s,c.choiceId,c.generation,'unit-3')).toMatchObject({ok:false,reason:'invalid-choice',state:s});
    expect(rerollAnomaly(s,c.choiceId,c.generation)).toEqual({ok:false,reason:'invalid-target',state:s});
    expect(selectChoice(s,c.choiceId,c.generation,c.offers[0])).toEqual({ok:false,reason:'invalid-target',state:s});
    s=accepted(deployMatchUnit(s,'unit-20',{kind:'board',cell:{col:0,row:4}}));
    expect(s.pendingChoice).toEqual(c);
    expect(s.choiceRngState).toBe(rng);
    expect(readAnomalyOfferHistory(s)).toEqual(history);
    expect(rerollAnomaly(s,c.choiceId,c.generation).ok).toBe(true);
  });
  it.each(['into-the-unknown','ultimate-hero'])('timeout deploys the locked benched %s target before checking eligibility', id => {
    let initial=targetState(true);
    initial={...initial,preparation:{...initial.preparation,units:initial.preparation.units.map(u=>u.id==='unit-20'?{...u,starLevel:3 as const}:u)}};
    let s=target(initial);
    for(let i=0;i<450&&!s.pendingChoice!.offers.includes(id);i++)s=reroll(s);
    expect(s.pendingChoice!.offers).toEqual([id]);
    const c=s.pendingChoice!,rng=s.choiceRngState,history=readAnomalyOfferHistory(s),gold=s.gold;
    s=accepted(deployMatchUnit(s,'unit-20',{kind:'bench',slot:1}));
    // The earlier bench slot must not consume the only remaining deployment place.
    s={...s,level:1};
    const resolved=timeout(s);
    expect(resolved.anomalyBinding).toMatchObject({unitId:'unit-20',definitionId:id});
    expect(resolved.scheduleReceipts).toContainEqual(expect.objectContaining({eventId:c.eventId,definitionId:id}));
    expect(resolved.choiceRngState).toBe(rng);
    expect(resolved.gold).toBe(gold);
    expect(readAnomalyOfferHistory(resolved)).toEqual(history);
    expect(resolved.multiplayer!.forfeitedChoices).not.toContain(c.eventId);
  });
  it('reroll and confirmation reject an ineligible target atomically', () => {
    const s = target(targetState(true));
    const bad = { ...s, preparation: { ...s.preparation, units: s.preparation.units.map(u => u.id === 'unit-20' ? { ...u, definitionId: 'TFT_ArmoryKeyOrnn' } : u) } };
    for (const result of [rerollAnomaly(bad, bad.pendingChoice!.choiceId, 1), selectChoice(bad, bad.pendingChoice!.choiceId, 1, bad.pendingChoice!.offers[0])]) {
      expect(result).toEqual({ ok: false, state: bad, reason: 'invalid-target' });
      expect(result.state).toBe(bad);
    }
  });
});

it.each([0, 1, 42, 0xffffffff])('R4a independent LCG oracle: first 12 distinct, old offers return after twelve, never consecutive; seed=%i', seed => {
  let s = { ...targetState(), choiceRngState: seed } as MatchState;
  const pool = anomalyCandidates(false).filter(id => id !== 'ultimate-hero').sort();
  const expected: string[] = [];
  let word = BigInt(seed);
  for (let i = 0; i < 120; i++) {
    const blocked = i < 12 ? expected : expected.slice(-1);
    const candidates = pool.filter(id => !blocked.includes(id));
    word = (word * 1664525n + 1013904223n) % 4294967296n;
    expected.push(candidates[Number(word * BigInt(candidates.length) / 4294967296n)]);
    s = i ? reroll(s) : target(s);
    expect(s.pendingChoice?.offers).toEqual([expected[i]]);
    expect(s.choiceRngState).toBe(Number(word));
    expect(readAnomalyOfferHistory(s)).toEqual(expected);
  }
  expect(new Set(expected.slice(0, 12)).size).toBe(12);
  expect(expected.slice(12).some(id => expected.slice(0, 12).includes(id))).toBe(true);
  const zero = { ...s, gold: 0 };
  expect(rerollAnomaly(zero, zero.pendingChoice!.choiceId, zero.pendingChoice!.generation)).toEqual({ ok: false, state: zero, reason: 'insufficient-gold' });
  expect(accepted(selectChoice(zero, zero.pendingChoice!.choiceId, zero.pendingChoice!.generation, zero.pendingChoice!.offers[0])).anomalyBinding).not.toBeNull();
});
