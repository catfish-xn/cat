import { hexDistance, type HexCell } from './board';
import type { CombatStrategyInputs } from './combat-input';
import type { MatchState } from './match-types';
import type { Effect } from './strategy-types';
import type { AbilityContext } from './combat-s13-abilities';
import type { CombatState, CombatUnit } from './combat-types';
import type { S13Unit } from './combat-s13-state';
import type { VampRate } from './m8/heal';
import { asSource } from './m8/s13-definitions';
import { B5_G4_VOID_POLICY as POLICY } from './content/augment-pool-batch5-g4';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { requireAugmentFacts } from './augment-history';
import { planAugmentGifts } from './augment-gift-plan';
import { occupiesCell, isSelectable } from './anomalies/availability';
import { nearestItemCell } from './g2-4b-item-kernel';
import { spawnCombatUnit } from './seat-mechanics/combat-events';
import { initializeBornUnits } from './combat-g2-4b-trench';
import { createB5VoidBody } from './augment-pool-batch5-g4-unit';

export const B5_PORTAL_ITEM = 'TFT5_Item_ZzRotPortalRadiant';
export function hasB5VoidSwarm(state: Pick<CombatStrategyInputs, 'augments'>): boolean {
  return state.augments.some(a => a.definitionId === 'void-swarm');
}
/** A portal is compiled only from equipped, non-confiscated items. Opening spawning waits for BOTH armies. */
export function b5PortalEffects(state: Pick<CombatStrategyInputs, 'round' | 'augments'>, id: string, effects: readonly Effect[]): readonly Effect[] {
  if (id !== B5_PORTAL_ITEM || !hasB5VoidSwarm(state)) return effects;
  const i = Math.max(0, Math.min(4, getMultiplayerRoundByOrdinal(state.round).stage - 2));
  return [...effects, { kind: 'mechanic', mechanic: 'b5VoidPortal', values: { health: POLICY.largeHealth[i], attack: POLICY.largeAttack[i] } }];
}
/** Count actual completed PvP boundaries, including the acquisition round; never infer from natural-round distance. */
export function b5VoidSwarmGiftPlan(state: MatchState) {
  const owner = state.augments.find(a => a.definitionId === 'void-swarm'); if (!owner) return [];
  const results = state.roundResults.filter(r => r.roundKind === 'pvp' && r.round >= owner.acquiredRound);
  for (const r of results) {
    const facts = requireAugmentFacts(state, 'pvp-roster', r.round);
    if (facts.length !== 1) throw new RangeError('Invalid Void Swarm PvP history');
  }
  return results.flatMap((r, i) => (i + 1) % POLICY.portalEveryPvp ? [] : planAugmentGifts(state,
    { ...owner, choiceId: JSON.stringify([owner.choiceId, 'b5-void-swarm', (i + 1) / POLICY.portalEveryPvp]), acquiredRound: r.round },
    [{ kind: 'item', definitionId: B5_PORTAL_ITEM }]));
}
function portalCell(ctx: AbilityContext, holder: S13Unit): HexCell | null {
  const front = { col: holder.cell.col, row: Math.max(0, Math.min(ctx.board.rows - 1, holder.cell.row + (holder.team === 'player' ? -1 : 1))) };
  const cells = Array.from({ length: ctx.board.rows }, (_, row) => Array.from({ length: ctx.board.columns }, (_, col) => ({ col, row }))).flat();
  return nearestItemCell(front, cells.filter(c => !ctx.units.some(u => occupiesCell(u, ctx.tick) && u.cell.col === c.col && u.cell.row === c.row)));
}
/** Runs once at tick 0, after the actual two-sided roster and opening absences are known. */
export function startB5VoidSwarm(ctx: AbilityContext, state: CombatState): void {
  const born: CombatUnit[] = [];
  for (const holder of [...ctx.units].filter(u => u.alive && u.hp > 0).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    for (const m of holder.mechanics ?? []) {
      if (m.mechanic !== 'b5VoidPortal') continue;
      const cell = portalCell(ctx, holder); if (!cell) continue;
      const id = JSON.stringify(['g24-summon', 'voidspawn', holder.id, m.source.instanceId]);
      const unit = createB5VoidBody(id, 'g24-voidspawn', holder.team, cell, m.values.health, m.values.attack,
        holder.mechanics?.find(m => m.mechanic === 'voidSwarm'), { kind: 'voidspawn', ownerId: holder.id, itemInstanceId: m.source.instanceId,
          unit: { id, definitionId: 'g24-voidspawn', team: holder.team, starLevel: 1, location: { kind: 'board', cell: { ...cell } } },
          formCell: { ...cell }, healthBps: 10000, spawnedAtTick: 0 });
      const spawned = spawnCombatUnit({ ...state, units: ctx.units }, unit, m.source, 0);
      ctx.units.push(unit as S13Unit); ctx.events.push(...spawned.events); born.push(unit);
    }
  }
  if (born.length) initializeBornUnits(ctx, born);
  for (const enemy of ctx.units.filter(u => isSelectable(u, 0))) {
    const targets = born.filter(u => u.team !== enemy.team && hexDistance(enemy.cell, u.cell) <= POLICY.tauntRadius)
      .sort((a, b) => hexDistance(enemy.cell, a.cell) - hexDistance(enemy.cell, b.cell) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const target = targets[0]; if (!target) continue;
    enemy.voidSwarmTaunt = target.id;
    if (enemy.targetId !== target.id) ctx.events.push({ type: 'targetChanged', tick: 0, unitId: enemy.id, before: enemy.targetId, after: target.id });
    enemy.targetId = target.id;
  }
}
/** Opening taunt is a target lock, without inventing an unsupported timed duration. */
export function b5VoidSwarmTarget(unit: S13Unit, units: readonly S13Unit[], tick: number): S13Unit | undefined {
  if (!unit.voidSwarmTaunt) return;
  const target = units.find(u => u.id === unit.voidSwarmTaunt && u.team !== unit.team && isSelectable(u, tick));
  if (!target) delete unit.voidSwarmTaunt;
  return target;
}
export function b5VoidSwarmVamp(unit: S13Unit): VampRate[] {
  if (!['g24-voidspawn', 'b5-voidling'].includes(unit.definitionId)) return [];
  const m = unit.mechanics?.find(m => m.mechanic === 'voidSwarm');
  return m ? [{ source: asSource(m.source), bps: m.values.omnivampBps, allyBps: 0 }] : [];
}
