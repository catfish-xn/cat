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
import { createVfxLibrary, parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, LTK_RUN_STATS, MAX_LTK_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { FX_SCALE } from '../src/rendering/three-mode/vfx-ltk/particles';
import { AXIS_SIGN } from '../src/rendering/three-mode/vfx-ltk/space';
import { syntheticSystem } from './vfx-ltk-synthetic';

// A cast whose target is dead, by the time it plays or by the time a cue of it starts, plays at the place that target
// stood when the cast played; a living target is followed as before. Only a target whose unit is gone loses its rows.
const hit = (system: string, delay: number, extra: Partial<TimelineCue> = {}): TimelineCue => ({ system, action: 'cast', event: 'hit', delay, duration: 0.6, ...extra });
const shot: TimelineCue = { system: 'shot', action: 'cast', event: 'projectile', delay: 0, duration: 0.5, travelSeconds: 0.5, primary: true };
const skills: Record<string, TimelineCue[]> = {
  blast: [{ system: 'flourish', action: 'cast', event: 'cast-start', delay: 0, duration: 0.6 }, hit('boom', 0)],
  later: [hit('boom', 0.3)],
  missile: [shot],
  swing: [{ ...hit('spark', 0), action: 'attack' }],
  curse: [hit('curse', 0.3, { livingTarget: true }), hit('boom', 0.3)],
  // A long flourish (decorative): a living target's hit may evict it, a hit at a dead target's place may not.
  glow: [{ system: 'glow', action: 'passive', event: 'cast-start', delay: 0, duration: 5 }],
  pair: [hit('boom', 0)],
  // One hit on every target, the rows starting together (one together group): a living and a dead target mixed.
  duo: [hit('boom', 0, { together: 'duo' })],
};
const systems = ['flourish', 'boom', 'shot', 'spark', 'curse', 'glow'];
const toSystem = (p: { x: number; y: number; z: number }) => [p.x * AXIS_SIGN[0] / FX_SCALE, p.y / FX_SCALE, p.z / FX_SCALE];

async function setup() {
  built.length = 0;
  for (const key of Object.keys(LTK_RUN_STATS.skipped)) delete LTK_RUN_STATS.skipped[key];
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: Object.fromEntries(systems.map(s => [s, `systems/${s}.json`])), assets: { 'synthetic.tex': 'texture.png' }, skills }
    : syntheticSystem(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean; disposed?: boolean }>();
  ['caster', 'a', 'b'].forEach((id, i) => { const root = new Group(); root.position.set(10 + i * 60, 0, 20 + i * 30); scene.add(root); root.updateMatrixWorld(); units.set(id, { root, body: null, alive: true }); });
  const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
  for (const champion of Object.keys(skills)) await runtime.warm(champion);
  const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
  // The system each build was for, filled in as the runtime names it.
  const of = (system: string) => built.filter(entry => entry.fx.object.userData.ltkSystem === system);
  return { runtime, scene, units, step, of };
}

describe('vfx-ltk casts at dead targets', () => {
  it('a cast with one dead target plays: the living one is followed, the dead one gets its hit at its place', async () => {
    const { runtime, units, step, of } = await setup();
    units.get('b')!.alive = false;
    expect(runtime.play('blast', 'caster', ['a', 'b'])).toBe(true);
    step(1 / 60);
    const booms = of('boom');
    expect(booms).toHaveLength(2);
    const onLiving = booms.find(entry => entry.options.attachment === units.get('a'))!, onDead = booms.find(entry => entry !== onLiving)!;
    expect(onLiving).toBeDefined();
    expect(onDead.options.attachment).toBeUndefined();
    expect(onDead.options.anchor.originAt(0)).toEqual(toSystem(units.get('b')!.root.position));
    expect(of('flourish')).toHaveLength(1);
    runtime.dispose();
  });

  it('a target whose unit is gone loses only its own rows; with no usable target left the cast is refused', async () => {
    let { runtime, units, step, of } = await setup();
    units.get('b')!.disposed = true;
    expect(runtime.play('blast', 'caster', ['a', 'b'])).toBe(true);
    step(1 / 60);
    expect(of('boom')).toHaveLength(1);
    expect(of('boom')[0].options.attachment).toBe(units.get('a'));
    expect(LTK_RUN_STATS.skipped['boom target-gone']).toBe(1);
    runtime.dispose();
    ({ runtime, units } = await setup());
    units.delete('a'); units.get('b')!.disposed = true;
    expect(runtime.play('blast', 'caster', ['a', 'b'])).toBe(false);
    runtime.dispose();
  });

  it('a dead caster still refuses a cast whose cues ride on it', async () => {
    const { runtime, units } = await setup();
    units.get('caster')!.alive = false;
    expect(runtime.play('blast', 'caster', ['a'])).toBe(false);
    runtime.dispose();
  });

  it('a target that dies before its cue starts gets it at the place it stood when the cast played, its death notice or not', async () => {
    for (const notice of [false, true]) {
      const { runtime, units, step, of } = await setup();
      const at = units.get('a')!.root.position.clone();
      expect(runtime.play('later', 'caster', ['a'])).toBe(true);
      step(0.1);
      units.get('a')!.alive = false;
      units.get('a')!.root.position.x += 40; units.get('a')!.root.updateMatrixWorld();
      if (notice) runtime.stopUnit('a');
      step(0.3);
      expect(of('boom')).toHaveLength(1);
      expect(of('boom')[0].options.attachment).toBeUndefined();
      expect(of('boom')[0].options.anchor.originAt(0)).toEqual(toSystem(at));
      runtime.dispose();
    }
  });

  it('a living target is followed exactly as before: it moves after the cast and the hit lands on it', async () => {
    const { runtime, units, step, of } = await setup();
    expect(runtime.play('later', 'caster', ['a'])).toBe(true);
    step(0.1);
    units.get('a')!.root.position.x += 40; units.get('a')!.root.updateMatrixWorld();
    step(0.3);
    expect(of('boom')).toHaveLength(1);
    expect(of('boom')[0].options.attachment).toBe(units.get('a'));
    expect(of('boom')[0].options.anchor.originAt(0)).toEqual(toSystem(units.get('a')!.root.position));
    runtime.dispose();
  });

  it('a plain attack at a dead target is not replayed at its place: it falls back as before', async () => {
    const { runtime, units } = await setup();
    units.get('a')!.alive = false;
    const before = LTK_RUN_STATS.refused['no-target'] ?? 0;
    expect(runtime.play('swing', 'caster', ['a'], 'attack')).toBe(false);
    expect(LTK_RUN_STATS.refused['no-target']).toBe(before + 1);
    runtime.dispose();
  });

  it('a state its target carries (livingTarget) is not played where a dead target stood; the cast\'s other rows are', async () => {
    const { runtime, units, step, of } = await setup();
    expect(runtime.play('curse', 'caster', ['a'])).toBe(true);
    units.get('a')!.alive = false;
    step(0.4);
    expect(of('curse')).toHaveLength(0);
    expect(of('boom')).toHaveLength(1);
    runtime.dispose();
  });

  it('a cue on the caster itself goes with the caster: not played where it died', async () => {
    const { runtime, units, step, of } = await setup();
    expect(runtime.play('later', 'caster', ['caster'])).toBe(true);
    units.get('caster')!.alive = false; runtime.stopUnit('caster');
    step(0.4);
    expect(of('boom')).toHaveLength(0);
    runtime.dispose();
  });

  it('livingTarget parses only as a boolean on a hit or a projectile', () => {
    const index = (cue: unknown) => ({ version: 1, systems: { boom: 'systems/boom.json' }, assets: {}, skills: { x: [cue] } });
    expect(() => parseIndex(index(hit('boom', 0, { livingTarget: true })))).not.toThrow();
    expect(() => parseIndex(index({ ...shot, system: 'boom', livingTarget: true }))).not.toThrow();
    expect(() => parseIndex(index({ ...hit('boom', 0), event: 'cast-start', livingTarget: true }))).toThrow();
    expect(() => parseIndex(index({ ...hit('boom', 0), livingTarget: 1 }))).toThrow();
  });

  // Fable 11-13 (A): a row at a dead target's place only takes free room. It never waits, never evicts, so it only adds.
  it('on a full board a hit at a dead target\'s place is dropped and evicts nothing; the living target\'s hit starts that frame', async () => {
    const { runtime, scene, units, step, of } = await setup();
    for (let i = 0; i < MAX_LTK_SYSTEMS; i++) expect(runtime.play('glow', 'caster', [], 'passive')).toBe(true);
    step(Math.ceil(MAX_LTK_SYSTEMS / 6) / 60); // at most six starts a frame
    expect(of('glow').filter(entry => entry.fx.object.parent === scene)).toHaveLength(MAX_LTK_SYSTEMS);
    for (const key of Object.keys(LTK_RUN_STATS.placeDropped)) delete LTK_RUN_STATS.placeDropped[key];
    const dropped = LTK_RUN_STATS.dropped.boom ?? 0;
    // The dead target first: its row is weighed first and must not take the slot the living one then needs.
    units.get('b')!.alive = false;
    expect(runtime.play('pair', 'caster', ['b', 'a'])).toBe(true);
    step(1 / 60);
    const booms = of('boom').filter(entry => entry.fx.object.parent === scene);
    expect(booms).toHaveLength(1);
    expect(booms[0].options.attachment).toBe(units.get('a'));
    expect(LTK_RUN_STATS.placeDropped.boom).toBe(1);
    expect(LTK_RUN_STATS.dropped.boom ?? 0).toBe(dropped);
    // The living hit made its own room (one flourish evicted); the dead one's made none.
    expect(of('glow').filter(entry => entry.fx.object.parent === scene)).toHaveLength(MAX_LTK_SYSTEMS - 1);
    expect(runtime.queued).toBe(0);
    runtime.dispose();
  });

  it('a run at a dead target\'s place gives way first, to a living target\'s hit and to a plain attack', async () => {
    for (const newcomer of ['pair', 'swing'] as const) {
      const { runtime, scene, units, step, of } = await setup();
      // One hit at a dead target's place, then flourishes up to the cap.
      units.get('b')!.alive = false;
      expect(runtime.play('pair', 'caster', ['b'])).toBe(true);
      step(1 / 60);
      for (let i = 0; i < MAX_LTK_SYSTEMS - 1; i++) expect(runtime.play('glow', 'caster', [], 'passive')).toBe(true);
      step(Math.ceil(MAX_LTK_SYSTEMS / 6) / 60); // at most six starts a frame
      expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
      const [spare] = of('boom');
      expect(spare.fx.object.parent).toBe(scene);
      expect(runtime.play(newcomer, 'caster', ['a'], newcomer === 'swing' ? 'attack' : 'cast')).toBe(true);
      step(1 / 60);
      // The spare run left; no flourish did; the newcomer runs.
      expect(spare.fx.object.parent).toBeNull();
      expect(of('glow').filter(entry => entry.fx.object.parent === scene)).toHaveLength(MAX_LTK_SYSTEMS - 1);
      expect(of(newcomer === 'swing' ? 'spark' : 'boom').filter(entry => entry.fx.object.parent === scene && entry !== spare)).toHaveLength(1);
      runtime.dispose();
    }
  });

  // Review 11-13: a together group with a living and a dead target is an ordinary group, whichever target comes first.
  it('a together group mixing a living and a dead target is an ordinary group: a newcomer never takes its living row', async () => {
    for (const order of [['a', 'b'], ['b', 'a']]) {
      const { runtime, scene, units, step, of } = await setup();
      units.get('b')!.alive = false;
      expect(runtime.play('duo', 'caster', order)).toBe(true);
      step(1 / 60);
      const group = of('boom').filter(entry => entry.fx.object.parent === scene);
      expect(group).toHaveLength(2);
      for (let i = 0; i < MAX_LTK_SYSTEMS - 1; i++) expect(runtime.play('glow', 'caster', [], 'passive')).toBe(true);
      step(Math.ceil(MAX_LTK_SYSTEMS / 6) / 60); // at most six starts a frame
      // A plain attack on the full board: nothing is spare, so it is dropped and the group stays whole.
      expect(runtime.play('swing', 'caster', ['a'], 'attack')).toBe(true);
      step(1 / 60);
      for (const entry of group) expect(entry.fx.object.parent).toBe(scene);
      expect(of('spark')).toHaveLength(0);
      runtime.dispose();
    }
  });

  it('on a full board a mixed together group waits or evicts as an ordinary group; its living row is not dropped with the dead one', async () => {
    for (const order of [['a', 'b'], ['b', 'a']]) {
      const { runtime, scene, units, step, of } = await setup();
      for (let i = 0; i < MAX_LTK_SYSTEMS; i++) expect(runtime.play('glow', 'caster', [], 'passive')).toBe(true);
      step(Math.ceil(MAX_LTK_SYSTEMS / 6) / 60); // at most six starts a frame
      units.get('b')!.alive = false;
      const placeDropped = LTK_RUN_STATS.placeDropped.boom ?? 0;
      expect(runtime.play('duo', 'caster', order)).toBe(true);
      step(1 / 60);
      // The group took a flourish's slot (a group is one slot) and both its rows run, the living one on its unit.
      const booms = of('boom').filter(entry => entry.fx.object.parent === scene);
      expect(booms).toHaveLength(2);
      expect(booms.some(entry => entry.options.attachment === units.get('a'))).toBe(true);
      expect(of('glow').filter(entry => entry.fx.object.parent === scene)).toHaveLength(MAX_LTK_SYSTEMS - 1);
      expect(LTK_RUN_STATS.placeDropped.boom ?? 0).toBe(placeDropped);
      runtime.dispose();
    }
  });

  it('with free room a hit at a dead target\'s place plays, counted apart from the rows that compete for room', async () => {
    const { runtime, units, step, of } = await setup();
    const started = LTK_RUN_STATS.placeStarted.boom ?? 0, competing = LTK_RUN_STATS.started.boom ?? 0;
    units.get('b')!.alive = false;
    expect(runtime.play('pair', 'caster', ['b'])).toBe(true);
    step(1 / 60);
    expect(of('boom')).toHaveLength(1);
    expect(LTK_RUN_STATS.placeStarted.boom).toBe(started + 1);
    expect(LTK_RUN_STATS.started.boom ?? 0).toBe(competing);
    runtime.dispose();
  });

  it('a projectile in flight when its target dies flies on to where the target was and is not cut', async () => {
    const { runtime, units, step, of } = await setup();
    expect(runtime.play('missile', 'caster', ['a'])).toBe(true);
    step(0.2);
    const [flight] = of('shot');
    expect(flight).toBeDefined();
    const at = units.get('a')!.root.position.clone();
    units.get('a')!.alive = false; runtime.stopUnit('a');
    // The unit's root moves on (or is dropped) after its death: the flight keeps the place it last saw.
    units.get('a')!.root.position.x += 40; units.get('a')!.root.updateMatrixWorld();
    expect(flight.options.target.originAt(0)).toEqual(toSystem(at));
    expect(flight.fx.object.parent).not.toBeNull();
    step(0.1);
    expect(flight.fx.stopped ?? false).toBe(false);
    runtime.dispose();
  });

  it('a dead target in a variant takeover plays at its place too (playVariant)', async () => {
    const { runtime, units, step, of } = await setup();
    units.get('a')!.alive = false;
    expect(runtime.playVariant('blast', 'blast', 'caster', ['a'])).toBe(true);
    step(1 / 60);
    expect(of('boom')).toHaveLength(1);
    expect(of('boom')[0].options.anchor.originAt(0)).toEqual(toSystem(units.get('a')!.root.position));
    runtime.dispose();
  });
});
