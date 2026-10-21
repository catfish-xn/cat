import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { BOARD_PICKS, boardRoot, boardPlanJson, placedPropReferences, resolveBoardReference } from './boards-plan.mjs';
import { readRman } from './rman.mjs';
import { offlineArchiveReader } from './global-vfx.mjs';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { stringsIn } from './carousel.mjs';
import { binField, binIs } from './bin.mjs';
import { canonicalAsset, skinBindings, animationClips } from './bin-bindings.mjs';
import { readBoardGeometry, boardRangeGlb } from './boards-geometry.mjs';
import { encodePng } from './texture.mjs';
import { decodeBoardTexture as decodeTexture } from './boards-texture.mjs';
import { pngHasEffectiveAlpha } from './texture-alpha.mjs';
import { inspectSkn } from './inspect-source.mjs';
import { makeModel } from './model.mjs';
import { particleSourcesFromBins } from './particle-bin.mjs';
import { convertParticleMesh } from './particle-mesh.mjs';
import { convertParticles } from './particles.mjs';
import { contracts } from './runtime.mjs';
import { createPrecache } from './merge-manifests.mjs';
import { boardGroundSpan, alignBoardGroundXZ } from './boards-alignment.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const idFor = p => hash(Buffer.from(p)).slice(0, 20);
const json = boardPlanJson;
/** Legacy locator estimate, retained for boards without measured ground evidence.
 * The first-cell interpretation is an assumption, not native grid metadata.
 * GLBs already reflect X. Callers apply this scale and offset to their group. */
export function boardAlignment(first, center, target = {radius:34,origin:{x:35,y:50}}) {
  const sourceStepX=(center[0]-first[0])/3.25,sourceStepZ=(center[2]-first[2])/3.5;
  if(!(sourceStepX>0&&sourceStepZ>0))throw new Error('invalid-board-locators');
  const sx=Math.sqrt(3)*target.radius/sourceStepX,sz=1.5*target.radius/sourceStepZ;
  const targetCenter=[target.origin.x+Math.sqrt(3)*target.radius*3.25,0,target.origin.y+1.5*target.radius*3.5];
  return {status:'locator-aligned',reflectX:true,scale:[sx,sx,-sz],offset:[targetCenter[0]+sx*center[0],-sx*first[1],targetCenter[2]+sz*center[2]],
    sourceFirstCell:first,sourceCenter:center,sourceSteps:[sourceStepX,sourceStepZ],target,
    gridMapping:'native (col,row) -> runtime (6-col,7-row); odd-row offset',
    policy:'Place root at offset with scale; source X reflection is baked in GLBs. Retarget using radius and origin from BoardFrame.'};
}
export function nestedBoardObjects(entries, type) {
  const result = [], stack = [...entries];
  while (stack.length) {
    const v = stack.pop(); if (!v || typeof v !== 'object') continue;
    if (binIs(v, type)) result.push(v);
    stack.push(...Object.values(v));
  }
  return result;
}
export function boardReferences(manifest, effects = {}) {
  const refs = new Set([manifest.boards?.[manifest.boardKey]?.path, ...Object.values(manifest.models).map(v => v.path),
    ...Object.values(manifest.effects).map(v => v.path)].filter(Boolean));
  for (const d of Object.values(effects)) for (const e of d.emitters ?? [])
    for (const p of [e.texture, e.mesh, e.distortion?.normalMap].filter(Boolean)) refs.add(p);
  for (const p of refs) if (typeof p !== 'string' || /[\\:%?#]/.test(p) || p.startsWith('/') || p.split('/').some(s => !s || s === '.' || s === '..'))
    throw new Error('unsafe-board-reference');
  return [...refs].sort();
}

/** A board owns its whole transitive document closure, even when assets are
 * shared with another board. No optional root refers back to the default. */
export function boardDocumentClosure(pick, documents, entries) {
  const byPath = new Map(), docs = new Map(documents.map(d => [canonicalAsset(d.path), d]));
  for (const e of entries) { const k = canonicalAsset(e.path); byPath.set(k, [...(byPath.get(k) ?? []), e]); }
  const seen = new Set(), queue = pick.confirmedGeometry.flatMap(p => [p, p.replace(/\.mapgeo$/, '.materials.bin')]);
  while (queue.length) {
    const p = canonicalAsset(queue.shift()); if (seen.has(p)) continue; seen.add(p);
    const d = docs.get(p); if (!d) continue;
    for (const ref of [...d.linked, ...placedPropReferences(d.entries), ...stringsIn(d.entries).filter(s => /\.(bin|scb|sco|skn|skl|tex|dds|anm|dat)$/i.test(s))])
      for (const e of resolveBoardReference(ref, byPath, entries)) queue.push(e.path);
  }
  return { paths: [...seen], documents: [...seen].map(p => docs.get(p)).filter(Boolean) };
}

export function boardDiffuse(material) {
  const samplers = (binField(material, 'samplerValues') ?? []).map(s => ({
    semantic: binField(s, 'samplerName'), path: binField(s, 'textureName') }));
  const priorities = [/^diffuse_?texture$/i, /^basecolor_?texture$/i, /^albedo_?texture$/i,
    /^top_?texture$/i, /^scrollinga_?texture$/i, /^texture$/i];
  for (const re of priorities) {
    const hit = samplers.find(s => re.test(s.semantic) && s.path); if (hit) return { ...hit, omitted: samplers.filter(s => s !== hit) };
  }
  throw new Error('unsupported-board-material-samplers');
}

export async function buildBoards({keys}={}) {
  const output = await safeOutputPath('assets3d-local/boards', { directory: true });
  const source = resolve('assets3d-local/trial/local');
  const input = p => safeInputPath(source, join(source, p)).then(readFile);
  const plan = JSON.parse(await readFile(join(output, 'boards-plan.json')));
  if (plan.chunks.length || !plan.dependencyClosureComplete) throw new Error('boards-dependencies-not-ready');
  const raw = await input('14.24.manifest'); if (hash(raw) !== plan.sourceManifest.sha256) throw new Error('boards-source-mismatch');
  const inventory = JSON.parse(await readFile(join(output, 'inventory.json')));
  const documents = JSON.parse(await readFile(join(output, 'scene-objects.json')));
  const reader = offlineArchiveReader({ manifest: readRman(raw), plan, readChunk: id => input(`chunks/${id}.zst`), write: async () => {} });
  const byPath = new Map(inventory.entries.map(e => [canonicalAsset(e.path), e]));
  const cache = new Map();
  async function load(p) {
    const key = canonicalAsset(p); if (!cache.has(key)) {
      const row = byPath.get(key); if (!row) throw new Error(`unplanned-board-resource:${p}`);
      cache.set(key, await reader.extract(row));
    } return cache.get(key);
  }
  const { parseParticleDocument } = await contracts();
  const results = [];
  for (const pick of plan.picks) {
    if(keys && !keys.includes(pick.key))continue;
    console.log('boards: build', pick.key);
    const root = join(output, boardRoot(pick.key)), payloads = new Map();
    const write = async (p, data) => { const b = Buffer.from(data); await writeOutputFileAtomic(join(root, p), b, { force: true }); payloads.set(p, { bytes: b.length, sha256: hash(b) }); };
    const closure = boardDocumentClosure(pick, documents, inventory.entries);
    const materialDoc = closure.documents.find(d => d.path.endsWith(`/${pick.stems[0]}.materials.bin`));
    const entries = materialDoc.entries;
    const report = { key: pick.key, name: pick.name, limitations: [], staticModels: 0, animatedModels: 0, clips: 0, systems: [], sourceFiles: [] };
    // Raw unsupported data remains local, outside runtime/download roots.
    for (const p of closure.paths) if (byPath.has(p)) {
      const b = await load(p), path = `sources/${pick.key}/${idFor(p)}.${p.split('.').at(-1)}`;
      await writeOutputFileAtomic(join(output, path), b, { force: true });
      report.sourceFiles.push({ path, source: p, bytes: b.length, sha256: hash(b) });
    }
    const manifest = { schemaVersion: 1, boardKey: pick.key, models: {}, effects: {}, boards: {} };
    const scene = { schemaVersion: 1, key: pick.key, name: pick.name, grid: { columns: 7, rows: 8, cells: 56 },
      models: [], props: [], effects: [], lighting: {}, sourceScene: entries.filter(e => !binIs(e, 'VfxSystemDefinitionData') && !binIs(e, 'StaticMaterialDef')),
      limitations: report.limitations };
    const geometry = readBoardGeometry(await load(pick.confirmedGeometry[0]));
    // Arena map coordinates use a local board frame. Preserve them here;
    // manifest alignment is derived below from the shipped board locator.
    const origin = [0, 0, 0];
    for (const mesh of geometry.meshes) for (const range of mesh.ranges) {
      const id = `${pick.key}-static-${mesh.id}-${mesh.ranges.indexOf(range)}`;
      try {
        const mat = entries.find(e => binIs(e, 'StaticMaterialDef') && binField(e, 'name')?.toLowerCase() === range.material.toLowerCase());
        if (!mat) throw new Error('missing-board-material');
        const diffuse = boardDiffuse(mat), png = encodePng(decodeTexture(await load(diffuse.path)));
        const converted = boardRangeGlb(mesh, range, png, { origin });
        const path = `models/${id}.glb`; await write(path, converted.glb); manifest.models[id] = { path };
        scene.models.push({ id, visibility: mesh.visibility, renderFlags: mesh.renderFlags, bounds: converted.bounds, baked: mesh.baked }); report.staticModels++;
      } catch (e) { report.limitations.push({ stage: 'static-material', id, material: range.material, reason: e.message }); }
    }
    const locators = nestedBoardObjects(entries, 'MapLocator');
    const locator = locators.find(v => binField(v, 'name') === 'BoardLocator');
    const centerLocator = locators.find(v => binField(v, 'name') === 'BoardCenterLocator');
    const matrix = locator && binField(locator, 'transform');
    // Locator-only placement is a legacy estimate, not recovered cell centres.
    // For the base arena, fit both full envelopes to actual ground/wall sections.
    scene.locators = locators;
    if(!matrix || !centerLocator)throw new Error('missing-board-grid-locators');
    scene.alignment = boardAlignment(matrix.slice(12,15),binField(centerLocator,'transform').slice(12,15));
    if (pick.key === 'board-default') {
      const center = binField(centerLocator, 'transform').slice(12,15);
      scene.alignment = alignBoardGroundXZ(scene.alignment, {
        x: boardGroundSpan(geometry, center, 'x'), z: boardGroundSpan(geometry, center),
      }, scene.grid.columns, scene.grid.rows);
    }
    report.alignment = scene.alignment;

    const propObjects = nestedBoardObjects(entries, 'MapAnimatedProp');
    const propModels = new Map();
    for (const prop of propObjects) {
      const name = binField(prop, 'PropName'), skin = binField(prop, 'SkinID') ?? 0, key = `${name.toLowerCase()}:${skin}`;
      if (!propModels.has(key)) {
        const ref = `data/characters/${name.toLowerCase()}/skins/skin${skin}.bin`;
        const rows = resolveBoardReference(ref, new Map([...byPath].map(([p,e])=>[p,[e]])), inventory.entries);
        const skinDocs = closure.documents.filter(d => d.path.includes(`/${name.toLowerCase()}/`) || d.path.startsWith(`data/${name.toLowerCase()}_`));
        const skinEntries = skinDocs.flatMap(d => d.entries).filter(e => (binIs(e, 'SkinCharacterDataProperties') || binIs(e, 'TftSkinCharacterDataProperties')) && binField(e, 'skinMeshProperties'));
        // Consolidated documents contain several skins. Match the actual path hash.
        const { fnv1a } = await import('./bin.mjs');
        const exact = skinEntries.find(e => e.hash === fnv1a(`Characters/${name}/Skins/Skin${skin}`));
        const docs = skinDocs.map(d => ({ ...d, patches: [], entries: d.entries.filter(e => !skinEntries.includes(e) || e === exact) }));
        const id = `${pick.key}-prop-${idFor(key)}`;
        try {
          if (!exact) throw new Error('unresolved-exact-prop-skin');
          const sm = binField(exact, 'skinMeshProperties'), skn = await load(binField(sm, 'simpleSkin'));
          const binding = skinBindings(docs, inspectSkn(skn).submeshes.map(s => s.name));
          const textures = {};
          for (const [n,p] of Object.entries(binding.textures)) textures[n] = encodePng(decodeTexture(await load(p)));
          const animDocs = closure.documents.filter(d => d.path.includes(`/${name.toLowerCase()}/animations/`) || d.path.startsWith(`data/${name.toLowerCase()}_`));
          const clips = [...new Map(animationClips(animDocs.map(d=>({...d, patches:[]}))).filter(c => c.atomic && c.path).map(c=>[canonicalAsset(c.path),c])).values()];
          const animations = [];
          // Verify each clip separately so one unsupported clip cannot discard the rig.
          const skl = await load(binding.skeleton);
          for (const c of clips) {
            const clip = { name: c.name ?? c.path.split('/').at(-1).split('.')[0], bytes: await load(c.path) };
            try { makeModel(skn, skl, [clip], textures, { hiddenSubmeshes: binding.hidden, solidMaterials: binding.solidMaterials }); animations.push(clip); }
            catch(e) { report.limitations.push({ stage:'animation', id, clip:clip.name, reason:e.message }); }
          }
          const converted = makeModel(skn, skl, animations, textures, { hiddenSubmeshes: binding.hidden, solidMaterials: binding.solidMaterials });
          const path = `models/${id}.glb`; await write(path, converted.glb); manifest.models[id] = { path };
          propModels.set(key, { id, correction: converted.report.coordinateTransform.translation, animations: converted.report.animations });
          report.animatedModels++; report.clips += animations.length;
        } catch (e) { propModels.set(key, { unavailable: true }); report.limitations.push({ stage:'prop', id, name, skin, reason:e.message }); }
      }
      scene.props.push({ name:binField(prop,'name'), source:prop, ...propModels.get(key) });
    }
    const systems = particleSourcesFromBins(closure.documents.map(d => ({...d, patches:[]})));
    const textures = new Map(), alpha = new Map(), meshes = new Map(), meshReasons = new Map();
    for (const ref of new Set(stringsIn(systems).filter(p=>/\.(tex|dds|scb|sco)$/i.test(p)))) {
      const k = canonicalAsset(ref), id = idFor(k);
      try {
        const b = await load(ref);
        if (/\.(tex|dds)$/i.test(ref)) { const png = encodePng(decodeTexture(b)), path=`textures/${id}.png`; await write(path,png); textures.set(k,path);alpha.set(k,pngHasEffectiveAlpha(png)); }
        else { const path=`meshes/${id}.glb`; await write(path,convertParticleMesh(b,ref.slice(ref.lastIndexOf('.'))).glb);meshes.set(k,path); }
      } catch(e) {meshReasons.set(ref,e.message);report.limitations.push({stage:'effect-resource',ref,reason:e.message});}
    }
    const converted = convertParticles(systems, p=>textures.get(canonicalAsset(p)),parseParticleDocument,
      {particleMode:'approximate',approximateLinger:true,textureAlpha:p=>alpha.get(canonicalAsset(p)),meshPath:p=>meshes.get(canonicalAsset(p)),meshReasons});
    for(const s of converted.systems){const id=`${pick.key}-fx-${idFor(s.sourcePath)}`;
      if(s.document){const path=`effects/${id}.json`;await write(path,json(s.document));manifest.effects[id]={path};}
      report.systems.push({id,...s});
    }
    scene.effectPlacements=nestedBoardObjects(entries,'MapParticle');
    scene.lighting={sun:nestedBoardObjects(entries,'MapSunProperties'),pointLights:nestedBoardObjects(entries,'MapPointLight'),pointLightTypes:nestedBoardObjects(entries,'MapPointLightType'),volumes:nestedBoardObjects(entries,'MapLightingVolume'),
      policy:'Exact source fields retained; realtime shader, light grid and baked lightmap evaluation require renderer integration.'};
    scene.lighting.baked=[];
    for(const p of new Set(geometry.meshes.flatMap(m=>m.baked.map(b=>b.path)).filter(p=>p && /\.(tex|dds)$/i.test(p)))){
      try{const path=`lighting/${idFor(p)}.png`;await write(path,encodePng(decodeTexture(await load(p))));scene.lighting.baked.push({source:p,path});}
      catch(e){report.limitations.push({stage:'baked-lightmap',source:p,reason:e.message});}
    }
    scene.shaderPolicy='Diffuse preview only; original material records, source shader paths and behavior cues retained in local source archive.';
    manifest.boards[pick.key]={path:'scene.json',grid:scene.grid,alignment:scene.alignment};
    await write('scene.json',json(scene));
    const effects=Object.fromEntries(report.systems.filter(s=>s.document).map(s=>[s.id,s.document]));
    const refs=[...new Set([...boardReferences(manifest,effects),...payloads.keys()])];
    await write('manifest.json',json(manifest));
    await write('precache.json',json(createPrecache(new Map(refs.map(p=>{if(!payloads.has(p))throw new Error(`board-precache-missing:${p}`);return[p,payloads.get(p)];})))));
    Object.assign(report,{effectCounts:converted.counts,lightCounts:{sun:scene.lighting.sun.length,points:scene.lighting.pointLights.length,volumes:scene.lighting.volumes.length},geometry:{meshes:geometry.meshes.length,ranges:geometry.meshes.reduce((n,m)=>n+m.ranges.length,0)},root:boardRoot(pick.key),bytes:[...payloads.values()].reduce((n,p)=>n+p.bytes,0)});
    await writeOutputFileAtomic(join(output,`reports/${pick.key}.json`),json(report),{force:true});results.push(report);
    console.log(JSON.stringify({key:pick.key,models:report.staticModels,props:report.animatedModels,clips:report.clips,effects:converted.counts,limitations:report.limitations}));
  }
  return results;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildBoards({keys:process.argv.slice(2).length?process.argv.slice(2):undefined});
