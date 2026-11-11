import { describe, expect, it, vi } from 'vitest';
import { AnimationClip, Bone, Group, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import { ModelCache } from '../src/rendering3d/assets';
import { holdRootInPlace } from '../src/rendering3d/clip-range';
import { IN_PLACE_CLIPS, ROOT_BONE } from '../src/rendering3d/in-place-clips';
import type { AssetManifest } from '../src/rendering3d/contracts';

// Synthetic clips only, made-up integers: root travel forward (−z) and up, the shape of Jayce's back-row cast.
const root = (name: string, keys: readonly (readonly [number, number, number])[]) =>
  new AnimationClip(name, keys.length - 1, [new VectorKeyframeTrack(`${ROOT_BONE}.position`, keys.map((_, i) => i), keys.flat()),
    new QuaternionKeyframeTrack(`${ROOT_BONE}.quaternion`, [0], [0, 0, 0, 1])]);

describe('in-place clips (root x/z held, height kept)', () => {
  it('holds every root key at rest x/z, keeps the height and leaves the source clip and other tracks alone', () => {
    const clip = root('jump', [[1, 10, -2], [3, 50, -40], [2, 9, -30]]);
    const held = holdRootInPlace(clip, ROOT_BONE, [5, 8, -1]);
    expect(held).not.toBe(clip);
    expect(Array.from(held.tracks[0].values)).toEqual([5, 10, -1, 5, 50, -1, 5, 9, -1]);
    expect(Array.from(held.tracks[0].times)).toEqual([0, 1, 2]);
    expect(Array.from(held.tracks[1].values)).toEqual([0, 0, 0, 1]);
    expect(held.duration).toBe(clip.duration);
    expect(Array.from(clip.tracks[0].values)).toEqual([1, 10, -2, 3, 50, -40, 2, 9, -30]);
    expect(holdRootInPlace(new AnimationClip('none', 1, []), ROOT_BONE, [0, 0, 0]).tracks).toEqual([]);
  });

  it('names Jayce’s back-row cast clips only', () => {
    expect(IN_PLACE_CLIPS).toEqual({ jayce: ['tft13_jayce_spell2_knockhexcrystals', 'tft13_jayce_spell2_ranged_jump'] });
  });

  it('ModelCache plays Jayce’s named clips in place at the idle stance (after its range trim) and nothing else', async () => {
    const idle = root('tft13_jayce_idle1_ranged', [[4, 10, -3], [6, 11, -4]]);
    const knock = root('tft13_jayce_spell2_knockhexcrystals', [[5, 12, -3], [7, 13, -20], [5, 14, -3]]);
    const jump = root('tft13_jayce_spell2_ranged_jump', [[2, 10, -5], [3, 60, -30], [9, 8, -20], [1, 15, -10]]);
    const attack = root('tft13_jayce_attack1', [[2, 10, -5], [8, 9, -9]]);
    const scene = new Group(), bone = new Bone(); bone.name = ROOT_BONE; bone.position.set(0, 20, 0); scene.add(bone);
    const read = vi.fn(async () => ({ scene, animations: [idle, knock, jump, attack] }));
    const manifest: AssetManifest = { schemaVersion: 1, models: {
      jayce: { path: 'jayce.glb', animations: { idle: idle.name, cast: knock.name, attack: attack.name }, clipRanges: { [jump.name]: [1, 2] } },
      other: { path: 'other.glb', animations: { idle: idle.name, cast: knock.name } },
    } };
    const cache = new ModelCache(manifest, '/cdn/', read);
    const lease = await cache.load('jayce');
    const by = (name: string) => lease.animations.find(clip => clip.name === name)!;
    const r = (v: number) => Math.round(v * 1000) / 1000;
    const xz = (clip: AnimationClip) => Array.from(clip.tracks[0].values).filter((_, i) => i % 3 !== 1).map(r);
    expect(xz(by(knock.name))).toEqual([4, -3, 4, -3, 4, -3]);
    expect(Array.from(by(knock.name).tracks[0].values).filter((_, i) => i % 3 === 1).map(r)).toEqual([12, 13, 14]);
    expect(by(jump.name).duration).toBe(1);
    expect(xz(by(jump.name))).toEqual([4, -3, 4, -3]);
    expect(by(attack.name)).toBe(attack); expect(by(idle.name)).toBe(idle);
    const others = await cache.load('other');
    expect(others.animations.find(clip => clip.name === knock.name)).toBe(knock);
  });
});
