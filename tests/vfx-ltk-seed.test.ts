import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, with the options it was built with (its seed among them).
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
import { createLtkRuntime, hashSeed } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

// Fable 11-17 (C70): a run's random shape came from a counter over every run the runtime had started, so a change in what
// loaded first, or what else played before, moved every later shape. Seeds now come from stable names and the rule tick.
const hit = (system: string, delay = 0): TimelineCue => ({ system, action: 'cast', event: 'hit', delay, duration: 0.6 });
const skills: Record<string, TimelineCue[]> = { blast: [hit('boom')], double: [hit('boom'), hit('boom', 0.1)], other: [hit('spark')] };
const systems = ['boom', 'spark'];

async function setup(warm: readonly string[] = Object.keys(skills)) {
  built.length = 0;
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: Object.fromEntries(systems.map(s => [s, `systems/${s}.json`])), assets: { 'synthetic.tex': 'texture.png' }, skills }
    : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
  ['caster', 'a', 'b'].forEach((id, i) => { const root = new Group(); root.position.set(10 + i * 60, 0, 20); scene.add(root); root.updateMatrixWorld(); units.set(id, { root, body: null, alive: true }); });
  let tick: number | undefined;
  const runtime = createLtkRuntime(library, scene, id => units.get(id), { tick: () => tick });
  for (const champion of warm) await runtime.warm(champion);
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
  return { runtime, step, setTick: (n: number | undefined) => { tick = n; }, seeds: () => built.map(entry => entry.options.seed as number) };
}

describe('vfx-ltk seeds', () => {
  it('hashSeed is stable, 32-bit and never 0', () => {
    expect(hashSeed('boom|caster|a|cast||12#0')).toBe(hashSeed('boom|caster|a|cast||12#0'));
    expect(hashSeed('boom|caster|a|cast||12#0')).not.toBe(hashSeed('boom|caster|a|cast||12#1'));
    for (const key of ['', 'a', 'boom']) { const seed = hashSeed(key); expect(seed).toBeGreaterThan(0); expect(seed).toBeLessThan(2 ** 32); }
  });

  it('a row keeps its seed whatever was refused, played or loaded before it', async () => {
    const plain = await setup();
    plain.setTick(12); expect(plain.runtime.play('blast', 'caster', ['a'])).toBe(true); plain.step(1 / 60);
    const [alone] = plain.seeds();
    plain.runtime.dispose();
    // Before it this time: a cast refused as not ready (its catalogue not warmed), other systems and other targets, earlier ticks.
    const busy = await setup(['blast', 'double']);
    busy.setTick(3); expect(busy.runtime.play('other', 'caster', ['a'])).toBe(false);
    busy.setTick(7); expect(busy.runtime.play('blast', 'caster', ['b'])).toBe(true); expect(busy.runtime.play('double', 'caster', ['b'])).toBe(true);
    busy.step(0.3);
    const before = busy.seeds().length;
    busy.setTick(12); expect(busy.runtime.play('blast', 'caster', ['a'])).toBe(true); busy.step(1 / 60);
    expect(busy.seeds().slice(before)).toEqual([alone]);
    busy.runtime.dispose();
  });

  it('the same system on the same target on the same tick twice gets two seeds; another tick, another seed', async () => {
    const { runtime, step, setTick, seeds } = await setup();
    setTick(20); expect(runtime.play('double', 'caster', ['a'])).toBe(true); step(0.2);
    const [first, second] = seeds();
    expect(first).not.toBe(second);
    setTick(21); expect(runtime.play('blast', 'caster', ['a'])).toBe(true); step(1 / 60);
    expect(seeds()[2]).not.toBe(first);
    // A fan-out: one system on two targets on one tick, two seeds.
    setTick(22); expect(runtime.play('blast', 'caster', ['a', 'b'])).toBe(true); step(1 / 60);
    expect(new Set(seeds().slice(3)).size).toBe(2);
    runtime.dispose();
  });

  it('a clear() starts the counts over: the same play on the same tick gets the same seed again', async () => {
    const { runtime, step, setTick, seeds } = await setup();
    setTick(5); expect(runtime.play('blast', 'caster', ['a'])).toBe(true); step(1 / 60);
    runtime.clear();
    setTick(5); expect(runtime.play('blast', 'caster', ['a'])).toBe(true); step(1 / 60);
    const [a, b] = seeds();
    expect(b).toBe(a);
    runtime.dispose();
  });
});
