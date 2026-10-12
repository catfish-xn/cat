/**
 * MatchSession replacement for online play: every command is an intent sent to the server; the state shown
 * comes back from it. Combat is not stepped here: the server's compact replay (contract §14.2) is played back
 * at tick pace. BoardScene and StrategyPanel read the same accessors as offline (`combatView`, `advanceDisplay`).
 *
 * Playback (C6): from `initial`, one tick record per 50 ms through `applyCombatReplayTick` (animation events
 * first, then the end-of-tick `unitUpdated` values, keyframes replace the whole view). Nothing is added up from
 * damage or mana events. During playback `state` is my last authoritative state shown in the combat phase; gold,
 * HP and the round record are not touched and arrive as the server's next state push. After the last tick the
 * board stays on `terminal` until that push.
 */
import { COMBAT_TICK_MS } from '../../simulation/combat';
import type { LedgerCombatEvent } from '../../simulation/combat-types';
import type { MatchCommandResult, MatchEvent, MatchState } from '../../simulation/match-types';
import type { UnitLocation } from '../../simulation/units';
import { createMatch } from '../../simulation/match';
import { applyCombatReplayTick, type CombatReplay, type CombatViewState, type DisplayCombatEvent } from '../../presentation/combat-display';
import { MatchSession } from '../match-session';
import type { ClientCommand, GameClient } from './protocol';
import { nextBaseline, readRoundGains, type RoundBaseline, type RoundGains } from './round-gains';

/** Why the last intent did not change the local state although it was not refused by the rules. */
export type IntentNotice = { readonly kind: 'pending'; readonly commandId: number } | { readonly kind: 'offline'; readonly text: string };
/** The "开战" transition: the initial view is held this long before tick 0 plays (inside the room's battle tail). */
export const REPLAY_OPENING_MS = 400;
/** Playback behind wall time by more than this (dropped or stalled frames) catches up at once; 1x otherwise. */
const CATCH_UP_MS = 250;

export class RemoteSession extends MatchSession {
  private replay: CombatReplay | null = null;
  private nextTick = 0;
  private view: CombatViewState | null = null;
  private played: DisplayCombatEvent[] = [];
  private openingPending = false;
  private notice: IntentNotice | null = null;
  /** Set while the connection is down or superseded: commands are not sent and the reason is shown instead. */
  offline: string | null = null;
  /** My seat is eliminated: the match goes on, but nothing of mine can be commanded (C5). */
  spectating = false;
  /** My authoritative state when playback started; the battle is shown in its combat phase. */
  private playbackBase: MatchState | null = null;
  /** Wall time when the current replay arrived, and the frame time handed to playback since then. */
  private replayStartedAt = 0;
  private replayElapsed = 0;
  /** @param clock wall time in ms (performance.now in the browser); only keeps playback at 1x across dropped frames. */
  constructor(private readonly client: GameClient, initial: MatchState = createMatch(), private readonly clock: () => number = () => performance.now()) { super(initial); }
  /** Read once by the scene right after a command returned `ok: false`: pending/offline instead of a rule failure. */
  takeNotice(): IntentNotice | null { const notice = this.notice; this.notice = null; return notice; }
  /** True once per received replay: the scene shows its opening transition. */
  takeOpening(): boolean { const opening = this.openingPending; this.openingPending = false; return opening; }
  override get combatView(): CombatViewState | null { return this.view; }
  override get combatRuntime(): null { return null; }
  override get displayLog(): readonly DisplayCombatEvent[] { return this.played; }
  /** Last pre-battle state of the current round, for "本轮获得" (C7). */
  private baseline: RoundBaseline | null = null;
  /** What my seat gained this round (new units, inventory items, gold before income); null before the battle or when unknown. */
  roundGains(): RoundGains | null { return this.playingBack ? null : readRoundGains(this.baseline, this.matchState); }
  /** Server pushed my authoritative state; `events` are those of my commands it confirms. */
  receiveState(state: MatchState, events: readonly MatchEvent[] = []): void {
    this.baseline = nextBaseline(this.baseline, state);
    const base = this.playbackBase;
    // A pre-battle state of the same round (resume snapshot order) only refreshes what the battle is shown on.
    if (base && this.replay && state.round === base.round && state.phase === 'preparation') {
      this.playbackBase = state;
      const before = this.matchState; this.matchState = this.overlay(); this.notify(before, [], 'command');
      return;
    }
    if (this.playingBack) { this.superseded++; this.skipPlayback(); } // a newer state supersedes the battle still being played
    this.replay = null; this.view = null; this.played = []; this.playbackBase = null; this.openingPending = false;
    if (state === this.matchState) return;
    const before = this.matchState;
    if (state.round !== before.round) this.combatLedger = [];
    this.matchState = state; this.accumulator = 0;
    this.notify(before, this.record(events), 'command');
  }
  /** Server finished my battle of this round: show `initial`, then play one tick record per 50 ms. */
  receiveReplay(replay: CombatReplay): void {
    if (!replay.ticks.length) return;
    this.replay = replay; this.nextTick = 0; this.view = replay.initial; this.played = []; this.openingPending = true;
    // Tick 0 plays when the opening transition ends; every later record 50 ms after the previous one.
    this.accumulator = COMBAT_TICK_MS - REPLAY_OPENING_MS;
    this.replayStartedAt = this.clock(); this.replayElapsed = 0;
    const before = this.matchState; this.playbackBase = this.playbackBase ?? before; this.matchState = this.overlay();
    this.notify(before, [], 'command');
  }
  /** Display-only: my last authoritative state in the combat phase; the combat itself is `combatView`. */
  private overlay(): MatchState { return { ...(this.playbackBase ?? this.matchState), phase: 'combat', combat: null } as unknown as MatchState; }
  /** Debug/acceptance read: playback progress and how many battles a newer state cut short. */
  playbackDebug() {
    return { playingBack: this.playingBack, played: this.played.length, tick: this.view?.tick ?? null, terminalTick: this.replay?.terminal.tick ?? null, superseded: this.superseded };
  }
  private superseded = 0;
  get playingBack(): boolean { return this.replay !== null && this.nextTick < this.replay.ticks.length; }
  /** Drop remaining ticks and show the battle's end (tab hidden, superseded by a newer state). */
  skipPlayback(): void {
    const replay = this.replay;
    if (!replay || !this.playingBack) return;
    for (const frame of replay.ticks.slice(this.nextTick)) this.played.push(...frame.events);
    this.nextTick = replay.ticks.length; this.view = replay.terminal; this.accumulator = 0; this.openingPending = false;
  }
  /** Offline stepping never runs here: the server owns the battle. */
  override advance(_delta: number): readonly LedgerCombatEvent[] { return []; }
  override advanceDisplay(delta: number): readonly DisplayCombatEvent[] {
    const replay = this.replay;
    if (this.paused || !replay || !this.playingBack || !Number.isFinite(delta) || delta < 0) return [];
    this.accumulator += delta; this.replayElapsed += delta;
    // The server settles on wall time (battle length + tail): frames the page dropped must not slow the battle down.
    const behind = this.clock() - this.replayStartedAt - this.replayElapsed;
    if (behind > CATCH_UP_MS) { this.accumulator += behind; this.replayElapsed += behind; }
    const events: DisplayCombatEvent[] = [];
    while (this.accumulator >= COMBAT_TICK_MS && this.nextTick < replay.ticks.length) {
      this.accumulator -= COMBAT_TICK_MS;
      const frame = replay.ticks[this.nextTick++]!;
      this.view = applyCombatReplayTick(this.view ?? replay.initial, frame);
      this.played.push(...frame.events); events.push(...frame.events);
    }
    if (!this.playingBack) this.accumulator = 0;
    return events;
  }
  private intent(command: ClientCommand): MatchCommandResult {
    this.notice = null;
    if (this.offline !== null) { this.notice = { kind: 'offline', text: this.offline }; return this.blocked(); }
    if (this.spectating) { this.notice = { kind: 'offline', text: '已淘汰 · 观战中，不能操作' }; return this.blocked(); }
    if (this.paused || this.playingBack) return this.blocked();
    const result = this.client.send(command);
    // Pending: nothing changes until the receipt and the state push after it (never spend gold ahead of the server).
    if (result.ok === 'pending') { this.notice = { kind: 'pending', commandId: result.commandId }; return this.blocked(); }
    if (!result.ok) return result;
    this.baseline = nextBaseline(this.baseline, result.state);
    const before = this.matchState;
    if (result.state.round !== before.round) this.combatLedger = [];
    this.matchState = result.state;
    const events = this.record(result.events);
    this.notify(before, events, 'command');
    return result;
  }
  override deploy(id: string, target: UnitLocation) { return this.intent({ type: 'deploy', unitId: id, target }); }
  override buy(slot: number, generation: number) { return this.intent({ type: 'buy', slot, generation }); }
  override sell(id: string) { return this.intent({ type: 'sell', unitId: id }); }
  override shopLock(locked: boolean, generation: number) { return this.intent({ type: 'shopLock', locked, generation }); }
  override reroll() { return this.intent({ type: 'reroll' }); }
  override buyXp() { return this.intent({ type: 'buyXp' }); }
  /** The server starts every battle at the deadline; a client cannot start or continue on its own. */
  override start(): MatchCommandResult { return this.blocked(); }
  override continue(_round: number): MatchCommandResult { return this.blocked(); }
  override combine(a: string, b: string) { return this.intent({ type: 'combine', a, b }); }
  override equip(itemId: string, unitId: string, slot: number) { return this.intent({ type: 'equip', itemId, unitId, slot }); }
  override choose(choiceId: string, generation: number, definitionId: string) { return this.intent({ type: 'choose', choiceId, generation, definitionId }); }
  override anomalyTarget(choiceId: string, generation: number, unitId: string) { return this.intent({ type: 'anomalyTarget', choiceId, generation, unitId }); }
  override anomalyReroll(choiceId: string, generation: number) { return this.intent({ type: 'anomalyReroll', choiceId, generation }); }
  override newMatch(): void { /* the server owns match lifecycle */ }
}
