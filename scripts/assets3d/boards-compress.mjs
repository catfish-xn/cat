import { readFile, stat, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compressAssets } from './compress.mjs';
import { boardRoot, boardPlanJson } from './boards-plan.mjs';
import { safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { finalizeBoardRoot } from './boards-package.mjs';

const source=fileURLToPath(new URL('./compress.mjs',import.meta.url));
const bytes=await readFile(source);
const plan=JSON.parse(await readFile('assets3d-local/boards/boards-plan.json'));
for(const pick of plan.picks){
  const relative=boardRoot(pick.key),from=join('assets3d-local/boards',relative),out=join('assets3d-local/boards-compressed',relative);
  try{
    const old=JSON.parse(await readFile(join(out,'compression-report.json')));
    if(old.ready){console.log('boards: already compressed',pick.key);continue;}
  }catch(e){if(e.code!=='ENOENT')throw e;}
  try{
    await stat(out);
    const backup=await safeOutputPath(join('assets3d-local/boards/recovery',`${pick.key}-incomplete`),{directory:true});
    const {mkdir}=await import('node:fs/promises');await mkdir(join(backup,'..'),{recursive:true});
    await rename(await safeOutputPath(out,{directory:true}),backup);
  }catch(e){if(e.code!=='ENOENT')throw e;}
  console.log('boards: compress',pick.key);
  const r=await compressAssets({from,out,onProgress:p=>console.log(JSON.stringify({key:pick.key,...p}))});
  const verified=await finalizeBoardRoot(out);
  await writeOutputFileAtomic(join('assets3d-local/boards/reports',`${pick.key}-compression.json`),boardPlanJson({compressor:{source,sha256:createHash('sha256').update(bytes).digest('hex')},...r,verified}),{force:true});
  console.log(JSON.stringify({key:pick.key,before:r.beforeBytes,after:verified.bytes,ready:r.ready}));
}
