/** Verify immutable baseline preservation, every staged byte, real LTK preparation and CPU stepping. No GPU/server writes. */
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import sharp from 'sharp';
sharp.concurrency(4);
const stage = resolve(process.argv[2] ?? '/home/aiapps/workspcae/cat-cx-uiassets/assets3d-local/vfx-batch2-stage');
const json = async p => JSON.parse(await readFile(join(stage,p)));
const sha = b => createHash('sha256').update(b).digest('hex');
const summary = await json('release-summary.json'), errors = [], heroes = [];
const base = await json('baseline/precache.json'), current = await json('precache.json'), entries = new Map(current.files.map(e => [e.path,e]));
for (const entry of base.files) if (entry.path !== 'vfx-ltk/index.json' && JSON.stringify(entry) !== JSON.stringify(entries.get(entry.path))) errors.push(`old entry changed: ${entry.path}`);
if (sha(await readFile(join(stage,'manifest.json'))) !== summary.baselineSha256['manifest.json']) errors.push('manifest changed');
const root = await json('vfx-ltk/index.json'), before = await json('baseline/vfx-ltk-index.json');
for (const section of ['systems','assets','skills']) if (JSON.stringify(root[section]) !== JSON.stringify(before[section])) errors.push(`root ${section} changed`);
for (const [key,value] of Object.entries(before.champions ?? {})) if (root.champions[key] !== value) errors.push(`champion removed: ${key}`);
const delta = await json('precache.delta.json');
for (const entry of delta.files) {
  const bytes = await readFile(join(stage,entry.path));
  if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) errors.push(`staged bytes differ: ${entry.path}`);
}
const scratch = await mkdtemp('/tmp/vfx-batch2-verify-');
await build({stdin:{resolveDir:process.cwd(),contents:`export { createVfxLibrary } from './src/rendering/three-mode/vfx-ltk/loader';
 export { createLtkParticles } from './src/rendering/three-mode/vfx-ltk/particles'; export { DataTexture, PerspectiveCamera } from 'three';`,loader:'ts'},
 outfile:join(scratch,'verify.mjs'),format:'esm',platform:'node',bundle:true,logLevel:'silent'});
const { createVfxLibrary, createLtkParticles, DataTexture, PerspectiveCamera } = await import(pathToFileURL(join(scratch,'verify.mjs')));
const prefix = 'http://stage/', local = url => {
  if (!url.startsWith(prefix) || url.includes('..')) throw Error('outside-stage'); return join(stage,url.slice(prefix.length));
};
const reader = {
  readJson: async url => JSON.parse(await readFile(local(url))),
  readBinary: async url => { const b=await readFile(local(url)); return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength); },
  readTexture: async url => { const {data,info}=await sharp(local(url)).ensureAlpha().raw().toBuffer({resolveWithObject:true}); return new DataTexture(new Uint8Array(data),info.width,info.height); },
};
const library = createVfxLibrary(prefix,reader,{groundPass:true}); await library.ready;
const camera = new PerspectiveCamera(); camera.position.set(0,200,300); camera.updateMatrixWorld();
const anchor = { originAt:()=>[0,0,0], basisInto:(_time,out)=>{out.set([1,0,0,0,1,0,0,0,1]);return out;} };
const target = {...anchor,originAt:()=>[100,0,100]};
for (const row of summary.heroes) {
  const catalog = await library.champion(row.champion), results = [];
  if (!catalog?.index) {errors.push(`missing catalogue: ${row.champion}`);continue;}
  const selected = new Set(Object.values(catalog.index.skills).flatMap(c=>c??[]).map(c=>c.system));
  for (const id of selected) {
    try {
      const prepared=await catalog.load(id), fx=createLtkParticles(prepared,{anchor,target,joints:()=>anchor,duration:2,seed:1});
      try {for(let frame=0;frame<60;frame++)fx.update(1/30,camera);} finally {fx.dispose();}
      results.push({id,status:prepared.empty?'empty-noop':'loaded',emitters:prepared.drawn.length,surfaceSystems:prepared.surfaces?.size??0});
    } catch(error) {results.push({id,status:'rejected',error:String(error)});errors.push(`${row.champion}/${id}: ${error}`);}
  }
  heroes.push({champion:row.champion,selectedSystems:selected.size,profiles:row.profiles,results});
}
library.dispose();
const report={passed:!errors.length,checkedFiles:delta.files.length,baselineEntriesPreserved:base.files.length-1,heroes,errors,gpuVerified:false};
await writeFile(join(stage,'validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checkedFiles:report.checkedFiles,heroes:heroes.map(h=>({champion:h.champion,systems:h.selectedSystems,loaded:h.results.filter(r=>r.status!=='rejected').length})),errors}));
if(errors.length)process.exitCode=1;
