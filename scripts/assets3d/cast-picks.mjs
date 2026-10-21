// Offline ordinary model root. All generated payloads stay in the real cast-picks directory.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { readGlb, writeGlb } from './glb.mjs';

const unitMap = JSON.parse(await readFile(new URL('./unit-map.json', import.meta.url)));
export const CAST_PICKS = Object.fromEntries(['amumu', 'ambessa', 'drmundo', 'gangplank', 'jayce'].map(id => {
  const config = unitMap[id];
  return [id, { clip: config.animations.cast, castSequence: config.castSequence, castVariants: config.castVariants,
    confidence: 'medium', basis: config.animationNotes }];
}));
const json = v => JSON.stringify(v, null, 2) + '\n';

/** Build an ordinary model entry; root composition uses merge-fx-roots unchanged. */
export function castModelEntry(base, pick, clipNames) {
  if (base.animations?.cast) throw new Error('cast-already-present');
  if (typeof pick.basis !== 'string' || !pick.basis.trim() ||
      !['low', 'medium'].includes(pick.confidence)) throw new Error('invalid-cast-evidence');
  if (pick.clip === null) return { ...structuredClone(base), animations: { ...base.animations, cast: null } };
  if (typeof pick.clip !== 'string' || !clipNames.includes(pick.clip)) throw new Error('missing-cast-clip');
  if (Object.values(base.animations ?? {}).includes(pick.clip)) throw new Error('duplicate-basic-action');
  return { ...structuredClone(base), animations: { ...base.animations, cast: pick.clip },
    approximated: true, basis: pick.basis, confidence: pick.confidence,
    ...(pick.castSequence ? { castSequence: pick.castSequence } : {}), ...(pick.castVariants ? { castVariants: pick.castVariants } : {}) };
}

/** Transfer only animation views/accessors; preserve original mesh, textures, rig and clips. */
export function appendCastClip(original, donor, name) {
  const a = readGlb(original), b = readGlb(donor), d = a.document;
  if (!isDeepStrictEqual(d.nodes, b.document.nodes)) throw new Error('cast-rig-mismatch');
  if (d.animations.some(c => c.name === name)) throw new Error('cast-clip-already-present');
  const clip = structuredClone(b.document.animations.find(c => c.name === name));
  if (!clip) throw new Error('missing-donor-clip');
  const parts = [a.binary, Buffer.alloc((4 - a.binary.length % 4) % 4)];
  let length = parts.reduce((n, p) => n + p.length, 0);
  const copied = new Map();
  function copy(index) {
    if (copied.has(index)) return copied.get(index);
    const accessor = structuredClone(b.document.accessors[index]), view = b.document.bufferViews[accessor.bufferView];
    if (accessor.sparse || view.buffer !== 0) throw new Error('unsupported-cast-accessor');
    const bytes = b.binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    accessor.bufferView = d.bufferViews.length;
    d.bufferViews.push({ ...view, byteOffset: length });
    const padding = Buffer.alloc((4 - bytes.length % 4) % 4); parts.push(bytes, padding); length += bytes.length + padding.length;
    const result = d.accessors.length; d.accessors.push(accessor); copied.set(index, result); return result;
  }
  for (const sampler of clip.samplers) { sampler.input = copy(sampler.input); sampler.output = copy(sampler.output); }
  d.animations.push(clip); d.buffers[0].byteLength = length;
  return writeGlb(d, Buffer.concat(parts));
}

export async function buildCastPicks() {
  const { buildCastAnimations } = await import('./cast-animations.mjs');
  return buildCastAnimations({ from: 'assets3d-local/all-anim', out: 'assets3d-local/cast-picks', units: Object.keys(CAST_PICKS) });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(json(await buildCastPicks())); } catch (e) { console.error(e); process.exitCode = 1; }
}
