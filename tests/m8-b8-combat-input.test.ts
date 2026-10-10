import { describe, expect, it } from 'vitest';
import { createMatch, combineItems, deployMatchUnit, equipItem, nextRound, selectChoice, startMatchCombat } from '../src/simulation/match';
import { accepted, emptyBoard, reachRound } from './match-helpers';
import { freezeCombatInput, restoreCombatInput, type CombatInputAuthority } from '../src/simulation/combat-input';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { nextRandom } from '../src/simulation/rng';

function fixture() {
  const state = createMatch(42), draw = nextRandom(state.battleSeedRngState);
  const basis = freezeCombatInput(state, draw.word, 1);
  const authority: CombatInputAuthority = { seed: state.seed, round: state.round, contentDigest: state.contentDigest,
    playerLevel: state.level, provenancePrefixLength: 1, equipmentRollPrefixLength: 0,
    resources: { units: [{id:'unit-1',definitionId:'irelia',starLevel:1}], items: [], persistentGrowth: [], nextUnitSerial: 2, nextItemSerial: 1 },
    equipmentRolls: [], scheduleReceipts: [], roundResults: [] };
  return { state, basis, authority };
}
describe('B8 combat input basis pure prerequisites (not live Match integration)', () => {
  it('owns a deep frozen input copy and compiles the unchanged strategy', () => {
    const { state, basis, authority } = fixture(), before = structuredClone(state);
    expect(basis.inputs).not.toBe(state);
    expect(basis.inputs.preparation).not.toBe(state.preparation);
    expect(Object.isFrozen(basis.inputs.preparation.units[0].location)).toBe(true);
    expect(buildStrategySnapshot(basis.inputs)).toEqual(buildStrategySnapshot(state));
    const restored = restoreCombatInput(basis, authority);
    expect(restored).toEqual(basis); expect(restored).not.toBe(basis);
    expect(state).toEqual(before);
    expect(restoreCombatInput(basis,{...authority,resources:{...authority.resources,
      units:state.preparation.units.filter(unit => unit.team === 'player')}})).toEqual(basis);
  });
  it.each(['battleSeed','nextUnitSerial','nextItemSerial','playerLevel','provenancePrefixLength','equipmentRollPrefixLength'] as const)('rejects altered %s against independent authority', field => {
    const { basis, authority } = fixture();
    expect(() => restoreCombatInput({...basis,[field]:basis[field]+1},authority)).toThrow();
  });
  it('binds the exact combat, catalog round, digest and version', () => {
    const { basis, authority } = fixture();
    for (const field of ['combatId','roundId','contentDigest','version'] as const)
      expect(() => restoreCombatInput({...basis,[field]:'tampered'},authority)).toThrow();
  });
  it('rejects original roster tampering rather than trusting a supplied strategy', () => {
    const { basis, authority } = fixture();
    const change = (patch: object) => ({...basis,inputs:{...basis.inputs,preparation:{...basis.inputs.preparation,
      units:basis.inputs.preparation.units.map(unit => unit.id === 'unit-1' ? {...unit,...patch} : unit)}}});
    expect(() => restoreCombatInput(change({starLevel:2}),authority)).toThrow();
    expect(() => restoreCombatInput(change({definitionId:'maddie'}),authority)).toThrow();
    expect(() => restoreCombatInput(change({id:'unit-2'}),authority)).toThrow();
    expect(() => restoreCombatInput(change({location:{kind:'bench',slot:9}}),authority)).toThrow();
    expect(() => restoreCombatInput({...basis,inputs:{...basis.inputs,preparation:{...basis.inputs.preparation,units:basis.inputs.preparation.units.slice(1)}}},authority)).toThrow();
  });
  it('rejects invented growth, progress, items and temporary equipment', () => {
    const { basis, authority } = fixture();
    for (const patch of [
      {persistentGrowth:[{unitId:'unit-1',attackDamageBps:125}]},
      {augmentProgress:{pumpingRounds:1,investmentHp:0}},
      {items:[{id:'item-1',definitionId:'bf-sword',location:{kind:'inventory'}}]},
      {temporaryEquipment:[{temporaryId:'fake'}]},
      {augments:[{definitionId:'investment-strategy-i',choiceId:'fake',acquiredRound:1}]},
    ]) expect(() => restoreCombatInput({...basis,inputs:{...basis.inputs,...patch}},authority)).toThrow();
  });
  it('uses the seventh battle word at 2-5, with no draw for the preceding supply', () => {
    const state = reachRound('2-5');
    expect(nextRandom(state.battleSeedRngState).word).toBe(890455596);
  });
  it('binds public later-round inputs, skips supply battle seeds and preserves original G12 children', () => {
    let state = createMatch(42);
    while (state.roundDefinitionId !== '3-5') {
      if (state.phase === 'choice') {
        const choice = state.pendingChoice!;
        state = accepted(selectChoice(state,choice.choiceId,choice.generation,
          choice.kind === 'component' ? 'gloves' : choice.offers.find(id => id !== 'placebo')!));
      } else if (state.phase === 'preparation') state = accepted(startMatchCombat(emptyBoard(state)));
      else state = accepted(nextRound(state,state.round));
    }
    state = accepted(combineItems(state,'item-1','item-2'));
    state = accepted(equipItem(state,'item-3','unit-1',0));
    state = accepted(deployMatchUnit(state,'unit-1',{kind:'board',cell:{col:1,row:4}}));
    const basis = freezeCombatInput(state,nextRandom(state.battleSeedRngState).word,10);
    const authority: CombatInputAuthority = { seed:state.seed,round:state.round,contentDigest:state.contentDigest,
      playerLevel:state.level,provenancePrefixLength:10,equipmentRollPrefixLength:state.equipmentState.rolls.length,
      resources:{units:state.preparation.units.filter(unit => unit.team === 'player').map(({id,definitionId,starLevel}) => ({id,definitionId,starLevel})),
        items:state.items.map(({id,definitionId}) => ({id,definitionId})),persistentGrowth:[],nextUnitSerial:state.nextUnitSerial,nextItemSerial:state.nextItemSerial},
      equipmentRolls:state.equipmentState.rolls,scheduleReceipts:state.scheduleReceipts,roundResults:state.roundResults };
    expect(restoreCombatInput(basis,authority)).toEqual(basis);
    expect(basis.inputs.temporaryEquipment).toHaveLength(2);
    const player = buildStrategySnapshot(basis.inputs).units.find(unit => unit.unitId === 'unit-1')!;
    expect([...new Set(player.sources.filter(effect => effect.source.parentItemInstanceId === 'item-3')
      .map(effect => effect.source.sourceInstanceId))].sort())
      .toEqual(basis.inputs.temporaryEquipment.map(child => child.temporaryId).sort());
    expect(buildStrategySnapshot(basis.inputs)).toEqual(buildStrategySnapshot(state));
    const wrongChild = {...basis,inputs:{...basis.inputs,temporaryEquipment:basis.inputs.temporaryEquipment.map(child => ({...child,holderId:'unit-2'}))}};
    expect(() => restoreCombatInput(wrongChild,authority)).toThrow();
    expect(() => restoreCombatInput({...basis,battleSeed:nextRandom(basis.battleSeed).word},authority)).toThrow();
    expect(() => restoreCombatInput({...basis,equipmentRollPrefixLength:0},authority)).toThrow();
  });
  it('rejects non-JSON inputs and never mutates authoritative resource references', () => {
    const { basis, authority } = fixture(), before = structuredClone(authority);
    expect(() => restoreCombatInput({...basis,extra:undefined},authority)).toThrow();
    expect(() => restoreCombatInput({...basis,inputs:null},authority)).toThrow();
    expect(() => restoreCombatInput({...basis,inputs:{...basis.inputs,items:null}},authority)).toThrow();
    expect(authority).toEqual(before);
  });
});
