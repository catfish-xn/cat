import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, in build order.
const built: any[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => { const fx = real.createLtkParticles(prepared, options); built.push(fx); return fx; } };
});
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { fadeAt } from '../src/rendering/three-mode/vfx-ltk/particles';
import { CUE_OVERRIDES, PLAY_OUT_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { syntheticSystem } from './vfx-ltk-synthetic';

// A listed system (PLAY_OUT_SYSTEMS) and an unlisted one, both plain caster-to-target projectiles, and a long cast cue.
const LISTED = Object.keys(PLAY_OUT_SYSTEMS)[0]!, END = PLAY_OUT_SYSTEMS[LISTED]!, PLAIN = 'sample', HELD = 'held', LATE = 'late';
const flight = (system: string): TimelineCue => ({ system, event: 'projectile', delay: 0, duration: 0.6, travelSeconds: 0.6, bone: 'ground', targetBone: 'ground' });
const index = (cues: readonly TimelineCue[], filler: readonly TimelineCue[]) => ({ version: 1, systems: Object.fromEntries([LISTED, PLAIN, HELD, LATE].map(id => [id, `systems/${id}.json`])),
  assets: { 'synthetic.tex': 'texture.png' }, skills: { gangplank: cues, ...(filler.length ? { vi: filler } : {}) } });

// `filler` plays first, from another champion's list, so the board is already holding it when the cast lands.
async function setup(cues: readonly TimelineCue[] = [flight(LISTED), flight(PLAIN)], filler: readonly TimelineCue[] = []) {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index(cues, filler) : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map(['caster', 'target'].map((id, i) => {
    const root = new Group(); root.position.set(i * 20 + 5, 0, i * 30); scene.add(root); root.updateMatrixWorld();
    return [id, { root, body: null, alive: true }];
  }));
  const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
  await runtime.warm('gangplank');
  if (filler.length) { await runtime.warm('vi'); expect(runtime.play('vi', 'caster', ['target'])).toBe(true); }
  expect(runtime.play('gangplank', 'caster', ['target'])).toBe(true);
  // At most six starts a frame: a full board takes two.
  runtime.update(1 / 30, new Camera()); runtime.update(1 / 30, new Camera());
  const listed = built.find(fx => fx.object.userData.ltkSystem === LISTED);
  // Never played out on its own here, so only its own end removes it.
  Object.defineProperty(listed, 'playedOut', { get: () => false });
  return { runtime, scene, listed, stop: vi.spyOn(listed, 'stop'), ends: vi.spyOn(listed, 'endWithin'),
    advance: (seconds: number) => { for (let t = 0; t < seconds; t += 1 / 30) runtime.update(1 / 30, new Camera()); } };
}

describe('vfx-ltk projectiles that play out (cue-overrides.ts PLAY_OUT_SYSTEMS)', () => {
  it('lists only systems the live lists fire as projectiles, each ending within its own seconds', () => {
    expect(Object.keys(PLAY_OUT_SYSTEMS).length).toBeGreaterThan(0);
    const projectiles = new Set(Object.values(CUE_OVERRIDES).flat().filter(cue => cue.event === 'projectile').map(cue => cue.system));
    for (const [system, end] of Object.entries(PLAY_OUT_SYSTEMS)) {
      expect(projectiles.has(system), system).toBe(true);
      expect(end.seconds).toBeGreaterThan(0);
      expect(end.fade).toBeGreaterThan(0);
      expect(end.fade).toBeLessThanOrEqual(end.seconds);
    }
  });

  it('a listed projectile stops at its end, fades out over its own last seconds and is gone by its own end; an unlisted one ends whole', async () => {
    const { runtime, scene, listed, stop, ends, advance } = await setup();
    const plain = built.find(fx => fx.object.userData.ltkSystem === PLAIN);
    advance(0.6);
    expect(plain.object.parent).toBeNull();
    expect(listed.object.parent).toBe(scene);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(ends).toHaveBeenCalledWith(END.seconds, END.fade);
    // Playing out is no longer playing: the caster's next action is not held up by it.
    expect(runtime.playing('caster')).toBe(false);
    advance(END.seconds - 0.15);
    expect(listed.object.parent).toBe(scene);
    advance(0.2);
    expect(listed.object.parent).toBeNull();
    runtime.dispose();
  });

  it('the end fade is whole up to its last seconds and nothing at its end', () => {
    const from = 2 + END.seconds - END.fade, to = 2 + END.seconds;
    expect(fadeAt(from, to, from)).toBe(1);
    expect(fadeAt((from + to) / 2, to, from)).toBeCloseTo(0.5, 9);
    expect(fadeAt(to, to, from)).toBe(0);
  });

  it('a listed projectile whose target dies as it lands still plays out; an unlisted one goes at its end', async () => {
    const { runtime, scene, listed, ends, advance } = await setup();
    const plain = built.find(fx => fx.object.userData.ltkSystem === PLAIN);
    advance(0.5);
    runtime.stopUnit('target');
    expect(ends).toHaveBeenCalledWith(END.seconds, END.fade);
    advance(0.2);
    expect(plain.object.parent).toBeNull();
    expect(listed.object.parent).toBe(scene);
    advance(END.seconds - 0.3);
    expect(listed.object.parent).toBe(scene);
    advance(0.2);
    expect(listed.object.parent).toBeNull();
    runtime.dispose();
  });

  // Eleven long cast cues beside the listed projectile: with its tail the board holds every one of MAX_LTK_SYSTEMS (12).
  const held = Array.from({ length: 11 }, (): TimelineCue => ({ system: HELD, event: 'cast-start', delay: 0, duration: 3, bone: 'ground' }));
  const late = (together?: string): TimelineCue => ({ system: LATE, event: 'cast-start', delay: 0.8, duration: 0.5, bone: 'ground', ...(together ? { together } : {}) });
  it('a tail gives way to a new run that giving it up lets in', async () => {
    const { runtime, scene, listed, advance } = await setup([flight(LISTED), late()], held);
    advance(0.7);
    expect(listed.object.parent).toBe(scene);
    advance(0.2);
    expect(listed.object.parent).toBeNull();
    expect(built.filter(fx => fx.object.parent === scene)).toHaveLength(12);
    runtime.dispose();
  });

  it('a tail stays when giving it up would not let the new run in either', async () => {
    // A pair that starts together: eleven long runs and two more overfill the slots, tail or no tail.
    const { runtime, scene, listed, advance } = await setup([flight(LISTED), late('pair'), late('pair')], held);
    advance(0.9);
    expect(listed.object.parent).toBe(scene);
    expect(built).toHaveLength(12);
    runtime.dispose();
  });
});
