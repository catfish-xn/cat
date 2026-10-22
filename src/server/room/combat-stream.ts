/** One first-pass run and one append-only frame source for players, reconnect and observers.
 * Scheduling belongs to Room; ticks, bank sampling and settlement belong to rules.
 */
import { createCombatReplayRecorder, type BattleReplayTask, type CombatReplay, type CombatReplayTick,
  type CombatViewState, type CombatReplayRecorder } from '../../server-entry';
import { stepMatchCombatStream } from '../../simulation/match';
import type { CombatState, LedgerCombatEvent } from '../../simulation/combat-types';
import type { MatchEvent, MatchState } from '../../simulation/match-types';
import type { ReplayUnitId } from '../protocol';
import type { BattleInput, BattleSeatOutcome, TwoSidedBattleResult } from './types';
import { BattleResolveError } from './battle-resolver';
import { startLiveTask, twoSidedResult, guardedBattle } from './two-sided-resolver';
import { mirrorReplayTick, mirrorViewState, primeCombatReplay } from './projection';

export interface CombatStreamView {
  readonly battleId: string;
  readonly revision: number;
  readonly initial: CombatViewState;
  readonly ticks: readonly CombatReplayTick[];
  readonly terminal: CombatViewState | null;
  readonly unitIds: readonly ReplayUnitId[];
}
export class CombatStream {
  readonly revision = 1;
  readonly initial: CombatViewState;
  readonly frames: CombatReplayTick[];
  private readonly task: BattleReplayTask | null;
  private readonly recorder: CombatReplayRecorder | null;
  private readonly mapping: readonly { kind: string; seatId: string; combatId: string; originalId: string }[];
  private readonly right: string | null;
  private readonly opening: CombatState | null;
  private readonly ledger: LedgerCombatEvent[];
  private readonly mirroredFrames: CombatReplayTick[] = [];
  private mirroredInitial: CombatViewState | null = null;
  private mirroredTerminal: CombatViewState | null = null;
  private completedReplay: CombatReplay | null = null;
  private readonly views = new Map<string, CombatStreamView>();
  private readonly seatUnitIds = new Map<string, readonly ReplayUnitId[]>();
  result: TwoSidedBattleResult | null = null;
  terminal: CombatState | null = null;
  tick = 0;

  constructor(readonly envelope: BattleInput, pve?: { initial: CombatState; events: readonly MatchEvent[] },
    beforeTick?: import('../../server-entry').BattleTickInputSource) {
    if (pve) {
      this.opening = pve.initial; this.ledger = pve.events.filter((e): e is LedgerCombatEvent => 'tick' in e);
      this.recorder = createCombatReplayRecorder(pve.initial, this.ledger); this.task = null;
      this.initial = this.recorder.initial; this.frames = [this.recorder.initialFrame];
      this.mapping = []; this.right = null;
      if (pve.initial.status === 'finished') { this.terminal = pve.initial; this.completedReplay = this.recorder.finish(pve.initial); }
    } else {
      const live = startLiveTask(envelope, beforeTick);
      this.task = live.task; this.recorder = null; this.opening = null; this.ledger = [];
      this.initial = live.task.initial; this.frames = [live.task.initialFrame];
      this.mapping = live.input.mapping; this.right = live.input.b.seatId;
      // Tick-zero finishes still need the task to authenticate/finalize its result (without stepping).
      if (this.initial.status === 'finished') this.advancePvp();
    }
    for (const seat of envelope.seats) this.seatUnitIds.set(seat.seatId, this.mapping.filter(m => m.kind === 'unit' && m.seatId === seat.seatId)
      .map(m => ({ combatId: m.combatId, originalId: m.originalId })));
  }
  get done(): boolean { return this.terminal !== null; }
  /** Phase 2 input hook: Room's single writer installs ordered inputs before calling this boundary.
   * effectiveTick = tick + 1; never apply a command to a sealed tick or a finished run.
   */
  get nextEffectiveTick(): number | null { return this.done ? null : this.tick + 1; }
  sampleBank(seatId: string, gold: number): void {
    if (!this.done && this.task) guardedBattle(this.envelope.battleId, () => this.task!.sampleBankGold(seatId, gold));
  }
  advancePvp(): void {
    if (this.done || !this.task) return;
    const next = guardedBattle(this.envelope.battleId, () => this.task!.advanceTick());
    if (next.frame) { this.frames.push(next.frame); this.tick = next.frame.tick; }
    if (next.result) {
      this.result = twoSidedResult(this.envelope, next.result, this.task);
      this.terminal = next.result.terminal; this.completedReplay = this.task.replay();
    }
    this.checkLimit();
  }
  advancePve(state: MatchState): { state: MatchState; events: readonly MatchEvent[] } {
    if (this.done || !this.recorder || !state.combat) return { state, events: [] };
    const step = stepMatchCombatStream(state);
    const next = step.terminal ?? step.state.combat!;
    const events = step.events.filter((e): e is LedgerCombatEvent => 'tick' in e);
    this.frames.push(this.recorder.record(state.combat, { state: next, events }));
    this.ledger.push(...events); this.tick = next.tick;
    if (step.terminal) { this.terminal = step.terminal; this.completedReplay = this.recorder.finish(step.terminal); }
    this.checkLimit();
    return { state: step.state, events: step.events.filter(e => !('tick' in e)) };
  }
  pveOutcome(state: MatchState): BattleSeatOutcome {
    const record = state.roundResults.at(-1);
    if (!this.opening || !this.terminal || !this.completedReplay || record?.round !== state.round) throw new BattleResolveError(this.envelope.battleId, 'stream-unsettled');
    const outcome: BattleSeatOutcome = { seatId: this.envelope.seats[0]!.seatId, state, result: record.result,
      damage: record.playerDamage, combat: { initial: this.opening, terminal: this.terminal, events: this.ledger } };
    primeCombatReplay(outcome, this.completedReplay); return outcome;
  }
  /** Public projection only. No RNG, private input journal or full domain ledger enters the wire. */
  view(seatId: string): CombatStreamView | null {
    if (!this.envelope.seats.some(s => s.seatId === seatId)) return null;
    const mirrored = this.right === seatId, rows = this.initial.board.rows;
    if (mirrored) while (this.mirroredFrames.length < this.frames.length) this.mirroredFrames.push(mirrorReplayTick(this.frames[this.mirroredFrames.length]!, rows));
    let view = this.views.get(seatId);
    if (!view) {
      const source = this;
      view = { battleId: this.envelope.battleId, revision: this.revision,
        initial: mirrored ? this.mirroredInitial ??= mirrorViewState(this.initial, rows) : this.initial,
        ticks: mirrored ? this.mirroredFrames : this.frames,
        get terminal() { return source.completedReplay ? (mirrored
          ? source.mirroredTerminal ??= mirrorViewState(source.completedReplay.terminal, rows) : source.completedReplay.terminal) : null; },
        unitIds: this.seatUnitIds.get(seatId)! };
      this.views.set(seatId, view);
    }
    return view;
  }
  private checkLimit(): void {
    if (!this.done && this.tick >= this.envelope.maxSteps) throw new BattleResolveError(this.envelope.battleId, 'battle-validation:step-limit-exceeded');
  }
}
