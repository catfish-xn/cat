import type { MatchState } from './match-types';
import type {
  Effect, ChoiceDefinition, ItemDefinition, SourcedEffect, StrategySnapshot, TraitDefinition,
} from './strategy-types';
import { UNIT_DEFINITIONS } from './units';
import { getUnitStats } from './unit-stats';
import { getRoundEnemyItems } from './round-enemies';
import { hexDistance } from './board';
import { resolveAbility } from './combat-abilities';
import { deriveTraits } from './trait-snapshot';
import { makeSourcedEffects, resolveEffects } from './effects';
import { TRAIT_DEFINITIONS } from './content/traits';
import { ITEM_DEFINITIONS } from './content/items';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { ANOMALY_DEFINITIONS } from './content/anomalies';

export interface StrategyCatalog {
  readonly traits: Readonly<Record<string, TraitDefinition>>;
  readonly items: Readonly<Record<string, ItemDefinition>>;
  readonly augments: Readonly<Record<string, ChoiceDefinition>>;
  readonly anomalies: Readonly<Record<string, ChoiceDefinition>>;
}
const DEFAULT_CATALOG: StrategyCatalog = {
  traits: TRAIT_DEFINITIONS, items: ITEM_DEFINITIONS, augments: AUGMENT_DEFINITIONS, anomalies: ANOMALY_DEFINITIONS,
};
function lookup<T>(catalog: Readonly<Record<string, T>>, id: string): T {
  if (!Object.hasOwn(catalog, id)) throw new RangeError(`Unknown strategy definition: ${id}`);
  return catalog[id];
}

/** The only strategy compilation boundary. Combat receives JSON numbers and provenance,
 * with no links to Match or content records and no board/bench decisions left for the tick.
 */
export function buildStrategySnapshot(state: MatchState, catalog: StrategyCatalog = DEFAULT_CATALOG): StrategySnapshot {
  const traits = [...deriveTraits(state.preparation, 'player', catalog.traits), ...deriveTraits(state.preparation, 'enemy', catalog.traits)];
  const boardUnits = state.preparation.units.filter(unit => unit.location.kind === 'board')
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const units = boardUnits.map(unit => {
    const sources: SourcedEffect[] = [];
    for (const trait of traits) {
      if (trait.team !== unit.team || trait.tier === 0 || !trait.targetUnitIds.includes(unit.id)) continue;
      const definition = lookup(catalog.traits, trait.traitId);
      const tier = definition.tiers.find(candidate => candidate.threshold === trait.tier);
      if (!tier) throw new RangeError(`Unknown trait tier: ${trait.traitId}/${trait.tier}`);
      sources.push(...makeSourcedEffects(unit.id, 'trait', trait.traitId, `${trait.team}:${trait.tier}`, [...tier.effects, ...(trait.memberDefinitionIds.includes(unit.definitionId) ? tier.memberEffects ?? [] : [])]));
    }
    if (unit.team === 'player') {
      for (const item of state.items) {
        if (item.location.kind !== 'unit' || item.location.unitId !== unit.id) continue;
        const definition = lookup(catalog.items, item.definitionId);
        sources.push(...makeSourcedEffects(unit.id, 'item', item.definitionId, item.id, definition.effects));
      }
      for (const augment of state.augments) {
        const definition = lookup(catalog.augments, augment.definitionId);
        sources.push(...makeSourcedEffects(unit.id, 'augment', augment.definitionId, augment.choiceId, definition.effects.flatMap<Effect>(effect => {
          if (effect.kind !== 'mechanic') return [effect];
          if (effect.mechanic === 'pumpingUp') return [{ kind: 'attackSpeedBps' as const, bps: state.augmentProgress.pumpingRounds * effect.values.attackSpeedBpsPerRound }];
          if (effect.mechanic === 'investment') return [{ kind: 'statFlat' as const, stat: 'maxHp' as const, amount: state.augmentProgress.investmentHp }];
          if (effect.values.backRowOnly && unit.location.kind === 'board' && unit.location.cell.row !== state.preparation.board.deploymentZones.player.lastRow) return [];
          if (effect.mechanic === 'bulkyBuddies') {
            const adjacent = boardUnits.filter(other => other.team === unit.team && other.id !== unit.id && other.location.kind === 'board' && unit.location.kind === 'board' && hexDistance(other.location.cell, unit.location.cell) === 1);
            return adjacent.length === 1 ? [{ kind: 'statFlat' as const, stat: 'maxHp' as const, amount: effect.values.health }, effect] : [];
          }
          return [effect];
        })));
      }
      const binding = state.anomalyBinding;
      if (binding?.unitId === unit.id) {
        const definition = lookup(catalog.anomalies, binding.definitionId);
        sources.push(...makeSourcedEffects(unit.id, 'anomaly', binding.definitionId, binding.choiceId, definition.effects));
      }
    } else {
      for (const item of getRoundEnemyItems(state.round).filter(item => item.unitId === unit.id)) {
        const definition = lookup(catalog.items, item.definitionId);
        sources.push(...makeSourcedEffects(unit.id, 'item', item.definitionId, `enemy:${state.round}:${unit.id}:${item.slot}`, definition.effects));
      }
    }
    const growth = state.persistentGrowth.find(entry => entry.unitId === unit.id);
    if (growth) sources.push(...makeSourcedEffects(unit.id, 'ability', 'tristana-ability', `persistent:${unit.id}`, [{ kind: 'statPercentBps', stat: 'attackDamage', bps: growth.attackDamageBps }]));
    const base = getUnitStats(unit.definitionId, unit.starLevel);
    const resolved = resolveEffects(base, resolveAbility(base.abilityId, unit.starLevel), sources);
    const mechanics = (resolved.mechanics ?? []).map(mechanic => {
      if (mechanic.mechanic !== 'bulkyBuddies') return mechanic;
      const buddy = boardUnits.find(other => other.team === unit.team && other.id !== unit.id && other.location.kind === 'board' && unit.location.kind === 'board' && hexDistance(other.location.cell, unit.location.cell) === 1);
      return { ...mechanic, targetId: buddy!.id };
    });
    if (unit.definitionId === 'vander') mechanics.push({ source: {ownerId:unit.id,sourceKind:'ability',definitionId:'vander-ability',instanceId:unit.id,effectIndex:0},mechanic:'lowCostAllies',values:{count:boardUnits.filter(other=>other.team===unit.team && UNIT_DEFINITIONS[other.definitionId].cost<=2).length}});
    return { unitId: unit.id, ...resolved, mechanics };
  });
  return { traits, units };
}
