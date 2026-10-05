import { COMBAT_TICK_MS, type CombatEvent } from '../simulation/combat';
import {
  buyUnit, buyXp, createMatch, deployMatchUnit, matchStartFailure, nextRound, rerollShop,
  sellUnit, startMatchCombat, stepMatch, type MatchCommandResult, type MatchState,
  combineItems, equipItem, selectChoice, selectAnomalyTarget, rerollAnomaly, setShopLock,
} from '../simulation/match';
import type { MatchEvent } from '../simulation/match-types';
import type { UnitLocation } from '../simulation/units';

/** Frame time belongs to rendering. Every game rule and transition belongs to Match. */
export class MatchSession {
  private matchState: MatchState;
  private accumulator = 0;
  private combatLedger: CombatEvent[] = [];

  constructor(initial = createMatch()) { this.matchState = structuredClone(initial); }
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
    if (!result.ok) return result;
    if (result.state.phase !== this.matchState.phase) this.accumulator = 0;
    if (result.state.round !== this.matchState.round || (!this.matchState.combat && result.state.combat)) this.combatLedger = [];
    this.matchState = result.state;
    this.record(result.events);
    return result;
  }
  deploy(id: string, target: UnitLocation) { return this.commit(deployMatchUnit(this.matchState, id, target)); }
  buy(slot: number, generation: number) { return this.commit(buyUnit(this.matchState, slot, generation)); }
  sell(id: string) { return this.commit(sellUnit(this.matchState, id)); }
  shopLock(locked: boolean, generation: number) { return this.commit(setShopLock(this.matchState, locked, generation)); }
  reroll() { return this.commit(rerollShop(this.matchState)); }
  buyXp() { return this.commit(buyXp(this.matchState)); }
  start() { return this.commit(startMatchCombat(this.matchState)); }
  continue(round: number) { return this.commit(nextRound(this.matchState, round)); }
  combine(a: string, b: string) { return this.commit(combineItems(this.matchState, a, b)); }
  equip(itemId: string, unitId: string, slot: number) { return this.commit(equipItem(this.matchState, itemId, unitId, slot)); }
  choose(choiceId: string, generation: number, definitionId: string) { return this.commit(selectChoice(this.matchState, choiceId, generation, definitionId)); }
  anomalyTarget(choiceId: string, generation: number, unitId: string) { return this.commit(selectAnomalyTarget(this.matchState, choiceId, generation, unitId)); }
  anomalyReroll(choiceId: string, generation: number) { return this.commit(rerollAnomaly(this.matchState, choiceId, generation)); }

  advance(delta: number): readonly CombatEvent[] {
    if (this.phase !== 'combat' || !Number.isFinite(delta) || delta < 0) return [];
    this.accumulator += delta;
    const events: CombatEvent[] = [];
    while (this.accumulator >= COMBAT_TICK_MS && this.matchState.phase === 'combat') {
      this.accumulator -= COMBAT_TICK_MS;
      const next = stepMatch(this.matchState);
      this.matchState = next.state;
      events.push(...this.record(next.events));
    }
    if (this.matchState.phase !== 'combat') this.accumulator = 0;
    return events;
  }

  newMatch(): void {
    this.matchState = createMatch(this.matchState.seed);
    this.accumulator = 0;
    this.combatLedger = [];
  }
}
