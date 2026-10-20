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
import { createCombatReplayRecorder, runSharedMatchCommand, type CombatReplay, type CombatReplayRecorder, type SharedPoolState } from '../../server-entry';
import type { CombatState, LedgerCombatEvent } from '../../simulation/combat-types';
import type { MatchEvent, MatchState } from '../../simulation/match-types';
import { BattleResolveError } from './battle-resolver';
import { primeCombatReplay } from './projection';
import { guardedBattle, startTask, twoSidedResult } from './two-sided-resolver';
import type { BattleInput, BattleSeatOutcome, PlaceholderBattleResult, TwoSidedBattleResult } from './types';
import type { BattleReplayTask } from '../../server-entry';

/** How far (in combat ticks) a live run stays ahead of the battle clock: a gold change takes effect this many ticks later (0.4 s). */
export const LIVE_BANK_LEAD_TICKS = 8;
/** Upper bound of a rules battle (the engine stops at 1200 ticks). */
const MAX_COMBAT_TICKS = 1200;

/** One rules step of a PvE seat's live combat, recorded once the state it led to is published. */
export interface LiveStep { readonly previous: CombatState; readonly next: CombatState; readonly events: readonly LedgerCombatEvent[] }
export interface LiveCatchUp { readonly pool: SharedPoolState; readonly state: MatchState; readonly events: readonly MatchEvent[]; readonly steps: readonly LiveStep[] }

/** One pending sample: `gold` is the seat's authoritative Match.gold, applied before the live run steps past `tick`. */
interface QueuedSample { readonly tick: number; readonly seatId: string; readonly gold: number }

/**
 * The live run of one two-sided battle. Started from the battle's own frozen envelope, so until a sample changes the
 * combat it is the frozen run again. It never steps past the tick the room allows (`advance(target)`), because a later
 * gold change must still land before the tick it belongs to.
 */
export class LivePvpTrack {
  private readonly task: BattleReplayTask;
  private current = 0;
  private readonly queue: QueuedSample[] = [];
  private finished: TwoSidedBattleResult | null = null;

  constructor(readonly envelope: BattleInput, readonly frozen: TwoSidedBattleResult) {
    this.task = startTask(envelope, true) as BattleReplayTask;
  }

  get battleId(): string { return this.envelope.battleId; }
  /** The tick the live run is at: the next sample is applied before stepping from it. */
  get tick(): number { return this.current; }
  get result(): TwoSidedBattleResult | null { return this.finished; }
  /** The live result once it differs from the frozen one (it carries the samples the rules applied); null while it does not. */
  get adopted(): TwoSidedBattleResult | null {
    return this.finished && this.finished.battle.bankSamples?.length ? this.finished : null;
  }

  /** Queues `gold` for `seatId` at `tick` (never before the live run or an earlier sample). Ignored once the run finished. */
  sample(seatId: string, gold: number, tick: number): void {
    if (this.finished) return;
    const last = this.queue.at(-1)?.tick ?? 0;
    this.queue.push({ tick: Math.max(tick, this.current, last), seatId, gold });
  }

  /** Steps toward `target` (at most `maxTicks` steps), applying each queued sample at its tick. True once finished. */
  advance(target: number, maxTicks: number): boolean {
    for (let steps = 0; !this.finished && this.current < target && steps < maxTicks; steps++) {
      this.applyDue();
      const battle = guardedBattle(this.battleId, () => this.task.advance(1));
      this.current++;
      if (battle) this.finished = twoSidedResult(this.envelope, battle, this.task);
      else if (this.current >= this.envelope.maxSteps) throw new BattleResolveError(this.battleId, 'battle-validation:step-limit-exceeded');
    }
    return this.finished !== null;
  }

  /** Runs to the end regardless of the clock (no further sample can arrive). */
  finish(): TwoSidedBattleResult {
    while (!this.advance(MAX_COMBAT_TICKS + 1, MAX_COMBAT_TICKS + 1)) { /* bounded by maxSteps */ }
    return this.finished!;
  }

  private applyDue(): void {
    while (this.queue.length && this.queue[0]!.tick <= this.current) {
      const next = this.queue.shift()!;
      guardedBattle(this.battleId, () => this.task.sampleBankGold(next.seatId, next.gold));
    }
  }
}

/**
 * A PvE seat whose live combat the room stepped during the battle (before each operation, up to the live tick), so the
 * rules read the gold the seat had at each tick. The frames are recorded as the steps happen; the combat cannot be
 * re-run from its start later, because the gold it read is not part of the combat input.
 */
export class LivePveTrack {
  private readonly recorder: CombatReplayRecorder;
  private readonly initial: CombatState;
  private readonly events: LedgerCombatEvent[];

  /** `initialEvents`: the combat's tick-0 ledger (from the frozen run, which shares the opening). */
  constructor(readonly seatId: string, start: MatchState, initialEvents: readonly LedgerCombatEvent[]) {
    this.initial = combatOf(seatId, start);
    if (this.initial.tick !== 0) throw new BattleResolveError(seatId, 'live-combat-not-at-start');
    const opening = initialEvents.filter(event => event.eventSeq < (this.initial.nextEventSeq ?? 0));
    this.events = [...opening];
    this.recorder = createCombatReplayRecorder(this.initial, opening);
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

/** Frames of `next` from the first tick that differs from `previous`; null when they are the same replay. */
export function replayTail(previous: CombatReplay, next: CombatReplay): { readonly fromTick: number; readonly ticks: CombatReplay['ticks']; readonly terminal: CombatReplay['terminal'] } | null {
  let index = 0;
  const shorter = Math.min(previous.ticks.length, next.ticks.length);
  while (index < shorter && JSON.stringify(previous.ticks[index]) === JSON.stringify(next.ticks[index])) index++;
  if (index === previous.ticks.length && index === next.ticks.length && JSON.stringify(previous.terminal) === JSON.stringify(next.terminal)) return null;
  return { fromTick: index, ticks: next.ticks.slice(index), terminal: next.terminal };
}
