import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const implementation = require('./fixtures/m5/h3-growth-oracle.cjs');
// Mutation vectors must reach the independent audit rather than a freeze error.
const fast = { ...implementation, createH3Ledger: (state: unknown, heroes: string[]) =>
  implementation.createH3Ledger(state, heroes, { freezeInputs: false }) };
// Exact 686f3086 implementation; do not optimize this comparison fixture.
const original = require('./fixtures/m5/h3-growth-oracle-v25-baseline.cjs');
const copy = structuredClone;
const origin = () => ({
  augments: [], preparation: { units: [] }, items: [], shop: {},
  round: 1, roundDefinitionId: '1-1', phase: 'combat', m8: { round: { kind: 'pve' } },
  augmentHistory: { facts: [] as Record<string, unknown>[] },
  resourceProvenance: { entries: [] as Record<string, unknown>[] },
  roundResults: [] as Record<string, unknown>[],
  multiplayer: { seatId: 's0', receipts: [] as Record<string, unknown>[] },
});
type State = ReturnType<typeof origin>;
const death = (s: State, sequence = s.augmentHistory.facts.length) => ({
  kind: 'deaths', sequence, seatId: 's0', round: s.round,
  roundId: s.roundDefinitionId, resourcePrefix: s.resourceProvenance.entries.length,
  deaths: [],
});
function accepted() {
  const before = origin(), after = { ...before, augmentHistory: { facts: [death(before)] } };
  const memory = fast.checkH3Growth(fast.createH3Ledger(before, []), before, after);
  return { before: after, memory };
}
function verdict(oracle: typeof fast, memory: unknown, before: State, after: State) {
  try { return { ok: true, memory: oracle.checkH3Growth(memory, before, after) }; }
  catch (e) {
    const error = e as { code: string; operator: string; message: string };
    return { ok: false, error: { code: error.code, operator: error.operator, message: error.message } };
  }
}

it('pins the unmodified original oracle used for equivalence and benchmarks', () => {
  expect(createHash('sha256').update(readFileSync(new URL('./fixtures/m5/h3-growth-oracle-v25-baseline.cjs', import.meta.url))).digest('hex'))
    .toBe('9bbea0b3d1f5fd6d6048d0a6dfffa729b30670292acef802fad29d1a43b74b70');
});

it('defers a joint in-place edit of an old fact only until the next phase boundary', () => {
  const { before, memory } = accepted();
  const old = original.createH3Ledger(before, []);
  before.augmentHistory.facts[0].resourcePrefix = 999;
  let next = memory;
  for (let i = 0; i < 3; i++) next = fast.checkH3Growth(next, before, before);
  // The detached snapshot has not silently adopted the edited value.
  expect(next.observed.facts[0].resourcePrefix).toBe(0);
  expect(memory.observed.facts[0].resourcePrefix).toBe(0);
  const boundary = { ...before, phase: 'settlement' };
  expect(() => fast.checkH3Growth(next, before, boundary))
    .toThrow(/H3 independent observed checkpoint/);
  expect(verdict(fast, next, before, boundary)).toEqual(verdict(original, old, before, boundary));
});

it('checks the after side at a boundary even when the before side is intact', () => {
  const { before, memory } = accepted();
  const intact = copy(before);
  // The old reference now exists only on the after side; before is a valid clone.
  const after = { ...before, phase: 'settlement' };
  (before.augmentHistory.facts[0] as Record<string, unknown>).deaths = ['forged'];
  expect(() => fast.checkH3Growth(memory, intact, after)).toThrow(/H3 retained facts/);
});

it('never adopts an edited retained reference when before is an intact clone between boundaries', () => {
  const { before, memory } = accepted();
  const intact = copy(before);
  before.augmentHistory.facts[0].resourcePrefix = 999;
  const next = fast.checkH3Growth(memory, intact, before);
  expect(next.observed.facts[0]).toBe(memory.observed.facts[0]);
  expect(next.observed.facts[0].resourcePrefix).toBe(0);
  expect(() => fast.auditH3(next, before)).toThrow(/H3 independent observed checkpoint/);
});

it('also performs a full audit on a roster-lock boundary without a phase change', () => {
  const initial = origin(), before = { ...initial, augmentHistory: { facts: [death(initial)] } };
  const memory = fast.checkH3Growth(fast.createH3Ledger(initial, []), initial, before);
  before.augmentHistory.facts[0].resourcePrefix = 999;
  const after = { ...before, multiplayer: { ...before.multiplayer, combatRosterLocked: true } };
  expect(() => fast.checkH3Growth(memory, before, after)).toThrow(/H3 independent observed checkpoint/);
});

it.each(['delete', 'replace', 'reorder'] as const)('rejects a %s of the retained fact prefix immediately', kind => {
  const initial = accepted(), before = { ...initial.before, augmentHistory: {
    facts: [...initial.before.augmentHistory.facts, death(initial.before)],
  } };
  const memory = fast.checkH3Growth(initial.memory, initial.before, before);
  const facts = [...before.augmentHistory.facts];
  if (kind === 'delete') facts.shift();
  if (kind === 'replace') facts[0] = { ...facts[0], seatId: 'forged' };
  if (kind === 'reorder') facts.reverse();
  expect(() => fast.checkH3Growth(memory, before, { ...before, augmentHistory: { facts } }))
    .toThrow(/H3 retained facts/);
});

it.each(['sequence', 'seatId', 'round', 'roundId', 'resourcePrefix', 'growth'] as const)(
  'rejects a bad new %s immediately with the same original assertion', field => {
    const before = origin(), fact: Record<string, unknown> = death(before);
    if (field === 'sequence') fact.sequence = 8;
    if (field === 'seatId') fact.seatId = 'other-seat';
    if (field === 'round') fact.round = 2;
    if (field === 'roundId') fact.roundId = 'forged';
    if (field === 'resourcePrefix') fact.resourcePrefix = 99;
    if (field === 'growth') Object.assign(fact, { kind: 'growth', deltas: [], choiceId: 'forged', receiptId: 'extra' });
    const after = { ...before, augmentHistory: { facts: [fact] } };
    const old = verdict(original, original.createH3Ledger(before, []), before, after);
    const next = verdict(fast, fast.createH3Ledger(before, []), before, after);
    expect(old.ok).toBe(false);
    expect(next).toEqual(old);
  },
);

it.each(['delete', 'replace', 'before'] as const)('preserves the complete original %s error diagnostic', kind => {
  const initial = origin(), before = { ...initial, augmentHistory: { facts: [death(initial)] } };
  const old = original.checkH3Growth(original.createH3Ledger(initial, []), initial, before);
  const next = fast.checkH3Growth(fast.createH3Ledger(initial, []), initial, before);
  const after = copy(before), observed = kind === 'before' ? copy(before) : before;
  if (kind === 'delete') after.augmentHistory.facts.pop();
  else (kind === 'before' ? observed : after).augmentHistory.facts[0].seatId = 'forged';
  const a = verdict(original, old, observed, after), b = verdict(fast, next, observed, after);
  expect(a.ok).toBe(false);expect(b).toEqual(a);
});

describe.each(['facts', 'resources', 'results', 'receipts'] as const)('%s append-only cache', key => {
  function vector() {
    const before = origin();
    before.augmentHistory.facts = [death(before)];
    before.resourceProvenance.entries = [{ sequence: 0, kind: 'observed-resource' }];
    before.roundResults = [{ settlementId: 'r1', round: 1, roundKind: 'pve' }];
    before.multiplayer.receipts = [{ settlementId: 'r1', round: 1 }];
    const records = (s: State) => key === 'facts' ? s.augmentHistory.facts : key === 'resources'
      ? s.resourceProvenance.entries : key === 'results' ? s.roundResults : s.multiplayer.receipts;
    return { before, records, memory: fast.createH3Ledger(before, []) };
  }
  it('detects in-place array deletion even if before and after alias', () => {
    const { before, records, memory } = vector();
    records(before).pop();
    expect(() => fast.checkH3Growth(memory, before, before)).toThrow(/H3 independent observed checkpoint/);
  });
  it('keeps detached fields through ticks and detects a joint edit at the round boundary', () => {
    const { before, records, memory } = vector();
    records(before)[0].tampered = true;
    const next = fast.checkH3Growth(memory, before, before);
    expect(next.observed[key][0].tampered).toBeUndefined();
    expect(() => fast.checkH3Growth(next, before, { ...before, round: 2, roundDefinitionId: '1-2' }))
      .toThrow(/H3 independent observed checkpoint/);
  });
  it('catches an in-place edit after the final boundary at the closing audit', () => {
    const { before, records } = vector();
    const start = { ...before, phase: 'preparation' };
    let memory = fast.checkH3Growth(fast.createH3Ledger(start, []), start, before);
    records(before)[0].tampered = { nested: true };
    // No later round/phase/lock boundary exists on this truncated route.
    memory = fast.checkH3Growth(memory, before, before);
    const saved = copy(memory);
    expect(() => fast.auditH3(memory, before)).toThrow(/H3 independent observed checkpoint/);
    expect(verdict(original, memory, before, before).ok).toBe(false);
    expect(memory).toEqual(saved); // A failed audit must not repair/bless the input.
    expect(memory.observed[key][0].tampered).toBeUndefined();
  });
  it('accepts an edit restored before closing but catches it at an earlier forced checkpoint', () => {
    const { before, records, memory } = vector();
    const saved = copy(memory);
    records(before)[0].tampered = true;
    const next = fast.checkH3Growth(memory, before, before);
    // Same semantics as an explicit disconnect/reconnect checkpoint before a boundary.
    expect(() => fast.auditH3(next, before)).toThrow(/H3 independent observed checkpoint/);
    delete records(before)[0].tampered;
    expect(() => fast.auditH3(next, before)).not.toThrow();
    expect(verdict(original, memory, before, before).ok).toBe(true);
    expect(memory).toEqual(saved);
    expect(next.observed[key]).toEqual(memory.observed[key]);
  });
  it('compares changed references deeply and accepts an identical detached clone as before', () => {
    const { before, memory } = vector();
    expect(() => fast.checkH3Growth(memory, copy(before), copy(before))).not.toThrow();
    const after = copy(before);
    (key === 'facts' ? after.augmentHistory.facts : key === 'resources' ? after.resourceProvenance.entries
      : key === 'results' ? after.roundResults : after.multiplayer.receipts)[0].tampered = true;
    expect(() => fast.checkH3Growth(memory, before, after)).toThrow(/H3 retained/);
  });
});

it('matches every verdict and detached ledger value on an independent multi-boundary trace', () => {
  let before = origin(), old = original.createH3Ledger(before, []), next = fast.createH3Ledger(before, []);
  for (let round = 1; round <= 3; round++) {
    for (const phase of ['combat', 'combat', 'settlement']) {
      const after = { ...before, phase, augmentHistory: { facts: [...before.augmentHistory.facts, death(before)] } };
      const a = verdict(original, old, before, after), b = verdict(fast, next, before, after);
      expect(b.ok).toBe(a.ok); expect(a.ok).toBe(true);
      old = a.memory; next = b.memory;
      const { references, freezeInputs, ...detached } = next;
      expect(freezeInputs).toBe(false);
      expect(references.facts).toEqual(after.augmentHistory.facts);
      expect(detached).toEqual(old);
      before = after;
    }
    const after = { ...before, phase: 'preparation', round: round + 1, roundDefinitionId: `1-${round + 1}`,
      augmentHistory: { facts: [...before.augmentHistory.facts, {
        ...death({ ...before, round: round + 1, roundDefinitionId: `1-${round + 1}` }),
        kind: 'round-entry', roster: { units: [], items: [] },
      }] } };
    const a = verdict(original, old, before, after), b = verdict(fast, next, before, after);
    expect(b.ok).toBe(a.ok); expect(a.ok).toBe(true);
    old = a.memory; next = b.memory;
    const { references, freezeInputs, ...detached } = next;
    expect(freezeInputs).toBe(false);
    expect(references.facts).toEqual(after.augmentHistory.facts);
    expect(detached).toEqual(old);
    before = after;
  }
  fast.auditH3(next, before);
});

it('clones only the added history and preserves earlier ledger snapshots', () => {
  const { before, memory } = accepted(), prior = copy(memory.observed);
  const after = { ...before, augmentHistory: { facts: [...before.augmentHistory.facts, death(before)] } };
  const next = fast.checkH3Growth(memory, before, after);
  expect(memory.observed).toEqual(prior);
  expect(next.observed.facts).toHaveLength(2);
  expect(next.observed.facts[0]).toBe(memory.observed.facts[0]);
  expect(next.observed.facts[1]).not.toBe(after.augmentHistory.facts[1]);
  expect(next.observed.facts[1]).toEqual(after.augmentHistory.facts[1]);
  expect(next.observed.facts.map((f: { deaths: unknown[] }) => f.deaths)).toEqual([[], []]);
});
