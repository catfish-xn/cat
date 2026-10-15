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
it('P3/P4/P5 bind one combined release and preserve the released T13 identity as an export-only baseline',()=>{
 expect(CONTENT_DIGEST).toBe(currentBaseline.contentDigest);expect(currentBaseline.previousContentDigest).toBe(baseline.contentDigest);expect(LOOT_REPLAY_DIGEST).toBe(baseline.lootReplayDigest);
 expect(baseline.previousContentDigest).toBe(old.contentDigest);expect(baseline.previousLootReplayDigest).toBe(old.lootReplayDigest);
 expect(M8_VERSION).toMatchObject({schemaVersion:7,saveFormatVersion:3,replayFormatVersion:3,commandProtocolVersion:3});
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
