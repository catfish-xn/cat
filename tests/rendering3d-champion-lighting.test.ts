import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShaderLib, Texture, type WebGLProgramParametersWithUniforms } from 'three';
import { CHAMPION_LIGHTING_KEY, createChampionLighting, loadChampionLighting } from '../src/rendering/three-mode/champion-lighting';
import { assertChampionLighting, assertManifest, type AssetManifest, type ChampionLighting } from '../src/rendering3d/contracts';

// Synthetic values only; the real cube and scales live in a local asset root.
const lighting: ChampionLighting = { schemaVersion: 1, ambientScale: 0.5, selfScale: 1,
  ambientCube: [[0.1, 0.1, 0.1], [0.2, 0.2, 0.2], [0.3, 0.3, 0.3], [0.4, 0.4, 0.4], [0.5, 0.5, 0.5], [0.6, 0.6, 0.6]] };
const board = { alignment: { scale: [1, 1, 1], offset: [0, 0, 0], target: { radius: 1, origin: { x: 0, y: 0 } } }, lighting: { path: 'lighting.json' } };
const manifest = { schemaVersion: 1, boards: { 'board-default': board },
  models: { hero: { path: 'hero.glb', selfIllumination: 0.25 }, other: { path: 'other.glb', selfIllumination: 0.75 }, monster: { path: 'm.glb' }, 'board-default': { path: 'b.glb' } } } as unknown as AssetManifest;
const textured = () => new MeshStandardMaterial({ map: new Texture() });
const model = (...materials: (MeshStandardMaterial | MeshBasicMaterial)[]) => {
  const scene = new Group();
  for (const material of materials) scene.add(new Mesh(new BoxGeometry(), material));
  return scene;
};
const compile = (material: MeshStandardMaterial) => {
  const shader = { uniforms: {}, vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, undefined as never);
  return shader as unknown as { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string };
};

describe('3D champion lighting', () => {
  it('accepts the optional manifest fields and keeps older roots valid', () => {
    expect(() => assertManifest(manifest)).not.toThrow();
    expect(() => assertManifest({ schemaVersion: 1, models: { a: { path: 'a.glb' } } })).not.toThrow();
    const bad = (models: unknown, boards?: unknown) => () => assertManifest({ schemaVersion: 1, models, ...(boards ? { boards } : {}) });
    expect(bad({ a: { path: 'a.glb', selfIllumination: -0.1 } })).toThrow('invalid-self-illumination');
    expect(bad({ a: { path: 'a.glb', selfIllumination: '1' } })).toThrow('invalid-self-illumination');
    expect(bad({ b: { path: 'b.glb' } }, { b: { ...board, lighting: { path: 'x.png' } } })).toThrow('invalid-board-lighting');
    expect(bad({ b: { path: 'b.glb' } }, { b: { ...board, lighting: { path: '../x.json' } } })).toThrow('invalid-asset-path');
  });

  it('validates the lighting document', () => {
    expect(() => assertChampionLighting(lighting)).not.toThrow();
    for (const broken of [{ ...lighting, schemaVersion: 2 }, { ...lighting, ambientScale: -1 }, { ...lighting, selfScale: 5 },
      { ...lighting, ambientCube: lighting.ambientCube.slice(0, 5) }, { ...lighting, ambientCube: [...lighting.ambientCube.slice(0, 5), [0, 0, 2]] }, null])
      expect(() => assertChampionLighting(broken)).toThrow('invalid-champion-lighting');
  });

  it('patches only textured standard materials of models that carry selfIllumination, once, under one program key', () => {
    const applier = createChampionLighting(manifest, lighting);
    const a = textured(), b = textured(), plain = new MeshStandardMaterial(), basic = new MeshBasicMaterial({ map: new Texture() });
    applier.apply(model(a, plain, basic), 'hero');
    applier.apply(model(b), 'other');
    expect(a.customProgramCacheKey()).toBe(CHAMPION_LIGHTING_KEY);
    expect(b.customProgramCacheKey()).toBe(a.customProgramCacheKey());
    expect(plain.customProgramCacheKey()).not.toBe(CHAMPION_LIGHTING_KEY);
    expect(basic.customProgramCacheKey()).not.toBe(CHAMPION_LIGHTING_KEY);
    for (const id of ['monster', 'board-default', 'missing']) {
      const untouched = textured(); applier.apply(model(untouched), id);
      expect(untouched.customProgramCacheKey()).not.toBe(CHAMPION_LIGHTING_KEY);
    }
    // A template seen again (another lease) is not re-patched with another model's value.
    applier.apply(model(a), 'other');
    expect(compile(a).uniforms.championSelf.value).toBe(0.25);
    expect(compile(b).uniforms.championSelf.value).toBe(0.75);
  });

  it('injects the cube and the clamped lit term into the standard shader, sharing the cube uniforms', () => {
    const applier = createChampionLighting(manifest, lighting), a = textured(), b = textured();
    applier.apply(model(a), 'hero'); applier.apply(model(b), 'other');
    const sa = compile(a), sb = compile(b);
    expect(sa.vertexShader).toContain('vChampionAmbient = mix(championCube[0], championCube[1]');
    expect(sa.vertexShader.indexOf('#include <skinnormal_vertex>')).toBeLessThan(sa.vertexShader.indexOf('vec3 championN'));
    expect(sa.fragmentShader).toContain('clamp(vChampionAmbient * championAmbientScale + championSelf * championSelfScale, 0.0, 1.0)');
    expect(sa.fragmentShader.indexOf('outgoingLight = diffuseColor.rgb')).toBeLessThan(sa.fragmentShader.indexOf('#include <opaque_fragment>'));
    expect(sa.uniforms.championCube).toBe(sb.uniforms.championCube);
    expect(sa.uniforms.championAmbientScale.value).toBe(0.5);
    expect((sa.uniforms.championCube.value as { y: number }[])[3].y).toBeCloseTo(0.4);
  });

  it('loads the board entry, and stays off for quality off, a missing entry or a bad document', async () => {
    const read = vi.fn(async () => lighting);
    expect(await loadChampionLighting(manifest, 'root/', 'board-default', 'balanced', read)).not.toBeNull();
    expect(read).toHaveBeenCalledWith('root/lighting.json');
    expect(await loadChampionLighting(manifest, 'root/', 'board-default', 'low', read)).not.toBeNull();
    read.mockClear();
    expect(await loadChampionLighting(manifest, 'root/', 'board-default', 'off', read)).toBeNull();
    expect(await loadChampionLighting(manifest, null, 'board-default', 'balanced', read)).toBeNull();
    expect(await loadChampionLighting(manifest, 'root/', 'other-board', 'balanced', read)).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(await loadChampionLighting(manifest, 'root/', 'board-default', 'balanced', async () => ({ ...lighting, schemaVersion: 9 }))).toBeNull();
    expect(await loadChampionLighting(manifest, 'root/', 'board-default', 'balanced', async () => { throw new Error('offline'); })).toBeNull();
  });
});
