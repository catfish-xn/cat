import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { CONTENT_DIGEST, digestContent } from '../src/simulation/content';
import { LOOT_REPLAY_DIGEST } from '../src/simulation/loot-freeze';
import { createMatch, startMatchCombat, stepMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import prior from './opening-random-content-baseline.json';
import previousOpening from './g2-augments-content-baseline.json';

// Historical hashes/byte counts refer to the committed LF JSON, before Windows
// checkout EOL filters. Decode that representation in memory only; binary gzip
// inputs stay exact. v18-fixture-audit separately verifies original historical LF bytes.
const bytes = (p: string) => {
  const raw = readFileSync(new URL(`../${p}`, import.meta.url));
  return p.endsWith('.json') ? Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n')) : raw;
};
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const load = (p: string) => JSON.parse(bytes(p).toString());
const baseline = () => load('tests/g2-4b-content-baseline.json');
const currentBaseline = () => load('tests/v20-chem-baron-content-baseline.json');
const g23 = () => load('tests/g2-3-content-baseline.json');

it('preserves the historical opening-random to G2-3 identity chain', () => {
  const recorded = g23();
  expect(recorded.contentDigest).not.toBe(prior.contentDigest);
  expect(recorded.rulesVersion).not.toBe(prior.rulesVersion);
  expect(recorded.contentVersion).not.toBe(prior.contentVersion);
  expect(recorded.previousContentDigest).toBe(prior.contentDigest);
  expect(recorded.previousLootReplayDigest).toBe(prior.lootReplayDigest);
  expect(recorded.lootReplayDigest).not.toBe(prior.lootReplayDigest);
  const audit = load('docs/evidence/opening-random/fixture-migration.json');
  expect(audit.baselineCommit).toBe('94eecbcbfbce72d4740923b8c793c66c483bfd51');
  expect(audit.lootReplayDigestCurrent).toBe(prior.lootReplayDigest);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.g2-augments.json'))).toBe(audit.goldenBytes.previousSha256);
  const r1 = load('docs/evidence/opening-random/r1-random-rewards.json');
  const golden = r1.files['tests/fixtures/m5/full-match-golden.opening-random.json'];
  expect(prior.previousContentDigest).toBe(previousOpening.contentDigest);
  expect(golden.previousSha256).toBe(audit.goldenBytes.currentSha256);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.opening-random.json'))).toBe(golden.currentSha256);
  expect(r1.identity).toMatchObject({contentDigest:prior.contentDigest,lootReplayDigest:prior.lootReplayDigest,unchangedFromPreviousHead:true});
});

it('binds preserved G2-4b checkpoints to historical G2-3 byte evidence', () => {
  const recorded = baseline(), previous = g23(), fresh = JSON.parse(gunzipSync(bytes('tests/fixtures/g2-4b-recorded-states/cannon.json.gz')).toString()).states[0];
  for (const key of ['contentDigest', 'rulesVersion', 'contentVersion', 'schemaVersion'] as const)
    expect(fresh[key]).toBe(recorded[key]);
  expect(recorded.contentDigest).toBe('fnv1a32-utf16:ea6b11b6');
  expect(recorded.lootReplayDigest).toBe('fnv1a32-utf16:9895bc42');
  // Release v14 (shared tiers and free augment rerolls) moves both versions and the content digest off G2-3 v10.
  expect(recorded.contentDigest).not.toBe(previous.contentDigest);
  expect(recorded.rulesVersion).toBe('s13-g2-3-v14');
  expect(recorded.contentVersion).toBe('s13-14.24b-g2-3-v14');
  expect(recorded.rulesVersion).not.toBe(previous.rulesVersion);
  expect(recorded.contentVersion).not.toBe(previous.contentVersion);
  expect(recorded.previousContentDigest).toBe(previous.contentDigest);
  expect(recorded.previousLootReplayDigest).toBe(previous.lootReplayDigest);
  const audit = load('docs/evidence/g2-4b/release-audit.json');
  expect(audit.baseline).toEqual(recorded);
  expect(audit.baseCommit).toMatch(/^[0-9a-f]{40}$/);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.g2-3.json'))).toBe(audit.previousGoldenSha256);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.g2-4b.json'))).toBe(audit.candidateSha256);
  const historicalAudit = load('docs/evidence/g2-3/release-audit.json');
  expect(audit.previousGoldenSha256).toBe(historicalAudit.candidateSha256);
  for (const build of ['cannon', 'sniper']) {
    const oldBytes = bytes(`tests/fixtures/g2-3-recorded-states/${build}.json.gz`);
    const currentBytes = bytes(`tests/fixtures/g2-4b-recorded-states/${build}.json.gz`);
    const evidence = audit.builds[build].recording;
    expect(sha(oldBytes)).toBe(evidence.previousGzipSha256);
    expect(sha(oldBytes)).toBe(historicalAudit.builds[build].recording.gzipSha256);
    expect(sha(currentBytes)).toBe(evidence.gzipSha256);
    expect(evidence.byteEvidence.previousBytes).toBe(oldBytes.length);
    expect(evidence.byteEvidence.currentBytes).toBe(currentBytes.length);
    expect(evidence.textAndObjectRestoreBytesEqual).toBe(true);
    const old = JSON.parse(gunzipSync(oldBytes).toString()).states;
    expect(old).toHaveLength(67);
    for (const state of [old[0], old.at(-1)]) {
      expect(() => restoreMatch(state)).toThrow();
      expect(() => restoreMatch(JSON.stringify(state))).toThrow();
    }
  }
  const inputs = load('docs/evidence/g2-4b/input-fixture-audit.json');
  expect(inputs.baseCommit).toBe(audit.baseCommit);
  expect(inputs.contentDigest).toBe(recorded.contentDigest);
  for (const [path, raw] of Object.entries(inputs.files)) {
    const evidence = raw as {previousSha256: string; currentSha256: string};
    expect(sha(bytes(path))).toBe(evidence.currentSha256);
    expect(sha(bytes(path.replace('g2-4b-', 'g2-3-')))).toBe(evidence.previousSha256);
  }
});

it('binds v15 to fresh public rules and preserved G2-4b byte evidence', () => {
  const recorded = load('tests/v15-content-baseline.json'), previous = baseline(), fresh = JSON.parse(gunzipSync(bytes('tests/fixtures/v15-recorded-states/cannon.json.gz')).toString()).states[0];
  const CONTENT_DIGEST=fresh.contentDigest,LOOT_REPLAY_DIGEST=fresh.m8.loot.frozen.replayDigest;
  for (const key of ['contentDigest', 'rulesVersion', 'contentVersion', 'schemaVersion'] as const)
    expect(fresh[key]).toBe(recorded[key]);
  expect(CONTENT_DIGEST).toBe(recorded.contentDigest);
  expect(LOOT_REPLAY_DIGEST).toBe(recorded.lootReplayDigest);
  // v15 has its own identity; retained v14 evidence remains byte-for-byte unchanged.
  expect(recorded.contentDigest).not.toBe(previous.contentDigest);
  expect(recorded.rulesVersion).toBe('s13-g2-3-v15');
  expect(recorded.contentVersion).toBe('s13-14.24b-g2-3-v15');
  expect(recorded.rulesVersion).not.toBe(previous.rulesVersion);
  expect(recorded.contentVersion).not.toBe(previous.contentVersion);
  expect(recorded.previousContentDigest).toBe(previous.contentDigest);
  expect(recorded.previousLootReplayDigest).toBe(previous.lootReplayDigest);
  const audit = load('docs/evidence/v15/release-audit.json');
  expect(audit.baseline).toEqual(recorded);
  expect(audit.baseCommit).toMatch(/^[0-9a-f]{40}$/);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.g2-4b.json'))).toBe(audit.previousGoldenSha256);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.v15.json'))).toBe(audit.candidateSha256);
  const historicalAudit = load('docs/evidence/g2-4b/release-audit.json');
  expect(audit.previousGoldenSha256).toBe(historicalAudit.candidateSha256);
  for (const build of ['cannon', 'sniper']) {
    const oldBytes = bytes(`tests/fixtures/g2-4b-recorded-states/${build}.json.gz`);
    const currentBytes = bytes(`tests/fixtures/v15-recorded-states/${build}.json.gz`);
    const evidence = audit.builds[build].recording;
    expect(sha(oldBytes)).toBe(evidence.previousGzipSha256);
    expect(sha(oldBytes)).toBe(historicalAudit.builds[build].recording.gzipSha256);
    expect(sha(currentBytes)).toBe(evidence.gzipSha256);
    expect(evidence.byteEvidence.previousBytes).toBe(oldBytes.length);
    expect(evidence.byteEvidence.currentBytes).toBe(currentBytes.length);
    expect(evidence.textAndObjectRestoreBytesEqual).toBe(true);
    const old = JSON.parse(gunzipSync(oldBytes).toString()).states;
    expect(old).toHaveLength(67);
    for (const state of [old[0], old.at(-1)]) {
      expect(() => restoreMatch(state)).toThrow();
      expect(() => restoreMatch(JSON.stringify(state))).toThrow();
    }
  }
  const inputs = load('docs/evidence/v15/input-fixture-audit.json');
  expect(inputs.baseCommit).toBe(audit.baseCommit);
  expect(inputs.contentDigest).toBe(recorded.contentDigest);
  for (const [path, raw] of Object.entries(inputs.files)) {
    const evidence = raw as {previousSha256: string; currentSha256: string};
    expect(sha(bytes(path))).toBe(evidence.currentSha256);
    expect(sha(bytes(path.replace('v15-', 'g2-4b-')))).toBe(evidence.previousSha256);
  }
});

it('binds v16 to fresh public rules and preserved G2-4b byte evidence', () => {
  const recorded = load('tests/v16-content-baseline.json'), previous = load('tests/v15-content-baseline.json'), fresh = JSON.parse(gunzipSync(bytes('tests/fixtures/v16-recorded-states/cannon.json.gz')).toString()).states[0];
  const CONTENT_DIGEST=fresh.contentDigest,LOOT_REPLAY_DIGEST=fresh.m8.loot.frozen.replayDigest;
  for (const key of ['contentDigest', 'rulesVersion', 'contentVersion', 'schemaVersion'] as const)
    expect(fresh[key]).toBe(recorded[key]);
  expect(CONTENT_DIGEST).toBe(recorded.contentDigest);
  expect(LOOT_REPLAY_DIGEST).toBe(recorded.lootReplayDigest);
  // v16 has its own identity; retained v14 evidence remains byte-for-byte unchanged.
  expect(recorded.contentDigest).not.toBe(previous.contentDigest);
  expect(recorded.rulesVersion).toBe('s13-g2-3-v16');
  expect(recorded.contentVersion).toBe('s13-14.24b-g2-3-v16');
  expect(recorded.rulesVersion).not.toBe(previous.rulesVersion);
  expect(recorded.contentVersion).not.toBe(previous.contentVersion);
  expect(recorded.previousContentDigest).toBe(previous.contentDigest);
  expect(recorded.previousLootReplayDigest).toBe(previous.lootReplayDigest);
  const audit = load('docs/evidence/v16/release-audit.json');
  expect(audit.baseline).toEqual(recorded);
  expect(audit.baseCommit).toMatch(/^[0-9a-f]{40}$/);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.v15.json'))).toBe(audit.previousGoldenSha256);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.v16.json'))).toBe(audit.candidateSha256);
  const historicalAudit = load('docs/evidence/v15/release-audit.json');
  expect(audit.previousGoldenSha256).toBe(historicalAudit.candidateSha256);
  for (const build of ['cannon', 'sniper']) {
    const oldBytes = bytes(`tests/fixtures/v15-recorded-states/${build}.json.gz`);
    const currentBytes = bytes(`tests/fixtures/v16-recorded-states/${build}.json.gz`);
    const evidence = audit.builds[build].recording;
    expect(sha(oldBytes)).toBe(evidence.previousGzipSha256);
    expect(sha(oldBytes)).toBe(historicalAudit.builds[build].recording.gzipSha256);
    expect(sha(currentBytes)).toBe(evidence.gzipSha256);
    expect(evidence.byteEvidence.previousBytes).toBe(oldBytes.length);
    expect(evidence.byteEvidence.currentBytes).toBe(currentBytes.length);
    expect(evidence.textAndObjectRestoreBytesEqual).toBe(true);
    const old = JSON.parse(gunzipSync(oldBytes).toString()).states;
    expect(old).toHaveLength(67);
    for (const state of [old[0], old.at(-1)]) {
      expect(() => restoreMatch(state)).toThrow();
      expect(() => restoreMatch(JSON.stringify(state))).toThrow();
    }
  }
  const inputs = load('docs/evidence/v16/input-fixture-audit.json');
  expect(inputs.baseCommit).toBe(audit.baseCommit);
  expect(inputs.contentDigest).toBe(recorded.contentDigest);
  for (const [path, raw] of Object.entries(inputs.files)) {
    const evidence = raw as {previousSha256: string; currentSha256: string};
    expect(sha(bytes(path))).toBe(evidence.currentSha256);
    expect(sha(bytes(path.replace('v16-', 'v15-')))).toBe(evidence.previousSha256);
  }
});

it('binds v17 to fresh public rules and preserved v16 byte evidence', () => {
  const recorded = load('tests/v17-content-baseline.json'), previous = load('tests/v16-content-baseline.json'), fresh = JSON.parse(gunzipSync(bytes('tests/fixtures/v17-recorded-states/cannon.json.gz')).toString()).states[0];
  const CONTENT_DIGEST=fresh.contentDigest,LOOT_REPLAY_DIGEST=fresh.m8.loot.frozen.replayDigest;
  for (const key of ['contentDigest', 'rulesVersion', 'contentVersion', 'schemaVersion'] as const)
    expect(fresh[key]).toBe(recorded[key]);
  expect(CONTENT_DIGEST).toBe(recorded.contentDigest);
  expect(LOOT_REPLAY_DIGEST).toBe(recorded.lootReplayDigest);
  // v17 has its own identity; retained v16 evidence remains byte-for-byte unchanged.
  expect(recorded.contentDigest).not.toBe(previous.contentDigest);
  expect(recorded.rulesVersion).toBe('s13-g2-3-v17');
  expect(recorded.contentVersion).toBe('s13-14.24b-g2-3-v17');
  expect(recorded.rulesVersion).not.toBe(previous.rulesVersion);
  expect(recorded.contentVersion).not.toBe(previous.contentVersion);
  expect(recorded.previousContentDigest).toBe(previous.contentDigest);
  expect(recorded.previousLootReplayDigest).toBe(previous.lootReplayDigest);
  const audit = load('docs/evidence/v17/release-audit.json');
  expect(audit.baseline).toEqual(recorded);
  expect(audit.baseCommit).toMatch(/^[0-9a-f]{40}$/);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.v16.json'))).toBe(audit.previousGoldenSha256);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.v17.json'))).toBe(audit.candidateSha256);
  const historicalAudit = load('docs/evidence/v16/release-audit.json');
  expect(audit.previousGoldenSha256).toBe(historicalAudit.candidateSha256);
  for (const build of ['cannon', 'sniper']) {
    const oldBytes = bytes(`tests/fixtures/v16-recorded-states/${build}.json.gz`);
    const currentBytes = bytes(`tests/fixtures/v17-recorded-states/${build}.json.gz`);
    const evidence = audit.builds[build].recording;
    expect(sha(oldBytes)).toBe(evidence.previousGzipSha256);
    expect(sha(oldBytes)).toBe(historicalAudit.builds[build].recording.gzipSha256);
    expect(sha(currentBytes)).toBe(evidence.gzipSha256);
    expect(evidence.byteEvidence.previousBytes).toBe(oldBytes.length);
    expect(evidence.byteEvidence.currentBytes).toBe(currentBytes.length);
    expect(evidence.textAndObjectRestoreBytesEqual).toBe(true);
    const old = JSON.parse(gunzipSync(oldBytes).toString()).states;
    expect(old).toHaveLength(67);
    for (const state of [old[0], old.at(-1)]) {
      expect(() => restoreMatch(state)).toThrow();
      expect(() => restoreMatch(JSON.stringify(state))).toThrow();
    }
  }
  const inputs = load('docs/evidence/v17/input-fixture-audit.json');
  expect(inputs.baseCommit).toBe(audit.baseCommit);
  expect(inputs.contentDigest).toBe(recorded.contentDigest);
  for (const [path, raw] of Object.entries(inputs.files)) {
    const evidence = raw as {previousSha256: string; currentSha256: string};
    expect(sha(bytes(path))).toBe(evidence.currentSha256);
    expect(sha(bytes(path.replace('v17-', 'v16-')))).toBe(evidence.previousSha256);
  }
});

it('binds v18 to fresh public rules and preserved v17 byte evidence', () => {
  expect(bytes('tests/fixtures/record-v18-herald.cjs').toString()).toContain('v18-herald-raw');
  expect(load('tests/fixtures/v18-herald-raw/manifest.json').generationVersion).toBe('v18-herald-public-commands-v1');
  const recorded = load('tests/v18-content-baseline.json'), previous = load('tests/v17-content-baseline.json');
  expect(() => restoreMatch({ ...createMatch(42), rulesVersion: recorded.rulesVersion })).toThrow();
  // v18 has its own identity; retained v17 evidence remains byte-for-byte unchanged.
  expect(recorded.contentDigest).not.toBe(previous.contentDigest);
  expect(recorded.rulesVersion).toBe('s13-g2-3-v18');
  expect(recorded.contentVersion).toBe('s13-14.24b-g2-3-v18');
  expect(recorded.rulesVersion).not.toBe(previous.rulesVersion);
  expect(recorded.contentVersion).not.toBe(previous.contentVersion);
  expect(recorded.previousContentDigest).toBe(previous.contentDigest);
  expect(recorded.previousLootReplayDigest).toBe(previous.lootReplayDigest);
  const audit = load('docs/evidence/v18/release-audit.json');
  expect(audit.baseline).toEqual(recorded);
  expect(audit.baseCommit).toMatch(/^[0-9a-f]{40}$/);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.v17.json'))).toBe(audit.previousGoldenSha256);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.v18.json'))).toBe(audit.candidateSha256);
  const historicalAudit = load('docs/evidence/v17/release-audit.json');
  expect(audit.previousGoldenSha256).toBe(historicalAudit.candidateSha256);
  for (const build of ['cannon', 'sniper']) {
    const oldBytes = bytes(`tests/fixtures/v17-recorded-states/${build}.json.gz`);
    const currentBytes = bytes(`tests/fixtures/v18-recorded-states/${build}.json.gz`);
    const evidence = audit.builds[build].recording;
    expect(sha(oldBytes)).toBe(evidence.previousGzipSha256);
    expect(sha(oldBytes)).toBe(historicalAudit.builds[build].recording.gzipSha256);
    expect(sha(currentBytes)).toBe(evidence.gzipSha256);
    expect(evidence.byteEvidence.previousBytes).toBe(oldBytes.length);
    expect(evidence.byteEvidence.currentBytes).toBe(currentBytes.length);
    expect(evidence.textAndObjectRestoreBytesEqual).toBe(true);
    const old = JSON.parse(gunzipSync(oldBytes).toString()).states;
    expect(old).toHaveLength(67);
    for (const state of [old[0], old.at(-1)]) {
      expect(() => restoreMatch(state)).toThrow();
      expect(() => restoreMatch(JSON.stringify(state))).toThrow();
    }
  }
  const inputs = load('docs/evidence/v18/input-fixture-audit.json');
  expect(inputs.baseCommit).toBe(audit.baseCommit);
  expect(inputs.contentDigest).toBe(recorded.contentDigest);
  for (const [path, raw] of Object.entries(inputs.files)) {
    const evidence = raw as {previousSha256: string; currentSha256: string};
    expect(sha(bytes(path))).toBe(evidence.currentSha256);
    expect(sha(bytes(path.replace('v18-', 'v17-')))).toBe(evidence.previousSha256);
  }
});

it('binds v19 to fresh public rules and preserved v18 byte evidence', () => {
  expect(bytes('tests/fixtures/record-v19-herald.cjs').toString()).toContain('v19-herald-raw');
  expect(load('tests/fixtures/v19-herald-raw/manifest.json').generationVersion).toBe('v19-herald-public-commands-v1');
  const recorded = load('tests/v19-content-baseline.json'), previous = load('tests/v18-content-baseline.json'), fresh = JSON.parse(gunzipSync(bytes('tests/fixtures/v19-recorded-states/cannon.json.gz')).toString()).states[0];
  const CONTENT_DIGEST = fresh.contentDigest, LOOT_REPLAY_DIGEST = fresh.m8.loot.frozen.replayDigest;
  for (const key of ['contentDigest', 'rulesVersion', 'contentVersion', 'schemaVersion'] as const)
    expect(fresh[key]).toBe(recorded[key]);
  expect(CONTENT_DIGEST).toBe(recorded.contentDigest);
  expect(LOOT_REPLAY_DIGEST).toBe(recorded.lootReplayDigest);
  // v19 has its own identity; retained v18 evidence remains byte-for-byte unchanged.
  expect(recorded.contentDigest).not.toBe(previous.contentDigest);
  expect(recorded.rulesVersion).toBe('s13-g2-3-v19');
  expect(recorded.contentVersion).toBe('s13-14.24b-g2-3-v19');
  expect(recorded.rulesVersion).not.toBe(previous.rulesVersion);
  expect(recorded.contentVersion).not.toBe(previous.contentVersion);
  expect(recorded.previousContentDigest).toBe(previous.contentDigest);
  expect(recorded.previousLootReplayDigest).toBe(previous.lootReplayDigest);
  const audit = load('docs/evidence/v19/release-audit.json');
  expect(audit.baseline).toEqual(recorded);
  expect(audit.baseCommit).toMatch(/^[0-9a-f]{40}$/);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.v18.json'))).toBe(audit.previousGoldenSha256);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.v19.json'))).toBe(audit.candidateSha256);
  const historicalAudit = load('docs/evidence/v18/release-audit.json');
  expect(audit.previousGoldenSha256).toBe(historicalAudit.candidateSha256);
  for (const build of ['cannon', 'sniper']) {
    const oldBytes = bytes(`tests/fixtures/v18-recorded-states/${build}.json.gz`);
    const currentBytes = bytes(`tests/fixtures/v19-recorded-states/${build}.json.gz`);
    const evidence = audit.builds[build].recording;
    expect(sha(oldBytes)).toBe(evidence.previousGzipSha256);
    expect(sha(oldBytes)).toBe(historicalAudit.builds[build].recording.gzipSha256);
    expect(sha(currentBytes)).toBe(evidence.gzipSha256);
    expect(evidence.byteEvidence.previousBytes).toBe(oldBytes.length);
    expect(evidence.byteEvidence.currentBytes).toBe(currentBytes.length);
    expect(evidence.textAndObjectRestoreBytesEqual).toBe(true);
    const old = JSON.parse(gunzipSync(oldBytes).toString()).states;
    expect(old).toHaveLength(67);
    for (const state of [old[0], old.at(-1)]) {
      expect(() => restoreMatch(state)).toThrow();
      expect(() => restoreMatch(JSON.stringify(state))).toThrow();
    }
  }
  const inputs = load('docs/evidence/v19/input-fixture-audit.json');
  expect(inputs.baseCommit).toBe(audit.baseCommit);
  expect(inputs.contentDigest).toBe(recorded.contentDigest);
  for (const [path, raw] of Object.entries(inputs.files)) {
    const evidence = raw as {previousSha256: string; currentSha256: string};
    expect(sha(bytes(path))).toBe(evidence.currentSha256);
    expect(sha(bytes(path.replace('v19-', 'v18-')))).toBe(evidence.previousSha256);
  }
});

it('binds v20-chem-baron to fresh public rules and preserved v19 byte evidence', () => {
  expect(bytes('scripts/verify-m8-herald-fixtures.cjs').toString()).toContain("const CURRENT = '../tests/fixtures/record-v20-chem-baron-herald.cjs';");
  expect(load('tests/fixtures/v20-chem-baron-herald-raw/manifest.json').generationVersion).toBe('v20-chem-baron-herald-public-commands-v1');
  const recorded = currentBaseline(), previous = load('tests/v19-content-baseline.json'), fresh = createMatch(42);
  expect(recorded.parentEpoch).toBe('v19');
  for (const key of ['contentDigest', 'rulesVersion', 'contentVersion', 'schemaVersion'] as const)
    expect(fresh[key]).toBe(recorded[key]);
  expect(CONTENT_DIGEST).toBe(recorded.contentDigest);
  expect(LOOT_REPLAY_DIGEST).toBe(recorded.lootReplayDigest);
  // v20-chem-baron has its own identity; retained v19 evidence remains byte-for-byte unchanged.
  expect(recorded.contentDigest).not.toBe(previous.contentDigest);
  expect(recorded.rulesVersion).toBe('s13-g2-3-v20-chem-baron');
  expect(recorded.contentVersion).toBe('s13-14.24b-g2-3-v20-chem-baron');
  expect(recorded.rulesVersion).not.toBe(previous.rulesVersion);
  expect(recorded.contentVersion).not.toBe(previous.contentVersion);
  expect(recorded.previousContentDigest).toBe(previous.contentDigest);
  expect(recorded.previousLootReplayDigest).toBe(previous.lootReplayDigest);
  const audit = load('docs/evidence/v20-chem-baron/release-audit.json');
  expect(audit.baseline).toEqual(recorded);
  expect(audit.baseCommit).toMatch(/^[0-9a-f]{40}$/);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.v19.json'))).toBe(audit.previousGoldenSha256);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.v20-chem-baron.json'))).toBe(audit.candidateSha256);
  const historicalAudit = load('docs/evidence/v19/release-audit.json');
  expect(audit.previousGoldenSha256).toBe(historicalAudit.candidateSha256);
  for (const build of ['cannon', 'sniper']) {
    const oldBytes = bytes(`tests/fixtures/v19-recorded-states/${build}.json.gz`);
    const currentBytes = bytes(`tests/fixtures/v20-chem-baron-recorded-states/${build}.json.gz`);
    const evidence = audit.builds[build].recording;
    expect(sha(oldBytes)).toBe(evidence.previousGzipSha256);
    expect(sha(oldBytes)).toBe(historicalAudit.builds[build].recording.gzipSha256);
    expect(sha(currentBytes)).toBe(evidence.gzipSha256);
    expect(evidence.byteEvidence.previousBytes).toBe(oldBytes.length);
    expect(evidence.byteEvidence.currentBytes).toBe(currentBytes.length);
    expect(evidence.textAndObjectRestoreBytesEqual).toBe(true);
    const old = JSON.parse(gunzipSync(oldBytes).toString()).states;
    expect(old).toHaveLength(67);
    for (const state of [old[0], old.at(-1)]) {
      expect(() => restoreMatch(state)).toThrow();
      expect(() => restoreMatch(JSON.stringify(state))).toThrow();
    }
  }
  const inputs = load('docs/evidence/v20-chem-baron/input-fixture-audit.json');
  expect(inputs.baseCommit).toBe(audit.baseCommit);
  expect(inputs.contentDigest).toBe(recorded.contentDigest);
  for (const [path, raw] of Object.entries(inputs.files)) {
    const evidence = raw as {previousSha256: string; currentSha256: string};
    expect(sha(bytes(path))).toBe(evidence.currentSha256);
    expect(sha(bytes(path.replace('v20-chem-baron-', 'v19-')))).toBe(evidence.previousSha256);
  }
});

it('rejects each old release identity without migration shortcuts', () => {
  const fresh = createMatch(42);
  for (const key of ['contentDigest', 'rulesVersion', 'contentVersion'] as const)
    expect(() => restoreMatch({ ...fresh, [key]: prior[key] })).toThrow();
  // G2-3 v10 identities are old releases now: neither its digest nor its version strings restore.
  expect(() => restoreMatch({ ...fresh, contentDigest: g23().contentDigest })).toThrow();
  expect(() => restoreMatch({ ...fresh, rulesVersion: g23().rulesVersion })).toThrow();
  expect(() => restoreMatch({ ...fresh, contentVersion: g23().contentVersion })).toThrow();
  for (const key of ['contentDigest', 'rulesVersion', 'contentVersion'] as const)
    expect(() => restoreMatch({ ...fresh, [key]: baseline()[key] })).toThrow();
  expect(() => restoreMatch({ ...fresh, commandProtocolVersion: 3 })).toThrow();
  // v11 (support anvil) version strings are superseded by v12.
  expect(() => restoreMatch({ ...fresh, rulesVersion: 's13-g2-3-v11' })).toThrow();
  expect(() => restoreMatch({ ...fresh, contentVersion: 's13-14.24b-g2-3-v11' })).toThrow();
  // v12 (augment/anomaly fixes) version strings are superseded by v14.
  expect(() => restoreMatch({ ...fresh, rulesVersion: 's13-g2-3-v12' })).toThrow();
  expect(() => restoreMatch({ ...fresh, contentVersion: 's13-14.24b-g2-3-v12' })).toThrow();
  // v13 (augment/anomaly batch) is superseded by v14 without save migration.
  expect(() => restoreMatch({ ...fresh, rulesVersion: 's13-g2-3-v13' })).toThrow();
  expect(() => restoreMatch({ ...fresh, contentVersion: 's13-14.24b-g2-3-v13' })).toThrow();
});
for (const build of ['cannon', 'sniper']) {
  const old = JSON.parse(gunzipSync(bytes(`tests/fixtures/opening-random-recorded-states/${build}.json.gz`)).toString()).states;
  const current = JSON.parse(gunzipSync(bytes(`tests/fixtures/v20-chem-baron-recorded-states/${build}.json.gz`)).toString()).states;
  it(`${build}: preserves all 67 raw checkpoints and rejects old first/final states`,()=>{
    expect(old).toHaveLength(67);expect(current).toHaveLength(67);
    for (const state of [old[0], old.at(-1)]) expect(() => restoreMatch(state)).toThrow();
  });
  // Each raw checkpoint has its own original five-second limit and full production restore.
  // Only raw inputs are read ahead; no validated runtime object or restore result is cached.
  it.each(Array.from({length:current.length},(_,index)=>index))(`${build}: checkpoint %i survives strict text/object restore`,index=>{
    const state=structuredClone(current[index]), serialized=serializeMatch(state);
    expect(restoreMatch(serialized)).toEqual(state);
    expect(restoreMatch(JSON.parse(serialized))).toEqual(state);
    expect(serializeMatch(restoreMatch(serialized))).toBe(serialized);
  });
}

it('recomputes the first battle terminal and every event hash from public commands', () => {
  const recorded = currentBaseline();
  const start = startMatchCombat(createMatch(42));
  if (!start.ok) throw new Error(start.reason);
  let state = start.state;
  const states = [state], batches = [start.events];
  while (state.phase === 'combat') {
    const next = stepMatch(state);
    state = next.state;
    states.push(state);
    batches.push(next.events);
  }
  const combat = state.combat!;
  const events = batches.flat().filter(e => 'tick' in e);
  expect(recorded.firstBattle).toEqual({
    seed: 42, ticks: combat.tick, events: events.length, result: combat.result,
    stateHash: digestContent(combat), eventHash: digestContent(events),
  });
  expect(sha(JSON.stringify(states))).toBe(recorded.traceHashes.state);
  expect(sha(JSON.stringify(batches))).toBe(recorded.traceHashes.events);
});
