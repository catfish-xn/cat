// Requires tools/extract-wad.py and pinned lol2gltf 2025-02-28-d36a532.
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, '.local/extracted');
const OUT = join(ROOT, 'public/assets');
const TOOL = process.env.LOL2GLTF ?? join(ROOT, '.local/tools/lol2gltf.exe');
const extraction = JSON.parse(await readFile(join(ROOT, '.local/extraction.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(OUT, 'manifest.json'), 'utf8'));
const canonical = s => s.toLowerCase().replaceAll('.tft_set13', '');
const files = new Map(extraction.files.map(f => [canonical(f.path), f.path]));
const source = path => {
  const found = files.get(canonical(path));
  if (!found) throw new Error(`Missing extracted asset: ${path}`);
  return join(RAW, found);
};
const selections = {
  jinx: { idle: 'tft13_jinx_idle1', move: 'tft13_jinx_minigun_run', attack: 'tft13_jinx_minigun_attack1', cast: 'tft13_jinx_spell_deathrocket', death: 'jinx_minigun_death' },
  vi: { idle: 'vi_idle1', move: 'vi_run1', attack: 'vi_attack1', cast: 'vi_spell4_hit', death: 'vi_death' },
};
for (const [id, clips] of Object.entries(selections)) {
  const base = `assets/characters/tft13_${id}/skins/base`;
  const animations = join(ROOT, '.local/clips', id);
  await mkdir(animations, { recursive: true });
  for (const [state, file] of Object.entries(clips)) await copyFile(source(`${base}/animations/${file}.anm`), join(animations, `${state}.anm`));
  execFileSync(TOOL, ['skn2gltf', '-m', source(`${base}/tft13_${id}.skn`), '-s', source(`${base}/tft13_${id}.skl`), '-a', animations, '-g', join(OUT, id, 'rigged.glb')], { stdio: 'inherit' });
  Object.assign(manifest.units[id], { rigged: `${id}/rigged.glb`, clips: Object.fromEntries(Object.keys(clips).map(s => [s, s])), animationSources: clips, rigVersion: extraction.version });
}

// SCB reader follows LeagueToolkit Core/Mesh/StaticMesh.cs and StaticMeshFace.cs.
// https://github.com/LeagueToolkit/LeagueToolkit/tree/main/src/LeagueToolkit/Core/Mesh
// Preserve face UVs, BGRA vertex colors and face colors; reflect X and winding.
function scbToGlb(buf) {
  let o = 0;
  const u32 = () => { const n = buf.readUInt32LE(o); o += 4; return n; };
  const f32 = () => { const n = buf.readFloatLE(o); o += 4; return n; };
  if (buf.toString('ascii', 0, 8) !== 'r3d2Mesh') throw new Error('Invalid SCB magic');
  const major = buf.readUInt16LE(8), minor = buf.readUInt16LE(10);
  if (![[2, 1], [3, 1], [3, 2]].some(([a, b]) => a === major && b === minor)) throw new Error(`Unsupported SCB ${major}.${minor}`);
  o = 140;
  const vc = u32(), fc = u32(), flags = u32(); o += 24;
  const colored = major >= 3 && minor >= 2 ? u32() === 1 : false;
  const vertices = Array.from({ length: vc }, () => [-f32(), f32(), f32()]);
  const colors = colored ? Array.from({ length: vc }, () => { const c = [...buf.subarray(o, o + 4)]; o += 4; return [c[2] / 255, c[1] / 255, c[0] / 255, c[3] / 255]; }) : null;
  o += 12; // central point; source vertices already use the emitter's local origin
  const faces = [];
  for (let i = 0; i < fc; i++) {
    const ids = [u32(), u32(), u32()]; o += 64;
    const u = [f32(), f32(), f32()], v = [f32(), f32(), f32()];
    faces.push({ ids, u, v });
  }
  const pos = [], uv = [], rgba = [];
  for (const face of faces) {
    const faceColors = flags & 1 ? Array.from({ length: 3 }, () => { const c = [...buf.subarray(o, o + 3)]; o += 3; return [...c.map(x => x / 255), 1]; }) : null;
    for (const k of [0, 2, 1]) {
      if (!vertices[face.ids[k]]) throw new Error('SCB face index out of range');
      pos.push(...vertices[face.ids[k]]); uv.push(face.u[k], 1 - face.v[k]);
      rgba.push(...(faceColors?.[k] ?? colors?.[face.ids[k]] ?? [1, 1, 1, 1]));
    }
  }
  if (![...pos, ...uv, ...rgba].every(Number.isFinite)) throw new Error('Nonfinite SCB data');
  const arrays = [new Float32Array(pos), new Float32Array(uv), new Float32Array(rgba)];
  const chunks = arrays.map(a => Buffer.from(a.buffer));
  let offset = 0;
  const views = chunks.map(c => { const v = { buffer: 0, byteOffset: offset, byteLength: c.length, target: 34962 }; offset += c.length; return v; });
  const bounds = fn => [0, 1, 2].map(k => pos.filter((_, i) => i % 3 === k).reduce((a, b) => fn(a, b), fn === Math.min ? Infinity : -Infinity));
  const doc = { asset: { version: '2.0', generator: '3d-trial SCB (LeagueToolkit format)' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1, COLOR_0: 2 } }] }],
    buffers: [{ byteLength: offset }], bufferViews: views,
    accessors: [{ bufferView: 0, componentType: 5126, count: fc * 3, type: 'VEC3', min: bounds(Math.min), max: bounds(Math.max) }, { bufferView: 1, componentType: 5126, count: fc * 3, type: 'VEC2' }, { bufferView: 2, componentType: 5126, count: fc * 3, type: 'VEC4' }] };
  const json = Buffer.from(JSON.stringify(doc));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const bin = Buffer.concat(chunks), header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + padded.length + bin.length, 8); header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(bin.length); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, padded, binHeader, bin]);
}

await mkdir(join(OUT, 'vfx/meshes'), { recursive: true });
manifest.meshes = {};
for (const filename of await readdir(join(OUT, 'vfx'))) {
  if (!filename.endsWith('.json')) continue;
  const path = join(OUT, 'vfx', filename), def = JSON.parse(await readFile(path, 'utf8'));
  for (const e of [...(def.complexEmitterDefinitionData ?? []), ...(def.simpleEmitterDefinitionData ?? [])]) {
    const mesh = e.primitive?.mMesh?.mSimpleMeshName;
    if (!mesh) continue;
    const key = canonical(mesh);
    const dest = `vfx/meshes/${key.split('/').at(-1).replace('.scb', '.glb')}`;
    if (!manifest.meshes[key]) await writeFile(join(OUT, dest), scbToGlb(await readFile(source(mesh))));
    manifest.meshes[key] = dest;
    e.meshGlb = dest;
  }
  await writeFile(path, JSON.stringify(def));
}

await mkdir(join(OUT, 'arena'), { recursive: true });
const arenaBase = `data/maps/mapgeometry/map22/${extraction.arena}`;
execFileSync(TOOL, ['mapgeo2gltf', '-m', source(`${arenaBase}.mapgeo`), '-b', source(`${arenaBase}.materials.bin`), '-d', RAW, '-g', join(OUT, 'arena/arena.glb'), '-q', 'High'], { stdio: 'inherit' });
// This release exports geometry but misses the 14.24 material sampler names.
// Restore diffuse samplers from CDTB's BIN dump using CDragon's same-patch PNGs.
const arenaPath = join(OUT, 'arena/arena.glb');
const arenaBytes = await readFile(arenaPath);
const jsonLength = arenaBytes.readUInt32LE(12);
const arenaDoc = JSON.parse(arenaBytes.toString('utf8', 20, 20 + jsonLength));
const materialDefs = JSON.parse(await readFile(join(ROOT, '.local/materials.json'), 'utf8'));
arenaDoc.images = []; arenaDoc.textures = []; arenaDoc.samplers = [{ wrapS: 10497, wrapT: 10497, magFilter: 9729, minFilter: 9987 }];
const imageIndices = new Map();
await mkdir(join(OUT, 'arena/tex'), { recursive: true });
for (const material of arenaDoc.materials) {
  const def = materialDefs[material.name];
  const diffuse = def?.samplerValues?.find(s => /diffuse/i.test(s.samplerName))?.TextureName;
  if (!diffuse) throw new Error(`Missing diffuse sampler: ${material.name}`);
  if (!imageIndices.has(diffuse)) {
    const png = diffuse.toLowerCase().replace(/\.(tex|dds)$/, '.png');
    const name = png.split('/').at(-1), dest = join(OUT, 'arena/tex', name);
    if (!existsSync(dest)) {
      const response = await fetch(`https://raw.communitydragon.org/14.24/game/${png}`);
      if (!response.ok) throw new Error(`Arena texture HTTP ${response.status}: ${png}`);
      await writeFile(dest, Buffer.from(await response.arrayBuffer()));
    }
    const index = arenaDoc.images.length;
    arenaDoc.images.push({ uri: `tex/${name}` });
    arenaDoc.textures.push({ source: index, sampler: 0 });
    imageIndices.set(diffuse, index);
  }
  material.pbrMetallicRoughness = { baseColorTexture: { index: imageIndices.get(diffuse) }, metallicFactor: 0, roughnessFactor: 1 };
  material.extensions = { KHR_materials_unlit: {} };
  material.doubleSided = true;
  if (/Alpha|VertexAnimation/.test(material.name)) { material.alphaMode = 'MASK'; material.alphaCutoff = 0.35; }
}
const arenaJson = Buffer.from(JSON.stringify(arenaDoc));
const arenaPadded = Buffer.concat([arenaJson, Buffer.alloc((4 - arenaJson.length % 4) % 4, 32)]);
const arenaBinChunk = arenaBytes.subarray(20 + jsonLength);
const arenaHeader = Buffer.from(arenaBytes.subarray(0, 20));
arenaHeader.writeUInt32LE(20 + arenaPadded.length + arenaBinChunk.length, 8); arenaHeader.writeUInt32LE(arenaPadded.length, 12);
await writeFile(arenaPath, Buffer.concat([arenaHeader, arenaPadded, arenaBinChunk]));
manifest.arena = { model: 'arena/arena.glb', name: extraction.arena, version: extraction.version };
manifest.wadVersion = extraction.version;
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Converted rigs, five clips per hero, referenced SCB meshes and Map22 arena.');
