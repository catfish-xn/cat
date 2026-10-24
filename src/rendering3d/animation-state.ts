import type { ActionState } from './contracts';

/** Structural subset of combat-replay-view events; extra replay fields are ignored. */
export type AnimationEvent =
  | { type: 'movement' | 'death' | 'unitRevived'; unitId: string }
  | { type: 'attack'; attackerId: string }
  | { type: 'cast'; sourceId: string }
  | { type: 'heal'; targetId: string }
  | { type: 'packetDamage'; sourceId: string; targetId: string; hit: boolean; hpDamage: number; absorbed: number };
export interface ActionPlayback { clips: readonly string[]; durationSeconds: number }
/** `spawn`: the model's rise clip (shown in the cast state), null when it has none. */
export type ResolveActionPlayback = (state: 'cast' | 'attack' | 'spawn', castIndex: number) => ActionPlayback | null;
export interface ActionOutput { state: ActionState; previous: ActionState; blendSeconds: number; loop: boolean; revision: number; playback?: ActionPlayback }
export interface ActionConfig { blendSeconds?: number; durations?: Partial<Record<Exclude<ActionState, 'idle' | 'death'>, number>>; resolvePlayback?: ResolveActionPlayback }
const defaults = { move: 0.2, attack: 0.45, cast: 0.3, hit: 0.15 };
/** Pure visual clock, independent of rules, AnimationMixer, Phaser and DOM. */
export class UnitActionState {
  private state: ActionState = 'idle';
  private previous: ActionState = 'idle';
  private remaining = 0;
  private revision = 0;
  private blend: number;
  private durations: typeof defaults;
  private resolvePlayback?: ResolveActionPlayback;
  private playback?: ActionPlayback;
  private castIndex = 0;
  constructor(readonly unitId: string, config: ActionConfig = {}) {
    this.blend = config.blendSeconds ?? 0.12;
    this.durations = { ...defaults, ...config.durations };
    this.resolvePlayback = config.resolvePlayback;
    if (![this.blend, ...Object.values(this.durations)].every(n => Number.isFinite(n) && n >= 0)) throw new Error('invalid-action-config');
  }
  get output(): ActionOutput {
    return { state: this.state, previous: this.previous, blendSeconds: this.blend,
      loop: this.state === 'idle' || this.state === 'move', revision: this.revision,
      ...(this.playback ? { playback: this.playback } : {}) };
  }
  setPlaybackResolver(resolve: ResolveActionPlayback): void { this.resolvePlayback = resolve; }
  /** A summon rising (it appears or is revived) plays its spawn clip once, when its model names one. */
  spawn(): ActionOutput {
    const playback = this.resolvePlayback?.('spawn', 0);
    if (!playback || this.state === 'death') return this.output;
    if (!playback.clips.length || !Number.isFinite(playback.durationSeconds) || playback.durationSeconds <= 0) throw new Error('invalid-playback');
    this.playback = playback;
    this.previous = this.state; this.state = 'cast'; this.revision++; this.remaining = playback.durationSeconds;
    return this.output;
  }
  private enter(state: ActionState): void {
    let playback: ActionPlayback | undefined;
    if (state === 'cast' || state === 'attack') {
      const resolved = this.resolvePlayback?.(state, this.castIndex);
      if (state === 'cast') this.castIndex++;
      if (resolved === null) return;
      playback = resolved;
      if (playback && (!playback.clips.length || !Number.isFinite(playback.durationSeconds) || playback.durationSeconds <= 0)) throw new Error('invalid-playback');
    }
    this.playback = playback;
    this.previous = this.state; this.state = state; this.revision++;
    this.remaining = state === 'death' ? Infinity : state === 'idle' ? 0 : playback?.durationSeconds ?? this.durations[state];
  }
  consume(event: AnimationEvent): ActionOutput {
    // Ownership follows replay event semantics, not the presence of sourceId.
    let id: string;
    switch (event.type) {
      case 'movement': case 'death': case 'unitRevived': id = event.unitId; break;
      case 'attack': id = event.attackerId; break;
      case 'cast': id = event.sourceId; break;
      case 'packetDamage': case 'heal': id = event.targetId; break;
    }
    if (id !== this.unitId) return this.output;
    if (event.type === 'unitRevived') { if (this.state === 'death') { this.enter('idle'); this.spawn(); } return this.output; }
    if (this.state === 'death') return this.output;
    // Resolved casts own their visual window, so incidental hits cannot cut off the ending.
    if (this.state === 'cast' && this.playback && ['movement', 'attack', 'packetDamage'].includes(event.type)) return this.output;
    // A hit shows only on a unit at rest: a swing or run cut by every incoming packet snaps back to idle mid-clip.
    if (event.type === 'packetDamage' && this.state !== 'idle' && this.state !== 'hit') return this.output;
    // The next step of a run extends it; restarting it would rewind the looping clip at every cell.
    if (event.type === 'movement' && this.state === 'move') { this.remaining = this.durations.move; return this.output; }
    switch (event.type) {
      case 'death': this.enter('death'); break;
      case 'movement': this.enter('move'); break;
      case 'attack': this.enter('attack'); break;
      case 'cast': this.enter('cast'); break;
      case 'packetDamage': if (event.hit && event.hpDamage + event.absorbed > 0) this.enter('hit'); break;
      case 'heal': break; // Healing has no dedicated action and does not interrupt one.
    }
    return this.output;
  }
  /** Crowd control (presentation): drops a swing, cast, run or flinch back to idle; death stays. */
  interrupt(): ActionOutput {
    if (this.state !== 'idle' && this.state !== 'death') this.enter('idle');
    return this.output;
  }
  update(seconds: number): ActionOutput {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('invalid-delta');
    if (this.state !== 'idle' && this.state !== 'death' && (this.remaining -= seconds) <= 0) this.enter('idle');
    return this.output;
  }
}
