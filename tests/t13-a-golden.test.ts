import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {CONTENT_DIGEST} from '../src/simulation/content';
import {LOOT_REPLAY_DIGEST} from '../src/simulation/loot-freeze';
import {restoreMatch} from '../src/simulation/serialization';
import baseline from './t13-a-content-baseline.json';
import old from './t12-content-baseline.json';
import audit from '../docs/evidence/t13-a/golden-audit.json';
const bytes=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url));
const sha=(path:string)=>createHash('sha256').update(bytes(path)).digest('hex');
it('T13-A binds full-route digest-only audit and current identity without changing historical evidence',()=>{
  expect(CONTENT_DIGEST).toBe(baseline.contentDigest);
  expect(LOOT_REPLAY_DIGEST).toBe(baseline.lootReplayDigest);
  expect(baseline.previousContentDigest).toBe(old.contentDigest);
  expect(baseline.previousStateTraceHash).toBe(old.stateTraceHash);
  expect(sha('scripts/update-t13-a-golden.cjs')).toBe(audit.updaterSha256);
  expect(sha('tests/t13-a-content-baseline.json')).toBe(audit.baselineSha256);
  expect(sha('tests/fixtures/m5/full-match-golden.t13-a.json')).toBe(audit.candidateSha256);
  for(const route of Object.values(audit.builds))expect(route).toMatchObject({commandsUnchanged:true,eventHashesUnchanged:true,ledgerUnchanged:true,checkpointsUnchanged:true});
});
for(const name of ['ionic-spark','evenshroud','ionic-spark--evenshroud','quicksilver','edge-of-night'])
  it(`T13-A public ${name} raw fixture differs from T12 only by digest; preserved old save rejects`,()=>{
    const previous=bytes(`tests/fixtures/t12-herald-raw/${name}.json`).toString();
    const current=JSON.parse(bytes(`tests/fixtures/t13-a-herald-raw/${name}.json`).toString());
    const normalized=JSON.stringify(current,(k,v)=>k==='contentDigest'&&v===baseline.contentDigest?old.contentDigest:v);
    expect(JSON.parse(normalized)).toEqual(JSON.parse(previous));
    expect(()=>restoreMatch(previous)).toThrow(/content-digest/);
    expect(restoreMatch(current)).toEqual(current);
  });
