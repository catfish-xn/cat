/** restoreMatch's text fast path is exact: on JSON.parse output, assertParsedContent accepts and rejects exactly what
 * canonicalContent does, and restoreMatch(text) equals restoreMatch(JSON.parse(text)) on recorded and corrupted states. */
import baseline from './v20-black-market-content-baseline.json';
import { describe, expect, it } from 'vitest';
import { goldenStates } from './fixtures/m8-golden-states.cjs';
import { assertParsedContent, canonicalContent } from '../src/simulation/content';
import { restoreMatch } from '../src/simulation/serialization';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const outcome = (f: () => unknown) => { try { f(); return 'accepted'; } catch (error) { return `${(error as Error).name}:${(error as Error).message}`; } };
function lcg(seed: number) { let s = seed >>> 0; return () => (s = Math.imul(s, 1664525) + 1013904223 >>> 0) / 2 ** 32; }
// JSON texts covering every JSON value kind, overflow to ±Infinity, -0, __proto__ keys, unicode escapes and deep nesting.
const LEAVES = ['null', 'true', 'false', '0', '-0', '1', '-7', '0.5', '1e21', '1e400', '-1e400', '1e-400', '"a"', '""', '"\\u2028\\"\\\\"', '[]', '{}'];
function text(rand: () => number, depth: number): string {
  const r = rand();
  if (depth <= 0 || r < 0.35) return LEAVES[Math.floor(rand() * LEAVES.length)];
  if (r < 0.65) return `[${Array.from({ length: Math.floor(rand() * 4) }, () => text(rand, depth - 1)).join(',')}]`;
  return `{${['"b"', '"a"', '"__proto__"', '"constructor"', '"é"', '"10"'].filter(() => rand() < 0.5).map(key => `${key}:${text(rand, depth - 1)}`).join(',')}}`;
}

describe('restoreMatch text fast path is exact', () => {
  const byBuild = { cannon: goldenStates('cannon'), sniper: goldenStates('sniper') };
  const states = [...byBuild.cannon, ...byBuild.sniper];
  it('adversarial JSON texts: same acceptance and same error as canonicalContent', () => {
    const rand = lcg(42); let rejected = 0;
    for (let n = 0; n < 20000; n++) {
      const source = text(rand, 5), expected = outcome(() => canonicalContent(JSON.parse(source)));
      expect(outcome(() => assertParsedContent(JSON.parse(source)))).toBe(expected);
      if (expected !== 'accepted') rejected++;
    }
    expect(rejected).toBeGreaterThan(2000); expect(rejected).toBeLessThan(18000);
  });
  it.each(['cannon', 'sniper'] as const)('recorded %s states: fixture matches the current content baseline', build => {
    expect(byBuild[build].every(raw=>{const state=raw as {contentDigest:string;rulesVersion:string};return state.contentDigest===baseline.contentDigest&&state.rulesVersion===baseline.rulesVersion;})).toBe(true);
    expect(states.length).toBeGreaterThan(100);
    expect(byBuild[build]).toHaveLength(67); // 33 public-route combats, before/after plus final, re-recorded at G2-1.
  });
  // One case per state: each settled combat is independently replayed on restore.
  it.each((['cannon', 'sniper'] as const).flatMap(build => byBuild[build].map((state, index) => ({ build, index, state }))))
  ('recorded $build state $index: restore from text equals restore from the parsed object', ({ state }) => {
    const source = JSON.stringify(state);
    expect(() => assertParsedContent(JSON.parse(source))).not.toThrow();
    expect(restoreMatch(source)).toEqual(restoreMatch(JSON.parse(source)));
  });
  it('recorded states with a non-finite number injected anywhere: both paths reject identically', () => {
    const rand = lcg(7);
    for (const state of states.slice(0, 60)) {
      const source = JSON.stringify(state), numbers = [...source.matchAll(/:(-?\d+)(?=[,}\]])/g)];
      for (let n = 0; n < 3; n++) {
        const hit = numbers[Math.floor(rand() * numbers.length)], at = hit.index! + 1;
        const corrupted = source.slice(0, at) + (rand() < 0.5 ? '1e400' : '-1e999') + source.slice(at + hit[1].length);
        const fromText = outcome(() => restoreMatch(corrupted));
        expect(fromText).toBe('TypeError:Content must be finite plain JSON data');
        expect(outcome(() => restoreMatch(JSON.parse(corrupted)))).toBe(fromText);
      }
    }
  });
});
