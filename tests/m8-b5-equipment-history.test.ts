import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { planPermanentItemGrant } from '../src/simulation/item-grants';
import { describe, expect, it } from 'vitest';
import { buyXp, combineItems, createMatch, equipItem, nextRound, selectChoice, startMatchCombat } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import type { MatchState } from '../src/simulation/match-types';
import type { CombatEvent } from '../src/simulation/combat';
import { initializeStreams, validateEquipmentState } from '../src/simulation/m8/equipment';
import { TEMPORARY_EQUIPMENT_POOL } from '../src/simulation/temporary-equipment';
import { BattleHistory, validateBattleCollection } from '../src/replay';
import { validateEnvelope } from '../src/persistence/format';
import type { SaveEnvelope } from '../src/m6/contracts';
import { accepted, emptyBoard } from './match-helpers';

function choices(input: MatchState): MatchState {
  let state = input;
  while (state.phase === 'choice') {
    const choice = state.pendingChoice!;
    state = accepted(selectChoice(state, choice.choiceId, choice.generation, choice.kind === 'component'
      ? 'gloves' : choice.offers.find(id => id !== 'placebo' && id !== 'glass-cannon-i')!));
  }
  return state;
}
function start(equipped = true, history?: BattleHistory): MatchState {
  let state = choices(createMatch(42));
  // Explicit IF-GRANT equipment fixture, never evidence for the absent B8 opening drops.
  for(let i=0;i<2;i++) {
    const granted=planPermanentItemGrant(state,{definitionId:'gloves',receiptId:`fixture-${i}`},[]);
    if(!granted.ok)throw new Error(granted.reason);state=granted.state;
  }
  while(state.roundDefinitionId!=='2-1') {state=settle(emptyBoard(state),history);state=choices(accepted(nextRound(state,state.round)));}
  state = accepted(combineItems(state, 'item-1', 'item-2'));
  if (equipped) state = accepted(equipItem(state, 'item-3', 'unit-1', 0));
  return emptyBoard(state);
}
function settle(state: MatchState, history?: BattleHistory): MatchState {
  const result = startMatchCombat(state), after = accepted(result);
  if (!result.ok) throw new Error(result.reason);
  history?.observe({ before: state, after, reason: 'command', events: result.events.filter((e): e is CombatEvent => e.domain === 'combat') });
  expect(after.phase).not.toBe('combat'); // Public empty-board concession, never injected results/resources.
  return choices(after);
}
function roundEight(equipped = true, history?: BattleHistory): MatchState {
  let state = start(equipped,history);
  while (state.round < getCatalogRoundById('3-1').ordinal) {
    if (state.phase === 'preparation') state = settle(state, history);
    expect(state.phase).toBe('settlement');
    state = choices(accepted(nextRound(state, state.round)));
  }
  expect(state.level).toBe(4);
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
  it('rejects a historical level3 roll forged as level7 with RNG-consistent two completed items', () => {
    const state = roundEight(), raw = structuredClone(state);
    expect(state.roundResults[getCatalogRoundById('2-1').ordinal-1]).toMatchObject({ levelBefore: 3, levelAfter: 3 });
    expect(raw.equipmentState.rolls[0]).toMatchObject({ playerLevelSnapshot: 3, children: ['bramble-vest', 'cloak'] });
    Object.assign(raw.equipmentState.rolls[0], { playerLevelSnapshot: 7, children: ['bramble-vest', 'adaptive-helm'] });
    // Same independently known two words; replaying RNG alone cannot detect the false historical level.
    expect(() => validateEquipmentState(raw.equipmentState, TEMPORARY_EQUIPMENT_POOL, initializeStreams(42).equipment)).not.toThrow();
    expect(raw.equipmentState.equipment).toEqual(state.equipmentState.equipment);
    expect(raw.temporaryEquipment).toEqual(state.temporaryEquipment);
    rejectWithoutRepair(raw);
  });
  it.each([['settled supply round', '2-4'], ['unsettled current round', '3-1']])(
    'rejects a roll below the previous settlement level in a %s', (_label, roundId) => {
      const raw = structuredClone(roundEight()), roll = raw.equipmentState.rolls.find(r => r.roundId === roundId)!;
      expect(raw.roundResults[getCatalogRoundById('2-3').ordinal-1]).toMatchObject({ levelBefore: 3, levelAfter: 4 });
      expect(roll.playerLevelSnapshot).toBe(4);
      Object.assign(roll, { playerLevelSnapshot: 3 }); // Same low-level pool, unchanged pair/words.
      expect(() => validateEquipmentState(raw.equipmentState, TEMPORARY_EQUIPMENT_POOL, initializeStreams(42).equipment)).not.toThrow();
      rejectWithoutRepair(raw);
    });
  it('uses levelBefore rather than passive levelAfter as the settled-round upper bound', () => {
    const raw = structuredClone(roundEight());
    expect(raw.roundResults[getCatalogRoundById('2-3').ordinal-1]).toMatchObject({ levelBefore: 3, levelAfter: 4 });
    Object.assign(raw.equipmentState.rolls.find(r => r.roundId === '2-3')!, { playerLevelSnapshot: 4 });
    expect(() => validateEquipmentState(raw.equipmentState, TEMPORARY_EQUIPMENT_POOL, initializeStreams(42).equipment)).not.toThrow();
    rejectWithoutRepair(raw);
  });
  it('preserves a legal pre-F roll through current, settled and historical save/restore', () => {
    let state = roundEight();
    const roll = structuredClone(state.equipmentState.rolls.find(r => r.roundId === '3-1')!);
    expect(roll.playerLevelSnapshot).toBe(4); expect(state.level).toBe(7);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    state = settle(state);
    expect(state.roundResults[getCatalogRoundById('3-1').ordinal-1]).toMatchObject({ levelBefore: 7, levelAfter: 7 });
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    state = choices(accepted(nextRound(state, state.round)));
    expect(state.equipmentState.rolls.find(r => r.roundId === '3-1')).toEqual(roll);
    expect(state.equipmentState.rolls.at(-1)?.playerLevelSnapshot).toBe(7);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
  it('allows the first equip after same-round F at the upper bound, not only the starting level', () => {
    let state = roundEight(false);
    expect(state.equipmentState.rolls).toEqual([]);
    state = accepted(equipItem(state, 'item-3', 'unit-1', 0));
    expect(state.roundResults[getCatalogRoundById('2-7').ordinal-1].levelAfter).toBe(4);
    expect(state.equipmentState.rolls[0]).toMatchObject({ roundId: '3-1', playerLevelSnapshot: 7 });
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    state = settle(state);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
  it('validates round economy before consulting its level bounds for equipment', () => {
    const raw = structuredClone(roundEight());
    Object.assign(raw.roundResults[getCatalogRoundById('2-1').ordinal-1], { levelAfter: 4 });
    expect(() => restoreMatch(raw)).toThrow(/history XP/);
  });
  it('rejects the forged historical level through full save-envelope validation without changing archived battles', async () => {
    const history = new BattleHistory('b5-r1'), state = roundEight(true, history);
    const envelope: SaveEnvelope = { kind: 'hex-autobattler-save', saveFormatVersion: 1, replayFormatVersion: 1,
      runId: 'b5-r1', createdAt: '2026-10-09T00:00:00.000Z', match: state, battles: history.completedRecords, currentBattle: null };
    await expect(validateEnvelope(envelope, validateBattleCollection)).resolves.toEqual(envelope);
    expect(envelope.battles.find(b=>b.context.roundDefinitionId==='2-1')!.context.equipmentState.rolls[0].playerLevelSnapshot).toBe(3);
    const raw = structuredClone(envelope);
    Object.assign(raw.match.equipmentState.rolls[0], { playerLevelSnapshot: 7, children: ['bramble-vest', 'adaptive-helm'] });
    const before = JSON.stringify(raw);
    await expect(validateEnvelope(raw, validateBattleCollection)).rejects.toThrow(/equipment.*level/);
    expect(JSON.stringify(raw)).toBe(before);
  });
});
