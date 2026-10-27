import { deepStrictEqual } from 'node:assert';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';
import { stepMatch, startMatchCombat, type MatchState } from '../../src/simulation/match';
import * as mechanisms from '../../src/simulation/m8/restore';
import { effectIdentity } from '../../src/simulation/m8/identity';
import { accepted, battle } from '../match-helpers';
import { itemMatch } from '../fixtures/m8-b4-match';
import { startBracerFight } from '../fixtures/explorer-bracer-public';
import { publicNeutralPreparation } from '../fixtures/m8-neutral-public-route';
import * as expressions from '../../src/simulation/content/item-programs';

function rejected(state: MatchState, reason: string) {
  const consumer = vi.spyOn(mechanisms, 'validateMechanisms');
  try {
    for (const input of [state, JSON.stringify(state)])
      expect(() => restoreMatch(input)).toThrow(`Invalid Match save: ${reason}`);
    expect(() => serializeMatch(state)).toThrow(`Invalid Match save: ${reason}`);
    expect(consumer).not.toHaveBeenCalled();
  } finally { consumer.mockRestore(); }
}

// Audit 546d086 describes this as a static ordering risk; its bounds-g22-state
// characterization tests cover other findings. Reproduce this boundary with
// small safe counts, then require rejection before the per-unit consumers.
it.each([false, true])('rejects a later owner before cross-unit declaration expansion (reversed = %s)', reversed => {
  let legal = itemMatch('ionic-spark');
  legal = stepMatch(legal).state;
  expect(restoreMatch(serializeMatch(legal))).toEqual(legal);
  const bad = structuredClone(legal), units = [...bad.combat!.units];
  const owner = units.find(u => u.id === 'unit-1')!;
  const target = units.find(u => u.mechanismState?.statuses.some(g => g.contributions.some(c => c.source.ownerId === owner.id)))!;
  expect(target).toBeDefined();
  expect(target.id).not.toBe(owner.id);
  // declaredEffects used to consume this wanted value while validating a
  // different unit, before reaching the owner's resolved-mechanics check.
  Object.assign(owner, { mechanics: [...owner.mechanics!, {
    mechanic: 'enforcer', source: owner.mechanics![0]?.source ?? owner.sources![0].source,
    values: { wanted: 64, attackSpeedBps: 1 },
  }] });
  Object.assign(bad.combat!, { units: reversed ? [...units].reverse() : [target, ...units.filter(u => u !== target)] });
  const allocation = vi.spyOn(expressions, 'stat');
  try {
    rejected(bad, 'resolved mechanics');
    // The same object/JSON witness on 8db36d0 makes 64 stat declarations
    // before its later resolved-mechanics rejection (see evidence report).
    expect(allocation).not.toHaveBeenCalled();
  } finally { allocation.mockRestore(); }
});

it('rejects a forged item counter cap before compiling it or enumerating candidates', () => {
  const legal = itemMatch('titans-resolve');
  expect(restoreMatch(serializeMatch(legal))).toEqual(legal);
  const bad = structuredClone(legal), owner = bad.combat!.units.find(u => u.id === 'unit-1')!;
  const counter = owner.itemPrograms!.flatMap(p => p.program.triggers ?? []).flatMap(t => t.counters)[0];
  expect(counter).toBeDefined();
  Object.assign(counter, { cap: 64 });
  rejected(bad, 'resolved item programs');
});

it.each([
  ['sampled tick', 'mechanism initialization/namespace'],
  ['attackCount', 'bounds preflight attackCount'],
  ['castCount', 'bounds preflight castCount'],
  ['mechanism definitions', 'uncompiled mechanism definitions'],
  ['periodTicks', 'periodic program/source binding'],
  ['pulseOrdinal', 'bounds preflight pulseOrdinal'],
])('rejects %s before any per-unit candidate state construction', (field, reason) => {
    const legal = itemMatch('archangel');
    expect(restoreMatch(serializeMatch(legal))).toEqual(legal);
    const bad = structuredClone(legal), owner = bad.combat!.units.find(u => u.id === 'unit-1')!;
    if (field === 'sampled tick') Object.assign(owner.mechanismState!, { sampledAtTick: 64 });
    if (field === 'attackCount' || field === 'castCount') Object.assign(owner.runtime!, { [field]: 64 });
    if (field === 'mechanism definitions') Object.assign(owner.mechanismDefinitions!.periodicTasks[0], { periodTicks: 0.01 });
    if (field === 'periodTicks') Object.assign(owner.mechanismState!.periodicTasks[0], { periodTicks: 0.01 });
    if (field === 'pulseOrdinal') Object.assign(owner.mechanismState!.periodicTasks[0], { pulseOrdinal: 64 });
    rejected(bad, reason);
  });

it('bounds sampled kill triggerCount by trusted roster/lives before the fact replay', () => {
  const legal = startBracerFight();
  expect(restoreMatch(serializeMatch(legal))).toEqual(legal);
  const bad = structuredClone(legal), owner = bad.combat!.units.find(u => u.definitionId === 'lux')!;
  const d = owner.mechanismDefinitions!.eventTriggers!.find(t => t.id === 'kill')!;
  Object.assign(owner, { triggerLedger: { runtimes: [{ ...effectIdentity(bad.combat!.combatId!, d.source, owner.id),
    startsAtTick: 0, expiresAtTick: null, triggerCount: 64, stacks: 0, counters: {}, consumedRewards: [],
    nextEligibleTick: 0, consumed: false, stackPolicy: d.stackPolicy }], processed: {}, actionCounts: {} } });
  rejected(bad, 'sampled stat trigger count bound');
});

it('bounds a runtime counter by its authenticated item declaration', () => {
  const legal = itemMatch('titans-resolve');
  const bad = structuredClone(legal), owner = bad.combat!.units.find(u => u.id === 'unit-1')!;
  const d = owner.mechanismDefinitions!.eventTriggers!.find(t => t.counters.length > 0)!;
  const counter = d.counters[0];
  expect(counter.cap).not.toBeNull();
  Object.assign(owner, { triggerLedger: { runtimes: [{ ...effectIdentity(bad.combat!.combatId!, d.source, owner.id),
    startsAtTick: 0, expiresAtTick: null, triggerCount: 0, stacks: counter.cap! + 1,
    counters: { [counter.id]: counter.cap! + 1 }, consumedRewards: [], nextEligibleTick: 0, consumed: false,
    stackPolicy: d.stackPolicy }], processed: {}, actionCounts: {} } });
  rejected(bad, 'bounds preflight counter');
});

it('authenticates every owner before checking an earlier owner count', () => {
  const bad = structuredClone(itemMatch('archangel'));
  const [earlier, later] = bad.combat!.units;
  Object.assign(earlier.runtime!, { attackCount: 64 });
  Object.assign(later, { starLevel: later.starLevel === 1 ? 2 : 1 });
  rejected(bad, 'combat unit identity');
});

function continueEveryTick(legal: MatchState, liveSteps?: readonly ReturnType<typeof stepMatch>[], entry?: 'object' | 'JSON') {
  const text = serializeMatch(legal);
  const inputs = entry === 'object' ? [structuredClone(legal)] : entry === 'JSON' ? [text] : [structuredClone(legal),text];
  const branches = inputs.map(input => restoreMatch(input));
  let live = legal;
  for (const branch of branches) { expect(branch).toEqual(live); expect(serializeMatch(branch)).toBe(text); }
  let index = 0;
  while (live.phase === 'combat') {
    const next = liveSteps ? liveSteps[index++] : stepMatch(live);
    for (let i = 0; i < branches.length; i++) {
      const restored = stepMatch(branches[i]);
      // The complete state, events and RNG still equal the independently stepped live branch.
      deepStrictEqual(restored, next); branches[i] = restored.state;
    }
    live = next.state;
  }
  return live;
}

it('preserves a real long fight with growing trigger counts and resumes every tick', () => {
  let state = startBracerFight();
  while (state.phase === 'combat' && state.combat!.tick < 400) state = stepMatch(state).state;
  expect(state.combat!.tick).toBe(400); expect(state.phase).toBe('combat');
  continueEveryTick(state);
});

describe('public single-player late fight', () => {
  let initial: MatchState, busiest: MatchState, busiestIndex = 0, maximum = 0;
  const liveSteps: ReturnType<typeof stepMatch>[] = [];
  beforeAll(() => {
    initial = accepted(startMatchCombat(publicNeutralPreparation('6-7')));
    let state = initial;
    busiest = initial;
    // One public fight supplies both the full continuation oracle and the
    // actual maximum-task checkpoint. Restored branches still step separately.
    while (state.phase === 'combat') {
      const n = state.combat!.units.reduce((sum, u) => sum + (u.tasks?.length ?? 0) + (u.mechanismState?.periodicTasks.length ?? 0), 0);
      if (n > maximum) { maximum = n; busiest = state; busiestIndex = liveSteps.length; }
      const next = stepMatch(state);
      liveSteps.push(next); state = next.state;
    }
  });

  it.each(['object','JSON'] as const)('preserves many legitimately acquired rewards in a single-player 6-7 save (%s)', entry => {
    expect(initial.m8.loot.receipts.length).toBeGreaterThan(15);
    expect(initial.resourceProvenance.entries.length).toBeGreaterThan(80);
    continueEveryTick(initial, liveSteps, entry);
  });

  it.each(['object','JSON'] as const)('preserves a single-player 6-7 save at the actual maximum pending-task checkpoint (%s)', entry => {
    expect(maximum).toBeGreaterThanOrEqual(5);
    continueEveryTick(busiest, liveSteps.slice(busiestIndex), entry);
  });
});

it('keeps the ordinary public opening positive control', () => { continueEveryTick(battle()); });
