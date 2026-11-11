import { AnimationClip, type KeyframeTrack } from 'three';

type TrackConstructor = new (name: string, times: ArrayLike<number>, values: ArrayLike<number>) => KeyframeTrack;
type InterpolableTrack = KeyframeTrack & {
  createInterpolant(): { evaluate(t: number): ArrayLike<number> };
};

/** Trim a clip to [start, min(end, clip.duration)] in seconds without mutating the source clip. */
export function trimClip(clip: AnimationClip, start: number, end: number): AnimationClip {
  const clampedEnd = Math.min(end, clip.duration);
  if (!Number.isFinite(start) || !Number.isFinite(clampedEnd) || start >= clampedEnd) return clip;
  const tracks = clip.tracks.map(track => {
    if (!track.times.length) return track.clone();
    const interpolant = (track as InterpolableTrack).createInterpolant();
    const startValue = Array.from(interpolant.evaluate(start));
    const endValue = Array.from(interpolant.evaluate(clampedEnd));
    const stride = track.getValueSize();
    const times = [0];
    const values = [...startValue];
    for (let i = 0; i < track.times.length; i++) {
      const t = track.times[i];
      if (t > start && t < clampedEnd) {
        times.push(t - start);
        for (let k = 0; k < stride; k++) values.push(track.values[i * stride + k]);
      }
    }
    times.push(clampedEnd - start);
    values.push(...endValue);
    const Track = track.constructor as TrackConstructor;
    return new Track(track.name, times, values);
  });
  return new AnimationClip(clip.name, clampedEnd - start, tracks);
}

/**
 * Hold a clip's root bone in place horizontally: every key of `${bone}.position` keeps its own height (a jump still
 * rises and lands) but takes `rest`'s x and z. Returns the source clip when it has no such track. Does not mutate it.
 */
export function holdRootInPlace(clip: AnimationClip, bone: string, rest: readonly [number, number, number]): AnimationClip {
  const name = `${bone}.position`;
  if (!clip.tracks.some(track => track.name === name && track.getValueSize() === 3)) return clip;
  const tracks = clip.tracks.map(track => {
    if (track.name !== name || track.getValueSize() !== 3) return track.clone();
    const values = Array.from(track.values);
    for (let i = 0; i < values.length; i += 3) { values[i] = rest[0]; values[i + 2] = rest[2]; }
    const Track = track.constructor as TrackConstructor;
    return new Track(track.name, Array.from(track.times), values);
  });
  return new AnimationClip(clip.name, clip.duration, tracks);
}
