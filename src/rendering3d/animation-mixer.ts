import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type AnimationClip, type Object3D } from 'three';
import type { ActionOutput, ActionPlayback } from './animation-state';
import type { ActionState, AnimationNames, CastMetadata, CastSequence, FormAnimations } from './contracts';

export interface CastSelection { starLevel?: number; hero?: boolean; form?: 'front' | 'back'; branch?: string; attackIntervalSeconds?: number }
/** Select only supplied display context; never infer a random ability or hero augment. */
export function selectCastSequence(metadata: CastMetadata, castIndex: number, context: CastSelection = {}): CastSequence | undefined {
  const v = metadata.castVariants;
  if (context.hero && v?.hero) return v.hero;
  if ((context.starLevel ?? 0) >= 3 && v?.star3) return v.star3;
  if (context.branch && v?.branch && Object.hasOwn(v.branch, context.branch)) return v.branch[context.branch];
  if (context.form && v?.[context.form]) return v[context.form];
  if (v?.rotate) {
    const entry = v.rotate[castIndex % v.rotate.length];
    return typeof entry === 'string' ? { main: entry } : entry;
  }
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
  private form?: 'front' | 'back';
  private layerActions: AnimationAction[] = [];
  private pendingLayers: AnimationClip[] = [];
  private stagesUntilLayers = -1;
  private lastResolved?: { clips: readonly string[]; sequence: CastSequence };
  constructor(private root: Object3D, clips: readonly AnimationClip[], private names: AnimationNames = {}, private metadata: CastMetadata & { formAnimations?: FormAnimations } = {}) {
    this.mixer = new AnimationMixer(root);
    this.clips = new Map(clips.map(clip => [clip.name, clip]));
  }
  setForm(form?: 'front' | 'back'): void {
    if (this.form !== form) {
      this.form = form;
      this.revision = -1;
    }
  }
  private nameFor(state: ActionState, form = this.form): string {
    const formClip = form && (state === 'idle' || state === 'move' || state === 'attack')
      ? this.metadata.formAnimations?.[form]?.[state]
      : undefined;
    if (formClip && this.clips.has(formClip)) return formClip;
    return (this.names[state] as string | undefined) ?? state;
  }
  private findSequence(state: ActionState, clips?: readonly string[]): CastSequence | undefined {
    if (!clips?.length) return undefined;
    if (this.lastResolved && this.lastResolved.clips === clips) return this.lastResolved.sequence;
    const candidates: (CastSequence | undefined)[] = state === 'attack'
      ? [this.metadata.attackSequence]
      : state === 'cast'
        ? [
            this.metadata.castSequence,
            this.metadata.castVariants?.hero,
            this.metadata.castVariants?.star3,
            this.metadata.castVariants?.front,
            this.metadata.castVariants?.back,
            ...Object.values(this.metadata.castVariants?.branch ?? {}),
            ...(this.metadata.castVariants?.rotate ?? []).filter((r): r is CastSequence => typeof r !== 'string'),
          ]
        : [];
    for (const seq of candidates) {
      if (!seq) continue;
      const mains = Array.isArray(seq.main) ? seq.main : [seq.main as string];
      for (const main of mains) {
        const names = [seq.in, seq.hold, main, seq.out].filter((v): v is string => !!v);
        if (names.length === clips.length && names.every((n, i) => n === clips[i])) return seq;
      }
    }
    return undefined;
  }
  private startLayers(clips: readonly AnimationClip[]): void {
    this.stopLayers();
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      action.reset().setEffectiveWeight(1).setEffectiveTimeScale(this.speed);
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      this.layerActions.push(action);
    }
  }
  private stopLayers(): void {
    for (const action of this.layerActions) action.stop();
    this.layerActions = [];
    this.pendingLayers = [];
    this.stagesUntilLayers = -1;
  }
  resolvePlayback(state: 'cast' | 'attack' | 'spawn', castIndex = 0, context: CastSelection = {}): ActionPlayback | null {
    if (state === 'spawn') {
      const clip = this.names.spawn ? this.clips.get(this.names.spawn) : undefined;
      return clip && Number.isFinite(clip.duration) && clip.duration > 0 ? { clips: [this.names.spawn!], durationSeconds: clip.duration } : null;
    }
    if (state === 'cast' && this.names.cast === null) return null;
    const form = context.form ?? this.form;
    const formAttack = state === 'attack' && form ? this.metadata.formAnimations?.[form]?.attack : undefined;
    const sequence = state === 'cast'
      ? selectCastSequence(this.metadata, castIndex, context)
      : state === 'attack' && !(formAttack && this.clips.has(formAttack))
        ? this.metadata.attackSequence
        : undefined;
    const main = sequence && (Array.isArray(sequence.main) ? sequence.main[castIndex % sequence.main.length] : sequence.main as string);
    const names = sequence ? [sequence.in, sequence.hold, main, sequence.out].filter((v): v is string => !!v)
      : [this.nameFor(state, context.form)];
    const clips = names.map(name => this.clips.get(name));
    if (clips.some(c => !c || !Number.isFinite(c.duration) || c.duration <= 0)) return null;
    const layers = sequence?.layers?.map(name => this.clips.get(name)).filter((c): c is AnimationClip => !!c && Number.isFinite(c.duration) && c.duration > 0) ?? [];
    const maxLayerDuration = layers.reduce((m, c) => Math.max(m, c.duration), 0);
    const mainIndex = sequence && main ? (sequence.in ? 1 : 0) + (sequence.hold ? 1 : 0) : -1;
    const duration = clips.reduce((n, c, idx) => n + (idx === mainIndex ? Math.max(c!.duration, maxLayerDuration) : c!.duration), 0), interval = context.attackIntervalSeconds;
    // Fit the whole swing between observed attacks, leaving recovery time for the idle blend.
    // Two intervals still let a long clip restart before its ending on every attack (Mordekaiser).
    const durationSeconds = state === 'cast' ? Math.min(2.5, Math.max(0.3, duration))
      : interval !== undefined && Number.isFinite(interval) && interval > 0 ? Math.min(duration, interval * 0.9) : duration;
    if (sequence) this.lastResolved = { clips: names, sequence };
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
    const clip = sequence?.[0] ?? this.clips.get(this.nameFor(output.state));
    this.queue = []; this.stageLeft = 0; this.speed = 1;
    if (!clip) return !!this.active;
    // Preserve only an actual continuous loop: a shared clip may still be playing once for attack/cast.
    if (output.loop && this.active === this.mixer.clipAction(clip) && this.active.loop === LoopRepeat
      && this.active.repetitions === Infinity && this.active.isRunning()) return true;
    this.stopLayers();
    const seqDef = playback ? this.findSequence(output.state, playback.clips) : undefined;
    const layers = seqDef?.layers?.map(name => this.clips.get(name)).filter((c): c is AnimationClip => !!c && Number.isFinite(c.duration) && c.duration > 0) ?? [];
    const maxLayerDuration = layers.reduce((m, c) => Math.max(m, c.duration), 0);
    const mainStage = seqDef ? (seqDef.in ? 1 : 0) + (seqDef.hold ? 1 : 0) : -1;
    if (sequence && playback) {
      const rawTotal = sequence.reduce((sum, c, idx) => sum + (idx === mainStage ? Math.max(c!.duration, maxLayerDuration) : c!.duration), 0);
      this.speed = rawTotal / playback.durationSeconds;
      this.queue = sequence.slice(1) as AnimationClip[];
      const firstDuration = mainStage === 0 ? Math.max(clip.duration, maxLayerDuration) : clip.duration;
      this.stageLeft = firstDuration / this.speed;
    }
    this.play(clip, output.loop, output.blendSeconds);
    if (sequence && playback && layers.length) {
      if (mainStage === 0) this.startLayers(layers);
      else if (mainStage > 0) { this.pendingLayers = layers; this.stagesUntilLayers = mainStage; }
    }
    return true;
  }
  update(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('invalid-delta');
    while (this.stageLeft > 0 && seconds >= this.stageLeft) {
      const step = this.stageLeft;
      this.mixer.update(step); seconds = Math.max(0, seconds - step);
      const next = this.queue.shift();
      if (next) {
        this.play(next, false, 0.08);
        let stageDur = next.duration;
        if (this.stagesUntilLayers > 0 && --this.stagesUntilLayers === 0) {
          const pending = this.pendingLayers;
          this.pendingLayers = [];
          for (const l of pending) stageDur = Math.max(stageDur, l.duration);
          this.startLayers(pending);
        }
        this.stageLeft = stageDur / this.speed;
      } else {
        this.stageLeft = 0;
        this.stopLayers();
      }
    }
    this.mixer.update(seconds);
    if (this.stageLeft > 0) this.stageLeft -= seconds;
  }
  dispose(): void { this.stopLayers(); this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); this.active = undefined; this.queue = []; this.stageLeft = 0; }
}
