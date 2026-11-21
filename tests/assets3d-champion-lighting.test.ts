import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyChampionLighting, boardAmbientCube, extractChampionSelfIllumination, parseLightGrid, sampleLightGrid, writeChampionLighting,
// @ts-expect-error Pure Node utility.
} from '../scripts/assets3d/champion-lighting.mjs';
// @ts-expect-error Pure Node utility.
import { fnv1a } from '../scripts/assets3d/bin.mjs';
import { assertChampionLighting, assertManifest } from '../src/rendering3d/contracts';

// Every value here is synthetic; no client file or number is used.
const obj = (name: string, values: Record<string, unknown>) => ({ type: fnv1a(name), fields: Object.entries(values).map(([field, value]) => ({
  hash: fnv1a(field), type: typeof value === 'number' ? 10 : typeof value === 'string' ? 16 : 0x83, value,
})) });
const link = (name: string) => ({ kind: 'link', hash: fnv1a(name) });
const doc = (...entries: unknown[]) => ({ entries, patches: [] });
const skin = (mesh: Record<string, unknown>) => doc({ ...obj('TftSkinCharacterDataProperties', { skinMeshProperties: obj('SkinMeshDataProperties', mesh) }), hash: 1 });
const material = (name: string, shader: string) => ({ ...obj('StaticMaterialDef', {
  techniques: [obj('StaticMaterialTechniqueDef', { passes: [obj('StaticMaterialPassDef', { shader: link(shader) })] })],
}), hash: fnv1a(name) });
const TIERS = 'Shaders/SkinnedMesh/TFT_ChampTiers';

/** width × height cells; face f of every cell holds colour (f, f, f) × step unless `cell` overrides it. */
function grid(width: number, height: number, extent: number, cell?: (x: number, z: number, face: number) => number[]) {
  const header = Buffer.alloc(32);
  header.writeUInt32LE(3, 0); header.writeUInt32LE(32, 4); header.writeUInt32LE(width, 8); header.writeUInt32LE(height, 12);
  header.writeFloatLE(extent, 16); header.writeFloatLE(extent, 20);
  const body = Buffer.alloc(width * height * 24);
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) for (let f = 0; f < 6; f++) {
    const [r, g, b] = cell?.(x, z, f) ?? [f * 40, f * 40, f * 40];
    body.set([r, g, b, 255], ((z * width + x) * 6 + f) * 4);
  }
  return Buffer.concat([header, body]);
}

describe('champion lighting converter', () => {
  it('parses a light grid and rejects other versions, sizes and truncation', () => {
    const bytes = grid(4, 2, 400);
    expect(parseLightGrid(bytes)).toMatchObject({ width: 4, height: 2, extentX: 400, extentZ: 400 });
    expect(() => parseLightGrid(bytes.subarray(0, -1))).toThrow('invalid-light-grid');
    const other = Buffer.from(bytes); other.writeUInt32LE(2, 0);
    expect(() => parseLightGrid(other)).toThrow('invalid-light-grid');
    expect(() => parseLightGrid(Buffer.alloc(8))).toThrow('invalid-light-grid');
  });
  it('samples bilinearly between cell centres and clamps outside the grid', () => {
    const g = parseLightGrid(grid(2, 1, 200, x => [x * 200, 0, 0]));
    expect(sampleLightGrid(g, 50, 50)[0][0]).toBeCloseTo(0);
    expect(sampleLightGrid(g, 100, 50)[0][0]).toBeCloseTo(100 / 255);
    expect(sampleLightGrid(g, 150, 50)[0][0]).toBeCloseTo(200 / 255);
    expect(sampleLightGrid(g, -500, 50)[0][0]).toBeCloseTo(0);
    expect(sampleLightGrid(g, 900, 900)[0][0]).toBeCloseTo(200 / 255);
  });
  it('re-keys the source faces to world axes through the alignment signs and the X reflection', () => {
    const g = parseLightGrid(grid(4, 4, 400));
    const face = (f: number) => [f * 40 / 255, f * 40 / 255, f * 40 / 255];
    const alignment = (reflectX: boolean, sx: number, sz: number) => ({ reflectX, scale: [sx, sx, sz], offset: [0, 0, 0], target: { radius: 1, origin: { x: 0, y: 0 } } });
    const ids = (cube: number[][]) => cube.map(c => Math.round(c[0] * 255 / 40));
    expect(ids(boardAmbientCube(g, alignment(false, 1, 1), { columns: 2, rows: 2 }))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ids(boardAmbientCube(g, alignment(true, 1, -1), { columns: 2, rows: 2 }))).toEqual([1, 0, 2, 3, 5, 4]);
    expect(ids(boardAmbientCube(g, alignment(true, -1, 1), { columns: 2, rows: 2 }))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(boardAmbientCube(g, alignment(false, 1, 1))[2]).toEqual(face(2));
  });
  it('takes the per-channel median over the hex cell centres, so one hot cell does not tint the board', () => {
    const g = parseLightGrid(grid(4, 4, 400, (x, z) => x === 0 && z === 0 ? [255, 255, 255] : [60, 60, 60]));
    const cube = boardAmbientCube(g, { scale: [0.01, 0.01, 0.01], offset: [0, 0, 0], target: { radius: 1, origin: { x: 0.5, y: 0.5 } } }, { columns: 3, rows: 3 });
    expect(cube.every((c: number[]) => c.every(v => Math.abs(v - 60 / 255) < 1e-9))).toBe(true);
  });
  it('reads selfIllumination only for skins whose material is the champion tier shader', () => {
    const characters = [doc(material('Mat/Tier', TIERS), material('Mat/Other', 'Shaders/SkinnedMesh/Diffuse_Only'))];
    expect(extractChampionSelfIllumination([skin({ material: link('Mat/Tier'), selfIllumination: 0.25 })], characters)).toBe(0.25);
    expect(extractChampionSelfIllumination([skin({ material: link('Mat/Tier') })], characters)).toBe(0);
    expect(extractChampionSelfIllumination([skin({ material: link('Mat/Other'), selfIllumination: 0.25 })], characters)).toBeNull();
    expect(extractChampionSelfIllumination([skin({ material: link('Mat/Missing'), selfIllumination: 0.25 })], characters)).toBeNull();
    expect(() => extractChampionSelfIllumination([skin({ material: link('Mat/Tier'), selfIllumination: -1 })], characters)).toThrow('invalid-self-illumination');
  });
  it('writes the board lighting path and per-model values copy-on-write, validated by the real contract', () => {
    const manifest = { schemaVersion: 1, models: { a: { path: 'a.glb' }, b: { path: 'b.glb', selfIllumination: 1 }, board: { path: 'board.glb' } },
      boards: { board: { alignment: { scale: [1, 1, 1], offset: [0, 0, 0], target: { radius: 1, origin: { x: 0, y: 0 } } } } } };
    const result = applyChampionLighting(manifest, { board: 'board', lightingPath: 'lighting.json', rows: [{ ids: ['a'], selfIllumination: 0.5 }, { ids: ['b'], selfIllumination: null }] }, assertManifest);
    expect(result.models.a.selfIllumination).toBe(0.5);
    expect(result.models.b).not.toHaveProperty('selfIllumination');
    expect(result.boards.board.lighting).toEqual({ path: 'lighting.json' });
    expect(manifest.models.b.selfIllumination).toBe(1);
    expect(() => applyChampionLighting(manifest, { board: 'none', lightingPath: 'l.json', rows: [] }, assertManifest)).toThrow('unknown-lighting-board');
    expect(() => applyChampionLighting(manifest, { board: 'board', lightingPath: 'l.json', rows: [{ ids: ['zz'], selfIllumination: 1 }] }, assertManifest)).toThrow('unknown-or-duplicate-lighting-id');
    expect(() => applyChampionLighting(manifest, { board: 'board', lightingPath: '../l.json', rows: [] }, assertManifest)).toThrow('invalid-asset-path');
    expect(() => applyChampionLighting(manifest, { board: 'board', lightingPath: 'l.json', rows: [{ ids: ['a'], selfIllumination: 9 }] }, assertManifest)).toThrow('invalid-self-illumination');
  });
  it('runs a local job end to end and keeps output inside assets3d-local', async () => {
    const local = fileURLToPath(new URL('../assets3d-local/', import.meta.url));
    await mkdir(local, { recursive: true });
    const directory = await mkdtemp(join(local, 'champion-lighting-test-'));
    try {
      const write = async (name: string, data: string | Buffer) => { const path = join(directory, name); await writeFile(path, data); return path; };
      // Minimal binary PROP files are covered by the unit-scale tests; here the job reads generated grids and manifests.
      const manifestPath = await write('input.json', JSON.stringify({ schemaVersion: 1, models: { board: { path: 'board.glb' } },
        boards: { board: { alignment: { scale: [1, 1, 1], offset: [0, 0, 0], target: { radius: 10, origin: { x: 20, y: 20 } } }, grid: { columns: 2, rows: 2 } } } }));
      const job = { manifestPath, outputManifest: join(directory, 'manifest.json'), outputLighting: join(directory, 'lighting.json'), lightingPath: 'lighting.json',
        board: 'board', lightGrid: await write('grid.dat', grid(4, 4, 400)), scales: { ambient: 0.5, self: 1 }, selections: [] };
      await writeChampionLighting(job);
      const lighting = JSON.parse(await readFile(job.outputLighting, 'utf8'));
      expect(() => assertChampionLighting(lighting)).not.toThrow();
      expect(lighting).toMatchObject({ schemaVersion: 1, ambientScale: 0.5, selfScale: 1 });
      expect(JSON.parse(await readFile(job.outputManifest, 'utf8')).boards.board.lighting).toEqual({ path: 'lighting.json' });
      await expect(writeChampionLighting({ ...job, scales: { ambient: 9, self: 1 } })).rejects.toThrow('invalid-champion-lighting');
      await expect(writeChampionLighting({ ...job, outputLighting: '/tmp/lighting.json' })).rejects.toThrow();
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
