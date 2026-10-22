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
import { equipmentTargetId } from '../../presentation/battle-equipment';
import { COMBAT_TICK_MS } from '../../simulation/combat';
import type { LedgerCombatEvent } from '../../simulation/combat-types';
import type { MatchCommandResult, MatchEvent, MatchState } from '../../simulation/match-types';
import type { UnitLocation } from '../../simulation/units';
import { createMatch } from '../../simulation/match';
import { applyCombatReplayTick, type CombatReplay, type CombatViewState, type DisplayCombatEvent } from '../../presentation/combat-display';
import { MatchSession } from '../match-session';
import type { ConsumableTarget, GameClient, ItemSummonView, ReplayUnitId, WireCommand } from './protocol';
import type { HexCell } from '../../simulation/board';
import type { DisplayMatch } from './seat-view-adapter';

/** Why the last intent did not change the local state although it was not refused by the rules. */
export type IntentNotice = { readonly kind: 'pending'; readonly commandId: number } | { readonly kind: 'offline'; readonly text: string };
/** The "开战" transition: the initial view is held this long before tick 0 plays (inside the room's battle tail). */
export const REPLAY_OPENING_MS = 400;
/** Four committed ticks absorb ordinary packet/frame jitter; terminal markers release the remaining tail. */
export const STREAM_BUFFER_TICKS = 4;
export const STREAM_BUFFER_MS = STREAM_BUFFER_TICKS * COMBAT_TICK_MS;
function hasBufferedFrame(replay: CombatReplay, next: number): boolean {
  return next < replay.ticks.length - (replay.stream?.ended === false ? STREAM_BUFFER_TICKS : 0);
}
/** Commands the room passes to the rules while a battle runs (contract §15.2 `OPS`). */
const BATTLE_COMMANDS: ReadonlySet<WireCommand['type']> = new Set(['buy', 'sell', 'reroll', 'buyXp', 'shopLock', 'deploy', 'combine', 'equip', 'useConsumable',
  // v15: an orb clicked during my battle is queued by the rules and settled after it (user 2026-10-20 02:26).
  'claimOrb']);
/** G5: my finished battle of a round, kept after the settlement took it off the board (post-battle ranking). */
export interface FinishedBattle { readonly round: number; readonly roundId: string; readonly replay: CombatReplay; readonly unitIds: readonly ReplayUnitId[] }
/** Playback behind wall time by more than this (dropped or stalled frames) catches up at once; 1x otherwise. */
const CATCH_UP_MS = 250;

export class RemoteSession extends MatchSession {
  private replay: CombatReplay | null = null;
  private nextTick = 0;
  private view: CombatViewState | null = null;
  private played: DisplayCombatEvent[] = [];
  private openingPending = false;
  /** C15: battle id → original id of my units in the replay on the board, as the server named them. */
  private replayUnitIds: ReadonlyMap<string, string> = new Map();
  /** G5: my battles of this match, one per round (a resent replay of a round replaces it), oldest first. */
  private finished: FinishedBattle[] = [];
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
  /** While I watch another seat's battle (TFT: visiting its board), that battle is the one on the board; mine plays on underneath. */
  override get combatView(): CombatViewState | null { return this.watched?.view ?? this.view; }
  override get combatRuntime(): null { return null; }
  override get displayLog(): readonly DisplayCombatEvent[] { return this.played; }
  /**
   * True while my battle of this round is on the board and `state` is my live seat of that same round, still before
   * its settlement (T10: a PvP seat stays in preparation under the server's roster lock, a PvE seat in combat). Such a
   * state only refreshes what the battle is shown on: gold, shop, level and bench move, the battle keeps playing.
   * A watched battle (another seat's, on my board) is held the same way, with or without one of mine.
   */
  holdsBattle(state: MatchState): boolean {
    const base = this.playbackBase;
    return base !== null && (this.replay !== null || this.watched !== null) && state.round === base.round && (state.phase === 'preparation' || state.phase === 'combat');
  }
  /**
   * The unit whose equipment a shown unit carries (C15): a battle id of mine in the replay on the board maps to my
   * original unit id; any other id (preparation, PvE replay, an opponent's unit) is returned as it is and simply holds nothing.
   */
  equipmentOwnerId(id: string): string { return this.watched ? `watch:${id}` : this.replayUnitIds.get(id) ?? id; }
  /** G5: the latest battle a replay was received for, until a newer replay or a reset; `round`/`roundId` say which round it was fought in. */
  get lastBattle(): FinishedBattle | null { return this.finished.at(-1) ?? null; }
  /** G5: every battle of this match a replay was received for, one per round, oldest first. */
  get battleHistory(): readonly FinishedBattle[] { return this.finished; }
  /** The battle on the board while it plays back: its replay, how many tick records are shown and the view on screen. */
  get liveBattle(): { readonly replay: CombatReplay; readonly played: number; readonly view: CombatViewState } | null {
    return this.replay && this.view && this.playingBack ? { replay: this.replay, played: this.nextTick, view: this.view } : null;
  }
  /** Forgets the match's battles (back to the lobby). */
  forgetBattles(): void { this.finished = []; this.watched = null; }
  /** Another seat's battle shown in place of mine (its own point of view): unit ids stay its battle's, nothing of mine maps onto them. */
  private watched: { readonly seatId: string; readonly replay: CombatReplay; nextTick: number; view: CombatViewState; accumulator: number } | null = null;
  get watchedSeat(): string | null { return this.watched?.seatId ?? null; }
  /**
   * The battle of the seat I visit, or its revision: it joins at the tick my own battle is at (every battle of a round starts
   * together; without mine of my own, at its start), a revision keeps the records already shown and goes on from there.
   * Returns true only for an append/end of the same stream, which needs no board refresh.
   */
  watchReplay(seatId: string, replay: CombatReplay): boolean {
    if (!replay.ticks.length) return false;
    const current = this.watched?.seatId === seatId && this.watched.replay.initial.combatId === replay.initial.combatId ? this.watched : null;
    if (current && current.replay.initial === replay.initial && current.replay.stream && replay.stream
      && current.replay.stream.revision === replay.stream.revision && current.replay.stream.fromTick === replay.stream.fromTick
      && current.replay.ticks.every((frame, i) => frame === replay.ticks[i])) {
      this.watched = { ...current, replay }; return true;
    }
    // Cursors can start on different keyframes. Align by the displayed tick, never by a prefix array index.
    const shownTick = current ? (current.nextTick ? current.replay.ticks[current.nextTick - 1]!.tick : current.replay.initial.tick - 1)
      : this.replay && this.nextTick ? this.replay.ticks[this.nextTick - 1]!.tick : replay.initial.tick - 1;
    const firstUnshown = replay.ticks.findIndex(frame => frame.tick > shownTick);
    const at = firstUnshown < 0 ? replay.ticks.length : firstUnshown;
    let view: CombatViewState = replay.initial;
    for (let index = 0; index < at; index++) view = applyCombatReplayTick(view, replay.ticks[index]!);
    this.watched = { seatId, replay, nextTick: at, view: at === replay.ticks.length && replay.stream?.ended !== false ? replay.terminal : view,
      accumulator: current?.accumulator ?? (this.replay ? this.accumulator : replay.stream ? COMBAT_TICK_MS - STREAM_BUFFER_MS : 0) };
    // The board shows a battle even without one of mine (eliminated, or my battle already settled): the combat overlay.
    // A fresh overlay also tells the scene its board changed, so it rebuilds its tokens from the watched battle.
    const before = this.matchState; this.playbackBase = this.playbackBase ?? before; this.matchState = this.overlay();
    this.notify(before, [], 'command');
    return false;
  }
  /** Back to my own board (and my battle, where it has got to). */
  stopWatching(): void {
    if (!this.watched) return;
    this.watched = null;
    // My own battle keeps its overlay; without one, my last authoritative state is back. Either way a new state object,
    // so the scene rebuilds its tokens from my board instead of the watched battle's units.
    const before = this.matchState;
    if (this.replay) this.matchState = this.overlay(); else { this.matchState = this.playbackBase ?? before; this.playbackBase = null; }
    if (this.matchState === before) this.matchState = { ...before };
    this.notify(before, [], 'command');
  }
  /** My battle of this round is on the board (playing or held on its terminal view until the settlement arrives). */
  get inBattle(): boolean { return this.replay !== null; }
  /** Server pushed my authoritative state; `events` are those of my commands it confirms and of its own deadline/settlement transactions. */
  receiveState(state: MatchState, events: readonly MatchEvent[] = []): void {
    if (this.holdsBattle(state)) {
      this.playbackBase = state;
      const before = this.matchState; this.matchState = this.overlay(); this.notify(before, this.record(events), 'command');
      return;
    }
    if (this.playingBack) { this.superseded++; this.skipPlayback(); } // a newer state supersedes the battle still being played
    this.replay = null; this.view = null; this.played = []; this.playbackBase = null; this.openingPending = false; this.replayUnitIds = new Map(); this.watched = null;
    if (state === this.matchState) return;
    const before = this.matchState;
    if (state.round !== before.round) this.combatLedger = [];
    this.matchState = state; this.accumulator = 0;
    this.notify(before, this.record(events), 'command');
  }
  /** Server finished my battle of this round: show `initial`, then play one tick record per 50 ms. */
  receiveReplay(replay: CombatReplay, unitIds: readonly ReplayUnitId[] = []): void {
    if (!replay.ticks.length) return;
    this.replayUnitIds = new Map(unitIds.map(entry => [entry.combatId, entry.originalId]));
    this.replay = replay; this.nextTick = 0; this.view = replay.initial; this.played = []; this.openingPending = true;
    // Tick 0 plays when the opening transition ends; every later record 50 ms after the previous one.
    this.accumulator = COMBAT_TICK_MS - (replay.stream ? STREAM_BUFFER_MS : REPLAY_OPENING_MS);
    this.replayStartedAt = this.clock(); this.replayElapsed = 0;
    const before = this.matchState; this.playbackBase = this.playbackBase ?? before; this.matchState = this.overlay();
    const battle = { round: this.playbackBase.round, roundId: this.playbackBase.roundDefinitionId, replay, unitIds: [...unitIds] };
    this.finished = [...this.finished.filter(entry => entry.round !== battle.round), battle];
    this.notify(before, [], 'command');
  }
  /**
   * D11 live bank: the battle on the board was revised from some tick on. The records already shown stay (the server
   * only revises ticks the playback has not reached, unless it lagged); the view is rebuilt on the revised records up
   * to the same point and playback continues from there.
   * Returns true only for an append/end that preserves the displayed prefix.
   */
  reviseReplay(replay: CombatReplay): boolean {
    const current = this.replay;
    if (!current || !replay.ticks.length || replay.initial.combatId !== current.initial.combatId) return false;
    if (current.initial === replay.initial && current.stream && replay.stream
      && current.stream.revision === replay.stream.revision && current.stream.fromTick === replay.stream.fromTick
      && current.ticks.every((frame, i) => frame === replay.ticks[i])) {
      this.replay = replay;
      this.finished = this.finished.map(entry => entry.replay === current ? { ...entry, replay } : entry);
      return true; // append/end preserves the displayed prefix and never replays effects
    }
    // A keyframe resume may later be replaced by the completed full recording: retain the actual tick, not a buffer index.
    const shownTick = this.nextTick ? current.ticks[this.nextTick - 1]!.tick : current.initial.tick - 1;
    const firstUnshown = replay.ticks.findIndex(frame => frame.tick > shownTick);
    const shown = firstUnshown < 0 ? replay.ticks.length : firstUnshown;
    let view: CombatViewState = replay.initial;
    for (let index = 0; index < shown; index++) view = applyCombatReplayTick(view, replay.ticks[index]!);
    this.replay = replay; this.nextTick = shown;
    if (this.view !== null) this.view = shown === replay.ticks.length ? replay.terminal : view;
    this.finished = this.finished.map(entry => entry.replay === current ? { ...entry, replay } : entry);
    const before = this.matchState; this.notify(before, [], 'command');
    return false;
  }
  /** Display-only: my last authoritative state in the combat phase; the combat itself is `combatView`. */
  private overlay(): MatchState { return { ...(this.playbackBase ?? this.matchState), phase: 'combat', combat: null } as unknown as MatchState; }
  /** Debug/acceptance read: playback progress and how many battles a newer state cut short. */
  playbackDebug() {
    return { playingBack: this.playingBack, played: this.played.length, tick: this.view?.tick ?? null, terminalTick: this.replay?.terminal.tick ?? null, superseded: this.superseded };
  }
  private superseded = 0;
  get playingBack(): boolean { return this.replay !== null && (this.nextTick < this.replay.ticks.length || this.replay.stream?.ended === false); }
  /** Drop remaining ticks and show the battle's end (tab hidden, superseded by a newer state). */
  skipPlayback(): void {
    const replay = this.replay;
    if (!replay || !this.playingBack) return;
    for (const frame of replay.ticks.slice(this.nextTick)) this.played.push(...frame.events);
    this.nextTick = replay.ticks.length; this.view = replay.stream?.ended === false
      ? replay.ticks.reduce((view, frame) => applyCombatReplayTick(view, frame), replay.initial) : replay.terminal; this.accumulator = 0; this.openingPending = false;
  }
  /** Offline stepping never runs here: the server owns the battle. */
  override advance(_delta: number): readonly LedgerCombatEvent[] { return []; }
  /** My battle always advances (it is the one the server settles); the events shown are those of the battle on the board. */
  override advanceDisplay(delta: number): readonly DisplayCombatEvent[] {
    const own = this.advanceOwn(delta), watched = this.advanceWatched(delta);
    return this.watched ? watched : own;
  }
  private advanceWatched(delta: number): readonly DisplayCombatEvent[] {
    const watched = this.watched;
    if (this.paused || !watched || !Number.isFinite(delta) || delta < 0) return [];
    watched.accumulator += delta;
    const events: DisplayCombatEvent[] = [];
    // Watched playback has its own jitter buffer and time credit, including after my battle ends.
    while (hasBufferedFrame(watched.replay, watched.nextTick) && watched.accumulator >= COMBAT_TICK_MS) {
      watched.accumulator -= COMBAT_TICK_MS;
      const frame = watched.replay.ticks[watched.nextTick++]!;
      watched.view = applyCombatReplayTick(watched.view, frame); events.push(...frame.events);
    }
    return events;
  }
  private advanceOwn(delta: number): readonly DisplayCombatEvent[] {
    const replay = this.replay;
    if (this.paused || !replay || !this.playingBack || !Number.isFinite(delta) || delta < 0) return [];
    this.accumulator += delta; this.replayElapsed += delta;
    // The server settles on wall time (battle length + tail): frames the page dropped must not slow the battle down.
    const behind = this.clock() - this.replayStartedAt - this.replayElapsed;
    if (behind > CATCH_UP_MS) { this.accumulator += behind; this.replayElapsed += behind; }
    const events: DisplayCombatEvent[] = [];
    while (this.accumulator >= COMBAT_TICK_MS && hasBufferedFrame(replay, this.nextTick)) {
      this.accumulator -= COMBAT_TICK_MS;
      const frame = replay.ticks[this.nextTick++]!;
      this.view = applyCombatReplayTick(this.view ?? replay.initial, frame);
      this.played.push(...frame.events); events.push(...frame.events);
    }
    return events;
  }
  private intent(command: WireCommand): MatchCommandResult {
    this.notice = null;
    if (this.offline !== null) { this.notice = { kind: 'offline', text: this.offline }; return this.blocked(); }
    if (this.spectating) { this.notice = { kind: 'offline', text: '已淘汰 · 观战中，不能操作' }; return this.blocked(); }
    // Contract §15.2: a running battle accepts operations only (choices wait for their window); the server and the rules
    // decide everything else, including the board-target refusals of §15.1.
    if (this.paused || (this.inBattle && !BATTLE_COMMANDS.has(command.type))) return this.blocked();
    const result = this.client.send(command);
    // Pending: nothing changes until the receipt and the state push after it (never spend gold ahead of the server).
    if (result.ok === 'pending') { this.notice = { kind: 'pending', commandId: result.commandId }; return this.blocked(); }
    if (!result.ok) return result;
    const before = this.matchState;
    if (this.holdsBattle(result.state)) {
      // An operation during my battle: the board keeps the battle, the panels show the new live state.
      this.playbackBase = result.state; this.matchState = this.overlay();
      const events = this.record(result.events);
      this.notify(before, events, 'command');
      return { ...result, state: this.matchState };
    }
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
  override equipmentTargetId(id: string): string | undefined {
    return equipmentTargetId(this.state, this.combatView, id, this.replayUnitIds, this.spectating || this.watched !== null);
  }
  override equip(itemId: string, unitId: string, slot: number) {
    this.notice = null;
    const target = this.equipmentTargetId(unitId);
    if (target === undefined) return { ok: false as const, state: this.state, reason: 'battle-unit-unavailable' as const };
    return this.intent({ type: 'equip', itemId, unitId: target, slot });
  }
  /** C18-B (§18.3): the server and the rules decide the result; nothing is applied locally before the receipt. */
  override useConsumable(consumableId: string, target: ConsumableTarget) { return this.intent({ type: 'useConsumable', consumableId, target }); }
  override choose(choiceId: string, generation: number, definitionId: string) { return this.intent({ type: 'choose', choiceId, generation, definitionId }); }
  override anomalyTarget(choiceId: string, generation: number, unitId: string) { return this.intent({ type: 'anomalyTarget', choiceId, generation, unitId }); }
  override anomalyReroll(choiceId: string, generation: number) { return this.intent({ type: 'anomalyReroll', choiceId, generation }); }
  override augmentReroll(choiceId: string, generation: number, optionIndex: number) { return this.intent({ type: 'rerollAugment', choiceId, generation, optionIndex }); }
  /** v15: claim one of my unclaimed orbs; `round` is the round shown now (the orb may come from an earlier one). */
  override claimOrb(orbId: string) { return this.intent({ type: 'claimOrb', round: this.matchState.round, orbId }); }
  /** G2-4b (§26): the room hands it to the rules' moveItemSummon; refused outside preparation like any board move. */
  override moveItemSummon(itemInstanceId: string, cell: HexCell) { return this.intent({ type: 'moveItemSummon', itemInstanceId, cell: { col: cell.col, row: cell.row } }); }
  /** G2-4b: the summons of my last state push as the server placed them; never derived from items or rounds here. */
  override get itemSummons(): readonly ItemSummonView[] {
    return this.matchState.phase === 'preparation' && !this.inBattle ? (this.matchState as DisplayMatch).itemSummons ?? [] : [];
  }
  /** G1-P7: a carousel pick; the room and the rules' carousel decide whether and what this seat takes. */
  carouselPick(carouselId: string, revision: number, slot: number) { return this.intent({ type: 'carousel-pick', carouselId, revision, slot }); }
  override newMatch(): void { /* the server owns match lifecycle */ }
}
