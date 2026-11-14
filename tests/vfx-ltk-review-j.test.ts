import { BoxGeometry, Camera, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { VfxSystem, VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';
import { RENDER_PHASE } from '../src/rendering/three-mode/vfx-ltk/engine/model/enums';
import { readVfxSystem } from '../src/rendering/three-mode/vfx-ltk/engine/parsing/readVfxSystem';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, unitAnchor, unitJoints } from '../src/rendering/three-mode/vfx-ltk/particles';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { drawnEmitters } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/definitions';
import { drawPhases } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/drawKind';
import { seeParticles } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/frame';
import { num, struct, syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';

const yes: VfxValue = { type: 'bool', value: true };
const unsupportedPhases: { label: string; fields: Record<string, VfxValue>; detail: string }[] = [
  { label: 'ground quad', fields: { isGroundLayer: yes }, detail: 'ground-layer' },
  { label: 'ground mesh', fields: { isGroundLayer: yes, primitive: struct('VfxPrimitiveMesh', {}) }, detail: 'ground-layer' },
  { label: 'ground ribbon', fields: { isGroundLayer: yes, primitive: struct('VfxPrimitiveCameraTrail', {}) }, detail: 'ground-layer' },
  { label: 'forced ground phase', fields: { renderPhaseOverride: num(RENDER_PHASE.groundLayer) }, detail: 'ground-layer' },
  { label: 'shadow-only quad', fields: { renderPhaseOverride: num(RENDER_PHASE.shadow) }, detail: 'shadow-only' },
];
function emitters(doc: VfxSystem): VfxValue[] {
  if (doc.root.type !== 'struct') throw new Error('synthetic root');
  const list = doc.root.fields.find(field => field.name === 'complexEmitterDefinitionData')!.value;
  if (list.type !== 'container') throw new Error('synthetic emitters');
  return list.items;
}
function mixed(fields: Record<string, VfxValue>, child = false): VfxSystem {
  const doc = syntheticSystem();
  // Keep a supported emitter first: an unsupported sibling/descendant must reject
  // the whole definition, rather than load partial assets and suppress legacy.
  const extra = syntheticSystem(fields);
  emitters(doc).push(...emitters(child ? syntheticSystem({
    childParticleSetDefinition: struct('VfxChildParticleSetDefinitionData', {
      childrenIdentifiers: { type: 'container', items: [struct('VfxChildIdentifier', { effect: extra.root })] },
    }),
  }) : extra));
  return doc;
}
function libraryFor(doc: VfxSystem) {
  const texture = new Texture(), readTexture = vi.fn(async () => texture);
  const library = createVfxLibrary('/synthetic/', {
    readJson: async url => url.endsWith('index.json') ? syntheticIndex() : doc, readTexture,
  });
  return { library, texture, readTexture };
}

describe('review J: host ground and shadow phase boundaries', () => {
  it.each(unsupportedPhases)('rejects $label before assets and preserves fallback above both board styles', async ({ fields, detail }) => {
    const { library, readTexture } = libraryFor(syntheticSystem(fields));
    await expect(library.load('sample')).rejects.toMatchObject({ reason: 'unsupported', message: `vfx-ltk:unsupported:${detail}` });
    expect(library.get('sample')).toBeUndefined(); expect(readTexture).not.toHaveBeenCalled();
    const camera = new Camera(), source = { root: new Group(), body: null, alive: true };
    // The host's actual solid hex shape (top at y=0), plus the arena's transparent
    // cell overlay. Fallback is checked with real floor/unit geometry, not an empty scene.
    const floor = new Mesh(new CylinderGeometry(34 * 0.95, 34 * 0.95, 6, 6), new MeshStandardMaterial());
    floor.position.y = -3;
    const overlay = new Mesh(floor.geometry, new MeshStandardMaterial({ transparent: true, opacity: 0.22, depthWrite: false }));
    overlay.position.y = 1; overlay.scale.y = 0.2;
    const unit = new Mesh(new BoxGeometry(8, 20, 8), new MeshStandardMaterial()); unit.position.y = 10;
    source.root.add(unit);
    const scene = new Scene(); scene.add(floor, overlay, source.root);
    const budget = { live: 0, max: 1500 }, runtime = createLtkRuntime(library, scene, () => source, { budget });
    for (const arenaReady of [false, true]) {
      overlay.visible = arenaReady;
      expect(floor.renderOrder).toBe(0); expect(unit.renderOrder).toBe(0);
      expect(runtime.play('jinx', 'caster', [])).toBe(false);
      runtime.update(0.05, camera);
      expect(runtime.active).toBe(0); expect(runtime.queued).toBe(0); expect(budget.live).toBe(0);
      expect(scene.children).toEqual([floor, overlay, source.root]);
    }
    runtime.dispose(); floor.geometry.dispose(); floor.material.dispose(); overlay.material.dispose(); unit.geometry.dispose(); unit.material.dispose();
  });

  it.each([false, true])('rejects mixed systems including unsupported child=%s before reading any assets', async child => {
    for (const { fields } of unsupportedPhases) {
      const { library, readTexture } = libraryFor(mixed(fields, child));
      await expect(library.load('sample')).rejects.toMatchObject({ reason: 'unsupported' });
      expect(library.get('sample')).toBeUndefined(); expect(readTexture).not.toHaveBeenCalled(); library.dispose();
    }
  });

  it('ignores disabled unsupported emitters instead of unnecessarily rejecting the active colour system', async () => {
    const { library } = libraryFor(mixed({ isGroundLayer: yes, renderPhaseOverride: num(RENDER_PHASE.shadow), disabled: yes }));
    const prepared = await library.load('sample');
    expect(prepared.empty).toBe(false); expect(prepared.drawn[1].emitter.disabled).toBe(true); library.dispose();
  });

  it('does not allocate a colour draw for a shadow-only source even with manually prepared input', () => {
    const model = readVfxSystem(syntheticSystem({ renderPhaseOverride: num(RENDER_PHASE.shadow) }));
    expect(drawPhases(model.emitters[0]).colour).toBeNull();
    const root = new Group(), fx = createLtkParticles({ model, drawn: drawnEmitters(model), samplers: new Map(), meshes: new Map() }, {
      anchor: unitAnchor(root, null), target: null, joints: unitJoints(root, null), duration: 1, seed: 7,
    });
    const camera = new Camera(); seeParticles(camera); fx.update(0.1, camera);
    expect(fx.driver.pool.count).toBeGreaterThan(0); // Still simulates, including child feeds.
    expect(fx.draws).toEqual([]); expect(fx.object.children).toEqual([]);
    expect(fx.passes).toEqual({ early: false, late: false, soft: false }); fx.dispose();
  });

  it('retains automatic colour emitters that also request shadows', async () => {
    const { library } = libraryFor(syntheticSystem({ doesCastShadow: yes }));
    const prepared = await library.load('sample'), root = new Group(), camera = new Camera(); seeParticles(camera);
    const fx = createLtkParticles(prepared, { anchor: unitAnchor(root, null), target: null, joints: unitJoints(root, null), duration: 1, seed: 1 });
    fx.update(0.1, camera);
    expect(fx.draws).toHaveLength(1); expect(fx.draws[0].object.visible).toBe(true);
    expect(fx.draws[0].object.layers.test(camera.layers)).toBe(true); fx.dispose(); library.dispose();
  });
});

describe('review J: unit and scene resource lifetimes', () => {
  it.each(['death', 'removal', 'scene-dispose'])('releases geometry/material once on %s and shared textures only at library disposal', async reason => {
    const { library, texture } = libraryFor(syntheticSystem()); await library.load('sample');
    const scene = new Scene(), camera = new Camera(), budget = { live: 0, max: 1500 };
    const unit = { root: new Group(), body: null, alive: true, disposed: false }; scene.add(unit.root);
    const runtime = createLtkRuntime(library, scene, () => unit, { budget });
    expect(runtime.play('jinx', 'caster', [])).toBe(true); runtime.update(0.01, camera); runtime.update(0.1, camera);
    const effect = scene.children.find(child => child !== unit.root)!;
    const mesh = effect.children[0] as Mesh;
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');
    if (reason === 'scene-dispose') runtime.dispose();
    else {
      unit.alive = false; runtime.stopUnit('caster');
      if (reason === 'removal') { unit.disposed = true; unit.root.removeFromParent(); }
      // Stopped particles retain their visual tail, then the timeline releases them.
      runtime.update(1.1, camera);
      expect(textureDispose).not.toHaveBeenCalled();
    }
    expect(runtime.active).toBe(0); expect(runtime.queued).toBe(0); expect(budget.live).toBe(0);
    expect(effect.parent).toBeNull(); expect(effect.children).toHaveLength(0);
    // LTK draw-buffer pool (70b33ba9): a released system returns its instancing geometry to the
    // size-keyed pool and the runtime's dispose flushes it, so on death/removal the geometry is not
    // yet disposed (was: disposed at release). Exactly-once disposal is still checked below.
    expect(geometryDispose).toHaveBeenCalledTimes(reason === 'scene-dispose' ? 1 : 0); expect(materialDispose).toHaveBeenCalledTimes(1);
    runtime.dispose(); runtime.dispose(); await Promise.resolve();
    expect(geometryDispose).toHaveBeenCalledTimes(1); expect(materialDispose).toHaveBeenCalledTimes(1); expect(textureDispose).toHaveBeenCalledTimes(1);
  });
});
