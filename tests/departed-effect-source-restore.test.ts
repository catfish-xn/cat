/* A Trench holder whose item effect is still running on an enemy splits mid-combat, so the save carries
 * CombatState.departedUnits. Trench combats restore by full cold replay (validateDynamicCombat), which reproduces the
 * departed snapshot; a save that drops or forges it is rejected. */
import { expect, it, vi } from 'vitest';
import { quietAugmentRound } from './match-helpers';
import { deployMatchUnit, equipItem, startMatchCombat, stepMatch } from '../src/simulation/match';
import { grantMechanicItem } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import type { MatchState } from '../src/simulation/match-types';
vi.setConfig({ testTimeout: 60_000 });

function equipped(base: MatchState, items: readonly string[]): MatchState {
  let state = base;
  const owner = state.preparation.units.find(u => u.team === 'player')!;
  for (const [index, definitionId] of items.entries()) {
    const grant = grantMechanicItem(state, { receiptId: `departed-${index}`, source: 'test', definitionId });
    if (!grant.ok) throw Error(grant.reason);
    const equip = equipItem(grant.state, grant.state.items.at(-1)!.id, owner.id, index);
    if (!equip.ok) throw Error(equip.reason);
    state = equip.state;
  }
  if (owner.location.kind === 'board') return state;
  const deploy = deployMatchUnit(state, owner.id, { kind: 'board', cell: { col: 3, row: 4 } }); if (!deploy.ok) throw Error(deploy.reason);
  return deploy.state;
}

it.each(['sunfire-cape', 'morellonomicon'])('round-trips a save whose Trench holder still sources %s', item => {
  const start = startMatchCombat(equipped(quietAugmentRound(42), ['TFT_Item_Artifact_SuspiciousTrenchCoat', item]));
  if (!start.ok) throw Error(start.reason);
  let current = start.state, saved = 0;
  while (current.phase === 'combat') {
    current = stepMatch(current).state;
    if (current.combat?.departedUnits?.length && saved < 3) {
      saved++;
      expect(restoreMatch(serializeMatch(current))).toEqual(current);
      const dropped = structuredClone(current); delete (dropped.combat as { departedUnits?: unknown }).departedUnits;
      expect(() => restoreMatch(dropped)).toThrow();
      const forged = structuredClone(current); Object.assign(forged.combat!.departedUnits![0]!, { attackDamage: 9999 });
      expect(() => restoreMatch(forged)).toThrow();
    }
  }
  expect(saved).toBe(3); // the scenario is still exercised
  expect(restoreMatch(serializeMatch(current))).toEqual(current);
});
