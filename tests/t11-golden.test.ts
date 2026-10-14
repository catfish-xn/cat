import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { LOOT_REPLAY_DIGEST } from '../src/simulation/loot-freeze';
import { OPENING_ECONOMY_RULES } from '../src/simulation/match-rules';
import { restoreMatch } from '../src/simulation/serialization';
import baseline from './t11-content-baseline.json';
import t12 from './t12-content-baseline.json';
import audit from '../docs/evidence/t11/golden-audit.json';

const bytes = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url));
const sha = (path: string) => createHash('sha256').update(bytes(path)).digest('hex');

it('T11 binds regenerated route/probe evidence to the reviewed audit and preserved historical identity', () => {
  expect(sha('tests/fixtures/m5/full-match-golden.t11.json')).toBe(audit.candidateSha256);
  expect(sha('tests/t11-content-baseline.json')).toBe(audit.baselineSha256);
  expect(sha('scripts/update-t11-golden.cjs')).toBe(audit.updaterSha256);
  expect(t12.previousContentDigest).toBe(baseline.contentDigest);
  expect(CONTENT_DIGEST).not.toBe(t12.contentDigest);
  expect(LOOT_REPLAY_DIGEST).not.toBe(baseline.lootReplayDigest);
  expect(OPENING_ECONOMY_RULES.version).toBe(baseline.openingRulesVersion);
});

it('T11 rejects an actual preserved pre-T11 save without rewriting its original bytes', () => {
  const raw = JSON.parse(bytes('tests/fixtures/m8-herald-raw/ionic-spark.json').toString());
  const before = JSON.stringify(raw);
  expect(() => restoreMatch(raw)).toThrow('unsupported-version');
  expect(JSON.stringify(raw)).toBe(before);
  expect(() => restoreMatch(before)).toThrow('unsupported-version');
});
