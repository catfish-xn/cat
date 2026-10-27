import { Bone, BoxGeometry, Camera, DataTexture, Group, Skeleton, SkinnedMesh, Texture, Scene, PerspectiveCamera, Vector2 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, unitAnchor, unitJoints } from '../src/rendering/three-mode/vfx-ltk/particles';
import { meshPose } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/meshPose';
import { createVfxPasses } from '../src/rendering/three-mode/vfx-ltk/rendering/passes';
import { DEPTH_RANGE, VIEWPORT } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/frame';
import { syntheticIndex, syntheticSystem, struct, num } from './vfx-ltk-synthetic';
import { binaryFixture } from './vfx-ltk-binary-fixture';
import { DISTORTION_MODE } from '../src/rendering/three-mode/vfx-ltk/engine/model/enums';
import { nameHash } from '../src/rendering/three-mode/vfx-ltk/binHash';
import type { VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';
const asset = (path: string): VfxValue => ({ type: 'asset', path, asset: { kind: 'file', path: '/synthetic/' + path } });
async function load(fields: Record<string, VfxValue>, extraAssets: Record<string, string> = {}) {
  const index = syntheticIndex(); Object.assign(index.assets, extraAssets);
  const library = createVfxLibrary('/root/', {
    readJson: async url => url.endsWith('index.json') ? index : syntheticSystem(fields),
    readTexture: async url => url.endsWith('cube.png') ? new DataTexture(new Uint8Array(24).fill(255), 1, 6) : new Texture(),
    readBinary: async url => binaryFixture(url.endsWith('.ltks') ? 'skeleton' : url.endsWith('.ltka') ? 'clip' : 'mesh', url.includes('skin'), url.includes('subset')),
  });
  const prepared = await library.load('sample');
  const root = new Group(), body = new Group(); root.add(body);
  const create = () => createLtkParticles(prepared, { anchor: unitAnchor(root, body), target: null,
    joints: unitJoints(root, body), duration: 1, seed: 3, attachment: { root, body } });
  return { library, prepared, create, root, body };
}

describe('real-export feature paths with tiny synthetic assets', () => {
  it('accepts distortion, loads its normal sampler and draws only on the authored warp layer', async () => {
    const f = await load({ distortionDefinition: struct('VfxDistortionDefinitionData', {
      distortion: num(0.4), distortionMode: num(DISTORTION_MODE.all), normalMapTexture: asset('normal.tex'),
    }) }, { 'normal.tex': 'textures/normal.png' });
    const fx = f.create(), draw = fx.draws[0];
    expect(f.prepared.samplers.get('0')!.normal).toBeInstanceOf(Texture);
    expect(draw.material.defines).toHaveProperty('DISTORTS'); expect(draw.material.defines).toHaveProperty('HAS_NORMAL');
    expect(draw.material.uniforms.warp.value).toBeCloseTo(0.4);
    expect(fx.passes).toEqual({ early: false, late: true, soft: false });
    expect(draw.object.layers.mask).toBe(1 << 1); fx.dispose(); f.library.dispose();
  });
  it('accepts soft particles and binds authored gap/fade constants to scene depth', async () => {
    const f = await load({ softParticleParams: struct('VfxSoftParticleDefinitionData', { beginIn: num(2), deltaIn: num(4), beginOut: num(20), deltaOut: num(5) }) });
    const fx = f.create(), material = fx.draws[0].material;
    expect(material.defines).toHaveProperty('SOFT');
    expect(material.uniforms.softParams.value).toEqual([2, 20, 0.25, 0.2]);
    expect(material.uniforms.sceneDepth.value).toBeInstanceOf(Texture); expect(fx.passes.soft).toBe(true);
    fx.dispose(); f.library.dispose();
  });
  it('accepts .sco and reflection, preserves mirrored geometry and supplies a cube sampler', async () => {
    const f = await load({ primitive: struct('VfxPrimitiveMesh', { mMesh: struct('VfxMeshDefinitionData', { mSimpleMeshName: asset('shell.sco') }) }),
      reflectionDefinition: struct('VfxReflectionDefinitionData', { fresnel: num(2), reflectionMapTexture: asset('cube.dds') }) },
    { 'shell.sco': 'meshes/static.ltkg', 'cube.dds': 'textures/cube.png' });
    const mesh = f.prepared.meshes.get('0')!;
    expect([...mesh.getAttribute('position').array]).toEqual([-1, 0, 0, -0, 1, 0, -0, 0, 1]);
    expect([...mesh.index!.array]).toEqual([0, 2, 1]);
    const fx = f.create(), material = fx.draws[0].material;
    expect(material.defines).toHaveProperty('REFLECTS'); expect(material.uniforms.mapReflection.value.isCubeTexture).toBe(true);
    expect(material.uniforms.mapReflection.value.images).toHaveLength(6);
    expect(material.uniforms.fresnel.value).toEqual([0, 0, 0, 2]); fx.dispose(); f.library.dispose();
  });
  it('loads LTKS/LTKA, normalizes weights, poses each particle age and releases its palette once', async () => {
    const f = await load({ primitive: struct('VfxPrimitiveMesh', { mMesh: struct('VfxMeshDefinitionData', {
      mMeshName: asset('skin.skn'), mMeshSkeletonName: asset('skin.skl'), mAnimationName: asset('skin.anm'),
    }) }) }, { 'skin.skn': 'meshes/skin.ltkg', 'skin.skl': 'skeletons/skin.ltks', 'skin.anm': 'animations/skin.ltka' });
    expect(f.prepared.poses!.size).toBe(1);
    expect([...f.prepared.meshes.get('0')!.getAttribute('skinWeight').array]).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    const palette = meshPose(f.prepared.poses!.get('0')!);
    palette.write(0, 0.5); palette.write(1, 0.5); palette.write(2, 0.25); palette.commit(3);
    const data = palette.texture.image.data as Float32Array;
    expect(data[12]).toBeCloseTo(-5); expect(data[28]).toBeCloseTo(-5); expect(data[44]).toBeCloseTo(-2.5);
    palette.texture.dispose();
    const fx = f.create(), material = fx.draws[0].material, texture = material.uniforms.particleBones.value;
    expect(material.defines.PARTICLE_SKINNING).toBe(1);
    const dispose = vi.spyOn(texture, 'dispose'); fx.update(0.05, new Camera()); fx.dispose(); fx.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
    f.library.dispose();
  });
  it('accepts a named submesh filter and excludes the other index range', async () => {
    const f = await load({ primitive: struct('VfxPrimitiveMesh', { mMesh: struct('VfxMeshDefinitionData', {
      mSimpleMeshName: asset('subset.scb'), mSubmeshesToDraw: { type: 'container', items: [{ type: 'hash', hash: nameHash('triangle'), name: 'triangle' }] },
    }) }) }, { 'subset.scb': 'meshes/subset.ltkg' });
    expect(f.prepared.model.emitters[0].mesh!.submeshes).toEqual([nameHash('triangle')]);
    expect([...f.prepared.meshes.get('0')!.index!.array]).toEqual([0, 2, 1]); f.library.dispose();
  });
  it('accepts an avatar attachment and borrows the live geometry/skeleton without disposing them', async () => {
    const f = await load({ primitive: struct('VfxPrimitiveAttachedMesh', { mMesh: struct('VfxMeshDefinitionData', { mLockMeshToAttachment: { type: 'bool', value: true } }) }) });
    const source = new SkinnedMesh(new BoxGeometry()), bone = new Bone(); source.add(bone); source.bind(new Skeleton([bone])); f.body.add(source);
    const geometryDispose = vi.spyOn(source.geometry, 'dispose'), skeletonDispose = vi.spyOn(source.skeleton, 'dispose');
    const fx = f.create(); expect(fx.draws).toHaveLength(8); fx.update(0.1, new Camera());
    expect(fx.draws.some(draw => draw.object.visible)).toBe(true);
    const overlay = fx.draws[0].object as SkinnedMesh;
    expect(overlay.skeleton).toBe(source.skeleton); expect(overlay.geometry).toBe(source.geometry);
    expect(overlay.material).not.toBe(source.material);
    source.removeFromParent(); fx.update(0.01, new Camera()); expect(fx.draws.every(draw => !draw.object.visible)).toBe(true);
    fx.dispose(); expect(geometryDispose).not.toHaveBeenCalled(); expect(skeletonDispose).not.toHaveBeenCalled();
    source.geometry.dispose(); source.skeleton.dispose(); f.library.dispose();
  });
  it('handles original empty definitions as explicit no-ops', async () => {
    const doc = syntheticSystem(); doc.root = struct('VfxSystemDefinitionData', {});
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : doc, readTexture: async () => { throw new Error('empty must not read textures'); } });
    const prepared = await library.load('sample'); expect(prepared.empty).toBe(true); expect(prepared.drawn).toEqual([]); library.dispose();
  });
  it('rejects truncated mesh, skeleton and animation bytes', async () => {
    const { readMeshBuffer } = await import('../src/rendering/three-mode/vfx-ltk/assets/meshBuffer');
    const { readSkeletonBuffer } = await import('../src/rendering/three-mode/vfx-ltk/assets/skeletonBuffer');
    const { readClipBuffer } = await import('../src/rendering/three-mode/vfx-ltk/assets/clipBuffer');
    for (const [kind, read] of [['mesh', readMeshBuffer], ['skeleton', readSkeletonBuffer], ['clip', readClipBuffer]] as const) {
      expect(() => read(binaryFixture(kind).slice(0, 15))).toThrow();
    }
  });
});

it('renders depth, early warp, under, late warp, over in order and restores renderer state on errors', () => {
  const camera = new PerspectiveCamera(45, 1, 4.4, 440), scene = new Scene(), calls: [number, boolean][] = [];
  let target: unknown = null;
  const gl = { autoClear: true, outputColorSpace: '', properties: { has: () => false },
    state: { activeTexture: vi.fn(), buffers: { color: { setMask: vi.fn(), setLocked: vi.fn() } } },
    getContext: () => ({ TEXTURE0: 0 }), copyFramebufferToTexture: vi.fn(),
    getDrawingBufferSize: (out: InstanceType<typeof Vector2>) => out.set(128, 64), getRenderTarget: () => target,
    setRenderTarget: (value: unknown) => { target = value; }, render: vi.fn(() => { calls.push([camera.layers.mask, target !== null]); }),
  };
  const passes = createVfxPasses(gl as never), before = camera.layers.mask;
  passes.render(scene, camera, { soft: true, early: true, late: true });
  expect(calls).toEqual([[1, true], [1, false], [32, false], [16, false], [2, false], [4, false]]);
  expect(VIEWPORT.toArray()).toEqual([128, 64]); expect(DEPTH_RANGE.x).toBeCloseTo(10); expect(DEPTH_RANGE.y).toBeCloseTo(1000);
  expect(camera.layers.mask).toBe(before); expect(gl.autoClear).toBe(true); expect(target).toBeNull();
  gl.render.mockImplementationOnce(() => { throw new Error('GPU failed'); });
  expect(() => passes.render(scene, camera, { soft: false, early: false, late: false })).toThrow('GPU failed');
  expect(camera.layers.mask).toBe(before); expect(gl.autoClear).toBe(true); expect(scene.background).toBeNull(); passes.dispose();
});
