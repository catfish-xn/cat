import { compileNeutralEncounterDefinition } from '../src/simulation/neutral-encounter-compiler';

/** Legacy content vector compiled by the production compiler, never installed in Match.
 * Charge/stun no longer occurs in the S13 schedule; keep its engine regressions here.
 */
export function legacyHeraldVector() {
  return compileNeutralEncounterDefinition({
    roundId: 'test-legacy', encounterId: 'test-legacy-herald',
    slots: [{ slotId: 'h01', definitionId: 'pve-rift-herald', cell: { col: 3, row: 1 } }],
  });
}
