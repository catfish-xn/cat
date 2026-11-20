import type { AbilityContext } from './combat-s13-abilities';
import { spellCrit, type S13Unit } from './combat-s13-state';
import { authorizeSpellCrit } from './m8/crit';
import type { SpellCritAuthorization } from './m8/contracts';
import { S13_COMBAT_RULES } from './s13-rules';

type SourceLookup = Pick<AbilityContext, 'units' | 'roster' | 'departedUnits'>;

/** The unit an effect names as its source: on the board, banished for this step, or removed while one of its effects
 * was still running (departedUnits). Undefined only when none of them holds it; callers then skip that effect. */
export function effectSourceUnit(ctx: SourceLookup, unitId: string): S13Unit | undefined {
  return ctx.units.find(u => u.id === unitId) ?? ctx.roster?.find(u => u.id === unitId) ?? ctx.departedUnits?.find(u => u.id === unitId);
}

/** Spell-crit authority of an effect's source; a source no one holds any more grants no crit. */
export function sourceSpellCrit(ctx: SourceLookup, unitId: string): SpellCritAuthorization {
  const unit = effectSourceUnit(ctx, unitId);
  return unit ? spellCrit(unit) : authorizeSpellCrit([], [], 0, S13_COMBAT_RULES.critMultiplierBps);
}
