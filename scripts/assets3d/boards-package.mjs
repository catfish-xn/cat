import { readFile, readdir, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { boardRoot, boardPlanJson } from './boards-plan.mjs';
import { boardReferences } from './boards-build.mjs';
import { binField, fnv1a } from './bin.mjs';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { createPrecache } from './merge-manifests.mjs';
import { combineBoardGeometry } from './boards-pack-geometry.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
export function verifyBoardPackage(manifest, precache, files, effects) {
  boardRoot(manifest.boardKey);
  if(Object.keys(manifest.boards??{}).join()!==manifest.boardKey)throw new Error('invalid-board-manifest-key');
  if(!manifest.models[manifest.boardKey])throw new Error('missing-board-model-key');
  const indexed = new Map(precache.files.map(f=>[f.path,f]));
  if(indexed.size!==precache.files.length)throw new Error('duplicate-board-precache-path');
  for(const p of boardReferences(manifest,effects))if(!indexed.has(p))throw new Error('incomplete-board-precache');
  for(const [p,b] of files){
    if(p==='manifest.json'||p==='precache.json'||p==='compression-report.json')continue;
    const row=indexed.get(p);if(!row || row.bytes!==b.length || row.sha256!==hash(b))throw new Error('board-precache-mismatch');
  }
  for(const p of indexed.keys())if(!files.has(p))throw new Error('missing-board-payload');
  return {files:indexed.size,bytes:[...files.values()].reduce((n,b)=>n+b.length,0)};
}
export async function packageFiles(root, dir=''){
  const result=new Map();
  for(const e of await readdir(join(root,dir),{withFileTypes:true})){
    const p=[dir,e.name].filter(Boolean).join('/'),actual=await safeInputPath(root,join(root,p));
    if(e.isSymbolicLink())throw new Error('board-package-link');
    if((await stat(actual)).isDirectory())for(const [k,b]of await packageFiles(root,p))result.set(k,b);
    else result.set(p,await readFile(actual));
  }return result;
}
export async function finalizeBoardRoot(root){
  root=await safeOutputPath(resolve(root),{directory:true});
  const files=await packageFiles(root),manifest=JSON.parse(files.get('manifest.json')),scene=JSON.parse(files.get(manifest.boards[manifest.boardKey].path));
  if(scene.models.length && !scene.models[0].node){
    const parts=scene.models.map(m=>({id:m.id,bytes:files.get(manifest.models[m.id].path)}));
    const packed=combineBoardGeometry(parts),id=manifest.boardKey,path='models/arena.glb';
    await writeOutputFileAtomic(join(root,path),packed.glb,{force:true});files.set(path,packed.glb);
    for(const m of scene.models){const p=manifest.models[m.id].path;delete manifest.models[m.id];m.node=m.id;m.id=id;await unlink(await safeOutputPath(join(root,p),{force:true}));files.delete(p);}
    manifest.models[id]={path};
    const mb=Buffer.from(boardPlanJson(manifest));await writeOutputFileAtomic(join(root,'manifest.json'),mb,{force:true});files.set('manifest.json',mb);
  }
  const legacy=`${manifest.boardKey}-arena`;
  if(manifest.models[legacy]){
    manifest.models[manifest.boardKey]=manifest.models[legacy];delete manifest.models[legacy];
    for(const m of scene.models)if(m.id===legacy)m.id=manifest.boardKey;
    const mb=Buffer.from(boardPlanJson(manifest));await writeOutputFileAtomic(join(root,'manifest.json'),mb,{force:true});files.set('manifest.json',mb);
  }
  // Retain exact source fields, and supply direct public IDs/matrices so the
  // renderer need not understand client hashes or consult extraction reports.
  const report=JSON.parse(await readFile(join('assets3d-local/boards/reports',`${manifest.boardKey}.json`)));
  const byHash=new Map(report.systems.map(s=>[fnv1a(s.sourcePath),s.id]));
  scene.effects=report.systems.map(s=>({id:s.id,sourceHash:fnv1a(s.sourcePath),available:!!manifest.effects[s.id]}));
  scene.placements=(scene.effectPlacements??[]).map(p=>({name:binField(p,'name'),matrix:binField(p,'transform'),visibility:binField(p,'mVisibilityFlags')??255,effect:byHash.get(binField(p,'system')?.hash)??null,source:p}));
  scene.props=scene.props.map(p=>({...p,matrix:binField(p.source,'transform'),idle:binField(p.source,'IdleAnimationName')??null,playIdle:binField(p.source,'PlayIdleAnimation')??true,
    renderRole:/generic_interaction/i.test(binField(p.source,'PropName')??'')?'interaction-volume':'visual'}));
  scene.lighting.decodedSun=scene.lighting.sun.map(v=>({color:binField(v,'sunColor'),direction:binField(v,'sunDirection'),skyColor:binField(v,'skyLightColor'),skyScale:binField(v,'skyLightScale'),fogEnabled:binField(v,'fogEnabled')??false}));
  scene.vertexMaskPolicy='Source vertex channels retained as _SOURCE_COLOR; shader-driven tint/deformation is not approximated as a glTF vertex colour multiplier.';
  const bytes=Buffer.from(boardPlanJson(scene));
  files.set(manifest.boards[manifest.boardKey].path,bytes);
  await writeOutputFileAtomic(join(root,manifest.boards[manifest.boardKey].path),bytes,{force:true});
  const plans=new Map([...files].filter(([p])=>!['manifest.json','precache.json','compression-report.json'].includes(p)).map(([p,b])=>[p,{bytes:b.length,sha256:hash(b)}]));
  const precache=createPrecache(plans),pb=Buffer.from(boardPlanJson(precache));files.set('precache.json',pb);
  const effects=Object.fromEntries(Object.entries(manifest.effects).map(([id,e])=>[id,JSON.parse(files.get(e.path))]));
  const result=verifyBoardPackage(manifest,precache,files,effects);
  await writeOutputFileAtomic(join(root,'precache.json'),pb,{force:true});
  return {key:manifest.boardKey,...result};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const plan=JSON.parse(await readFile('assets3d-local/boards/boards-plan.json'));
  for(const p of plan.picks)console.log(await finalizeBoardRoot(join(process.argv[2]??'assets3d-local/boards',boardRoot(p.key))));
}
