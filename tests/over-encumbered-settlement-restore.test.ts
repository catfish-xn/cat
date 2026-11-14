import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Exercise production registration, natural draws and public commands.

import * as matchCommands from '../src/simulation/match';
import { buyUnit, createMatch, nextRound, openAnvil, resolveAugmentTier, selectChoice, sellUnit, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { combatBenchProjection } from '../src/simulation/bench-capacity';
import { accepted, fieldBench, finish, reachRoundFielded, resolveM5Choices } from './match-helpers';
import { createOpeningEncounter } from '../src/simulation/opening-encounter';
import { isAnvil } from '../src/simulation/content/anvils';
import { installB1Offers } from './fixtures/b1-scripted-offers';

const forms = ['object', 'JSON', 'serialized'] as const;
function roundTrip(state: MatchState, form: typeof forms[number]): MatchState {
  const text = serializeMatch(state);
  const input = form === 'object' ? state : form === 'JSON' ? JSON.parse(text) : text;
  const restored = restoreMatch(input);
  expect(restored).toEqual(state);
  expect(restored).not.toBe(state);
  expect(serializeMatch(restored)).toBe(text);
  return restored;
}

describe('D3 solo public-command settlement saves throughout the restricted stage', () => {
  let state: MatchState, started: MatchState;
  beforeAll(() => {
    // Natural offer and a 3-7 win with three capacity-blocked drops.
    state = reachRoundFielded('2-1', 6883);
    const c = state.pendingChoice!;
    state = accepted(selectChoice(state, c.choiceId, c.generation, 'over-encumbered'));
  });

  for (let subround = 1; subround <= 7; subround++) {
    it(`builds reserves through 2-${subround} with public commands`, () => {
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
      // Authenticate successive real prefixes within the unchanged case timeout.
      state = roundTrip(state, 'serialized');
    });
  }

  for (let subround = 1; subround <= 7; subround++) {
    const roundId = `3-${subround}`;
    it(`reaches the ${roundId} settlement without moving parked units`, () => {
      expect(state.roundDefinitionId).toBe(roundId);
      state = resolveM5Choices(state);
      expect(state.preparation.usableBenchSlots).toBe(1);
      expect(state.preparation.overflowUnitIds!.length).toBeGreaterThan(0);
      if (state.phase === 'preparation') {
        const prepared = state;
        started = accepted(startMatchCombat(state));
        const basis = started.combatInputBasis!;
        expect(basis.resourcePreparation).toEqual(prepared.preparation);
        expect(basis.resourcePreparation).not.toBe(prepared.preparation);
        expect(basis.inputs.preparation).toEqual(combatBenchProjection(prepared.preparation));
        expect(basis.inputs.preparation.usableBenchSlots).toBeUndefined();
        expect(basis.inputs.preparation.overflowUnitIds).toBeUndefined();
        expect(started.combat!.units.filter(u => prepared.preparation.overflowUnitIds!.includes(u.id))).toEqual([]);
        if (subround === 1) roundTrip(started, 'serialized');
        state = finish(started);
      }
      state = resolveM5Choices(state);
      expect(state.phase).toBe('settlement');
      expect(state.roundResults.at(-1)?.roundId).toBe(roundId);
      if (subround !== 7) {
        expect(state.preparation.usableBenchSlots).toBe(1);
        expect(state.preparation.overflowUnitIds!.length).toBeGreaterThan(0);
        if (state.combat) expect(state.preparation).toEqual(started.combatInputBasis!.resourcePreparation);
      } else {
        expect(state.preparation.usableBenchSlots).toBeUndefined();
        expect(state.preparation.overflowUnitIds).toBeUndefined();
        expect(state.m8.loot.direct.filter(d => d.status === 'pending-capacity')).toHaveLength(3);
        expect(state.nextUnitSerial).toBe(started.nextUnitSerial);
        expect(nextRound(state, state.round)).toMatchObject({ ok: false, reason: 'unsettled-round' });
      }
    });
    it.each(forms)(`${roundId} settlement serializes and restores from %s`, form => {
      roundTrip(state, form);
      expect(stepMatch(state)).toEqual({ state, events: [] });
    });
    if (subround === 1 || subround === 7) {
      it.each(['missing holdings', 'wrong capacity', 'forged parking'] as const)(`${roundId} rejects %s`, corruption => {
        const bad = structuredClone(state);
        const basis = bad.combatInputBasis!;
        if (corruption === 'missing holdings') delete (basis as { resourcePreparation?: unknown }).resourcePreparation;
        else if (corruption === 'wrong capacity') Object.assign(basis.resourcePreparation!, { usableBenchSlots: 9 });
        else {
          // A legal empty board cell projects to the exact same combat bench.
          // Only the independently replayed public commands authorize parking.
          const p = basis.resourcePreparation!;
          const parked = p.units.find(u => p.overflowUnitIds!.includes(u.id))!;
          const cell = Array.from({ length: 28 }, (_, i) => ({ col: i % 7, row: 4 + Math.floor(i / 7) }))
            .find(c => !p.units.some(u => u.location.kind === 'board' && u.location.cell.col === c.col && u.location.cell.row === c.row))!;
          Object.assign(parked, { location: { kind: 'board', cell } });
          if (subround === 1) Object.assign(bad.preparation.units.find(u => u.id === parked.id)!, { location: parked.location });
          expect(combatBenchProjection(p)).toEqual(basis.inputs.preparation);
        }
        expect(() => serializeMatch(bad)).toThrow();
        expect(() => restoreMatch(bad)).toThrow();
        expect(() => restoreMatch(JSON.stringify(bad))).toThrow();
      });
    }
    if (subround < 7) it(`continues after the restored ${roundId} settlement`, () => {
      state = accepted(nextRound(roundTrip(state, 'serialized'), state.round));
    });
  }

  let capacitySale: ReturnType<typeof sellUnit>, soldUnitId: string, pendingDrops: string[];
  it('grants each x-7 pending drop only once after a public capacity sale', () => {
    const settlement = state.roundResults.at(-1), basis = state.combatInputBasis;
    pendingDrops = state.m8.loot.direct.filter(d => d.status === 'pending-capacity').map(d => d.dropId);
    // Capacity release does not itself retry direct drops. The next legal sale does.
    soldUnitId = state.preparation.units.find(u => u.team === 'player' && u.location.kind === 'bench')!.id;
    capacitySale = sellUnit(state, soldUnitId);
    const sold = accepted(capacitySale);
    expect(sold.roundResults.at(-1)).toEqual(settlement);
    expect(sold.combatInputBasis).toEqual(basis);
    expect(sold.m8.loot.direct.filter(d => pendingDrops.includes(d.dropId)).every(d => d.status === 'granted')).toBe(true);
    for (const dropId of pendingDrops) expect(sold.m8.loot.receipts.filter(r => r.dropId === dropId)).toHaveLength(1);
  });
  it.each(forms)('resumes the exact x-7 capacity sale from %s and restores its result', form => {
    // Saving the sale used to drop the pre-sale prefix. JSON and serialized then
    // replayed from a 3385-step anchor to this 5694-step save (~4s, 5s cap).
    const spy = vi.spyOn(matchCommands, 'stepMatch');
    const before = spy.mock.calls.length;
    try {
      expect(sellUnit(roundTrip(state, form), soldUnitId)).toEqual(capacitySale);
      roundTrip(accepted(capacitySale), form);
      expect(spy.mock.calls.length - before).toBe(0);
    } finally { spy.mockRestore(); }
  });
  it('continues after the restored x-7 sale without granting the drops twice', () => {
    const sold = accepted(capacitySale);
    state = accepted(nextRound(sold, sold.round));
    expect(state.roundDefinitionId).toBe('4-1');
    for (const dropId of pendingDrops) expect(state.m8.loot.receipts.filter(r => r.dropId === dropId)).toHaveLength(1);
    roundTrip(state, 'serialized');
  });
});

describe('D3 solo settlement anvil consumption keeps actual capacity and parking authentic', () => {
  let state: MatchState, restoreOffers: () => void;
  beforeAll(() => {
    restoreOffers = installB1Offers(['over-encumbered']);
    const seed = Array.from({ length: 100 }, (_, i) => i).find(seed =>
      createOpeningEncounter(seed).selection.encounterId === 'component-anvils'
      && resolveAugmentTier(createMatch(seed), 'round:2-1:augment') === 'silver');
    expect(seed).toBeDefined();
    state = reachRoundFielded('2-1', seed!);
    const c = state.pendingChoice!;
    expect(c.offers).toContain('over-encumbered');
    state = accepted(selectChoice(state, c.choiceId, c.generation, 'over-encumbered'));
  });
  afterAll(() => restoreOffers?.());
  for (let subround = 1; subround <= 7; subround++) {
    it(`keeps opening anvils through the public 2-${subround} route`, () => {
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
      roundTrip(state, 'serialized');
    });
  }
  it('settles a real restricted battle with both a bench and a parked anvil', () => {
    expect(state.roundDefinitionId).toBe('3-1');
    state = resolveM5Choices(finish(accepted(startMatchCombat(resolveM5Choices(state)))));
    expect(state.phase).toBe('settlement');
    const anvils = state.preparation.units.filter(u => isAnvil(u.definitionId));
    expect(anvils.some(u => u.location.kind === 'bench')).toBe(true);
    expect(anvils.some(u => state.preparation.overflowUnitIds!.includes(u.id))).toBe(true);
    roundTrip(state, 'serialized');
  });
  for (const location of ['bench', 'parked'] as const) {
    let opened: MatchState, chosen: MatchState;
    it(`opens the ${location} anvil at settlement with a public command`, () => {
      const parked = state.preparation.overflowUnitIds!;
      const anvil = state.preparation.units.find(u => isAnvil(u.definitionId)
        && (location === 'bench' ? u.location.kind === 'bench' : parked.includes(u.id)))!;
      opened = accepted(openAnvil(state, anvil.id));
      expect(opened.phase).toBe('choice');
      expect(opened.preparation.units.some(u => u.id === anvil.id)).toBe(false);
      expect(opened.preparation.overflowUnitIds).toEqual(location === 'bench' ? parked.slice(1) : parked.filter(id => id !== anvil.id));
      if (location === 'bench') expect(opened.preparation.units.find(u => u.id === parked[0])!.location).toEqual({ kind: 'bench', slot: 0 });
    });
    it.each(forms)(`restores the opened ${location} anvil choice from %s`, form => {
      const spy = vi.spyOn(matchCommands, 'stepMatch');
      const before = spy.mock.calls.length;
      try {
        roundTrip(opened, form);
        // The bench branch used to replace the settlement prefix, so the parked
        // branch replayed from step 1399 to 4822 (~3.5s).
        if (location === 'parked') expect(spy.mock.calls.length - before).toBe(0);
      } finally { spy.mockRestore(); }
    });
    it(`chooses the ${location} anvil reward at settlement`, () => {
      const c = opened.pendingChoice!;
      chosen = accepted(selectChoice(opened, c.choiceId, c.generation, c.offers[0]));
      expect(chosen.phase).toBe('settlement');
    });
    it.each(forms)(`restores the consumed ${location} anvil from %s`, form => { roundTrip(chosen, form); });
  }
});
