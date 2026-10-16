import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {CONTENT_DIGEST} from '../src/simulation/content';
import {LOOT_REPLAY_DIGEST} from '../src/simulation/loot-freeze';
import {restoreMatch} from '../src/simulation/serialization';
import baseline from './g2-2-content-baseline.json';
import prior from './p7-content-baseline.json';
import audit from '../docs/evidence/g2-2/release-audit.json';
const bytes=(p:string)=>readFileSync(new URL('../'+p,import.meta.url));
const sha=(p:string)=>createHash('sha256').update(bytes(p)).digest('hex');
it('freezes one G2-2 identity on the P7 merged base and retains historical bytes',()=>{
 expect(CONTENT_DIGEST).not.toBe(baseline.contentDigest);expect(LOOT_REPLAY_DIGEST).not.toBe(baseline.lootReplayDigest);
 expect(baseline.rulesVersion).toBe('s13-g2-2-v1');expect(baseline.previousContentDigest).toBe(prior.contentDigest);
 expect(sha('tests/fixtures/m5/full-match-golden.p7.json')).toBe(audit.previousGoldenSha256);
 expect(sha('tests/fixtures/m5/full-match-golden.g2-2.json')).toBe(audit.candidateSha256);
 for(const build of ['cannon','sniper'] as const){const r=audit.builds[build].recording!;
  expect(r.states).toBe(67);expect(r.textAndObjectRestoreBytesEqual).toBe(true);
  expect(sha(`tests/fixtures/p7-recorded-states/${build}.json.gz`)).toBe(r.previousGzipSha256);
  expect(sha(`tests/fixtures/g2-2-recorded-states/${build}.json.gz`)).toBe(r.gzipSha256);
  const saved=JSON.parse(gunzipSync(bytes(`tests/fixtures/g2-2-recorded-states/${build}.json.gz`)).toString()).states;
  for(const state of [saved[0],saved.at(-1)])expect(()=>restoreMatch(JSON.stringify(state))).toThrow();
  expect(()=>restoreMatch({...saved[0],contentDigest:prior.contentDigest})).toThrow();
 }
 for(const build of ['cannon','sniper','mage','sniper-caitlyn'] as const){expect(audit.builds[build].firstCommandDifference).not.toBeNull();expect(audit.builds[build].summary.outcome).toBe('victory');}
});
