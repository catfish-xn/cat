import { ITEM_DEFINITIONS } from './content/items';
import { freezeContent } from './content/freeze';
import type { MatchState } from './match-types';
import type { TemporaryEquipment } from './m8/contracts';
import { createEquipmentPool, generateRoundRolls, initializeStreams, projectTemporaryEquipment,
  reconcileTemporaryEquipment, validateEquipmentState, validateTemporaryEquipment } from './m8/equipment';
import { getStageRound } from './round-schedule';
import type { ItemDefinition, StrategyEvent } from './strategy-types';

export const grantsTemporaryEquipment = (definition: ItemDefinition): boolean =>
  definition.combatProgram?.effects?.some(effect => effect.kind === 'temporary-equipment') ?? false;

export const TEMPORARY_EQUIPMENT_POOL = freezeContent(createEquipmentPool(Object.values(ITEM_DEFINITIONS).map(item => ({
  apiName: item.apiName!, definitionId: item.id, kind: item.kind, effects: item.combatProgram?.effects ?? [],
}))));

function projectCurrent(state: Readonly<MatchState>): TemporaryEquipment[] {
  return state.items.filter(item => item.location.kind === 'unit' && grantsTemporaryEquipment(ITEM_DEFINITIONS[item.definitionId]))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).flatMap(parent => {
      if (parent.location.kind !== 'unit') throw new Error('Expected equipped parent');
      const roll = state.equipmentState.rolls.find(roll => roll.parentItemInstanceId === parent.id && roll.roundId === state.roundDefinitionId);
      if (!roll) throw new Error('Missing equipped parent round roll');
      return projectTemporaryEquipment(roll, parent.location.unitId);
    });
}

/** Match calls this only after a successful equipment/roster/round transaction. */
export function planTemporaryEquipment(state: MatchState): { state: MatchState; events: readonly StrategyEvent[] } {
  const requests = state.items.filter(item => item.location.kind === 'unit' && grantsTemporaryEquipment(ITEM_DEFINITIONS[item.definitionId]))
    .map(item => ({ parentItemInstanceId: item.id, roundId: state.roundDefinitionId, playerLevel: state.level }));
  const equipmentState = generateRoundRolls(state.equipmentState, requests, TEMPORARY_EQUIPMENT_POOL);
  const desired = projectCurrent({ ...state, equipmentState });
  const changes = reconcileTemporaryEquipment(state.temporaryEquipment, desired);
  const events: StrategyEvent[] = equipmentState.rolls.slice(state.equipmentState.rolls.length).map(roll => ({ type: 'equipmentRolled', roll: structuredClone(roll) }));
  if (changes.remove.length || changes.apply.length) events.push({ type: 'temporaryEquipmentChanged',
    removed: structuredClone(changes.remove), applied: structuredClone(changes.apply) });
  return { state: equipmentState === state.equipmentState && !events.length ? state
    : { ...state, equipmentState, temporaryEquipment: desired }, events };
}

/** Includes historical/revoked children, so stale UI IDs never become permanent commands. */
export function isTemporaryItemId(state: Readonly<MatchState>, id: string): boolean {
  return state.equipmentState.rolls.some(roll => [1, 2].some(slot => JSON.stringify([roll.parentItemInstanceId, roll.roundId, slot]) === id));
}

/** Strict local restore: replay the independent stream, validate parents/rounds and exact bindings. */
export function validateMatchEquipment(state: Readonly<MatchState>): void {
  validateEquipmentState(state.equipmentState, TEMPORARY_EQUIPMENT_POOL, initializeStreams(state.seed).equipment);
  if (!Number.isInteger(state.round) || state.round < 1 || state.round > 35) throw new Error('Invalid equipment round');
  const roundIds = Array.from({ length: state.round }, (_, i) => { const r = getStageRound(i + 1); return `${r.stage}-${r.round}`; });
  let previousRound = -1;
  for (const roll of state.equipmentState.rolls) {
    const parent = state.items.find(item => item.id === roll.parentItemInstanceId), round = roundIds.indexOf(roll.roundId);
    if (!parent || !grantsTemporaryEquipment(ITEM_DEFINITIONS[parent.definitionId]) || ITEM_DEFINITIONS[parent.definitionId].slotCost !== 3
      || round < 0 || round < previousRound || roll.playerLevelSnapshot < 3 || roll.playerLevelSnapshot > state.level) {
      throw new Error('Invalid equipment parent/round/level');
    }
    previousRound = round;
  }
  validateTemporaryEquipment(state.temporaryEquipment, state.equipmentState.rolls);
  const expected = projectCurrent(state), actual = state.temporaryEquipment;
  if (actual.length !== expected.length || expected.some(child => !actual.some(other =>
    child.temporaryId === other.temporaryId && child.parentItemInstanceId === other.parentItemInstanceId
    && child.roundId === other.roundId && child.holderId === other.holderId && child.definitionId === other.definitionId
    && child.slot === other.slot && child.expiresAfterRoundId === other.expiresAfterRoundId))) {
    throw new Error('Invalid current temporary equipment projection');
  }
}
