import { prepareInput, copyInput } from './fixtures/prepared-input';
import { deepStrictEqual } from 'node:assert/strict';
import { beforeAll, describe, expect, it } from 'vitest';
import { createMatch, buyUnit, rerollShop, selectChoice, buyXp, combineItems, deployMatchUnit, equipItem, nextRound, sellUnit, useConsumable, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { createG23Progress, validateG23Progress } from '../src/simulation/g2-3-match-progress';
import { advanceG23Economy } from '../src/simulation/g2-3-economy';
import { grantMechanicGold, grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { TACTICIANS_CROWN_ID } from '../src/simulation/deployment-cap';
import { BattleHistory, validateBattleCollectionSync, validateBattleCollection, validateBattleRecord } from '../src/replay/history';
import { validateEnvelope, validateFile, exportFile } from '../src/persistence/format';
import { readCompatibility } from '../src/persistence/compatibility';
import { M8_VERSION } from '../src/simulation/m8/version';
import type { BattleRecord, SaveEnvelope } from '../src/m6/contracts';
import { accepted, resolveM5Choices } from './match-helpers';
import { validateMatchStructure } from '../src/simulation/serialization-structure';
import { validateMatchHistory } from '../src/simulation/battle-record-validation';
import { recordedCrownBattle } from './crown-history-helpers';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

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
      expect(() => restoreMatch(input)).toThrow('Invalid Match save: missing historical evidence / 缺少冠冕、猎头者、家人或梅尔历史证据，请提供完整 battles 回放');
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
    expect(() => validateBattleRecord(second.battles[1])).toThrow('Invalid Match save: missing historical evidence / 缺少冠冕、猎头者、家人或梅尔历史证据，请提供完整 battles 回放');
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
    expect(() => restoreMatch(state)).toThrow('Invalid Match save: missing historical evidence / 缺少冠冕、猎头者、家人或梅尔历史证据，请提供完整 battles 回放');
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
  let opening = resolveM5Choices(createMatch(109897));
  const holder = opening.preparation.units.find(unit => unit.team === 'player')!;
  for (let slot = 0; slot < 3; slot++) {
    opening = accepted(grantMechanicItem(opening, {receiptId:`transfer:${slot}`,source:'test',definitionId}));
    opening = accepted(equipItem(opening, opening.items.at(-1)!.id, holder.id, slot));
  }
  const first = recordedCrownBattle(opening);
  let state = advance(first.state);
  // The independent v17 oracle supplies Maddie/Lux in seed 5. Move the original holder to the bench.
  const target = state.preparation.units.find(unit => unit.team === 'player' && unit.id !== holder.id)!;
  state = accepted(deployMatchUnit(state, holder.id, {kind:'bench',slot:8}));
  state = accepted(deployMatchUnit(state, target.id, holder.location));
  return {first, state, holder, target};
}

describe('M2 equipment binding continuity', () => {
  it('rejects seed 109897 cross-round crown transfer despite self-consistent production replay and rewards', async () => {
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
    expect(() => serializeMatch(running,first.battles)).toThrow('historical opening equipment continuation');
    for (const input of [running,JSON.stringify(running)])
      expect(() => restoreMatch(input,first.battles)).toThrow('historical opening equipment continuation');
    const second = recordedCrownBattle(forged);
    const battles = [...first.battles, ...second.battles];
    expect(() => validateMatchStructure(second.state)).not.toThrow();
    expect(readG23Progress(second.state)!.rngDraws - readG23Progress(control.state)!.rngDraws).toBe(3);
    expect(second.state.gold - control.state.gold).toBe(1);
    for (const candidate of [forged, second.state, advance(second.state)]) {
      const history = candidate === forged ? first.battles : battles;
      expect(() => serializeMatch(candidate, history)).toThrow('historical equipment continuation');
      for (const input of [candidate, JSON.stringify(candidate)])
        expect(() => restoreMatch(input, history)).toThrow('historical equipment continuation');
    }
    expect(() => validateBattleCollectionSync(envelope(second.state,battles))).toThrow('historical equipment continuation');
    await expect(validateBattleCollection(envelope(second.state,battles))).rejects.toThrow('historical equipment continuation');
    expect(() => validateBattleRecord(second.battles[0],first.battles)).toThrow('historical equipment continuation');
  });
  it.each(['sale','remover','upgrade','upgrade-remover-equip','combine-equip'] as const)('accepts legal %s and subsequent re-equipping', kind => {
    const {first,state,holder,target} = transferFixture();
    let legal = state;
    if (kind === 'upgrade-remover-equip') {
      legal = accepted(grantMechanicItem(legal,{receiptId:'spare-blade',source:'test',definitionId:'deathblade'}));
    }
    if (kind === 'combine-equip') {
      const swords: string[] = [];
      for (let i = 0; i < 2; i++) {
        legal = accepted(grantMechanicItem(legal,{receiptId:`sword:${i}`,source:'test',definitionId:'sword'}));
        swords.push(legal.items.at(-1)!.id);
      }
      legal = accepted(combineItems(legal,swords[0],swords[1]));
      legal = accepted(equipItem(legal,legal.items.find(item => item.definitionId === 'deathblade')!.id,target.id,0));
    } else if (kind === 'sale') legal = accepted(sellUnit(legal,holder.id));
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
      if (kind === 'upgrade-remover-equip') {
        expect(legal.items.find(item => item.definitionId === 'deathblade')!.location).toEqual({kind:'inventory'});
        const crowns = legal.items.filter(item => item.definitionId === TACTICIANS_CROWN_ID);
        expect(crowns.map(item => item.location)).toEqual([0,1,2].map(slot => ({kind:'unit',unitId:'unit-3',slot})));
        const remover = legal.consumables.find(tool => tool.definitionId === 'magnetic-remover')!;
        legal = accepted(useConsumable(legal,remover.consumableId,{kind:'unit',unitId:'unit-3'}));
        legal = accepted(equipItem(legal,legal.items.find(item => item.definitionId === 'deathblade')!.id,'unit-3',0));
        expect(legal.items.filter(item => item.definitionId === TACTICIANS_CROWN_ID).map(item => item.location))
          .toEqual(crowns.map(() => ({kind:'inventory'})));
      }
    }
    for (const item of legal.items.filter(item => kind !== 'upgrade-remover-equip' && item.definitionId === TACTICIANS_CROWN_ID && item.location.kind === 'inventory')) {
      const slot = legal.items.filter(other => other.location.kind === 'unit' && other.location.unitId === target.id).length;
      legal = accepted(equipItem(legal,item.id,target.id,slot));
    }
    const text = serializeMatch(legal,first.battles);
    for (const input of [legal,text]) {
      const restored = restoreMatch(input,first.battles);
      expect(restored).toEqual(legal);
      const originalStep = startMatchCombat(legal), restoredStep = startMatchCombat(restored);
      expect(restoredStep).toEqual(originalStep);
      let original = accepted(originalStep), resumed = accepted(restoredStep);
      while (original.phase === 'combat') {
        const expected = stepMatch(original), actual = stepMatch(resumed);
        expect(actual.events).toEqual(expected.events);
        expect(actual.state).toEqual(expected.state);
        original = expected.state; resumed = actual.state;
      }
    }
    const second = recordedCrownBattle(legal);
    expect(restoreMatch(second.state,[...first.battles,...second.battles])).toEqual(second.state);
  });
  it.each(['before-upgrade','after-upgrade'] as const)('replays survivor equipment %s in exact order (M4)', order => {
    const {first,state,holder} = transferFixture();
    let legal = accepted(grantMechanicItem(state,{receiptId:'m4:blade',source:'test',definitionId:'deathblade'}));
    const bladeId=legal.items.at(-1)!.id; // Opening anvils have earlier legitimate item births.
    legal = accepted(grantMechanicUnit(legal,{receiptId:'m4:first',source:'test',definitionId:'irelia'}));
    expect(holder.definitionId).toBe('irelia');
    const equip = (value: MatchState) => accepted(equipItem(value,bladeId,'unit-3',0));
    if (order === 'before-upgrade') legal = equip(legal);
    legal = accepted(grantMechanicUnit(legal,{receiptId:'m4:second',source:'test',definitionId:'irelia'}));
    expect(legal.resourceProvenance.entries.find(fact => fact.kind === 'unit-upgraded')).toMatchObject({
      event:{survivorId:'unit-3',consumedIds:['unit-1','unit-4']},
    });
    if (order === 'after-upgrade') {
      const remover = legal.consumables.find(tool => tool.definitionId === 'magnetic-remover')!;
      legal = accepted(useConsumable(legal,remover.consumableId,{kind:'unit',unitId:'unit-3'}));
      legal = equip(legal);
    }
    expect(legal.items.find(item => item.id === bladeId)!.location).toEqual({kind:'unit',unitId:'unit-3',slot:0});
    if (order === 'before-upgrade') expect(legal.items.filter(item => item.definitionId === TACTICIANS_CROWN_ID).map(item => item.location))
      .toEqual([{kind:'unit',unitId:'unit-3',slot:1},{kind:'unit',unitId:'unit-3',slot:2},{kind:'inventory'}]);
    const text = serializeMatch(legal,first.battles);
    for (const input of [structuredClone(legal),text]) {
      const restored = restoreMatch(input,first.battles);
      expect(restored).toEqual(legal);
      let original = accepted(startMatchCombat(legal)), resumed = accepted(startMatchCombat(restored));
      expect(resumed).toEqual(original);
      while (original.phase === 'combat') {
        const expected = stepMatch(original), actual = stepMatch(resumed);
        expect(actual).toEqual(expected);
        original = expected.state; resumed = actual.state;
      }
    }
    if (order === 'after-upgrade') {
      for (const change of ['holder','slot'] as const) {
        const forged = structuredClone(legal);
        const removal = forged.resourceProvenance.entries.find(fact => fact.kind === 'consumable-used');
        if (removal?.kind !== 'consumable-used') throw new Error('Expected remover receipt');
        Object.assign(removal.record.affectedItems[0].location, change === 'holder' ? {unitId:'unit-2'} : {slot:2});
        expect(() => serializeMatch(forged,first.battles)).toThrow();
        for (const input of [forged,JSON.stringify(forged)]) expect(() => restoreMatch(input,first.battles)).toThrow();
      }
    }
    // A legacy ledger without ordered equipment evidence is deliberately unsupported.
    const legacy = structuredClone(legal);
    Reflect.deleteProperty(legacy.resourceProvenance,'equipmentHistory');
    expect(() => serializeMatch(legacy,first.battles)).toThrow('Invalid resource provenance: ordered equipment history required');
    for (const input of [legacy,JSON.stringify(legacy)]) expect(() => restoreMatch(input,first.battles)).toThrow('Invalid resource provenance: ordered equipment history required');
    // Dropping the equip fact while retaining the new format must not infer a placement.
    const missing = {...legal,resourceProvenance:{...legal.resourceProvenance,entries:legal.resourceProvenance.entries
      .filter(fact => !(fact.kind === 'item-equipped' && fact.itemId === 'item-5'))
      .map((fact,sequence) => ({...fact,sequence}))}};
    expect(() => serializeMatch(missing,first.battles)).toThrow();
    for (const input of [missing,JSON.stringify(missing)]) expect(() => restoreMatch(input,first.battles)).toThrow();
  });
  it('also rejects moving a non-crown equipped instance', () => {
    const {first,state,target} = transferFixture('deathblade');
    const item = state.items.find(item => item.location.kind === 'unit')!;
    const forged = {...state,items:state.items.map(value => value.id === item.id
      ? {...value,location:{kind:'unit' as const,unitId:target.id,slot:0}} : value)};
    expect(() => serializeMatch(forged,first.battles)).toThrow('historical equipment continuation');
    for (const input of [forged,JSON.stringify(forged)])
      expect(() => restoreMatch(input,first.battles)).toThrow('historical equipment continuation');
  });
});


describe('M5/M6 ordered equipment across the first battle', () => {
  function openingWithBlade() {
    return accepted(grantMechanicItem(createMatch(7), {receiptId:'m5:blade',source:'test',definitionId:'deathblade'}));
  }
  function checkNextTicks(state: MatchState, restored: MatchState) {
    let original = accepted(startMatchCombat(advance(state)));
    let resumed = accepted(startMatchCombat(advance(restored)));
    expect(resumed).toEqual(original);
    while (original.phase === 'combat') {
      const expected = stepMatch(original), actual = stepMatch(resumed);
      expect(actual).toEqual(expected);
      original = expected.state; resumed = actual.state;
    }
  }
  it('replays combat equip before settlement, restores through all three entries and continues tick for tick', () => {
    const opening = openingWithBlade(), history = new BattleHistory('crown-history');
    let state = opening;
    const commit = (result: ReturnType<typeof startMatchCombat> | ReturnType<typeof stepMatch>, reason: 'command' | 'tick') => {
      const before = state;
      if ('ok' in result && !result.ok) throw new Error(result.reason);
      state = result.state;
      history.observe({before,after:state,events:result.events.filter(event => event.domain === 'combat'),reason});
    };
    commit(startMatchCombat(state), 'command');
    commit(stepMatch(state), 'tick');
    commit(equipItem(state, 'item-1', 'unit-1', 0), 'command');
    const prefix = history.capturePrefix()!;
    expect(prefix.equipmentCommands).toEqual([{tick:1,itemId:'item-1',unitId:'unit-1',slot:0}]);
    expect(validateBattleRecord(prefix, []).settledMatch).toEqual(state);
    while (state.phase === 'combat') commit(stepMatch(state), 'tick');
    const battles = history.completedRecords;
    expect(validateBattleRecord(battles[0], []).settledMatch).toEqual(state);
    const text = serializeMatch(state, battles);
    for (const input of [state, text]) {
      const restored = restoreMatch(input, battles);
      expect(restored).toEqual(state);
      checkNextTicks(state, restored);
    }
    const omitted = structuredClone(battles);
    Object.assign(omitted[0], {equipmentCommands:[]});
    expect(() => restoreMatch(state, omitted)).toThrow();
    const mistimed = structuredClone(battles);
    Object.assign(mistimed[0].equipmentCommands![0], {tick:mistimed[0].endTick});
    // Moving the command removes its next-tick combat effect, so exact event replay
    // rejects it before the later post-settlement command boundary check.
    expect(() => restoreMatch(state, mistimed)).toThrow('战斗档案无效：事件缺失或内容错误');
  });
  it('rejects a claimed pre-first-battle equip left in inventory, with or without an empty history', () => {
    const state = openingWithBlade();
    const forged = {...state,resourceProvenance:{...state.resourceProvenance,entries:[...state.resourceProvenance.entries,
      {kind:'item-equipped' as const,itemId:'item-1',unitId:'unit-1',slot:0,
        sequence:state.resourceProvenance.entries.length,roundId:state.roundDefinitionId}]}};
    for (const battles of [undefined, []]) {
      expect(() => serializeMatch(forged, battles)).toThrow('historical equipment continuation');
      for (const input of [forged, JSON.stringify(forged)])
        expect(() => restoreMatch(input, battles)).toThrow('historical equipment continuation');
    }
    const first = recordedCrownBattle(forged);
    expect(() => serializeMatch(first.state,first.battles)).toThrow('historical equipment continuation');
    for (const input of [first.state,JSON.stringify(first.state)])
      expect(() => restoreMatch(input,first.battles)).toThrow('historical equipment continuation');
    expect(() => validateBattleRecord(first.battles[0], [])).toThrow('historical equipment continuation');
  });
  it('accepts legal pre-first-battle equipment and validates the first opening prefix', () => {
    const state = accepted(equipItem(openingWithBlade(), 'item-1', 'unit-1', 0));
    for (const battles of [undefined, []]) {
      const text = serializeMatch(state, battles);
      for (const input of [state,text]) expect(restoreMatch(input,battles)).toEqual(state);
    }
    const first = recordedCrownBattle(state);
    const text = serializeMatch(first.state,first.battles);
    for (const input of [first.state,text]) {
      const restored = restoreMatch(input,first.battles);
      expect(restored).toEqual(first.state);
      checkNextTicks(first.state,restored);
    }
  });
});

describe('M7/S7 combat equipment command replay', () => {
  function recorder(context: MatchState, history = new BattleHistory('crown-history')) {
    let state = context;
    const commit = (result: ReturnType<typeof startMatchCombat> | ReturnType<typeof stepMatch>, reason: 'command' | 'tick') => {
      const before = state;
      if ('ok' in result && !result.ok) throw new Error(result.reason);
      state = result.state;
      // MatchSession forwards combat events only; resource facts identify equips.
      history.observe({before,after:state,events:result.events.filter(event => event.domain === 'combat'),reason});
    };
    commit(startMatchCombat(state), 'command');
    return {
      get state() { return state; }, history, commit,
      finish() {
        while (state.phase === 'combat') commit(stepMatch(state), 'tick');
        return {state,battles:history.completedRecords};
      },
    };
  }
  function grantBlades(state: MatchState, count: number) {
    for (let i = 0; i < count; i++) state = accepted(grantMechanicItem(state,
      {receiptId:`s7:blade:${i}`,source:'test',definitionId:'deathblade'}));
    return state;
  }
  function roundTrip(state: MatchState, battles: readonly BattleRecord[]) {
    const text = serializeMatch(state,battles);
    const restored = [restoreMatch(structuredClone(state),battles),restoreMatch(text,battles)];
    for (const value of restored) expect(value).toEqual(state);
    return restored;
  }
  function rejectAll(state: MatchState, battles: readonly BattleRecord[], reason?: string) {
    for (const entry of [() => serializeMatch(state,battles),
      () => restoreMatch(structuredClone(state),battles), () => restoreMatch(JSON.stringify(state),battles)]) {
      if (reason) expect(entry).toThrow(reason);
      else expect(entry).toThrow();
    }
  }
  // Every restored copy is compared with one original continuation; strict deep
  // equality per tick keeps the full-state check without Vitest's slower matcher.
  const continuations = new WeakMap<MatchState, { start: MatchState; steps: ReturnType<typeof stepMatch>[] }>();
  function continuation(state: MatchState) {
    let cached = continuations.get(state);
    if (!cached) {
      const start = accepted(startMatchCombat(resolveM5Choices(advance(state)))), steps: ReturnType<typeof stepMatch>[] = [];
      for (let current = start; current.phase === 'combat';) { const step = stepMatch(current); steps.push(step); current = step.state; }
      continuations.set(state, cached = { start, steps });
    }
    return cached;
  }
  function nextBattleMatches(state: MatchState, restored: MatchState) {
    const original = continuation(state);
    let resumed = accepted(startMatchCombat(resolveM5Choices(advance(restored))));
    deepStrictEqual(resumed, original.start);
    for (const expected of original.steps) {
      expect(resumed.phase).toBe('combat');
      const actual = stepMatch(resumed);
      deepStrictEqual(actual, expected);
      resumed = actual.state;
    }
    expect(resumed.phase).not.toBe('combat');
  }
  function swords(seed=7) {
    let state = createMatch(seed);
    for (let i = 0; i < 2; i++) state = accepted(grantMechanicItem(state,
      {receiptId:`m8:sword:${i}`,source:'test',definitionId:'sword'}));
    return state;
  }
  function timedEquipment(kind: 'ordinary' | 'in-place' | 'inventory', tick = 1) {
    const opening = kind === 'ordinary' ? grantBlades(createMatch(7),1)
      : kind === 'in-place' ? accepted(equipItem(swords(),'item-1','unit-1',0)) : swords();
    const live = recorder(opening);
    while (live.state.combat!.tick < tick) live.commit(stepMatch(live.state),'tick');
    live.commit(kind === 'inventory' ? combineItems(live.state,'item-1','item-2')
      : equipItem(live.state,kind === 'ordinary' ? 'item-1' : 'item-2','unit-1',0),'command');
    return live.finish();
  }
  type ConsumableScenario = 'remove' | 'reequip' | 'combine' | 'component' | 'completed';
  let reforgerOpening: {state: MatchState; battles: readonly BattleRecord[]} | undefined;
  function recordedReforgerOpening() {
    if (reforgerOpening) return reforgerOpening;
    // Same public seed-26 acquisition route as r3r4-public, with every battle
    // recorded so the candidate must pass complete history admission.
    let state = createMatch(27566);
    const history = new BattleHistory('crown-history');
    while (state.round <= 10) {
      while (state.phase === 'choice') {
        const choice = state.pendingChoice!;
        state = accepted(selectChoice(state,choice.choiceId,choice.generation,
          choice.offers.find(id => id === 'bulky-buddies-i') ?? choice.offers[0]));
      }
      if (state.phase === 'preparation') {
        if (state.round === 10) while (state.gold >= 2) {
          const slot: number = state.shop.slots.findIndex(offer => offer.status === 'available'
            && ['irelia','maddie','lux','darius','zyra'].includes(offer.definitionId!));
          const result: ReturnType<typeof buyUnit> = slot < 0 ? rerollShop(state) : buyUnit(state,slot,state.shop.generation);
          if (!result.ok) break;
          state = result.state;
        }
        for (const unit of state.preparation.units.filter(unit => unit.team === 'player')) {
          if (unit.location.kind === 'board') continue;
          const held = state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board');
          if (held.length >= state.level) break;
          const col = [3,2,4,1,5,0,6].find(col => !held.some(unit => unit.location.kind === 'board'
            && unit.location.cell.col === col && unit.location.cell.row === 7))!;
          state = accepted(deployMatchUnit(state,unit.id,{kind:'board',cell:{col,row:7}}));
        }
        state = recorder(state,history).finish().state;
      }
      if (state.round === 10) break;
      while(state.m8.loot.direct.some(d=>d.status==='pending-capacity')){const extra=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench')!;state=accepted(sellUnit(state,extra.id));}
      state = accepted(nextRound(state,state.round));
    }
    while(state.m8.loot.direct.some(d=>d.status==='pending-capacity')){const extra=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench')!;state=accepted(sellUnit(state,extra.id));}
    reforgerOpening = {state:advance(state),battles:history.completedRecords};
    return reforgerOpening;
  }
  // The shared opening is recorded and its battle history verified once here;
  // each reforger case still validates its own prefix and full history against it.
  beforeAll(() => { const opening = recordedReforgerOpening(); validateMatchHistory(opening.state, opening.battles); });
  let removerOpening: { state: MatchState; battles: readonly BattleRecord[] };
  beforeAll(() => {
    const live = recorder(accepted(equipItem(resolveM5Choices(swords(109897)),'item-1','unit-1',0)));
    removerOpening = prepareInput({ state: advance(live.finish().state), battles: live.history.completedRecords });
  });
  function usedEquipment(mode: ConsumableScenario) {
    const reforge = mode === 'component' || mode === 'completed';
    const first = reforge ? recordedReforgerOpening() : removerOpening;
    // BattleHistory records are already recursively immutable. Keep their
    // identities while each scenario owns its mutable MatchState input.
    let opening = copyInput(first.state);
    const inputId = `item-${opening.nextItemSerial}`;
    if (reforge) opening = accepted(grantMechanicItem(opening,{receiptId:`m10:${mode}`,source:'test',
      definitionId:mode === 'component' ? 'sword' : 'deathblade'}));
    if(reforge)opening=accepted(equipItem(opening,inputId,'unit-1',0));
    const tool = opening.consumables.find(tool => tool.definitionId === (reforge ? 'reforger' : 'magnetic-remover'))!;
    expect(tool).toBeDefined();
    const target = {kind:'unit' as const,unitId:'unit-1'};
    const live = recorder(opening,new BattleHistory('crown-history',first.battles));
    live.commit(stepMatch(live.state),'tick');
    const outputId = `item-${live.state.nextItemSerial}`;
    live.commit(useConsumable(live.state,tool.consumableId,target),'command');
    expect(live.history.capturePrefix()!.equipmentCommands).toEqual([
      {tick:1,consumableId:tool.consumableId,target},
    ]);
    if (reforge) {
      expect(live.state.items.find(item => item.id === outputId)).toMatchObject({location:{kind:'inventory'}});
      live.commit(equipItem(live.state,outputId,'unit-1',0),'command');
      expect(live.state.items.find(item => item.id === outputId)).toMatchObject({location:{kind:'unit',unitId:'unit-1',slot:0}});
    }
    if (mode === 'reequip') live.commit(equipItem(live.state,'item-1','unit-1',0),'command');
    if (mode === 'combine') {
      live.commit(combineItems(live.state,'item-1','item-2'),'command');
      const item = live.state.items.find(item => item.definitionId === 'deathblade')!;
      live.commit(equipItem(live.state,item.id,'unit-1',0),'command');
    }
    expect(validateBattleRecord(live.history.capturePrefix()!,first.battles).settledMatch).toEqual(live.state);
    return live.finish();
  }
  it.each(['remove','reequip','combine','component','completed'] as const)('records combat consumable use with %s at all three entries and resumes tick for tick (M10)', mode => {
    const {state,battles} = usedEquipment(mode);
    if (mode === 'remove' || mode === 'reequip' || mode === 'combine')
      expect(battles[1]).toMatchObject({endTick:mode === 'combine' ? 172 : 274,result:'playerWin'});
    expect(state.resourceProvenance.entries.find(fact => fact.kind === 'consumable-used')).toMatchObject({tick:1});
    for (const restored of roundTrip(state,battles)) nextBattleMatches(state,restored);
  });
  it.each(['remove','component','completed'] as const)('rejects changing the %s command tick at all three entries (M10)', mode => {
    const {state,battles} = usedEquipment(mode);
    // Preserve recorder ownership of the unchanged prefix; the altered record
    // is detached and must be replayed afresh at every admission entry.
    const records = [...battles.slice(0,-1),structuredClone(battles.at(-1)!)];
    // Keep same-tick command order valid, so admission reaches production replay.
    Object.assign(records.at(-1)!.equipmentCommands![0],{tick:0});
    rejectAll(state,records,'历史获得或合成记录不一致');
  });
  it.each(['remove','component','completed'] as const)('rejects changing the %s resource tick at all three entries (M10)', mode => {
    const {state,battles} = usedEquipment(mode);
    const forged = structuredClone(state);
    Object.assign(forged.resourceProvenance.entries.find(fact => fact.kind === 'consumable-used')!,{tick:2});
    rejectAll(forged,battles,'历史获得或合成记录不一致');
  });
  it.each([false,true])('records inventory combination followed by equip=%s and resumes the next battle tick for tick (M8)', equip => {
    const live = recorder(swords());
    live.commit(stepMatch(live.state),'tick');
    live.commit(combineItems(live.state,'item-1','item-2'),'command');
    expect(live.history.capturePrefix()!.equipmentCommands).toEqual([{tick:1,consumedIds:['item-1','item-2']}]);
    expect(live.state.items.find(item => item.id === 'item-3')).toMatchObject({
      definitionId:'deathblade',location:{kind:'inventory'},
    });
    if (equip) live.commit(equipItem(live.state,'item-3','unit-1',0),'command');
    const prefix = live.history.capturePrefix()!;
    expect(validateBattleRecord(prefix,[]).settledMatch).toEqual(live.state);
    expect(prefix.equipmentCommands).toHaveLength(equip ? 2 : 1);
    const {state,battles} = live.finish();
    expect(battles[0].endTick).toBe(equip ? 103 : 164);
    expect(validateBattleRecord(battles[0],[]).settledMatch).toEqual(state);
    for (const restored of roundTrip(state,battles)) nextBattleMatches(state,restored);
    const omitted = structuredClone(battles);
    Object.assign(omitted[0],{equipmentCommands:equip ? prefix.equipmentCommands!.slice(1) : []});
    rejectAll(state,omitted,equip ? '非法穿戴命令' : '历史获得或合成记录不一致');
  });
  it.each(['ordinary','in-place','inventory'] as const)('rejects changing only the command tick to 0, 2 or 69 for %s (M9)', kind => {
    const {state,battles} = timedEquipment(kind);
    const fact = state.resourceProvenance.entries.find(entry => (entry.kind === 'item-equipped' || entry.kind === 'item-combined') && entry.tick === 1);
    expect(fact).toBeDefined();
    if (kind === 'in-place') expect(battles[0].endTick).toBe(103);
    for (const tick of [0,2,69]) {
      const forged = structuredClone(battles);
      Object.assign(forged[0].equipmentCommands![0],{tick});
      rejectAll(state,forged,kind === 'inventory' ? '历史获得或合成记录不一致'
        : tick === 2 ? '战斗档案无效：内容校验' : '战斗档案无效：事件缺失或内容错误');
      const ledgerOnly = structuredClone(state);
      Object.assign(ledgerOnly.resourceProvenance.entries[fact!.sequence],{tick});
      rejectAll(ledgerOnly,battles,kind === 'inventory' ? '历史获得或合成记录不一致' : 'battle equipment command sequence');
    }
    const missingTick = structuredClone(state);
    Reflect.deleteProperty(missingTick.resourceProvenance.entries[fact!.sequence],'tick');
    rejectAll(missingTick,battles,kind === 'inventory' ? '历史获得或合成记录不一致' : 'extra battle equipment receipt');
  });
  it.each([0,2,69])('binds next-tick receipts when both tick claims move to %i (M9 boundary)', tick => {
    const {state,battles} = timedEquipment('in-place');
    const shifted = structuredClone(state), records = structuredClone(battles);
    const fact = shifted.resourceProvenance.entries.find(entry => entry.kind === 'item-combined')!;
    Object.assign(fact,{tick});
    Object.assign(records[0].equipmentCommands![0],{tick});
    const genuine = timedEquipment('in-place',tick);
    // Tick 0 changes the first hit; tick 69 leaves the hits at 35/69 using
    // the sword. Tick 2 changes no hits, but all three change the combat receipt.
    expect(genuine.battles[0].endTick).toBe(103);
    expect(genuine.battles[0].result).toBe('playerWin');
    const expectedEvents = structuredClone(battles[0].events);
    const damageChanges = tick === 0
      ? [{index:8,raw:69,mitigated:74,hpDamage:74,overkill:0}, {index:16,raw:69,mitigated:103,hpDamage:36,overkill:67}]
      : tick === 69
        ? [{index:16,raw:49,mitigated:68,hpDamage:61,overkill:7}, {index:24,raw:49,mitigated:49,hpDamage:49,overkill:0},
          {index:29,raw:69,mitigated:74,hpDamage:61,overkill:13}]
        : [];
    for (const {index,...outcome} of damageChanges) {
      const event = expectedEvents[index];
      if (event.type !== 'packetDamage') throw new Error('Expected exact damage event');
      Object.assign(event.outcome,outcome);
    }
    expect(genuine.battles[0].events).toEqual(expectedEvents);
    expect(genuine.state.combat!.equipmentReceipts![0].input.effectiveTick).toBe(tick + 1);
    expect(shifted).not.toEqual(genuine.state);
    expect(records).not.toEqual(genuine.battles);
    rejectAll(shifted,records,'battle equipment command sequence');
    expect(() => validateBattleRecord(records[0],[])).toThrow(tick === 2
      ? '战斗档案无效：内容校验' : '战斗档案无效：事件缺失或内容错误');
    const consistent = structuredClone(shifted);
    Object.assign(consistent.combat!.equipmentReceipts![0].input,{effectiveTick:tick + 1});
    expect(consistent).toEqual(genuine.state);
    for (const restored of roundTrip(genuine.state,genuine.battles)) {
      expect(restored).toEqual(consistent);
      nextBattleMatches(genuine.state,restored);
    }
  });
  it.each(['existing-target','missing-first','missing-second','ordinary-equip'] as const)('rejects %s in-place combination tampering at all three entries', mutation => {
    let opening = accepted(grantMechanicUnit(swords(),{receiptId:'m9:target',source:'test',definitionId:'lux'}));
    opening = accepted(equipItem(opening,'item-1','unit-1',0));
    const live = recorder(opening);
    live.commit(stepMatch(live.state),'tick');
    live.commit(equipItem(live.state,'item-2','unit-1',0),'command');
    const {state,battles} = live.finish();
    const forged = structuredClone(state), records = structuredClone(battles);
    const fact = forged.resourceProvenance.entries.find(entry => entry.kind === 'item-combined')!;
    if (fact.kind !== 'item-combined') throw new Error('Expected combination');
    if (mutation === 'existing-target') Object.assign(records[0].equipmentCommands![0],{unitId:'unit-2'});
    else if (mutation === 'ordinary-equip') Object.assign(forged.resourceProvenance.entries,{[fact.sequence]:{
      kind:'item-equipped',itemId:fact.event.itemId,unitId:'unit-1',slot:0,tick:1,sequence:fact.sequence,roundId:fact.roundId,
    }});
    else Object.assign(fact.event,{consumedIds:fact.event.consumedIds.filter((_,index) => index !== (mutation === 'missing-first' ? 0 : 1))});
    rejectAll(forged,records,mutation === 'existing-target' ? '战斗档案无效：事件缺失或内容错误'
      : mutation === 'ordinary-equip' ? 'equipment ownership/slot' : 'combination inputs');
  });
  it.each(['missing-first','missing-second','ordinary-equip'] as const)('rejects %s inventory combination commands at all three entries', mutation => {
    const {state,battles} = timedEquipment('inventory'), records = structuredClone(battles);
    const command = records[0].equipmentCommands![0];
    if (!('consumedIds' in command)) throw new Error('Expected inventory combination');
    Object.assign(records[0],{equipmentCommands:mutation === 'ordinary-equip'
      ? [{tick:1,itemId:'item-1',unitId:'unit-1',slot:0}]
      : [{tick:1,consumedIds:command.consumedIds.filter((_,index) => index !== (mutation === 'missing-first' ? 0 : 1))}]});
    rejectAll(state,records,mutation === 'ordinary-equip' ? '战斗档案无效：事件缺失或内容错误' : '合成命令字段');
  });
  it('rejects a structurally valid command with an invalid recipe through production replay', () => {
    const live = recorder(grantBlades(createMatch(7),2));
    const {state,battles} = live.finish();
    const records = structuredClone(battles);
    // Both distinct items exist in inventory, but two completed deathblades
    // have no combination recipe. Only production replay rejects this command.
    Object.assign(records[0],{equipmentCommands:[{tick:1,consumedIds:['item-1','item-2']}]});
    rejectAll(state,records,'非法合成命令');
  });
  it('binds combat equip order to the temporary item roll prefix (M9)', () => {
    let opening = accepted(grantMechanicUnit(createMatch(7),{receiptId:'m9:bench',source:'test',definitionId:'lux'}));
    for (let i = 0; i < 2; i++) opening = accepted(grantMechanicItem(opening,
      {receiptId:`m9:gloves:${i}`,source:'test',definitionId:'thiefs-gloves'}));
    const finish = (reverse: boolean) => {
      const live = recorder(opening);
      for (const i of reverse ? [1,0] : [0,1]) {
        live.commit(stepMatch(live.state),'tick');
        live.commit(equipItem(live.state,`item-${i+1}`,`unit-${i+1}`,0),'command');
      }
      return live.finish();
    };
    const original = finish(false), reordered = finish(true);
    roundTrip(original.state,original.battles);
    roundTrip(reordered.state,reordered.battles);
    // Rewrite commands AND matching equip facts while keeping the original,
    // locally valid RNG/children ledger. Combat receipts now reject this first.
    const forged = {...original.state,resourceProvenance:reordered.state.resourceProvenance};
    expect(() => validateMatchStructure(forged)).toThrow('battle equipment command sequence');
    rejectAll(forged,reordered.battles,'battle equipment command sequence');
    // After combat is cleared, align the genuine settlement too so this second
    // forgery still reaches (and fails) the original temporary-roll prefix check.
    const later = advance(original.state), reorderedLater = advance(reordered.state);
    const forgedLater = {...reorderedLater,equipmentState:later.equipmentState,temporaryEquipment:later.temporaryEquipment};
    expect(validateMatchStructure(forgedLater)).toEqual(forgedLater);
    rejectAll(forgedLater,reordered.battles,'历史临时装备收据前缀不一致');
  });
  it('keeps combat equips before terminal resources and crown gold (M9)', () => {
    let opening = createMatch(42);
    for (let slot = 0; slot < 3; slot++) {
      opening = accepted(grantMechanicItem(opening,{receiptId:`m9:crown:${slot}`,source:'test',definitionId:TACTICIANS_CROWN_ID}));
      opening = accepted(equipItem(opening,opening.items.at(-1)!.id,'unit-1',slot));
    }
    opening = grantBlades(accepted(grantMechanicUnit(opening,{receiptId:'m9:crown-bench',source:'test',definitionId:'lux'})),1);
    const live = recorder(opening);
    live.commit(stepMatch(live.state),'tick');
    live.commit(equipItem(live.state,'item-4','unit-2',0),'command');
    const {state,battles} = live.finish();
    expect(state.seatMechanics!.receipts.find(receipt => receipt.source === 'tacticians-crown')).toMatchObject({kind:'gold',amount:1});
    roundTrip(state,battles);
    const fact = state.resourceProvenance.entries.find(entry => entry.kind === 'item-equipped' && entry.tick === 1)!;
    const moved = {...state,resourceProvenance:{...state.resourceProvenance,entries:[
      ...state.resourceProvenance.entries.filter(entry => entry.sequence !== fact.sequence),fact,
    ].map((entry,sequence) => ({...entry,sequence}))}};
    // Still a legal local equipment projection, but it rewrites the historical
    // order across the atomic loot/growth/economy settlement.
    expect(validateMatchStructure(moved)).toEqual(moved);
    rejectAll(moved,battles,'历史获得或合成记录不一致');
    const mistimed = structuredClone(state), records = structuredClone(battles);
    Object.assign(mistimed.resourceProvenance.entries[fact.sequence],{tick:battles[0].endTick});
    Object.assign(records[0].equipmentCommands![0],{tick:battles[0].endTick});
    rejectAll(mistimed,records,'战后穿戴命令');
  });
  it.each([0,2])('records in-place sword combination at tick 1 (requested slot %i) and resumes the next battle tick for tick', slot => {
    let opening = createMatch(7);
    for (let i = 0; i < 2; i++) opening = accepted(grantMechanicItem(opening,
      {receiptId:`m7:sword:${i}`,source:'test',definitionId:'sword'}));
    opening = accepted(equipItem(opening,'item-1','unit-1',0));
    const live = recorder(opening);
    live.commit(stepMatch(live.state),'tick');
    const combined = equipItem(live.state,'item-2','unit-1',slot);
    expect(combined.ok).toBe(true);
    if (!combined.ok) throw new Error(combined.reason);
    expect(combined.events.filter(event => event.domain !== 'combat').map(event => event.type))
      .toEqual(['itemCombined','itemEquipped']);
    live.commit(combined,'command');
    expect(live.state.items.find(item => item.id === 'item-3')).toMatchObject({
      definitionId:'deathblade',location:{kind:'unit',unitId:'unit-1',slot:0},
    });
    const prefix = live.history.capturePrefix()!;
    expect(prefix.equipmentCommands).toEqual([{tick:1,itemId:'item-2',unitId:'unit-1',slot}]);
    expect(validateBattleRecord(prefix,[]).settledMatch).toEqual(live.state);
    const {state,battles} = live.finish();
    expect(validateBattleRecord(battles[0],[]).settledMatch).toEqual(state);
    for (const restored of roundTrip(state,battles)) {
      let original = accepted(startMatchCombat(advance(state)));
      let resumed = accepted(startMatchCombat(advance(restored)));
      expect(resumed).toEqual(original);
      while (original.phase === 'combat') {
        const expected = stepMatch(original), actual = stepMatch(resumed);
        expect(actual).toEqual(expected);
        original = expected.state; resumed = actual.state;
      }
    }
    // Omitting the combination removes its next-tick effect: exact event replay rejects it.
    const omitted = structuredClone(battles);
    Object.assign(omitted[0],{equipmentCommands:[]});
    expect(() => serializeMatch(state,omitted)).toThrow('战斗档案无效：事件缺失或内容错误');
    for (const input of [state,JSON.stringify(state)])
      expect(() => restoreMatch(input,omitted)).toThrow('战斗档案无效：事件缺失或内容错误');
  });
  it.each(['reordered','duplicated','extra','missing','unknown-target'] as const)('rejects %s commands at all three save/restore entries', mutation => {
    const live = recorder(grantBlades(createMatch(7),3));
    live.commit(stepMatch(live.state),'tick');
    live.commit(equipItem(live.state,'item-1','unit-1',0),'command');
    live.commit(equipItem(live.state,'item-2','unit-1',1),'command');
    const {state,battles} = live.finish();
    roundTrip(state,battles);
    const commands = battles[0].equipmentCommands!;
    expect(commands).toEqual([
      {tick:1,itemId:'item-1',unitId:'unit-1',slot:0},
      {tick:1,itemId:'item-2',unitId:'unit-1',slot:1},
    ]);
    // Same-tick reordering passes the shape check and executes legal equips.
    // Extra also names a genuinely available item and empty equipment slot.
    const changed = mutation === 'reordered' ? [commands[1],commands[0]]
      : mutation === 'duplicated' ? [commands[0],commands[0],commands[1]]
      : mutation === 'extra' ? [...commands,{tick:1,itemId:'item-3',unitId:'unit-1',slot:2}]
      : mutation === 'missing' ? [commands[0]]
      : [commands[0],{...commands[1],unitId:'missing-unit'}];
    const forged = structuredClone(battles);
    Object.assign(forged[0],{equipmentCommands:changed});
    const reason = mutation === 'duplicated' || mutation === 'unknown-target'
      ? '非法穿戴命令' : mutation === 'reordered' ? '战斗档案无效：内容校验' : '战斗档案无效：事件缺失或内容错误';
    expect(() => serializeMatch(state,forged)).toThrow(reason);
    expect(() => restoreMatch(structuredClone(state),forged)).toThrow(reason);
    expect(() => restoreMatch(JSON.stringify(state),forged)).toThrow(reason);
  });
  it('accepts combat equipment targeting a bench unit at all three entries', () => {
    const opening = grantBlades(accepted(grantMechanicUnit(createMatch(7),
      {receiptId:'s7:bench',source:'test',definitionId:'lux'})),2);
    const live = recorder(opening);
    live.commit(stepMatch(live.state),'tick');
    expect(live.state.preparation.units.find(unit => unit.id === 'unit-2')!.location.kind).toBe('bench');
    expect(live.state.combat!.units.some(unit => unit.id === 'unit-2')).toBe(false);
    live.commit(equipItem(live.state,'item-1','unit-2',0),'command');
    live.commit(equipItem(live.state,'item-2','unit-2',1),'command');
    const {state,battles} = live.finish();
    expect(battles[0].equipmentCommands).toHaveLength(2);
    roundTrip(state,battles);
  });
  it('accepts combat equipment targeting a dead unit at all three entries', () => {
    let opening = accepted(grantMechanicGold(createMatch(7),{receiptId:'s7:xp',source:'test',amount:4}));
    opening = accepted(buyXp(opening));
    opening = accepted(grantMechanicUnit(opening,{receiptId:'s7:front',source:'test',definitionId:'lux'}));
    opening = accepted(deployMatchUnit(opening,'unit-1',{kind:'board',cell:{col:0,row:7}}));
    opening = accepted(deployMatchUnit(opening,'unit-2',{kind:'board',cell:{col:3,row:4}}));
    const history = new BattleHistory('crown-history');
    // These three genuine opening battles lead to Lux dying during 2-1.
    for (let i = 0; i < 3; i++) opening = advance(recordedCrownBattle(opening,history).state);
    opening = grantBlades(resolveM5Choices(opening),2);
    const blades = opening.items.filter(item => item.definitionId === 'deathblade');
    const live = recorder(opening,history);
    while (live.state.phase === 'combat' && live.state.combat!.units.find(unit => unit.id === 'unit-2')!.alive)
      live.commit(stepMatch(live.state),'tick');
    expect(live.state.phase).toBe('combat');
    expect(live.state.combat!.units.find(unit => unit.id === 'unit-2')!.alive).toBe(false);
    for (const [slot,item] of blades.entries()) live.commit(equipItem(live.state,item.id,'unit-2',slot),'command');
    const {state,battles} = live.finish();
    expect(battles.at(-1)!.equipmentCommands).toHaveLength(2);
    roundTrip(state,battles);
  });
});
