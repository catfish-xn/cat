import { describe, expect, it } from 'vitest';
// @ts-expect-error Offline tooling uses native ESM.
import { CAST_GRAPH_KEY_OVERRIDES, graphKeyHash, mapStagesToSequence, maskBoneWeights, planGraphAction } from '../scripts/assets3d/stage-anim-sequences.mjs';
import { assertManifest } from '../src/rendering3d/contracts';

const atomic = (clipName: string, mask?: Record<string, number>) => ({
  kind: 'Atomic', keyName: clipName, clipName, startFrame: null, endFrame: null,
  effectiveStartFrame: 0, effectiveEndFrame: 30, lastFrame: 30, fps: 30, ...(mask ? { mask } : {}),
});

describe('original bone masks of parallel casts', () => {
  it('reads a graph weight list in skeleton order as bone weights, without the zeros', () => {
    expect(maskBoneWeights([0.4, 0, 1, 0.5], ['Root', 'Pelvis', 'Spine1', 'Hair1'])).toEqual({ Root: 0.4, Spine1: 1, Hair1: 0.5 });
    expect(maskBoneWeights([0, 0], ['Root', 'Pelvis'])).toBeNull();
    // A list that does not match the skeleton is not guessed at.
    expect(maskBoneWeights([1, 1, 1], ['Root', 'Pelvis'])).toBeNull();
  });

  it('keeps the masks of the parallel stage only', () => {
    expect(mapStagesToSequence(['body'], ['water'], { water: { Water: 1 }, unrelated: { Root: 1 } })).toEqual({
      sequence: { main: 'body', layers: ['water'], masks: { water: { Water: 1 } } }, skipReason: null,
    });
    // No layers: a mask has nothing to lay over.
    expect(mapStagesToSequence(['wind', 'body'], [], { body: { Root: 1 } })).toEqual({
      sequence: { in: 'wind', main: 'body' }, skipReason: null,
    });
  });

  it('plans a Parallel cast with its children\'s masks, as the manifest accepts them', () => {
    const plan = planGraphAction({ kind: 'Parallel', keyName: 'Spell', children: [
      atomic('spell1', { Root: 0.4, Spine1: 1 }), atomic('spell2'),
    ] }, { action: 'cast', entry: {} });
    expect(plan).toMatchObject({ status: 'ok', castSequence: {
      main: 'spell1', layers: ['spell2'], masks: { spell1: { Root: 0.4, Spine1: 1 } },
    } });
    expect(() => assertManifest({ schemaVersion: 1, models: { heimerdinger: { path: 'h.glb', castSequence: plan.castSequence } } })).not.toThrow();
  });

  it('plays Darius\'s Spell1_IN → Spell1 sequencer instead of the bare Spell1 clip', () => {
    expect(CAST_GRAPH_KEY_OVERRIDES.darius).toBe('0x5463dad9');
    expect(graphKeyHash('0x5463dad9')).toBe(0x5463dad9);
    const plan = planGraphAction({ kind: 'Sequencer', keyName: '0x5463dad9', children: [atomic('spell1_in'), atomic('spell1')] },
      { action: 'cast', entry: { castSequence: { main: 'spell1' } } });
    expect(plan).toMatchObject({ status: 'ok', castSequence: { in: 'spell1_in', main: 'spell1' } });
  });
});
