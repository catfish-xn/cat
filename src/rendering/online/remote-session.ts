/**
 * MatchSession replacement for online play: every command is an intent sent to the
 * server; the state shown comes back from it. Combat is not stepped here, the server's
 * frames are played back at tick pace. BoardScene and StrategyPanel keep working unchanged.
 */
import { COMBAT_TICK_MS } from '../../simulation/combat';
import type { LedgerCombatEvent } from '../../simulation/combat-types';
import type { MatchCommandResult, MatchEvent, MatchState } from '../../simulation/match-types';
import type { UnitLocation } from '../../simulation/units';
import { createMatch } from '../../simulation/match';
import { MatchSession } from '../match-session';
import type { ClientCommand, CombatFrame, GameClient } from './protocol';

/** Why the last intent did not change the local state although it was not refused by the rules. */
export type IntentNotice = { readonly kind: 'pending'; readonly commandId: number } | { readonly kind: 'offline'; readonly text: string };

export class RemoteSession extends MatchSession {
  private frames: CombatFrame[] = [];
  private nextFrame = 0;
  private notice: IntentNotice | null = null;
  /** Set while the connection is down or superseded: commands are not sent and the reason is shown instead. */
  offline: string | null = null;
  constructor(private readonly client: GameClient, initial: MatchState = createMatch()) { super(initial); }
  /** Read once by the scene right after a command returned `ok: false`: pending/offline instead of a rule failure. */
  takeNotice(): IntentNotice | null { const notice = this.notice; this.notice = null; return notice; }
  /** Server pushed my authoritative state (outside combat playback); `events` are those of my commands it confirms. */
  receiveState(state: MatchState, events: readonly MatchEvent[] = []): void {
    if (this.playingBack) this.skipPlayback(); // a newer state supersedes the battle still being played
    if (state === this.matchState) return;
    const before = this.matchState;
    if (state.round !== before.round || (!before.combat && state.combat)) this.combatLedger = [];
    this.matchState = state; this.accumulator = 0;
    this.notify(before, this.record(events), 'command');
  }
  /** Server finished a battle; play its frames back one tick at a time. */
  receiveCombat(frames: readonly CombatFrame[]): void {
    if (!frames.length) return;
    this.frames = [...frames]; this.nextFrame = 1; this.accumulator = 0; this.combatLedger = [];
    const before = this.matchState; this.matchState = frames[0]!.state;
    const events = this.record(frames[0]!.events);
    this.notify(before, events, 'command');
  }
  get playingBack(): boolean { return this.nextFrame < this.frames.length; }
  /** Drop remaining frames and show the battle's end (used after the tab was hidden). */
  skipPlayback(): void {
    if (!this.playingBack) return;
    const before = this.matchState, rest = this.frames.slice(this.nextFrame);
    this.matchState = rest.at(-1)!.state; this.nextFrame = this.frames.length;
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
      this.matchState = frame.state;
      const deltaEvents = this.record(frame.events);
      events.push(...deltaEvents);
      this.notify(before, deltaEvents, 'tick');
    }
    if (!this.playingBack) { this.accumulator = 0; this.frames = []; this.nextFrame = 0; }
    return events;
  }
  private intent(command: ClientCommand): MatchCommandResult {
    this.notice = null;
    if (this.offline !== null) { this.notice = { kind: 'offline', text: this.offline }; return this.blocked(); }
    if (this.paused || this.playingBack) return this.blocked();
    const result = this.client.send(command);
    // Pending: nothing changes until the receipt and the state push after it (never spend gold ahead of the server).
    if (result.ok === 'pending') { this.notice = { kind: 'pending', commandId: result.commandId }; return this.blocked(); }
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
