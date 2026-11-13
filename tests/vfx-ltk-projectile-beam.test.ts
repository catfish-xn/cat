import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, with the prepared system and options it was built with.
const built: { prepared: any; options: any; fx: any }[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => {
    const fx = real.createLtkParticles(prepared, options), entry = { prepared, options, fx };
    built.push(entry); const reuse = fx.reuse.bind(fx); fx.reuse = (next: unknown) => { entry.options = next; return reuse(next); };
    return fx;
  } };
});
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { beamSeconds, beamSplit, createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { UNPINNED_BEAM_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { FX_SCALE } from '../src/rendering/three-mode/vfx-ltk/particles';
import { AXIS_SIGN } from '../src/rendering/three-mode/vfx-ltk/space';
import { constant, num, struct, vec } from './vfx-ltk-synthetic';
import { nameHash } from '../src/rendering/three-mode/vfx-ltk/binHash';
import type { VfxSystem, VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';

const yes: VfxValue = { type: 'bool', value: true } as VfxValue;
const emitter = (name: string, fields: Record<string, VfxValue>) => struct('VfxEmitterDefinitionData', {
  emitterName: { type: 'string', value: name }, rate: constant(num(30)), lifetime: num(0.3), particleLifetime: constant(num(0.4)),
  birthScale0: constant(vec(4, 4, 4)), birthColor: constant(vec(1, 1, 1, 1)), texture: { type: 'asset', path: 'synthetic.tex', asset: null }, ...fields });
const beam = (name: string, life: number, fields: Record<string, VfxValue> = {}) => emitter(name, {
  rate: constant(num(1)), isSingleParticle: yes, lifetime: num(0.65), particleLifetime: constant(num(life)),
  primitive: struct('VfxPrimitiveBeam', { mBeam: struct('VfxBeamDefinitionData', {}) }), ...fields });
function system(items: VfxValue[]): VfxSystem {
  return { entry: nameHash('synthetic'), name: 'synthetic-only', classHash: nameHash('VfxSystemDefinitionData'), class: 'VfxSystemDefinitionData', materials: [],
    root: struct('VfxSystemDefinitionData', { complexEmitterDefinitionData: { type: 'container', items } }) };
}
const SYSTEMS: Record<string, VfxSystem> = {
  mixed: system([emitter('Trail', {}), beam('BeamA', 0.45), beam('BeamB', 0.9, { timeBeforeFirstEmission: num(0.05) })]),
  beams: system([beam('BeamA', 0.55)]),
  plain: system([emitter('Trail', {})]),
  // Same shape as `mixed`, under an id on the unpinned list.
  '7029bc3c': system([emitter('Trail', {}), beam('BeamA', 0.45)]),
  '92d79254': system([emitter('Trail', {}), beam('BeamA', 0.45)]),
};
const laser: TimelineCue = { system: 'mixed', action: 'attack', event: 'projectile', delay: 0, duration: 0.3, travelSeconds: 0.3, targetBone: 'chest' };
const index = (cues: readonly TimelineCue[]) => ({ version: 1, systems: Object.fromEntries(Object.keys(SYSTEMS).map(id => [id, `systems/${id}.json`])),
  assets: { 'synthetic.tex': 'texture.png' }, skills: { tester: cues } });
const toEngine = (p: { x: number; y: number; z: number }) => [p.x * AXIS_SIGN[0] / FX_SCALE, p.y / FX_SCALE, p.z / FX_SCALE];

async function setup(cues: readonly TimelineCue[]) {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index(cues) : SYSTEMS[url.split('/').pop()!.replace('.json', '')], readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map(['caster', 'target'].map((id, i) => {
    const root = new Group(); root.position.set(i * 200 + 5, 0, i * 90); scene.add(root); root.updateMatrixWorld();
    return [id, { root, body: null, alive: true }];
  }));
  const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
  await runtime.warm('tester');
  const catalog: any = await library.champion('tester');
  return { runtime, units, catalog };
}
const names = (prepared: any) => prepared.drawn.filter((d: any) => !d.emitter.disabled).map((d: any) => d.emitter.name);
const live = (prepared: any) => prepared.model.emitters.filter((e: any) => !e.disabled).map((e: any) => e.name);

describe('vfx-ltk projectile beams (beamSplit)', () => {
  it('splits a system into its beams and the rest, each side disabling the other; none for a system without beams', async () => {
    const { runtime, catalog } = await setup([laser]);
    const split = beamSplit(await catalog.load('mixed'))!;
    expect(names(split.beam)).toEqual(['BeamA', 'BeamB']);
    expect(live(split.beam)).toEqual(['BeamA', 'BeamB']);
    expect(names(split.flight)).toEqual(['Trail']);
    expect(live(split.flight)).toEqual(['Trail']);
    expect(beamSplit(await catalog.load('beams'))!.flight).toBeNull();
    expect(beamSplit(await catalog.load('plain'))).toBeNull();
    runtime.dispose();
  });

  it('reads how long the beams play from the asset: start plus particle life, the latest beam', async () => {
    const { runtime, catalog } = await setup([laser]);
    expect(beamSeconds(beamSplit(await catalog.load('mixed'))!.beam, 0.3)).toBeCloseTo(0.95, 6);
    expect(beamSeconds(beamSplit(await catalog.load('beams'))!.beam, 0.3)).toBeCloseTo(0.55, 6);
    runtime.dispose();
  });

  it('plays the flight as cued and the beams pinned from the caster to the target for their own life, together', async () => {
    const { runtime, units } = await setup([laser]);
    expect(runtime.play('tester', 'caster', ['target'], 'attack')).toBe(true);
    runtime.update(1 / 60, new Camera());
    expect(built).toHaveLength(2);
    const flight = built.find(b => names(b.prepared).includes('Trail'))!, pinned = built.find(b => names(b.prepared).includes('BeamA'))!;
    expect(names(flight.prepared)).toEqual(['Trail']);
    expect(flight.options).toMatchObject({ duration: 0.3, projectileSeconds: 0.3 });
    expect(names(pinned.prepared)).toEqual(['BeamA', 'BeamB']);
    expect(pinned.options.projectileSeconds).toBeUndefined();
    expect(pinned.options.duration).toBeCloseTo(0.95, 6);
    expect(pinned.options.stopAfter).toBeUndefined();
    // Pinned: the system stands on the caster and aims at the target where it stands now, not where it stood at launch.
    expect(pinned.options.anchor.originAt(0)).toEqual(toEngine(units.get('caster')!.root.position));
    units.get('target')!.root.position.set(260, 0, 140); units.get('target')!.root.updateMatrixWorld();
    expect(pinned.options.target.originAt(0)).toEqual(toEngine(units.get('target')!.root.position));
    // The beams outlive the landing; the flight does not.
    for (let f = 0; f < 30; f++) runtime.update(1 / 60, new Camera());
    expect(flight.fx.object.parent).toBeNull();
    expect(pinned.fx.object.parent).not.toBeNull();
    for (let f = 0; f < 30; f++) runtime.update(1 / 60, new Camera());
    expect(pinned.fx.object.parent).toBeNull();
    runtime.dispose();
  });

  it('a system of beams alone plays only the pinned run; a stationary cue and a beamless projectile are left as they were', async () => {
    let { runtime } = await setup([{ ...laser, system: 'beams' }]);
    runtime.play('tester', 'caster', ['target'], 'attack'); runtime.update(1 / 60, new Camera());
    expect(built.map(b => names(b.prepared))).toEqual([['BeamA']]);
    expect(built[0].options.projectileSeconds).toBeUndefined();
    runtime.dispose();
    ({ runtime } = await setup([{ ...laser, stationary: true }]));
    runtime.play('tester', 'caster', ['target'], 'attack'); runtime.update(1 / 60, new Camera());
    expect(built.map(b => names(b.prepared))).toEqual([['Trail', 'BeamA', 'BeamB']]);
    expect(built[0].options.duration).toBe(0.3);
    runtime.dispose();
    ({ runtime } = await setup([{ ...laser, system: 'plain' }]));
    runtime.play('tester', 'caster', ['target'], 'attack'); runtime.update(1 / 60, new Camera());
    expect(built.map(b => names(b.prepared))).toEqual([['Trail']]);
    expect(built[0].options).toMatchObject({ duration: 0.3, projectileSeconds: 0.3 });
    runtime.dispose();
  });
  it('a target that dies mid-beam: the beams play their own life out toward where it fell, the flight still stops', async () => {
    const { runtime, units } = await setup([laser]);
    runtime.play('tester', 'caster', ['target'], 'attack');
    for (let f = 0; f < 10; f++) runtime.update(1 / 60, new Camera());
    const flight = built.find(b => names(b.prepared).includes('Trail'))!, pinned = built.find(b => names(b.prepared).includes('BeamA'))!;
    const target = units.get('target')!, fell = toEngine(target.root.position);
    target.alive = false; runtime.stopUnit('target');
    target.root.position.set(900, 0, -400); target.root.updateMatrixWorld();
    runtime.update(1 / 60, new Camera());
    expect(pinned.options.target.originAt(0)).toEqual(fell);
    expect(pinned.fx.object.parent).not.toBeNull();
    expect(pinned.fx.driver.pool.count).toBeGreaterThan(0);
    for (let f = 0; f < 30; f++) runtime.update(1 / 60, new Camera());
    expect(flight.fx.object.parent).toBeNull();
    expect(pinned.fx.object.parent).not.toBeNull();
    expect(pinned.fx.driver.pool.count).toBeGreaterThan(0);
    for (let f = 0; f < 20; f++) runtime.update(1 / 60, new Camera());
    expect(pinned.fx.object.parent).toBeNull();
    runtime.dispose();
  });

  it('a caster that dies still ends its beams', async () => {
    const { runtime, units } = await setup([laser]);
    runtime.play('tester', 'caster', ['target'], 'attack');
    for (let f = 0; f < 10; f++) runtime.update(1 / 60, new Camera());
    const pinned = built.find(b => names(b.prepared).includes('BeamA'))!;
    units.get('caster')!.alive = false; runtime.stopUnit('caster');
    runtime.update(1 / 60, new Camera());
    expect(pinned.fx.driver.pool.count).toBe(0);
    runtime.dispose();
  });

  it('a system on the unpinned list flies whole as it was: Sevika\'s chomp and Jayce\'s back-form forge', async () => {
    expect(Object.keys(UNPINNED_BEAM_SYSTEMS).sort()).toEqual(['7029bc3c', '92d79254']);
    for (const system of ['7029bc3c', '92d79254']) {
      const { runtime } = await setup([{ ...laser, system }]);
      runtime.play('tester', 'caster', ['target'], 'attack'); runtime.update(1 / 60, new Camera());
      expect(built.map(b => names(b.prepared))).toEqual([['Trail', 'BeamA']]);
      expect(built[0].options).toMatchObject({ duration: 0.3, projectileSeconds: 0.3 });
      runtime.dispose();
    }
  });
});
