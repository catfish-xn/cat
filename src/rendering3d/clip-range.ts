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
