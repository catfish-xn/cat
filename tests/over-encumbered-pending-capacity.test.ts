import { beforeAll, describe, expect, it } from 'vitest';
import { buyUnit, createMatch, nextRound, selectChoice, sellUnit, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { createCombat } from '../src/simulation/combat';
import { grantDirectLoot, prepareMatchLoot } from '../src/simulation/loot-runtime';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, fieldBench, finish, reachRoundFielded, resolveM5Choices } from './match-helpers';

const forms = ['object', 'JSON', 'serialized'] as const;
function roundTrip(state: MatchState, form: typeof forms[number]): MatchState {
  const text = serializeMatch(state);
  const restored = restoreMatch(form === 'object' ? state : form === 'JSON' ? JSON.parse(text) : text);
  expect(restored).toEqual(state);
  expect(restored).not.toBe(state);
  expect(serializeMatch(restored)).toBe(text);
  return restored;
}

describe('D3 carried loot cannot enter the capacity queue before delivery, seed 23', () => {
  let state = createMatch(23), carriedUnitId: string;
  for (const roundId of ['1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '3-1', '3-2', '3-3']) {
    it(`reaches the public ${roundId} settlement`, () => {
      expect(state.roundDefinitionId).toBe(roundId);
      state = resolveM5Choices(state);
      if (state.phase === 'preparation') {
        for (let slot = 0; slot < state.shop.slots.length; slot++) {
          const bought = buyUnit(state, slot, state.shop.generation);
          if (bought.ok) state = bought.state;
        }
        state = finish(accepted(startMatchCombat(fieldBench(state))));
      }
      state = resolveM5Choices(state);
      expect(state.phase).toBe('settlement');
      if (roundId !== '3-3') state = accepted(nextRound(state, state.round));
    });
  }
  it('keeps the unearned 2-7 hero carried until the 3-7 delivery', () => {
    expect(state.roundDefinitionId).toBe('3-3');
    expect(state.combat?.status).toBe('finished');
    const unit = state.m8.loot.frozen.rounds.find(r => r.encounterPlan.roundId === '2-7')!.encounterPlan.drops
      .find(d => d.payload.kind === 'unit' && state.m8.loot.direct.some(p => p.dropId === d.dropId && p.status === 'carried'))!;
    expect(unit).toBeDefined();
    carriedUnitId = unit.dropId;
    expect(state.m8.loot.carry).toContainEqual({ dropId: carriedUnitId, deliverRoundId: '3-7' });
    expect(state.m8.loot.receipts.some(r => r.dropId === carriedUnitId)).toBe(false);
  });
  it.each(['pending-capacity', 'retained-terminal'] as const)('rejects premature %s through every save entry point', status => {
    const forged = structuredClone(state);
    Object.assign(forged.m8.loot.direct.find(d => d.dropId === carriedUnitId)!, { status });
    expect(() => serializeMatch(forged)).toThrow();
    expect(() => restoreMatch(forged)).toThrow();
    expect(() => restoreMatch(JSON.stringify(forged))).toThrow();
  });
  it('does not grant a future carry even if in-memory progress is forged as pending', () => {
    const forged = structuredClone(state);
    Object.assign(forged.m8.loot.direct.find(d => d.dropId === carriedUnitId)!, { status: 'pending-capacity' });
    const unitId = forged.preparation.units.find(u => u.team === 'player' && u.location.kind === 'bench')!.id;
    const sale = sellUnit(forged, unitId);
    const sold = accepted(sale);
    expect(sale.ok && sale.events.filter(e => e.type === 'lootGranted').map(e => e.receipt.dropId)).not.toContain(carriedUnitId);
    expect(sold.m8.loot.receipts.some(r => r.dropId === carriedUnitId)).toBe(false);
    expect(sold.m8.loot.direct.find(d => d.dropId === carriedUnitId)?.status).toBe('pending-capacity');
  });
  it.each(forms)('restores the legal future carry and continues identically from %s', form => {
    const continued = nextRound(state, state.round);
    expect(nextRound(roundTrip(state, form), state.round)).toEqual(continued);
    const next = accepted(continued);
    expect(next.roundDefinitionId).toBe('3-4');
    expect(next.m8.loot.direct.find(d => d.dropId === carriedUnitId)?.status).toBe('carried');
    expect(next.m8.loot.receipts.some(r => r.dropId === carriedUnitId)).toBe(false);
    roundTrip(next, form);
  });
});

describe('D3 full-bench carried forge remains restorable after delivery, seed 249', () => {
  let state = createMatch(249), deliveryPreparation: MatchState, delivery: MatchState;
  let forgeId: string, unitId: string;
  // Natural 2-7 gold-orb forge uses the same direct-grant branch as a giant-crab
  // forge. Every checkpoint comes from public commands, with no save edits.
  for (const roundId of ['1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7']) {
    it(`reaches the public ${roundId} settlement with the forge delivery route`, () => {
      expect(state.roundDefinitionId).toBe(roundId);
      state = resolveM5Choices(state);
      if (state.phase === 'preparation') {
        for (let slot = 0; slot < state.shop.slots.length; slot++) {
          const bought = buyUnit(state, slot, state.shop.generation);
          if (bought.ok) state = bought.state;
        }
        if (state.round < 10) state = fieldBench(state);
        if (roundId === '2-7') {
          for (const unit of state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board')) {
            state = accepted(sellUnit(state, unit.id));
          }
        }
        if (roundId === '3-7') deliveryPreparation = state;
        state = finish(accepted(startMatchCombat(state)));
      }
      state = resolveM5Choices(state);
      expect(state.phase).toBe('settlement');
      if (roundId !== '3-7') state = accepted(nextRound(state, state.round));
    });
  }
  it('leaves the failed forge carried while the real unit becomes capacity-pending', () => {
    const drops = state.m8.loot.frozen.rounds.find(r => r.encounterPlan.roundId === '2-7')!.encounterPlan.drops;
    forgeId = drops.find(d => d.payload.kind === 'forge')!.dropId;
    unitId = drops.find(d => d.payload.kind === 'unit')!.dropId;
    expect(state.roundResults.find(r => r.roundId === '2-7')?.result).not.toBe('playerWin');
    expect(state.playerHp).toBeGreaterThan(0);
    expect(state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench')).toHaveLength(state.preparation.benchSize);
    for (const dropId of [forgeId, unitId]) {
      expect(state.m8.loot.carry).toContainEqual({ dropId, deliverRoundId: '3-7' });
      expect(state.m8.loot.earnedEvidence.some(e => e.dropId === dropId)).toBe(false);
      expect(state.m8.loot.receipts.some(r => r.dropId === dropId)).toBe(false);
      expect(deliveryPreparation.m8.loot.direct.find(d => d.dropId === dropId)?.status).toBe('carried');
    }
    expect(state.m8.loot.direct.find(d => d.dropId === forgeId)?.status).toBe('carried');
    expect(state.m8.loot.direct.find(d => d.dropId === unitId)?.status).toBe('pending-capacity');
    delivery = state;
  });
  it.each(forms)('restores before and after the full-bench delivery from %s', form => {
    roundTrip(deliveryPreparation, form);
    const restored = roundTrip(delivery, form);
    const victim = delivery.preparation.units.find(u => u.team === 'player' && u.location.kind === 'bench')!.id;
    expect(sellUnit(restored, victim)).toEqual(sellUnit(delivery, victim));
  });
  it('still rejects a unit disguised as carried at the finished delivery through all three entry points', () => {
    // Use the same checkpoint's authentic frozen unit, rather than changing a
    // frozen payload (which would fail before the delivery-boundary check).
    const forged = structuredClone(delivery);
    Object.assign(forged.m8.loot.direct.find(d => d.dropId === unitId)!, { status: 'carried' });
    expect(() => serializeMatch(forged)).toThrow(/pve carry delivery boundary/);
    expect(() => restoreMatch(forged)).toThrow(/pve carry delivery boundary/);
    expect(() => restoreMatch(JSON.stringify(forged))).toThrow(/pve carry delivery boundary/);
  });
  it('rejects replacing the carried forge payload with a unit through all three entry points', () => {
    const forged = structuredClone(delivery);
    const drops = forged.m8.loot.frozen.rounds.find(r => r.encounterPlan.roundId === '2-7')!.encounterPlan.drops;
    Object.assign(drops.find(d => d.dropId === forgeId)!, { payload: drops.find(d => d.dropId === unitId)!.payload });
    expect(() => serializeMatch(forged)).toThrow(/frozen loot ledger/);
    expect(() => restoreMatch(forged)).toThrow(/frozen loot ledger/);
    expect(() => restoreMatch(JSON.stringify(forged))).toThrow(/frozen loot ledger/);
  });
  it('clears only the unit capacity queue with legal sales, leaving the forge carried', () => {
    const units = delivery.m8.loot.direct.filter(d => d.status === 'pending-capacity').map(d => d.dropId);
    expect(units).toHaveLength(2);
    for (const dropId of units) {
      const victim = state.preparation.units.find(u => u.team === 'player' && u.location.kind === 'bench')!.id;
      state = accepted(sellUnit(state, victim));
      expect(state.m8.loot.direct.find(d => d.dropId === dropId)?.status).toBe('granted');
      expect(state.m8.loot.receipts.filter(r => r.dropId === dropId)).toHaveLength(1);
    }
    expect(state.m8.loot.direct.some(d => d.status === 'pending-capacity')).toBe(false);
    expect(state.m8.loot.direct.find(d => d.dropId === forgeId)?.status).toBe('carried');
    expect(state.m8.loot.receipts.some(r => r.dropId === forgeId)).toBe(false);
    roundTrip(state, 'serialized');
  });
  it.each(forms)('continues and restores past the delivery round identically from %s', form => {
    const continued = nextRound(state, state.round);
    expect(nextRound(roundTrip(state, form), state.round)).toEqual(continued);
    const next = accepted(continued);
    expect(next.roundDefinitionId).toBe('4-1');
    expect(next.m8.loot.direct.find(d => d.dropId === forgeId)?.status).toBe('carried');
    const restored = roundTrip(next, form);
    const running = accepted(startMatchCombat(restored));
    expect(running).toEqual(accepted(startMatchCombat(next)));
    expect(stepMatch(roundTrip(running, form))).toEqual(stepMatch(running));
  });
  it('keeps the forge restorable after a later round also finishes, without a new grant', () => {
    state = accepted(nextRound(state, state.round));
    state = resolveM5Choices(finish(accepted(startMatchCombat(fieldBench(state)))));
    expect(state.roundDefinitionId).toBe('4-1');
    expect(state.phase).toBe('settlement');
    expect(state.m8.loot.direct.find(d => d.dropId === forgeId)?.status).toBe('carried');
    expect(state.m8.loot.receipts.some(r => r.dropId === forgeId)).toBe(false);
    roundTrip(state, 'serialized');
    const next = accepted(nextRound(state, state.round));
    expect(next.roundDefinitionId).toBe('4-2');
    roundTrip(next, 'serialized');
  });
});

// Integrated melee pathing leaves both k01 and k02 alive for seed 6389 at 2-7:
// their six frozen heroes carry to 3-7, where the first sale grants five, then fills the bench.
describe.each([{ seed: 6133, pending: 4, firstGranted: 4 }, { seed: 6389, pending: 6, firstGranted: 5 }])('D3 historical capacity queue, seed $seed', ({ seed, pending, firstGranted }) => {
  let state: MatchState, deliveryPreparation: MatchState, sold: MatchState, sale: ReturnType<typeof sellUnit>, soldUnitId: string;
  let pendingIds: string[];
  beforeAll(() => {
    state = reachRoundFielded('2-1', seed);
    const c = state.pendingChoice!;
    expect(c.offers).toContain('over-encumbered');
    state = accepted(selectChoice(state, c.choiceId, c.generation, 'over-encumbered'));
  });

  // One real round per case keeps the public route within the unchanged timeout.
  for (let subround = 1; subround <= 7; subround++) {
    it(`builds reserves through 2-${subround}`, () => {
      expect(state.roundDefinitionId).toBe(`2-${subround}`);
      state = resolveM5Choices(state);
      if (state.phase === 'preparation') {
        for (let slot = 0; slot < state.shop.slots.length; slot++) {
          if (state.preparation.units.filter(u => u.location.kind === 'bench').length >= 5) break;
          const bought = buyUnit(state, slot, state.shop.generation);
          if (bought.ok) state = bought.state;
        }
        state = finish(accepted(startMatchCombat(fieldBench(state))));
      }
      state = accepted(nextRound(resolveM5Choices(state), state.round));
    });
    it(`authenticates the public 2-${subround} prefix`, () => { roundTrip(state, 'serialized'); });
  }
  for (let subround = 1; subround <= 7; subround++) {
    it(`settles the restricted 3-${subround}`, () => {
      expect(state.roundDefinitionId).toBe(`3-${subround}`);
      state = resolveM5Choices(state);
      if (subround === 7) deliveryPreparation = state;
      if (state.phase === 'preparation') state = finish(accepted(startMatchCombat(state)));
      state = resolveM5Choices(state);
      if (subround < 7) state = accepted(nextRound(state, state.round));
    });
    it(`authenticates the public 3-${subround} prefix`, () => { roundTrip(state, 'serialized'); });
  }

  it('retains the undelivered 2-7 units at 3-7 until a legal capacity sale', () => {
    expect(state.phase).toBe('settlement');
    expect(state.preparation.usableBenchSlots).toBeUndefined();
    expect(state.roundResults.find(r => r.roundId === '2-7')?.result).not.toBe('playerWin');
    pendingIds = state.m8.loot.direct.filter(d => d.status === 'pending-capacity').map(d => d.dropId);
    expect(pendingIds).toHaveLength(pending);
    const frozen = state.m8.loot.frozen.rounds.find(r => r.encounterPlan.roundId === '2-7')!;
    expect(frozen.encounterPlan.drops.filter(d => pendingIds.includes(d.dropId)).map(d => d.dropId)).toEqual(pendingIds);
    if (seed === 6389) {
      const queued = frozen.encounterPlan.drops.filter(d => pendingIds.includes(d.dropId));
      expect(queued.map(d => d.payload)).toEqual(['renata', 'tristana', 'renata', 'sett', 'camille', 'vander']
        .map(definitionId => ({ kind: 'unit', definitionId, quantity: 1 })));
      expect([...new Set(queued.map(d => d.sourceUnitId))]).toEqual(['k01', 'k02']
        .map(id => JSON.stringify(['pve', '2-7', 'krugs-v1', id])));
      expect(state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench')).toHaveLength(5);
    }
    for (const dropId of pendingIds) {
      expect(state.m8.loot.carry).toContainEqual({ dropId, deliverRoundId: '3-7' });
      expect(state.m8.loot.receipts.some(r => r.dropId === dropId)).toBe(false);
    }
    expect(nextRound(state, state.round)).toMatchObject({ ok: false, reason: 'unsettled-round' });
  });
  it.each(forms)('allows carried status before delivery combat finishes from %s', form => {
    expect(deliveryPreparation.roundDefinitionId).toBe('3-7');
    expect(deliveryPreparation.combat?.status).not.toBe('finished');
    expect(deliveryPreparation.m8.loot.direct.find(d => d.dropId === pendingIds[0])?.status).toBe('carried');
    roundTrip(deliveryPreparation, form);
  });
  it.each(['pending-capacity', 'retained-terminal'] as const)('rejects %s at delivery before combat finishes', status => {
    const forged = structuredClone(deliveryPreparation);
    Object.assign(forged.m8.loot.direct.find(d => d.dropId === pendingIds[0])!, { status });
    expect(() => serializeMatch(forged)).toThrow();
    expect(() => restoreMatch(forged)).toThrow();
    expect(() => restoreMatch(JSON.stringify(forged))).toThrow();
  });
  it('rejects carried status after delivery combat finishes', () => {
    const forged = structuredClone(state);
    Object.assign(forged.m8.loot.direct.find(d => d.dropId === pendingIds[0])!, { status: 'carried' });
    expect(() => serializeMatch(forged)).toThrow();
    expect(() => restoreMatch(forged)).toThrow();
    expect(() => restoreMatch(JSON.stringify(forged))).toThrow();
  });
  it('retries every old drop in queue order without resettling the round or drawing RNG', () => {
    soldUnitId = state.preparation.units.find(u => u.team === 'player' && u.location.kind === 'bench')!.id;
    sale = sellUnit(state, soldUnitId);
    sold = accepted(sale);
    const grantedIds = pendingIds.slice(0, firstGranted);
    expect(sold.m8.loot.direct.filter(d => pendingIds.includes(d.dropId)).map(d => d.status)).toEqual(pendingIds.map((_, index) => index < firstGranted ? 'granted' : 'pending-capacity'));
    expect(sold.m8.loot.receipts.slice(state.m8.loot.receipts.length).map(r => r.dropId)).toEqual(grantedIds);
    expect(sale.ok && sale.events.filter(e => e.type === 'lootGranted').map(e => e.receipt.dropId)).toEqual(grantedIds);
    for (const dropId of grantedIds) {
      const receipts = sold.m8.loot.receipts.filter(r => r.dropId === dropId);
      expect(receipts).toHaveLength(1);
      expect(receipts[0]).toMatchObject({ claimedRoundId: '3-7', resolution: 'held' });
    }
    for (const key of ['roundResults', 'combatInputBasis', 'combat', 'xp', 'persistentGrowth', 'rngState', 'choiceRngState', 'rewardRngState', 'battleSeedRngState', 'equipmentState'] as const) {
      expect(sold[key]).toEqual(state[key]);
    }
    expect(sold.m8.loot.frozen).toEqual(state.m8.loot.frozen);
    expect(stepMatch(sold)).toEqual({ state: sold, events: [] });
    expect(sellUnit(sold, soldUnitId)).toMatchObject({ ok: false, reason: firstGranted === pending ? 'wrong-phase' : 'unknown-unit' });
  });
  it.each(forms)('restores the pending queue and resumes the identical sale from %s', form => {
    expect(sellUnit(roundTrip(state, form), soldUnitId)).toEqual(sale);
  });
  it.each(forms)('restores the granted historical receipts from %s', form => {
    roundTrip(sold, form);
  });
  it('drains the remaining FIFO after another sale if the bench filled again', () => {
    // Seed 6389 has room for five drops after its first sale. The sixth must
    // remain pending, then follow them exactly once when another slot is freed.
    if (firstGranted < pending) {
      const unitId = sold.preparation.units.find(u => u.team === 'player' && u.location.kind === 'bench')!.id;
      const secondSale = sellUnit(sold, unitId);
      expect(sellUnit(roundTrip(sold, 'serialized'), unitId)).toEqual(secondSale);
      sold = accepted(secondSale);
    }
    expect(sold.m8.loot.direct.filter(d => pendingIds.includes(d.dropId)).map(d => d.status)).toEqual(pendingIds.map(() => 'granted'));
    expect(sold.m8.loot.receipts.slice(state.m8.loot.receipts.length).map(r => r.dropId)).toEqual(pendingIds);
    for (const dropId of pendingIds) expect(sold.m8.loot.receipts.filter(r => r.dropId === dropId)).toHaveLength(1);
    roundTrip(sold, 'serialized');
  });
  it.each(['duplicate', 'reordered'] as const)('rejects %s historical grant receipts', corruption => {
    const bad = structuredClone(sold);
    const receipts = [...bad.m8.loot.receipts];
    if (corruption === 'duplicate') receipts.push(receipts.find(r => r.dropId === pendingIds[0])!);
    else {
      const a = receipts.findIndex(r => r.dropId === pendingIds[0]), b = receipts.findIndex(r => r.dropId === pendingIds[1]);
      [receipts[a], receipts[b]] = [receipts[b], receipts[a]];
    }
    Object.assign(bad.m8.loot, { receipts });
    expect(() => restoreMatch(bad)).toThrow();
  });
  it('continues after restore with one receipt per old drop', () => {
    const next = accepted(nextRound(roundTrip(sold, 'serialized'), sold.round));
    expect(next.roundDefinitionId).toBe('4-1');
    for (const dropId of pendingIds) expect(next.m8.loot.receipts.filter(r => r.dropId === dropId)).toHaveLength(1);
    roundTrip(next, 'serialized');
  });
});

// Isolate the grant planner with real frozen payloads to force older and current
// pending units to compete for one slot. The suites above prove public reachability.
function mixedQueue() {
  const base = createMatch(6133), loot = prepareMatchLoot(6133, 17);
  const old = [...loot.frozen.rounds.find(r => r.encounterPlan.roundId === '2-7')!.encounterPlan.drops].filter(d => d.payload.kind === 'unit').slice(0, 2);
  const current = [...loot.frozen.rounds.find(r => r.encounterPlan.roundId === '3-7')!.encounterPlan.drops].find(d => d.payload.kind === 'unit')!;
  const drops = [...old, current], ids = drops.map(d => d.dropId);
  const combat = createCombat(base.preparation);
  const state: MatchState = { ...base, round: 17, roundDefinitionId: '3-7', phase: 'settlement', pendingChoice: null,
    combat: { ...combat, status: 'finished', result: 'draw' }, nextUnitSerial: 20,
    preparation: { ...base.preparation, units: Array.from({ length: 8 }, (_, slot) => ({
      id: `unit-${slot + 1}`, team: 'player', definitionId: 'irelia', starLevel: 3, location: { kind: 'bench', slot },
    })) },
    m8: { ...base.m8, loot: { ...loot, carry: old.map(d => ({ dropId: d.dropId, deliverRoundId: '3-7' })), direct: loot.direct.map(d => ids.includes(d.dropId)
      ? { ...d, status: 'pending-capacity', receiptId: null } : d) } },
  };
  return { state, ids, drops };
}

describe('D3 capacity retry order across source rounds', () => {
  it('retries older rounds before the current round each time one slot is freed', () => {
    const { state: initial, ids } = mixedQueue();
    let state: MatchState = initial;
    for (let index = 0; index < ids.length; index++) {
      if (index > 0) state = { ...state, preparation: { ...state.preparation, units: state.preparation.units.filter(u => u.id !== `unit-${index}`) } };
      const granted = grantDirectLoot(state, false);
      state = granted.state;
      expect(granted.events.filter(e => e.type === 'lootGranted').map(e => e.receipt.dropId)).toEqual([ids[index]]);
      expect(state.m8.loot.receipts.map(r => r.dropId)).toEqual(ids.slice(0, index + 1));
      expect(state.m8.loot.direct.filter(d => ids.includes(d.dropId)).map(d => d.status)).toEqual(ids.map((_, i) => i <= index ? 'granted' : 'pending-capacity'));
      expect(grantDirectLoot(state, false)).toEqual({ state, events: [], upgradeEvents: [] });
    }
    for (const id of ids) expect(state.m8.loot.receipts.filter(r => r.dropId === id)).toHaveLength(1);
  });
  it('keeps explicit orb claims restricted to their supplied drop list', () => {
    const { state, ids, drops } = mixedQueue();
    const granted = grantDirectLoot(state, false, undefined, [drops[2]]);
    expect(granted.state.m8.loot.receipts.map(r => r.dropId)).toEqual([ids[2]]);
    expect(granted.state.m8.loot.direct.filter(d => ids.includes(d.dropId)).map(d => d.status)).toEqual(['pending-capacity', 'pending-capacity', 'granted']);
  });
});
