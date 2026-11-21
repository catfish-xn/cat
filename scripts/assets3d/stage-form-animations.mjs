import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendCastClip } from './cast-picks.mjs';
import { compressModelGlb } from './compress.mjs';
import { readGlb, writeGlb } from './glb.mjs';
import { inspectSkn } from './inspect-source.mjs';
import { loadUnitMap } from './local-config.mjs';
import { makeModel, validateModel } from './model.mjs';
import { argumentsFor } from './plan-fetch.mjs';
import { contracts } from './runtime.mjs';
import { withinRoot } from './safe-path.mjs';

const DEFAULT_EXTRACTED_ROOT = '/home/aiapps/workspace/set13-worktrees/boards/assets3d-local/trial/local/extracted';

export function readGlbDocument(bytes) {
  try {
    return readGlb(bytes).document;
  } catch (error) {
    if (!Buffer.isBuffer(bytes) || bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67
      || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(16) !== 0x4e4f534a) throw error;
    const jsonLength = bytes.readUInt32LE(12);
    if (20 + jsonLength > bytes.length) throw error;
    return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  }
}

export function collectFormAnimationClips(formAnimations) {
  const names = new Set();
  for (const form of ['front', 'back']) {
    const actions = formAnimations?.[form];
    if (!actions || typeof actions !== 'object') continue;
    for (const action of ['idle', 'move', 'attack']) {
      const clip = actions[action];
      if (typeof clip === 'string' && clip.trim()) names.add(clip);
    }
  }
  return [...names];
}

async function buildExtractedDonorGlb(modelId, baseGlbBytes, clipNames, extractedRoot) {
  const root = resolve(extractedRoot);
  let unitConfig = null;
  try {
    const unitMap = await loadUnitMap();
    unitConfig = unitMap?.[modelId] ?? null;
  } catch {}
  const sourceName = unitConfig?.sourceName ?? `tft13_${modelId.toLowerCase()}`;
  const charBase = unitConfig?.base ?? `assets/characters/${sourceName}/skins/base`;
  const meshRel = unitConfig?.mesh ?? `${sourceName}.tft_set13.skn`;
  const sklRel = unitConfig?.skeleton ?? `${sourceName}.tft_set13.skl`;

  const sknPath = join(root, charBase, meshRel);
  const sklPath = join(root, charBase, sklRel);
  const skn = await readFile(sknPath);
  const skl = await readFile(sklPath);

  const original = readGlb(baseGlbBytes);
  const textures = {}, solidMaterials = {}, hiddenSubmeshes = [];
  for (const sub of inspectSkn(skn).submeshes) {
    const material = original.document.materials?.find(m => m.name === sub.name);
    if (!material) {
      hiddenSubmeshes.push(sub.name);
      continue;
    }
    const index = material.pbrMetallicRoughness?.baseColorTexture?.index;
    if (index === undefined) {
      solidMaterials[sub.name] = { factor: material.pbrMetallicRoughness.baseColorFactor };
      continue;
    }
    const image = original.document.images[original.document.textures[index].source];
    const view = original.document.bufferViews[image.bufferView];
    textures[sub.name] = original.binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  }

  const animationSources = [];
  for (const name of clipNames) {
    const mappedRel = unitConfig?.animationFiles?.[name] ?? `animations/${name}.tft_set13.anm`;
    const candidatePaths = [
      join(root, charBase, mappedRel),
      join(root, charBase, `animations/${name}.anm`),
    ];
    const found = candidatePaths.find(p => existsSync(p));
    if (!found) throw new Error(`missing-donor-clip:${name}`);
    animationSources.push({ name, bytes: await readFile(found) });
  }
  return makeModel(skn, skl, animationSources, textures, { solidMaterials, hiddenSubmeshes }).glb;
}

export async function stageFormAnimations({
  assets,
  model,
  donor,
  formAnimations,
  'form-animations': cliFormAnimations,
  outDir,
  'out-dir': cliOutDir,
  extracted = DEFAULT_EXTRACTED_ROOT,
  compress,
} = {}) {
  const rawFormAnimations = formAnimations ?? cliFormAnimations;
  const targetOutDir = outDir ?? cliOutDir;
  if (!assets || !model || !donor || !rawFormAnimations || !targetOutDir) {
    throw new Error(
      'usage: node scripts/assets3d/stage-form-animations.mjs --assets <assets-root> --model <id> --donor <uncompressed-glb> --form-animations \'<json>\' --out-dir <out-dir>',
    );
  }
  const assetsRoot = resolve(assets);
  const outRoot = resolve(targetOutDir);
  if (outRoot === assetsRoot || outRoot.startsWith(`${assetsRoot}${sep}`)) {
    throw new Error('stage-form-animations-out-overlaps-input');
  }

  const parsedFormAnimations = typeof rawFormAnimations === 'string'
    ? JSON.parse(rawFormAnimations)
    : structuredClone(rawFormAnimations);

  const manifestPath = join(assetsRoot, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const outputManifest = structuredClone(manifest);
  const entry = outputManifest.models?.[model];
  if (!entry) throw new Error(`unknown-model:${model}`);
  entry.formAnimations = parsedFormAnimations;

  const { assertManifest } = await contracts();
  assertManifest(outputManifest);

  const deployedGlbPath = withinRoot(assetsRoot, resolve(assetsRoot, entry.path), 'unsafe-model-path');
  const deployedBytes = await readFile(deployedGlbPath);
  const deployedDoc = readGlbDocument(deployedBytes);
  const deployedClips = (deployedDoc.animations ?? []).map(a => a.name).filter(Boolean);

  let deployedUncompressed = false;
  try {
    readGlb(deployedBytes);
    deployedUncompressed = true;
  } catch {}

  const donorBytes = await readFile(resolve(donor));
  const donorParsed = readGlb(donorBytes);
  const jointNames = doc => (doc.skins?.[0]?.joints ?? []).map(i => doc.nodes?.[i]?.name ?? '');
  if (deployedDoc.skins?.length && JSON.stringify(jointNames(deployedDoc)) !== JSON.stringify(jointNames(donorParsed.document))) {
    throw new Error('cast-rig-mismatch');
  }
  const donorClipNames = new Set((donorParsed.document.animations ?? []).map(a => a.name).filter(Boolean));

  const requiredClips = collectFormAnimationClips(parsedFormAnimations);
  let workingBytes = deployedUncompressed ? deployedBytes : donorBytes;
  let workingDoc = readGlb(workingBytes).document;
  const workingClips = new Set((workingDoc.animations ?? []).map(a => a.name).filter(Boolean));

  const fromDonor = requiredClips.filter(name => !workingClips.has(name) && donorClipNames.has(name));
  for (const name of fromDonor) {
    workingBytes = appendCastClip(workingBytes, donorBytes, name);
    workingClips.add(name);
  }

  const missingFromDonor = requiredClips.filter(name => !workingClips.has(name));
  if (missingFromDonor.length > 0) {
    if (!extracted || !existsSync(resolve(extracted))) {
      throw new Error(`missing-donor-clip:${missingFromDonor[0]}`);
    }
    const extractedDonorGlb = await buildExtractedDonorGlb(model, workingBytes, missingFromDonor, extracted);
    for (const name of missingFromDonor) {
      workingBytes = appendCastClip(workingBytes, extractedDonorGlb, name);
      workingClips.add(name);
    }
  }

  if (workingDoc.meshes?.length && workingDoc.skins?.length) {
    validateModel(workingBytes);
  }

  const shouldCompress = compress ?? !deployedUncompressed;
  const finalGlbBytes = shouldCompress ? await compressModelGlb(workingBytes) : workingBytes;
  const finalDoc = readGlbDocument(finalGlbBytes);
  const afterClips = (finalDoc.animations ?? []).map(a => a.name).filter(Boolean);

  const outGlbPath = join(outRoot, 'models', model, 'model.glb');
  const outManifestPath = join(outRoot, 'manifest.json');
  await mkdir(dirname(outGlbPath), { recursive: true });
  await writeFile(outGlbPath, finalGlbBytes);
  await writeFile(outManifestPath, `${JSON.stringify(outputManifest, null, 2)}\n`, 'utf8');

  return {
    model,
    outGlbPath,
    outManifestPath,
    beforeClips: deployedClips,
    afterClips,
    addedClips: afterClips.filter(name => !deployedClips.includes(name)),
    compressed: shouldCompress,
    bytes: finalGlbBytes.length,
    manifest: outputManifest,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = argumentsFor(process.argv.slice(2), [
    '--assets',
    '--model',
    '--donor',
    '--form-animations',
    '--out-dir',
    '--extracted',
  ]);
  const result = await stageFormAnimations(args);
  console.log(JSON.stringify({
    model: result.model,
    outGlbPath: result.outGlbPath,
    outManifestPath: result.outManifestPath,
    beforeClips: result.beforeClips,
    afterClips: result.afterClips,
    addedClips: result.addedClips,
    compressed: result.compressed,
    bytes: result.bytes,
  }, null, 2));
}
