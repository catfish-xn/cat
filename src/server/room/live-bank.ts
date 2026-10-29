/**
 * Live bank during the battle phase (D11-SERVER-LIVE-BANK, planning/live-gold-combat-2026-10-20.md).
 *
 * The room resolves every battle at the preparation deadline from frozen inputs and plays it back. A combat that reads
 * a seat's live gold (D11 avarice-incarnate) must instead see the gold the seat has at each tick, and the seat may buy,
 * sell or reroll during the playback. For such battles the room keeps a second, live run that follows the battle clock
 * a fixed lead ahead of the playback; a gold change is handed to the rules at the tick the live run is at, and the live
 * result, not the frozen one, is settled and shown.
 *
 * Nothing here decides a rule: the two-sided run samples through the rules' `BattleTask.sampleBankGold`, a PvE seat's
 * live combat is stepped by the rules' shared `step` (which reads Match.gold itself). The room only picks the tick.
 */
import {
  createCombatReplayRecorder, readBattleLiveGoldReaders, runSharedMatchCommand,
  type BattleReplayTask, type CombatReplay, type CombatReplayRecorder, type CombatReplayTick, type SharedPoolState,
} from '../../server-entry';
import type { CombatState, LedgerCombatEvent } from '../../simulation/combat-types';
import type { MatchEvent, MatchState } from '../../simulation/match-types';
import { BattleResolveError } from './battle-resolver';
import { primeCombatReplay } from './projection';
import { guardedBattle, startLiveTask, twoSidedResult } from './two-sided-resolver';
import type { BattleInput, BattleSeatOutcome, PlaceholderBattleResult, TwoSidedBattleResult } from './types';

/** How far (in combat ticks) a live run stays ahead of the battle clock: a gold change takes effect this many ticks later (0.4 s). */
export const LIVE_BANK_LEAD_TICKS = 8;

/** One rules step of a PvE seat's live combat, recorded once the state it led to is published. */
export interface LiveStep { readonly previous: CombatState; readonly next: CombatState; readonly events: readonly LedgerCombatEvent[] }
export interface LiveCatchUp { readonly pool: SharedPoolState; readonly state: MatchState; readonly events: readonly MatchEvent[]; readonly steps: readonly LiveStep[] }

/** One pending sample: `gold` is the seat's authoritative Match.gold, applied before the live run steps past `tick`. */
interface QueuedSample { readonly tick: number; readonly seatId: string; readonly gold: number }

/**
 * The live run of one two-sided battle. Started from the battle's own frozen envelope, so until a sample changes the
 * combat it is the frozen run again, frame for frame. It never steps past the tick the room allows (`advance(target)`),
 * because a later gold change must still land before the tick it belongs to. Once a sample changed the combat, its
 * frames are compared with the frozen replay; from the first frame that differs they are what the seats must see.
 */
export class LivePvpTrack {
  private readonly task: BattleReplayTask;
  private readonly readers: ReadonlySet<string>;
  private current = 0;
  private readonly queue: QueuedSample[] = [];
  private finished: TwoSidedBattleResult | null = null;
  /** Every frame of the live run so far, by tick (tick 0 is the shared opening). */
  private readonly frames: CombatReplayTick[];
  private streamFrom: number | null = null;

  constructor(readonly envelope: BattleInput) {
    const live = startLiveTask(envelope);
    this.task = live.task;
    this.readers = new Set(readBattleLiveGoldReaders(live.input).filter(reader => reader.readsLiveGold).map(reader => reader.seatId));
    this.frames = [live.task.initialFrame];
  }

  get battleId(): string { return this.envelope.battleId; }
  /** True when the rules say this seat's combat reads its live gold (never the frozen copy in a mirror battle). */
  reads(seatId: string): boolean { return this.readers.has(seatId); }
  get result(): TwoSidedBattleResult | null { return this.finished; }
  /** The live result once a sample changed the combat (it carries the samples the rules applied); null while none did. */
  get adopted(): TwoSidedBattleResult | null {
    return this.finished && this.finished.battle.bankSamples?.length ? this.finished : null;
  }
  /** Side A's authoritative frames after the first accepted bank change; null before a change is applied. */
  get liveFrames(): { readonly fromTick: number; readonly ticks: readonly CombatReplayTick[] } | null {
    return this.streamFrom === null ? null : { fromTick: this.streamFrom, ticks: this.frames.slice(this.streamFrom) };
  }

  /** Queues `gold` for `seatId` at `tick` (never before the live run or an earlier sample). Ignored once the run finished. */
  sample(seatId: string, gold: number, tick: number): void {
    if (this.finished || !this.reads(seatId)) return;
    const last = this.queue.at(-1)?.tick ?? 0;
    this.queue.push({ tick: Math.max(tick, this.current, last), seatId, gold });
  }

  /** Steps toward `target` (at most `maxTicks` steps), one rules tick and frame at a time. True when a new live frame came. */
  advance(target: number, maxTicks: number): boolean {
    const before = this.frames.length;
    for (let steps = 0; !this.finished && this.current < target && steps < maxTicks; steps++) {
      this.applyDue();
      const step = guardedBattle(this.battleId, () => this.task.advanceTick());
      this.current++;
      if (step.frame) this.frames.push(step.frame);
      if (step.result) this.finished = twoSidedResult(this.envelope, step.result, this.task);
      else if (this.current >= this.envelope.maxSteps) throw new BattleResolveError(this.battleId, 'battle-validation:step-limit-exceeded');
    }
    return this.streamFrom !== null && this.frames.length > before;
  }

  private applyDue(): void {
    while (this.queue.length && this.queue[0]!.tick <= this.current) {
      const next = this.queue.shift()!;
      if (guardedBattle(this.battleId, () => this.task.sampleBankGold(next.seatId, next.gold))) {
        // The frozen future used the old bank. Publish the live prefix immediately, even if rounding,
        // shields or no further attacks make its public frames equal to the prediction.
        this.streamFrom ??= this.current + 1;
      }
    }
  }
}

/**
 * A PvE seat whose live combat the room stepped during the battle (before each operation, up to the live tick), so the
 * rules read the gold the seat had at each tick. The frames are recorded as the steps happen; the combat cannot be
 * re-run from its start later, because the gold it read is not part of the combat input.
 */
export class LivePveTrack {
  private recorder: CombatReplayRecorder;
  private readonly initial: CombatState;
  private events: LedgerCombatEvent[];

  /** `initialEvents`: the combat's tick-0 ledger (from the frozen run, which shares the opening). */
  constructor(readonly seatId: string, private readonly start: MatchState, initialEvents: readonly LedgerCombatEvent[]) {
    this.initial = combatOf(seatId, start);
    if (this.initial.tick !== 0) throw new BattleResolveError(seatId, 'live-combat-not-at-start');
    const opening = initialEvents.filter(event => event.eventSeq < (this.initial.nextEventSeq ?? 0));
    this.events = [...opening];
    this.recorder = createCombatReplayRecorder(this.initial, opening);
  }

  /** Fork immutable frames and ledger; speculative ticks never enter the published track. */
  fork(): LivePveTrack {
    const fork = new LivePveTrack(this.seatId, this.start, []);
    fork.recorder = this.recorder.fork();
    fork.events = [...this.events];
    return fork;
  }

  /**
   * Steps the seat's live combat (on the latest pool) until it reaches `target` or ends. Pure: nothing is recorded until
   * the caller publishes the returned state and hands `steps` to `commit` (a refused operation publishes nothing).
   */
  catchUp(pool: SharedPoolState, state: MatchState, target: number): LiveCatchUp {
    let current = state, latest = pool;
    const matchEvents: MatchEvent[] = [];
    const steps: LiveStep[] = [];
    while (current.phase === 'combat' && combatOf(this.seatId, current).tick < target) {
      const step = runSharedMatchCommand(latest, current, { type: 'step' });
      if (!step.ok) throw new BattleResolveError(this.seatId, step.reason);
      const ledger = step.events.filter((event): event is LedgerCombatEvent => 'tick' in event);
      steps.push({ previous: combatOf(this.seatId, current), next: combatOf(this.seatId, step.state), events: ledger });
      for (const event of step.events) if (!('tick' in event)) matchEvents.push(event);
      current = step.state; latest = step.pool;
    }
    return { pool: latest, state: current, events: matchEvents, steps };
  }

  /** Records the steps of a published catch-up, in order. */
  commit(steps: readonly LiveStep[]): void {
    for (const step of steps) {
      // The combat before this step already carries the sample the rules took from Match.gold; the view has no bank.
      this.recorder.record(step.previous, { state: step.next, events: step.events });
      this.events.push(...step.events);
    }
  }

  /**
   * The seat's outcome from its finished live combat (`settled`: the seat after the rules settled the round), with the
   * recorded replay primed for the push. Null when it shows and settles exactly what the frozen outcome does.
   */
  outcome(settled: MatchState, terminal: CombatState, frozen: BattleSeatOutcome): BattleSeatOutcome | null {
    const record = settled.roundResults.at(-1);
    if (!record || record.round !== settled.round) throw new BattleResolveError(this.seatId, 'live-combat-unsettled');
    const combat = { initial: this.initial, terminal, events: this.events };
    if (frozen.combat && frozen.damage === record.playerDamage && sameCombat(frozen.combat, combat)) return null;
    const outcome: BattleSeatOutcome = { seatId: this.seatId, state: settled, result: record.result, damage: record.playerDamage, combat };
    primeCombatReplay(outcome, this.recorder.finish(terminal));
    return outcome;
  }

}

function combatOf(seatId: string, state: MatchState): CombatState {
  if (!state.combat) throw new BattleResolveError(seatId, 'no-combat');
  return state.combat;
}
function sameCombat(a: { readonly terminal: CombatState; readonly events: readonly LedgerCombatEvent[] }, b: { readonly terminal: CombatState; readonly events: readonly LedgerCombatEvent[] }): boolean {
  return a.events.length === b.events.length && JSON.stringify(a.terminal) === JSON.stringify(b.terminal) && JSON.stringify(a.events) === JSON.stringify(b.events);
}

/** A placeholder battle result with one seat's outcome replaced (PvE battles have one seat each). */
export function withOutcome(result: PlaceholderBattleResult, outcome: BattleSeatOutcome): PlaceholderBattleResult {
  return { ...result, outcomes: result.outcomes.map(candidate => candidate.seatId === outcome.seatId ? outcome : candidate) };
}

/** Replacement suffix of `next`; prefix-only/terminal-only revisions include its last tick. Null for identical replays. */
export function replayTail(previous: CombatReplay, next: CombatReplay): { readonly fromTick: number; readonly ticks: CombatReplay['ticks']; readonly terminal: CombatReplay['terminal'] } | null {
  let index = 0;
  const shorter = Math.min(previous.ticks.length, next.ticks.length);
  // Identical frame objects already match. JSON is only for equal copies, so the
  // shared prefix is not serialized again on every live revision.
  while (index < shorter) {
    const left = previous.ticks[index], right = next.ticks[index];
    if (left !== right && JSON.stringify(left) !== JSON.stringify(right)) break;
    index++;
  }
  const terminalSame = previous.terminal === next.terminal || JSON.stringify(previous.terminal) === JSON.stringify(next.terminal);
  if (index === previous.ticks.length && index === next.ticks.length && terminalSame) return null;
  // An unchanged live prefix can still discard the predicted future (or revise only the terminal).
  // Carry its last authoritative tick so own and watched tails stay nonempty and splice to exactly `next`.
  if (index === next.ticks.length && index > 0) index--;
  return { fromTick: index, ticks: next.ticks.slice(index), terminal: next.terminal };
}
