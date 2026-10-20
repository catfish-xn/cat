import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type AnimationClip, type Object3D } from 'three';
import type { ActionOutput } from './animation-state';
import type { ActionState } from './contracts';

/** Apply the pure state output to one leased model. dispose before releasing it. */
export class UnitAnimationMixer {
  readonly mixer: AnimationMixer;
  private active?: AnimationAction;
  private revision = -1;
  private clips: Map<string, AnimationClip>;
  constructor(private root: Object3D, clips: readonly AnimationClip[], private names: Partial<Record<ActionState, string>> = {}) {
    this.mixer = new AnimationMixer(root);
    this.clips = new Map(clips.map(clip => [clip.name, clip]));
  }
  apply(output: ActionOutput): boolean {
    if (this.revision === output.revision) return !!this.active;
    this.revision = output.revision;
    const clip = this.clips.get(this.names[output.state] ?? output.state) ?? this.clips.get(this.names.idle ?? 'idle');
    if (!clip) { this.active?.fadeOut(output.blendSeconds); this.active = undefined; return false; }
    const next = this.mixer.clipAction(clip);
    const previous = this.active;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    next.setLoop(output.loop ? LoopRepeat : LoopOnce, output.loop ? Infinity : 1);
    next.clampWhenFinished = !output.loop;
    next.play();
    if (previous && previous !== next) next.crossFadeFrom(previous, output.blendSeconds, false);
    this.active = next;
    return true;
  }
  update(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('invalid-delta');
    this.mixer.update(seconds);
  }
  dispose(): void { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); this.active = undefined; }
}
