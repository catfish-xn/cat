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
const skills: Record<string, TimelineCue[]> = { volley: [
  { system: 'rocket', action: 'cast', event: 'projectile', delay: 0.2, duration: 0.5, travelSeconds: 0.5, perStrike: { ...strike, fan: { side: 0.9, lift: 0.6 }, tickCap: 3 } },
  { system: 'boom', action: 'cast', event: 'hit', delay: 0.7, duration: 0.6, perStrike: strike },
] };

async function setup() {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { rocket: 'systems/rocket.json', boom: 'systems/boom.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills }
    : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
  ['c1', 'c2', 'a', 'b'].forEach((id, i) => { const root = new Group(); root.position.set(10 + i * 60, 0, 20); scene.add(root); root.updateMatrixWorld(); units.set(id, { root, body: null, alive: true }); });
  let tick: number | undefined;
  const runtime = createLtkRuntime(library, scene, id => units.get(id), { tick: () => tick });
  await runtime.warm('volley');
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
  const flights = () => built.filter(b => b.options.projectileSeconds !== undefined).length;
  return { runtime, step, setTick: (n: number) => { tick = n; }, flights, hits: () => built.length - flights() };
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
  });

  it('starts counting again on the next rule tick', async () => {
    const { runtime, step, setTick, flights } = await setup();
    setTick(10); expect(runtime.play('volley', 'c1', ['a', 'a', 'b', 'a'])).toBe(true);
    setTick(11); expect(runtime.play('volley', 'c2', ['a', 'b', 'a', 'b'])).toBe(true);
    step(1.5);
    expect(flights()).toBe(6);
  });
});
