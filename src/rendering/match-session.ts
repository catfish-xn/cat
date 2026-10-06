import { COMBAT_TICK_MS, type CombatEvent } from '../simulation/combat';
import {
  buyUnit, buyXp, createMatch, deployMatchUnit, matchStartFailure, nextRound, rerollShop,
  sellUnit, startMatchCombat, stepMatch, type MatchCommandResult, type MatchState,
  combineItems, equipItem, selectChoice, selectAnomalyTarget, rerollAnomaly, setShopLock,
} from '../simulation/match';
import type { MatchEvent } from '../simulation/match-types';
import type { UnitLocation } from '../simulation/units';
import type { SessionChange } from '../m6/contracts';

/** Frame time belongs to rendering. Every game rule and transition belongs to Match. */
export class MatchSession {
  private static instances = 0;
  private disposed = false;
  static get liveCount(): number { return MatchSession.instances; }
  get observerCount(): number { return this.listeners.size; }
  private matchState: MatchState;
  private accumulator = 0;
  private combatLedger: CombatEvent[] = [];
  private pauseReasons = new Set<string>();
  private listeners = new Set<(change: SessionChange) => void>();
  get paused(): boolean { return this.pauseReasons.size > 0; }
  pause(reason: string): void { this.pauseReasons.add(reason); this.accumulator = 0; }
  resume(reason: string): void { this.pauseReasons.delete(reason); this.accumulator = 0; }
  subscribe(listener: (change: SessionChange) => void): () => void {
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  }
  private notify(before: MatchState, events: readonly CombatEvent[], reason: SessionChange['reason']) {
    if (before === this.matchState) return;
    for (const listener of this.listeners) listener({ before, after: this.matchState, events, reason });
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; MatchSession.instances--; this.listeners.clear(); this.pauseReasons.clear(); this.accumulator = 0; }
  private blocked(): MatchCommandResult { return { ok: false, state: this.matchState, reason: 'wrong-phase' }; }

  constructor(initial = createMatch(), events: readonly CombatEvent[] = []) { MatchSession.instances++; this.matchState = structuredClone(initial); this.combatLedger = structuredClone([...events]); }
  get state(): MatchState { return this.matchState; }
  get phase() { return this.matchState.phase; }
  get preparation() { return this.matchState.preparation; }
  get combat() { return this.matchState.combat; }
  get startFailure() { return matchStartFailure(this.matchState); }
  /** Observer only: a copy of every event, including combatStart/tick-zero hooks. */
  get combatEvents(): readonly CombatEvent[] { return structuredClone(this.combatLedger); }

  private record(events: readonly MatchEvent[]): CombatEvent[] {
    const combat = events.filter((event): event is CombatEvent => 'tick' in event);
    this.combatLedger.push(...structuredClone(combat));
    return combat;
  }

  private commit(result: MatchCommandResult): MatchCommandResult {
    if (this.paused) return this.blocked();
    if (!result.ok) return result;
    const before = this.matchState;
    if (result.state.phase !== this.matchState.phase) this.accumulator = 0;
    if (result.state.round !== this.matchState.round || (!this.matchState.combat && result.state.combat)) this.combatLedger = [];
    this.matchState = result.state;
    const events = this.record(result.events);
    this.notify(before, events, 'command');
    return result;
  }
  deploy(id: string, target: UnitLocation) { return this.paused ? this.blocked() : this.commit(deployMatchUnit(this.matchState, id, target)); }
  buy(slot: number, generation: number) { return this.paused ? this.blocked() : this.commit(buyUnit(this.matchState, slot, generation)); }
  sell(id: string) { return this.paused ? this.blocked() : this.commit(sellUnit(this.matchState, id)); }
  shopLock(locked: boolean, generation: number) { return this.paused ? this.blocked() : this.commit(setShopLock(this.matchState, locked, generation)); }
  reroll() { return this.paused ? this.blocked() : this.commit(rerollShop(this.matchState)); }
  buyXp() { return this.paused ? this.blocked() : this.commit(buyXp(this.matchState)); }
  start() { return this.paused ? this.blocked() : this.commit(startMatchCombat(this.matchState)); }
  continue(round: number) { return this.paused ? this.blocked() : this.commit(nextRound(this.matchState, round)); }
  combine(a: string, b: string) { return this.paused ? this.blocked() : this.commit(combineItems(this.matchState, a, b)); }
  equip(itemId: string, unitId: string, slot: number) { return this.paused ? this.blocked() : this.commit(equipItem(this.matchState, itemId, unitId, slot)); }
  choose(choiceId: string, generation: number, definitionId: string) { return this.paused ? this.blocked() : this.commit(selectChoice(this.matchState, choiceId, generation, definitionId)); }
  anomalyTarget(choiceId: string, generation: number, unitId: string) { return this.paused ? this.blocked() : this.commit(selectAnomalyTarget(this.matchState, choiceId, generation, unitId)); }
  anomalyReroll(choiceId: string, generation: number) { return this.paused ? this.blocked() : this.commit(rerollAnomaly(this.matchState, choiceId, generation)); }

  advance(delta: number): readonly CombatEvent[] {
    if (this.disposed || this.paused || this.phase !== 'combat' || !Number.isFinite(delta) || delta < 0) return [];
    this.accumulator += delta;
    const events: CombatEvent[] = [];
    while (this.accumulator >= COMBAT_TICK_MS && this.matchState.phase === 'combat') {
      this.accumulator -= COMBAT_TICK_MS;
      const before = this.matchState;
      const next = stepMatch(this.matchState);
      this.matchState = next.state;
      const deltaEvents = this.record(next.events);
      events.push(...deltaEvents);
      this.notify(before, deltaEvents, 'tick');
    }
    if (this.matchState.phase !== 'combat') this.accumulator = 0;
    return events;
  }

  newMatch(seed = this.matchState.seed): void {
    if (this.paused) return;
    const before = this.matchState;
    this.matchState = createMatch(seed);
    this.accumulator = 0;
    this.combatLedger = [];
    this.notify(before, [], 'new-match');
  }
}
