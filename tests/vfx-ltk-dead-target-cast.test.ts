import { describe, expect, it } from 'vitest';
import { Camera, Group, Scene, Texture } from 'three';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
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
interface Case { name: string; champion: string; skill: string; cues: TimelineCue[]; castIndex: number }
const cases: Case[] = [];
for (const [, table] of sources) for (const [skill, all] of Object.entries(table)) {
  const champion = ownerOf(skill); if (!champion || !/[a-z]/.test(skill[0]!)) continue;
  const cast = all.filter(c => (c.action ?? 'cast') === 'cast' && c.variant === undefined);
  for (const castIndex of new Set(cast.map(c => c.phase ?? 0))) {
    const cues = cast.filter(c => c.phase === undefined || c.phase === castIndex);
    const mapped = mapSkillTimeline(cues, 'self', ['t1', 't2'], castIndex, board);
    if (mapped.unsupported.length || cues.length > 12 || !mapped.spawns.some(s => s.targetId !== undefined && !s.optional)) continue;
    cases.push({ name: `${skill}#${castIndex}`, champion, skill, cues, castIndex });
  }
}

async function setup(c: Case, target: 'dead' | 'disposed') {
  const systems = Object.fromEntries(c.cues.map(cue => [cue.system, 'a.json']));
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems, assets: { 'synthetic.tex': 'a.png' }, skills: { [c.champion]: c.cues, [c.skill]: c.cues } } : syntheticSystem(), readTexture: async () => new Texture() });
  const unit = (alive: boolean, disposed = false): VfxUnit => ({ root: new Group(), body: null, alive, disposed });
  const units = new Map([['self', unit(true)], ['t1', unit(false, target === 'disposed')], ['t2', unit(false, target === 'disposed')]]);
  units.get('t1')!.root.position.set(3, 0, 4);
  const scene = new Scene(), runtime = createLtkRuntime(library, scene, id => units.get(id));
  await runtime.warm(c.champion);
  return { runtime, scene, units };
}

describe('a cast whose target died before it started (gap list item 13)', () => {
  it('covers the shipped cast timelines that need a target', () => { expect(cases.length).toBeGreaterThanOrEqual(25); });

  it.each(cases.map(c => [c.name, c] as const))('%s: a dead target keeps every cue, hit at the body\'s last point', async (_, c) => {
    const { runtime, scene } = await setup(c, 'dead');
    const mapped = mapSkillTimeline(c.cues, 'self', ['t1', 't2'], c.castIndex, board);
    const kept = mapped.spawns.filter(s => s.targetId === undefined || !s.optional);
    expect(runtime.play(c.champion, 'self', ['t1', 't2'], c.castIndex, 'cast', { skill: c.skill, board })).toBe(true);
    expect(runtime.queued).toBe(kept.length);
    // The caster's own cues start on time.
    const caster = new Set(kept.filter(s => s.targetId === undefined).map(s => s.system)), seen = new Set<string>();
    const until = Math.max(0, ...kept.filter(s => s.targetId === undefined).map(s => s.delay)) + .05;
    for (let t = 0; t <= until; t += .02) { runtime.update(.02, new Camera()); for (const o of scene.children) seen.add(o.userData.ltkSystem); }
    for (const system of caster) expect(seen).toContain(system);
    runtime.dispose();
  });

  it.each(cases.map(c => [c.name, c] as const))('%s: a target whose model is gone loses only its own cues', async (_, c) => {
    const { runtime } = await setup(c, 'disposed');
    const mapped = mapSkillTimeline(c.cues, 'self', ['t1', 't2'], c.castIndex, board);
    const own = mapped.spawns.filter(s => s.targetId === undefined);
    expect(runtime.play(c.champion, 'self', ['t1', 't2'], c.castIndex, 'cast', { skill: c.skill, board })).toBe(own.length > 0);
    expect(runtime.queued).toBe(own.length);
    runtime.dispose();
  });

  it('places a dead target\'s hit at the body, and an attack keeps its whole-action fallback', async () => {
    const hit: TimelineCue = { system: 'h', event: 'hit', delay: 0, duration: 1 };
    const c: Case = { name: 'probe', champion: 'garen', skill: 'garen', cues: [{ system: 's', event: 'cast-start', delay: 0, duration: 1 }, hit, { ...hit, system: 'a', action: 'attack' }], castIndex: 0 };
    const { runtime, scene } = await setup(c, 'dead');
    expect(runtime.play('garen', 'self', ['t1'], 0, 'cast')).toBe(true);
    runtime.update(.01, new Camera());
    const placed = scene.children.find(o => o.userData.ltkSystem === 'h');
    expect(placed?.userData.poolUnit).toBeUndefined(); // a world point, not the corpse's bones
    runtime.clear();
    expect(runtime.play('garen', 'self', ['t1'], 0, 'attack')).toBe(false);
    runtime.dispose();
  });
});
