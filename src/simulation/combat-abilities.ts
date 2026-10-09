import { NEUTRAL_DEFINITIONS, neutralAbilityId } from './content/neutrals';
import { hexDistance } from './board';
import { compareIds, type CombatUnit } from './combat-types';
import type { AbilityDefinition, DamagePacket, ResolvedAbility } from './ability-types';
import type { StarLevel } from './unit-types';
import { S13_ABILITY_DATA } from './content/abilities';

const definitions: Record<string, AbilityDefinition> = {
  'sentinel-guard': { id: 'sentinel-guard', kind: 'selfShield', amountByStar: [220, 400, 720], durationTicks: 60 },
  'ranger-shot': { id: 'ranger-shot', kind: 'damage', damageType: 'physical', radius: 0, amountByStar: [150, 270, 486] },
  'mystic-bolt': { id: 'mystic-bolt', kind: 'damage', damageType: 'magic', radius: 0, amountByStar: [180, 324, 583] },
  'bulwark-guard': { id: 'bulwark-guard', kind: 'selfShield', amountByStar: [300, 540, 972], durationTicks: 60 },
  'archer-shot': { id: 'archer-shot', kind: 'damage', damageType: 'physical', radius: 0, amountByStar: [220, 396, 713] },
  'arcanist-burst': { id: 'arcanist-burst', kind: 'damage', damageType: 'magic', radius: 1, amountByStar: [210, 378, 680] },
  'duelist-strike': { id: 'duelist-strike', kind: 'damage', damageType: 'physical', radius: 0, amountByStar: [300, 540, 972] },
  'warden-guard': { id: 'warden-guard', kind: 'selfShield', amountByStar: [500, 900, 1620], durationTicks: 60 },
  'tempest-burst': { id: 'tempest-burst', kind: 'damage', damageType: 'magic', radius: 1, amountByStar: [300, 540, 972] },
  'colossus-guard': { id: 'colossus-guard', kind: 'selfShield', amountByStar: [750, 1350, 2430], durationTicks: 60 },
  'oracle-burst': { id: 'oracle-burst', kind: 'damage', damageType: 'magic', radius: 1, amountByStar: [420, 756, 1361] },
};

export const ABILITY_DEFINITIONS: Readonly<Record<string, AbilityDefinition>> = Object.freeze(
  Object.fromEntries(Object.entries(definitions).map(([id, ability]) => [id,
    Object.freeze({ ...ability, amountByStar: Object.freeze([...ability.amountByStar]) })])) as Record<string, AbilityDefinition>,
);

export function validateAbilityDefinitions(catalog: Readonly<Record<string, AbilityDefinition>> = ABILITY_DEFINITIONS): void {
  const seen = new Set<string>();
  for (const [key, ability] of Object.entries(catalog)) {
    if (!ability.id || key !== ability.id || seen.has(ability.id)) throw new Error(`Invalid ability ID: ${key}`);
    seen.add(ability.id);
    if (ability.amountByStar.length !== 3 || [...ability.amountByStar].some(amount => !Number.isSafeInteger(amount) || amount < 0)) {
      throw new RangeError(`Invalid star values for ability: ${key}`);
    }
    if (ability.kind === 'selfShield') {
      if (!Number.isSafeInteger(ability.durationTicks) || ability.durationTicks < 1) throw new RangeError(`Invalid shield duration: ${key}`);
    } else if (ability.kind !== 'damage' || !['physical', 'magic'].includes(ability.damageType) || ![0, 1].includes(ability.radius)) {
      throw new Error(`Invalid damage ability: ${key}`);
    }
  }
}
validateAbilityDefinitions();

/** Copy only resolved numbers into battle state, never content-table objects or callbacks. */
export function resolveAbility(abilityId: string, starLevel: StarLevel): ResolvedAbility {
  if (![1, 2, 3].includes(starLevel)) throw new RangeError('Invalid star level');
  if (abilityId === 'neutral-attack' || Object.values(NEUTRAL_DEFINITIONS).some(d => neutralAbilityId(d) === abilityId)) return { id: abilityId, amount: 0, kind: 's13', championId: 'neutral', variables: {} };
  if (Object.hasOwn(S13_ABILITY_DATA, abilityId)) {
    const definition = S13_ABILITY_DATA[abilityId];
    return { id: abilityId, amount: 0, kind: 's13', championId: definition.championId,
      variables: Object.fromEntries(Object.entries(definition.variables).map(([key, values]) => [key, Math.round(values[starLevel - 1] * 10000)])) };
  }
  const definition = ABILITY_DEFINITIONS[abilityId];
  if (!definition) throw new Error(`Unknown ability: ${abilityId}`);
  if (![1, 2, 3].includes(starLevel)) throw new RangeError('Invalid star level');
  const amount = definition.amountByStar[starLevel - 1];
  return definition.kind === 'damage'
    ? { id: definition.id, kind: 'damage', amount, damageType: definition.damageType, radius: definition.radius }
    : { id: definition.id, kind: 'selfShield', amount, durationTicks: definition.durationTicks };
}

export interface AbilityIntent {
  readonly targetIds: readonly string[];
  readonly packets: readonly DamagePacket[];
  readonly shield?: { readonly unitId: string; readonly amount: number; readonly durationTicks: number };
}

/** All targets read the same post-movement snapshot. No HP or life state changes here. */
export function planAbility(unit: CombatUnit, target: CombatUnit | undefined, units: readonly CombatUnit[]): AbilityIntent | undefined {
  if (!unit.alive || !target || unit.mana < unit.maxMana) return undefined;
  const ability = unit.ability;
  if (ability.kind === 's13') return undefined;
  if (ability.kind === 'selfShield') {
    return { targetIds: [unit.id], packets: [], shield: { unitId: unit.id, amount: ability.amount, durationTicks: ability.durationTicks } };
  }
  if (hexDistance(unit.cell, target.cell) > unit.attackRange) return undefined;
  const targets = ability.radius === 0 ? [target] : units.filter(other =>
    other.alive && other.team !== unit.team && hexDistance(other.cell, target.cell) <= ability.radius).sort(compareIds);
  return {
    targetIds: targets.map(other => other.id),
    packets: targets.map((other, effectIndex) => ({ sourceId: unit.id, targetId: other.id,
      damageType: ability.damageType, rawAmount: ability.amount, sourceKind: 'ability', abilityId: ability.id, effectIndex })),
  };
}
