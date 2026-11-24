import { AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, PropertyBinding, type AnimationAction, type KeyframeTrack, type Object3D } from 'three';
import type { ActionOutput, ActionPlayback } from './animation-state';
import { attackReleaseSeconds, type StatusPose, type ActionState, type AnimationNames, type CastMetadata, type CastSequence, type FormAnimations, type SubmeshVisibility, type TimedFormClips, type TimedFormAnimations } from './contracts';
import { SUBMESH_EVENT_FPS, SubmeshSwitch, type TIMED_FORMS } from './submesh-visibility';

export interface CastSelection { starLevel?: number; hero?: boolean; form?: 'front' | 'back'; branch?: string; attackIntervalSeconds?: number }
/**
 * Select only supplied display context; never infer a random ability or hero augment. `castIndex` is the rule's cast
 * number from the cast event (1 on the unit's first cast); 0 means the event did not report it (an older replay), and a
 * rotation then plays its default sequence instead of guessing.
 */
export function selectCastSequence(metadata: CastMetadata, castIndex: number, context: CastSelection = {}): CastSequence | undefined {
  const v = metadata.castVariants;
  if (context.hero && v?.hero) return v.hero;
  if ((context.starLevel ?? 0) >= 3 && v?.star3) return v.star3;
  if (context.branch && v?.branch && Object.hasOwn(v.branch, context.branch)) return v.branch[context.branch];
  if (context.form && v?.[context.form]) return v[context.form];
  if (v?.rotate && castIndex > 0) {
    const entry = v.rotate[(castIndex - 1) % v.rotate.length];
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

/**
 * A StatusPose as mixer actions: the clip's pose at `atSeconds`, frozen, split by mask weight. Each part's mixer weight
 * is set per frame so that the pose takes fraction f·w of the bone against the unit's own action (total weight 1).
 */
function poseParts(pose: StatusPose, source: AnimationClip): { clip: AnimationClip; weight: number }[] {
  const byWeight = new Map<number, Set<string>>();
  for (const [bone, w] of Object.entries(pose.mask)) {
    const weight = Math.min(1, Math.max(0, w));
    if (weight > 0) byWeight.set(weight, (byWeight.get(weight) ?? new Set()).add(PropertyBinding.sanitizeNodeName(bone)));
  }
  const at = Math.min(Math.max(0, pose.atSeconds), source.duration);
  return [...byWeight].map(([weight, bones]) => {
    const tracks = source.tracks.filter(track => bones.has(trackBone(track))).map(track => {
      const value = Array.from((track as KeyframeTrack & { createInterpolant(): { evaluate(t: number): ArrayLike<number> } }).createInterpolant().evaluate(at));
      const Track = track.constructor as new (name: string, times: number[], values: number[]) => KeyframeTrack;
      return new Track(track.name, [0, 1], [...value, ...value]);
    });
    return { clip: new AnimationClip(`${source.name}#pose${weight}`, 1, tracks), weight };
  }).filter(part => part.clip.tracks.length);
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
/** A timed form's entry or exit clip outweighs the body's clip on the form's bones (weights blend by share). */
const FORM_CLIP_WEIGHT = 1e4;
/** Seconds the entry clip's bones take to hand back to the body's clip after it ends. */
const FORM_CLIP_FADE = 0.2;
/** Seconds an idle or move loop takes to change to the other form's loop when the timed form shows or hides. */
const FORM_LOOP_BLEND = 0.2;

export class UnitAnimationMixer {
  readonly mixer: AnimationMixer;
  private active?: AnimationAction;
  private revision = -1;
  private clips: Map<string, AnimationClip>;
  private queue: AnimationClip[] = [];
  private stageLeft = 0;
  private speed = 1;
  private timing?: HeldTiming;
  /** Seconds until an attack with a release reaches its release frame, and the speed it plays after it. */
  private releaseLeft = 0;
  private tailSpeed = 1;
  private form?: 'front' | 'back';
  private layerActions: AnimationAction[] = [];
  private fadingLayers: AnimationAction[] = [];
  /** The parallel main stage of the playing sequence, by stage index. */
  private stage?: ParallelStage & { index: number };
  private stageIndex = 0;
  private readonly stages = new WeakMap<CastSequence, Map<string, ParallelStage>>();
  private lastResolved?: { clips: readonly string[]; sequence: CastSequence };
  /** The status pose: wanted on/off, its current fraction, and its actions (built on first use). */
  private pose?: { on: boolean; fraction: number; parts: { action: AnimationAction; weight: number }[] };
  private baseState: ActionState = 'idle';
  /** Submeshes the playing clip shows or hides (absent when the model has none to switch). */
  private submeshes?: SubmeshSwitch;
  /** Seconds the active play-once clip has held its last frame: its events keep their frame times past the clip's end. */
  private heldSeconds = 0;
  /**
   * The timed form's entry or exit clip playing over the base clip, on the bones that move the form's submeshes only:
   * its weight share (1 while it plays, easing to 0 over FORM_CLIP_FADE once it ends) and whether the form hides when
   * it ends (the exit clip).
   */
  private formClip?: { action: AnimationAction; left: number; share: number; exit: boolean };
  private formClips = new Map<string, AnimationClip | null>();
  /** Attacks played while the timed form is on: they alternate between its attack and attackAlt clips. */
  private formAttacks = 0;
  constructor(private root: Object3D, clips: readonly AnimationClip[], private names: AnimationNames = {}, private metadata: CastMetadata & { formAnimations?: FormAnimations; submeshVisibility?: SubmeshVisibility; timedForm?: (typeof TIMED_FORMS)[string]; timedFormClips?: TimedFormClips; timedFormAnimations?: TimedFormAnimations } = {}) {
    this.mixer = new AnimationMixer(root);
    this.clips = new Map(clips.map(clip => [clip.name, clip]));
    this.submeshes = SubmeshSwitch.create(root, metadata.submeshVisibility, metadata.timedForm);
    this.submeshes?.apply(undefined, 0);
  }
  /** The playing clip's submeshes at its current time; a parallel stage's split clips count as their source clip. */
  private switchSubmeshes(): void {
    if (!this.submeshes) return;
    const action = this.active;
    this.submeshes.apply(action?.getClip().name.replace(/#.*$/, ''), (action?.time ?? 0) + this.heldSeconds);
  }
  /** A clip's own length in seconds, undefined when the model has no usable clip of that name. */
  clipSeconds(name: string): number | undefined {
    const clip = this.clips.get(name);
    return clip && Number.isFinite(clip.duration) && clip.duration > 0 ? clip.duration : undefined;
  }
  /**
   * When in a clip the highest of these bones is lowest (seconds, sampled at 30 per second on a copy of the model, so the
   * live pose is untouched): where a downward swing strikes (a holder's slam, CARRY_HOLDS). Undefined without the clip
   * or the bones. Cached per clip and bones.
   */
  lowestSeconds(clipName: string, boneNames: readonly string[]): number | undefined {
    const key = `${clipName}\n${boneNames.join(',')}`;
    if (this.lows.has(key)) return this.lows.get(key);
    const clip = this.clips.get(clipName);
    let at: number | undefined;
    if (clip && Number.isFinite(clip.duration) && clip.duration > 0) try {
      const copy = this.root.clone(true), mixer = new AnimationMixer(copy);
      const bones = boneNames.map(name => copy.getObjectByName(name)).filter((bone): bone is Object3D => !!bone);
      if (bones.length) {
        mixer.clipAction(clip).play();
        let low = Infinity;
        for (let t = 0; t <= clip.duration + 1e-6; t += 1 / 30) {
          mixer.setTime(t); copy.updateMatrixWorld(true);
          let high = -Infinity; for (const bone of bones) high = Math.max(high, bone.matrixWorld.elements[13]!);
          if (high < low - 1e-6) { low = high; at = t; }
        }
      }
      mixer.stopAllAction(); mixer.uncacheRoot(copy);
    } catch { at = undefined; } // a model that cannot be copied or sampled: no strike, the slam plays at 1x
    this.lows.set(key, at);
    return at;
  }
  private readonly lows = new Map<string, number | undefined>();
  /**
   * Seconds into its cast clip at which that clip hides submesh `name` after showing it (manifest submesh visibility; the
   * frame the clip's own switch hides it, Powder's monkey leaving her hand), or undefined when it does not.
   */
  castHides(name: string): number | undefined {
    const clip = typeof this.names.cast === 'string' ? this.names.cast : undefined;
    const events = clip ? this.metadata.submeshVisibility?.events?.[clip.toLowerCase()] ?? this.metadata.submeshVisibility?.events?.[clip] : undefined;
    let shown = false;
    for (const event of [...(events ?? [])].sort((a, b) => a.frame - b.frame)) {
      if (event.show.includes(name)) shown = true;
      else if (shown && event.hide.includes(name)) return event.frame / SUBMESH_EVENT_FPS;
    }
    return undefined;
  }
  setForm(form?: 'front' | 'back'): void {
    if (this.form !== form) {
      this.form = form;
      this.revision = -1;
    }
  }
  /** The timed form's clip for `state` while the form is on (manifest timedFormAnimations), when the model carries it. */
  private timedFormName(state: ActionState): string | undefined {
    const set = this.metadata.timedFormAnimations;
    if (!set || !this.submeshes?.formOn) return undefined;
    const name = state === 'idle' ? set.idle : state === 'move' ? set.move
      : state === 'attack' ? (set.attackAlt && this.formAttacks % 2 === 1 ? set.attackAlt : set.attack) : undefined;
    return name && this.clips.has(name) ? name : undefined;
  }
  private nameFor(state: ActionState, form = this.form): string {
    const timed = this.timedFormName(state);
    if (timed) return timed;
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
    const timedAttack = state === 'attack' ? this.timedFormName('attack') : undefined;
    if (timedAttack) this.formAttacks++;
    const formAttack = state === 'attack' ? timedAttack ?? (form ? this.metadata.formAnimations?.[form]?.attack : undefined) : undefined;
    const sequence = state === 'cast'
      ? selectCastSequence(this.metadata, castIndex, context)
      : state === 'attack' && !(formAttack && this.clips.has(formAttack))
        ? this.metadata.attackSequence
        : undefined;
    // A clip list rotates by the rule's cast number (Ekko's three spell clips); unreported (0) plays the first.
    const main = sequence && (Array.isArray(sequence.main) ? sequence.main[Math.max(0, castIndex - 1) % sequence.main.length] : sequence.main as string);
    const names = sequence ? [sequence.in, sequence.hold, main, sequence.out].filter((v): v is string => !!v)
      : [timedAttack ?? this.nameFor(state, context.form)];
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
    if (hold !== undefined) return { clips: names, durationSeconds, holdSeconds: hold };
    const release = state === 'attack' && !sequence && !(formAttack && this.clips.has(formAttack)) ? this.release(clips[0]!, interval) : undefined;
    if (release) return { clips: names, durationSeconds: release.durationSeconds, release: release.release };
    return { clips: names, durationSeconds };
  }
  /**
   * The original lets go after windupRatio of the attack interval; the clip's head runs up to its release frame in that
   * time, then the rest plays at 1× (faster only if the next attack would cut it off) and the unit returns to idle.
   */
  private release(clip: AnimationClip, interval?: number) {
    const data = this.metadata.attackRelease, at = attackReleaseSeconds(data, interval);
    if (!data || at === undefined || !(data.clipSeconds < clip.duration)) return undefined;
    const tail = clip.duration - data.clipSeconds;
    const room = (interval !== undefined && Number.isFinite(interval) && interval > 0 ? interval : data.baseIntervalSeconds) * 0.9 - at;
    const tailSpeed = room > 0 ? Math.max(1, tail / room) : Math.max(1, tail / 0.05);
    return { durationSeconds: at + tail / tailSpeed, release: { atSeconds: at, headSpeed: data.clipSeconds / at, tailSpeed } };
  }
  private play(clip: AnimationClip, loop: boolean, blend: number): void {
    const next = this.mixer.clipAction(clip), previous = this.active;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(this.speed);
    next.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.play();
    if (previous && previous !== next) next.crossFadeFrom(previous, blend, false);
    this.active = next;
    this.heldSeconds = 0;
    this.switchSubmeshes();
  }
  /**
   * Hold (or release) the manifest's status pose. It eases in and out over its blendSeconds, and only shows while the
   * unit idles or moves: an attack or cast plays whole, then the pose returns.
   */
  setStatusPose(on: boolean): void {
    const pose = this.metadata.statusPose;
    if (!pose) return;
    if (!this.pose) {
      if (!on) return;
      const source = this.clips.get(pose.clip);
      if (!source) return;
      const parts = poseParts(pose, source).map(({ clip, weight }) => {
        const action = this.mixer.clipAction(clip);
        action.setLoop(LoopRepeat, Infinity).setEffectiveTimeScale(0).setEffectiveWeight(0).play();
        return { action, weight };
      });
      if (!parts.length) return;
      this.pose = { on, fraction: 0, parts };
    }
    this.pose.on = on;
  }
  /**
   * Turn the model's timed form (TIMED_FORMS) on or off; it shows over every clip until turned off. With the manifest's
   * timedFormClips, turning it on plays the entry clip on the form's bones (over whatever the body plays), and turning it
   * off plays the exit clip there first and hides the form when that ends. `immediate` (a new combat or a rewind) turns
   * it off at once, with no clip.
   */
  setTimedForm(on: boolean, immediate = false): void {
    if (!this.submeshes) return;
    this.stopFormClip();
    const was = this.submeshes.formOn;
    if (on) {
      this.submeshes.setForm(true);
      if (!immediate) this.startFormClip(this.metadata.timedFormClips?.enter, false);
    } else if (immediate || !this.submeshes.formOn || !this.startFormClip(this.metadata.timedFormClips?.exit, true)) this.submeshes.setForm(false);
    if (was !== this.submeshes.formOn) this.formChanged();
    this.switchSubmeshes();
  }
  /** The form showed or hid: an idle or move loop changes to the clip of the form it is now in (attacks and casts play out). */
  private formChanged(): void {
    if (!this.submeshes?.formOn) this.formAttacks = 0;
    if (this.baseState !== 'idle' && this.baseState !== 'move') return;
    const clip = this.clips.get(this.nameFor(this.baseState));
    if (clip && this.active?.getClip() !== clip) this.play(clip, true, FORM_LOOP_BLEND);
  }
  /** The named clip cut to the tracks of the bones that skin the form's submeshes (null when it has none of them). */
  private formTracks(name: string): AnimationClip | null {
    if (this.formClips.has(name)) return this.formClips.get(name)!;
    const source = this.clips.get(name), bones = this.submeshes?.formBones();
    const tracks = source && bones?.size ? source.tracks.filter(track => bones.has(PropertyBinding.parseTrackName(track.name).nodeName)) : [];
    const clip = tracks.length ? new AnimationClip(`${name}:form`, source!.duration, tracks) : null;
    this.formClips.set(name, clip);
    return clip;
  }
  private startFormClip(name: string | undefined, exit: boolean): boolean {
    const clip = name ? this.formTracks(name) : null;
    if (!clip || !(clip.duration > 0)) return false;
    const action = this.mixer.clipAction(clip);
    action.reset().setLoop(LoopOnce, 1).setEffectiveTimeScale(1).setEffectiveWeight(FORM_CLIP_WEIGHT);
    action.clampWhenFinished = true;
    action.play();
    this.formClip = { action, left: clip.duration, share: 1, exit };
    return true;
  }
  private stopFormClip(): void {
    this.formClip?.action.stop();
    this.formClip = undefined;
  }
  private updateFormClip(seconds: number): void {
    const clip = this.formClip;
    if (!clip) return;
    if (clip.left > 0) { clip.left -= seconds; if (clip.left > 0) return; }
    if (clip.exit) { this.stopFormClip(); this.submeshes?.setForm(false); this.formChanged(); this.switchSubmeshes(); return; }
    // The entry clip ends in the form's spread pose: hand its bones back to the body's clip over FORM_CLIP_FADE.
    clip.share = Math.max(0, clip.share - seconds / FORM_CLIP_FADE);
    if (clip.share <= 0) { this.stopFormClip(); return; }
    clip.action.setEffectiveWeight(clip.share >= 1 ? FORM_CLIP_WEIGHT : clip.share / (1 - clip.share));
  }
  /** The status pose's share of its bones right now (0 when there is none). */
  get statusPoseFraction(): number { return this.pose?.fraction ?? 0; }
  private updatePose(seconds: number): void {
    const pose = this.pose;
    if (!pose) return;
    const target = pose.on && (this.baseState === 'idle' || this.baseState === 'move') ? 1 : 0;
    const blend = this.metadata.statusPose?.blendSeconds ?? 0.2;
    pose.fraction = blend > 0 ? (target > pose.fraction ? Math.min(target, pose.fraction + seconds / blend) : Math.max(target, pose.fraction - seconds / blend)) : target;
    for (const { action, weight } of pose.parts) {
      const share = pose.fraction * weight;
      action.setEffectiveWeight(share >= 1 ? 1e4 : share / (1 - share));
    }
  }
  apply(output: ActionOutput): boolean {
    if (this.revision === output.revision) return !!this.active;
    this.revision = output.revision;
    this.baseState = output.state;
    const playback = output.playback ?? ((output.state === 'cast' || output.state === 'attack') ? this.resolvePlayback(output.state) : undefined);
    // Absent casts leave both the active action and its playback time unchanged.
    if (playback === null) return !!this.active;
    const sequence = playback?.clips.map(name => this.clips.get(name));
    if (sequence?.some(c => !c)) return !!this.active;
    const clip = sequence?.[0] ?? this.clips.get(this.nameFor(output.state));
    this.queue = []; this.stageLeft = 0; this.speed = 1; this.timing = undefined; this.releaseLeft = 0; this.tailSpeed = 1;
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
    const release = playback?.release;
    if (release && sequence?.length === 1 && !this.stage) {
      this.speed = release.headSpeed; this.tailSpeed = release.tailSpeed;
      this.releaseLeft = release.atSeconds; this.stageLeft = 0;
    }
    // A sped-up head is short (0.1–0.2 s): the crossfade from the previous pose may take at most half of it.
    const blend = this.releaseLeft > 0 ? Math.min(output.blendSeconds, this.releaseLeft / 2) : output.blendSeconds;
    this.play(atMain ? this.stage!.primary : clip, output.loop, blend);
    if (atMain) this.startLayers(this.stage!.extras);
    return true;
  }
  private stageSeconds(index: number, raw: number): number {
    return raw / this.speed + (this.timing?.pads[index] ?? 0);
  }
  update(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('invalid-delta');
    this.updatePose(seconds);
    this.updateFormClip(seconds);
    if (this.releaseLeft > 0) {
      if (seconds < this.releaseLeft) { this.mixer.update(seconds); this.releaseLeft -= seconds; this.switchSubmeshes(); return; }
      this.mixer.update(this.releaseLeft); seconds -= this.releaseLeft; this.releaseLeft = 0;
      this.speed = this.tailSpeed; this.active?.setEffectiveTimeScale(this.speed);
    }
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
    const last = this.active, from = last?.time ?? 0;
    this.mixer.update(seconds);
    if (this.stageLeft > 0) this.stageLeft -= seconds;
    if (last && last === this.active && last.loop === LoopOnce)
      this.heldSeconds += Math.max(0, from + seconds * last.timeScale - last.getClip().duration);
    this.switchSubmeshes();
  }
  dispose(): void { this.stopFormClip(); for (const part of this.pose?.parts ?? []) part.action.stop(); this.pose = undefined; this.stopLayers(); this.dropFadedLayers(); this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); this.active = undefined; this.queue = []; this.stageLeft = 0; this.releaseLeft = 0; }
}
