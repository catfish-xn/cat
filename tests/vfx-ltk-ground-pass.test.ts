import { AmbientLight, Bone, BoxGeometry, Camera, EqualStencilFunc, KeepStencilOp, NotEqualStencilFunc, ShaderMaterial, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Scene, SkinnedMesh, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createVfxPasses, floorDepthMaterial, playSurfaceOf } from '../src/rendering/three-mode/vfx-ltk/rendering/passes';
import { clipUnderPlay, clipsUnderPlay, createFloorSurvey, PLAY_SURFACE } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/playSurface';
import { BOARD_FALLBACK_REFERENCE, stencilStates } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/stencil';
import { FLOOR_LAYER, GROUND_LAYER, SCENE_LAYER } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/frame';
import { num, struct, syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';
import { createLtkParticles, unitAnchor, unitJoints } from '../src/rendering/three-mode/vfx-ltk/particles';
import type { VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';
import type { WebGLRenderer } from 'three';
describe('opt-in board ground pass', () => {
  it('accepts ground definitions only for a compatible host', async () => {
    const reader = { readJson: async (url: string) => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem({ isGroundLayer: { type: 'bool' as const, value: true } }),
      readTexture: async () => new Texture() };
    const normal = createVfxLibrary('/root/', reader), board = createVfxLibrary('/root/', reader, { groundPass: true });
    await expect(normal.load('sample')).rejects.toThrow('ground-layer');
    await expect(board.load('sample')).resolves.toMatchObject({ empty: false }); normal.dispose(); board.dispose();
  });
  it.each([false, true])('draws floor/grid then ground then characters; restores all state on failure=%s', fails => {
    const scene = new Scene(), camera = new Camera(); camera.layers.enable(2);
    const floor = new Group(), floorMesh = new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ transparent: true, opacity: .22 })); floor.add(floorMesh);
    const ground = new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ depthWrite: true })); ground.layers.set(GROUND_LAYER);
    const unit = new Mesh(new PlaneGeometry(), new MeshBasicMaterial()); scene.add(floor, ground, unit);
    const frames: { mask: number; floor: number; unit: number; depth: boolean; clear: boolean; override: string | null; cleared: number }[] = [];
    let cleared = 0;
    const gl = { autoClear: true, getRenderTarget: () => null, setRenderTarget() {}, clearDepth() { cleared++; }, render() {
      frames.push({ mask: camera.layers.mask, floor: floorMesh.layers.mask, unit: unit.layers.mask, depth: ground.material.depthTest, clear: this.autoClear,
        override: scene.overrideMaterial?.name ?? null, cleared });
      if (fails && camera.layers.isEnabled(GROUND_LAYER)) throw Error('context-lost');
    } };
    const passes = createVfxPasses(gl as unknown as WebGLRenderer, () => [floor]);
    if (fails) expect(() => passes.render(scene, camera, { early: false, late: false, soft: false })).toThrow('context-lost');
    else passes.render(scene, camera, { early: false, late: false, soft: false });
    // The floor in colour and depth; its depth cleared, then the floor again depth-only off the play surface (walls), then
    // the ground layer, then units and particles (11-14: the board plane no longer cuts a particle reaching below it).
    expect(frames[0]).toMatchObject({ mask: 1 << FLOOR_LAYER, floor: 1 << FLOOR_LAYER, unit: 1 << SCENE_LAYER, clear: true, override: null, cleared: 0 });
    expect(frames[1]).toMatchObject({ mask: 1 << FLOOR_LAYER, clear: false, override: 'vfx-floor-depth', cleared: 1 });
    expect(frames[2]).toMatchObject({ mask: 1 << GROUND_LAYER, depth: true, clear: false, override: null });
    if (!fails) expect(frames[3].mask & (1 << SCENE_LAYER)).not.toBe(0);
    expect(scene.overrideMaterial).toBeNull();
    expect(floorMesh.layers.mask).toBe(1); expect(ground.material.depthTest).toBe(true); expect(ground.material.depthWrite).toBe(true);
    expect(ground.material.polygonOffset).toBe(false);
    expect(camera.layers.mask).toBe(5); expect(gl.autoClear).toBe(true);
    for (const mesh of [floorMesh,ground,unit]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  });
  it('skips skinned bone trees and still tags a nested light for the floor pass', () => {
    const scene = new Scene(), camera = new Camera(); camera.layers.enable(2);
    const floor = new Group(), bone = new Bone(), skin = new SkinnedMesh(new PlaneGeometry(), new MeshBasicMaterial());
    let boneVisits = 0;
    Object.defineProperty(bone, 'layers', { get() { boneVisits++; return { isEnabled: () => false, mask: 1, set() {}, enable() {} }; } });
    skin.add(bone); const unit = new Group(); unit.add(skin);
    const light = new AmbientLight(); const rig = new Group(); rig.add(light);
    const ground = new Mesh(new PlaneGeometry(), new MeshBasicMaterial()); ground.layers.set(GROUND_LAYER);
    scene.add(floor, unit, rig, ground);
    const seen: number[] = [];
    const gl = { autoClear: true, getRenderTarget: () => null, setRenderTarget() {}, clearDepth() {}, render() {
      if (camera.layers.isEnabled(FLOOR_LAYER)) seen.push(light.layers.mask);
    } };
    createVfxPasses(gl as unknown as WebGLRenderer, () => [floor]).render(scene, camera, { early: false, late: false, soft: false });
    // The floor pass and its depth-only redraw both see the light; it is restored after.
    expect(boneVisits).toBe(0); expect(seen).toEqual([1 | (1 << FLOOR_LAYER), 1 | (1 << FLOOR_LAYER)]); expect(light.layers.mask).toBe(1);
    skin.geometry.dispose(); (skin.material as MeshBasicMaterial).dispose(); ground.geometry.dispose(); ground.material.dispose();
  });

  // 11-14: the floor is drawn first even with no ground-layer particle, and only its walls (off the play surface, 11-15) keep
  // depth: a particle reaching below the board is not cut by it, while units drawn after still write and test depth.
  it('draws the floor first and keeps only its depth off the play surface, with or without ground particles; units after', () => {
    const scene = new Scene(), camera = new Camera(); camera.layers.enable(2);
    const floor = new Group(), floorMesh = new Mesh(new PlaneGeometry(), new MeshBasicMaterial()); floor.add(floorMesh);
    const unit = new Mesh(new PlaneGeometry(), new MeshBasicMaterial()); scene.add(floor, unit);
    const calls: string[] = [];
    const gl = { autoClear: true, getRenderTarget: () => null, setRenderTarget() {}, clearDepth() { calls.push('clearDepth'); }, render() {
      calls.push(`${camera.layers.isEnabled(FLOOR_LAYER) ? 'floor' : 'scene'}${scene.overrideMaterial ? ':' + scene.overrideMaterial.name : ''}`);
    } };
    createVfxPasses(gl as unknown as WebGLRenderer, () => [floor]).render(scene, camera, { early: false, late: false, soft: false });
    expect(calls).toEqual(['floor', 'clearDepth', 'floor:vfx-floor-depth', 'scene']);
    // Units keep their own depth: their material is never overridden and still tests and writes depth.
    expect(unit.material.depthTest).toBe(true); expect(unit.material.depthWrite).toBe(true);
    for (const mesh of [floorMesh, unit]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  });

  // 11-15: the play surface is the floor's flat meshes (no height); a wall or ledge, however low, is not part of it (Viktor's
  // storm darkened the board's front ledge, under 5 units high, when the floor kept depth only above a fitted height).
  it('the play surface is the footprint and height of the floor\'s flat depth-writing meshes; walls, ledges and overlays are not', () => {
    const floor = new Group();
    const plane = new Mesh(new PlaneGeometry(400, 300).rotateX(-Math.PI / 2), new MeshBasicMaterial()); plane.position.set(10, 0, 20);
    const ledge = new Mesh(new BoxGeometry(400, 4, 20), new MeshBasicMaterial()); ledge.position.set(10, 1, 190);
    const overlay = new Mesh(new PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new MeshBasicMaterial({ transparent: true, depthWrite: false }));
    floor.add(plane, ledge, overlay); floor.updateMatrixWorld(true);
    const play = playSurfaceOf([floor])!;
    expect(play.minX).toBeCloseTo(-190); expect(play.maxX).toBeCloseTo(210); expect(play.minZ).toBeCloseTo(-130); expect(play.maxZ).toBeCloseTo(170);
    expect(play.y).toBeCloseTo(0);
    expect(playSurfaceOf([ledge])).toBeNull();
    for (const mesh of [plane, ledge, overlay]) { mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); }
  });

  it('the floor depth material writes no colour and leaves out only fragments on or under the play surface inside its footprint', () => {
    const material = floorDepthMaterial();
    expect(material.colorWrite).toBe(false);
    const shader = { vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}', fragmentShader: '#include <common>\nvoid main() {\n}', uniforms: {} as Record<string, unknown> };
    material.onBeforeCompile(shader as any, undefined as any);
    expect(shader.vertexShader).toContain('vPlayWorld = (modelMatrix * floorWorld).xyz;');
    expect(shader.vertexShader).toContain('instanceMatrix * floorWorld');
    expect(shader.fragmentShader).toContain('vPlayWorld.x >= vfxPlaySurface.x && vPlayWorld.x <= vfxPlaySurface.y && vPlayWorld.z >= vfxPlaySurface.z && vPlayWorld.z <= vfxPlaySurface.w && vPlayWorld.y <= vfxPlayPlane');
    expect(shader.uniforms.vfxPlaySurface).toBe(PLAY_SURFACE.surface); expect(shader.uniforms.vfxPlayPlane).toBe(PLAY_SURFACE.plane);
    material.dispose();
  });

  it('the pass sets the play surface from the floor and hides floor meshes that write no depth during the depth-only redraw', () => {
    const scene = new Scene(), camera = new Camera(); camera.layers.enable(2);
    const floor = new Group(), plane = new Mesh(new PlaneGeometry(200, 100).rotateX(-Math.PI / 2), new MeshBasicMaterial());
    const overlay = new Mesh(new PlaneGeometry(50, 50), new MeshBasicMaterial({ transparent: true, depthWrite: false })); overlay.position.y = 1;
    floor.add(plane, overlay); scene.add(floor);
    const seen: { overlay: boolean; surface: number[] }[] = [];
    const gl = { autoClear: true, getRenderTarget: () => null, setRenderTarget() {}, clearDepth() {}, render() {
      if (scene.overrideMaterial?.name === 'vfx-floor-depth') seen.push({ overlay: overlay.visible, surface: PLAY_SURFACE.surface.value.toArray() });
    } };
    createVfxPasses(gl as unknown as WebGLRenderer, () => [floor]).render(scene, camera, { early: false, late: false, soft: false });
    expect(seen).toEqual([{ overlay: false, surface: [-100, 100, -50, 50] }]);
    expect(overlay.visible).toBe(true);
    // Without a floor the play surface is empty again: nothing is clipped.
    createVfxPasses(gl as unknown as WebGLRenderer).render(scene, camera, { early: false, late: false, soft: false });
    expect(PLAY_SURFACE.surface.value.x).toBeGreaterThan(PLAY_SURFACE.surface.value.y);
    for (const mesh of [plane, overlay]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  });

  // 11-15: the floor is surveyed once, not walked every frame; again only when a root's children change or a root moves.
  it('the floor survey is kept until a floor root gains or loses a child or moves', () => {
    const floor = new Group(), plane = new Mesh(new PlaneGeometry(100, 100).rotateX(-Math.PI / 2), new MeshBasicMaterial()); floor.add(plane);
    floor.updateMatrixWorld(true);
    const survey = createFloorSurvey(), first = survey.survey([floor]);
    expect(first.play).not.toBeNull(); expect(survey.survey([floor])).toBe(first);
    const overlay = new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ depthWrite: false })); floor.add(overlay);
    const second = survey.survey([floor]); expect(second).not.toBe(first); expect(second.quiet).toEqual([overlay]);
    floor.position.x = 10; floor.updateMatrixWorld(true);
    const third = survey.survey([floor]); expect(third).not.toBe(second); expect(third.play!.minX).toBeCloseTo(-40);
    for (const mesh of [plane, overlay]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  });

  // 11-15: a mesh, a ribbon or an arbitrary quad is clipped under the play surface (Garen's falling light column stopped at
  // the board); a camera-facing quad is not. Fitted, not the original's (playSurface.ts).
  it('clipUnderPlay wraps a material\'s main: notes the world position and discards strictly under the play surface', () => {
    const material = clipUnderPlay(new ShaderMaterial({ vertexShader: 'void main() {\n  gl_Position = vec4(0.0);\n}', fragmentShader: 'void main() {\n  gl_FragColor = vec4(1.0);\n}' }));
    expect(material.vertexShader).toContain('void vfxPlayMain()');
    expect(material.vertexShader).toContain('vPlayWorld = (inverse(viewMatrix) * playView).xyz;');
    expect(material.fragmentShader).toContain('vPlayWorld.y < vfxPlayPlane - 0.0010) discard;');
    expect(material.fragmentShader.indexOf('discard')).toBeLessThan(material.fragmentShader.lastIndexOf('vfxPlayMain();'));
    expect(material.uniforms.vfxPlaySurface).toBe(PLAY_SURFACE.surface);
    // Twice is once.
    const again = material.vertexShader; clipUnderPlay(material); expect(material.vertexShader).toBe(again);
    material.dispose();
  });

});

// 11-15: which particles are clipped under the play surface: a camera-facing quad and a ground-layer quad are not; an
// arbitrary quad is (as are meshes and ribbons, through the same clipUnderPlay call in their components).
describe('particles clipped under the play surface', () => {
  async function materialOf(fields: Record<string, VfxValue>, ground = false) {
    const index = syntheticIndex();
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? { ...index, assets: { ...index.assets, 'synthetic.scb': 'meshes/sample.ltkg' } } : syntheticSystem(fields),
      readTexture: async () => new Texture(), readMesh: async () => new BoxGeometry(1, 1, 1) }, ground ? { groundPass: true } : {});
    const system = await library.load('sample');
    const root = new Group(), body = new Group(); root.add(body);
    const fx = createLtkParticles(system, { anchor: unitAnchor(root, body), target: null, joints: unitJoints(root, body), duration: 1, seed: 1 });
    fx.update(0.05, new Camera());
    const shader = (fx.draws[0]!.object.material as ShaderMaterial).vertexShader;
    fx.dispose(); library.dispose();
    return shader;
  }
  it('a camera-facing quad is not clipped; an arbitrary quad is; a ground-layer quad is not', async () => {
    expect(await materialOf({})).not.toContain('vPlayWorld');
    expect(await materialOf({ primitive: struct('VfxPrimitiveArbitraryQuad', {}) })).toContain('vPlayWorld');
    expect(await materialOf({ primitive: struct('VfxPrimitiveArbitraryQuad', {}), isGroundLayer: { type: 'bool', value: true } }, true)).not.toContain('vPlayWorld');
  });
  // 11-15: Garen's R impact Shockwave1 is a mesh wholly under the board with its depth test off; it drew over the floor
  // before the floor stopped writing depth there and vanished once clipped. An emitter with the test off is never clipped.
  const mesh = { primitive: struct('VfxPrimitiveMesh', { mMesh: struct('VfxMeshDefinitionData', { mSimpleMeshName: { type: 'asset', path: 'synthetic.scb', asset: {} } as never }) }) };
  const depthOff = { miscRenderFlags: num(1) };
  it('a mesh is clipped; a mesh with its depth test off (DISABLE_ZBUFFER) is not', async () => {
    expect(await materialOf(mesh)).toContain('vPlayWorld');
    expect(await materialOf({ ...mesh, ...depthOff })).not.toContain('vPlayWorld');
  });
  it('an arbitrary quad with its depth test off is not clipped either; the other render-state bits change nothing', async () => {
    const quad = { primitive: struct('VfxPrimitiveArbitraryQuad', {}) };
    expect(await materialOf({ ...quad, ...depthOff })).not.toContain('vPlayWorld');
    expect(await materialOf({ ...quad, miscRenderFlags: num(6) })).toContain('vPlayWorld');
  });
  it('clipsUnderPlay: clipped unless a ground-layer draw or its depth test is off', () => {
    const of = (groundLayer: boolean, miscRenderFlags: number) => clipsUnderPlay({ groundLayer, miscRenderFlags, alphaRef: 0 } as never);
    expect([of(false, 0), of(false, 2), of(false, 4), of(false, 1), of(false, 5), of(true, 0)]).toEqual([true, true, true, false, false, false]);
  });
});

// 11-15: the board's play surface writes a stencil value no asset names (BOARD_FALLBACK_REFERENCE), and a TestEqual
// tester whose reference no live emitter writes is tested against it (fitted, not the original's): Viktor's R warning
// MAP_DISC_HIGH_WRITE draws on the board alone instead of untested over the whole screen.
describe('the board writes its stencil fallback', () => {
  const setup = () => {
    const scene = new Scene(), camera = new Camera(); camera.layers.enable(2);
    const floor = new Group(), plane = new Mesh(new PlaneGeometry(200, 100).rotateX(-Math.PI / 2), new MeshBasicMaterial());
    const wall = new Mesh(new BoxGeometry(200, 20, 10), new MeshBasicMaterial()); wall.position.z = 60;
    floor.add(plane, wall); scene.add(floor);
    const seen: { override: string | null; plane: boolean; wall: boolean }[] = [];
    const gl = { autoClear: true, getRenderTarget: () => null, setRenderTarget() {}, clearDepth() {}, render() {
      if (camera.layers.isEnabled(FLOOR_LAYER)) seen.push({ override: scene.overrideMaterial?.name ?? null, plane: plane.visible, wall: wall.visible });
    } };
    const dispose = () => { for (const mesh of [plane, wall]) { mesh.geometry.dispose(); mesh.material.dispose(); } };
    return { scene, camera, floor, plane, wall, seen, gl: gl as unknown as WebGLRenderer, dispose };
  };
  it('draws the play surface alone, stencil only, after the depth-only redraw, and keeps what it wrote on its own passes', () => {
    const { scene, camera, floor, wall, seen, gl, dispose } = setup();
    const passes = createVfxPasses(gl, () => [floor]), other = createVfxPasses(gl, () => [new Group()]);
    passes.render(scene, camera, { early: false, late: false, soft: false });
    expect(seen).toEqual([{ override: null, plane: true, wall: true }, { override: 'vfx-floor-depth', plane: true, wall: true },
      { override: 'vfx-board-stencil', plane: true, wall: false }]);
    expect(wall.visible).toBe(true); expect(scene.overrideMaterial).toBeNull();
    expect([...passes.board]).toEqual([BOARD_FALLBACK_REFERENCE]);
    // Another renderer's passes (a second canvas) keep their own set: drawing one with no play surface leaves this one's.
    other.render(scene, camera, { early: false, late: false, soft: false });
    expect(other.board.size).toBe(0); expect([...passes.board]).toEqual([BOARD_FALLBACK_REFERENCE]);
    dispose();
  });

  it('the set is what the runtime reads between frames: written by a render, cleared and written again by the next', () => {
    const { scene, camera, floor, plane, gl, dispose } = setup();
    const passes = createVfxPasses(gl, () => [floor]);
    expect(passes.board.size).toBe(0);
    passes.render(scene, camera, { early: false, late: false, soft: false });
    expect(passes.board.has(BOARD_FALLBACK_REFERENCE)).toBe(true);
    plane.visible = false; floor.add(new Group()); // a changed floor with no play surface
    passes.render(scene, camera, { early: false, late: false, soft: false });
    expect(passes.board.size).toBe(0);
    dispose();
  });

  it('only a TestEqual tester with no live writer of its reference falls back to the board value', () => {
    const tester = (ref: number, mode: 2 | 3 = 2) => ({ use: { mode, ref, id: null }, live: true });
    const writer = (ref: number) => ({ use: { mode: 1 as const, ref, id: null }, live: true });
    const board = new Set([BOARD_FALLBACK_REFERENCE]);
    // No board: untested, as before.
    expect(stencilStates([tester(4)])[0]!.stencilWrite).toBe(false);
    // Board written: tested against the board value.
    expect(stencilStates([tester(4)], board)[0]).toMatchObject({ stencilWrite: true, stencilFunc: EqualStencilFunc, stencilRef: BOARD_FALLBACK_REFERENCE, stencilZPass: KeepStencilOp });
    // A live writer of its own reference: tested against that, the board is not used.
    expect(stencilStates([writer(4), tester(4)], board)[1]).toMatchObject({ stencilFunc: EqualStencilFunc, stencilRef: 4 });
    // A TestNotEqual tester and a reference of 0 never take the board value.
    expect(stencilStates([tester(4, 3)], board)[0]).toMatchObject({ stencilFunc: NotEqualStencilFunc, stencilRef: 4 });
    expect(stencilStates([tester(0)], board)[0]).toMatchObject({ stencilFunc: EqualStencilFunc, stencilRef: 0 });
    // A claim that names the board value itself turns the fallback off for the frame.
    expect(stencilStates([tester(BOARD_FALLBACK_REFERENCE), tester(4)], board)[1]!.stencilWrite).toBe(false);
  });
});
