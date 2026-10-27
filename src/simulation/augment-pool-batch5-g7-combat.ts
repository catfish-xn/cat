import type { CombatUnit } from './combat-types';
import type { AugmentDeath } from './augment-history-types';
import type { StrategySnapshot } from './strategy-types';
import { UNIT_DEFINITIONS } from './units';
import { spellCrit } from './combat-s13-state';

/** Observe the actual killing packet, before kill-triggered changes. Never roll combat RNG. */
export function lootExplosionKillSample(killer: CombatUnit | undefined, victim: CombatUnit, strategy: StrategySnapshot | undefined): AugmentDeath['lootExplosion'] {
  if (!killer || killer.team === victim.team || !strategy || !ordinary(victim)) return undefined;
  if (!killer.sources?.some(s=>s.source.sourceKind==='augment' && s.source.sourceDefinitionId==='loot-explosion')) return undefined;
  // Membership exists even below the activation threshold; one Ambusher can earn loot.
  const trait = strategy.traits.find(t=>t.team===killer.team && t.traitId==='ambusher');
  if (!(trait?.memberUnitIds ? trait.memberUnitIds.includes(killer.id) : trait?.memberDefinitionIds.includes(killer.definitionId))) return undefined;
  return {killerUnitId:killer.id,originalKillerUnitId:killer.id,killerSeatId:killer.team==='player'?'solo':null,critChanceBps:spellCrit(killer).chanceBps};
}
function ordinary(unit: CombatUnit): boolean {
  return !!UNIT_DEFINITIONS[unit.definitionId] && !UNIT_DEFINITIONS[unit.definitionId].summon && unit.unitKind!=='neutral'
    && !unit.itemSummon && !unit.anomalySummon && !unit.v20Traits?.minion;
}
