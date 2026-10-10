import { describe, expect, it } from 'vitest';
import transport from '../scripts/m6-fixture-transport.cjs';
const { inspectFixtureGroups, fixtureSignature } = transport;
const fixture = () => ({ complete: { x: 1 }, current: { y: 2 }, record: { z: 3 }, fullLoad: { w: 4 }, expectedBattleCount: 33, restorationIssue: 'issue-23' });
describe('M6 native handle fixture transport', () => {
  it('keeps the two graph-connected groups and original scalar metadata', () => {
    const input = fixture(), result = inspectFixtureGroups(input);
    expect(Object.keys(result.groups[0])).toEqual(['complete', 'fullLoad']);
    expect(Object.keys(result.groups[1])).toEqual(['current', 'record']);
    expect(result.groups[0].complete).toBe(input.complete);
    expect(result.groups[1].record).toBe(input.record);
    expect(result.summaries.every(g => g.encodedArgumentBytes + result.commandReserveBytes < result.capacityBytes)).toBe(true);
  });
  it('retains aliases within each group and detects a JSON clone losing them', async () => {
    const input = fixture(); input.fullLoad.shared = input.complete; input.record.shared = input.current;
    inspectFixtureGroups(input);
    const original = await fixtureSignature(input), clone = await fixtureSignature(JSON.parse(JSON.stringify(input)));
    expect(original.valueSha256).toBe(clone.valueSha256);
    expect(original.aliasCount).toBe(2); expect(clone.aliasCount).toBe(0);
    expect(original.aliasSha256).not.toBe(clone.aliasSha256);
  });
  it('uses unambiguous paths for keys containing separators', async () => {
    const a = fixture(), b = fixture();
    for (const input of [a, b]) input.complete = { 'a.b': { v: 1 }, a: { b: { v: 1 } } };
    a.complete.link = a.complete['a.b']; b.complete.link = b.complete.a.b;
    const x = await fixtureSignature(a), y = await fixtureSignature(b);
    expect(x.valueSha256).toBe(y.valueSha256); expect(x.aliasSha256).not.toBe(y.aliasSha256);
  });
  it('refuses future cross-group aliases instead of copying them', () => {
    const input = fixture(); input.current.shared = input.complete;
    expect(() => inspectFixtureGroups(input)).toThrow('cross-group alias');
  });
  it('counts native null/reference wrappers and refuses undefined rather than losing keys', () => {
    const input = fixture(); input.complete = { b: null }; input.fullLoad = input.complete;
    const first = inspectFixtureGroups(input).summaries[0];
    const encoded = { o: [{ k: 'complete', v: { o: [{ k: 'b', v: { v: 'null' } }], id: 2 } }, { k: 'fullLoad', v: { ref: 2 } }], id: 1 };
    expect(first.encodedArgumentBytes).toBe(Buffer.byteLength(JSON.stringify(encoded)));
    input.complete.a = undefined;
    expect(() => inspectFixtureGroups(input)).toThrow('undefined value');
  });
  it('signature distinguishes special scalars hidden by ordinary JSON', async () => {
    const input = fixture(); input.complete.values = [-0, NaN, Infinity, -Infinity];
    inspectFixtureGroups(input);
    const a = await fixtureSignature(input), b = await fixtureSignature(JSON.parse(JSON.stringify(input)));
    expect(a.valueSha256).toBe(b.valueSha256); expect(a.specialCount).toBe(4); expect(a.specialSha256).not.toBe(b.specialSha256);
  });
  it('rejects field omissions or reordered fixture root', () => {
    const input = fixture(); delete input.record;
    expect(() => inspectFixtureGroups(input)).toThrow();
    expect(() => inspectFixtureGroups({ current: {}, complete: {}, record: {}, fullLoad: {}, expectedBattleCount: 33, restorationIssue: 'issue-23' })).toThrow();
  });
  it.each(['function', 'accessor', 'hidden getter', 'sparse', 'symbol', 'date'])('rejects unsupported %s data explicitly', kind => {
    const input = fixture();
    if (kind === 'function') input.complete.x = () => 1;
    if (kind === 'accessor') Object.defineProperty(input.complete, 'x', { enumerable: true, get() { throw new Error('getter must not run'); } });
    if (kind === 'hidden getter') Object.defineProperty(input.complete, 'toJSON', { get() { throw new Error('hidden getter must not run'); } });
    if (kind === 'sparse') input.complete.x = new Array(2);
    if (kind === 'symbol') input.complete[Symbol('extra')] = 1;
    if (kind === 'date') input.complete.x = new Date(0);
    expect(() => inspectFixtureGroups(input)).toThrow(/M6 fixture transport/);
  });
  it('fails explicitly before sending a group above the transport reserve', () => {
    const input = fixture(); input.complete.values = Array(21).fill('x'.repeat(5 * 1024 * 1024));
    expect(() => inspectFixtureGroups(input)).toThrow('group exceeds DevTools capacity reserve');
  });
});

describe('M6 staging lifetime (simulated native transport, not Chromium)', () => {
  it('releases every group handle before the callback consumes and deletes staging', async () => {
    const input = fixture(); input.record.shared = input.current; const handles = [];
    const page = {
      async evaluateHandle(_fn, group) { const handle = { value: structuredClone(group), disposed: false, async dispose() { this.disposed = true; } }; handles.push(handle); return handle; },
      async evaluate(fn, args) { return fn({ ...args, first: args.first.value, second: args.second.value }); },
    };
    try {
      await transport.stageFixtureGroups(page, input, inspectFixtureGroups(input).groups);
      expect(handles).toHaveLength(2); expect(handles.every(h => h.disposed)).toBe(true);
      const received = globalThis.__M6_PERF_FIXTURES; delete globalThis.__M6_PERF_FIXTURES;
      expect(received).toEqual(input); expect(received.record.shared).toBe(received.current);
      expect(await fixtureSignature(received)).toEqual(await fixtureSignature(input));
      expect(Object.hasOwn(globalThis, '__M6_PERF_FIXTURES')).toBe(false);
    } finally { delete globalThis.__M6_PERF_FIXTURES; }
  });
  it('releases an earlier handle when the second group fails', async () => {
    let calls = 0, disposed = false;
    const page = { async evaluateHandle() { if (++calls === 2) throw new Error('pipe failed'); return { async dispose() { disposed = true; } }; } };
    const input = fixture();
    await expect(transport.stageFixtureGroups(page, input, inspectFixtureGroups(input).groups)).rejects.toThrow('M6 fixture transport failed: pipe failed');
    expect(disposed).toBe(true); expect(Object.hasOwn(globalThis, '__M6_PERF_FIXTURES')).toBe(false);
  });
});
