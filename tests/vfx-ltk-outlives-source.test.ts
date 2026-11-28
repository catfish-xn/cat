import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, with the options it was built with.
const built: { options: any; fx: any }[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: any) => {
    const fx = real.createLtkParticles(prepared, options), entry = { options, fx };
    built.push(entry); const reuse = fx.reuse.bind(fx); fx.reuse = (next: unknown) => { entry.options = next; return reuse(next); };
    return fx;
  } };
});
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { FX_SCALE } from '../src/rendering/three-mode/vfx-ltk/particles';
import { AXIS_SIGN } from '../src/rendering/three-mode/vfx-ltk/space';
import { syntheticSystem } from './vfx-ltk-synthetic';

// LtkPlayOptions.outlivesSource: a projectile the rules already fired flies even if its caster dies before or while it is
// drawn flying. Off by default, where a projectile from a caster who dies still goes with the caster.
const skills: Record<string, TimelineCue[]> = { missile: [{ system: 'shot', action: 'cast', event: 'projectile', delay: 0, duration: 0.5, travelSeconds: 0.5 }],
  // TimelineCue.flightOutlivesSource: once flying it flies on; not started yet it goes with the caster.
  rocket: [{ system: 'shot', action: 'cast', event: 'projectile', delay: 0, duration: 0.5, travelSeconds: 0.5, flightOutlivesSource: true }],
  // The flag on a cue that is not a projectile (an effect on the caster): it does nothing there.
  aura: [{ system: 'shot', action: 'cast', event: 'cast-start', delay: 0, duration: 1, flightOutlivesSource: true }] };
const toSystem = (p: { x: number; y: number; z: number }) => [p.x * AXIS_SIGN[0] / FX_SCALE, p.y / FX_SCALE, p.z / FX_SCALE];

async function setup() {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { shot: 'systems/shot.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills }
    : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean; disposed?: boolean }>();
  ['caster', 'a'].forEach((id, i) => { const root = new Group(); root.position.set(10 + i * 60, 0, 20 + i * 30); scene.add(root); root.updateMatrixWorld(); units.set(id, { root, body: null, alive: true }); });
  const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
  await runtime.warm('missile'); await runtime.warm('rocket'); await runtime.warm('aura');
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
  const dies = (id: string) => { units.get(id)!.alive = false; runtime.stopUnit(id); };
  return { runtime, units, step, dies };
}
const board: [number, number, number] = [200, 0, 200];

describe('outlivesSource: a fired projectile flies without its caster', () => {
  it('off (default): a projectile not started yet is dropped when its caster dies, as before', async () => {
    const { runtime, step, dies } = await setup();
    expect(runtime.play('missile', 'caster', ['a'], 'cast', { delay: 0.3, board, snapshotTargets: true })).toBe(true);
    step(0.1); dies('caster'); step(0.5);
    expect(built).toHaveLength(0);
  });
  it('off (default): a projectile in flight stops when its caster dies, as before', async () => {
    const { runtime, step, dies } = await setup();
    runtime.play('missile', 'caster', ['a'], 'cast', { board, snapshotTargets: true });
    step(0.1); expect(runtime.playing('caster')).toBe(true);
    dies('caster');
    expect(runtime.playing('caster')).toBe(false);
  });
  it('on: a projectile not started yet still flies, from where its caster stood as it died', async () => {
    const { runtime, units, step, dies } = await setup();
    expect(runtime.play('missile', 'caster', ['a'], 'cast', { delay: 0.3, board, snapshotTargets: true, outlivesSource: true })).toBe(true);
    step(0.1);
    const stood = units.get('caster')!.root.position.clone();
    dies('caster');
    // The body may be moved or taken away after; the launch point is already kept.
    units.get('caster')!.root.position.set(999, 0, 999); units.get('caster')!.root.updateMatrixWorld();
    step(0.3);
    expect(built).toHaveLength(1);
    expect(built[0]!.options.anchor.originAt(0)).toEqual(toSystem(stood));
    expect(built[0]!.options.attachment).toBeUndefined();
  });
  it('on: a projectile in flight flies on when its caster dies', async () => {
    const { runtime, step, dies } = await setup();
    runtime.play('missile', 'caster', ['a'], 'cast', { board, snapshotTargets: true, outlivesSource: true });
    step(0.1); dies('caster');
    expect(runtime.playing('caster')).toBe(true);
  });
  it('on, with cancelWithSource too: the cancel wins (a play asks for one or the other)', async () => {
    const { runtime, step, dies } = await setup();
    runtime.play('missile', 'caster', ['a'], 'cast', { delay: 0.3, board, snapshotTargets: true, outlivesSource: true, cancelWithSource: true });
    step(0.1); dies('caster'); step(0.5);
    expect(built).toHaveLength(0);
  });
});

describe('flightOutlivesSource (cue): only a projectile already flying outlives its caster', () => {
  it('a projectile not started yet still goes with its caster', async () => {
    const { runtime, step, dies } = await setup();
    expect(runtime.play('rocket', 'caster', ['a'], 'cast', { delay: 0.3, board, snapshotTargets: true })).toBe(true);
    step(0.1); dies('caster'); step(0.5);
    expect(built).toHaveLength(0);
  });
  it('a projectile in flight flies on when its caster dies', async () => {
    const { runtime, step, dies } = await setup();
    runtime.play('rocket', 'caster', ['a'], 'cast', { board, snapshotTargets: true });
    step(0.1); dies('caster');
    expect(runtime.playing('caster')).toBe(true);
    step(0.5); expect(runtime.playing('caster')).toBe(false);
  });
});

describe('flightOutlivesSource is for projectiles only', () => {
  it('on an effect on the caster (not a projectile) the flag does nothing: it goes with its caster', async () => {
    const { runtime, step, dies } = await setup();
    runtime.play('aura', 'caster', ['a'], 'cast', { board, snapshotTargets: true });
    step(0.1); expect(runtime.playing('caster')).toBe(true);
    dies('caster');
    expect(runtime.playing('caster')).toBe(false);
  });
});
describe('which cues outlive their caster in flight (rule receipts: tests/landing-settle, tests/cast-windup-batch3)', () => {
  it("Heimerdinger's rockets and Renata's missiles, each drawn leaving on the rules' launch tick", async () => {
    const { CUE_OVERRIDES, HEIMER_ROCKETS, CAST_WINDUP_TICKS } = await import('../src/rendering/three-mode/vfx-ltk/cue-overrides');
    const { RENATA_MISSILE_FLIGHT_TICKS, HEIMER_ROCKET_TIMING } = await import('../src/simulation/cast-windup');
    const { CUE_EXTRA_SKILLS } = await import('../src/rendering/three-mode/vfx-ltk/cue-overrides');
    const flying = Object.entries({ ...CUE_OVERRIDES, ...CUE_EXTRA_SKILLS }).flatMap(([champion, cues]) => cues.filter(c => c.flightOutlivesSource).map(c => [champion, c] as const));
    expect(flying.map(([champion, c]) => `${champion}:${c.system}`).sort()).toEqual(['heimerdinger:c8d6ee2e', 'lux:f2d605de', 'mel-bolt-alt:fe407ac6', 'mel-bolt:fe407ac6', 'mel-third-bolt:4f2eb343', 'renata:faf1aeac']);
    // Every one is a projectile.
    expect(flying.every(([, c]) => c.event === 'projectile')).toBe(true);
    const [, rocket] = flying.find(([champion]) => champion === 'heimerdinger')!, [, missile] = flying.find(([champion]) => champion === 'renata')!;
    // Drawn leaving when the rules launch it: what the rules settle without the caster is what flies on.
    expect(rocket.delay).toBeCloseTo(HEIMER_ROCKET_TIMING.launchTicks * 0.05, 9); expect(HEIMER_ROCKETS.launchTicks).toBe(HEIMER_ROCKET_TIMING.launchTicks);
    expect(missile.travelSeconds).toBeCloseTo(RENATA_MISSILE_FLIGHT_TICKS * 0.05, 9);
    expect(missile.delay).toBeCloseTo((CAST_WINDUP_TICKS.renata - RENATA_MISSILE_FLIGHT_TICKS) * 0.05, 9);
    // Lux's shield missile leaves on her cast (the rules launch it on the cast tick) and Mel's bolts on the rules' launch event.
    const [, shield] = flying.find(([champion]) => champion === 'lux')!;
    expect([shield.action ?? 'cast', shield.delay]).toEqual(['cast', 0]);
    for (const [key, cue] of flying.filter(([champion]) => champion.startsWith('mel-'))) expect([key, cue.delay]).toEqual([key, 0]);
  });
});
