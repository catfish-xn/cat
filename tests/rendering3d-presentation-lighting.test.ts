import { describe, expect, it, vi } from 'vitest';
import { Bone, Box3, BoxGeometry, DoubleSide, Group, InstancedMesh, Mesh, MeshStandardMaterial, Scene, Skeleton, SkinnedMesh, Sphere, Vector3 } from 'three';
import { createPresentationLighting, readQuality3d } from '../src/rendering/three-mode/presentation-lighting';

const piece = (team: 'player' | 'enemy' = 'player') => {
  const root = new Group(), body = new Group(), mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  body.add(mesh); root.add(body); root.position.set(10, 0, 20);
  return { root, body, mesh, target: new Vector3(10, 0, 20), alive: true, team };
};
const shellOf = (root: Group) => root.getObjectByName('render3d-hover-outline') as Mesh | undefined;

describe('3D presentation lighting', () => {
  it('defaults to balanced and recognizes all query quality settings', () => {
    expect(readQuality3d('')).toBe('balanced'); expect(readQuality3d('?quality3d=bogus')).toBe('balanced');
    for (const value of ['off', 'low', 'balanced', 'high'] as const) expect(readQuality3d(`?quality3d=${value}`)).toBe(value);
  });

  it.each(['off', 'low'] as const)('%s creates no shadows or hover meshes', quality => {
    const lighting = createPresentationLighting(new Scene(), quality), view = piece();
    lighting.update(view); lighting.hover(view);
    expect(lighting.group.children).toHaveLength(0); expect(shellOf(view.root)).toBeUndefined();
    expect(lighting.hemisphere.intensity).toBe(quality === 'off' ? 0 : 0.55);
    lighting.dispose();
  });

  it('shares a soft alpha map, tracks board and bench heights, and hides contacts with dead/hidden units', () => {
    const scene = new Scene(), lighting = createPresentationLighting(scene, 'balanced'), a = piece(), b = piece();
    b.target.y = b.root.position.y = 12;
    lighting.update(a); lighting.update(b);
    const [first, second] = lighting.group.children as Mesh[];
    expect(first!.geometry).toBe(second!.geometry); expect(first!.material).toBe(second!.material);
    const material = first!.material as import('three').MeshBasicMaterial;
    expect(material.depthWrite).toBe(false); expect(material.map!.image.width).toBe(32);
    expect(first!.position.toArray()).toEqual([10, 1.5, 20]); expect(second!.position.y).toBe(13.5);
    a.root.position.y = 60; lighting.update(a); expect(first!.scale.x).toBeLessThan(second!.scale.x);
    a.alive = false; b.root.visible = false; lighting.update(a); lighting.update(b);
    expect(first!.visible).toBe(false); expect(second!.visible).toBe(false);
    lighting.remove(a.root); expect(lighting.group.children).toHaveLength(1);
    const disposeGeometry = vi.spyOn(first!.geometry, 'dispose'), disposeTexture = vi.spyOn(material.map!, 'dispose');
    lighting.dispose(); lighting.dispose();
    expect(scene.children).toHaveLength(0); expect(disposeGeometry).toHaveBeenCalledTimes(1); expect(disposeTexture).toHaveBeenCalledTimes(1);
  });

  it('outlines only the hovered body in its team color and replaces a late-arriving model without touching owned materials', () => {
    const lighting = createPresentationLighting(new Scene(), 'balanced'), a = piece(), b = piece('enemy');
    const originalMaterial = a.mesh.material, originalGeometry = a.mesh.geometry;
    const disposeMaterial = vi.spyOn(originalMaterial, 'dispose'), disposeGeometry = vi.spyOn(originalGeometry, 'dispose');
    lighting.registerBody(a.body); lighting.registerBody(b.body);
    lighting.resize(800, 600); lighting.hover(a);
    expect(shellOf(a.root)!.geometry).toBe(originalGeometry); expect(shellOf(b.root)).toBeUndefined();
    expect((shellOf(a.root)!.material as MeshStandardMaterial).emissive.getHexString()).toBe('3d8fd1');
    lighting.hover(b);
    expect(shellOf(a.root)).toBeUndefined(); expect((shellOf(b.root)!.material as MeshStandardMaterial).emissive.getHexString()).toBe('d1504a');
    const late = piece('enemy'); b.body.removeFromParent(); b.body = late.body; b.root.add(b.body); lighting.registerBody(b.body); lighting.update(b);
    expect(shellOf(late.root)).toBeUndefined(); expect(shellOf(b.root)).toBeDefined();
    lighting.hover(null); expect(shellOf(b.root)).toBeUndefined();
    lighting.hover(a); a.alive = false; lighting.update(a); expect(shellOf(a.root)).toBeUndefined();
    lighting.dispose();
    expect(a.mesh.material).toBe(originalMaterial); expect(disposeMaterial).not.toHaveBeenCalled(); expect(disposeGeometry).not.toHaveBeenCalled();
  });

  it('uses the original live skeleton and morph weights, with a bounded screen-space expansion shader', () => {
    const lighting = createPresentationLighting(new Scene(), 'high'), view = piece(); view.body.clear();
    const skinned = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial()), bone = new Bone();
    skinned.add(bone); skinned.bind(new Skeleton([bone])); skinned.morphTargetInfluences = [0.2]; view.body.add(skinned);
    lighting.registerBody(view.body);
    lighting.resize(1440, 900); lighting.hover(view);
    const shell = shellOf(view.root) as SkinnedMesh;
    expect(shell.skeleton).toBe(skinned.skeleton); expect(shell.bindMatrix).toEqual(skinned.bindMatrix);
    expect(shell.morphTargetInfluences).toBe(skinned.morphTargetInfluences);
    const shader = { uniforms: {}, vertexShader: '#include <project_vertex>' };
    (shell.material as MeshStandardMaterial).onBeforeCompile(shader as never, {} as never);
    expect(shader.vertexShader).toContain('3.0 * 2.0 / outlineResolution');
    expect((shader.uniforms as { outlineResolution: { value: { x: number; y: number } } }).outlineResolution.value).toMatchObject({ x: 1440, y: 900 });
    const skeletonDispose = vi.spyOn(skinned.skeleton, 'dispose');
    lighting.remove(view.root); expect(shellOf(view.root)).toBeUndefined(); lighting.dispose(); expect(skeletonDispose).not.toHaveBeenCalled();
  });

  it.each(['transparent', 'alphaTest', 'doubleSide'] as const)('skips %s materials, including mixed-material meshes, while keeping opaque model outlines', kind => {
    const lighting = createPresentationLighting(new Scene(), 'balanced'), view = piece();
    const unsafe = new MeshStandardMaterial(kind === 'transparent' ? { transparent: true }
      : kind === 'alphaTest' ? { alphaTest: 0.5 } : { side: DoubleSide });
    const single = new Mesh(new BoxGeometry(), unsafe);
    const mixed = new Mesh(new BoxGeometry(), [new MeshStandardMaterial(), unsafe]);
    view.body.add(single, mixed); lighting.registerBody(view.body); lighting.hover(view);
    expect(single.children).toHaveLength(0); expect(mixed.children).toHaveLength(0);
    expect(view.mesh.children).toHaveLength(1); expect(shellOf(view.root)!.parent).toBe(view.mesh);
    lighting.dispose();
  });

  it('excludes instanced meshes and later bone-attached effects even before the first hover', () => {
    const lighting = createPresentationLighting(new Scene(), 'balanced'), view = piece(), bone = new Bone();
    const instances = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 2);
    view.mesh.add(bone); view.body.add(instances); lighting.registerBody(view.body);
    // Both opaque ordinary meshes and instanced emitters can be runtime effects under a model bone.
    const effects = new Group(), effect = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const emitter = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 3);
    effects.add(effect, emitter); bone.add(effects);
    lighting.registerBody(view.body); // repeated registration must not promote effects into model meshes
    lighting.hover(view);
    expect(instances.children).toHaveLength(0); expect(effect.children).toHaveLength(0); expect(emitter.children).toHaveLength(0);
    expect(view.mesh.children.filter(child => child.name === 'render3d-hover-outline')).toHaveLength(1);
    lighting.hover(null); lighting.hover(view); lighting.update(view);
    const shells: Mesh[] = [];
    view.body.traverse(node => { if (node.name === 'render3d-hover-outline') shells.push(node as Mesh); });
    expect(shells).toHaveLength(1); expect(shells[0]!.parent).toBe(view.mesh);
    lighting.dispose();
  });

  it.each([true, false])('borrows the skinned source bounds and frustumCulled=%s', frustumCulled => {
    const lighting = createPresentationLighting(new Scene(), 'balanced'), view = piece(); view.body.clear();
    const source = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial()), bone = new Bone();
    source.add(bone); source.bind(new Skeleton([bone]));
    source.boundingBox = new Box3(new Vector3(-20, -30, -40), new Vector3(20, 30, 40));
    source.boundingSphere = new Sphere(new Vector3(1, 2, 3), 50); source.frustumCulled = frustumCulled;
    view.body.add(source); lighting.registerBody(view.body); lighting.hover(view);
    const shell = shellOf(view.root) as SkinnedMesh;
    expect(shell.isSkinnedMesh).toBe(true); expect(shell.boundingBox).toBe(source.boundingBox);
    expect(shell.boundingSphere).toBe(source.boundingSphere); expect(shell.frustumCulled).toBe(frustumCulled);
    source.boundingBox.expandByScalar(10); source.boundingSphere.radius = 75;
    lighting.update(view);
    expect(shell.boundingBox!.max.toArray()).toEqual([30, 40, 50]); expect(shell.boundingSphere!.radius).toBe(75);
    lighting.dispose();
  });

  it('copies prebuilt team colors without parsing strings during hover updates', () => {
    const lighting = createPresentationLighting(new Scene(), 'balanced'), view = piece();
    lighting.registerBody(view.body); lighting.hover(view);
    const emissive = (shellOf(view.root)!.material as MeshStandardMaterial).emissive;
    const setStyle = vi.spyOn(emissive, 'setStyle');
    for (let i = 0; i < 10; i++) lighting.update(view);
    view.team = 'enemy'; lighting.update(view);
    expect(emissive.getHexString()).toBe('d1504a'); expect(setStyle).not.toHaveBeenCalled();
    setStyle.mockRestore(); lighting.dispose();
  });

  it('ignores hover after disposal and never attaches shells using disposed resources', () => {
    const scene = new Scene(), lighting = createPresentationLighting(scene, 'balanced'), view = piece();
    lighting.registerBody(view.body); lighting.hover(view); expect(shellOf(view.root)).toBeDefined();
    lighting.dispose(); lighting.hover(view); lighting.update(view); lighting.hover(null);
    expect(shellOf(view.root)).toBeUndefined(); expect(scene.children).toHaveLength(0);
  });
});
