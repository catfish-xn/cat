import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { CONTENT_DIGEST, digestContent } from '../src/simulation/content';
import { LOOT_REPLAY_DIGEST } from '../src/simulation/loot-freeze';
import { createMatch, startMatchCombat, stepMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import prior from './g2-augments-content-baseline.json';

const bytes = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url));
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const load = (p: string) => JSON.parse(bytes(p).toString());
const baseline = () => load('tests/opening-random-content-baseline.json');

it('binds random opening to one new content/rules identity while updating the opening replay identity', () => {
  const recorded = baseline(), fresh = createMatch(42);
  expect(CONTENT_DIGEST).toBe(recorded.contentDigest);
  expect(fresh.contentDigest).toBe(recorded.contentDigest);
  expect(fresh.rulesVersion).toBe(recorded.rulesVersion);
  expect(fresh.contentVersion).toBe(recorded.contentVersion);
  expect(fresh.schemaVersion).toBe(recorded.schemaVersion);
  expect(recorded.contentDigest).not.toBe(prior.contentDigest);
  expect(recorded.rulesVersion).not.toBe(prior.rulesVersion);
  expect(recorded.contentVersion).not.toBe(prior.contentVersion);
  expect(recorded.previousContentDigest).toBe(prior.contentDigest);
  expect(recorded.previousLootReplayDigest).toBe(prior.lootReplayDigest);
  expect(LOOT_REPLAY_DIGEST).not.toBe(prior.lootReplayDigest);
  expect(recorded.lootReplayDigest).toBe(LOOT_REPLAY_DIGEST);
  const audit = load('docs/evidence/opening-random/fixture-migration.json');
  expect(audit.baselineCommit).toBe('94eecbcbfbce72d4740923b8c793c66c483bfd51');
  expect(audit.lootReplayDigestCurrent).toBe(LOOT_REPLAY_DIGEST);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.g2-augments.json'))).toBe(audit.goldenBytes.previousSha256);
  const r1 = load('docs/evidence/opening-random/r1-random-rewards.json');
  const golden = r1.files['tests/fixtures/m5/full-match-golden.opening-random.json'];
  expect(golden.previousSha256).toBe(audit.goldenBytes.currentSha256);
  expect(sha(bytes('tests/fixtures/m5/full-match-golden.opening-random.json'))).toBe(golden.currentSha256);
  expect(r1.identity).toMatchObject({contentDigest:CONTENT_DIGEST,lootReplayDigest:LOOT_REPLAY_DIGEST,unchangedFromPreviousHead:true});
});

it('rejects each old release identity without migration shortcuts', () => {
  const fresh = createMatch(42);
  for (const key of ['contentDigest', 'rulesVersion', 'contentVersion'] as const)
    expect(() => restoreMatch({ ...fresh, [key]: prior[key] })).toThrow();
});
for (const build of ['cannon', 'sniper']) {
  const old = JSON.parse(gunzipSync(bytes(`tests/fixtures/g2-augments-recorded-states/${build}.json.gz`)).toString()).states;
  const current = JSON.parse(gunzipSync(bytes(`tests/fixtures/opening-random-recorded-states/${build}.json.gz`)).toString()).states;
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
