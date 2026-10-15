import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { beforeAll, describe, expect, it } from 'vitest';
import { buyXp, combineItems, equipItem, nextRound } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import type { MatchState } from '../src/simulation/match-types';
import { initializeStreams, validateEquipmentState } from '../src/simulation/m8/equipment';
import { TEMPORARY_EQUIPMENT_POOL } from '../src/simulation/temporary-equipment';
import { BattleHistory, validateBattleCollection } from '../src/replay';
import { validateEnvelope } from '../src/persistence/format';
import type { SaveEnvelope } from '../src/m6/contracts';
import { accepted, emptyBoard } from './match-helpers';
import { publicEquipmentPreparation, finishPublicEquipmentBattle, resolvePublicEquipmentChoices as choices } from './fixtures/b8-public-equipment';

function start(equipped = true, history?: BattleHistory): MatchState {
  let state = publicEquipmentPreparation(['gloves', 'gloves'], { history });
  const gloves = state.items.filter(item => item.definitionId === 'gloves');
  const parent = `item-${state.nextItemSerial}`;
  state = accepted(combineItems(state, gloves[0].id, gloves[1].id));
  if (equipped) state = accepted(equipItem(state, parent, 'unit-1', 0));
  return emptyBoard(state);
}
function settle(state: MatchState, history?: BattleHistory): MatchState {
  return choices(finishPublicEquipmentBattle(state, history));
}
function historicalProgression(equipped = true, history?: BattleHistory): MatchState {
  let state = start(equipped,history);
  while (state.round < getCatalogRoundById('4-5').ordinal) {
    if (state.phase === 'preparation') state = settle(state, history);
    expect(state.phase).toBe('settlement');
    state = choices(accepted(nextRound(state, state.round)));
  }
  // T11: 6 opening XP + 18 * 2 XP = 42; cumulative level-six cost is 40.
  expect([state.level, state.xp]).toEqual([6, 2]);
  while (state.level < 7) state = accepted(buyXp(state));
  return state;
}
function rejectWithoutRepair(raw: MatchState): void {
  const before = JSON.stringify(raw);
  expect(() => restoreMatch(raw)).toThrow(/equipment.*level/);
  expect(() => restoreMatch(before)).toThrow(/equipment.*level/);
  expect(() => serializeMatch(raw)).toThrow(/equipment.*level/);
  expect(JSON.stringify(raw)).toBe(before);
}

describe('B5 audit R1: equipment roll level belongs to its round history', () => {
  const archiveHistory = new BattleHistory('b5-r1');
  let archivedState: MatchState;
  // Generate the public command/history fixture separately from its save assertions.
  beforeAll(() => { archivedState = historicalProgression(true, archiveHistory); });
  it('rejects a historical level5 roll forged as level7 with RNG-consistent two completed items', () => {
    const state = historicalProgression();
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const raw = structuredClone(state);
    expect(state.roundResults[getCatalogRoundById('2-1').ordinal-1]).toMatchObject({ levelBefore: 3, levelAfter: 3 });
    expect(raw.equipmentState.rolls[0]).toMatchObject({ playerLevelSnapshot: 5, children: ['bramble-vest', 'cloak'] });
    Object.assign(raw.equipmentState.rolls[0], { playerLevelSnapshot: 7, children: ['bramble-vest', 'adaptive-helm'] });
    // Same independently known two words; replaying RNG alone cannot detect the false historical level.
    expect(() => validateEquipmentState(raw.equipmentState, TEMPORARY_EQUIPMENT_POOL, initializeStreams(42).equipment)).not.toThrow();
    expect(raw.equipmentState.equipment).toEqual(state.equipmentState.equipment);
    expect(raw.temporaryEquipment).toEqual(state.temporaryEquipment);
    rejectWithoutRepair(raw);
  });
  it.each([['settled supply round', '4-4'], ['unsettled current round', '4-5']])(
    'rejects a roll below the previous settlement level in a %s', (_label, roundId) => {
      const state = historicalProgression();
      expect(restoreMatch(serializeMatch(state))).toEqual(state);
      const raw = structuredClone(state), roll = raw.equipmentState.rolls.find(r => r.roundId === roundId)!;
      expect(raw.roundResults[getCatalogRoundById('4-3').ordinal-1]).toMatchObject({ levelBefore: 5, levelAfter: 6 });
      expect(roll.playerLevelSnapshot).toBe(6);
      Object.assign(roll, { playerLevelSnapshot: 5 }); // Same low-level pool, unchanged pair/words.
      expect(() => validateEquipmentState(raw.equipmentState, TEMPORARY_EQUIPMENT_POOL, initializeStreams(42).equipment)).not.toThrow();
      rejectWithoutRepair(raw);
    });
  it('rejects a roll above even the T12 post-settlement levelAfter bound', () => {
    const state = historicalProgression();
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const raw = structuredClone(state);
    expect(raw.roundResults[getCatalogRoundById('3-6').ordinal-1]).toMatchObject({ levelBefore: 5, levelAfter: 5 });
    Object.assign(raw.equipmentState.rolls.find(r => r.roundId === '3-6')!, { playerLevelSnapshot: 6 });
    expect(() => validateEquipmentState(raw.equipmentState, TEMPORARY_EQUIPMENT_POOL, initializeStreams(42).equipment)).not.toThrow();
    rejectWithoutRepair(raw);
  });
  it('preserves a legal pre-F roll through current, settled and historical save/restore', () => {
    let state = historicalProgression();
    const roll = structuredClone(state.equipmentState.rolls.find(r => r.roundId === '4-5')!);
    expect(roll.playerLevelSnapshot).toBe(6); expect(state.level).toBe(7);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    state = settle(state);
    expect(state.roundResults[getCatalogRoundById('4-5').ordinal-1]).toMatchObject({ levelBefore: 7, levelAfter: 7 });
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    state = accepted(nextRound(state, state.round)); // 4-6 opens the real anomaly choice.
    expect(state.equipmentState.rolls.find(r => r.roundId === '4-5')).toEqual(roll);
    expect(state.equipmentState.rolls.at(-1)?.playerLevelSnapshot).toBe(7);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
  it('allows the first equip after same-round F at the upper bound, not only the starting level', () => {
    let state = historicalProgression(false);
    expect(state.equipmentState.rolls).toEqual([]);
    state = accepted(equipItem(state, state.items.find(item => item.definitionId === 'thiefs-gloves')!.id, 'unit-1', 0));
    expect(state.roundResults[getCatalogRoundById('4-4').ordinal-1].levelAfter).toBe(6);
    expect(state.equipmentState.rolls[0]).toMatchObject({ roundId: '4-5', playerLevelSnapshot: 7 });
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    state = settle(state);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
  it('validates round economy before consulting its level bounds for equipment', () => {
    const state = historicalProgression();
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const raw = structuredClone(state);
    Object.assign(raw.roundResults[getCatalogRoundById('2-1').ordinal-1], { levelAfter: 4 });
    expect(() => restoreMatch(raw)).toThrow(/history XP/);
  });
  describe('archived save envelope', () => {
    let envelope: SaveEnvelope;
    beforeAll(async () => {
      envelope = { kind: 'hex-autobattler-save', saveFormatVersion: 3, replayFormatVersion: 3,
        runId: 'b5-r1', createdAt: '2026-10-09T00:00:00.000Z', match: archivedState,
        battles: archiveHistory.completedRecords, currentBattle: null };
      // Fully validate the shared control before exercising the forged copy.
      await expect(validateEnvelope(envelope, validateBattleCollection)).resolves.toEqual(envelope);
    });
    it('rejects the forged historical level through full save-envelope validation without changing archived battles', async () => {
      expect(envelope.battles.map(battle => battle.context.roundDefinitionId))
        .toEqual(['1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-5', '2-6', '2-7', '3-1', '3-2', '3-3', '3-5', '3-6', '3-7', '4-1', '4-2', '4-3']);
      expect(envelope.battles.slice(0, 3).every(battle => battle.endTick > 0 && battle.events.length > 0)).toBe(true);
      expect(envelope.battles.find(b=>b.context.roundDefinitionId==='3-5')!.context.equipmentState.rolls[0].playerLevelSnapshot).toBe(5);
      const raw = structuredClone(envelope);
      Object.assign(raw.match.equipmentState.rolls[0], { playerLevelSnapshot: 7, children: ['bramble-vest', 'adaptive-helm'] });
      const before = JSON.stringify(raw);
      await expect(validateEnvelope(raw, validateBattleCollection)).rejects.toThrow(/equipment.*level/);
      expect(JSON.stringify(raw)).toBe(before);
    });
  });
});
