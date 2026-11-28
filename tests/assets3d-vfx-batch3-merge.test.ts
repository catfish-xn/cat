import { describe, expect, it } from 'vitest';
// @ts-expect-error Offline ESM publisher deliberately has no browser declaration.
import { mergeBatch3 } from '../scripts/assets3d/prepare-vfx-batch3-upload.mjs';
import { createHash } from 'node:crypto';
describe('batch 3 additive publication', () => {
  it('preserves concurrently published batches and updates the merged root precache hash', () => {
    const manifest = {schemaVersion:1,models:{existing:{path:'one.glb'}},effects:{old:'keep'}}, index={version:1,systems:{old:'old.json'},assets:{old:'old.png'},skills:{},champions:{batch1:'batch1/index.json',batch2:'batch2/index.json'}}, precache={schemaVersion:1,files:[{path:'old',bytes:1,sha256:'one'},{path:'vfx-ltk/index.json',bytes:2,sha256:'old'}]};
    const baseline=structuredClone({manifest,index,precache});
    const publish=()=>mergeBatch3(manifest,index,precache,{models:{spider:{path:'spider.glb'}}},{champions:{elise:'batch3/elise/index.json'}},[{path:'spider.glb',bytes:10,sha256:'two'}]);
    const result=publish(), merged=JSON.parse(result.index), list=JSON.parse(result.precache).files;
    expect(merged.champions).toEqual({...index.champions,elise:'batch3/elise/index.json'}); expect(merged.systems).toEqual(index.systems);
    expect(JSON.parse(result.manifest).models.existing).toEqual(manifest.models.existing);
    expect(list.find((e:{path:string})=>e.path==='vfx-ltk/index.json')).toEqual({path:'vfx-ltk/index.json',bytes:result.index.length,sha256:createHash('sha256').update(result.index).digest('hex')});
    expect(list).toContainEqual(precache.files[0]); expect(publish()).toEqual(result); expect({manifest,index,precache}).toEqual(baseline);
    expect(()=>mergeBatch3(manifest,{...index,champions:{elise:'other/index.json'}},precache,{models:{}},{champions:{elise:'batch3/elise/index.json'}},[])).toThrow('champion-conflict');
    expect(()=>mergeBatch3(manifest,index,precache,{models:{}},{champions:{}},[{path:'old',bytes:2,sha256:'new'}])).toThrow('payload-conflict');
  });
});
