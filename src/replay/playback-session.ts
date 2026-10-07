import type { BattleRecord } from '../m6/contracts';
import { CHECKPOINT_INTERVAL_TICKS } from '../m6/limits';
import { COMBAT_TICK_MS, stepCombat, type CombatState, type CombatEvent } from '../simulation/combat';
import { deepFreeze, equalContent, validateBattleRecord } from './history';

export interface ReplaySnapshot {
  readonly combat: CombatState; readonly events: readonly CombatEvent[];
  readonly tick: number; readonly endTick: number; readonly nextEventSeq: number;
  readonly playing: boolean; readonly speed: 1 | 2 | 4;
}
/** Isolated combat-only playback; cache belongs to this one selected battle. */
export class PlaybackSession {
  private record: BattleRecord | null;
  private state: CombatState;
  private checkpoints = new Map<number, CombatState>();
  private playing = false;
  private speed: 1 | 2 | 4 = 1;
  private accumulator = 0;
  private snapshot: ReplaySnapshot | null = null;
  constructor(record: BattleRecord) {
    const verified = validateBattleRecord(record);
    if (verified.terminal.status !== 'finished') throw new Error('只能回放已完成战斗');
    this.record = deepFreeze(structuredClone(record)); this.state = structuredClone(record.initial);
    this.checkpoints.set(0, structuredClone(this.state));
  }
  private requireRecord(): BattleRecord { if (!this.record) throw new Error('回放已关闭'); return this.record; }
  read(): ReplaySnapshot {
    const record = this.requireRecord();
    if (this.snapshot) return this.snapshot;
    // The private combat is detached at construction/seek and advanced immutably.
    // Freeze it in place; record events already have deeply frozen ownership.
    return this.snapshot = deepFreeze({ combat: this.state, events: Object.freeze(record.events.slice(0, this.state.nextEventSeq!)), tick: this.state.tick,
      endTick: record.endTick, nextEventSeq: this.state.nextEventSeq!, playing: this.playing, speed: this.speed });
  }
  private step(): void {
    const record = this.requireRecord(), from = this.state.nextEventSeq!;
    const next = stepCombat(this.state);
    if (!equalContent(next.events, record.events.slice(from, from + next.events.length))) throw new Error('回放事件不一致');
    this.state = next.state; this.snapshot = null;
    if (this.state.tick % CHECKPOINT_INTERVAL_TICKS === 0) this.checkpoints.set(this.state.tick, structuredClone(this.state));
    if (this.state.status === 'finished') { this.playing = false; this.accumulator = 0; this.snapshot = null; }
  }
  seek(tick: number): ReplaySnapshot {
    const record = this.requireRecord();
    if (!Number.isSafeInteger(tick) || tick < 0 || tick > record.endTick) throw new Error('回放时间超出范围');
    const nearest = [...this.checkpoints.keys()].filter(value => value <= tick).sort((a,b)=>b-a)[0];
    this.state = structuredClone(this.checkpoints.get(nearest)!); this.accumulator = 0; this.snapshot = null;
    while (this.state.tick < tick) this.step();
    return this.read();
  }
  play(): void { this.requireRecord(); if (this.state.status !== 'finished') this.playing = true; this.snapshot = null; }
  pause(): void { this.requireRecord(); this.playing = false; this.accumulator = 0; this.snapshot = null; }
  setSpeed(speed: 1 | 2 | 4): void { this.requireRecord(); if (![1,2,4].includes(speed)) throw new Error('不支持的回放速度'); this.speed = speed; this.accumulator = 0; this.snapshot = null; }
  advance(displayDelta: number): ReplaySnapshot {
    this.requireRecord();
    if (!Number.isFinite(displayDelta) || displayDelta < 0) throw new Error('无效回放时间');
    if (this.playing) {
      this.accumulator += displayDelta * this.speed;
      while (this.accumulator >= COMBAT_TICK_MS && this.playing) { this.accumulator -= COMBAT_TICK_MS; this.step(); }
    }
    return this.read();
  }
  dispose(): void { this.playing = false; this.accumulator = 0; this.checkpoints.clear(); this.record = null; this.snapshot = null; this.state = { ...this.state, units: [] }; }
}
