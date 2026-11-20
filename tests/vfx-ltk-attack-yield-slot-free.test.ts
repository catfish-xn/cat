import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, LTK_RUN_STATS, MAX_LTK_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

// A plain attack short of slots ends a decorative run only when that run holds a slot (Fable 11-19): a perStrike cast's hits
// past its first take none (Heimerdinger's rockets), so ending one would drop a hit and free nothing. Synthetic systems.
const skills: Record<string, TimelineCue[]> = {
  // Twelve rockets and their decorative hits: one slot each cue, the later rows on no slot (perStrike).
  rockets: [
    { system: 'rocket', action: 'cast', event: 'projectile', delay: 0, duration: 3, travelSeconds: 3, perStrike: { staggerTicks: 0, spreadTicks: 0 } },
    { system: 'boom', action: 'cast', event: 'hit', delay: 0, duration: 3, rank: 'decorative', perStrike: { staggerTicks: 0, spreadTicks: 0 } },
  ],
  // Skill hits that fill the other slots, and one passive glow (decorative, a slot of its own) an attack may end.
  other: [{ system: 'spark', action: 'cast', event: 'hit', delay: 0, duration: 3 }],
  glow: [{ system: 'glow', action: 'passive', event: 'cast-start', delay: 0, duration: 3, rank: 'decorative' }],
  shot: [{ system: 'shot', action: 'attack', event: 'hit', delay: 0, duration: 0.5 }],
};

async function setup() {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: Object.fromEntries(['rocket', 'boom', 'spark', 'glow', 'shot'].map(id => [id, `systems/${id}.json`])), assets: { 'synthetic.tex': 'texture.png' }, skills }
    : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
  ['h', 'g', 'x', ...Array.from({ length: 60 }, (_, i) => `t${i}`)].forEach((id, i) => { const root = new Group(); root.position.set(10 + i * 60, 0, 20); scene.add(root); root.updateMatrixWorld(); units.set(id, { root, body: null, alive: true }); });
  let tick = 0;
  const runtime = createLtkRuntime(library, scene, id => units.get(id), { tick: () => tick });
  for (const skill of Object.keys(skills)) await runtime.warm(skill);
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
  const live = (system: string) => scene.children.filter(child => child.userData.ltkSystem === system).length;
  return { runtime, step, live, next: () => ++tick };
}

describe('a plain attack short of slots skips the runs that hold no slot', () => {
  it('Heimerdinger\'s rockets on a full board: attacks end the glow that holds a slot, never a rocket hit', async () => {
    const { runtime, step, live, next } = await setup();
    const yielded = () => LTK_RUN_STATS.yielded.boom ?? 0, boomsYielded = yielded();
    next(); expect(runtime.play('rockets', 'h', Array.from({ length: 12 }, (_, i) => `t${i}`))).toBe(true);
    step(0.1);
    expect(live('boom')).toBe(12);
    // The rockets hold two slots; fill all but one of the rest with skill hits, and the last with the glow.
    for (let i = 0; i < MAX_LTK_SYSTEMS - 3; i++) { next(); expect(runtime.play('other', 'x', [`t${12 + i}`])).toBe(true); step(1 / 60); }
    next(); expect(runtime.play('glow', 'g', [], 'passive')).toBe(true);
    step(0.1);
    expect(runtime.slots).toBe(MAX_LTK_SYSTEMS);
    // The first attack ends the glow (a slot of its own); the second finds no slot-holding flourish left and is dropped.
    next(); expect(runtime.play('shot', 'g', ['t0'], 'attack')).toBe(true); step(1 / 60);
    expect(live('glow')).toBe(0); expect(live('shot')).toBe(1);
    next(); expect(runtime.play('shot', 'g', ['t1'], 'attack')).toBe(true); step(1 / 60);
    expect(live('shot')).toBe(1);
    // Every rocket hit is still there: none was ended for a slot it never held (ending the fan's first row would only hand
    // its slot to the next, one after another).
    expect(live('boom')).toBe(12);
    expect(yielded() - boomsYielded).toBe(0);
    runtime.dispose();
  });
});
