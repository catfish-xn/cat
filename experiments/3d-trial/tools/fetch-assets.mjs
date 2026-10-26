// 从 CommunityDragon 下载 14.24（S13）英雄模型、贴图和技能特效参数，转换成网页能用的格式。
// 输出到 public/assets/（已 gitignore，拳头版权素材不提交）。
//
//   node tools/fetch-assets.mjs
//
// 产物：
//   public/assets/<unit>/model.glb      静态网格（.skn 转 glTF 二进制，保留顶点、法线、UV，按子网格分组）
//   public/assets/<unit>/diffuse.png    原版漫反射贴图（CommunityDragon 已从 .tex 转成 PNG）
//   public/assets/vfx/<system>.json     技能特效定义（原版 .bin 的 JSON，只保留用到的粒子系统）
//   public/assets/vfx/tex/*.png         特效用到的原版贴图
//   public/assets/manifest.json         页面读取的清单

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '14.24';
const CDRAGON = `https://raw.communitydragon.org/${VERSION}/game`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets');

const UNITS = [
  {
    id: 'jinx',
    skn: 'assets/characters/tft13_jinx/skins/base/tft13_jinx.tft_set13.skn',
    texture: 'assets/characters/tft13_jinx/skins/base/tft13_jinx_skin0_tx_cm.tft_set13.png',
    hideSubmeshes: ['Torch'],
    skinScale: 0.95739,
  },
  {
    id: 'vi',
    skn: 'assets/characters/tft13_vi/skins/base/tft13_vi.tft_set13.skn',
    texture: 'assets/characters/tft13_vi/skins/base/tft13_vi_skin0_tx_cm.tft_set13.png',
    hideSubmeshes: [],
    skinScale: 0.90695,
  },
];

// 金克丝技能“死亡火箭”的命中特效和火箭尾焰
const VFX_SOURCE = 'characters/tft13_jinx.cdtb.bin.json';
const VFX_SYSTEMS = [
  'Characters/TFT13_Jinx/Skins/Skin0/Particles/TFT13_Jinx_Base_R_Tar',
  'Characters/TFT13_Jinx/Skins/Skin0/Particles/TFT13_Jinx_Base_R_Rocket_Child',
  'Characters/TFT13_Jinx/Skins/Skin0/Particles/TFT13_Jinx_Base_R_Mis',
];

async function fetchBuffer(path) {
  const url = `${CDRAGON}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---- .skn（r3d2Mesh）解析 ----
function parseSkn(buf) {
  let o = 0;
  const u32 = () => { const v = buf.readUInt32LE(o); o += 4; return v; };
  const u16 = () => { const v = buf.readUInt16LE(o); o += 2; return v; };
  const f32 = () => { const v = buf.readFloatLE(o); o += 4; return v; };
  const magic = u32();
  if (magic !== 0x00112233) throw new Error('不是 .skn 文件');
  const major = u16(); u16();
  if (major !== 4) throw new Error(`暂只支持 .skn v4，实际 v${major}`);
  const submeshes = [];
  const n = u32();
  for (let i = 0; i < n; i++) {
    const name = buf.toString('latin1', o, o + 64).replace(/\0.*$/s, ''); o += 64;
    submeshes.push({ name, startVertex: u32(), vertexCount: u32(), startIndex: u32(), indexCount: u32() });
  }
  u32(); // flags
  const indexCount = u32(), vertexCount = u32(), vertexSize = u32(), vertexType = u32();
  o += 24 + 16; // bbox + bsphere
  const indices = new Uint16Array(indexCount);
  for (let i = 0; i < indexCount; i++) indices[i] = u16();
  const pos = new Float32Array(vertexCount * 3), nrm = new Float32Array(vertexCount * 3), uv = new Float32Array(vertexCount * 2);
  const joints = new Uint8Array(vertexCount * 4), weights = new Float32Array(vertexCount * 4);
  for (let v = 0; v < vertexCount; v++) {
    const start = o;
    // League 是左手坐标系，翻转 X 转成 glTF 右手坐标系
    pos[v * 3] = -f32(); pos[v * 3 + 1] = f32(); pos[v * 3 + 2] = f32();
    for (let k = 0; k < 4; k++) joints[v * 4 + k] = buf[o++];
    for (let k = 0; k < 4; k++) weights[v * 4 + k] = f32();
    nrm[v * 3] = -f32(); nrm[v * 3 + 1] = f32(); nrm[v * 3 + 2] = f32();
    uv[v * 2] = f32(); uv[v * 2 + 1] = f32();
    o = start + vertexSize; // 跳过顶点色/切线（vertexType 1/2）
  }
  // 翻转 X 后三角形绕序要反过来
  for (let i = 0; i < indexCount; i += 3) { const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t; }
  return { submeshes, indices, pos, nrm, uv, joints, weights, vertexType };
}

// ---- 写 glb：每个子网格一个 primitive，共用顶点缓冲 ----
function writeGlb(mesh, hide) {
  const parts = [];
  let offset = 0;
  const views = [];
  const accessors = [];
  const push = (typed, target) => {
    const b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (b.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: offset, byteLength: b.length, ...(target ? { target } : {}) });
    parts.push(b, Buffer.alloc(pad));
    offset += b.length + pad;
    return views.length - 1;
  };
  const vc = mesh.pos.length / 3;
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vc; i++) for (let k = 0; k < 3; k++) { const v = mesh.pos[i * 3 + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  accessors.push({ bufferView: push(mesh.pos, 34962), componentType: 5126, count: vc, type: 'VEC3', min, max });
  accessors.push({ bufferView: push(mesh.nrm, 34962), componentType: 5126, count: vc, type: 'VEC3' });
  accessors.push({ bufferView: push(mesh.uv, 34962), componentType: 5126, count: vc, type: 'VEC2' });
  const primitives = [];
  for (const s of mesh.submeshes) {
    if (hide.includes(s.name)) continue;
    const idx = mesh.indices.slice(s.startIndex, s.startIndex + s.indexCount);
    accessors.push({ bufferView: push(idx, 34963), componentType: 5123, count: idx.length, type: 'SCALAR' });
    primitives.push({ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: accessors.length - 1, material: 0, extras: { submesh: s.name } });
  }
  const gltf = {
    asset: { version: '2.0', generator: 'tft-3d-trial fetch-assets' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'unit' }],
    meshes: [{ primitives }],
    materials: [{ name: 'skin0', pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 1 } }],
    buffers: [{ byteLength: offset }], bufferViews: views, accessors,
  };
  const json = Buffer.from(JSON.stringify(gltf));
  const jsonPad = Buffer.alloc((4 - (json.length % 4)) % 4, 0x20);
  const bin = Buffer.concat(parts);
  const total = 12 + 8 + json.length + jsonPad.length + 8 + bin.length;
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(json.length + jsonPad.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, json, jsonPad, bh, bin]);
}

// .tex 路径 → CommunityDragon 的 PNG 路径
const texToPng = (p) => p.toLowerCase().replace(/\.(tex|dds)$/, '.png');

async function main() {
  await mkdir(join(OUT, 'vfx', 'tex'), { recursive: true });
  const manifest = { version: VERSION, units: {}, vfx: {} };

  for (const u of UNITS) {
    const dir = join(OUT, u.id);
    await mkdir(dir, { recursive: true });
    const mesh = parseSkn(await fetchBuffer(u.skn));
    await writeFile(join(dir, 'model.glb'), writeGlb(mesh, u.hideSubmeshes));
    await writeFile(join(dir, 'diffuse.png'), await fetchBuffer(u.texture));
    manifest.units[u.id] = { model: `${u.id}/model.glb`, texture: `${u.id}/diffuse.png`, skinScale: u.skinScale,
      submeshes: mesh.submeshes.map((s) => s.name), vertexCount: mesh.pos.length / 3 };
    console.log(`模型 ${u.id}: ${mesh.pos.length / 3} 顶点, ${mesh.indices.length / 3} 三角形`);
  }

  const bins = JSON.parse((await fetchBuffer(VFX_SOURCE)).toString('utf8'));
  for (const key of VFX_SYSTEMS) {
    const sys = bins[key];
    if (!sys) { console.warn(`缺少特效 ${key}`); continue; }
    const name = key.split('/').pop();
    const emitters = [...(sys.complexEmitterDefinitionData ?? []), ...(sys.simpleEmitterDefinitionData ?? [])];
    for (const e of emitters) {
      if (e.alphaErosionDefinition?.erosionMapName) e.erosionMap = e.alphaErosionDefinition.erosionMapName;
      for (const field of ['texture', 'particleColorTexture', 'erosionMap']) {
        const tex = e[field];
        if (!tex) continue;
        const png = texToPng(tex);
        const file = png.split('/').pop();
        const dest = join(OUT, 'vfx', 'tex', file);
        e[`${field}Png`] = `vfx/tex/${file}`;
        if (existsSync(dest)) continue;
        try { await writeFile(dest, await fetchBuffer(png)); }
        catch { e[`${field}Png`] = null; console.warn(`  贴图拿不到: ${png}`); }
      }
    }
    await writeFile(join(OUT, 'vfx', `${name}.json`), JSON.stringify(sys));
    manifest.vfx[name] = `vfx/${name}.json`;
    console.log(`特效 ${name}: ${emitters.length} 个发射器`);
  }
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`完成，输出在 ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
