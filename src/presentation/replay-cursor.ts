/**
 * G5 review playback of a finished online battle: the compact replay (contract §14.2) stepped at tick pace with
 * the same reducer the live board uses (`applyCombatReplayTick`), plus pause, speed and seek. Seeking restarts from
 * the nearest keyframe at or before the target. Display only, independent of the session's own playback.
 */
import { COMBAT_TICK_MS } from '../simulation/combat';
import { applyCombatReplayTick, type CombatReplay, type CombatViewEvent, type CombatViewState } from '../simulation/combat-replay-view';

export type ReviewSpeed = 1 | 2 | 4;
export class ReplayCursor {
  /** Index of the next tick record to apply; equals `ticks.length` at the end. */
  private next = 0;
  private accumulator = 0;
  private current: CombatViewState;
  private log: CombatViewEvent[] = [];
  playing = true;
  speed: ReviewSpeed = 1;
  constructor(readonly replay: CombatReplay) { this.current = replay.initial; }
  get view(): CombatViewState { return this.current; }
  /** Every event played so far, in order (a seek rebuilds it). */
  get events(): readonly CombatViewEvent[] { return this.log; }
  get tick(): number { return this.current.tick; }
  get endTick(): number { return this.replay.terminal.tick; }
  get ended(): boolean { return this.next >= this.replay.ticks.length; }
  /** Wall time of a frame; returns true when the view changed. */
  advance(delta: number): boolean {
    if (!this.playing || this.ended || !Number.isFinite(delta) || delta <= 0) return false;
    this.accumulator += delta * this.speed;
    let changed = false;
    while (this.accumulator >= COMBAT_TICK_MS && !this.ended) { this.accumulator -= COMBAT_TICK_MS; this.apply(this.next++); changed = true; }
    if (this.ended) { this.playing = false; this.accumulator = 0; }
    return changed;
  }
  /** Shows the view right after the last tick record at or before `tick` (the initial view below the first record). */
  seek(tick: number): void {
    const ticks = this.replay.ticks;
    let target = -1;
    for (let i = 0; i < ticks.length && ticks[i]!.tick <= tick; i++) target = i;
    let start = 0; this.current = this.replay.initial;
    for (let i = target; i >= 0; i--) if (ticks[i]!.keyframe) { start = i; break; }
    this.log = ticks.slice(0, start).flatMap(frame => frame.events);
    for (let i = start; i <= target; i++) this.apply(i);
    this.next = target + 1; this.accumulator = 0;
  }
  /** Play from the start again once the end was reached; otherwise toggle pause. */
  toggle(): void {
    if (this.ended) { this.seek(-1); this.playing = true; return; }
    this.playing = !this.playing; this.accumulator = 0;
  }
  private apply(index: number): void {
    const frame = this.replay.ticks[index]!;
    this.current = applyCombatReplayTick(this.current, frame); this.log.push(...frame.events);
  }
}
