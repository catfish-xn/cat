import { Group, Scene, Texture } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { CUE_BRANCHES, withCueBranches } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { createVfxLibrary, parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, type VfxUnit } from '../src/rendering/three-mode/vfx-ltk/runtime';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { createBatch2VfxBridge } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import { selectCastSequence } from '../src/rendering3d/animation-mixer';
import { syntheticSystem } from './vfx-ltk-synthetic';

// Ambessa's six cast systems as the live index lists them (timing here is synthetic; only the system ids matter).
const tags = CUE_BRANCHES.ambessa;
const cast = (system: string, event: TimelineCue['event'] = 'cast-start'): TimelineCue => ({ system, action: 'cast', event, delay: 0, duration: 1 });
const attack: TimelineCue = { system: '0f2af66b', action: 'attack', event: 'hit', delay: .2, duration: 1 };
const cues: TimelineCue[] = [attack, ...Object.keys(tags).map(system => cast(system))];
const runtimes: ReturnType<typeof createLtkRuntime>[] = [];
afterEach(() => { runtimes.splice(0).forEach(runtime => runtime.dispose()); });

async function setup(list: readonly TimelineCue[]) {
  const library = createVfxLibrary('/synthetic/', {
    readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: Object.fromEntries(list.map(c => [c.system, `${c.system}.json`])), assets: { 'synthetic.tex': 'texture.png' }, skills: { ambessa: list } }
      : syntheticSystem(),
    readTexture: async () => new Texture(),
  });
  const units = new Map<string, VfxUnit>(['self', 'enemy'].map((id, i) => {
    const root = new Group(); root.position.set(i * 100, 0, 0); root.updateMatrixWorld(true);
    return [id, { root, body: null, alive: true }];
  }));
  const runtime = createLtkRuntime(library, new Scene(), id => units.get(id), { budget: { live: 0, max: 1500 } }); runtimes.push(runtime);
  await runtime.warm('ambessa');
  return runtime;
}

describe('cast branch: effects follow the rule branch', () => {
  it('tags only the cast cues it names, and only when every tagged system is exported', () => {
    const tagged = withCueBranches('ambessa', cues)!;
    expect(tagged.filter(c => c.branch === 'chain').map(c => c.system).sort()).toEqual(['3b4c15e0', '8a64f4dd']);
    expect(tagged.filter(c => c.branch === 'fist')).toHaveLength(4);
    expect(tagged.find(c => c.action === 'attack')!.branch).toBeUndefined();
    expect(withCueBranches('ambessa', cues.filter(c => c.system !== '3b4c15e0'))).toBeUndefined();
    expect(withCueBranches('vander', cues)).toBeUndefined();
    expect(() => parseIndex({ version: 1, systems: Object.fromEntries(tagged.map(c => [c.system, 'x.json'])), assets: {}, skills: { ambessa: tagged } })).not.toThrow();
    expect(() => parseIndex({ version: 1, systems: { a: 'a.json' }, assets: {}, skills: { ambessa: [{ ...cast('a'), branch: 'no spaces' }] } })).toThrow();
  });

  it.each([['chain', 2], ['fist', 4]] as const)('a %s cast plays only its %i systems', async (branch, count) => {
    const runtime = await setup(cues);
    expect(runtime.play('ambessa', 'self', ['enemy'], 0, 'cast', { branch })).toBe(true);
    expect(runtime.queued).toBe(count);
  });

  it('never picks a branch from the cast count: without the event branch no branched system plays', async () => {
    const runtime = await setup(cues);
    for (const index of [0, 1, 2, 3]) { runtime.play('ambessa', 'self', ['enemy'], index, 'cast'); expect(runtime.queued).toBe(0); }
    expect(runtime.play('ambessa', 'self', ['enemy'], 0, 'attack')).toBe(true); expect(runtime.queued).toBe(1);
  });

  it('the bridge reads the rule branch off the cast event, and the animation picks the same branch', () => {
    const bridge = createBatch2VfxBridge({ unit: () => ({ definitionId: 'ambessa', form: 'front', starLevel: 1, alive: true }), board: () => null, play: () => true });
    const event = { type: 'cast', tick: 1, eventSeq: 1, sourceId: 'self', actionSeq: 3, completed: true, actualManaSpent: 100, refundedMana: 0,
      targetIds: ['enemy'], completionCell: { col: 1, row: 1 } } as never as Parameters<typeof bridge.branch>[0];
    expect(bridge.branch(event)).toBeUndefined();
    expect(bridge.branch({ ...event, branch: { castIndex: 2, branch: 'fist' } } as typeof event)).toBe('fist');
    const metadata = { castSequence: { main: 'spellfist_throw' }, castVariants: { branch: { chain: { main: 'spellchain_strike' }, fist: { in: 'spellfist_dash', main: 'spellfist_throw' } } } };
    expect(selectCastSequence(metadata, 0, { branch: 'chain' })).toEqual({ main: 'spellchain_strike' });
    expect(selectCastSequence(metadata, 1, { branch: 'fist' })).toEqual({ in: 'spellfist_dash', main: 'spellfist_throw' });
  });
});
