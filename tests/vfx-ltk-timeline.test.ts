import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { mapSkillTimeline, selectTimeline, type TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { createLtkRuntime, MAX_LTK_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';
const cues: TimelineCue[] = [
  { system: 'cast', event: 'cast-start', delay: 0, duration: 1, bone: 'R_Hand', stopAfter: 0.2 },
  { system: 'missile', event: 'projectile', delay: 0.2, duration: 0.5, travelSeconds: 0.5 },
  { system: 'impact', event: 'hit', delay: 0.7, duration: 0.3 },
];
async function setup(budget?: { live: number; max: number }) {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(), readTexture: async () => new Texture() });
  const source = { root: new Group(), body: null, alive: true }, scene = new Scene();
  const runtime = createLtkRuntime(library, scene, id => id === 'caster' || id === 'target' ? source : undefined, { budget });
  await library.load('sample');
  return { runtime, library, scene, source, camera: new Camera() };
}
describe('cast timeline replacement and fallback', () => {
  it('maps cast start, primary projectile, unique per-target impacts without creating gameplay commands', () => {
    const mapped = mapSkillTimeline(cues, 'caster', ['target', 'target', 'other', 'caster']);
    expect(mapped.map(c => [c.event, c.sourceId, c.targetId, c.delay])).toEqual([
      ['cast-start', 'caster', undefined, 0], ['projectile', 'caster', 'target', 0.2],
      ['hit', 'caster', 'target', 0.7], ['hit', 'caster', 'other', 0.7],
    ]);
    expect(mapSkillTimeline(cues, 'caster', [])).toHaveLength(1);
  });
  it.each(['jinx', 'vi'])('%s replaces only a fully prepared timeline', champion => {
    expect(selectTimeline(champion, cues, id => id !== 'missile')).toBeNull();
    expect(selectTimeline(champion, cues, () => true)).toBe(cues);
    expect(selectTimeline(champion, undefined, () => true)).toBeNull();
    expect(selectTimeline('renata', cues, () => true)).toBeNull();
  });
  it('keeps legacy during missing manifest/load, then owns a ready cast, starts/stops/disposes it', async () => {
    const { runtime, scene, camera } = await setup();
    expect(runtime.play('vi', 'caster', ['target'])).toBe(false);
    expect(runtime.play('jinx', 'absent', [])).toBe(false);
    expect(runtime.play('jinx', 'caster', [])).toBe(true);
    runtime.update(0.01, camera); expect(runtime.active).toBe(1); expect(scene.children).toHaveLength(1);
    runtime.stopUnit('caster'); runtime.update(1.1, camera);
    expect(runtime.active).toBe(0); expect(scene.children).toHaveLength(0);
    runtime.dispose(); expect(runtime.play('jinx', 'caster', [])).toBe(false);
  });
  it('phase reset cancels queued and live effects; stale tab-resume bursts do not spawn', async () => {
    const { runtime, scene, camera } = await setup();
    runtime.play('jinx', 'caster', []); runtime.clear(); runtime.update(0.01, camera); expect(runtime.active).toBe(0);
    runtime.play('jinx', 'caster', []); runtime.update(1, camera); expect(runtime.active).toBe(0);
    runtime.play('jinx', 'caster', []); runtime.update(0.01, camera); runtime.clear();
    expect(runtime.active).toBe(0); expect(runtime.queued).toBe(0); expect(scene.children).toHaveLength(0); runtime.dispose();
  });
  it('shares the existing fallback particle budget and releases every reservation once', async () => {
    const budget = { live: 1251, max: 1500 }, { runtime, camera } = await setup(budget);
    runtime.play('jinx', 'caster', []); runtime.update(0.01, camera); expect(runtime.active).toBe(0); expect(budget.live).toBe(1251);
    budget.live = 1200; runtime.play('jinx', 'caster', []); runtime.update(0.01, camera);
    expect(runtime.active).toBe(1); expect(budget.live).toBe(1450);
    runtime.clear(); expect(budget.live).toBe(1200); runtime.dispose(); runtime.dispose(); expect(budget.live).toBe(1200);
  });
  it('bounds simultaneous particle reservations and cancels deaths before delayed spawn', async () => {
    const { runtime, camera } = await setup();
    for (let i = 0; i < 20; i++) runtime.play('jinx', 'caster', []);
    runtime.update(0.01, camera); runtime.update(0.01, camera);
    expect(runtime.active).toBeLessThanOrEqual(MAX_LTK_SYSTEMS);
    runtime.clear(); runtime.play('jinx', 'caster', []); runtime.stopUnit('caster'); runtime.update(0.01, camera);
    expect(runtime.active).toBe(0); runtime.dispose();
  });
});
