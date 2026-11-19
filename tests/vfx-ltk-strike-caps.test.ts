import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Every particle set the runtime builds, with the options it was built with.
const built: { options: any }[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: any) => { built.push({ options }); return real.createLtkParticles(prepared, options); } };
});
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

// A perStrike projectile's tickCap: at most that many rocket rows queued on one rule tick across every caster; the strikes
// past it keep their hits (Fable 11-19, Heimerdinger hrB). Designed values.
const strike = { staggerTicks: 1, spreadTicks: 9 };
const skills: Record<string, TimelineCue[]> = { other: [{ system: 'spark', action: 'cast', event: 'hit', delay: 0, duration: 2 }], wide: [
  { system: 'rocket', action: 'cast', event: 'projectile', delay: 0, duration: 2, travelSeconds: 2, perStrike: { staggerTicks: 0, spreadTicks: 0 } },
  { system: 'boom', action: 'cast', event: 'hit', delay: 0, duration: 2, perStrike: { staggerTicks: 0, spreadTicks: 0 } },
], volley: [
  { system: 'rocket', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.5, travelSeconds: 0.5, brightness: 1.7, perStrike: { ...strike, fan: { side: 0.9, lift: 0.6 }, tickCap: 3 } },
  { system: 'boom', action: 'cast', event: 'hit', delay: 0.7, duration: 0.6, perStrike: strike },
] };

async function setup() {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { rocket: 'systems/rocket.json', boom: 'systems/boom.json', spark: 'systems/spark.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills }
    : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
  ['c1', 'c2', 'a', 'b', ...Array.from({ length: 30 }, (_, i) => `t${i}`)].forEach((id, i) => { const root = new Group(); root.position.set(10 + i * 60, 0, 20); scene.add(root); root.updateMatrixWorld(); units.set(id, { root, body: null, alive: true }); });
  let tick: number | undefined;
  const runtime = createLtkRuntime(library, scene, id => units.get(id), { tick: () => tick });
  for (const skill of Object.keys(skills)) await runtime.warm(skill);
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
  const flights = () => built.filter(b => b.options.projectileSeconds !== undefined).length;
  return { runtime, step, setTick: (n: number) => { tick = n; }, flights, hits: () => built.filter(b => b.options.projectileSeconds === undefined).length };
}

describe('perStrike tickCap', () => {
  it('queues at most tickCap rockets on one rule tick across casters, and every strike keeps its hit', async () => {
    const { runtime, step, setTick, flights, hits } = await setup();
    setTick(10);
    expect(runtime.play('volley', 'c1', ['a', 'a', 'b', 'a', 'b'])).toBe(true);
    expect(runtime.play('volley', 'c2', ['a', 'b'])).toBe(true);
    step(1.5);
    expect(flights()).toBe(3);
    expect(hits()).toBe(7);
    // The cue's brightness reaches its rows' particles (TimelineCue.brightness); other cues draw at 1.
    expect(built.filter(b => b.options.projectileSeconds !== undefined).every(b => b.options.brightness === 1.7)).toBe(true);
    expect(built.filter(b => b.options.projectileSeconds === undefined).every(b => b.options.brightness === undefined)).toBe(true);
  });

  it('starts counting again on the next rule tick', async () => {
    const { runtime, step, setTick, flights } = await setup();
    setTick(10); expect(runtime.play('volley', 'c1', ['a', 'a', 'b', 'a'])).toBe(true);
    setTick(11); expect(runtime.play('volley', 'c2', ['a', 'b', 'a', 'b'])).toBe(true);
    step(1.5);
    expect(flights()).toBe(6);
  });

  it('a perStrike cast holds one system slot a cue: its later rows leave the slots to everyone else', async () => {
    const { runtime, step, setTick } = await setup();
    const { LTK_RUN_STATS } = await import('../src/rendering/three-mode/vfx-ltk/runtime');
    const dropped = () => Object.values(LTK_RUN_STATS.dropped).reduce((a, b) => a + b, 0);
    const before = dropped();
    setTick(30);
    expect(runtime.play('wide', 'c1', Array.from({ length: 12 }, (_, i) => `t${i}`))).toBe(true);
    step(0.2);
    // Twelve rockets and twelve hits run, on two slots; eighteen single-hit casts take the other eighteen.
    for (let i = 0; i < 18; i++) { setTick(31 + i); expect(runtime.play('other', 'c2', [`t${12 + i}`])).toBe(true); step(1 / 60); }
    step(0.3);
    expect(dropped() - before).toBe(0);
    expect(built.filter(b => b.options.projectileSeconds !== undefined)).toHaveLength(12);
  });
});
