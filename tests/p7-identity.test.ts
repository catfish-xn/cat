import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {CONTENT_DIGEST} from '../src/simulation/content';
import {LOOT_REPLAY_DIGEST} from '../src/simulation/loot-freeze';
import {restoreMatch} from '../src/simulation/serialization';
import baseline from './p7-content-baseline.json';
import prior from './g2-1-content-baseline.json';
import audit from '../docs/evidence/p7/release-audit.json';
import golden from './fixtures/m5/full-match-golden.p7.json';
import priorGolden from './fixtures/m5/full-match-golden.g2-1.json';
const bytes=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url));
const sha=(p:string)=>createHash('sha256').update(bytes(p)).digest('hex');
it('binds P7 once and preserves all historical golden bytes and route commands/events',()=>{
 expect(CONTENT_DIGEST).toBe(baseline.contentDigest);
 expect(baseline.previousContentDigest).toBe(prior.contentDigest);
 expect(LOOT_REPLAY_DIGEST).toBe(prior.lootReplayDigest);
 expect(sha('tests/fixtures/m5/full-match-golden.g2-1.json')).toBe(audit.previousGoldenSha256);
 expect(sha('tests/fixtures/m5/full-match-golden.p7.json')).toBe(audit.candidateSha256);
 expect(baseline.traceHashes.events).toBe(prior.traceHashes.events);
 expect(baseline.traceHashes.rng).toBe(prior.traceHashes.rng);
 for(const build of ['cannon','sniper','mage','sniper-caitlyn'] as const){
  expect(golden.routes[build].versions.contentDigest).toBe(CONTENT_DIGEST);
  expect(golden.routes[build].commands).toEqual(priorGolden.routes[build].commands);
  expect(golden.routes[build].rounds.map(r=>r.eventsHash)).toEqual(priorGolden.routes[build].rounds.map(r=>r.eventsHash));
 }
});
it('preserves 134 complete recorded states except the single content identity update',()=>{
 for(const build of ['cannon','sniper'] as const){
  expect(sha(`tests/fixtures/g2-1-recorded-states/${build}.json.gz`)).toBe(audit.builds[build].previousRecordingSha256);
  const before=JSON.parse(gunzipSync(bytes(`tests/fixtures/g2-1-recorded-states/${build}.json.gz`)).toString());
  const after=JSON.parse(gunzipSync(bytes(`tests/fixtures/p7-recorded-states/${build}.json.gz`)).toString());
  expect(after.states).toHaveLength(67);
  expect(after).toEqual(JSON.parse(JSON.stringify(before).split(prior.contentDigest).join(CONTENT_DIGEST)));
  expect(()=>restoreMatch(before.states[0])).toThrow();
  expect(restoreMatch(after.states[0])).toEqual(after.states[0]);
 }
});
