import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, with the options it was built with (anchor, target, attachment).
const built: { system: string; options: any; fx: any }[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: any) => {
    const fx = real.createLtkParticles(prepared, options), entry = { system: '', options, fx };
    built.push(entry); const reuse = fx.reuse.bind(fx); fx.reuse = (next: unknown) => { entry.options = next; return reuse(next); };
    return fx;
  } };
});
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, LTK_RUN_STATS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

// A parked system played again starts its run over (driver.reseed), whatever its seed (11-20: a replayed combat repeats
// ticks and so seeds; Sevika's punch burst, reused under its old seed, showed only its tail).
const hit = (system: string, delay: number, extra: Partial<TimelineCue> = {}): TimelineCue => ({ system, action: 'cast', event: 'hit', delay, duration: 0.6, ...extra });
const shot: TimelineCue = { system: 'shot', action: 'cast', event: 'projectile', delay: 0, duration: 0.5, travelSeconds: 0.5, primary: true };
const skills: Record<string, TimelineCue[]> = {
  blast: [{ system: 'flourish', action: 'cast', event: 'cast-start', delay: 0, duration: 0.6 }, hit('boom', 0)],
  later: [hit('boom', 0.3)],
  missile: [shot],
  swing: [{ ...hit('spark', 0), action: 'attack' }],
  // A plain attack's missile.
  volley: [{ ...shot, action: 'attack' }],
  // A cast's own short flourish (decorative by its length): the skill showing.
  swipe: [{ system: 'flourish', action: 'cast', event: 'cast-start', delay: 0, duration: 0.9 }],
  // An attack and its empowered form (a variant), each landing 0.3 s in.
  bolt: [{ ...hit('spark', 0.3), action: 'attack' }, { ...hit('boom', 0.3), action: 'attack', variant: 'empowered' }],
  curse: [hit('curse', 0.3, { livingTarget: true }), hit('boom', 0.3)],
  // A long flourish (decorative): a living target's hit may evict it, and so may a hit at a dead target's place (Fable 11-17).
  glow: [{ system: 'glow', action: 'passive', event: 'cast-start', delay: 0, duration: 5 }],
  pair: [hit('boom', 0)],
  // One hit on every target, the rows starting together (one together group): a living and a dead target mixed.
  duo: [hit('boom', 0, { together: 'duo' })],
};
const systems = ['flourish', 'boom', 'shot', 'spark', 'curse', 'glow'];

const tick = { now: 7 };
async function setup() {
  built.length = 0;
  for (const key of Object.keys(LTK_RUN_STATS.skipped)) delete LTK_RUN_STATS.skipped[key];
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: Object.fromEntries(systems.map(s => [s, `systems/${s}.json`])), assets: { 'synthetic.tex': 'texture.png' }, skills }
    : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean; disposed?: boolean }>();
  ['caster', 'a', 'b'].forEach((id, i) => { const root = new Group(); root.position.set(10 + i * 60, 0, 20 + i * 30); scene.add(root); root.updateMatrixWorld(); units.set(id, { root, body: null, alive: true }); });
  const runtime = createLtkRuntime(library, scene, id => units.get(id), { tick: () => tick.now });
  for (const champion of Object.keys(skills)) await runtime.warm(champion);
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
  // The system each build was for, filled in as the runtime names it.
  const of = (system: string) => built.filter(entry => entry.fx.object.userData.ltkSystem === system);
  return { runtime, scene, units, step, of };
}


describe('vfx-ltk: a reused system starts its run over', () => {
  // One play of `pair` on a dead target's place (no attachment, so its run is parked and reused), at rule tick `at`.
  const playAt = async (passes: readonly { tick: number }[]) => {
    const { runtime, units, step, of } = await setup();
    units.get('a')!.alive = false;
    const first: { time: number; live: number; builds: number }[] = [];
    for (const { tick: at } of passes) {
      tick.now = at;
      expect(runtime.play('pair', 'caster', ['a'])).toBe(true);
      step(1 / 60);
      const live = of('boom').filter(entry => entry.fx.object.parent);
      first.push({ time: live[0]!.fx.driver.time, live: live[0]!.fx.driver.pool.count, builds: of('boom').length });
      step(1.5);
      // Another play at another tick between passes, as a combat has (so the seed counter starts over on the next tick).
      tick.now = 999; runtime.play('glow', 'caster', [], 'passive'); step(0.1);
    }
    runtime.dispose();
    return first;
  };
  it('same seed (the same tick again), another seed, and no reuse: each play starts at its first frame', async () => {
    const same = await playAt([{ tick: 7 }, { tick: 7 }]);
    expect(same[1]!.builds).toBe(1); // the parked run was reused
    expect(same[1]!.time).toBeCloseTo(same[0]!.time, 6);
    const other = await playAt([{ tick: 7 }, { tick: 8 }]);
    expect(other[1]!.builds).toBe(1);
    expect(other[1]!.time).toBeCloseTo(other[0]!.time, 6);
    const fresh = await playAt([{ tick: 7 }]);
    expect(fresh[0]!.time).toBeCloseTo(same[0]!.time, 6);
  });
  it('a system played in two combats shows as many live particles on the second\'s first frame as on the first\'s', async () => {
    const [one, two] = await playAt([{ tick: 7 }, { tick: 7 }]);
    expect(two!.live).toBe(one!.live);
    expect(two!.live).toBeGreaterThan(0);
  });
});
