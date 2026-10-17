import { describe, expect, it } from 'vitest';
import { createMatch, buyXp, combineItems, deployMatchUnit, equipItem, nextRound, sellUnit, useConsumable, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
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
    legal = accepted(grantMechanicUnit(legal,{receiptId:'m4:first',source:'test',definitionId:'irelia'}));
    expect(holder.definitionId).toBe('irelia');
    const equip = (value: MatchState) => accepted(equipItem(value,'item-4','unit-3',0));
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
    expect(legal.items.find(item => item.id === 'item-4')!.location).toEqual({kind:'unit',unitId:'unit-3',slot:0});
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
      .filter(fact => !(fact.kind === 'item-equipped' && fact.itemId === 'item-4'))
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
    expect(() => restoreMatch(state, mistimed)).toThrow('战后穿戴命令');
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
    expect(prefix.equipmentCommands).toEqual([{tick:1,itemId:'item-2',unitId:'unit-1',slot:0}]);
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
    // Omitting the combination must still fail the strict resource-prefix check.
    const omitted = structuredClone(battles);
    Object.assign(omitted[0],{equipmentCommands:[]});
    expect(() => serializeMatch(state,omitted)).toThrow('历史获得或合成记录不一致');
    for (const input of [state,JSON.stringify(state)])
      expect(() => restoreMatch(input,omitted)).toThrow('历史获得或合成记录不一致');
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
      ? '非法穿戴命令' : '历史获得或合成记录不一致';
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
