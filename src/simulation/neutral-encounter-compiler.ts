import { DEFAULT_BOARD, isDeploymentCell } from './board';
import { compareIds, type CombatUnit } from './combat-types';
import type { Unit, ResolvedUnitStats } from './unit-types';
import { NEUTRAL_DEFINITIONS, neutralAbilityId } from './content/neutrals';
import { NEUTRAL_ENCOUNTERS, NEUTRAL_ENCOUNTER_CATALOG_VERSION, NEUTRAL_ENCOUNTER_POLICY_VERSION } from './content/neutral-encounters';
import { freezeContent } from './content/freeze';
import type { Source } from './m8/contracts';
import type { OpeningDefinition } from './m8/opening';
import { attackInterval } from './m8/stats';
import { compileUnitInputs, validateNeutralInputs } from './m8/unit-inputs';
import { flatAmount } from './m8/s13-definitions';

export interface CompiledNeutralEncounter {
  readonly roundId: string;
  readonly encounterId: string;
  readonly catalogVersion: typeof NEUTRAL_ENCOUNTER_CATALOG_VERSION;
  readonly policyVersion: typeof NEUTRAL_ENCOUNTER_POLICY_VERSION;
  readonly encounterRngDraws: 0;
  readonly deployment: readonly Unit[];
  readonly units: readonly CombatUnit[];
  readonly openingDefinitions: readonly OpeningDefinition[];
}

/**
 * Pure trusted content compiler used by Match preparation, combat and restore.
 * No RNG, player resources, rewards or combat execution.
 */
export function compileNeutralEncounter(roundId: string): CompiledNeutralEncounter {
  const encounter = NEUTRAL_ENCOUNTERS.find(entry => entry.roundId === roundId);
  if (!encounter) throw new RangeError(`Unknown neutral round: ${roundId}`);
  const deployment: Unit[] = [], units: CombatUnit[] = [], openingDefinitions: OpeningDefinition[] = [];
  const seenSlots = new Set<string>(), seenCells = new Set<string>();
  for (const slot of encounter.slots) {
    const cellKey = JSON.stringify([slot.cell.col, slot.cell.row]);
    if (!slot.slotId || seenSlots.has(slot.slotId) || seenCells.has(cellKey) || !isDeploymentCell(DEFAULT_BOARD, 'enemy', slot.cell)) {
      throw new RangeError(`Invalid neutral deployment: ${encounter.encounterId}/${slot.slotId}`);
    }
    seenSlots.add(slot.slotId); seenCells.add(cellKey);
    if (!Object.hasOwn(NEUTRAL_DEFINITIONS, slot.definitionId)) throw new RangeError(`Unknown neutral definition: ${slot.definitionId}`);
    const definition = NEUTRAL_DEFINITIONS[slot.definitionId], mechanism = definition.mechanism;
    const id = JSON.stringify(['pve', roundId, encounter.encounterId, slot.slotId]);
    const abilityId = neutralAbilityId(definition);
    const stats: ResolvedUnitStats = {
      unitKind: definition.unitKind, monsterFamily: definition.monsterFamily,
      health: definition.health, attack: definition.attack, armor: definition.armor, magicResist: definition.magicResist,
      attackRange: definition.attackRange, attackIntervalTicks: attackInterval(definition.baseAttackSpeedBps, 0),
      baseAttackSpeedBps: definition.baseAttackSpeedBps, initialMana: definition.initialMana, maxMana: definition.maxMana,
      baseCritChanceBps: definition.baseCritChanceBps, baseCritMultiplierBps: definition.baseCritMultiplierBps, abilityId,
    };
    validateNeutralInputs(stats);
    const source: Source = { ownerId: id, sourceKind: 'ability', definitionId: abilityId, instanceId: id, effectIndex: 0, parentItemInstanceId: null };
    const passive: Pick<CombatUnit, 'companionDefinitions' | 'attackCone'> = mechanism.kind === 'companion-heal'
      ? { companionDefinitions: [{ source, maxReactions: mechanism.maxReactions,
        effects: [{ kind: 'heal', amount: flatAmount(0, { missingHpBps: mechanism.missingHpBps }) }] }] }
      : mechanism.kind === 'companion-speed'
        ? { companionDefinitions: [{ source, maxReactions: mechanism.maxReactions, effects: [{ kind: 'modify-stat',
          modifier: { stat: 'attackSpeed', unit: 'bps', value: { kind: 'constant', amount: mechanism.attackSpeedBps }, condition: { kind: 'always' }, damageFilter: null },
          activation: 'next-tick', duration: { kind: 'combat' }, stackPolicy: { kind: 'independent-instances' } }] }] }
        : mechanism.kind === 'attack-cone' ? { attackCone: { secondaryDamageBps: mechanism.secondaryDamageBps } } : {};
    if (mechanism.kind === 'backline-jump') openingDefinitions.push({ kind: 'backline-jump', source });
    if (mechanism.kind === 'path-charge') openingDefinitions.push({ kind: 'path-charge', source, effects: [
      { kind: 'damage', damageType: 'magic', delivery: 'ability-direct', critEligibility: 'never',
        amount: flatAmount(0, { maxHpBps: mechanism.targetMaxHpBps, hpBasis: 'target', cap: mechanism.damageCap, sample: 'packet' }) },
      { kind: 'apply-status', status: { kind: 'stun', magnitudeBps: 0, activation: 'next-tick', duration: { kind: 'ticks', ticks: mechanism.stunTicks },
        stackPolicy: { kind: 'independent-instances' }, removable: true, polarity: 'harmful', damageFilter: null, onEnd: null } },
    ] });
    deployment.push({ id, definitionId: definition.id, encounterId: encounter.encounterId, team: 'enemy',
      starLevel: definition.starLevel, location: { kind: 'board', cell: { ...slot.cell } } });
    units.push({ ...compileUnitInputs(stats), ...passive, id, definitionId: definition.id, encounterId: encounter.encounterId,
      team: 'enemy', starLevel: definition.starLevel, cell: { ...slot.cell }, startingCell: { ...slot.cell },
      hp: stats.health, maxHp: stats.health, maxHpBasis: { base: stats.health, flat: 0, bps: 0, bonusBps: 0 },
      attackDamage: stats.attack, attackDamageBase: stats.attack, attackDamagePercentBps: 0, abilityPower: definition.abilityPower,
      attackRange: stats.attackRange, attackIntervalTicks: stats.attackIntervalTicks, attackSpeedBonusBps: 0,
      cooldownTicks: 0, moveCooldownTicks: 0, armor: stats.armor, magicResist: stats.magicResist,
      mana: stats.initialMana, maxMana: stats.maxMana, shield: 0, shieldExpiresAtTick: null,
      ability: { id: abilityId, amount: 0, kind: 's13', championId: 'neutral', variables: {} },
      sources: [], triggers: [], effectRuntime: [], mechanics: [], itemPrograms: [], shieldLayers: [], statuses: [], tasks: [],
      alive: true, targetId: null,
    });
  }
  return freezeContent({ roundId, encounterId: encounter.encounterId, catalogVersion: NEUTRAL_ENCOUNTER_CATALOG_VERSION,
    policyVersion: NEUTRAL_ENCOUNTER_POLICY_VERSION, encounterRngDraws: 0,
    deployment: deployment.sort(compareIds), units: units.sort(compareIds), openingDefinitions });
}

/** Finite, immutable same-version plans. No query or restore recompiles/randomizes an encounter. */
export const COMPILED_NEUTRAL_ENCOUNTERS = freezeContent(NEUTRAL_ENCOUNTERS.map(e => compileNeutralEncounter(e.roundId)));
export function readNeutralCombatUnit(id: string): CombatUnit | undefined {
  return COMPILED_NEUTRAL_ENCOUNTERS.flatMap(e => e.units).find(u => u.id === id);
}
