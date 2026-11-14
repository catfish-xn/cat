import { buyXp, createMatch, deployMatchUnit } from '../../src/simulation/match';
import { grantMechanicGold, grantMechanicUnit } from '../../src/simulation/seat-mechanics';
import type { UnitLootPolicy } from '../../src/simulation/loot-runtime';
import type { MatchState } from '../../src/simulation/match-types';

export function accepted(result: { readonly ok: boolean; readonly state: MatchState; readonly reason?: string }): MatchState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
/** Public transactions, with restorable grant receipts and XP history; no fabricated Sion asset. */
export function sionPreparation(base = createMatch(42), unitLootPolicy?: UnitLootPolicy): MatchState {
  let state = accepted(grantMechanicGold(base, { receiptId: 'sion:xp', source: 'test', amount: 40 }));
  while (state.level < 3) state = accepted(buyXp(state));
  state = accepted(deployMatchUnit(state, 'unit-1', { kind: 'bench', slot: 8 }));
  for (const [col, definitionId] of ['morgana', 'vladimir', 'cassiopeia'].entries()) {
    state = accepted(grantMechanicUnit(state, { receiptId: `sion:${definitionId}`, source: 'test', definitionId, immediate: true }, unitLootPolicy));
    const unit = state.preparation.units.find(u => u.definitionId === definitionId)!;
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: { col, row: 6 } }));
  }
  return state;
}
