/**
 * MatchSession replacement for online play: every command is an intent sent to the
 * server; the state shown comes back from it. Combat is not stepped here, the server's
 * frames are played back at tick pace. BoardScene and StrategyPanel keep working unchanged.
 *
 * A combat frame is a CombatState (B3): during playback `state`/`combat` show my last
 * authoritative MatchState with that frame's combat laid over it, so BoardScene's
 * `syncCombat` and the stats panel read `session.combat` as before. Gold, HP and the
 * round record are not touched by playback; they arrive as the server's next state push.
 */
import { COMBAT_TICK_MS } from '../../simulation/combat';
import type { CombatState, LedgerCombatEvent } from '../../simulation/combat-types';
import type { MatchCommandResult, MatchState } from '../../simulation/match-types';
import type { UnitLocation } from '../../simulation/units';
import { createMatch } from '../../simulation/match';
import { MatchSession } from '../match-session';
import type { ClientCommand, CombatFrame, GameClient } from './protocol';

export class RemoteSession extends MatchSession {
  private frames: CombatFrame[] = [];
  private nextFrame = 0;
  /** My authoritative state when playback started; every frame is displayed on top of it. */
  private playbackBase: MatchState | null = null;
  constructor(private readonly client: GameClient, initial: MatchState = createMatch()) { super(initial); }
  /** Server pushed my authoritative state (outside combat playback). */
  receiveState(state: MatchState): void {
    if (this.playingBack) this.skipPlayback(); // a newer state supersedes the battle still being played
    this.playbackBase = null;
    if (state === this.matchState) return;
    const before = this.matchState;
    if (state.round !== before.round || (!before.combat && state.combat)) this.combatLedger = [];
    this.matchState = state; this.accumulator = 0;
    this.notify(before, [], 'command');
  }
  /** Server finished a battle; play its frames back one tick at a time. */
  receiveCombat(frames: readonly CombatFrame[]): void {
    if (!frames.length) return;
    this.frames = [...frames]; this.nextFrame = 1; this.accumulator = 0; this.combatLedger = [];
    const before = this.matchState; this.playbackBase = before; this.matchState = this.display(frames[0]!.state);
    const events = this.record(frames[0]!.events);
    this.notify(before, events, 'command');
  }
  /**
   * Display-only overlay: the server's combat on my last authoritative state; nothing is computed.
   * The phase stays `combat` even on the terminal frame: the settlement (income, HP, round record)
   * is not known here until the server pushes the settled state.
   */
  private display(combat: CombatState): MatchState {
    const base = this.playbackBase ?? this.matchState;
    return { ...base, phase: 'combat', combat } as MatchState;
  }
  get playingBack(): boolean { return this.nextFrame < this.frames.length; }
  /** Drop remaining frames and show the battle's end (used after the tab was hidden). */
  skipPlayback(): void {
    if (!this.playingBack) return;
    const before = this.matchState, rest = this.frames.slice(this.nextFrame);
    this.matchState = this.display(rest.at(-1)!.state); this.nextFrame = this.frames.length;
    const events = this.record(rest.flatMap(frame => frame.events));
    this.notify(before, events, 'tick');
  }
  override advance(delta: number): readonly LedgerCombatEvent[] {
    if (this.paused || !this.playingBack || !Number.isFinite(delta) || delta < 0) return [];
    this.accumulator += delta;
    const events: LedgerCombatEvent[] = [];
    while (this.accumulator >= COMBAT_TICK_MS && this.playingBack) {
      this.accumulator -= COMBAT_TICK_MS;
      const before = this.matchState, frame = this.frames[this.nextFrame++]!;
      this.matchState = this.display(frame.state);
      const deltaEvents = this.record(frame.events);
      events.push(...deltaEvents);
      this.notify(before, deltaEvents, 'tick');
    }
    if (!this.playingBack) { this.accumulator = 0; this.frames = []; this.nextFrame = 0; }
    return events;
  }
  private intent(command: ClientCommand): MatchCommandResult {
    if (this.paused || this.playingBack) return this.blocked();
    const result = this.client.send(command);
    if (!result.ok) return result;
    const before = this.matchState;
    if (result.state.round !== before.round || (!before.combat && result.state.combat)) this.combatLedger = [];
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
