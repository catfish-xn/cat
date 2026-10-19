import type { ActionState } from './contracts';

/** Structural subset of combat-replay-view events; extra replay fields are ignored. */
export type AnimationEvent =
  | { type: 'movement' | 'death' | 'unitRevived'; unitId: string }
  | { type: 'attack'; attackerId: string }
  | { type: 'cast'; sourceId: string }
  | { type: 'heal'; targetId: string }
  | { type: 'packetDamage'; sourceId: string; targetId: string; hit: boolean; hpDamage: number; absorbed: number };
export interface ActionOutput { state: ActionState; previous: ActionState; blendSeconds: number; loop: boolean; revision: number }
export interface ActionConfig { blendSeconds?: number; durations?: Partial<Record<Exclude<ActionState, 'idle' | 'death'>, number>> }
const defaults = { move: 0.2, attack: 0.45, cast: 0.7, hit: 0.15 };
/** Pure visual clock, independent of rules, AnimationMixer, Phaser and DOM. */
export class UnitActionState {
  private state: ActionState = 'idle';
  private previous: ActionState = 'idle';
  private remaining = 0;
  private revision = 0;
  private blend: number;
  private durations: typeof defaults;
  constructor(readonly unitId: string, config: ActionConfig = {}) {
    this.blend = config.blendSeconds ?? 0.12;
    this.durations = { ...defaults, ...config.durations };
    if (![this.blend, ...Object.values(this.durations)].every(n => Number.isFinite(n) && n >= 0)) throw new Error('invalid-action-config');
  }
  get output(): ActionOutput {
    return { state: this.state, previous: this.previous, blendSeconds: this.blend,
      loop: this.state === 'idle' || this.state === 'move', revision: this.revision };
  }
  private enter(state: ActionState): void {
    this.previous = this.state; this.state = state; this.revision++;
    this.remaining = state === 'death' ? Infinity : state === 'idle' ? 0 : this.durations[state];
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
    if (event.type === 'unitRevived') { if (this.state === 'death') this.enter('idle'); return this.output; }
    if (this.state === 'death') return this.output;
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
  update(seconds: number): ActionOutput {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('invalid-delta');
    if (this.state !== 'idle' && this.state !== 'death' && (this.remaining -= seconds) <= 0) this.enter('idle');
    return this.output;
  }
}
