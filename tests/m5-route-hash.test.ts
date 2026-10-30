import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { hash } = require('../scripts/m4-evidence.cjs');
const { createRouteHash } = require('../scripts/m5-route-hash.cjs');

it('pins the current route hash dependency in both v25 source inventories', () => {
  const file = 'scripts/m5-route-hash.cjs';
  const { sourceDigests } = require('../scripts/v25-online-rules-fixture-audit.cjs');
  expect(sourceDigests()[file]).toBe(createHash('sha256').update(readFileSync(file)).digest('hex'));
  const recorder = readFileSync('tests/fixtures/record-v25-online-rules-herald.cjs', 'utf8');
  const sources = recorder.match(/const files = \[([\s\S]*?)\]\.sort\(\)/)![1];
  expect(sources).toContain("'scripts/m5-route-hash.cjs'");
  expect(sources).not.toContain("'scripts/m4-evidence.cjs'");
});

it('keeps the exact canonical SHA-256 for immutable route states, shared branches and reordered keys', () => {
  const routeHash = createRouteHash();
  const leaf = { z: '雪\n"\\', a: -0, missing: undefined, n: null };
  const initial = { '2': leaf, '10': [leaf, , undefined, { b: true, a: false }], a: [1, 2] };
  expect(routeHash(initial)).toBe(hash(initial));
  expect(routeHash({ a: [1, 2], '10': initial['10'], '2': leaf })).toBe(hash(initial));
  let state = { round: 0, facts: [] as object[] };
  for (let round = 1; round <= 40; round++) {
    const before = state;
    state = { round, facts: [...before.facts, { round, roster: [{ id: 'unit-1', items: ['sword', 'bow'] }] }] };
    expect(routeHash(before)).toBe(hash(before));
    expect(routeHash(state)).toBe(hash(state));
  }
  expect(routeHash(state)).toBe(hash(state));
  const mutable = structuredClone(state);
  mutable.round++;
  // A new route scope has no identity evidence from another run or a corruption.
  expect(createRouteHash()(mutable)).toBe(hash(mutable));
  expect(createRouteHash()(mutable)).not.toBe(routeHash(state));
});

it('matches the original encoding through a deterministic DAG with sparse and undefined children', () => {
  const routeHash = createRouteHash(), nodes: unknown[] = [null, undefined, -0, NaN, Infinity, '雪', true, false];
  for (let i = 0; i < 150; i++) {
    const child = nodes[(i * 7 + 3) % nodes.length];
    const node = i % 2 ? { z: child, a: [child, , undefined, { n: i }], omitted: undefined }
      : [child, child, { '10': i, '2': child }];
    nodes.push(node);
    expect(routeHash(node)).toBe(hash(node));
  }
});
