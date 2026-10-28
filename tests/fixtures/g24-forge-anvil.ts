import { claimOrb, sellUnit, type MatchState } from '../../src/simulation/match';
import { readLootView } from '../../src/simulation/loot-view';
import { isAnvil } from '../../src/simulation/content/anvils';

export const accepted = <T extends { ok: boolean; state: MatchState }>(result: T): MatchState => {
  if (!result.ok) throw Error('Fixture command refused: ' + ('reason' in result ? result.reason : 'unknown') + ' at ' + result.state.roundDefinitionId + '/' + result.state.phase);
  return result.state;
};

/** v22 anvil units (docs/ANVIL_UNITS.md): Conqueror forges no longer pop up. Claim every waiting G2-3 anvil orb onto
 * the bench and open the first Conqueror anvil by selling it (sell = openAnvil). Returns null when none is waiting. */
export function openConquerorAnvil(input: MatchState): { state: MatchState; receiptId: string } | null {
  let state = input;
  for (const orb of readLootView(state).unclaimedOrbs ?? []) if (orb.orbId.startsWith('g23-anvil:')) state = accepted(claimOrb(state, orb.orbId, state.round));
  for (const unit of state.preparation.units.filter(u => u.team === 'player' && isAnvil(u.definitionId))) {
    const birth = state.seatMechanics!.receipts.find(r => r.kind === 'unit' && r.unitId === unit.id);
    if (birth?.receiptId.startsWith('g23:conqueror:')) return { state: accepted(sellUnit(state, unit.id)), receiptId: birth.receiptId };
  }
  return null;
}
