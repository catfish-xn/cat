// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { equipmentRollFor, validateLuckyGlovesEquipment } from '../augment-pool-batch5-g1-equipment';
import { s3bHistoricalEquipmentParent } from '../augment-pool-batch5-s3b-restore';
import { AUGMENT_BATCH5_G1 } from '../content/augment-pool-batch5-g1';
import { ITEM_DEFINITIONS } from '../content/g2-3-item-registry';
import { ROUND_CATALOG } from '../content/round-catalog';
import { initializeStreams, validateEquipmentState, validateTemporaryEquipment } from '../m8/equipment';
import { MATCH_RULES } from '../match-rules';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundByOrdinal } from '../multiplayer-round';
import { FINAL_ROUND } from '../round-schedule';
import { grantsTemporaryEquipment, projectCurrent, TEMPORARY_EQUIPMENT_POOL } from '../temporary-equipment';

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
