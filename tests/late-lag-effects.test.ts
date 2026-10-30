import { Camera, Group, Mesh, Scene, ShaderMaterial, Texture, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { admitEffect } from '../src/rendering/three-mode/effect-budget';
import { createRenataMissile } from '../src/rendering/three-mode/renata-missile';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, MAX_LTK_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

describe('late-game effect budget', () => {
  it('keeps a free slot, refuses a decorative newcomer when full, and evicts the earliest flourish for a hit', () => {
    expect(admitEffect(['decorative', 'critical'], 'critical', false)).toEqual({ admit: true, evict: -1 });
    expect(admitEffect(['critical', 'critical'], 'decorative', true)).toEqual({ admit: false, evict: -1 });
    expect(admitEffect(['critical', 'decorative', 'critical'], 'critical', true)).toEqual({ admit: true, evict: 1 });
    expect(admitEffect(['critical', 'critical'], 'critical', true)).toEqual({ admit: false, evict: -1 });
  });

  it('rearms a missile onto a new flight without disposing its material', () => {
    const from = new Vector3(0, 1, 0), to = new Vector3(10, 1, 0);
    const fx = createRenataMissile(from, to, 34);
    const material = vi.spyOn((fx.object.children[0] as Mesh<import('three').PlaneGeometry, ShaderMaterial>).material, 'dispose');
    fx.update(.6);
    expect(fx.finished).toBe(true);
    fx.rearm(new Vector3(2, 1, 2), new Vector3(8, 1, 4));
    expect(fx.finished).toBe(false);
    expect(fx.object.position.x).toBeCloseTo(2);
    expect(fx.object.position.z).toBeCloseTo(2);
    fx.dispose(); fx.dispose();
    expect(material).toHaveBeenCalledTimes(1);
  });

  it('reuses one finished flourish and drops another so a hit still appears', async () => {
    const skills = {
      jinx: [{ system: 'deco', event: 'cast-start' as const, delay: 0, duration: 5 }],
      vi: [{ system: 'blow', event: 'hit' as const, delay: 0, duration: 1 }],
    };
    const library = createVfxLibrary('/root/', {
      readJson: async url => url.endsWith('index.json')
        ? { version: 1, systems: { deco: 'systems/deco.json', blow: 'systems/blow.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills }
        : syntheticSystem(),
      readTexture: async () => new Texture(),
    });
    await library.load('deco'); await library.load('blow');
    const scene = new Scene();
    const units = new Map<string, { root: Group; body: null; alive: boolean }>();
    const find = (id: string) => {
      let unit = units.get(id);
      if (!unit) { unit = { root: new Group(), body: null, alive: true }; units.set(id, unit); }
      return unit;
    };
    const budget = { live: 0, max: 100000 };
    const runtime = createLtkRuntime(library, scene, find, { budget });
    const camera = new Camera();
    expect(runtime.play('jinx', 'caster-0', [])).toBe(true);
    runtime.update(0.01, camera);
    const first = scene.children[0];
    runtime.update(5, camera);
    expect(scene.children).toHaveLength(0);
    expect(runtime.play('jinx', 'caster-0', [])).toBe(true);
    runtime.update(0.01, camera);
    expect(scene.children[0]).toBe(first);
    runtime.update(5, camera);
    for (let i = 0; i < MAX_LTK_SYSTEMS; i++) expect(runtime.play('jinx', `caster-${i}`, [])).toBe(true);
    runtime.update(0.01, camera);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
    expect(runtime.play('vi', 'caster-0', ['victim'])).toBe(true);
    runtime.update(0.01, camera);
    const names = scene.children.map(object => object.userData.ltkSystem);
    expect(names.filter(name => name === 'blow')).toHaveLength(1);
    expect(names.filter(name => name === 'deco')).toHaveLength(MAX_LTK_SYSTEMS - 1);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
    runtime.dispose();
    expect(budget.live).toBe(0);
    expect(scene.children).toHaveLength(0);
  });
});
