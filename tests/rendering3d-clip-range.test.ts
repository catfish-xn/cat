import { describe, expect, it, vi } from 'vitest';
import { AnimationClip, Group, NumberKeyframeTrack, Quaternion, QuaternionKeyframeTrack } from 'three';
import { ModelCache } from '../src/rendering3d/assets';
import { trimClip } from '../src/rendering3d/clip-range';
import { assertManifest, type AssetManifest } from '../src/rendering3d/contracts';

describe('clip-range trimming and manifest contract (synthetic data only)', () => {
  it('trims a linear NumberKeyframeTrack to [start, end] and shifts interior keyframe times', () => {
    const track = new NumberKeyframeTrack('.position[x]', [0, 1.5, 2, 4], [0, 1.5, 2, 4]);
    const clip = new AnimationClip('linear', 4, [track]);
    const trimmed = trimClip(clip, 1, 2.5);

    expect(trimmed).not.toBe(clip);
    expect(trimmed.name).toBe('linear');
    expect(trimmed.duration).toBeCloseTo(1.5, 6);
    expect(trimmed.tracks[0]).toBeInstanceOf(NumberKeyframeTrack);
    expect(Array.from(trimmed.tracks[0].times)).toEqual([0, 0.5, 1, 1.5]);
    expect(Array.from(trimmed.tracks[0].values)).toEqual([1, 1.5, 2, 2.5]);

    // Original clip and track remain untouched.
    expect(clip.duration).toBe(4);
    expect(Array.from(track.times)).toEqual([0, 1.5, 2, 4]);
    expect(Array.from(track.values)).toEqual([0, 1.5, 2, 4]);
  });

  it('evaluates QuaternionKeyframeTrack endpoints with its spherical interpolant and clamps/guards bounds', () => {
    const q0 = new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 } as never, 0);
    const q1 = new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 } as never, Math.PI / 2);
    const q2 = new Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 } as never, Math.PI / 3);
    const track = new QuaternionKeyframeTrack(
      '.quaternion',
      [0, 2, 4],
      [q0.x, q0.y, q0.z, q0.w, q1.x, q1.y, q1.z, q1.w, q2.x, q2.y, q2.z, q2.w],
    );
    const clip = new AnimationClip('rotate', 4, [track]);
    const createInterpolant = () =>
      (track as unknown as { createInterpolant(): { evaluate(t: number): ArrayLike<number> } }).createInterpolant();
    const expectedStart = Array.from(createInterpolant().evaluate(0.75));
    const expectedEnd = Array.from(createInterpolant().evaluate(3.25));

    const trimmed = trimClip(clip, 0.75, 3.25);
    expect(trimmed.tracks[0]).toBeInstanceOf(QuaternionKeyframeTrack);
    expect(trimmed.duration).toBeCloseTo(2.5, 6);
    const values = Array.from(trimmed.tracks[0].values);
    for (let i = 0; i < 4; i++) {
      expect(Math.abs(values[i] - expectedStart[i])).toBeLessThan(1e-6);
      expect(Math.abs(values[values.length - 4 + i] - expectedEnd[i])).toBeLessThan(1e-6);
    }

    const clamped = trimClip(clip, 1, 10);
    expect(clamped.duration).toBeCloseTo(3, 6);
    expect(trimClip(clip, 2, 2)).toBe(clip);
    expect(trimClip(clip, 3, 1)).toBe(clip);
    expect(trimClip(clip, 5, 10)).toBe(clip);
  });

  it('validates clipRanges in assertManifest and rejects malformed ranges with invalid-clip-ranges', () => {
    const base = {
      schemaVersion: 1,
      models: {
        unit: {
          path: 'units/test.glb',
          animations: { idle: 'idle_clip', cast: 'cast_clip' },
        },
      },
    };
    expect(() =>
      assertManifest({
        ...base,
        models: {
          unit: {
            ...base.models.unit,
            clipRanges: { cast_clip: [0.5, 2.5], idle_clip: [0, 1] },
          },
        },
      }),
    ).not.toThrow();

    const invalidCases: unknown[] = [
      { cast_clip: [2, 1] },
      { cast_clip: [1, 1] },
      { cast_clip: [-1, 1] },
      { cast_clip: [0, Number.NaN] },
      { cast_clip: [0, Number.POSITIVE_INFINITY] },
      { cast_clip: [0, 1, 2] },
      { cast_clip: [0] },
      { '': [0, 1] },
      null,
      [],
      'not-an-object',
      Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`clip_${i}`, [0, 1]])),
    ];

    for (const clipRanges of invalidCases) {
      expect(() =>
        assertManifest({
          ...base,
          models: { unit: { ...base.models.unit, clipRanges } },
        }),
      ).toThrow('invalid-clip-ranges');
    }
  });

  it('trims matching clips once per cached model in ModelCache and leaves other clips unchanged', async () => {
    const idleClip = new AnimationClip('idle_clip', 4, [new NumberKeyframeTrack('.position[x]', [0, 4], [0, 4])]);
    const castClip = new AnimationClip('cast_clip', 4, [new NumberKeyframeTrack('.position[y]', [0, 4], [0, 4])]);
    const read = vi.fn(async () => ({ scene: new Group(), animations: [idleClip, castClip] }));
    const manifest: AssetManifest = {
      schemaVersion: 1,
      models: {
        unit: {
          path: 'units/test.glb',
          animations: { idle: 'idle_clip', cast: 'cast_clip' },
          clipRanges: { cast_clip: [1, 2.5] },
        },
      },
    };

    const cache = new ModelCache(manifest, '/cdn/', read);
    const first = await cache.load('unit');
    const second = await cache.load('unit');

    expect(read).toHaveBeenCalledTimes(1);
    const firstIdle = first.animations.find(clip => clip.name === 'idle_clip')!;
    const firstCast = first.animations.find(clip => clip.name === 'cast_clip')!;
    const secondCast = second.animations.find(clip => clip.name === 'cast_clip')!;

    expect(firstIdle).toBe(idleClip);
    expect(firstIdle.duration).toBe(4);
    expect(firstCast).not.toBe(castClip);
    expect(firstCast.duration).toBeCloseTo(1.5, 6);
    expect(Array.from(firstCast.tracks[0].values)).toEqual([1, 2.5]);
    expect(secondCast).toBe(firstCast);

    first.release();
    second.release();
    cache.dispose();
  });

  it('appends aliased clipSegments with duration end-start, preserves source clips, and skips missing sources or existing names', async () => {
    const sourceClip = new AnimationClip('combo_all', 4, [new NumberKeyframeTrack('.position[x]', [0, 4], [0, 8])]);
    const idleClip = new AnimationClip('idle_clip', 2, [new NumberKeyframeTrack('.position[y]', [0, 2], [0, 2])]);
    const read = vi.fn(async () => ({ scene: new Group(), animations: [idleClip, sourceClip] }));
    const manifest: AssetManifest = {
      schemaVersion: 1,
      models: {
        unit: {
          path: 'units/test.glb',
          animations: { idle: 'idle_clip' },
          clipSegments: {
            seg_first: ['combo_all', 0, 0.5],
            seg_second: ['combo_all', 1.0, 3.5],
            missing_src: ['nonexistent', 0, 1],
            idle_clip: ['combo_all', 0, 1],
          },
        },
      },
    };

    const cache = new ModelCache(manifest, '/cdn/', read);
    const first = await cache.load('unit');
    const second = await cache.load('unit');

    expect(read).toHaveBeenCalledTimes(1);
    const origSource = first.animations.find(clip => clip.name === 'combo_all')!;
    const segFirst = first.animations.find(clip => clip.name === 'seg_first')!;
    const segSecond = first.animations.find(clip => clip.name === 'seg_second')!;
    const keptIdle = first.animations.find(clip => clip.name === 'idle_clip')!;

    expect(origSource).toBe(sourceClip);
    expect(origSource.duration).toBe(4);
    expect(keptIdle).toBe(idleClip);
    expect(keptIdle.duration).toBe(2);
    expect(first.animations.find(clip => clip.name === 'missing_src')).toBeUndefined();

    expect(segFirst).toBeDefined();
    expect(segFirst.duration).toBeCloseTo(0.5, 6);
    expect(Array.from(segFirst.tracks[0].values)).toEqual([0, 1]);

    expect(segSecond).toBeDefined();
    expect(segSecond.duration).toBeCloseTo(2.5, 6);
    expect(Array.from(segSecond.tracks[0].values)).toEqual([2, 7]);

    expect(second.animations.find(clip => clip.name === 'seg_first')).toBe(segFirst);
    expect(second.animations.find(clip => clip.name === 'seg_second')).toBe(segSecond);

    first.release();
    second.release();
    cache.dispose();
  });
});
