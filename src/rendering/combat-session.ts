import { COMBAT_TICK_MS, createCombat, stepCombat, type CombatEvent, type CombatState } from '../simulation/combat';
import { createGame, deployUnit, type DeploymentFailure, type GameState } from '../simulation/game';
import type { UnitLocation } from '../simulation/units';

type CombatApi = { createCombat: typeof createCombat; stepCombat: typeof stepCombat };

/** UI lifecycle and clock only: all combat decisions belong to the simulation API. */
export class CombatSession {
  private preparationState: GameState;
  private snapshot: GameState | null = null;
  private combatState: CombatState | null = null;
  private accumulator = 0;

  constructor(preparation = createGame(), private readonly api: CombatApi = { createCombat, stepCombat }) {
    this.preparationState = structuredClone(preparation);
  }
  get preparation(): GameState { return this.preparationState; }
  get combat(): CombatState | null { return this.combatState; }
  get phase(): 'preparation' | 'combat' | 'result' {
    return this.combatState === null ? 'preparation' : this.combatState.status === 'running' ? 'combat' : 'result';
  }
  deploy(unitId: string, target: UnitLocation): DeploymentFailure | 'combat-active' | undefined {
    if (this.phase !== 'preparation') return 'combat-active';
    const result = deployUnit(this.preparationState, unitId, target);
    if (!result.ok) return result.reason;
    this.preparationState = result.state;
    return undefined;
  }
  start(): boolean {
    if (this.phase !== 'preparation') return false;
    this.snapshot = structuredClone(this.preparationState);
    this.combatState = this.api.createCombat(this.snapshot);
    this.accumulator = 0;
    return true;
  }
  advance(delta: number): readonly CombatEvent[] {
    if (this.phase !== 'combat' || !Number.isFinite(delta) || delta < 0) return [];
    this.accumulator += delta;
    const events: CombatEvent[] = [];
    while (this.accumulator >= COMBAT_TICK_MS && this.combatState?.status === 'running') {
      this.accumulator -= COMBAT_TICK_MS;
      const next = this.api.stepCombat(this.combatState);
      this.combatState = next.state;
      events.push(...next.events);
    }
    if (this.combatState?.status === 'finished') this.accumulator = 0;
    return events;
  }
  reset(): boolean {
    if (!this.snapshot) return false;
    this.preparationState = this.snapshot;
    this.snapshot = null;
    this.combatState = null;
    this.accumulator = 0;
    return true;
  }
}
