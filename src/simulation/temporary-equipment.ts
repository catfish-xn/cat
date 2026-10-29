
import { equipmentRollFor, generateLuckyGlovesRolls } from './augment-pool-batch5-g1-equipment';
import { AUGMENT_BATCH5_G1 } from './content/augment-pool-batch5-g1';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { ITEM_DEFINITIONS as ORDINARY_ITEMS } from './content/items';
import { freezeContent } from './content/freeze';
import type { MatchState } from './match-types';
import type { TemporaryEquipment } from './m8/contracts';
import { createEquipmentPool, generateRoundRolls,  projectTemporaryEquipment,
  reconcileTemporaryEquipment, } from './m8/equipment';
import type { ItemDefinition, StrategyEvent } from './strategy-types';

export const grantsTemporaryEquipment = (definition: ItemDefinition): boolean =>
  definition.combatProgram?.effects?.some(effect => effect.kind === 'temporary-equipment') ?? false;

export const TEMPORARY_EQUIPMENT_POOL = freezeContent(createEquipmentPool(Object.values(ORDINARY_ITEMS).map(item => ({
  apiName: item.apiName!, definitionId: item.id, kind: item.kind, effects: item.combatProgram?.effects ?? [],
}))));

export function projectCurrent(state: Readonly<MatchState>): TemporaryEquipment[] {
  return state.items.filter(item => item.location.kind === 'unit' && grantsTemporaryEquipment(ITEM_DEFINITIONS[item.definitionId]))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).flatMap(parent => {
      if (parent.location.kind !== 'unit') throw new Error('Expected equipped parent');
      const roll = equipmentRollFor(state.equipmentState.rolls,state.roundDefinitionId,parent,state);
      if (!roll) throw new Error('Missing equipped parent round roll');
      return projectTemporaryEquipment(roll, parent.location.unitId);
    });
}

/** Match calls this only after a successful equipment/roster/round transaction. */
export function planTemporaryEquipment(state: MatchState): { state: MatchState; events: readonly StrategyEvent[] } {
  const requests = state.items.filter(item => item.location.kind === 'unit' && grantsTemporaryEquipment(ITEM_DEFINITIONS[item.definitionId]))
    .map(item => ({ parentItemInstanceId: item.id, roundId: state.roundDefinitionId, playerLevel: state.level }));
  const equipmentState = state.augments.some(a => Object.hasOwn(AUGMENT_BATCH5_G1,a.definitionId))
    ? generateLuckyGlovesRolls(state,requests,TEMPORARY_EQUIPMENT_POOL)
    : generateRoundRolls(state.equipmentState, requests, TEMPORARY_EQUIPMENT_POOL);
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


