import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

const options: any[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, opts: any) => { options.push(opts); return real.createLtkParticles(prepared, opts); } };
});
import { createVfxLibrary, parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { projectileFlight } from '../src/rendering/three-mode/vfx-ltk/particles';
import { MEL_BOLT_CURVE, mirrored, melSkills } from '../src/rendering/three-mode/vfx-ltk/champions/mel';
import { syntheticSystem } from './vfx-ltk-synthetic';

// Mel's plain-cast bolts fly a curve, not a straight line (11-24): out to one side mid-flight with a little lift, consecutive
// bolts to opposite sides. Only the path changes: the ends, the flight time and the one system per bolt stay as they were.
describe('Mel\'s curved bolts', () => {
  it('both bolt branches curve, one the mirror of the other, the same system and timing otherwise', () => {
    const [right] = melSkills['mel-bolt']!, [left] = melSkills['mel-bolt-alt']!;
    expect(right!.curve).toEqual(MEL_BOLT_CURVE);
    expect(left!.curve).toEqual(mirrored(MEL_BOLT_CURVE));
    expect(MEL_BOLT_CURVE.control1[0]).toBeGreaterThan(0); expect(mirrored(MEL_BOLT_CURVE).control1[0]).toBeLessThan(0);
    const { curve: _a, ...restRight } = right!, { curve: _b, ...restLeft } = left!;
    expect(restLeft).toEqual(restRight);
    expect(melSkills['mel-third-bolt']![0]!.curve).toBeUndefined();
  });
  it('the curve reaches the flight: a fixed-time spline over the cue\'s own flight time', async () => {
    options.length = 0;
    const skills: Record<string, TimelineCue[]> = { mel: [{ system: 'bolt', event: 'projectile', delay: 0, duration: 0.4, travelSeconds: 0.3, curve: MEL_BOLT_CURVE }] };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: { bolt: 'systems/bolt.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills } : syntheticSystem(), readTexture: async () => new Texture() });
    const scene = new Scene(), units = new Map<string, any>();
    const find = (id: string) => { let unit = units.get(id); if (!unit) { unit = { root: new Group(), body: null, alive: true }; unit.root.position.set(id === 'foe' ? 3 : 0, 0, 0); units.set(id, unit); scene.add(unit.root); } return unit; };
    const runtime = createLtkRuntime(library, scene, find);
    await runtime.warm('mel');
    expect(runtime.play('mel', 'mel', ['foe'])).toBe(true);
    runtime.update(1 / 60, new Camera());
    expect(options).toHaveLength(1);
    expect(options[0].curve).toEqual(MEL_BOLT_CURVE);
    expect(options[0].projectileSeconds).toBeCloseTo(0.3);
    const flight = projectileFlight(0.3, undefined, MEL_BOLT_CURVE) as any;
    expect(flight.movement.kind).toBe('fixedTimeSpline'); expect(flight.movement.travelTime).toBeCloseTo(0.3);
    expect(flight.movement.spline.startOffset).toEqual([0, 0, 0]);
    runtime.dispose();
  });
  it('the index takes a curve on a projectile only, with two finite three-number tangents', () => {
    const index = (cue: Record<string, unknown>) => ({ version: 1, systems: { a: 'a.json' }, assets: {}, skills: { mel: [{ system: 'a', delay: 0, duration: 1, travelSeconds: 0.5, ...cue }] } });
    expect(() => parseIndex(index({ event: 'projectile', curve: MEL_BOLT_CURVE }))).not.toThrow();
    expect(() => parseIndex(index({ event: 'hit', curve: MEL_BOLT_CURVE }))).toThrow();
    expect(() => parseIndex(index({ event: 'projectile', curve: { control1: [1, 2], control2: [0, 0, 1] } }))).toThrow();
    expect(() => parseIndex(index({ event: 'projectile', curve: { control1: [9, 0, 1], control2: [0, 0, 1] } }))).toThrow();
  });
});
