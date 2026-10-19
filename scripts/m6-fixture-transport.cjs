'use strict';
const assert = require('node:assert/strict');
const PIPE_CAPACITY = 100 * 1024 * 1024;
const COMMAND_RESERVE = 1024 * 1024;
/** N2-P2-6: an object reachable from an earlier group (the 33-battle complete, full-load and incremental envelopes of
 * one route share immutable subtrees such as loot state) crosses as a reference [group, ...path] to its first path
 * there and is resolved back to that same page object before measurement, so the staged value graph keeps every
 * shared reference. Three groups since T13: complete (~68 MiB) and fullLoad (~33 MiB) together pass one pipe. */
const SHARED_REF = '__m6FixtureSharedRef__';

// Byte-count the locked Playwright 1.63 utility argument format; never encode or
// decode the fixture here. Native Playwright transport retains the actual graph.
/** Every group after the first with each object already reachable from an earlier group replaced by a path
 * reference; each group's own aliases kept. */
function shareAcrossGroups(original) {
  const firstPath = new Map();
  const walk = (value, parent, key, group) => {
    if (!value || typeof value !== 'object' || firstPath.has(value)) return;
    firstPath.set(value, { parent, key, group });
    for (const k of Object.keys(value)) walk(value[k], value, k, group);
  };
  const pathOf = value => {
    const path = []; let at = firstPath.get(value);
    for (; at.parent !== null; at = firstPath.get(at.parent)) path.unshift(at.key);
    return [at.group, ...path];
  };
  let references = 0;
  const groups = original.map((group, index) => {
    if (index > 0) {
      const memo = new Map();
      const copy = value => {
        if (!value || typeof value !== 'object') return value;
        if (firstPath.has(value)) { references++; return { [SHARED_REF]: pathOf(value) }; }
        if (memo.has(value)) return memo.get(value);
        const out = Array.isArray(value) ? [] : {}; memo.set(value, out);
        for (const key of Object.keys(value)) out[key] = copy(value[key]);
        return out;
      };
      const anyShared = (() => { const seen = new Set(); const visit = v => { if (!v || typeof v !== 'object' || seen.has(v)) return false; if (firstPath.has(v)) return true; seen.add(v); return Object.keys(v).some(k => visit(v[k])); }; return visit(group); })();
      // Without sharing, the group crosses as is (same objects as the fixture).
      if (anyShared) group = copy(group);
    }
    // Paths of this group's own objects are identical in the original and the transported copy.
    walk(original[index], null, null, index);
    return group;
  });
  return { transported: groups, references };
}
function inspectFixtureGroups(fixtures) {
  assert.deepEqual(Object.keys(fixtures), ['complete', 'current', 'record', 'fullLoad', 'expectedBattleCount']);
  assert.equal(typeof fixtures.expectedBattleCount, 'number');
  const original = [{ complete: fixtures.complete }, { fullLoad: fixtures.fullLoad }, { current: fixtures.current, record: fixtures.record }];
  // Validate the original data first (plain values only, no accessors run), allowing cross-group sharing.
  summarize(original, false);
  const shared = shareAcrossGroups(original);
  const groups = shared.transported;
  // The transported groups themselves never alias across groups; byte accounting is of what actually crosses.
  const summaries = summarize(groups, true);
  return { groups, summaries, sharedReferences: shared.references, capacityBytes: PIPE_CAPACITY, commandReserveBytes: COMMAND_RESERVE };
}
function summarize(groups, crossGroupCheck) {
  const ownership = new WeakMap();
  return groups.map((group, groupIndex) => {
    const seen = new Map();
    const bytes = value => Buffer.byteLength(JSON.stringify(value));
    function size(value) {
      assert.notEqual(value, undefined, 'M6 fixture transport undefined value');
      if (value === null) return bytes({ v: 'null' });
      if (typeof value === 'number') {
        if (Object.is(value, -0)) return bytes({ v: '-0' });
        if (!Number.isFinite(value)) return bytes({ v: String(value) });
        return bytes(value);
      }
      if (typeof value === 'string' || typeof value === 'boolean') return bytes(value);
      assert.equal(typeof value, 'object', 'M6 fixture transport requires plain data');
      assert([Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(value)), 'M6 fixture transport requires plain objects/arrays');
      const owner = ownership.get(value);
      assert(!crossGroupCheck || owner === undefined || owner === groupIndex, 'M6 fixture transport cross-group alias');
      ownership.set(value, groupIndex);
      if (seen.has(value)) return bytes({ ref: seen.get(value) });
      const id = seen.size + 1; seen.set(value, id);
      const keys = Object.keys(value);
      for (const key of Object.getOwnPropertyNames(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        assert(Object.hasOwn(descriptor, 'value') && (descriptor.enumerable || (Array.isArray(value) && key === 'length')), 'M6 fixture transport hidden/accessor property');
      }
      assert.equal(Object.getOwnPropertySymbols(value).length, 0, 'M6 fixture transport symbol key');
      assert(crossGroupCheck || !Object.hasOwn(value, SHARED_REF), 'M6 fixture transport reserved key');
      for (const key of keys) assert(Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'), 'M6 fixture transport accessor');
      if (Array.isArray(value)) {
        assert.equal(keys.length, value.length, 'M6 fixture transport sparse/extended array');
        return bytes({ a: [], id }) + keys.reduce((total, key, index) => {
          assert.equal(key, String(index), 'M6 fixture transport array key');
          return total + size(value[key]);
        }, 0) + Math.max(0, keys.length - 1);
      }
      return bytes({ o: [], id }) + keys.reduce((total, key) => total + bytes({ k: key, v: null }) - 4 + size(value[key]), 0) + Math.max(0, keys.length - 1);
    }
    const encodedArgumentBytes = size(group);
    assert(encodedArgumentBytes + COMMAND_RESERVE < PIPE_CAPACITY, 'M6 fixture transport group exceeds DevTools capacity reserve');
    return { fields: Object.keys(group), encodedArgumentBytes, uniqueObjects: seen.size };
  });
}
/** Page-side inverse of shareAcrossGroups (self-contained for page.evaluate and Node tests). Groups are patched in
 * order, so a reference always lands on an earlier group's own (already patched) object. */
function resolveSharedReferences(groups, mark) {
  const seen = new Set();
  const patch = value => {
    if (!value || typeof value !== 'object') return value;
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === mark) { const [group, ...path] = value[mark]; return path.reduce((at, key) => at[key], groups[group]); }
    if (seen.has(value)) return value;
    seen.add(value);
    for (const key of keys) { const next = patch(value[key]); if (next !== value[key]) value[key] = next; }
    return value;
  };
  for (const group of groups.slice(1)) patch(group);
  return groups;
}

// Self-contained in both Node and page.evaluate. Hash values, field order and
// every repeated-reference edge; special scalar paths prevent JSON from hiding
// undefined/-0/nonfinite differences. Node signs before transport; browser signs
// only on the independent verification page after all measured callbacks.
async function fixtureSignature(fixtures) {
  const seen = new Map(), aliases = [], special = [];
  function visit(value, path) {
    if (value === undefined || (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0)))) {
      special.push([path, Object.is(value, -0) ? '-0' : String(value)]); return;
    }
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) { aliases.push([seen.get(value), path]); return; }
    seen.set(value, path);
    for (const key of Object.keys(value)) visit(value[key], `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`);
  }
  visit(fixtures, 'fixtures');
  const text = JSON.stringify(fixtures), encoder = new TextEncoder();
  const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
  return { jsonBytes: encoder.encode(text).length, valueSha256: await digest(text), uniqueObjects: seen.size,
    aliasCount: aliases.length, aliasSha256: await digest(JSON.stringify(aliases)), specialCount: special.length, specialSha256: await digest(JSON.stringify(special)) };
}
async function stageFixtureGroups(page, fixtures, groups) {
  const handles = [];
  try {
    for (const group of groups) handles.push(await page.evaluateHandle(value => value, group));
    await page.evaluate(({ groups, expectedBattleCount, mark, resolver }) => {
      if (Object.hasOwn(globalThis, '__M6_PERF_FIXTURES')) throw new Error('M6 fixture staging already occupied');
      // Restore cross-group shared references before any measured callback (staging only, outside timing).
      new Function(`return (${resolver})`)()(groups, mark);
      globalThis.__M6_PERF_FIXTURES = { complete: groups[0].complete, current: groups[2].current, record: groups[2].record,
        fullLoad: groups[1].fullLoad, expectedBattleCount };
    }, { groups: handles, expectedBattleCount: fixtures.expectedBattleCount, mark: SHARED_REF, resolver: resolveSharedReferences.toString() });
  } catch (error) {
    throw new Error(`M6 fixture transport failed: ${error.message}`, { cause: error });
  } finally {
    await Promise.all(handles.map(handle => handle.dispose()));
  }
}
module.exports = { inspectFixtureGroups, fixtureSignature, stageFixtureGroups, resolveSharedReferences, SHARED_REF };
