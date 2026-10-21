import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {restoreMatch} from '../src/simulation/serialization';
import audit from '../docs/evidence/p3p4p5/release-audit.json';
import golden from './fixtures/m5/full-match-golden.p3p4p5.json';
import priorGolden from './fixtures/m5/full-match-golden.t13.json';
import {expect,it} from 'vitest';
import {CONTENT_DIGEST} from '../src/simulation/content';
import {LOOT_REPLAY_DIGEST} from '../src/simulation/loot-freeze';
import {M8_VERSION} from '../src/simulation/m8/version';
import baseline from './p3p4p5-content-baseline.json';
import currentBaseline from './p7-content-baseline.json';
import old from './t13-content-baseline.json';
import live from './g2-1-content-baseline.json';
import expansionAudit from '../docs/evidence/g2-1/release-audit.json';
import expansionGolden from './fixtures/m5/full-match-golden.g2-1.json';
it('G2 advances the combined release and preserves P3/P4/P5 and T13 as export-only baselines',()=>{
 expect(CONTENT_DIGEST).not.toBe(currentBaseline.contentDigest);expect(currentBaseline.previousContentDigest).toBe(live.contentDigest);expect(LOOT_REPLAY_DIGEST).not.toBe(live.lootReplayDigest);
 expect(live.previousContentDigest).toBe(baseline.contentDigest);expect(live.previousLootReplayDigest).toBe(baseline.lootReplayDigest);
 expect(baseline.previousContentDigest).toBe(old.contentDigest);expect(baseline.previousLootReplayDigest).toBe(old.lootReplayDigest);
 expect(M8_VERSION).toMatchObject({schemaVersion:10,saveFormatVersion:6,replayFormatVersion:4,commandProtocolVersion:4});
 expect(CONTENT_DIGEST).not.toBe(old.contentDigest);expect(LOOT_REPLAY_DIGEST).not.toBe(old.lootReplayDigest);
});

const bytes=(file:string)=>readFileSync(new URL(`../${file}`,import.meta.url));
const sha=(file:string)=>createHash('sha256').update(bytes(file)).digest('hex');
it('preserves original T13 bytes and pins genuinely re-recorded commands, events and states',()=>{
 expect(sha('tests/fixtures/m5/full-match-golden.t13.json')).toBe(audit.previousGoldenSha256);
 expect(sha('tests/fixtures/m5/full-match-golden.p3p4p5.json')).toBe(audit.candidateSha256);
 for(const build of ['cannon','sniper'] as const){
  expect(sha(`tests/fixtures/t13-recorded-states/${build}.json.gz`)).toBe(audit.builds[build].previousRecordingSha256);
  const recording=JSON.parse(gunzipSync(bytes(`tests/fixtures/t13-recorded-states/${build}.json.gz`)).toString());
  expect(()=>restoreMatch(recording.states[0])).toThrow();
  expect(audit.builds[build].comparedStates).toBe(67);
 }
 for(const build of ['cannon','sniper','mage','sniper-caitlyn'] as const){
  expect(golden.routes[build].versions.contentDigest).toBe(baseline.contentDigest);
  expect(golden.routes[build].commands).toEqual(priorGolden.routes[build].commands);
  expect(golden.routes[build].rounds.map(r=>r.eventsHash)).toEqual(priorGolden.routes[build].rounds.map(r=>r.eventsHash));
 }
 expect(baseline.traceHashes.events).toBe(old.traceHashes.events);expect(baseline.traceHashes.rng).toBe(old.traceHashes.rng);
});

it('pins G2 public-command byte evidence while preserving #90 recording bytes',()=>{
 expect(sha('tests/fixtures/m5/full-match-golden.p3p4p5.json')).toBe(expansionAudit.previousGoldenSha256);
 expect(sha('tests/fixtures/m5/full-match-golden.g2-1.json')).toBe(expansionAudit.candidateSha256);
 for(const build of ['cannon','sniper'] as const){
  const recording=expansionAudit.builds[build].recording!;
  expect(sha(`tests/fixtures/p3p4p5-recorded-states/${build}.json.gz`)).toBe(recording.previousGzipSha256);
  expect(sha(`tests/fixtures/g2-1-recorded-states/${build}.json.gz`)).toBe(recording.gzipSha256);
  expect(recording.states).toBe(67);expect(recording.textAndObjectRestoreBytesEqual).toBe(true);
  const prior=JSON.parse(gunzipSync(bytes(`tests/fixtures/p3p4p5-recorded-states/${build}.json.gz`)).toString());expect(()=>restoreMatch(prior.states[0])).toThrow();
 }
 for(const build of ['cannon','sniper','mage','sniper-caitlyn'] as const){
  expect(expansionGolden.routes[build].versions.contentDigest).toBe(live.contentDigest);
  expect(expansionAudit.builds[build].firstCommandDifference).not.toBeNull();
  expect(expansionAudit.builds[build].summary.outcome).toBe('victory');
 }
});
