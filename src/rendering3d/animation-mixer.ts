import { AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, PropertyBinding, type AnimationAction, type KeyframeTrack, type Object3D } from 'three';
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

/** A parallel stage: one action that owns crossfades, plus the other clips playing with it at their mixer weights. */
interface ParallelStage { primary: AnimationClip; extras: readonly { clip: AnimationClip; weight: number }[]; duration: number }

const trackBone = (track: KeyframeTrack): string => PropertyBinding.parseTrackName(track.name).nodeName;
const pickTracks = (clip: AnimationClip, keep: (bone: string) => boolean, suffix: string): AnimationClip =>
  new AnimationClip(clip.name + suffix, clip.duration, clip.tracks.filter(track => keep(trackBone(track))));

/**
 * The mixer averages every action on a bone by weight, so a main clip and an equal-weight layer on the same skeleton
 * each move it half way. The original Parallel clip instead lays a masked clip over the others on the mask's bones
 * only (Nami's water bones over her cast, Heimerdinger's upper-body throw over his full-body step). With masks, the
 * unmasked clips lose the bones a mask fully owns, and each masked clip is split by weight: a bone weighted w gets the
 * mixer weight n·w/(1−w) against the n unmasked clips, which blends it exactly w of the way. Without masks (or with
 * nothing unmasked to lay over) every clip keeps weight 1, as before.
 */
function parallelStage(sequence: CastSequence, main: AnimationClip, layers: readonly AnimationClip[]): ParallelStage {
  const duration = layers.reduce((m, c) => Math.max(m, c.duration), main.duration);
  const masks = sequence.masks, all = [main, ...layers];
  const maskOf = (clip: AnimationClip) => masks && Object.hasOwn(masks, clip.name) ? masks[clip.name] : undefined;
  const base = all.filter(clip => !maskOf(clip)), masked = all.filter(clip => maskOf(clip));
  if (!masked.length || !base.length) return { primary: main, extras: layers.map(clip => ({ clip, weight: 1 })), duration };
  const weights = masked.map(clip => new Map(Object.entries(maskOf(clip)!)
    .map(([bone, w]) => [PropertyBinding.sanitizeNodeName(bone), Math.min(1, Math.max(0, w))] as const)
    .filter(([, w]) => w > 0)));
  const owned = new Set(weights.flatMap(m => [...m].filter(([, w]) => w >= 1).map(([bone]) => bone)));
  const bases = base.map(clip => owned.size ? pickTracks(clip, bone => !owned.has(bone), '#base') : clip);
  const extras: { clip: AnimationClip; weight: number }[] = bases.slice(1).map(clip => ({ clip, weight: 1 }));
  masked.forEach((clip, at) => {
    const byWeight = new Map<number, Set<string>>();
    for (const [bone, w] of weights[at]) byWeight.set(w, (byWeight.get(w) ?? new Set()).add(bone));
    for (const [w, bones] of byWeight) {
      const part = pickTracks(clip, bone => bones.has(bone), `#mask${w}`);
      if (part.tracks.length) extras.push({ clip: part, weight: w >= 1 ? 1 : bases.length * w / (1 - w) });
    }
  });
  return { primary: bases[0], extras, duration };
}

/** A held cast's out clip plays this many times faster than authored (it may also be cut by the next swing). */
export const HELD_CAST_OUT_SPEED = 2;
/** Per-stage speeds and end pads of a held cast: stages before out at ≥1× fill holdSeconds, out fills the rest. */
interface HeldTiming { speeds: number[]; pads: number[] }
function heldTiming(raw: readonly number[], playback: ActionPlayback, hasOut: boolean): HeldTiming | undefined {
  const hold = playback.holdSeconds;
  if (hold === undefined) return undefined;
  const preCount = hasOut && raw.length > 1 ? raw.length - 1 : raw.length;
  const preRaw = raw.slice(0, preCount).reduce((a, b) => a + b, 0);
  const preSpeed = Math.max(1, preRaw / Math.max(hold, 1e-6));
  const speeds = raw.map((_, i) => i < preCount ? preSpeed : raw[i] / Math.max(playback.durationSeconds - hold, 1e-6));
  const pads = raw.map((_, i) => i === preCount - 1 ? Math.max(0, hold - preRaw / preSpeed) : 0);
  return { speeds, pads };
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
  private timing?: HeldTiming;
  private form?: 'front' | 'back';
  private layerActions: AnimationAction[] = [];
  private fadingLayers: AnimationAction[] = [];
  /** The parallel main stage of the playing sequence, by stage index. */
  private stage?: ParallelStage & { index: number };
  private stageIndex = 0;
  private readonly stages = new WeakMap<CastSequence, Map<string, ParallelStage>>();
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
  private parallel(sequence: CastSequence, main: AnimationClip, layers: readonly AnimationClip[]): ParallelStage {
    let byMain = this.stages.get(sequence);
    if (!byMain) this.stages.set(sequence, byMain = new Map());
    const key = [main.name, ...layers.map(c => c.name)].join('\u0000');
    let stage = byMain.get(key);
    if (!stage) byMain.set(key, stage = parallelStage(sequence, main, layers));
    return stage;
  }
  private startLayers(extras: ParallelStage['extras']): void {
    this.stopLayers();
    for (const { clip, weight } of extras) {
      const action = this.mixer.clipAction(clip);
      this.fadingLayers = this.fadingLayers.filter(a => a !== action);
      action.reset().setEffectiveWeight(weight).setEffectiveTimeScale(this.speed);
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      this.layerActions.push(action);
    }
  }
  /** Fades the layers out with the action that replaces their stage, so their bones do not snap; no blend stops them. */
  private stopLayers(blend = 0): void {
    for (const action of this.layerActions) {
      if (blend > 0) { action.fadeOut(blend); this.fadingLayers.push(action); } else action.stop();
    }
    this.layerActions = [];
  }
  private dropFadedLayers(): void {
    for (const action of this.fadingLayers) action.stop();
    this.fadingLayers = [];
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
    // A held cast (manifest holdSeconds) keeps its pose for its rule effect instead of the 2.5 s cap; its out is compressed.
    const hold = state === 'cast' ? sequence?.holdSeconds : undefined;
    const outSeconds = hold !== undefined && sequence?.out && clips.length > 1 ? clips[clips.length - 1]!.duration / HELD_CAST_OUT_SPEED : 0;
    const durationSeconds = hold !== undefined ? hold + outSeconds : state === 'cast' ? Math.min(2.5, Math.max(0.3, duration))
      : interval !== undefined && Number.isFinite(interval) && interval > 0 ? Math.min(duration, interval * 0.9) : duration;
    if (sequence) this.lastResolved = { clips: names, sequence };
    return hold !== undefined ? { clips: names, durationSeconds, holdSeconds: hold } : { clips: names, durationSeconds };
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
    this.queue = []; this.stageLeft = 0; this.speed = 1; this.timing = undefined;
    if (!clip) return !!this.active;
    // Preserve only an actual continuous loop: a shared clip may still be playing once for attack/cast.
    if (output.loop && this.active === this.mixer.clipAction(clip) && this.active.loop === LoopRepeat
      && this.active.repetitions === Infinity && this.active.isRunning()) return true;
    this.dropFadedLayers();
    this.stopLayers(output.blendSeconds);
    const seqDef = playback ? this.findSequence(output.state, playback.clips) : undefined;
    const layers = seqDef?.layers?.map(name => this.clips.get(name)).filter((c): c is AnimationClip => !!c && Number.isFinite(c.duration) && c.duration > 0) ?? [];
    const mainStage = seqDef ? (seqDef.in ? 1 : 0) + (seqDef.hold ? 1 : 0) : -1;
    this.stage = undefined; this.stageIndex = 0;
    if (sequence && playback && seqDef && layers.length && mainStage >= 0 && sequence[mainStage]) {
      this.stage = { ...this.parallel(seqDef, sequence[mainStage]!, layers), index: mainStage };
    }
    const atMain = this.stage?.index === 0;
    if (sequence && playback) {
      const raw = sequence.map((c, idx) => idx === this.stage?.index ? this.stage.duration : c!.duration);
      this.speed = raw.reduce((a, b) => a + b, 0) / playback.durationSeconds;
      this.timing = heldTiming(raw, playback, !!seqDef?.out);
      if (this.timing) this.speed = this.timing.speeds[0];
      this.queue = sequence.slice(1) as AnimationClip[];
      this.stageLeft = this.stageSeconds(0, atMain ? this.stage!.duration : clip.duration);
    }
    this.play(atMain ? this.stage!.primary : clip, output.loop, output.blendSeconds);
    if (atMain) this.startLayers(this.stage!.extras);
    return true;
  }
  private stageSeconds(index: number, raw: number): number {
    return raw / this.speed + (this.timing?.pads[index] ?? 0);
  }
  update(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('invalid-delta');
    while (this.stageLeft > 0 && seconds >= this.stageLeft) {
      const step = this.stageLeft;
      this.mixer.update(step); seconds = Math.max(0, seconds - step);
      const next = this.queue.shift();
      if (next) {
        const index = ++this.stageIndex, stage = this.stage;
        const atMain = stage?.index === index;
        if (stage && index === stage.index + 1) this.stopLayers(0.08);
        if (this.timing) this.speed = this.timing.speeds[index] ?? this.speed;
        this.play(atMain ? stage.primary : next, false, 0.08);
        if (atMain) this.startLayers(stage.extras);
        this.stageLeft = this.stageSeconds(index, atMain ? stage.duration : next.duration);
      } else {
        // A sequence ending on its parallel stage holds the layers' last pose with the main one until the next action.
        this.stageLeft = 0;
      }
    }
    this.mixer.update(seconds);
    if (this.stageLeft > 0) this.stageLeft -= seconds;
  }
  dispose(): void { this.stopLayers(); this.dropFadedLayers(); this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); this.active = undefined; this.queue = []; this.stageLeft = 0; }
}
