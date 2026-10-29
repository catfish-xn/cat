import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
const { createH3Ledger, checkH3Growth, auditH3 } = createRequire(import.meta.url)('./fixtures/m5/h3-growth-oracle.cjs');

// Reference-cache rows deliberately point at live input; expectations do not.
function detachedMemory(memory: Record<string, unknown>) {
  const { references, ...detached } = memory;
  expect(references).toBeDefined();
  return detached;
}

// Hand-authored oracle observation vectors, never admitted as production saves.
function origin() {
  return { round: 1, roundDefinitionId: '1-2', phase: 'combat', augments: [],
    multiplayer: { seatId: 's0', receipts: [] }, combat: {}, m8: { round: { kind: 'pve' } },
    preparation: { units: [{ id: 'a', definitionId: 'amumu', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 1, row: 4 } } }] },
    items: [], shop: { generation: 1, slots: [] }, resourceProvenance: { entries: [] }, roundResults: [],
    augmentHistory: { facts: [] as Record<string, unknown>[] } };
}
function observed(s: ReturnType<typeof origin>) {
  return { roster: { units: s.preparation.units, items: s.items }, round: s.round, roundId: s.roundDefinitionId,
    phase: s.phase, shop: s.shop, locked: false, roundKind: 'pve', owners: [], facts: s.augmentHistory.facts,
    resources: s.resourceProvenance.entries, results: s.roundResults, receipts: s.multiplayer.receipts };
}

it('retains independent full checkpoints through shared, appended and replaced production branches', () => {
  let state = origin(), memory = createH3Ledger(state, ['amumu']);
  for (let tick = 1; tick <= 40; tick++) {
    const before = state, previous = structuredClone(memory);
    state = { ...before, augmentHistory: { facts: [...before.augmentHistory.facts, {
      kind: 'deaths', sequence: tick - 1, seatId: 's0', round: 1, roundId: '1-2', resourcePrefix: 0,
      battleId: 'observed-pve', completeThroughTick: tick, deaths: [],
    }] }, ...(tick % 5 === 0 ? { shop: { ...before.shop, generation: tick } } : {}) };
    memory = checkH3Growth(memory, before, state);
    expect(memory.observed).toEqual(observed(state));
    // Advancing one branch must leave its earlier oracle memory usable for forks.
    expect(checkH3Growth(previous, before, before).observed).toEqual(observed(before));
  }
  const expected = structuredClone(memory.observed);
  expect(() => { state.preparation.units[0].location.cell.col++; }).toThrow(TypeError);
  const changed=structuredClone(state);changed.preparation.units[0].location.cell.col++;
  expect(memory.observed).toEqual(expected);
  expect(() => checkH3Growth(memory, changed, changed)).toThrow('H3 independent observed checkpoint');
});

it.each([false, true])('retains detached rows and freezes equal replacement inputs only when requested (%s)', freezeInputs => {
  const state = origin();
  state.augmentHistory.facts.push({ kind: 'deaths', sequence: 0, seatId: 's0', round: 1, roundId: '1-2', resourcePrefix: 0, deaths: [] });
  const memory = createH3Ledger(state, ['amumu'], { freezeInputs });
  const after = { ...state, augmentHistory: structuredClone(state.augmentHistory) };
  const next = checkH3Growth(memory, state, after);
  expect(next.observed.facts[0]).toBe(memory.observed.facts[0]);
  expect(next.observed.facts[0]).not.toBe(after.augmentHistory.facts[0]);
  expect(Object.isFrozen(after.augmentHistory.facts[0])).toBe(freezeInputs);
  expect(Object.isFrozen(after.augmentHistory.facts)).toBe(freezeInputs);
  expect(Object.isFrozen(next.observed)).toBe(true);
  expect(() => auditH3(next, after)).not.toThrow();
});

it.each(['roster', 'shop', 'history'] as const)('detects an in-place %s edit after an inert observation', field => {
  const state = origin();
  state.augmentHistory.facts.push({ kind: 'deaths', sequence: 0, seatId: 's0', round: 1, roundId: '1-2', resourcePrefix: 0, deaths: [] });
  let memory = createH3Ledger(state, ['amumu']);
  memory = checkH3Growth(memory, state, state);
  const snapshot = structuredClone(detachedMemory(memory));
  const mutate=(s:typeof state)=>{
    if (field === 'roster') s.preparation.units[0].definitionId = 'lux';
    if (field === 'shop') s.shop.generation++;
    if (field === 'history') s.augmentHistory.facts[0].roundId = 'forged';
  };
  expect(()=>mutate(state)).toThrow(TypeError);
  const changed=structuredClone(state);mutate(changed);
  expect(detachedMemory(memory)).toEqual(snapshot);
  expect(() => checkH3Growth(memory, changed, changed)).toThrow('H3 independent observed checkpoint');
});

it.each(['roster', 'shop', 'history'] as const)('keeps mutable production %s detached and detects joint before/after edits without freezing it', field => {
  const state = origin();
  state.augmentHistory.facts.push({ kind: 'deaths', sequence: 0, seatId: 's0', round: 1, roundId: '1-2', resourcePrefix: 0, deaths: [] });
  let memory = createH3Ledger(state, ['amumu'], { freezeInputs: false });
  memory = checkH3Growth(memory, state, state);
  const snapshot = structuredClone(detachedMemory(memory));
  expect(Object.isFrozen(state.preparation.units[0])).toBe(false);
  expect(Object.isFrozen(state.shop)).toBe(false);
  expect(Object.isFrozen(state.augmentHistory.facts)).toBe(false);
  if (field === 'roster') state.preparation.units[0].definitionId = 'lux';
  if (field === 'shop') state.shop.generation++;
  if (field === 'history') state.augmentHistory.facts[0].roundId = 'forged';
  expect(detachedMemory(memory)).toEqual(snapshot);
  // Mutable history reference hits defer field checks until an explicit audit
  // or the next boundary; neither is allowed to adopt the edited live row.
  expect(() => auditH3(memory, state)).toThrow('H3 independent observed checkpoint');
  const after = field === 'history' ? { ...state, phase: 'settlement' } : state;
  expect(() => checkH3Growth(memory, state, after)).toThrow('H3 independent observed checkpoint');
});
