import { COMBAT_TICK_MS } from '../simulation/combat';
import type { CombatState, LedgerCombatEvent } from '../simulation/combat-types';
import { toCombatViewState, toDisplayEvents, type CombatViewState, type DisplayCombatEvent, type SceneCombatEvent } from '../presentation/combat-display';
import {
  buyUnit, buyXp, createMatch, deployMatchUnit, matchStartFailure, nextRound, rerollShop,
  sellUnit, startMatchCombat, stepMatch, type MatchCommandResult, type MatchState,
  combineItems, equipItem, useConsumable, selectChoice, selectAnomalyTarget, rerollAnomaly, setShopLock,
  moveItemSummon, readItemSummons,
} from '../simulation/match';
import type { MatchEvent } from '../simulation/match-types';
import type { UnitLocation } from '../simulation/units';
import type { ConsumableTarget } from '../simulation/consumable-types';
import type { SessionChange } from '../m6/contracts';
import type { HexCell } from '../simulation/board';
import type { ItemSummonView } from '../server/protocol';

/** Frame time belongs to rendering. Every game rule and transition belongs to Match. */
export class MatchSession {
  private static instances = 0;
  private disposed = false;
  static get liveCount(): number { return MatchSession.instances; }
  get observerCount(): number { return this.listeners.size; }
  protected matchState: MatchState;
  protected accumulator = 0;
  protected combatLedger: LedgerCombatEvent[] = [];
  private pauseReasons = new Set<string>();
  private listeners = new Set<(change: SessionChange) => void>();
  get paused(): boolean { return this.pauseReasons.size > 0; }
  pause(reason: string): void { this.pauseReasons.add(reason); this.accumulator = 0; }
  resume(reason: string): void { this.pauseReasons.delete(reason); this.accumulator = 0; }
  subscribe(listener: (change: SessionChange) => void): () => void {
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  }
  protected notify(before: MatchState, events: readonly LedgerCombatEvent[], reason: SessionChange['reason']) {
    if (before === this.matchState) return;
    for (const listener of this.listeners) listener({ before, after: this.matchState, events, reason });
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; MatchSession.instances--; this.listeners.clear(); this.pauseReasons.clear(); this.accumulator = 0; }
  protected blocked(): MatchCommandResult { return { ok: false, state: this.matchState, reason: 'wrong-phase' }; }

  constructor(initial = createMatch(), events: readonly LedgerCombatEvent[] = []) { MatchSession.instances++; this.matchState = structuredClone(initial); this.combatLedger = structuredClone([...events]); }
  get state(): MatchState { return this.matchState; }
  get phase() { return this.matchState.phase; }
  get preparation() { return this.matchState.preparation; }
  get combat() { return this.matchState.combat; }
  private viewCache: { readonly combat: CombatState; readonly view: CombatViewState } | null = null;
  /**
   * C6: the battle every renderer draws. Offline it is the engine state through the same whitelist the server
   * sends (`toCombatViewState`, once per state); online (RemoteSession) it is the replay's current view.
   */
  get combatView(): CombatViewState | null {
    const combat = this.matchState.combat;
    if (!combat) return null;
    if (this.viewCache?.combat !== combat) this.viewCache = { combat, view: toCombatViewState(combat) };
    return this.viewCache.view;
  }
  /** Offline only: the full engine state, for detail panels the view cannot carry (statuses, shield layers, sources). */
  get combatRuntime(): CombatState | null { return this.matchState.combat; }
  /** Display events of the current battle so far, as the board and the online stats read them. */
  get displayLog(): readonly DisplayCombatEvent[] { return toDisplayEvents(this.combatLedger); }
  /** One frame of combat for the scene: offline the rules' ledger events of the ticks run, online replay events. */
  advanceDisplay(delta: number): readonly SceneCombatEvent[] { return this.advance(delta); }
  get startFailure() { return matchStartFailure(this.matchState); }
  /** Observer only: a copy of every event, including combatStart/tick-zero hooks. */
  get combatEvents(): readonly LedgerCombatEvent[] { return structuredClone(this.combatLedger); }

  protected record(events: readonly MatchEvent[]): LedgerCombatEvent[] {
    const combat = events.filter((event): event is LedgerCombatEvent => 'tick' in event);
    this.combatLedger.push(...structuredClone(combat));
    return combat;
  }

  protected commit(result: MatchCommandResult): MatchCommandResult {
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
  /** C18-B (§18.1): one tool instance on one target; the rules decide everything and commit atomically. */
  useConsumable(consumableId: string, target: ConsumableTarget) { return this.paused ? this.blocked() : this.commit(useConsumable(this.matchState, consumableId, target)); }
  choose(choiceId: string, generation: number, definitionId: string) { return this.paused ? this.blocked() : this.commit(selectChoice(this.matchState, choiceId, generation, definitionId)); }
  anomalyTarget(choiceId: string, generation: number, unitId: string) { return this.paused ? this.blocked() : this.commit(selectAnomalyTarget(this.matchState, choiceId, generation, unitId)); }
  anomalyReroll(choiceId: string, generation: number) { return this.paused ? this.blocked() : this.commit(rerollAnomaly(this.matchState, choiceId, generation)); }
  /** G2-4b: move the preparation summon of one item instance (兹若特传送门); the rules check phase, ownership and the cell. */
  moveItemSummon(itemInstanceId: string, cell: HexCell) { return this.paused ? this.blocked() : this.commit(moveItemSummon(this.matchState, itemInstanceId, cell)); }
  private summonCache: { readonly state: MatchState; readonly summons: readonly ItemSummonView[] } | null = null;
  /**
   * G2-4b: my movable preparation summons where the rules place them now (empty outside preparation). Offline the rules'
   * `readItemSummons` of my state, in the same fields the server sends online (RemoteSession reads its push instead).
   */
  get itemSummons(): readonly ItemSummonView[] {
    const state = this.matchState;
    if (this.summonCache?.state !== state) this.summonCache = { state, summons: state.phase !== 'preparation' ? [] : readItemSummons(state)
      .filter(origin => origin.unit.team === 'player')
      .map(origin => ({ kind: origin.kind, ownerId: origin.ownerId, itemInstanceId: origin.itemInstanceId, unit: structuredClone(origin.unit) })) };
    return this.summonCache.summons;
  }

  advance(delta: number): readonly LedgerCombatEvent[] {
    if (this.disposed || this.paused || this.phase !== 'combat' || !Number.isFinite(delta) || delta < 0) return [];
    this.accumulator += delta;
    const events: LedgerCombatEvent[] = [];
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
