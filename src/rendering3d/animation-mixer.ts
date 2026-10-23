import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type AnimationClip, type Object3D } from 'three';
import type { ActionOutput, ActionPlayback } from './animation-state';
import type { AnimationNames, CastMetadata, CastSequence } from './contracts';

export interface CastSelection { starLevel?: number; hero?: boolean; form?: 'front' | 'back'; branch?: string; attackIntervalSeconds?: number }
/** Select only supplied display context; never infer a random ability or hero augment. */
export function selectCastSequence(metadata: CastMetadata, castIndex: number, context: CastSelection = {}): CastSequence | undefined {
  const v = metadata.castVariants;
  if (context.hero && v?.hero) return v.hero;
  if ((context.starLevel ?? 0) >= 3 && v?.star3) return v.star3;
  if (context.branch && v?.branch && Object.hasOwn(v.branch, context.branch)) return v.branch[context.branch];
  if (context.form && v?.[context.form]) return v[context.form];
  if (v?.rotate) return { main: v.rotate[castIndex % v.rotate.length] };
  return metadata.castSequence;
}

/** Applies complete sequences, including overflow across stages in one update. */
export class UnitAnimationMixer {
  readonly mixer: AnimationMixer;
  private active?: AnimationAction;
  private revision = -1;
  private clips: Map<string, AnimationClip>;
  private queue: AnimationClip[] = [];
  private stageLeft = 0;
  private speed = 1;
  constructor(private root: Object3D, clips: readonly AnimationClip[], private names: AnimationNames = {}, private metadata: CastMetadata = {}) {
    this.mixer = new AnimationMixer(root);
    this.clips = new Map(clips.map(clip => [clip.name, clip]));
  }
  resolvePlayback(state: 'cast' | 'attack', castIndex = 0, context: CastSelection = {}): ActionPlayback | null {
    if (state === 'cast' && this.names.cast === null) return null;
    const sequence = state === 'cast' ? selectCastSequence(this.metadata, castIndex, context) : undefined;
    const main = sequence && (Array.isArray(sequence.main) ? sequence.main[castIndex % sequence.main.length] : sequence.main as string);
    const names = sequence ? [sequence.in, sequence.hold, main, sequence.out].filter((v): v is string => !!v)
      : [this.names[state] ?? state];
    const clips = names.map(name => this.clips.get(name));
    if (clips.some(c => !c || !Number.isFinite(c.duration) || c.duration <= 0)) return null;
    const duration = clips.reduce((n, c) => n + c!.duration, 0), interval = context.attackIntervalSeconds;
    const durationSeconds = state === 'cast' ? Math.min(2.5, Math.max(0.3, duration))
      : interval !== undefined && Number.isFinite(interval) && interval > 0 ? Math.min(duration, interval * 2) : duration;
    return { clips: names, durationSeconds };
  }
  private play(clip: AnimationClip, loop: boolean, blend: number): void {
    const next = this.mixer.clipAction(clip), previous = this.active;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(this.speed);
    next.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.play();
    if (previous && previous !== next) next.crossFadeFrom(previous, blend, false);
    this.active = next;
  }
  apply(output: ActionOutput): boolean {
    if (this.revision === output.revision) return !!this.active;
    this.revision = output.revision;
    const playback = output.playback ?? ((output.state === 'cast' || output.state === 'attack') ? this.resolvePlayback(output.state) : undefined);
    // Absent casts leave both the active action and its playback time unchanged.
    if (playback === null) return !!this.active;
    const sequence = playback?.clips.map(name => this.clips.get(name));
    if (sequence?.some(c => !c)) return !!this.active;
    const clip = sequence?.[0] ?? this.clips.get(this.names[output.state] ?? output.state);
    this.queue = []; this.stageLeft = 0; this.speed = 1;
    if (!clip) return !!this.active;
    // A looping action already playing keeps its time: re-entering idle or move must not rewind the cycle.
    if (output.loop && this.active === this.mixer.clipAction(clip) && this.active.isRunning()) return true;
    if (sequence && playback) {
      this.speed = sequence.reduce((sum, c) => sum + c!.duration, 0) / playback.durationSeconds;
      this.queue = sequence.slice(1) as AnimationClip[];
      this.stageLeft = clip.duration / this.speed;
    }
    this.play(clip, output.loop, output.blendSeconds);
    return true;
  }
  update(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('invalid-delta');
    while (this.stageLeft > 0 && seconds >= this.stageLeft) {
      const step = this.stageLeft;
      this.mixer.update(step); seconds = Math.max(0, seconds - step);
      const next = this.queue.shift();
      this.stageLeft = next ? next.duration / this.speed : 0;
      if (next) this.play(next, false, 0.08);
    }
    this.mixer.update(seconds);
    if (this.stageLeft > 0) this.stageLeft -= seconds;
  }
  dispose(): void { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); this.active = undefined; this.queue = []; this.stageLeft = 0; }
}
