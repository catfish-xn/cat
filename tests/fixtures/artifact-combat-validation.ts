import { canonicalContent } from '../../src/simulation/content';
import type { MatchState } from '../../src/simulation/match';
import { buildStrategySnapshot } from '../../src/simulation/strategy-snapshot';
import { projectG23Summons } from '../../src/simulation/g2-3-summons';
import { validateCombatItemGrants } from '../../src/simulation/m8/combat-item-grants';
import { validateSampledStatTriggerFacts } from '../../src/simulation/m8/sampled-stat-facts';
import { validateResistsShields } from '../../src/simulation/m8/resists-shield-restore';
import { validateMechanisms } from '../../src/simulation/m8/restore';
import { validateRestoreBoundsPreflight } from '../../src/simulation/restore-bounds-preflight';
import { validateNeutralCombat } from '../../src/simulation/neutral-restore';
import { validateM5Runtime } from '../../src/simulation/serialization';
import { validateMatchStructure } from '../../src/simulation/serialization-structure';

/** Combat-only unit harness, NOT a Match restore or evidence of acquisition.
 * These legacy fixtures equip mechanic-granted artifacts unavailable through the
 * preparation command ledger. Their boundary rejection is tested separately.
 * Recompile the strategy from the original input basis, then call the actual
 * production validators on a detached graph (as the real boundary does), keeping the old downstream positive/negative coverage.
 * The complete Match structure chain runs first with only the preparation ledger omitted, exactly as
 * restoreMatch does before its own ledger check; the named combat validators below then run explicitly.
 */
export function validateArtifactCombatFixture(input: MatchState | string): void {
  validateMatchStructure(input, () => {});
  const state: MatchState = typeof input === 'string' ? JSON.parse(input) : structuredClone(input);
  const combat = state.combat!, basis = state.combatInputBasis!;
  const strategy = buildStrategySnapshot(basis.inputs), preparation = projectG23Summons(basis.inputs.preparation);
  const same = (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);
  validateCombatItemGrants(combat.units, combat.tick, unit => unit.mechanismDefinitions?.eventTriggers ?? []);
  validateRestoreBoundsPreflight(combat, preparation, strategy, same);
  validateSampledStatTriggerFacts(combat, basis, strategy, same);
  const neutral = validateNeutralCombat(combat, preparation, strategy);
  validateResistsShields(combat, basis, strategy);
  const ids = new Set(combat.units.map(unit => unit.id));
  for (const unit of combat.units) {
    if (unit.ability.kind === 's13') validateMechanisms(unit, combat.units, combat.tick, combat.combatId!, combat.status === 'finished', combat.nextActionSeq!, neutral, typeof input === 'string');
    validateM5Runtime(unit, combat.tick, ids, combat.units, combat.combatId!, neutral, same, combat.nextActionSeq!);
  }
}

/** Canonical combat fixture text; deliberately does not claim Match admission. */
export function artifactCombatFixtureText(state: MatchState): string {
  validateArtifactCombatFixture(state);
  return canonicalContent(state);
}
