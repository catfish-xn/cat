import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { assertManifest } from '../src/rendering3d/contracts';
import { parseParticleDocument } from '../src/rendering3d/particle-validation';
// @ts-expect-error Offline Node module.
import { CAROUSEL_NAME, currentCarouselResource, carouselSceneCandidate, stringsIn, missingPlanChunks, mapGeometryReferences } from '../scripts/assets3d/carousel.mjs';
// @ts-expect-error Offline Node module.
import { readCarouselGeometry, carouselRangeGlb, halfFloat } from '../scripts/assets3d/carousel-geometry.mjs';
// @ts-expect-error Offline Node module.
import { carouselModelId, carouselEffectId, carouselDiffuse } from '../scripts/assets3d/carousel-build.mjs';
// @ts-expect-error Offline Node module.
import { readGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Offline Node module.
import { readAccessor } from '../scripts/assets3d/model.mjs';
// @ts-expect-error Offline Node module.
import { fnv1a } from '../scripts/assets3d/bin.mjs';
// @ts-expect-error Offline Node module.
import { encodePng } from '../scripts/assets3d/texture.mjs';
// @ts-expect-error Offline Node module.
import { convertParticles } from '../scripts/assets3d/particles.mjs';
// @ts-expect-error Offline Node module.
import { mergeManifests } from '../scripts/assets3d/merge-manifests.mjs';
// @ts-expect-error Offline Node module.
import { withinRoot } from '../scripts/assets3d/safe-path.mjs';

function geometryFixture() {
  const parts: Buffer[] = [], u = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); parts.push(b); };
  const f = (n: number) => { const b = Buffer.alloc(4); b.writeFloatLE(n); parts.push(b); };
  const str = (s: string) => { u(Buffer.byteLength(s)); parts.push(Buffer.from(s)); };
  parts.push(Buffer.from('OEGM')); u(17); u(0); u(1); u(0); u(3);
  for (let i = 0; i < 15; i++) { u([0, 2, 7][i] ?? 0); u([2, 8, 7][i] ?? 3); }
  const vertices = Buffer.alloc(72);
  [[0, 0, 0], [2, 0, 0], [0, 0, 2]].forEach((p, i) => {
    p.forEach((n, j) => vertices.writeFloatLE(n, i * 24 + j * 4));
    vertices.writeUInt16LE(0x3c00, i * 24 + 20); // U = 1 in half precision
  });
  u(1); parts.push(Buffer.from([255])); u(vertices.length); parts.push(vertices);
  u(1); parts.push(Buffer.from([255])); u(6); parts.push(Buffer.from([0, 0, 1, 0, 2, 0]));
  [1, 3, 1, 0, 0, 3, 0].forEach(u); parts.push(Buffer.from([255])); u(0); u(1); u(0);
  str('Maps/KitPieces/TFT/Set13_Carousel/Materials/Default/Set13_Carousel_Center_MAT');
  [0, 3, 0, 2].forEach(u); parts.push(Buffer.from([0])); [0, 0, 0, 2, 0, 2].forEach(f);
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7500, 5, 7500, 1].forEach(f);
  u(31); for (let i = 0; i < 3; i++) { str(''); [1, 1, 0, 0].forEach(f); }
  return Buffer.concat(parts);
}

describe('offline carousel discovery', () => {
  it('merges synthetic textured geometry and converted particles with a complete hashed precache', async () => {
    const local = resolve('assets3d-local/carousel');
    await mkdir(local, { recursive: true });
    const root = await mkdtemp(join(local, 'test-'));
    try {
      const source = join(root, 'source'), out = join(root, 'runtime');
      const png = encodePng({ width: 1, height: 1, rgba: Buffer.from([255, 128, 0, 255]) });
      const mesh = readCarouselGeometry(geometryFixture()).meshes[0];
      const id = carouselModelId(mesh.ranges[0].material), modelPath = `models/${id}/model.glb`;
      const fxId = carouselEffectId('Maps/Particles/TFT_SharedDraft_Test');
      const converted = convertParticles({ [fxId]: { __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: [{
        isSingleParticle: true, particleLifetime: { constantValue: 1 }, particleLinger: .25,
        texture: 'assets/synthetic.tex',
      }] } }, () => 'textures/carousel/synthetic.png', parseParticleDocument,
      { particleMode: 'approximate', approximateLinger: true, textureAlpha: () => false });
      expect(converted.systems[0].document.emitters).toHaveLength(1);
      expect(converted.counts.approximated).toBe(1);
      const manifest = { schemaVersion: 1, models: { [id]: { path: modelPath } },
        effects: { [fxId]: { path: 'effects/carousel/test.json' } } };
      assertManifest(manifest);
      const files = new Map<string, Buffer | string>([
        [modelPath, carouselRangeGlb(mesh, mesh.ranges[0], png).glb],
        ['textures/carousel/synthetic.png', png],
        ['effects/carousel/test.json', JSON.stringify(converted.systems[0].document)],
        ['manifest.json', JSON.stringify(manifest)], ['audit-only.json', '{}'],
      ]);
      for (const [path, bytes] of files) {
        await mkdir(join(source, path, '..'), { recursive: true }); await writeFile(join(source, path), bytes);
      }
      expect(await mergeManifests({ from: [source], out })).toMatchObject({ ready: true, models: 1, effects: 1, files: 3, missing: [] });
      const precache = JSON.parse(await readFile(join(out, 'precache.json'), 'utf8'));
      expect(precache.files.map((f: { path: string }) => f.path)).toEqual([
        'effects/carousel/test.json', modelPath, 'textures/carousel/synthetic.png',
      ]);
      for (const f of precache.files) {
        const bytes = await readFile(join(out, f.path));
        expect(f).toEqual({ path: f.path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
      expect(readGlb(await readFile(join(out, modelPath))).document.images[0].mimeType).toBe('image/png');
      const before = await readFile(join(out, 'precache.json'));
      expect(await mergeManifests({ from: [source], out })).toMatchObject({ ready: true, written: 0, skipped: 3 });
      expect(await readFile(join(out, 'precache.json'))).toEqual(before);
    } finally {
      withinRoot(local, root);
      if (root === local) throw new Error('unsafe-test-cleanup');
      await rm(root, { recursive: true, force: true });
    }
  });
  it('converts a synthetic MAPG range with affine placement, reflected winding, half UVs and embedded texture', () => {
    const bytes = geometryFixture(), geometry = readCarouselGeometry(bytes), mesh = geometry.meshes[0];
    expect(geometry.meshTableEnd).toBe(bytes.length);
    expect(geometry.ignoredSpatialBytes).toBe(0);
    const png = encodePng({ width: 1, height: 1, rgba: Buffer.from([255, 128, 0, 255]) });
    const result = carouselRangeGlb(mesh, mesh.ranges[0], png), glb = readGlb(result.glb);
    expect(readAccessor(glb, 0)).toEqual([[0, 5, 0], [0, 5, 2], [-2, 5, 0]]);
    expect(readAccessor(glb, 1)).toEqual([[1, 0], [1, 0], [1, 0]]);
    expect(result.bounds).toEqual({ min: [-2, 5, 0], max: [0, 5, 2] });
    expect(glb.document.images[0]).toMatchObject({ mimeType: 'image/png', bufferView: 2 });
    expect(glb.document.materials[0].extensions.KHR_materials_unlit).toEqual({});
    const image = glb.document.bufferViews[2];
    expect(glb.binary.subarray(image.byteOffset, image.byteOffset + image.byteLength)).toEqual(png);
  });
  it('rejects truncated, unsupported and corrupt geometry rather than making placeholder meshes', () => {
    const b = geometryFixture();
    for (const end of [4, 15, 150, b.length - 1]) expect(() => readCarouselGeometry(b.subarray(0, end))).toThrow();
    const version = Buffer.from(b); version.writeUInt32LE(16, 4);
    expect(() => readCarouselGeometry(version)).toThrow('unsupported-carousel-mapgeo');
    const invalid = Buffer.from(b); invalid.writeUInt16LE(10, 237);
    expect(() => readCarouselGeometry(invalid)).toThrow('mapgeo-index-out-of-bounds');
    const nonfinite = Buffer.from(b); nonfinite.writeFloatLE(NaN, 157);
    expect(() => readCarouselGeometry(nonfinite)).toThrow('mapgeo-nonfinite-vertex');
    expect(halfFloat(0x3c00)).toBe(1); expect(halfFloat(0x8000)).toBe(-0);
    expect(halfFloat(1)).toBe(2 ** -24); expect(halfFloat(0x7c00)).toBe(Infinity);
  });
  it('uses stable carousel keys and explicit sampler semantics', () => {
    expect(carouselModelId('Maps/Set13_Carousel_LLPlatforms_MAT')).toBe('carousel-llplatforms');
    expect(carouselEffectId('Maps/Particles/TFT_SharedDraft_UnitSelected')).toBe('carousel-shareddraft-unitselected');
    expect(() => carouselModelId('Set13_Carousel_.._MAT')).toThrow();
    const sampler = (semantic: string, path: string) => ({ fields: [
      { hash: 48757580, value: semantic }, { hash: fnv1a('textureName'), value: path },
    ] });
    const material = { fields: [{ hash: fnv1a('samplerValues'), value: [sampler('Noise', 'wrong.tex'), sampler('DiffuseTexture', 'right.tex')] }] };
    expect(carouselDiffuse(material)).toMatchObject({ path: 'right.tex', omittedSamplers: [{ semantic: 'Noise', path: 'wrong.tex' }] });
    expect(() => carouselDiffuse({ fields: [] })).toThrow('missing-carousel-diffuse');
  });
  it('discovers length-prefixed MAPG baked textures and excludes unframed binary strings', () => {
    const path = 'ASSETS/Maps/Lightmaps/Carousel/0.TFT_Set13_Carousel.tex';
    const string = Buffer.from(path), length = Buffer.alloc(4);
    length.writeUInt32LE(string.length);
    const bytes = Buffer.concat([Buffer.from('OEGM'), length, string, length, string,
      Buffer.alloc(4), Buffer.from('ASSETS/not-a-framed-path.tex')]);
    expect(mapGeometryReferences(bytes)).toEqual([path]);
    expect(mapGeometryReferences(Buffer.from('OEGM'))).toEqual([]);
    expect(() => mapGeometryReferences(Buffer.from('nope'))).toThrow('unsupported-mapgeo-magic');
  });
  it('recognizes carousel and shared draft names without matching unrelated draft names', () => {
    for (const name of ['Carousel_Base.scb', 'SharedDraft/Ring', 'shared_draft_platform']) expect(CAROUSEL_NAME.test(name)).toBe(true);
    expect(CAROUSEL_NAME.test('draft_champion')).toBe(false);
    expect(stringsIn({ fields: [{ value: ['a', { value: 'b' }, 42] }] }).sort()).toEqual(['a', 'b']);
    expect(currentCarouselResource('carousel_set13_tmo.materials.bin')).toBe(true);
    expect(currentCarouselResource('sharedDraft/base.scb')).toBe(true);
    for (const p of ['carousel_set3_5_revival.scb', 'tft7_carousel/base.skn', 'tft_set10carousel.bin']) expect(currentCarouselResource(p)).toBe(false);
    expect(carouselSceneCandidate('data/maps/mapgeometry/map22/carousel_set13.mapgeo')).toBe(true);
    expect(carouselSceneCandidate('assets/maps/kitpieces/tft/set13_carousel/textures/sample_a.tex')).toBe(true);
    expect(carouselSceneCandidate('assets/maps/kitpieces/tft/set13_carousel/textures/carousel_sample_b.tex')).toBe(true);
    expect(carouselSceneCandidate('assets/characters/petdemo/particles/carousel.tex')).toBe(false);
    expect(carouselSceneCandidate('assets/sounds/carousel_audio.bnk')).toBe(false);
  });
  it('lists every overlapping missing block once and keeps CDN offsets distinct from WAD offsets', () => {
    const chunks = [0, 1, 2].map(i => ({ id: `chunk${i}`, bundleId: 'bundle', offset: 500 + i * 10, size: 10, targetSize: 100, fileOffset: i * 100 }));
    const files = [{ name: 'map', size: 300, chunks }];
    const entries = [{ wad: 'map', offset: 90, compressedSize: 120 }, { wad: 'map', offset: 190, compressedSize: 20 }];
    expect(missingPlanChunks(entries, files, new Set(['chunk0']))).toEqual(chunks.slice(1).map(({ fileOffset: _, ...c }) => c));
    expect(() => missingPlanChunks([{ wad: 'unknown' }], files, new Set())).toThrow('missing-carousel-wad');
    expect(missingPlanChunks([{ wad: 'map', offset: 100, compressedSize: 100 }], files, new Set())).toHaveLength(1);
  });
});
