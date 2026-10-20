import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeOutputPath, writeOutputFile } from './safe-path.mjs';

/** Lossless source inventory, NOT a renderable D8 particle document. */
export function inventoryParticles(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('invalid-particle-source');
  const systems = [];
  for (const [id, value] of Object.entries(source)) {
    if (value?.__type !== 'VfxSystemDefinitionData') continue;
    const emitters = [];
    for (const field of ['complexEmitterDefinitionData', 'simpleEmitterDefinitionData']) {
      const values = value[field] ?? [];
      if (!Array.isArray(values)) throw new Error(`invalid-emitter-list:${id}:${field}`);
      for (const [index, emitter] of values.entries()) {
        if (!emitter || typeof emitter !== 'object' || Array.isArray(emitter)) throw new Error('invalid-source-emitter');
        const gaps = new Set(), primitive = emitter.primitive?.__type ?? 'VfxPrimitiveCameraQuad';
        if (/Mesh/.test(primitive)) gaps.add('mesh');
        else if (/Trail/.test(primitive)) gaps.add('trail');
        else if (!['VfxPrimitiveCameraQuad', 'VfxPrimitiveQuad'].includes(primitive)) gaps.add(`primitive:${primitive}`);
        if (!emitter.isSingleParticle) gaps.add('continuous-emission');
        if (emitter.EmitterPosition !== undefined) gaps.add('emitter-position');
        if (emitter.birthScale0 !== undefined || emitter.scale0 !== undefined) gaps.add('vector-size');
        if (emitter.birthRotation0 !== undefined || emitter.rotation0 !== undefined) gaps.add('orientation');
        const lifetime = emitter.particleLifetime?.constantValue;
        if (typeof lifetime !== 'number' || !Number.isFinite(lifetime) || lifetime <= 0) gaps.add('special-or-dynamic-lifetime');
        if (emitter.childParticleSetDefinition) gaps.add('child-system');
        if (emitter.alphaErosionDefinition) gaps.add('source-erosion-texture');
        // Discover probability tables recursively without sampling or inventing means.
        const stack = [emitter];
        while (stack.length) {
          const entry = stack.pop();
          if (!entry || typeof entry !== 'object') continue;
          if (Object.hasOwn(entry, 'probabilityTables')) gaps.add('birth-probability');
          for (const item of Object.values(entry)) if (item && typeof item === 'object') stack.push(item);
        }
        emitters.push({ id: `${id}:${field}:${index}`, name: emitter.emitterName ?? '', primitive,
          gaps: [...gaps].sort(), source: structuredClone(emitter) });
      }
    }
    systems.push({ id, emitters });
  }
  return { format: 'd7-lossless-particle-inventory-v1', renderable: false,
    note: 'Diagnostic gaps are not an exhaustive equivalence proof; raw source is retained and no emitter is silently approximated.',
    systemCount: systems.length, emitterCount: systems.reduce((n, s) => n + s.emitters.length, 0), systems };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), force = args.includes('--force');
  const paths = args.filter(arg => arg !== '--force');
  if (paths.length !== 2) throw new Error('usage: <source.cdtb.bin.json> <assets3d-local/output.json> [--force]');
  const output = await safeOutputPath(paths[1], { force });
  const report = inventoryParticles(JSON.parse(await readFile(paths[0], 'utf8')));
  await writeOutputFile(output, `${JSON.stringify(report, null, 2)}\n`, { force });
  console.log(JSON.stringify({ systems: report.systemCount, emitters: report.emitterCount, renderable: false }));
}
