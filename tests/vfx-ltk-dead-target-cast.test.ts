import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Camera, Group, Scene, Texture } from 'three';
import { createVfxLibrary, withCueOverrides, type VfxIndex, type VfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, type VfxUnit } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { mapSkillTimeline, type TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { BATCH1_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/batch1-timelines';
import { S13_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/s13-timelines';
import { batch3Timelines } from '../src/rendering/three-mode/vfx-ltk/batch3';
import { jayceSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jayce';
import { jinxSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jinx';
import { melSkills } from '../src/rendering/three-mode/vfx-ltk/champions/mel';
import { sevikaSkills } from '../src/rendering/three-mode/vfx-ltk/champions/sevika';
import { viktorSkills } from '../src/rendering/three-mode/vfx-ltk/champions/viktor';
import { warwickSkills } from '../src/rendering/three-mode/vfx-ltk/champions/warwick';
import { syntheticSystem } from './vfx-ltk-synthetic';

// Every cast timeline the repository ships, as champion → skill → cues. The data are the cue shapes only; every
// system below is the synthetic one.
const sources: [string, Record<string, readonly TimelineCue[]>][] = [
  ['override', CUE_OVERRIDES as Record<string, readonly TimelineCue[]>], ['batch1', BATCH1_TIMELINES], ['s13', S13_TIMELINES],
  ['batch3', Object.assign({}, ...Object.values(batch3Timelines))], ['jayce', jayceSkills], ['jinx', jinxSkills], ['mel', melSkills],
  ['sevika', sevikaSkills], ['viktor', viktorSkills], ['warwick', warwickSkills],
];
const board = [0, 0, 0] as const;
const champions = ['g23-sion', ...new Set(Object.values(sources).flatMap(([, table]) => Object.keys(table)).map(k => k.split('-')[0]!))];
const ownerOf = (skill: string) => champions.find(c => skill === c || skill.startsWith(c + '-'));
interface Case { name: string; champion: string; skill: string; cues: TimelineCue[]; castIndex: number; action: 'cast' | 'attack' }
/** Each cast phase and each attack of a skill table whose timeline needs a target. */
function casesOf(table: Record<string, readonly TimelineCue[]>, ownerOf: (skill: string) => string | undefined): Case[] {
  const found: Case[] = [];
  for (const [skill, all] of Object.entries(table)) {
    const champion = ownerOf(skill); if (!champion || !/[a-z]/.test(skill[0]!)) continue;
    for (const action of ['cast', 'attack'] as const) {
      const own = all.filter(c => (c.action ?? 'cast') === action && c.variant === undefined);
      for (const castIndex of new Set(own.map(c => c.phase ?? 0))) {
        const cues = own.filter(c => c.phase === undefined || c.phase === castIndex);
        const mapped = mapSkillTimeline(cues, 'self', ['t1', 't2'], castIndex, board);
        if (mapped.unsupported.length || cues.length > 12 || !mapped.spawns.some(s => s.targetId !== undefined && !s.optional)) continue;
        found.push({ name: `${skill}${action === 'attack' ? ' attack' : ''}#${castIndex}`, champion, skill, cues, castIndex, action });
      }
    }
  }
  return found;
}
const cases = sources.flatMap(([, table]) => casesOf(table, ownerOf));

type Target = 'dead' | 'disposed';
const syntheticLibrary = (c: Case) => {
  const systems = Object.fromEntries(c.cues.map(cue => [cue.system, 'a.json']));
  return createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems, assets: { 'synthetic.tex': 'a.png' }, skills: { [c.champion]: c.cues, [c.skill]: c.cues } } : syntheticSystem(), readTexture: async () => new Texture() });
};

async function setup(c: Case, target: Target, library: VfxLibrary = syntheticLibrary(c)) {
  const unit = (alive: boolean, disposed = false): VfxUnit => ({ root: new Group(), body: null, alive, disposed });
  const units = new Map([['self', unit(true)], ['t1', unit(false, target === 'disposed')], ['t2', unit(false, target === 'disposed')]]);
  units.get('t1')!.root.position.set(3, 0, 4);
  const scene = new Scene(), runtime = createLtkRuntime(library, scene, id => units.get(id));
  await runtime.warm(c.champion);
  return { runtime, scene, units };
}

/** Dead target: `play` owns the action, queues what a living target would (less optional target cues), and the
 * caster's own cues start on time. */
async function expectDead(c: Case, library?: VfxLibrary) {
  const { runtime, scene } = await setup(c, 'dead', library);
  const mapped = mapSkillTimeline(c.cues, 'self', ['t1', 't2'], c.castIndex, board);
  const kept = mapped.spawns.filter(s => s.targetId === undefined || !s.optional);
  expect(runtime.play(c.champion, 'self', ['t1', 't2'], c.castIndex, c.action, { skill: c.skill, board })).toBe(true);
  expect(runtime.queued).toBe(kept.length);
  const caster = new Set(kept.filter(s => s.targetId === undefined).map(s => s.system)), seen = new Set<string>();
  const until = Math.max(0, ...kept.filter(s => s.targetId === undefined).map(s => s.delay)) + .05;
  for (let t = 0; t <= until; t += .02) { runtime.update(.02, new Camera()); for (const o of scene.children) seen.add(o.userData.ltkSystem); }
  for (const system of caster) expect(seen).toContain(system);
  runtime.dispose();
}

/** Target model gone: only the cues on that target are dropped. */
async function expectDisposed(c: Case, library?: VfxLibrary) {
  const { runtime } = await setup(c, 'disposed', library);
  const own = mapSkillTimeline(c.cues, 'self', ['t1', 't2'], c.castIndex, board).spawns.filter(s => s.targetId === undefined);
  expect(runtime.play(c.champion, 'self', ['t1', 't2'], c.castIndex, c.action, { skill: c.skill, board })).toBe(own.length > 0);
  expect(runtime.queued).toBe(own.length);
  runtime.dispose();
}

describe('a cast or attack whose target died before it started (gap list item 13)', () => {
  it('covers the shipped cast and attack timelines that need a target', () => {
    expect(cases.filter(c => c.action === 'cast').length).toBeGreaterThanOrEqual(25);
    expect(cases.filter(c => c.action === 'attack').length).toBeGreaterThanOrEqual(5);
  });

  it.each(cases.map(c => [c.name, c] as const))('%s: a dead target keeps every cue, hit at the body\'s last point', async (_, c) => expectDead(c));

  it.each(cases.map(c => [c.name, c] as const))('%s: a target whose model is gone loses only its own cues', async (_, c) => expectDisposed(c));

  it.each(['cast', 'attack'] as const)('places a dead target\'s %s hit at the body\'s last point, not on its bones', async action => {
    const hit: TimelineCue = { system: 'h', event: 'hit', delay: 0, duration: 1, action };
    const c: Case = { name: 'probe', champion: 'garen', skill: 'garen', cues: [{ system: 's', event: 'cast-start', delay: 0, duration: 1, action }, hit], castIndex: 0, action };
    const { runtime, scene } = await setup(c, 'dead');
    expect(runtime.play('garen', 'self', ['t1'], 0, action)).toBe(true);
    runtime.update(.01, new Camera());
    const placed = scene.children.find(o => o.userData.ltkSystem === 'h');
    expect(placed).toBeDefined();
    expect(placed!.userData.poolUnit).toBeUndefined(); // a world point, not the corpse's bones
    runtime.dispose();
  });

  it('a passive keeps its whole-action fallback for a dead target', async () => {
    const c: Case = { name: 'probe', champion: 'garen', skill: 'garen', castIndex: 0, action: 'cast',
      cues: [{ system: 's', event: 'cast-start', delay: 0, duration: 1, action: 'passive' }, { system: 'h', event: 'hit', delay: 0, duration: 1, action: 'passive' }] };
    const { runtime } = await setup(c, 'dead');
    expect(runtime.play('garen', 'self', ['t1'], 0, 'passive')).toBe(false);
    expect(runtime.queued).toBe(0);
    runtime.dispose();
  });
});

// The deployed effect index (exported 14.24 data) is not in the repository. Point LTK_SERVED_ROOT at a local copy of the
// served vfx-ltk root (its index.json plus each champion's index.json) to run the same checks on every served skill; systems
// stay synthetic, so this checks the runtime's target handling, not how each effect looks.
const servedRoot = process.env.LTK_SERVED_ROOT;
const served: Case[] = [];
let servedLibrary: (() => VfxLibrary) | undefined;
if (servedRoot) {
  // Every served system is replaced by the synthetic one, so each index also lists the synthetic texture.
  const read = (path: string) => { const raw = JSON.parse(readFileSync(join(servedRoot, path), 'utf8'));
    return raw.assets ? { ...raw, assets: { ...raw.assets, 'synthetic.tex': 'synthetic.png' } } : raw; };
  const root = read('index.json') as { champions: Record<string, string> };
  const champions = Object.keys(root.champions).filter(id => !id.startsWith('anvil-'));
  const owner = (skill: string) => champions.filter(c => skill === c || skill.startsWith(c + '-')).sort((a, b) => b.length - a.length)[0];
  for (const [champion, path] of Object.entries(root.champions)) if (!champion.startsWith('anvil-'))
    served.push(...casesOf(withCueOverrides(read(path) as VfxIndex).skills as Record<string, TimelineCue[]>, owner).filter(c => c.champion === champion));
  servedLibrary = () => createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? read(url.replace(/^\/root\/vfx-ltk\//, '')) : syntheticSystem(),
    readTexture: async () => new Texture() });
}

describe.skipIf(!servedRoot)('served effect index: a dead or gone target (gap list item 13, LTK_SERVED_ROOT)', () => {
  it('finds the served casts and attacks that need a target', () => {
    console.log(`served: ${served.filter(c => c.action === 'cast').length} casts, ${served.filter(c => c.action === 'attack').length} attacks`);
    expect(served.filter(c => c.action === 'cast').length).toBeGreaterThanOrEqual(60);
  });
  it.each(served.map(c => [c.name, c] as const))('%s: dead target', async (_, c) => expectDead(c, servedLibrary!()));
  it.each(served.map(c => [c.name, c] as const))('%s: target model gone', async (_, c) => expectDisposed(c, servedLibrary!()));
});
