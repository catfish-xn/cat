/** Real loader/driver audit and generic event mapping; outputs only to the supplied scratch export. */
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
sharp.concurrency(4);
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
if (!args.out || !resolve(args.out).startsWith('/tmp/')) throw Error('--out=/tmp/<export> required');
const out = resolve(args.out), bundle = join(out, '_audit.mjs');
await build({ stdin: { contents: `export { createVfxLibrary } from './src/rendering/three-mode/vfx-ltk/loader';
 export { readVfxSystem } from './src/rendering/three-mode/vfx-ltk/engine/parsing/readVfxSystem';
 export { drawnEmitters } from './src/rendering/three-mode/vfx-ltk/rendering/utils/definitions';
 export * as drawKind from './src/rendering/three-mode/vfx-ltk/rendering/utils/drawKind';
 export { QUAD_TYPE } from './src/rendering/three-mode/vfx-ltk/engine/model/enums';
 export { createLtkParticles } from './src/rendering/three-mode/vfx-ltk/particles';
 export { mapConvertedEvents, mapLegacyTimeline } from './src/rendering/three-mode/vfx-ltk/converted-events';
 export { DataTexture, PerspectiveCamera } from 'three';`, resolveDir: process.cwd(), loader: 'ts' },
 outfile: bundle, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { createVfxLibrary, createLtkParticles, readVfxSystem, drawnEmitters, drawKind, QUAD_TYPE, mapConvertedEvents, mapLegacyTimeline, DataTexture, PerspectiveCamera } = await import(pathToFileURL(bundle));
const bindings = args.bindings ? JSON.parse(await readFile(resolve(args.bindings))) : null;
const rows = JSON.parse(await readFile(join(out, 'export-summary.json'))), coverage = [];
const catalogue = { version: 1, systems: {}, assets: {}, skills: {}, champions: {} };
const camera = new PerspectiveCamera(); camera.position.set(0, 200, 300); camera.updateMatrixWorld();
const anchor = { originAt: () => [0, 0, 0], basisInto: (_time, result) => { result.set([1, 0, 0, 0, 1, 0, 0, 0, 1]); return result; } };
for (const row of rows) {
  if (row.code !== 0) { coverage.push({ champion: row.id, exported: 0, error: 'export-failed' }); continue; }
  const folder = join(out, row.source), indexPath = join(folder, 'index.json');
  const index = JSON.parse(await readFile(indexPath));
  const mapping = mapConvertedEvents(row.id, JSON.parse(await readFile(join(folder, 'metadata.json'))), index.systems);
  if (bindings) {
    const inventory = JSON.parse(await readFile(join(folder, 'inventory.json')));
    const legacy = mapLegacyTimeline(row.id, inventory.systems, bindings);
    mapping.diagnostics.push(...legacy.diagnostics);
    if (!['jinx', 'vi'].includes(row.id)) {
      // Existing P timing is needed when a main SpellObject is script driven.
      const casts = mapping.cues.filter(c => c.action === 'cast');
      const direct = mapping.events.some(e => e.action === 'cast' && e.event !== 'hit' && e.system);
      if (!direct || !casts.length) {
        mapping.cues = [...mapping.cues.filter(c => c.action === 'attack'), ...legacy.cues.filter(c => c.action === 'cast')];
        if (legacy.cues.some(c => c.action === 'cast')) mapping.diagnostics.push('cast:existing-display-bindings');
      }
    }
  }
  if (mapping.cues.length > 12) {
    let cast = mapping.cues.filter(c => (c.action ?? 'cast') === 'cast'), attack = mapping.cues.filter(c => c.action === 'attack');
    if (cast.length > 12) { mapping.diagnostics.push('cast:cue-budget'); cast = []; }
    if (attack.length > 12 || cast.length + attack.length > 12) { mapping.diagnostics.push('attack:cue-budget'); attack = []; }
    mapping.cues = [...cast,...attack];
  }
  index.skills = mapping.cues.length ? { [row.id]: mapping.cues } : {};
  await writeFile(indexPath, JSON.stringify(index, null, 2));
  await writeFile(join(folder, 'event-mapping.json'), JSON.stringify(mapping, null, 2));
  const prefix = 'http://local/vfx-ltk/';
  const local = url => { if (!url.startsWith(prefix)) throw Error('outside-root'); return join(folder, url.slice(prefix.length)); };
  const library = createVfxLibrary('http://local/', {
    readJson: async url => JSON.parse(await readFile(local(url))),
    readBinary: async url => { const b = await readFile(local(url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
    readTexture: async url => { const { data, info } = await sharp(local(url)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return new DataTexture(new Uint8Array(data), info.width, info.height); },
  }, { groundPass: true });
  const results = [];
  for (const id of Object.keys(index.systems)) {
    try {
      const prepared = await library.load(id);
      const fx = createLtkParticles(prepared, { anchor, target: null, joints: () => anchor, duration: 2, seed: 1 });
      try { for (let frame = 0; frame < 60; frame++) fx.update(1 / 30, camera); } finally { fx.dispose(); }
      results.push({ id, status: prepared.empty ? 'empty-noop' : 'loaded', emitters: prepared.drawn.length });
    } catch (error) {
      const features = [];
      try {
        const doc = JSON.parse(await readFile(join(folder,index.systems[id]))), model = readVfxSystem(doc);
        for (const {emitter:e} of drawnEmitters(model,true)) {
          if (e.disabled) continue;
          if (e.emissionMesh) features.push('surface/mesh-emission');
          if (e.emissionSurface) features.push('surface-emission');
          if (e.hudLayer) features.push('HUD-layer');
          if (e.childSet?.children.some(c=>c===null)) features.push('unresolved-child-system');
          if (!e.mesh && [QUAD_TYPE.mesh,QUAD_TYPE.beam].includes(e.quadType)
            && !drawKind.drawsAsBeam(e)) features.push('unresolved-mesh-definition');
        }
        if (doc.materials?.length) features.push('custom-material');
        if (String(error).includes('system-budget')) features.push('system-budget');
      } catch { features.push('unreadable-system'); }
      results.push({ id, status: 'rejected', error: String(error), features:[...new Set(features)] });
    }
  }
  const accepted = new Set(results.filter(r => r.status !== 'rejected').map(r => r.id));
  const actions = Object.fromEntries(['cast', 'attack'].map(action => {
    const cues = mapping.cues.filter(c => (c.action ?? 'cast') === action);
    return [action, { cues: cues.length, ready: cues.length > 0 && cues.every(c => accepted.has(c.system)),
      rejected: cues.filter(c => !accepted.has(c.system)).map(c => c.system) }];
  }));
  const result = { champion: row.id, source: row.source, exported: results.length, loaded: results.filter(r => r.status === 'loaded').length,
    empty: results.filter(r => r.status === 'empty-noop').length, rejected: results.filter(r => r.status === 'rejected').length,
    features: [...new Set(results.flatMap(r=>r.features??[]))], unsupported: [...new Set(results.filter(r => r.status === 'rejected').map(r => r.error))], exportDiagnostics: row.failures,
    mappingDiagnostics: mapping.diagnostics, actions, results, gpuVerified: false };
  await writeFile(join(folder, 'validation-current.json'), JSON.stringify(result, null, 2));
  coverage.push(result); catalogue.champions[row.id] = `${row.source}/index.json`;
  await writeFile(join(out, 'coverage.json'), JSON.stringify(coverage, null, 2)); library.dispose();
  console.log(`${row.id}: ${result.loaded}+${result.empty}/${result.exported}; cast=${actions.cast.ready}, attack=${actions.attack.ready}`);
}
await writeFile(join(out, 'index.json'), JSON.stringify(catalogue, null, 2));
const totals = { champions: coverage.length, exported: coverage.reduce((n, r) => n + r.exported, 0), accepted: coverage.reduce((n, r) => n + (r.loaded ?? 0) + (r.empty ?? 0), 0),
  cast: coverage.filter(r => r.actions?.cast.ready).length, attack: coverage.filter(r => r.actions?.attack.ready).length };
await writeFile(join(out, 'totals.json'), JSON.stringify(totals, null, 2)); console.log(JSON.stringify(totals));
