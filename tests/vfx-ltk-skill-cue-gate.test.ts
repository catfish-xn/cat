import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createVfxLibrary, parseIndex, SKILL_CUES_TOGETHER, skillCuesPlayable, skillCuesTogether } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// A skill list holds at most SKILL_CUES_TOGETHER cues that can play together (Fable 11-21): rows of different variants
// never play together, so each variant's playable set (its rows, plus the plain rows of the actions it has none for) is
// counted on its own, and the plain set too.
const cue = (action: TimelineCue['action'], variant?: TimelineCue['variant']): TimelineCue =>
  ({ system: 'a', action, event: 'cast-start', delay: 0, duration: 1, ...(variant ? { variant } : {}) });
const index = (cues: TimelineCue[]) => ({ version: 1, systems: { a: 'a.json' }, assets: {}, skills: { jinx: cues } });
const many = (n: number, action: TimelineCue['action'], variant?: TimelineCue['variant']) => Array.from({ length: n }, () => cue(action, variant));

describe('the skill cue gate counts what can play together', () => {
  it('is twelve', () => expect(SKILL_CUES_TOGETHER).toBe(12));
  it('mutually exclusive variants count apart: twelve plain rows and twelve empowered attack rows pass', () => {
    const cues = [...many(2, 'attack'), ...many(10, 'cast'), ...many(2, 'attack', 'empowered')];
    expect(skillCuesTogether(cues)).toBe(true);
    expect(() => parseIndex(index(cues))).not.toThrow();
    const apart = [...many(12, 'attack'), ...many(12, 'attack', 'empowered'), ...many(12, 'attack', 'empowered-alt')];
    expect(() => parseIndex(index(apart))).not.toThrow();
  });
  it('a variant\'s set counts the plain rows of the actions it has none for: past twelve it is refused', () => {
    // The empowered set: 3 empowered attacks + 10 plain casts = 13.
    const cues = [...many(1, 'attack'), ...many(10, 'cast'), ...many(3, 'attack', 'empowered')];
    expect(skillCuesTogether(cues)).toBe(false);
    expect(() => parseIndex(index(cues))).toThrow('skill');
  });
  it('any one variant\'s own rows past twelve are refused, as are thirteen plain rows', () => {
    expect(() => parseIndex(index([...many(2, 'cast'), ...many(13, 'attack', 'empowered')]))).toThrow('skill');
    expect(() => parseIndex(index(many(13, 'cast')))).toThrow('skill');
  });
});

// The counted set must be what the runtime selects: under a variant, each action that has rows of it plays with it (only
// those rows), and every other action plays plain (its plain rows). Played for real here, so the two cannot drift apart.
const built: any[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: any, options: unknown) => { const fx = real.createLtkParticles(prepared, options); built.push(fx); return fx; } };
});
describe('the counted set is what the runtime plays', () => {
  const row = (system: string, action: TimelineCue['action'], variant?: TimelineCue['variant']): TimelineCue =>
    ({ system, action, event: 'cast-start', delay: 0, duration: 1, ...(variant ? { variant } : {}) });
  const cues = [row('pa1', 'attack'), row('pa2', 'attack'), row('pc1', 'cast'), row('pc2', 'cast'), row('pc3', 'cast'),
    row('ea1', 'attack', 'empowered'), row('ea2', 'attack', 'empowered'), row('sc1', 'cast', 'self'), row('pp1', 'passive')];
  it.each([undefined, 'empowered', 'self'] as const)('variant %s', async variant => {
    const systems = Object.fromEntries(cues.map(c => [c.system, `systems/${c.system}.json`]));
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems, assets: { 'synthetic.tex': 'texture.png' }, skills: { jinx: cues } } : syntheticSystem(), readTexture: async () => new Texture() });
    const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
    const find = (id: string) => { let unit = units.get(id); if (!unit) { unit = { root: new Group(), body: null, alive: true }; units.set(id, unit); scene.add(unit.root); } return unit; };
    const runtime = createLtkRuntime(library, scene, find);
    await runtime.warm('jinx');
    built.length = 0;
    for (const action of ['attack', 'cast', 'passive'] as const) {
      const own = cues.some(c => (c.action ?? 'cast') === action && c.variant === variant);
      runtime.play('jinx', 'me', ['foe'], action, own ? variant : undefined);
    }
    runtime.update(1 / 60, new Camera());
    expect(built.map(fx => fx.object.userData.ltkSystem as string).sort()).toEqual(skillCuesPlayable(cues, variant).map(c => c.system).sort());
    runtime.dispose();
  });
});
