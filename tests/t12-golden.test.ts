import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {CONTENT_DIGEST} from '../src/simulation/content';
import {LOOT_REPLAY_DIGEST} from '../src/simulation/loot-freeze';
import {restoreMatch} from './fixtures/history-evidence';
import baseline from './t12-content-baseline.json';
import old from './t11-content-baseline.json';
import audit from '../docs/evidence/t12/golden-audit.json';
const bytes=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url));
const sha=(path:string)=>createHash('sha256').update(bytes(path)).digest('hex');
it('T12 binds full-route digest-only audit and historical identity without changing historical evidence',()=>{
  expect(CONTENT_DIGEST).not.toBe(baseline.contentDigest);
  expect(LOOT_REPLAY_DIGEST).not.toBe(baseline.lootReplayDigest);
  expect(baseline.previousContentDigest).toBe(old.contentDigest);
  expect(baseline.previousStateTraceHash).toBe(old.stateTraceHash);
  expect(sha('scripts/update-t12-golden.cjs')).toBe(audit.updaterSha256);
  expect(sha('tests/t12-content-baseline.json')).toBe(audit.baselineSha256);
  expect(sha('tests/fixtures/m5/full-match-golden.t12.json')).toBe(audit.candidateSha256);
  for(const route of Object.values(audit.builds))expect(route).toMatchObject({commandsUnchanged:true,eventHashesUnchanged:true,ledgerUnchanged:true,checkpointsUnchanged:true});
});
for(const name of ['ionic-spark','evenshroud','ionic-spark--evenshroud','quicksilver','edge-of-night'])
  it(`T12 public ${name} raw fixture differs from T11 only by digest; preserved old save rejects`,()=>{
    const previous=bytes(`tests/fixtures/t11-herald-raw/${name}.json`).toString();
    const current=JSON.parse(bytes(`tests/fixtures/t12-herald-raw/${name}.json`).toString());
    const normalized=JSON.stringify(current,(k,v)=>k==='contentDigest'&&v===baseline.contentDigest?old.contentDigest:v);
    expect(JSON.parse(normalized)).toEqual(JSON.parse(previous));
    expect(()=>restoreMatch(previous)).toThrow(/Invalid Match save/);
    expect(()=>restoreMatch(current)).toThrow(/Invalid Match save/);
  });
