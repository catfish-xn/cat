import { Camera, Group, Scene, Texture } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { mapSkillTimeline, type TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { createLtkRuntime, MAX_LTK_QUEUED, type VfxUnit } from '../src/rendering/three-mode/vfx-ltk/runtime';
import * as particles from '../src/rendering/three-mode/vfx-ltk/particles';
import { syntheticSystem } from './vfx-ltk-synthetic';
import { stepCombat } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { battle, unit } from './combat-helpers';

const start: TimelineCue = { system: 'start', event: 'cast-start', delay: 0, duration: 1 };
const hit: TimelineCue = { system: 'hit', event: 'hit', delay: .4, duration: 1 };
const flight: TimelineCue = { system: 'flight', event: 'projectile', delay: .1, duration: .3, travelSeconds: .3 };
const runtimes: ReturnType<typeof createLtkRuntime>[] = [];
afterEach(() => { runtimes.splice(0).forEach(runtime => runtime.dispose()); vi.restoreAllMocks(); });

async function setup(cues: readonly TimelineCue[], missingSystem?: string) {
  const library = createVfxLibrary('/synthetic/', {
    readJson: async url => {
      if (url.endsWith('index.json')) return { version: 1, systems: Object.fromEntries(cues.map(c => [c.system, `${c.system}.json`])),
        assets: { 'synthetic.tex': 'texture.png' }, skills: { vander: cues } };
      if (url.endsWith(`/${missingSystem}.json`)) throw Error('synthetic missing system');
      return syntheticSystem();
    }, readTexture: async () => new Texture(),
  });
  const units = new Map<string, VfxUnit>(['self', 'ally', 'enemy'].map((id, i) => {
    const root = new Group(); root.position.set(i * 100, 0, 0); root.updateMatrixWorld(true);
    return [id, { root, body: null, alive: true }];
  }));
  const scene = new Scene(), budget = { live: 0, max: 1500 }, camera = new Camera();
  const runtime = createLtkRuntime(library, scene, id => units.get(id), { budget }); runtimes.push(runtime);
  await runtime.warm('vander');
  return { runtime, scene, units, budget, camera };
}

describe('review R: whole-action target coverage', () => {
  it('plays both Vander cues from the authoritative self-target cast receipt', async () => {
    const caster = unit('self', 'player', 1, 3, { definitionId: 'vander', ability: resolveAbility('vander-ability', 1),
      hp: 4000, maxHp: 5000, mana: 100, maxMana: 100, abilityPower: 100, baseAttackSpeedBps: 10000,
      runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [] });
    const enemy = unit('enemy', 'enemy', 2, 3, { hp: 10000, maxHp: 10000, cooldownTicks: 1000 });
    const cast = stepCombat(battle([caster, enemy], { rngState: 42 })).events
      .find(event => event.type === 'cast');
    expect(cast?.type).toBe('cast'); if (cast?.type !== 'cast' || !('receipt' in cast)) throw Error('missing Vander receipt');
    expect(cast.receipt.targetIds).toEqual(['self']);
    const before = structuredClone(cast), { runtime, scene, budget, camera, units } = await setup([start, hit]);
    const create = vi.spyOn(particles, 'createLtkParticles');
    expect(runtime.play('vander', cast.receipt.source.ownerId, cast.receipt.targetIds)).toBe(true);
    expect(runtime.queued).toBe(2);
    runtime.update(.01, camera); expect(scene.children.map(o => o.userData.ltkSystem)).toEqual(['start']);
    runtime.update(.2, camera); runtime.update(.2, camera);
    expect(scene.children.map(o => o.userData.ltkSystem)).toEqual(['start', 'hit']);
    expect(create.mock.calls[1][1].attachment).toBe(units.get('self'));
    expect(runtime.queued).toBe(0); expect(budget.live).toBe(500); expect(cast).toEqual(before);
  });

  it('keeps self and allies in receipt order, deduplicates hits, and preserves a primary self hit', async () => {
    const primary = { ...hit, system: 'primary', primary: true };
    const targets = ['self', 'ally', 'self', 'enemy', 'ally'];
    const mapped = mapSkillTimeline([start, hit, primary], 'self', targets);
    expect(mapped.unsupported).toEqual([]);
    expect(mapped.spawns.map(c => [c.system, c.targetId])).toEqual([
      ['start', undefined], ['hit', 'self'], ['hit', 'ally'], ['hit', 'enemy'], ['primary', 'self'],
    ]);
    const { runtime, camera, units } = await setup([start, hit, primary]), create = vi.spyOn(particles, 'createLtkParticles');
    expect(runtime.play('vander', 'self', targets)).toBe(true); expect(runtime.queued).toBe(5);
    runtime.update(.2, camera); runtime.update(.2, camera);
    expect(create.mock.calls.map(([, options]) => options.attachment)).toEqual([
      units.get('self'), units.get('self'), units.get('ally'), units.get('enemy'), units.get('self'),
    ]);
  });

  it('allows a projectile to an ally and keeps secondary self hits', async () => {
    const { runtime } = await setup([start, flight, hit]);
    const mapped = mapSkillTimeline([start, flight, hit], 'self', ['ally', 'self', 'ally']);
    expect(mapped.unsupported).toEqual([]);
    expect(mapped.spawns.map(c => [c.system, c.targetId])).toEqual([
      ['start', undefined], ['flight', 'ally'], ['hit', 'ally'], ['hit', 'self'],
    ]);
    expect(runtime.play('vander', 'self', ['ally', 'self', 'ally'])).toBe(true); expect(runtime.queued).toBe(4);
  });

  it.each([['self'], ['self', 'ally'], ['self', 'enemy']])('rejects self flight without retargeting %j', async (...targets) => {
    const mapped = mapSkillTimeline([start, flight, hit], 'self', targets);
    expect(mapped.unsupported).toEqual([{ cue: flight, reason: 'self-projectile' }]);
    expect(mapped.spawns.some(c => c.event === 'projectile')).toBe(false);
    expect(mapped.spawns.filter(c => c.event === 'hit').map(c => c.targetId)).toEqual(targets);
    const { runtime, scene, camera, budget } = await setup([start, flight, hit]);
    expect(runtime.play('vander', 'self', targets)).toBe(false);
    expect(runtime.queued).toBe(0); runtime.update(.2, camera);
    expect(runtime.active).toBe(0); expect(scene.children).toEqual([]); expect(budget.live).toBe(0);
  });

  it.each([hit, { ...hit, primary: true }, flight])('rejects start plus targetless $event atomically', async cue => {
    const { runtime, scene, camera } = await setup([start, cue]);
    expect(mapSkillTimeline([start, cue], 'self', []).unsupported).toEqual([{ cue, reason: 'missing-target' }]);
    expect(runtime.play('vander', 'self', [])).toBe(false);
    expect(runtime.queued).toBe(0); runtime.update(.01, camera); expect(scene.children).toEqual([]);
  });

  it('checks only the active phase for missing targets and keeps attack coverage separate', async () => {
    const cues: TimelineCue[] = [{ ...start, phase: 0 }, { ...flight, phase: 1 }, { ...hit, action: 'attack' }];
    const { runtime } = await setup(cues);
    expect(runtime.play('vander', 'self', [], 0)).toBe(true); expect(runtime.queued).toBe(1); runtime.clear();
    expect(runtime.play('vander', 'self', ['self'], 1)).toBe(false); expect(runtime.queued).toBe(0);
    expect(runtime.play('vander', 'self', [], 2)).toBe(false); expect(runtime.queued).toBe(0);
    expect(runtime.play('vander', 'self', ['self'], 1, 'attack')).toBe(true); expect(runtime.queued).toBe(1);
  });

  it.each(['missing', 'dead', 'disposed'] as const)('keeps the whole multi-target action on fallback for a %s ally', async reason => {
    const { runtime, units } = await setup([start, hit]);
    if (reason === 'missing') units.delete('ally');
    else if (reason === 'dead') units.get('ally')!.alive = false;
    else units.get('ally')!.disposed = true;
    expect(runtime.play('vander', 'self', ['self', 'ally', 'enemy'])).toBe(false); expect(runtime.queued).toBe(0);
  });

  it('does not own a disposed caster or an action with an unloaded impact', async () => {
    const first = await setup([start, hit]); first.units.get('self')!.disposed = true;
    expect(first.runtime.play('vander', 'self', ['self'])).toBe(false); expect(first.runtime.queued).toBe(0);
    const second = await setup([start, hit], 'hit');
    expect(second.runtime.play('vander', 'self', ['self'])).toBe(false); expect(second.runtime.queued).toBe(0);
  });

  it('leaves previously queued actions untouched when coverage or queue capacity rejects a new action', async () => {
    const { runtime } = await setup([start, hit]);
    for (let i = 0; i < MAX_LTK_QUEUED / 2; i++) expect(runtime.play('vander', 'self', ['self'])).toBe(true);
    expect(runtime.queued).toBe(MAX_LTK_QUEUED);
    expect(runtime.play('vander', 'self', [])).toBe(false); expect(runtime.queued).toBe(MAX_LTK_QUEUED);
    expect(runtime.play('vander', 'self', ['self'])).toBe(false); expect(runtime.queued).toBe(MAX_LTK_QUEUED);
  });
});
