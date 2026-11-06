import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES, cueOverride } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { createVfxLibrary, parseIndex, withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, FX_SCALE, unitAnchor, unitJoints } from '../src/rendering/three-mode/vfx-ltk/particles';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { AXIS_SIGN } from '../src/rendering/three-mode/vfx-ltk/space';
import { mapSkillTimeline, type TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';

describe('reviewed vfx-ltk cue overrides', () => {
  const exported: TimelineCue[] = [{ system: 'aa', action: 'cast', event: 'hit', delay: 0.8, duration: 1 }];
  const fixed: TimelineCue[] = [{ system: 'bb', action: 'cast', event: 'cast-start', delay: 0.2, duration: 0.6 }];
  const index = (systems: Record<string, string>) => ({ version: 1, systems, assets: {}, skills: { probe: exported } });

  it('replaces a champion\'s exported list only when every overriding system was exported', () => {
    (CUE_OVERRIDES as Record<string, readonly TimelineCue[]>).probe = fixed;
    try {
      expect(withCueOverrides(parseIndex(index({ aa: 'aa.json', bb: 'bb.json' }))).skills.probe).toEqual(fixed);
      expect(withCueOverrides(parseIndex(index({ aa: 'aa.json' }))).skills.probe).toEqual(exported);
      // parseIndex itself returns the exported timeline untouched.
      expect(parseIndex(index({ aa: 'aa.json', bb: 'bb.json' })).skills.probe).toEqual(exported);
      expect(cueOverride('probe', { aa: 'x' })).toBeUndefined();
    } finally { delete (CUE_OVERRIDES as Record<string, readonly TimelineCue[]>).probe; }
  });

  it('every shipped override is a well-formed timeline', () => {
    for (const [champion, cues] of Object.entries(CUE_OVERRIDES)) {
      const systems = Object.fromEntries(cues.map(cue => [cue.system, `${cue.system}.json`]));
      expect(() => parseIndex({ version: 1, systems, assets: {}, skills: { [champion]: cues } }), champion).not.toThrow();
    }
    expect(CUE_OVERRIDES.garen.find(cue => cue.system === '5bbccb8c')?.scale).toBe(0.45);
    expect(CUE_OVERRIDES.vex.find(cue => cue.system === '8682c9ee')?.scale).toBe(0.68);
    expect(CUE_OVERRIDES.vex.find(cue => cue.system === 'eb9da1d5')?.scale).toBe(0.68);
    expect(CUE_OVERRIDES.vex.find(cue => cue.system === 'c4da788c')?.scale).toBeUndefined();
    // 11-06 field review: the cloud holds 3 s, then the burst (0.5, about 2.9 cells) and each target's splash.
    expect(CUE_OVERRIDES.nunu.find(cue => cue.system === '8c256426')?.scale).toBe(0.5);
    expect(CUE_OVERRIDES.nunu.find(cue => cue.system === '8c256426')?.delay).toBe(3);
    expect(CUE_OVERRIDES.nunu.find(cue => cue.system === '78d04f27')?.duration).toBeGreaterThanOrEqual(3);
    expect(CUE_OVERRIDES.nunu.find(cue => cue.system === '5dfd387b')?.delay).toBeGreaterThanOrEqual(3);
    expect(CUE_OVERRIDES.nunu.find(cue => cue.system === '5dfd387b')?.scale).toBe(0.7);
    // Ezreal: W's orb and ring on the primary before Q's shot; both missiles aim at a target bone.
    const ezreal = CUE_OVERRIDES.ezreal.filter(cue => cue.action === 'cast');
    expect(ezreal.filter(cue => cue.event === 'projectile').every(cue => cue.targetBone)).toBe(true);
    expect(ezreal.find(cue => cue.system === 'd887e7a6')?.primary).toBe(true);
    expect(ezreal.find(cue => cue.system === 'd887e7a6')!.delay).toBeLessThan(ezreal.find(cue => cue.system === 'e4979a04')!.delay);
    // Irelia: the swipe waits for the guard's end; Darius: the hit spark is optional.
    expect(CUE_OVERRIDES.irelia.find(cue => cue.system === '08b7a939')?.delay).toBeGreaterThanOrEqual(1.4);
    expect(CUE_OVERRIDES.darius.find(cue => cue.system === 'a5373796')?.optional).toBe(true);
    // Morgana: the curse stays on its one target for the 8 pulses.
    expect(CUE_OVERRIDES.morgana.find(cue => cue.system === '7fb1a74c')?.duration).toBeGreaterThanOrEqual(8);
    // Renata: the export has no cast timeline; the override flies the missile before the blast and keeps the attack.
    const renata = CUE_OVERRIDES.renata;
    expect(renata.filter(cue => cue.action === 'attack').map(cue => cue.system)).toEqual(['06e90178', '0f2af66b']);
    const missile = renata.find(cue => cue.system === 'faf1aeac')!;
    expect(missile.event).toBe('projectile');
    expect(missile.delay + missile.travelSeconds!).toBeLessThanOrEqual(renata.find(cue => cue.system === 'f9926ae8')!.delay);
    expect(mapSkillTimeline(renata.filter(cue => cue.action === 'cast'), 'renata', ['a', 'b']).unsupported).toEqual([]);
  });

  it('parses a cue scale and rejects values outside 0.05–5', () => {
    const systems = { aa: 'aa.json' };
    const cue = { system: 'aa', event: 'hit' as const, delay: 0, duration: 1, scale: 0.45 };
    const parsed = parseIndex({ version: 1, systems, assets: {}, skills: { probe: [cue] } });
    expect(parsed.skills.probe).toEqual([cue]);
    expect(mapSkillTimeline(parsed.skills.probe ?? [], 's', ['t']).spawns[0]?.scale).toBe(0.45);
    for (const scale of [0, -1, 0.04, 5.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => parseIndex({ version: 1, systems, assets: {}, skills: { probe: [{ ...cue, scale }] } }), String(scale)).toThrow('timeline-cue');
    }
    for (const scale of [0.05, 1, 5]) {
      expect(parseIndex({ version: 1, systems, assets: {}, skills: { probe: [{ ...cue, scale }] } }).skills.probe?.[0]?.scale).toBe(scale);
    }
  });

  it('scales particle size and offset about the anchor and leaves the anchor and flight put', async () => {
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(), readTexture: async () => new Texture() });
    const prepared = await library.load('sample');
    const root = new Group(); root.position.set(44, 22, 10);
    const camera = new Camera();
    const shared = { anchor: unitAnchor(root, null), target: null, joints: unitJoints(root, null), duration: 1, seed: 5 };
    const full = createLtkParticles(prepared, { ...shared, scale: 1 });
    const half = createLtkParticles(prepared, { ...shared, scale: 0.5 });
    for (let step = 0; step < 6; step++) { full.update(0.05, camera); half.update(0.05, camera); }
    expect(full.object.scale.x).toBe(FX_SCALE);
    expect(half.object.scale.x).toBe(FX_SCALE);
    expect(half.object.position.toArray()).toEqual(full.object.position.toArray());
    expect([...half.driver.origin]).toEqual([...full.driver.origin]);
    const world = (origin: readonly number[]) => origin.map((value, axis) => value * AXIS_SIGN[axis] * FX_SCALE);
    expect(world(full.driver.origin).map(value => Math.round(value * 1e6) / 1e6)).toEqual([44, 22, 10]);
    expect(half.driver.pool.count).toBe(full.driver.pool.count);
    expect(full.driver.pool.count).toBeGreaterThan(0);
    let moved = 0;
    for (let index = 0; index < full.driver.pool.count; index++) {
      for (let axis = 0; axis < 3; axis++) {
        const at = index * 3 + axis;
        expect(half.driver.pool.anchor[at]).toBeCloseTo(full.driver.pool.anchor[at], 5);
        expect(half.driver.pool.position[at]).toBeCloseTo(full.driver.pool.position[at] * 0.5, 4);
        expect(half.driver.pool.velocity[at]).toBeCloseTo(full.driver.pool.velocity[at] * 0.5, 4);
        expect(half.driver.pool.birthScale[at]).toBeCloseTo(full.driver.pool.birthScale[at] * 0.5, 5);
        moved = Math.max(moved, Math.abs(full.driver.pool.position[at]));
      }
    }
    expect(moved).toBeGreaterThan(0.5);
    const source = new Group(), target = new Group(); target.position.x = 44;
    const flight = { anchor: unitAnchor(source, null), target: unitAnchor(target, null), joints: unitJoints(source, null), duration: 1, projectileSeconds: 0.5, seed: 1 };
    const plain = createLtkParticles(prepared, { ...flight, scale: 1 });
    const small = createLtkParticles(prepared, { ...flight, scale: 0.45 });
    for (let step = 0; step < 11; step++) {
      plain.update(0.05, camera); small.update(0.05, camera);
      expect([...small.driver.origin]).toEqual([...plain.driver.origin]);
    }
    expect(plain.driver.origin[0]).toBeCloseTo(-100);
    expect(small.object.scale.x).toBe(FX_SCALE);
    full.dispose(); half.dispose(); plain.dispose(); small.dispose(); library.dispose();
  });

  it('does not reuse a parked system at a different scale', async () => {
    const scaled: TimelineCue[] = [
      { system: 'sample', event: 'cast-start', delay: 0, duration: 0.15, scale: 1 },
      { system: 'sample', event: 'cast-start', delay: 0.2, duration: 0.3, scale: 0.5 },
    ];
    const base = syntheticIndex();
    const index = { ...base, skills: { ...base.skills, jinx: scaled } };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : syntheticSystem(), readTexture: async () => new Texture() });
    await library.load('sample');
    const scene = new Scene(), camera = new Camera();
    const runtime = createLtkRuntime(library, scene, () => ({ root: new Group(), body: null, alive: true }));
    expect(runtime.play('jinx', 'caster', [])).toBe(true);
    runtime.update(0.05, camera);
    expect(scene.children).toHaveLength(1);
    const first = scene.children[0];
    expect(String(first.userData.poolKey)).toMatch(/\n1$/);
    runtime.update(0.12, camera);
    expect(runtime.active).toBe(0);
    runtime.update(0.05, camera);
    expect(scene.children).toHaveLength(1);
    const second = scene.children[0];
    expect(second).not.toBe(first);
    expect(String(second.userData.poolKey)).toMatch(/\n0\.5$/);
    expect(String(first.userData.poolKey)).not.toBe(String(second.userData.poolKey));
    runtime.dispose();
  });
});
