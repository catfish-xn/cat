import {lootPlan as independentLootPlan} from './fixtures/orb-combo-oracle.cjs';
import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { revealMatchLoot } from '../src/simulation/loot-runtime';
import { accepted } from './match-helpers';
import {simultaneousB8Preparation,partialB8Preparation} from './fixtures/g2-3-b8-public';
import { simultaneousPrefix, barePartialPrefix, PARTIAL_REVEAL_SEEDS } from './fixtures/b8-live-reveal-routes';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const prefix=await simultaneousPrefix();
const zyraPrefix=await barePartialPrefix('zyra',PARTIAL_REVEAL_SEEDS.zyra,['blistering-strikes','pumping-up-ii','bronze-for-life-ii']);
const lorisPrefix=await barePartialPrefix('loris',PARTIAL_REVEAL_SEEDS.loris,['bronze-for-life-i','pumping-up-ii','bronze-for-life-ii']);
function unchangedStep(state: api.MatchState): void {
  const saved = serializeMatch(state), result = api.stepMatch(state);
  expect(result).toEqual({ state, events: [] }); expect(result.state).toBe(state);
  expect(serializeMatch(state)).toBe(saved);
}
function rejected(state: api.MatchState, call: () => api.MatchCommandResult, reason: string): void {
  const saved = serializeMatch(state), result = call();
  expect(result).toEqual({ ok: false, state, reason }); expect(result.state).toBe(state);
  expect(serializeMatch(state)).toBe(saved);
}
const clone = (state: api.MatchState): api.MatchState => {
  const saved = serializeMatch(state), restored = restoreMatch(saved);
  expect(restored).toEqual(state); expect(restored).not.toBe(state);
  expect(serializeMatch(state)).toBe(saved);
  return restored;
};

describe('B8 real simultaneous loot-source deaths', () => {
  it('reveals both carrier entries while two neutral sources die on the same tick, then restores and grants each exactly once', () => {
    let state = accepted(api.startMatchCombat(clone(simultaneousB8Preparation(prefix))));
    while (state.phase === 'combat' && state.combat.tick < 43) state = api.stepMatch(state).state;
    expect(state.phase).toBe('combat');
    expect(state.combat!.tick).toBe(43);
    const before = state, resumedBefore = clone(before);
    const transition = api.stepMatch(before), resumedTransition = api.stepMatch(resumedBefore);
    expect(resumedTransition).toEqual(transition);
    state = transition.state;
    expect(state.phase).toBe('combat');
    const revealed = transition.events.filter(event => event.type === 'lootRevealed');
    expect(revealed).toHaveLength(2);
    const plan = state.m8.loot.frozen.rounds.find(round => round.encounterPlan.roundId === '4-7')!;
    expect(revealed.map(event => event.dropId)).toEqual([
      ...plan.encounterPlan.drops.filter(d=>d.sourceUnitId!.endsWith('r00"]')||d.sourceUnitId!.endsWith('r01"]')).map(drop => drop.dropId), ...plan.choices.map(choice => choice.dropId),
    ]);
    const deaths = state.combat!.neutralReceipts!.deaths;
    expect(deaths).toEqual([
      // G23 lawful Lux/Nami position swap: both sources die in the same tick-44 action batch.
      { unitId: '["pve","4-7","razorbeaks-v1","r00"]', tick: 44, eventSeq: 382 },
      { unitId: '["pve","4-7","razorbeaks-v1","r01"]', tick: 44, eventSeq: 383 },
    ]);
    expect(transition.events.filter(event => event.type === 'death').map(event => [event.type === 'death' && event.unitId, event.tick, event.eventSeq])).toEqual(deaths.map(death => [death.unitId, death.tick, death.eventSeq]));
    expect(revealed.map(event => event.death.eventSeq)).toEqual([382, 383]); // The two component orbs belong to different killed carriers.
    for (const field of ['gold', 'items', 'preparation', 'persistentGrowth', 'nextUnitSerial', 'nextItemSerial',
      'resourceProvenance', 'rngState', 'choiceRngState', 'rewardRngState', 'equipmentState'] as const)
      expect(state[field]).toEqual(before[field]);
    expect(state.m8.loot.frozen).toBe(before.m8.loot.frozen);
    expect(state.m8.loot.receipts).toBe(before.m8.loot.receipts);
    const restoredReveal = clone(state);
    const duplicate = revealMatchLoot(restoredReveal, restoredReveal.combat!);
    expect(duplicate).toEqual({ state: restoredReveal, events: [] });
    expect(duplicate.state).toBe(restoredReveal);
    const forged = JSON.parse(serializeMatch(state));
    forged.m8.loot.earnedEvidence.find((e:{dropId:string})=>e.dropId===revealed[0].dropId).death.eventSeq = 383; // Substitute r01's real death identity for r00's drop evidence.
    expect(() => restoreMatch(forged)).toThrow('Invalid B8 Match: duplicate death identity');
    let resumed = restoredReveal;
    while (state.phase === 'combat') {
      const a = api.stepMatch(state), b = api.stepMatch(resumed);
      expect(b).toEqual(a); state = a.state; resumed = b.state;
    }
    expect(state.phase).toBe('settlement');
    expect(state.pendingChoice).toBeNull();expect(clone(state)).toEqual(state);
    const ids=new Set(plan.encounterPlan.drops.map(drop=>drop.dropId));
    expect(state.m8.loot.receipts.filter(receipt=>ids.has(receipt.dropId))).toHaveLength(8);
    unchangedStep(state);
    rejected(state,()=>api.selectChoice(state,'obsolete-pve-choice',0,'tear'),'wrong-phase');
    expect(api.nextRound(clone(state),state.round)).toEqual(api.nextRound(state,state.round));
  });

  it.each([
    ['loris', 'r00', 437, 'settlement', 1],
    ['zyra', 'r01', 176, 'settlement', 1],
  ] as const)('earns only killed source rewards after an actual partial defeat with %s', (survivor, source, deathTick, phase, directReceipts) => {
    let state = clone(partialB8Preparation(survivor === 'zyra' ? zyraPrefix : lorisPrefix, survivor));
    const targetId=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===survivor)!.id;
    expect(state.preparation.units.find(unit => unit.id === targetId)).toMatchObject({
      definitionId: survivor, starLevel: 2, team: 'player',
    });
    state = clone(state);
    const beforeReceipts = state.m8.loot.receipts.length, beforeItemSerial = state.nextItemSerial;
    const unitSerial = state.nextUnitSerial, frozen = state.m8.loot.frozen;
    state = accepted(api.startMatchCombat(state));
    while (state.phase === 'combat' && state.combat.tick < deathTick) state = api.stepMatch(state).state;
    expect(state.phase).toBe('combat');
    expect(state.combat!.neutralReceipts!.deaths.map(death => [death.unitId, death.tick])).toEqual([
      [JSON.stringify(['pve', '4-7', 'razorbeaks-v1', source]), deathTick],
    ]);
    expect(state.m8.loot.receipts).toHaveLength(beforeReceipts);
    expect(state.nextItemSerial).toBe(beforeItemSerial); expect(state.nextUnitSerial).toBe(unitSerial);
    let resumed = clone(state);
    const events: api.MatchEvent[] = [], resumedEvents: api.MatchEvent[] = [];
    while (state.phase === 'combat') {
      const a = api.stepMatch(state), b = api.stepMatch(resumed);
      events.push(...a.events); resumedEvents.push(...b.events); state = a.state; resumed = b.state;
    }
    expect(resumedEvents).toEqual(events); expect(resumed).toEqual(state);
    expect(state.phase).toBe(phase); expect(state.combat!.result).toBe('enemyWin');
    expect(state.combat!.neutralReceipts!.deaths).toHaveLength(1);
    expect(state.m8.loot.receipts).toHaveLength(beforeReceipts + directReceipts);
    expect(state.m8.loot.direct.filter(d=>frozen.rounds.at(-1)!.encounterPlan.drops.some(p=>p.dropId===d.dropId)).map(drop => drop.status)).toEqual(independentLootPlan(state.seed,24).rounds.at(-1)!.encounterPlan.drops.map(d=>d.sourceUnitId===JSON.stringify(['pve','4-7','razorbeaks-v1',source])?'granted':'forfeited'));
    expect(state.m8.loot.choiceEligibility).toEqual([]);
    expect(state.nextUnitSerial).toBe(unitSerial);
    expect(state.nextItemSerial).toBe(beforeItemSerial + directReceipts);
    expect(state.m8.loot.frozen).toBe(frozen);
    expect(clone(state)).toEqual(state);
    const forged = JSON.parse(serializeMatch(state));
    const corrupted=forged.m8.loot.direct.find((d:{dropId:string})=>d.dropId===frozen.rounds.at(-1)!.encounterPlan.drops.find(d=>d.sourceUnitId===JSON.stringify(['pve','4-7','razorbeaks-v1',source]))!.dropId);
    corrupted.status = directReceipts ? 'forfeited' : 'revealed';corrupted.receiptId = null;
    expect(() => restoreMatch(forged)).toThrow(/qualification evidence/);
    unchangedStep(state);
    expect(api.nextRound(clone(state), state.round)).toEqual(api.nextRound(state, state.round));
  });

  it('an unloaded carrier death adds zero reveal evidence; terminal awards only previously killed loaded carriers',()=>{
    const prepared=simultaneousB8Preparation(prefix),carrier=JSON.stringify(['pve','4-7','razorbeaks-v1','r05']);
    const expected=independentLootPlan(prepared.seed,24).rounds.at(-1)!.encounterPlan.drops;
    expect(expected.filter(d=>d.sourceUnitId===carrier)).toEqual([]);
    let state=accepted(api.startMatchCombat(clone(prepared)));
    while(state.phase==='combat'&&state.combat!.tick<105)state=api.stepMatch(state).state;
    expect(state.combat!.tick).toBe(105);const before=state,copy=clone(before),result=api.stepMatch(before);
    expect(api.stepMatch(copy)).toEqual(result);
    expect(result.events.filter(e=>e.type==='death')).toEqual([expect.objectContaining({unitId:carrier,tick:106,eventSeq:822})]);
    expect(result.events.filter(e=>e.type==='lootRevealed')).toEqual([]);
    expect(result.state.m8.loot.earnedEvidence).toEqual(before.m8.loot.earnedEvidence);
    expect(result.state.m8.loot.frozen).toBe(before.m8.loot.frozen);
    // This is the last death: settlement pays the eight already-earned entries,
    // without inventing a receipt or qualification for the unloaded carrier.
    expect(result.state.m8.loot.receipts.slice(before.m8.loot.receipts.length).map(r=>[r.dropId,r.payload])).toEqual(expected.map(d=>[d.dropId,d.payload]));
    expect(result.state.m8.loot.earnedEvidence.some(e=>e.death.eventSeq===822)).toBe(false);
    expect(clone(result.state)).toEqual(result.state);
    const bad=JSON.parse(serializeMatch(result.state));bad.m8.loot.earnedEvidence.at(-1).death.eventSeq=822;
    expect(()=>restoreMatch(bad)).toThrow('source death conflict');
  });

});
