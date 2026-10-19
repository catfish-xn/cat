import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { expectWallClockBelow } from './fixtures/wallclock';
const { profile } = createRequire(import.meta.url)('../scripts/profile-explorer-bracer-restore.cjs');

it('rejects 5,000,000 claimed triggers / 100,000,000 AP in a bounded subprocess', () => {
  const result = profile('huge-count');
  expect(result.exitCode).toBe(0);
  expect(result.outcome).toBe('rejected');
  expect(result.reason).toContain('sampled stat trigger count bound');
  expectWallClockBelow('explorer-bracer huge-count rejection', result.elapsedMs, 1000);
  expect(result.peakRssKiB).toBeLessThan(256 * 1024);
  console.log(JSON.stringify(result));
});

it('keeps the real Titan 25-stack cap while merging 26^12 AP/AD histories', () => {
  const result = profile('dedup-titan');
  expect(result.exitCode).toBe(0);
  expect(result.outcome).toBe('enumerated');
  expect(result.apCount).toBe(301); // 0..(12*25), each stack gives 2 AP.
  expect(result.apMin).toBe(100);
  expect(result.apMax).toBe(700);
  expect(result.adCount).toBe(271); // Irelia's 45 base AD floors 301 Bps sums to 45..315.
  expectWallClockBelow('explorer-bracer Titan dedup enumeration', result.elapsedMs, 1000);
  expect(result.peakRssKiB).toBeLessThan(256 * 1024);
  console.log(JSON.stringify(result));
});
