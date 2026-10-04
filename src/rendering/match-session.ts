import { COMBAT_TICK_MS, type CombatEvent } from '../simulation/combat';
import {
  buyUnit, createMatch, deployMatchUnit, matchStartFailure, nextRound, rerollShop,
  sellUnit, startMatchCombat, stepMatch, type MatchCommandResult, type MatchState,
} from '../simulation/match';
import type { UnitLocation } from '../simulation/units';

/** Frame time belongs to rendering. Every game rule and transition belongs to Match. */
export class MatchSession {
  private matchState: MatchState;
  private accumulator = 0;

  constructor(initial = createMatch()) { this.matchState = structuredClone(initial); }
  get state(): MatchState { return this.matchState; }
  get phase() { return this.matchState.phase; }
  get preparation() { return this.matchState.preparation; }
  get combat() { return this.matchState.combat; }
  get startFailure() { return matchStartFailure(this.matchState); }

  private commit(result: MatchCommandResult): MatchCommandResult {
    if (result.state.phase !== this.matchState.phase) this.accumulator = 0;
    this.matchState = result.state;
    return result;
  }
  deploy(id: string, target: UnitLocation) { return this.commit(deployMatchUnit(this.matchState, id, target)); }
  buy(slot: number, generation: number) { return this.commit(buyUnit(this.matchState, slot, generation)); }
  sell(id: string) { return this.commit(sellUnit(this.matchState, id)); }
  reroll() { return this.commit(rerollShop(this.matchState)); }
  start() { return this.commit(startMatchCombat(this.matchState)); }
  continue(round: number) { return this.commit(nextRound(this.matchState, round)); }

  advance(delta: number): readonly CombatEvent[] {
    if (this.phase !== 'combat' || !Number.isFinite(delta) || delta < 0) return [];
    this.accumulator += delta;
    const events: CombatEvent[] = [];
    while (this.accumulator >= COMBAT_TICK_MS && this.matchState.phase === 'combat') {
      this.accumulator -= COMBAT_TICK_MS;
      const next = stepMatch(this.matchState);
      this.matchState = next.state;
      events.push(...next.events);
    }
    if (this.matchState.phase !== 'combat') this.accumulator = 0;
    return events;
  }

  newMatch(): void {
    this.matchState = createMatch(this.matchState.seed);
    this.accumulator = 0;
  }
}
