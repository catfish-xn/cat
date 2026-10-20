// Offline ordinary model root. All generated payloads stay in the real cast-picks directory.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { readGlb, writeGlb } from './glb.mjs';
import { makeModel, validateModel } from './model.mjs';
import { decodeAnm } from './animation.mjs';
import { inspectSkn } from './inspect-source.mjs';
import { compareAnimationRebuild } from './verify-animation-rebuild.mjs';
import { safeInputPath, writeOutputFileAtomic } from './safe-path.mjs';

export const CAST_PICKS = {
  amumu: { clip: 'tft13_amumu_skin23_attack2', confidence: 'low', basis: '短攻击片段仅作为被动周期伤害的表现占位，缺少主动施法语义，因此仍为低可信近似。' },
  ambessa: { clip: 'tft13_ambessa_spellfist_dash', confidence: 'medium', basis: '短冲刺同时具有技能和位移语义，适合单次出手，但仅代表冲刺片段。' },
  drmundo: { clip: 'tft13_drmundo_spell4_idle', confidence: 'medium', basis: '强化状态的原地短循环可近似持续自我强化，但并非独立变身起手。' },
  gangplank: { clip: 'tft13_gangplank_spell_melee', confidence: 'medium', basis: '短斩击匹配近战技能的快速出手，仅代表近战分支。' },
  jayce: { clip: 'tft13_jayce_spell2_knockhexcrystals', confidence: 'medium', basis: '中等时长的水晶技能片段贴合当前远程默认姿态，仅代表远程出手。' },
};
const hash = b => createHash('sha256').update(b).digest('hex');
const json = v => JSON.stringify(v, null, 2) + '\n';

/** Build an ordinary model entry; root composition uses merge-fx-roots unchanged. */
export function castModelEntry(base, pick, clipNames) {
  if (base.animations?.cast) throw new Error('cast-already-present');
  if (typeof pick.basis !== 'string' || !pick.basis.trim() ||
      !['low', 'medium'].includes(pick.confidence)) throw new Error('invalid-cast-evidence');
  if (typeof pick.clip !== 'string' || !clipNames.includes(pick.clip)) throw new Error('missing-cast-clip');
  if (Object.values(base.animations ?? {}).includes(pick.clip)) throw new Error('duplicate-basic-action');
  return { ...structuredClone(base), animations: { ...base.animations, cast: pick.clip },
    approximated: true, basis: pick.basis, confidence: pick.confidence };
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
  const out = resolve('assets3d-local/cast-picks'), root = resolve('assets3d-local/all-anim');
  const source = resolve('assets3d-local/trial/local'), raw = join(source, 'extracted');
  const read = async (r, p) => readFile(await safeInputPath(r, join(r, p)));
  const manifest = JSON.parse(await read(root, 'manifest.json'));
  const missing = Object.keys(manifest.models).filter(id => !manifest.models[id].animations?.cast).sort();
  if (missing.join() !== Object.keys(CAST_PICKS).sort().join()) throw new Error('missing-cast-set-changed');
  const map = JSON.parse(await readFile(new URL('./unit-map.json', import.meta.url)));
  const extraction = JSON.parse(await read(source, 'extraction.json'));
  const records = new Map(extraction.files.map(r => [r.path, r]));
  async function verified(path) {
    const bytes = await read(raw, path), record = records.get(path);
    if (!record || record.sha256 !== hash(bytes) || record.bytes !== bytes.length) throw new Error('cast-source-hash-mismatch');
    return bytes;
  }
  const output = { schemaVersion: 1, models: {} }, units = {}, candidates = {};
  for (const id of missing) {
    const config = map[id], pick = CAST_PICKS[id], before = await read(root, manifest.models[id].path);
    const original = readGlb(before), skn = await verified(`${config.base}/${config.mesh}`), inventory = [];
    for (const [name, path] of Object.entries(config.animationFiles)) {
      const animation = decodeAnm(await verified(`${config.base}/${path}`));
      inventory.push({ name, durationSeconds: animation.duration, embedded: original.document.animations.some(c => c.name === name) });
    }
    const textures = {}, solidMaterials = {}, hiddenSubmeshes = [];
    for (const sub of inspectSkn(skn).submeshes) {
      const material = original.document.materials.find(m => m.name === sub.name);
      if (!material) { hiddenSubmeshes.push(sub.name); continue; }
      const index = material.pbrMetallicRoughness?.baseColorTexture?.index;
      if (index === undefined) { solidMaterials[sub.name] = { factor: material.pbrMetallicRoughness.baseColorFactor }; continue; }
      const image = original.document.images[original.document.textures[index].source];
      const v = original.document.bufferViews[image.bufferView];
      textures[sub.name] = original.binary.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    }
    const donor = makeModel(skn, await verified(`${config.base}/${config.skeleton}`),
      [{ name: pick.clip, bytes: await verified(`${config.base}/${config.animationFiles[pick.clip]}`) }], textures, { solidMaterials, hiddenSubmeshes });
    const after = appendCastClip(before, donor.glb, pick.clip);
    validateModel(after);
    const preservation = compareAnimationRebuild(before, after, false);
    if (!preservation.nonAnimationEqual || !preservation.priorAnimationsEqual) throw new Error('cast-preservation-failed');
    output.models[id] = castModelEntry(manifest.models[id], pick, readGlb(after).document.animations.map(c => c.name));
    candidates[id] = inventory;
    units[id] = { cast: donor.report.animations[0], preservation, path: manifest.models[id].path };
    await writeOutputFileAtomic(join(out, manifest.models[id].path), after, { force: true });
  }
  const { assertManifest } = await (await import('./runtime.mjs')).contracts();
  assertManifest(output);
  await writeOutputFileAtomic(join(out, 'manifest.json'), json(output), { force: true });
  await writeOutputFileAtomic(join(out, 'candidates.json'), json({ schemaVersion: 1, units: candidates }), { force: true });
  await writeOutputFileAtomic(join(out, 'inventory.json'), json({ ready: true, units }), { force: true });
  return { ready: true, units: missing, out };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(json(await buildCastPicks())); } catch (e) { console.error(e); process.exitCode = 1; }
}
