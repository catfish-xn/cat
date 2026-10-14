import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {CONTENT_DIGEST} from '../src/simulation/content';
import audit from '../docs/evidence/t13/golden-audit.json';
import golden from './fixtures/m5/full-match-golden.t13.json';
const sha=(file:string)=>createHash('sha256').update(readFileSync(new URL(`../${file}`,import.meta.url))).digest('hex');
it('T13 records independent full-route audits while preserving the T12 golden bytes',()=>{
 expect(sha('tests/fixtures/m5/full-match-golden.t12.json')).toBe(audit.previousSha256);
 expect(sha('tests/fixtures/m5/full-match-golden.t13.json')).toBe(audit.candidateSha256);
 expect(sha(audit.recordedDriverPath)).toBe(audit.driverSha256);
 expect(sha('scripts/generate-m5-route.cjs')).toBe(audit.currentDriverSha256);
 expect(sha('tests/fixtures/m5/oracle.cjs')).toBe(audit.oracleSha256);
 for(const [build,route] of Object.entries(golden.routes)){
  const result=audit.builds[build as keyof typeof audit.builds];
  expect(route.versions.contentDigest).toBe(CONTENT_DIGEST);
  expect(result.summary).toMatchObject({outcome:'victory',round:38});
  expect(result.summary.formedBattles).toBeGreaterThanOrEqual(3);
  expect(result.ledger.rounds).toHaveLength(38);expect(route.rounds).toHaveLength(33);
 }
});
