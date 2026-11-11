import { describe, expect, it, vi } from 'vitest';
import { AnimationClip, Bone, Group, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import { ModelCache } from '../src/rendering3d/assets';
import { holdRootInPlace } from '../src/rendering3d/clip-range';
import { IN_PLACE_CLIPS, ROOT_BONE } from '../src/rendering3d/in-place-clips';
import type { AssetManifest } from '../src/rendering3d/contracts';

// Synthetic clips only: root travel forward (−z) and up, as Jayce's back-row cast is authored.
const root = (name: string, keys: readonly (readonly [number, number, number])[]) =>
  new AnimationClip(name, keys.length - 1, [new VectorKeyframeTrack(`${ROOT_BONE}.position`, keys.map((_, i) => i), keys.flat()),
    new QuaternionKeyframeTrack(`${ROOT_BONE}.quaternion`, [0], [0, 0, 0, 1])]);

describe('in-place clips (root x/z held, height kept)', () => {
  it('holds every root key at rest x/z, keeps the height and leaves the source clip and other tracks alone', () => {
    const clip = root('jump', [[8, 120, -14], [10, 600, -113], [9, 97, -67]]);
    const held = holdRootInPlace(clip, ROOT_BONE, [8, 106, -6]);
    expect(held).not.toBe(clip);
    expect(Array.from(held.tracks[0].values)).toEqual([8, 120, -6, 8, 600, -6, 8, 97, -6]);
    expect(Array.from(held.tracks[0].times)).toEqual([0, 1, 2]);
    expect(Array.from(held.tracks[1].values)).toEqual([0, 0, 0, 1]);
    expect(held.duration).toBe(clip.duration);
    expect(Array.from(clip.tracks[0].values)).toEqual([8, 120, -14, 10, 600, -113, 9, 97, -67]);
    expect(holdRootInPlace(new AnimationClip('none', 1, []), ROOT_BONE, [0, 0, 0]).tracks).toEqual([]);
  });

  it('names Jayce’s back-row cast clips only', () => {
    expect(IN_PLACE_CLIPS).toEqual({ jayce: ['tft13_jayce_spell2_knockhexcrystals', 'tft13_jayce_spell2_ranged_jump'] });
  });

  it('ModelCache plays Jayce’s named clips in place at the idle stance (after its range trim) and nothing else', async () => {
    const idle = root('tft13_jayce_idle1_ranged', [[8.3, 106, -5.6], [8.2, 105, -5.8]]);
    const knock = root('tft13_jayce_spell2_knockhexcrystals', [[8.5, 107, -5], [10, 103, -77], [7.6, 105, -5]]);
    const jump = root('tft13_jayce_spell2_ranged_jump', [[7.6, 121, -14], [6, 600, -113], [18, 97, -67], [1, 163, -36]]);
    const attack = root('tft13_jayce_attack1', [[7.6, 121, -14], [32, 97, -28]]);
    const scene = new Group(), bone = new Bone(); bone.name = ROOT_BONE; bone.position.set(0, 137, -3); scene.add(bone);
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
    expect(xz(by(knock.name))).toEqual([8.3, -5.6, 8.3, -5.6, 8.3, -5.6]);
    expect(Array.from(by(knock.name).tracks[0].values).filter((_, i) => i % 3 === 1).map(r)).toEqual([107, 103, 105]);
    expect(by(jump.name).duration).toBe(1);
    expect(xz(by(jump.name))).toEqual([8.3, -5.6, 8.3, -5.6]);
    expect(by(attack.name)).toBe(attack); expect(by(idle.name)).toBe(idle);
    const others = await cache.load('other');
    expect(others.animations.find(clip => clip.name === knock.name)).toBe(knock);
  });
});
