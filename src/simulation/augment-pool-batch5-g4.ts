import { createB5VoidBody } from './augment-pool-batch5-g4-unit';
import type { Team, HexCell } from './board';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { B5_G4_VOID_POLICY } from './content/augment-pool-batch5-g4';
import type { CombatOrigin, CombatState, CombatUnit } from './combat-types';
import type { AbilityContext } from './combat-s13-abilities';
import type { S13Unit } from './combat-s13-state';
import { nearestItemCell } from './g2-4b-item-kernel';
import { occupiesCell } from './anomalies/availability';
import { spawnCombatUnit } from './seat-mechanics/combat-events';
import { initializeBornUnits } from './combat-g2-4b-trench';

/** One pool per team, surviving caster death/banishment. Rebuilt by combat replay on restore. */
export interface B5VoidcallerCounter { team: Team; remainder: number; summoned: number }
export interface B5VoidlingBirth { readonly unit: CombatUnit; readonly source: CombatOrigin }
export function b5VoidlingHealth(round: number): number {
  return B5_G4_VOID_POLICY.smallHealth[Math.max(0, Math.min(4, getMultiplayerRoundByOrdinal(round).stage - 2))];
}
function freeCell(ctx: AbilityContext, preferred: HexCell, pending: readonly CombatUnit[]): HexCell | undefined {
  const occupied = [...ctx.units, ...pending].filter(u => occupiesCell(u, ctx.tick));
  const cells = Array.from({ length: ctx.board.rows }, (_, row) => Array.from({ length: ctx.board.columns }, (_, col) => ({ col, row }))).flat();
  return nearestItemCell(preferred, cells.filter(c => !occupied.some(u => u.cell.col === c.col && u.cell.row === c.row))) ?? undefined;
}
function createVoidling(caster: S13Unit, source: CombatOrigin, health: number, ordinal: number, cell: HexCell): CombatUnit {
  const id = JSON.stringify(['b5-voidling', caster.team, source.instanceId, ordinal]);
  return createB5VoidBody(id, 'b5-voidling', caster.team, cell, health, B5_G4_VOID_POLICY.smallAttack,
    caster.mechanics?.find(m => m.mechanic === 'voidSwarm'));
}
/** Called only with the successful cast's actual cost, after all mana-cost modifiers. */
export function castB5Voidcaller(ctx: AbilityContext, caster: S13Unit, spent: number, counters: B5VoidcallerCounter[], pending: B5VoidlingBirth[]): void {
  const m = caster.mechanics?.find(m => m.mechanic === 'voidcaller');
  if (!m || spent === 0) return;
  let counter = counters.find(c => c.team === caster.team);
  if (!counter) { counter = { team: caster.team, remainder: 0, summoned: 0 }; counters.push(counter); }
  counter.remainder += spent;
  while (counter.remainder >= m.values.mana) {
    counter.remainder -= m.values.mana;
    if (counter.summoned >= m.values.maxVoidlings) continue;
    const cell = freeCell(ctx, caster.cell, pending.map(p => p.unit));
    if (!cell) continue;
    pending.push({ unit: createVoidling(caster, m.source, m.values.health, ++counter.summoned, cell), source: m.source });
  }
}
/** Publish births after existing actors planned their actions: newborns first act next tick. */
export function spawnB5Voidlings(ctx: AbilityContext, state: CombatState, pending: readonly B5VoidlingBirth[]): void {
  for (const { unit, source } of pending) {
    const spawned = spawnCombatUnit({ ...state, units: ctx.units }, unit, source, ctx.tick);
    ctx.units.push(unit as S13Unit); ctx.events.push(...spawned.events);
  }
  if (pending.length) initializeBornUnits(ctx, pending.map(p => p.unit));
}
