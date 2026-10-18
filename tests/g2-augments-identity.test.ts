import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { restoreMatch } from './fixtures/history-evidence';
import audit from '../docs/evidence/g2-augments/fixture-migration.json';
const bytes=(p:string)=>readFileSync(new URL('../'+p,import.meta.url));
const sha=(p:string)=>createHash('sha256').update(bytes(p)).digest('hex');
it('retains W4 historical bytes and rejects their obsolete identity',()=>{
 expect(sha('tests/fixtures/m5/full-match-golden.g2-augments.json')).toBe(audit.goldenBytes.currentSha256);
 for(const build of ['cannon','sniper']) {
  const old=JSON.parse(gunzipSync(bytes(`tests/fixtures/g2-augments-recorded-states/${build}.json.gz`)).toString()).states;
  expect(old).toHaveLength(67);
  for(const state of [old[0],old.at(-1)]) expect(()=>restoreMatch(state)).toThrow();
 }
});
