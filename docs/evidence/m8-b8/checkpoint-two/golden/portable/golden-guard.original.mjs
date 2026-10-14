import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const guards = require('../scripts/update-m8-b8-golden.cjs');
const root = resolve(import.meta.dirname, '..');
const evidence = join(root, 'docs/evidence/m8-b8/checkpoint-two/golden');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const diff = (build) => JSON.parse(gunzipSync(readFileSync(join(evidence, `diff-${build}.json.gz`))).toString());

describe('B8 exact reviewed golden migration guards', () => {
  it('preserves the exact ff60a79/4554f5a bytes and rejects a semantically equal reserialization', () => {
    const bytes = readFileSync(join(root, 'tests/fixtures/m5/full-match-golden.pre-m8-b8.json'));
    expect(sha(bytes)).toBe('007b6b4136d6959b227cbd9567948f83dca75db4ad788fd43d03c4e3cf069cc5');
    expect(() => guards.guardBaseline(bytes)).not.toThrow();
    expect(() => guards.guardBaseline(Buffer.from(JSON.stringify(JSON.parse(bytes.toString()))))).toThrow('refuse unknown');
  });
  it.each(['old', 'new'])('%s input fingerprint binds source, driver, independent oracle and original assert/skip/gates', (kind) => {
    const value = JSON.parse(readFileSync(join(evidence, `${kind}-manifest.json`), 'utf8'));
    expect(() => guards.guardInputs(kind, value)).not.toThrow();
    for (const file of ['src/simulation/match.ts', 'scripts/generate-m5-route.cjs', 'tests/fixtures/m5/oracle.cjs', 'tests/fixtures/m5/assert-golden.cjs', 'tests/m5-route.test.ts', 'tests/m6-integration.test.ts', 'scripts/verify-m5-headless.cjs', 'scripts/verify-m5-input.cjs']) {
      const changed = structuredClone(value); changed.files[file] = 'unreviewed';
      expect(() => guards.guardInputs(kind, changed)).toThrow('input fingerprint');
    }
  });
  it.each(['schemaVersion', 'rulesVersion', 'contentVersion', 'contentDigest', 'commandProtocolVersion', 'rngAlgorithm', 'tickMs'])('rejects an unapproved %s instead of relaxing version checks', (key) => {
    const route = { initial: { ...guards.VERSION } };
    expect(() => guards.guardVersions(route)).not.toThrow();
    route.initial[key] = typeof route.initial[key] === 'number' ? route.initial[key] + 1 : `${route.initial[key]}-unreviewed`;
    expect(() => guards.guardVersions(route)).toThrow('boundary');
  });
  it.each(['cannon', 'sniper', 'mage', 'sniper-caitlyn'])('pins the independently reviewed complete %s semantic diff', (build) => {
    expect(() => guards.guardReviewedDiff(build, diff(build))).not.toThrow();
  });
  it('rejects a nested field under a known top-level field', () => {
    const changed = diff('cannon');
    changed.rounds[1].newCommandEvidence[0].decisionInputs.preparation.units[0].unreviewedRule = 1;
    expect(() => guards.guardReviewedDiff('cannon', changed)).toThrow('Unknown nested state or command');
  });
  it('rejects an extra familiar command even if its type has an explanatory label', () => {
    const changed = diff('cannon');
    changed.rounds[1].commands.push({ newIndex: 999, semantic: { type: 'buyXp' }, status: 'added', cause: 'unchanged-driver-on-oracle-verified-gold-level-XP' });
    expect(() => guards.guardReviewedDiff('cannon', changed)).toThrow('Unknown nested state or command');
  });
  it('rejects unknown top-level fields and enumerates nested leaf additions', () => {
    expect(() => guards.stateDiff({}, { unreviewedRule: 1 })).toThrow('UNKNOWN state difference');
    expect(guards.leafDifferences({ preparation: { x: 1 } }, { preparation: { x: 1, unreviewed: 2 } })).toEqual([
      { path: '/preparation/unreviewed', oldPresent: false, newPresent: true, old: null, new: 2 },
    ]);
  });
  it('independently rejects unearned XP spending and the wrong component demand', () => {
    const common = { round: 2, roundDefinitionId: '1-3', gold: 0, level: 2, preparation: { units: [] }, items: [], shop: { generation: 2 }, anomalyBinding: null };
    expect(() => guards.driverDecision({ command: { type: 'buyXp' }, before: common }, 'cannon')).toThrow();
    const pendingChoice = { kind: 'component', choiceId: 'earned-choice', generation: 0 };
    expect(() => guards.driverDecision({ command: { type: 'select', choiceId: 'earned-choice', generation: 0, definitionId: 'belt' }, before: { ...common, pendingChoice } }, 'cannon')).toThrow('independent exact choice');
    expect(guards.driverDecision({ command: { type: 'select', choiceId: 'earned-choice', generation: 0, definitionId: 'sword' }, before: { ...common, pendingChoice } }, 'cannon').firstMissing).toBe('sword');
  });
  it('rejects changed candidate bytes before any replay or write', () => {
    const directory = mkdtempSync(join(tmpdir(), 'b8-guard-test-'));
    try {
      const audit = { updaterSha256: sha(readFileSync(join(root, 'scripts/update-m8-b8-golden.cjs'))), candidateSha256: sha('approved candidate') };
      const bytes = JSON.stringify(audit); writeFileSync(join(directory, 'audit.json'), bytes); writeFileSync(join(directory, 'candidate.json'), 'tampered candidate');
      expect(() => guards.verifyReviewed(directory, sha(bytes))).toThrow('candidate changed after review');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
