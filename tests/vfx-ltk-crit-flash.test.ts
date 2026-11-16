import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { CRIT_ATTACK_HIT, CRIT_SKILL_HIT } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { createLtkRuntime, CRIT_FLASH_MAX, LTK_RUN_STATS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

// A basic attack that crits plays the shared crit flash in place of the shared hit (CRIT_ATTACK_HIT), at the same bone and
// moment; keepHit champions keep the plain hit, and past CRIT_FLASH_MAX flashes out at once a crit plays the plain hit.
const { hit: HIT, crit: CRIT } = CRIT_ATTACK_HIT;
const attack: TimelineCue[] = [
  { system: 'shot', action: 'attack', event: 'projectile', delay: 0.2, duration: 0.6, travelSeconds: 0.3 },
  { system: HIT, action: 'attack', event: 'hit', delay: 0.5, duration: 1, bone: 'C_BUFFBONE_GLB_CHEST_LOC' },
];
const skills: Record<string, TimelineCue[]> = { gunner: attack, zeri: attack, mage: [{ system: 'shot', action: 'cast', event: 'hit', delay: 0, duration: 0.5 }] };

async function setup() {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { shot: 'systems/shot.json', [HIT]: 'systems/hit.json', [CRIT]: 'systems/crit.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills }
    : syntheticSystem(),
  readTexture: async () => new Texture() });
  const units = new Map<string, { root: Group; body: null; alive: boolean }>();
  const find = (id: string) => { let unit = units.get(id); if (!unit) { unit = { root: new Group(), body: null, alive: true }; units.set(id, unit); } return unit; };
  const runtime = createLtkRuntime(library, new Scene(), find, { budget: { live: 0, max: 100000 } });
  for (const champion of Object.keys(skills)) await runtime.warm(champion);
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
  for (const key of ['started', 'dropped'] as const) for (const id of Object.keys(LTK_RUN_STATS[key])) delete LTK_RUN_STATS[key][id];
  return { runtime, step, started: (id: string) => LTK_RUN_STATS.started[id] ?? 0 };
}

describe('vfx-ltk crit flash', () => {
  it('a crit plays the crit flash in place of the hit; a plain attack plays the hit', async () => {
    const { runtime, step, started } = await setup();
    expect(runtime.play('gunner', 'a', ['t'], 'attack', { crit: true })).toBe(true);
    expect(runtime.play('gunner', 'b', ['t'], 'attack')).toBe(true);
    step(0.6);
    expect(started(CRIT)).toBe(1); expect(started(HIT)).toBe(1); expect(started('shot')).toBe(2);
    runtime.dispose();
  });

  it('a keepHit champion keeps the plain hit on a crit', async () => {
    const { runtime, step, started } = await setup();
    expect(CRIT_ATTACK_HIT.keepHit.has('zeri')).toBe(true);
    expect(runtime.play('zeri', 'z', ['t'], 'attack', { crit: true })).toBe(true);
    step(0.6);
    expect(started(CRIT)).toBe(0); expect(started(HIT)).toBe(1);
    runtime.dispose();
  });

  it('only CRIT_FLASH_MAX crit flashes are out at once; a crit past them plays the plain hit', async () => {
    const { runtime, step, started } = await setup();
    for (let i = 0; i <= CRIT_FLASH_MAX; i++) expect(runtime.play('gunner', `a${i}`, [`t${i}`], 'attack', { crit: true })).toBe(true);
    step(0.6);
    expect(started(CRIT)).toBe(CRIT_FLASH_MAX); expect(started(HIT)).toBe(1);
    // Once those have ended, a crit flashes again.
    step(1.2);
    expect(runtime.play('gunner', 'late', ['t'], 'attack', { crit: true })).toBe(true);
    step(0.6);
    expect(started(CRIT)).toBe(CRIT_FLASH_MAX + 1);
    runtime.dispose();
  });

  it('a skill crit flashes the crit system on its target beside the skill, every champion gets the branch, CRIT_FLASH_MAX shared', async () => {
    const { runtime, step, started } = await setup();
    expect(runtime.play('mage', 'm', ['t'], 'cast')).toBe(true);
    expect(runtime.play('mage', 'm', ['t'], 'passive', { skill: CRIT_SKILL_HIT.skill('mage'), critFlash: true })).toBe(true);
    step(0.1);
    expect(started('shot')).toBe(1); expect(started(CRIT)).toBe(1);
    // Attack crits and skill crits count against the one CRIT_FLASH_MAX: once it is out, a skill crit flashes nothing.
    for (let i = 1; i < CRIT_FLASH_MAX; i++) expect(runtime.play('gunner', `a${i}`, [`t${i}`], 'attack', { crit: true })).toBe(true);
    step(0.6);
    expect(started(CRIT)).toBe(CRIT_FLASH_MAX);
    expect(runtime.play('gunner', 'm2', ['t'], 'passive', { skill: CRIT_SKILL_HIT.skill('gunner'), critFlash: true })).toBe(false);
    runtime.dispose();
  });
});

