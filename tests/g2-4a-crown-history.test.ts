import { describe, expect, it } from 'vitest';
import { createMatch, deployMatchUnit, equipItem, nextRound, sellUnit, useConsumable, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { createG23Progress, validateG23Progress } from '../src/simulation/g2-3-match-progress';
import { advanceG23Economy } from '../src/simulation/g2-3-economy';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { TACTICIANS_CROWN_ID } from '../src/simulation/deployment-cap';
import { validateBattleCollectionSync, validateBattleCollection, validateBattleRecord } from '../src/replay/history';
import { validateEnvelope, validateFile, exportFile } from '../src/persistence/format';
import { readCompatibility } from '../src/persistence/compatibility';
import { M8_VERSION } from '../src/simulation/m8/version';
import type { BattleRecord, SaveEnvelope } from '../src/m6/contracts';
import { accepted, resolveM5Choices } from './match-helpers';
import { validateMatchStructure } from '../src/simulation/serialization-structure';
import { recordedCrownBattle } from './crown-history-helpers';

const envelope = (match: MatchState, battles: readonly BattleRecord[]): SaveEnvelope => ({
  kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion,
  replayFormatVersion: M8_VERSION.replayFormatVersion, runId: 'crown-history',
  createdAt: '2026-10-17T00:00:00.000Z', match, battles, currentBattle: null,
});
const advance = (state: MatchState) => {
  const settled = resolveM5Choices(state);
  return accepted(nextRound(settled, settled.round));
};
function forgedHistory() {
  const live = recordedCrownBattle(createMatch(42)), state = advance(live.state);
  expect(state.items.some(item => item.definitionId === TACTICIANS_CROWN_ID)).toBe(false);
  const first = readG23Progress(state)!.economyReceipts[0];
  if (first.kind !== 'battle') throw new Error('Expected public first battle');
  const progress = advanceG23Economy(createG23Progress(42), { ...first.facts, crowns: 84 }).progress;
  const action = progress.economyReceipts[0];
  if (action.kind !== 'battle') throw new Error('Expected forged battle');
  expect(action.crownGold).toBe(5);
  // Deliberately keep every claimed RNG draw, amount and receipt self-consistent.
  const forged = writeG23Progress(structuredClone(state), progress);
  Object.assign(forged, { gold: forged.gold + action.crownGold! });
  Object.assign(forged.seatMechanics!, { receipts: [...forged.seatMechanics!.receipts,
    { receiptId: 'g23:crown:round-1', round: 1, roundId: live.state.roundDefinitionId,
      source: 'tacticians-crown', kind: 'gold', amount: 5 }] });
  expect(() => validateG23Progress(readG23Progress(forged)!, 42, forged.round)).not.toThrow();
  return { forged, live, state };
}

describe('M1 crown history authority', () => {
  it('rejects the crowns:84/+5 coordinated forgery in text and object restoration, with or without genuine history', () => {
    const { forged, live } = forgedHistory();
    for (const input of [forged, JSON.stringify(forged)]) {
      expect(() => restoreMatch(input)).toThrow(/缺少冠冕历史证据/);
      expect(() => restoreMatch(input, live.battles)).toThrow(/历史经济收据/);
    }
  });
  it('rejects the unchanged genuine replay collection paired with the forgery, synchronously and asynchronously', async () => {
    const { forged, live } = forgedHistory(), file = envelope(forged, live.battles);
    expect(() => validateBattleCollectionSync(file)).toThrow(/历史经济收据/);
    await expect(validateBattleCollection(file)).rejects.toThrow(/历史经济收据/);
    expect(readCompatibility(file).canResume).toBe(false);
    // Even an accidental no-op caller callback cannot bypass the mandatory checks.
    await expect(validateEnvelope(file, () => {})).rejects.toThrow(/历史经济收据/);
    await expect(validateFile(exportFile(file), () => {})).rejects.toThrow(/历史经济收据/);
  });
  it('does not let a later record context authorize its own forged historical prefix', () => {
    const { forged, live } = forgedHistory();
    const second = recordedCrownBattle(forged, live.history);
    expect(() => restoreMatch(second.state, second.battles)).toThrow(/历史经济收据/);
    expect(() => validateBattleRecord(second.battles[1])).toThrow(/缺少冠冕历史证据/);
    expect(() => validateBattleRecord(second.battles[1], [second.battles[0]])).toThrow(/历史经济收据/);
  });
  it('accepts the public-command no-crown control and resumes identically', () => {
    const { live, state } = forgedHistory();
    const restored = restoreMatch(serializeMatch(state, live.battles), live.battles);
    expect(restored).toEqual(state);
    expect(recordedCrownBattle(restored).state).toEqual(recordedCrownBattle(state).state);
  });
  it.each([1, 42])('restores and continues a legal provenance-backed crown control, seed %i', async seed => {
    let opening = createMatch(seed);
    const holder = opening.preparation.units.find(unit => unit.team === 'player')!;
    for (let slot = 0; slot < 3; slot++) {
      opening = accepted(grantMechanicItem(opening, { receiptId: `crown-control:${slot}`, source: 'test', definitionId: TACTICIANS_CROWN_ID }));
      opening = accepted(equipItem(opening, opening.items.at(-1)!.id, holder.id, slot));
    }
    const first = recordedCrownBattle(opening), state = advance(first.state);
    expect(() => restoreMatch(state)).toThrow(/缺少冠冕历史证据/);
    expect(() => restoreMatch(state, [])).toThrow(/缺少历史证据/);
    const text = serializeMatch(state, first.battles);
    const restored = restoreMatch(text, first.battles);
    expect(restored).toEqual(state);
    expect(restoreMatch(structuredClone(state), first.battles)).toEqual(state);
    expect((await validateFile(exportFile(envelope(state, first.battles)), validateBattleCollection)).match).toEqual(state);
    const originalNext = recordedCrownBattle(state, first.history);
    expect(recordedCrownBattle(restored).state).toEqual(originalNext.state);
    const nextRestored = restoreMatch(JSON.stringify(originalNext.state), originalNext.battles);
    expect(nextRestored).toEqual(originalNext.state);
    expect(validateBattleRecord(originalNext.battles[1], [originalNext.battles[0]]).settledMatch).toEqual(originalNext.state);
    expect(stepMatch(nextRestored)).toEqual(stepMatch(originalNext.state));
    const broken = structuredClone(first.battles);
    Object.assign(broken[0].context, { resourceProvenance: createMatch(seed).resourceProvenance });
    expect(() => restoreMatch(state, broken)).toThrow();
  });
});

function transferFixture(definitionId = TACTICIANS_CROWN_ID) {
  let opening = createMatch(7);
  const holder = opening.preparation.units.find(unit => unit.team === 'player')!;
  for (let slot = 0; slot < 3; slot++) {
    opening = accepted(grantMechanicItem(opening, {receiptId:`transfer:${slot}`,source:'test',definitionId}));
    opening = accepted(equipItem(opening, opening.items.at(-1)!.id, holder.id, slot));
  }
  const first = recordedCrownBattle(opening);
  let state = advance(first.state);
  // Loot supplies unit-2 in seed 7. Move the original holder to the bench.
  const target = state.preparation.units.find(unit => unit.team === 'player' && unit.id !== holder.id)!;
  state = accepted(deployMatchUnit(state, holder.id, {kind:'bench',slot:8}));
  state = accepted(deployMatchUnit(state, target.id, holder.location));
  return {first, state, holder, target};
}

describe('M2 equipment binding continuity', () => {
  it('rejects seed 7 cross-round crown transfer despite self-consistent production replay and rewards', async () => {
    const {first,state,holder,target} = transferFixture();
    const crownIds = state.items.filter(item => item.definitionId === TACTICIANS_CROWN_ID).map(item => item.id);
    expect(holder.id).toBe('unit-1'); expect(target.id).toBe('unit-2');
    expect(equipItem(state, crownIds[0], target.id, 0)).toMatchObject({ok:false,reason:'item-not-inventory'});
    const control = recordedCrownBattle(state, first.history);
    for (const input of [control.state, JSON.stringify(control.state)]) expect(restoreMatch(input, control.battles)).toEqual(control.state);
    const forged = {...state,items:state.items.map(item => crownIds.includes(item.id)
      ? {...item,location:{kind:'unit' as const,unitId:target.id,slot:item.location.kind === 'unit' ? item.location.slot : 0}} : item)};
    // A genuine first record plus a freshly generated, internally valid second record.
    const running = accepted(startMatchCombat(forged));
    for (const input of [running,JSON.stringify(running)])
      expect(() => restoreMatch(input,first.battles)).toThrow('historical opening equipment continuation');
    const second = recordedCrownBattle(forged);
    const battles = [...first.battles, ...second.battles];
    expect(() => validateMatchStructure(second.state)).not.toThrow();
    expect(readG23Progress(second.state)!.rngDraws - readG23Progress(control.state)!.rngDraws).toBe(3);
    expect(second.state.gold - control.state.gold).toBe(1);
    for (const candidate of [forged, second.state, advance(second.state)]) {
      const history = candidate === forged ? first.battles : battles;
      for (const input of [candidate, JSON.stringify(candidate)])
        expect(() => restoreMatch(input, history)).toThrow('historical equipment continuation');
    }
    expect(() => validateBattleCollectionSync(envelope(second.state,battles))).toThrow('historical equipment continuation');
    await expect(validateBattleCollection(envelope(second.state,battles))).rejects.toThrow('historical equipment continuation');
    expect(() => validateBattleRecord(second.battles[0],first.battles)).toThrow('historical equipment continuation');
  });
  it.each(['sale','remover','upgrade'] as const)('accepts legal %s and subsequent re-equipping', kind => {
    const {first,state,holder,target} = transferFixture();
    let legal = state;
    if (kind === 'sale') legal = accepted(sellUnit(legal,holder.id));
    else if (kind === 'remover') {
      const remover = legal.consumables.find(tool => tool.definitionId === 'magnetic-remover')!;
      expect(remover).toBeDefined();
      legal = accepted(useConsumable(legal,remover.consumableId,{kind:'unit',unitId:holder.id}));
    } else {
      for (let i = 0; i < 2; i++) legal = accepted(grantMechanicUnit(legal,
        {receiptId:`upgrade:${i}`,source:'test',definitionId:holder.definitionId}));
      expect(legal.preparation.units.some(unit => unit.id === holder.id)).toBe(false);
      expect(legal.items.filter(item => item.definitionId === TACTICIANS_CROWN_ID)
        .every(item => item.location.kind === 'unit' && item.location.unitId !== holder.id)).toBe(true);
    }
    for (const item of legal.items.filter(item => item.definitionId === TACTICIANS_CROWN_ID && item.location.kind === 'inventory')) {
      const slot = legal.items.filter(other => other.location.kind === 'unit' && other.location.unitId === target.id).length;
      legal = accepted(equipItem(legal,item.id,target.id,slot));
    }
    for (const input of [legal,JSON.stringify(legal)]) expect(restoreMatch(input,first.battles)).toEqual(legal);
    const second = recordedCrownBattle(legal);
    expect(restoreMatch(second.state,[...first.battles,...second.battles])).toEqual(second.state);
  });
  it('also rejects moving a non-crown equipped instance', () => {
    const {first,state,target} = transferFixture('deathblade');
    const item = state.items.find(item => item.location.kind === 'unit')!;
    const forged = {...state,items:state.items.map(value => value.id === item.id
      ? {...value,location:{kind:'unit' as const,unitId:target.id,slot:0}} : value)};
    expect(() => restoreMatch(forged,first.battles)).toThrow('historical equipment continuation');
  });
});
