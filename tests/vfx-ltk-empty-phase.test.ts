import { Camera, Group, Scene, Texture } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds (one per started run).
const built: unknown[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => { built.push(options); return real.createLtkParticles(prepared, options); } };
});
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, LTK_RUN_STATS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { attackEventLanding, attackPlayOptions, windupLanding } from '../src/rendering/three-mode/vfx-ltk/attack-landing';
import { syntheticSystem } from './vfx-ltk-synthetic';

// #749 (11-28): a ranged attack plays in two phases, its wind-up (the swing's own cues) and its launch (the shot). An attack
// whose timeline is only its shot (projectile and hit) has nothing in the wind-up: that phase is done, not refused 'not-ready'
// (every cue was loaded) and not left to the host's own effect or tracer, which drew an extra effect on each wind-up. A play
// whose cues are not all loaded is still refused 'not-ready' and still falls back, as before.
const shotOnly: TimelineCue[] = [
  { system: 'shot', action: 'attack', event: 'projectile', bone: 'b', delay: 0.28, duration: 1, travelSeconds: 0.3, targetBone: 't' } as TimelineCue,
  { system: 'hit', action: 'attack', event: 'hit', bone: 't', delay: 0.58, duration: 1 } as TimelineCue];
const swingless: TimelineCue[] = [{ system: 'flash', action: 'attack', event: 'cast-start', bone: 'b', delay: 0.3, duration: 0.5 } as TimelineCue];
async function setup(warm = true) {
  built.length = 0;
  for (const key of Object.keys(LTK_RUN_STATS.refused)) delete LTK_RUN_STATS.refused[key];
  for (const key of Object.keys(LTK_RUN_STATS.emptyPhase)) delete LTK_RUN_STATS.emptyPhase[key];
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { shot: 's.json', hit: 'h.json', flash: 'f.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { gun: shotOnly, flasher: swingless } }
    : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, any>();
  ['caster', 'a'].forEach((id, i) => { const root = new Group(); root.position.set(10 + i * 60, 0, 20); scene.add(root); root.updateMatrixWorld(); units.set(id, { root, body: null, alive: true }); });
  const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
  if (warm) { await runtime.warm('gun'); await runtime.warm('flasher'); }
  const camera = new Camera(), step = (s: number) => { for (let t = 0; t < s - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
  return { runtime, step };
}
const windup = () => attackPlayOptions(undefined, undefined, windupLanding({ tick: 0, launchTick: 6 }), false) as object;
const launch = () => attackPlayOptions(undefined, undefined, attackEventLanding({ seconds: 0.4 }, true), false) as object;

describe('an attack phase with nothing to play', () => {
  beforeEach(() => { built.length = 0; });
  it('a shot-only attack: its wind-up is done (true), counted as an empty wind-up, not refused not-ready', async () => {
    const { runtime } = await setup();
    expect(runtime.play('gun', 'caster', ['a'], 'attack', windup())).toBe(true);
    expect(LTK_RUN_STATS.refused).toEqual({});
    expect(LTK_RUN_STATS.emptyPhase).toEqual({ 'gun windup': 1 });
  });
  it('its launch still plays the shot', async () => {
    const { runtime, step } = await setup();
    runtime.play('gun', 'caster', ['a'], 'attack', windup());
    expect(runtime.play('gun', 'caster', ['a'], 'attack', launch())).toBe(true);
    step(0.05);
    expect(built.length).toBeGreaterThan(0);
  });
  it('the empty wind-up draws nothing, so the host has nothing to fall back to (play answered true: no old effect, no tracer)', async () => {
    const { runtime, step } = await setup();
    expect(runtime.play('gun', 'caster', ['a'], 'attack', windup())).toBe(true);
    step(0.5);
    expect(built).toEqual([]);
  });
  it('cues not loaded yet: the wind-up is refused not-ready as before (not counted empty), so the host still falls back', async () => {
    const { runtime } = await setup(false);
    expect(runtime.play('gun', 'caster', ['a'], 'attack', windup())).toBe(false);
    expect(LTK_RUN_STATS.refused).toEqual({ 'not-ready': 1 });
    expect(LTK_RUN_STATS.emptyPhase).toEqual({});
  });
  it('an empty launch (an attack with no shot) is still refused, and listed to be explained', async () => {
    const { runtime } = await setup();
    expect(runtime.play('flasher', 'caster', ['a'], 'attack', launch())).toBe(false);
    expect(LTK_RUN_STATS.refused).toEqual({ 'nothing-left': 1 });
    expect(LTK_RUN_STATS.emptyPhase).toEqual({ 'flasher launch': 1 });
  });
});
