import { describe, expect, it } from 'vitest';
import { createMatch, combineItems, deployMatchUnit, equipItem, nextRound, selectChoice, startMatchCombat } from '../src/simulation/match';
import { accepted, emptyBoard, reachRound } from './match-helpers';
import { freezeCombatInput, restoreCombatInput, type CombatInputAuthority } from '../src/simulation/combat-input';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { nextRandom } from '../src/simulation/rng';
import { restoreMatch } from '../src/simulation/serialization';

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


describe('shared current/basis asset validation', () => {
  const changes: readonly [string, (input: any) => void, string][] = [
    ['board shape', input => { input.preparation.board.deploymentZones = null; }, 'object'],
    ['board dimensions', input => { input.preparation.board.columns = 8; }, 'board rules'],
    ['deployment zones', input => { input.preparation.board.deploymentZones.player.firstRow = 3; }, 'board rules'],
    ['bench size', input => { input.preparation.benchSize = 10; }, 'board rules'],
    ['unit array', input => { input.preparation.units = {}; }, 'array'],
    ['duplicate units', input => { input.preparation.units.push(input.preparation.units[0]); }, 'duplicate unit'],
    ['player ID format', input => { input.preparation.units.find((unit: any) => unit.team === 'player').id = 'unit-01'; }, 'unit ID'],
    ['player serial bound', input => { input.preparation.units.find((unit: any) => unit.team === 'player').id = 'unit-2'; }, 'unit serial'],
    ['player definition', input => { input.preparation.units.find((unit: any) => unit.team === 'player').definitionId = 'unknown'; }, 'unit definition'],
    ['team', input => { input.preparation.units.find((unit: any) => unit.team === 'player').team = 'other'; }, 'team'],
    ['star', input => { input.preparation.units.find((unit: any) => unit.team === 'player').starLevel = 4; }, 'star'],
    ['location shape', input => { input.preparation.units.find((unit: any) => unit.team === 'player').location = null; }, 'object'],
    ['bench range', input => { input.preparation.units.find((unit: any) => unit.team === 'player').location = {kind:'bench',slot:9}; }, 'bench location'],
    ['bench integer', input => { input.preparation.units.find((unit: any) => unit.team === 'player').location = {kind:'bench',slot:0.5}; }, 'integer'],
    ['board cell', input => { input.preparation.units.find((unit: any) => unit.team === 'player').location = {kind:'board',cell:{col:7,row:4}}; }, 'board location'],
    ['deployment side', input => { input.preparation.units.find((unit: any) => unit.team === 'player').location = {kind:'board',cell:{col:0,row:0}}; }, 'board location'],
    ['location kind', input => { input.preparation.units.find((unit: any) => unit.team === 'player').location = {kind:'other'}; }, 'location kind'],
    ['enemy identity', input => { input.preparation.units.find((unit: any) => unit.team === 'enemy').starLevel = 2; }, 'enemy roster identity'],
    ['missing enemy', input => { input.preparation.units = input.preparation.units.filter((unit: any) => unit.team === 'player'); }, 'enemy roster identity'],
    ['items array', input => { input.items = {}; }, 'array'],
    ['item ID', input => { input.items = [{id:'item-01',definitionId:'sword',location:{kind:'inventory'}}]; }, 'item ID'],
    ['item serial bound', input => { input.items = [{id:'item-1',definitionId:'sword',location:{kind:'inventory'}}]; }, 'item serial'],
  ];
  it.each(changes)('rejects %s at both restore boundaries with their own errors', (_name, change, message) => {
    const { state, basis, authority } = fixture();
    const current = JSON.parse(JSON.stringify(state)), original = JSON.parse(JSON.stringify(basis));
    change(current); change(original.inputs);
    expect(() => restoreMatch(current)).toThrow(`Invalid Match save: ${message}`);
    expect(() => restoreCombatInput(original, authority)).toThrow('Invalid combat input basis');
    expect(state).toEqual(fixture().state);
  });
  it('checks item definitions, owners, slots and constraints before authority identity comparisons', () => {
    const { basis, authority } = fixture();
    const cases: readonly [string, (items: any[]) => void][] = [
      ['definition', items => { items[0].definitionId = 'unknown'; }],
      ['duplicate', items => { items[1].id = items[0].id; }],
      ['owner', items => { items[0].location.unitId = 'missing'; }],
      ['enemy owner', items => { items[0].location.unitId = basis.inputs.preparation.units.find(unit => unit.team === 'enemy')!.id; }],
      ['slot integer', items => { items[0].location.slot = 0.5; }],
      ['slot range', items => { items[0].location.slot = 3; }],
      ['occupied slot', items => { items[1].location = {...items[0].location}; }],
      ['location', items => { items[0].location = {kind:'other'}; }],
      ['exclusive slot', items => { items[0].definitionId = 'thiefs-gloves'; items[0].location.slot = 1; }],
      ['exclusive owner', items => { items[0].definitionId = 'thiefs-gloves'; items[1].location = {kind:'unit',unitId:'unit-1',slot:2}; }],
      ['unique item', items => { items[0].definitionId = 'blue-buff'; items[1].definitionId = 'blue-buff'; items[1].location = {kind:'unit',unitId:'unit-1',slot:1}; }],
    ];
    for (const [name, change] of cases) {
      const original = JSON.parse(JSON.stringify(basis));
      original.nextItemSerial = 3;
      original.inputs.items = [
        {id:'item-1',definitionId:'sword',location:{kind:'unit',unitId:'unit-1',slot:0}},
        {id:'item-2',definitionId:'bow',location:{kind:'inventory'}},
      ];
      const validResources = {...authority.resources,nextItemSerial:3,items:original.inputs.items.map(({id,definitionId}: any) => ({id,definitionId}))};
      expect(restoreCombatInput(original,{...authority,resources:validResources}), name).toEqual(original);
      change(original.inputs.items);
      const resources = {...authority.resources,nextItemSerial:3,items:original.inputs.items.map(({id,definitionId}: any) => ({id,definitionId}))};
      expect(() => restoreCombatInput(original,{...authority,resources}), name).toThrow('Invalid combat input basis');
    }
  });
  it('retains population, occupancy and safe positive boundary checks', () => {
    const { state, basis, authority } = fixture();
    for (const field of ['level','nextUnitSerial','nextItemSerial'] as const) for (const invalid of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1]) {
      expect(() => restoreMatch({...state,[field]:invalid})).toThrow('Invalid Match save: integer');
      const basisField = field === 'level' ? 'playerLevel' : field;
      const original = {...basis,[basisField]:invalid};
      const bounds = {...authority,playerLevel:original.playerLevel,resources:{...authority.resources,nextUnitSerial:original.nextUnitSerial,nextItemSerial:original.nextItemSerial}};
      expect(() => restoreCombatInput(original,bounds)).toThrow('Invalid combat input basis');
    }
    for (const occupied of [false,true]) {
      const original = JSON.parse(JSON.stringify(basis));
      const player = original.inputs.preparation.units.find((unit: any) => unit.team === 'player');
      player.location = {kind:'board',cell:{col:1,row:4}};
      original.inputs.preparation.units.push({...player,id:'unit-2',location:{kind:'board',cell:{col:occupied ? 1 : 2,row:4}}});
      original.nextUnitSerial = 3;
      const resources = {...authority.resources,nextUnitSerial:3,units:original.inputs.preparation.units.filter((unit: any) => unit.team === 'player')};
      expect(() => restoreCombatInput(original,{...authority,resources})).toThrow('Invalid combat input basis');
      const current = {...state,nextUnitSerial:3,preparation:original.inputs.preparation};
      expect(() => restoreMatch(current)).toThrow(`Invalid Match save: ${occupied ? 'occupied location' : 'population cap'}`);
    }
  });
  it('validates legal moved assets independently and does not normalize saved order', () => {
    const { state, authority } = fixture();
    const moved = accepted(deployMatchUnit(state,'unit-1',{kind:'bench',slot:8}));
    const current = {...moved,preparation:{...moved.preparation,units:[...moved.preparation.units].reverse()}};
    const original = freezeCombatInput(current,nextRandom(current.battleSeedRngState).word,1);
    const before = structuredClone(current);
    expect(restoreMatch(current)).toEqual(current);
    expect(restoreCombatInput(original,authority)).toEqual(original);
    expect(current).toEqual(before);
  });
});
