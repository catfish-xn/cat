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

const bytes = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url));
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const load = (p: string) => JSON.parse(bytes(p).toString());
const baseline = () => load('tests/g2-4b-content-baseline.json');
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

it('binds G2-4b to fresh public rules and preserved G2-3 byte evidence', () => {
  const recorded = baseline(), previous = g23(), fresh = createMatch(42);
  for (const key of ['contentDigest', 'rulesVersion', 'contentVersion', 'schemaVersion'] as const)
    expect(fresh[key]).toBe(recorded[key]);
  expect(CONTENT_DIGEST).toBe(recorded.contentDigest);
  expect(LOOT_REPLAY_DIGEST).toBe(recorded.lootReplayDigest);
  // User-approved pre-merge integration keeps v10; the content digest must still change.
  expect(recorded.contentDigest).not.toBe(previous.contentDigest);
  expect(recorded.rulesVersion).toBe('s13-g2-3-v10');
  expect(recorded.contentVersion).toBe('s13-14.24b-g2-3-v10');
  expect(recorded.rulesVersion).toBe(previous.rulesVersion);
  expect(recorded.contentVersion).toBe(previous.contentVersion);
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

it('rejects each old release identity without migration shortcuts', () => {
  const fresh = createMatch(42);
  for (const key of ['contentDigest', 'rulesVersion', 'contentVersion'] as const)
    expect(() => restoreMatch({ ...fresh, [key]: prior[key] })).toThrow();
  // G2-3 and this candidate intentionally share v10 strings, never their digest.
  expect(() => restoreMatch({ ...fresh, contentDigest: g23().contentDigest })).toThrow();
  expect(restoreMatch({ ...fresh, rulesVersion: g23().rulesVersion, contentVersion: g23().contentVersion })).toEqual(fresh);
});
for (const build of ['cannon', 'sniper']) {
  const old = JSON.parse(gunzipSync(bytes(`tests/fixtures/opening-random-recorded-states/${build}.json.gz`)).toString()).states;
  const current = JSON.parse(gunzipSync(bytes(`tests/fixtures/g2-4b-recorded-states/${build}.json.gz`)).toString()).states;
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
  const recorded = baseline();
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
