import { s3bHistoricalEquipmentParent } from './augment-pool-batch5-s3b-restore';
import { equipmentRollFor, generateLuckyGlovesRolls, validateLuckyGlovesEquipment } from './augment-pool-batch5-g1-equipment';
import { AUGMENT_BATCH5_G1 } from './content/augment-pool-batch5-g1';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { ITEM_DEFINITIONS as ORDINARY_ITEMS } from './content/items';
import { freezeContent } from './content/freeze';
import type { MatchState } from './match-types';
import type { TemporaryEquipment } from './m8/contracts';
import { createEquipmentPool, generateRoundRolls, initializeStreams, projectTemporaryEquipment,
  reconcileTemporaryEquipment, validateEquipmentState, validateTemporaryEquipment } from './m8/equipment';
import { FINAL_ROUND } from './round-schedule';
import { ROUND_CATALOG } from './content/round-catalog';
import { MATCH_RULES } from './match-rules';
import type { ItemDefinition, StrategyEvent } from './strategy-types';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';

export const grantsTemporaryEquipment = (definition: ItemDefinition): boolean =>
  definition.combatProgram?.effects?.some(effect => effect.kind === 'temporary-equipment') ?? false;

export const TEMPORARY_EQUIPMENT_POOL = freezeContent(createEquipmentPool(Object.values(ORDINARY_ITEMS).map(item => ({
  apiName: item.apiName!, definitionId: item.id, kind: item.kind, effects: item.combatProgram?.effects ?? [],
}))));

function projectCurrent(state: Readonly<MatchState>): TemporaryEquipment[] {
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

/** Strict local restore after round-history validation: replay RNG, check round levels and exact bindings. */
export function validateMatchEquipment(state: Readonly<MatchState>): void {
  if (state.augments.some(a => Object.hasOwn(AUGMENT_BATCH5_G1,a.definitionId)) || state.equipmentState.rolls.some(r => r.lucky))
    validateLuckyGlovesEquipment(state,TEMPORARY_EQUIPMENT_POOL);
  else validateEquipmentState(state.equipmentState, TEMPORARY_EQUIPMENT_POOL, initializeStreams(state.seed).equipment);
  if (!Number.isInteger(state.round) || state.round < 1 || state.round > (state.multiplayer ? 256 : FINAL_ROUND)) throw new Error('Invalid equipment round');
  const roundIds = state.multiplayer ? Array.from({length:state.round},(_,i)=>getMultiplayerRoundByOrdinal(i+1).roundId)
    : ROUND_CATALOG.slice(0,state.round).map(round => round.roundId);
  let previousRound = -1;
  for (const roll of state.equipmentState.rolls) {
    const current = state.items.find(item => item.id === roll.parentItemInstanceId);
    let parent = (current && grantsTemporaryEquipment(ITEM_DEFINITIONS[current.definitionId]) ? current : s3bHistoricalEquipmentParent(state,roll.parentItemInstanceId,roll.roundId) ?? current)
      ?? state.resourceProvenance.entries.flatMap(f=>f.kind==='consumable-used'?f.record.affectedItems:f.kind==='augment-item-transform'?[f.input]:[]).find(i=>i.id===roll.parentItemInstanceId), round = roundIds.indexOf(roll.roundId);
    const converted=state.resourceProvenance.entries.find(e=>e.kind==='anger-item-converted'&&e.itemId===roll.parentItemInstanceId&&ROUND_CATALOG.find(r=>r.roundId===e.roundId)!.ordinal>=round+1);
    if(parent&&converted?.kind==='anger-item-converted')parent={...parent,definitionId:converted.from};
    if (!parent || !grantsTemporaryEquipment(ITEM_DEFINITIONS[parent.definitionId]) || ITEM_DEFINITIONS[parent.definitionId].slotCost !== 3
      || round < 0 || round < previousRound || roll.playerLevelSnapshot < MATCH_RULES.initialLevel || roll.playerLevelSnapshot > state.level) {
      throw new Error('Invalid equipment parent/round/level');
    }
    // T12 permits a new parent after settlement XP. Frozen combat parents are
    // separately bounded by the start level in restoreCombatInput.
    const startingLevel = round === 0 ? MATCH_RULES.initialLevel : state.roundResults[round - 1].levelAfter;
    const lastRollLevel = state.roundResults[round]?.levelAfter ?? state.level;
    if (roll.playerLevelSnapshot < startingLevel || roll.playerLevelSnapshot > lastRollLevel) {
      throw new Error('Invalid equipment round level');
    }
    previousRound = round;
  }
  validateTemporaryEquipment(state.temporaryEquipment, state.items.flatMap(parent => {
    const roll = equipmentRollFor(state.equipmentState.rolls,state.roundDefinitionId,parent,state);
    return roll ? [roll] : [];
  }));
  const expected = projectCurrent(state), actual = state.temporaryEquipment;
  if (actual.length !== expected.length || expected.some(child => !actual.some(other =>
    child.temporaryId === other.temporaryId && child.parentItemInstanceId === other.parentItemInstanceId
    && child.roundId === other.roundId && child.holderId === other.holderId && child.definitionId === other.definitionId
    && child.slot === other.slot && child.expiresAfterRoundId === other.expiresAfterRoundId))) {
    throw new Error('Invalid current temporary equipment projection');
  }
}
