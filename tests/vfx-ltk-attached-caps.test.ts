import { Bone, BoxGeometry, Camera, Group, MeshBasicMaterial, Scene, Skeleton, SkinnedMesh, Texture } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, unitAnchor, unitJoints } from '../src/rendering/three-mode/vfx-ltk/particles';
import { ATTACHED_LAYER_CAP, createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { ATTACHED_SLOTS } from '../src/rendering/three-mode/vfx-ltk/rendering/components/AttachedMeshes';
import { nameHash } from '../src/rendering/three-mode/vfx-ltk/binHash';
import type { VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';
import { struct, syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';

/** Synthetic host part: one skinned box whose single material carries the part's name. */
function part(name: string): SkinnedMesh {
  const material = new MeshBasicMaterial(); material.name = name;
  const mesh = new SkinnedMesh(new BoxGeometry(), material), bone = new Bone(); mesh.add(bone); mesh.bind(new Skeleton([bone]));
  return mesh;
}
const parts = (...names: string[]): VfxValue => ({ type: 'container', items: names.map(name => ({ type: 'hash', hash: nameHash(name), name })) });
const attached = (mesh: Record<string, VfxValue> = {}) => ({ primitive: struct('VfxPrimitiveAttachedMesh', { mMesh: struct('VfxMeshDefinitionData', mesh) }) });
async function prepare(fields: Record<string, VfxValue>) {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(fields), readTexture: async () => new Texture() });
  return { library, prepared: await library.load('sample') };
}
afterEach(() => vi.restoreAllMocks());

describe('attached-mesh part filter (mSubmeshesToDraw)', () => {
  it('overlays only the named part of the host, never the rest of the body', async () => {
    const { library, prepared } = await prepare(attached({ mSubmeshesToDraw: parts('Weapon') }));
    const root = new Group(), body = new Group(), weapon = part('weapon'), torso = part('body'); root.add(body); body.add(torso, weapon);
    const fx = createLtkParticles(prepared, { anchor: unitAnchor(root, body), target: null, joints: unitJoints(root, body), duration: 1, seed: 1, attachment: { root, body } });
    expect(fx.attached).toHaveLength(ATTACHED_SLOTS);
    expect(fx.attached.every(draw => (draw.object as SkinnedMesh).geometry === weapon.geometry)).toBe(true);
    fx.update(0.1, new Camera()); expect(fx.attached.some(draw => draw.object.visible)).toBe(true);
    fx.dispose(); library.dispose();
  });
  it('draws nothing and logs once when the host holds none of the named parts (no whole-body fallback)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { library, prepared } = await prepare(attached({ mSubmeshesToDraw: parts('cape') }));
    const root = new Group(), body = new Group(); body.name = 'host-without-cape'; root.add(body); body.add(part('body'));
    const fx = createLtkParticles(prepared, { anchor: unitAnchor(root, body), target: null, joints: unitJoints(root, body), duration: 1, seed: 1, attachment: { root, body } });
    expect(fx.attached).toEqual([]); expect(fx.draws).toEqual([]);
    expect(warn).toHaveBeenCalledWith('vfx-ltk:attached-parts-missing:synthetic-only:host-without-cape');
    fx.dispose(); library.dispose();
  });
  it('keeps a listed cued emitter on the whole body while its host model lacks the part (ATTACHED_WHOLE_BODY)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const index = { ...syntheticIndex(), systems: { '7e6f06b5': 'systems/listed.json' }, skills: {} };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index
      : syntheticSystem({ emitterName: { type: 'string', value: 'Avatar_BodyLight' }, ...attached({ mSubmeshesToDraw: parts('Weapon') }) }), readTexture: async () => new Texture() });
    const prepared = await library.load('7e6f06b5');
    const root = new Group(), body = new Group(), whole = part('Body'); root.add(body); body.add(whole);
    const fx = createLtkParticles(prepared, { anchor: unitAnchor(root, body), target: null, joints: unitJoints(root, body), duration: 1, seed: 1, attachment: { root, body } });
    expect(fx.attached).toHaveLength(ATTACHED_SLOTS); expect(warn).not.toHaveBeenCalled();
    fx.dispose(); library.dispose();
  });
  /** Overlays one synthetic attached emitter named `name` of system `id` would draw on a one-part host. */
  async function heldOverlays(id: string, name: string) {
    const index = { ...syntheticIndex(), systems: { [id]: 'systems/held.json' }, skills: {} };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index
      : syntheticSystem({ emitterName: { type: 'string', value: name }, ...attached() }), readTexture: async () => new Texture() });
    const prepared = await library.load(id);
    const root = new Group(), body = new Group(); root.add(body); body.add(part('body'));
    const fx = createLtkParticles(prepared, { anchor: unitAnchor(root, body), target: null, joints: unitJoints(root, body), duration: 1, seed: 1, attachment: { root, body } });
    const count = fx.attached.length;
    fx.dispose(); library.dispose();
    return count;
  }
  it('leaves a held-back attached emitter undrawn (ATTACHED_HELD_BACK), the system itself still loading', async () => {
    expect(await heldOverlays('8d9d784b', 'Avatar_Fresnel')).toBe(0);
  });
  it('holds back by system and emitter name together: another emitter of that system still draws', async () => {
    expect(await heldOverlays('8d9d784b', 'Avatar_Other')).toBe(ATTACHED_SLOTS);
  });
  it('holds back by system and emitter name together: the same emitter name in another system still draws', async () => {
    expect(await heldOverlays('0badc0de', 'Avatar_Fresnel')).toBe(ATTACHED_SLOTS);
  });
});

describe('attached-mesh size', () => {
  async function drawnAt(scale: number) {
    const { library, prepared } = await prepare(attached());
    const scene = new Scene(), root = new Group(), body = new Group(), host = part('body'); scene.add(root); root.add(body); body.add(host);
    root.position.set(30, 0, -20); host.position.set(0, 40, 5);
    const fx = createLtkParticles(prepared, { anchor: unitAnchor(root, body), target: null, joints: unitJoints(root, body), duration: 1, seed: 1, attachment: { root, body }, scale });
    scene.add(fx.object); fx.update(0.1, new Camera()); scene.updateMatrixWorld(true);
    const shown = fx.attached.find(draw => draw.object.visible);
    const elements = shown ? [...shown.object.matrixWorld.elements] : null;
    fx.dispose(); library.dispose();
    return elements;
  }
  it('draws on the host at the same size whatever the cue scale (a chest cue is SKILL_FX_SIZE 0.64)', async () => {
    const plain = await drawnAt(1), scaled = await drawnAt(0.638);
    expect(plain).not.toBeNull();
    plain!.forEach((value, at) => expect(scaled![at]).toBeCloseTo(value, 4));
  });
});

describe('attached-mesh screen cap and switch', () => {
  /** The synthetic hosts cannot reach the real cap under the runtime's slot budget, so the over-cap tests use a lower one. */
  const CAP = 16;
  const visibleOverlays = (scene: Scene) => {
    let count = 0; scene.traverse(node => { if ((node as SkinnedMesh).isSkinnedMesh && node.parent?.name === 'ltk-vfx' && node.visible) count++; }); return count;
  };
  it('runs with the measured fuse by default', () => {
    const runtime = createLtkRuntime(createVfxLibrary('/root/', { readJson: async () => syntheticIndex(), readTexture: async () => new Texture() }), new Scene(), () => undefined);
    expect(runtime.attachedStats.layerCap).toBe(ATTACHED_LAYER_CAP); runtime.dispose();
  });
  it(`keeps at most the cap of overlays on screen and counts the cap`, async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new Scene();
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(attached()), readTexture: async () => new Texture() });
    const hosts = new Map(Array.from({ length: 6 }, (_, at) => {
      const root = new Group(), body = new Group(); root.add(body); body.add(part('body')); return [`u${at}` as string, { root, body, alive: true }] as const;
    }));
    const runtime = createLtkRuntime(library, scene, id => hosts.get(id), { layerCap: CAP });
    await runtime.warm('jinx');
    for (const id of hosts.keys()) expect(runtime.play('jinx', id, [], 'cast')).toBe(true);
    runtime.update(0.2, new Camera()); runtime.update(0.05, new Camera());
    expect(runtime.attachedStats.peakLayers).toBeGreaterThan(CAP);
    expect(visibleOverlays(scene)).toBe(CAP);
    expect(runtime.attachedStats.capEvents).toBe(1); expect(runtime.attachedStats.cappedFrames).toBe(2);
    expect(warn.mock.calls.filter(([line]) => String(line).startsWith('vfx-ltk:attached-cap:'))).toEqual([[`vfx-ltk:attached-cap:${runtime.attachedStats.peakLayers}>${CAP}`]]);
    runtime.dispose(); library.dispose();
  });
  it.each([[2, 7, 0], [6, 3, 1]] as const)('counts a layer once over all %i hosts\' %i skinned parts and keeps or hides it whole (cap trips %i times)', async (count, partCount, trips) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new Scene();
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(attached()), readTexture: async () => new Texture() });
    const hosts = new Map(Array.from({ length: count }, (_, at) => {
      const root = new Group(), body = new Group(); root.add(body); for (let p = 0; p < partCount; p++) body.add(part(`part${p}`));
      return [`u${at}` as string, { root, body, alive: true }] as const;
    }));
    const runtime = createLtkRuntime(library, scene, id => hosts.get(id), { layerCap: CAP });
    await runtime.warm('jinx');
    for (const id of hosts.keys()) runtime.play('jinx', id, [], 'cast');
    runtime.update(0.2, new Camera());
    const layers = Math.min(runtime.attachedStats.peakLayers, CAP); expect(layers).toBeGreaterThan(count - 1);
    expect(visibleOverlays(scene)).toBe(layers * partCount);
    expect(runtime.attachedStats.capEvents).toBe(trips);
    runtime.dispose(); library.dispose();
  });
  it('hides every overlay while the host switches them off (reduced motion, ?skillfx=off)', async () => {
    const scene = new Scene(); let on = false;
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(attached()), readTexture: async () => new Texture() });
    const root = new Group(), body = new Group(); root.add(body); body.add(part('body'));
    const runtime = createLtkRuntime(library, scene, () => ({ root, body, alive: true }), { attachedLayers: () => on });
    await runtime.warm('jinx'); runtime.play('jinx', 'u', [], 'cast');
    runtime.update(0.2, new Camera()); expect(visibleOverlays(scene)).toBe(0);
    on = true; runtime.update(0.05, new Camera()); expect(visibleOverlays(scene)).toBeGreaterThan(0);
    runtime.dispose(); library.dispose();
  });

  async function oneHost(cue: Record<string, unknown>) {
    const scene = new Scene();
    const index = { ...syntheticIndex(), skills: { jinx: [{ system: 'sample', action: 'cast', event: 'cast-start', delay: 0, duration: 10, ...cue }] } };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : syntheticSystem(attached()), readTexture: async () => new Texture() });
    const root = new Group(), body = new Group(); root.add(body); body.add(part('body'));
    const runtime = createLtkRuntime(library, scene, () => ({ root, body, alive: true }));
    await runtime.warm('jinx');
    return { scene, runtime, library };
  }
  const systems = (scene: Scene) => scene.children.filter(node => node.name === 'ltk-vfx').length;
  it.each([[true, 1], [false, 2]] as const)('a recast with refresh=%s leaves %i body layer(s) of the same system', async (refresh, layers) => {
    const { scene, runtime, library } = await oneHost(refresh ? { refresh: true } : {});
    runtime.play('jinx', 'u', [], 'cast'); runtime.update(0.2, new Camera());
    runtime.play('jinx', 'u', [], 'cast'); runtime.update(0.2, new Camera());
    expect(runtime.active).toBe(layers); expect(systems(scene)).toBe(layers);
    runtime.dispose(); library.dispose();
  });
  it('takes the body overlays off at once when the unit dies or leaves, though the system tail may linger', async () => {
    const { scene, runtime, library } = await oneHost({ refresh: true });
    runtime.play('jinx', 'u', [], 'cast'); runtime.update(0.2, new Camera());
    expect(visibleOverlays(scene)).toBeGreaterThan(0);
    runtime.stopUnit('u'); expect(visibleOverlays(scene)).toBe(0);
    runtime.update(0.05, new Camera()); expect(visibleOverlays(scene)).toBe(0);
    runtime.dispose(); library.dispose();
  });
});
