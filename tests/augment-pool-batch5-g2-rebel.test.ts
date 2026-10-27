import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_G2 } from '../src/simulation/content/augment-pool-batch5-g2';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { createRebelCopy, summonRebelCopies } from '../src/simulation/augment-pool-batch5-g2-rebel';
import { shareAugmentTraits, settleAugmentDeaths } from '../src/simulation/combat-augment-effects';
import { ghostFriendsGrowth } from '../src/simulation/augment-pool-batch5-g2';
import { augmentDeathsFromEvents } from '../src/simulation/augment-death-samples';
import { appendAugmentFact } from '../src/simulation/augment-history';
import { readCombatStats } from '../src/simulation/combat-s13';
import { augmentPool, rebelCopyStats, rebelCopyDeaths, ghostFriendsGrowth as expectedGrowth } from './fixtures/m5/oracle.g2.cjs';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import type { S13Unit } from '../src/simulation/combat-s13-state';
import type { CombatEvent, CombatUnit } from '../src/simulation/combat-types';
import type { Unit } from '../src/simulation/unit-types';

it('B5-70 retains 14.24 five deaths / 400 HP and all original offer nodes with Rebel tailoring', () => {
  const path = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
  const rows = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [{apiName:'TFT13_Augment_Rebel',effects:{NumOfUnits:5,ReducedHealth:400}}];
  expect(AUGMENT_BATCH5_G2['rebel-resurgence'].source.values).toEqual(rows.find((r: {apiName: string}) => r.apiName === 'TFT13_Augment_Rebel').effects);
  expect(AUGMENT_TIERS['rebel-resurgence']).toBe('gold');
  for (const node of ['2-1', '3-2', '4-2']) for (const traits of [[], ['rebel']]) {
    const allowed = node === '2-1' || traits.includes('rebel');
    expect(augmentCandidates('gold', [], [], null, {node, fieldedTraits: traits, blocked: []}).includes('rebel-resurgence')).toBe(allowed);
    expect(augmentPool('gold', [], [], `round:${node}:augment`, traits).includes('rebel-resurgence')).toBe(allowed);
  }
});

function battle(definitions = ['irelia'], star: 1 | 2 | 3 = 1, extraAugments: string[] = []) {
  const base = createMatch(1), {resourceProvenance: _resources, ...strategyBase} = base;
  const units: Unit[] = definitions.map((definitionId, index) => ({id: `ally-${index}`, definitionId, starLevel: star, team: 'player', location: {kind: 'board', cell: {col: index % 7, row: 4 + Math.floor(index / 7)}}}));
  units.push({id: 'opponent', definitionId: 'garen', starLevel: 3, team: 'enemy', location: {kind: 'board', cell: {col: 1, row: 2}}});
  const preparation = {...base.preparation, units};
  const inputs = {...strategyBase, preparation, augments: ['rebel-resurgence', ...extraAugments].map(definitionId => ({definitionId, choiceId: definitionId, acquiredRound: 1})),
    ...(extraAugments.includes('ghost-of-friends-past') ? {ghostFriendsGrowth: {healthFlat: 0, attackDamageBps: 0, abilityPower: 0}} : {})};
  return createCombatWithEvents(preparation, buildStrategySnapshot(inputs), 'rebel-test', 1).state;
}

it.each([
  ['irelia', 1, 700, 45], ['irelia', 2, 700, 45], ['irelia', 3, 700, 45], ['vex', 1, 450, 30],
] as const)('B5-70 %s %s-star copy derives lower-star stats before the health deduction', (definitionId, star, health, attack) => {
  const state = battle([definitionId], star), holder = state.units.find(u => u.id === 'ally-0')!;
  const m = holder.mechanics!.find(m => m.mechanic === 'rebelResurgence')!;
  const copy = createRebelCopy(holder, m, 0, holder.cell, 1, state.strategy?.traits);
  expect({starLevel: copy.starLevel, maxHp: copy.maxHp, attackDamage: copy.attackDamage}).toEqual(rebelCopyStats({health, attack}, star));
  expect(copy.hp).toBe(copy.maxHp);
  expect(copy.equipment).toEqual([]); expect(copy.itemPrograms).toBeUndefined(); expect(copy.anomalyState).toBeUndefined();
  expect(copy.mechanics?.some(m => m.mechanic === 'rebelResurgence')).toBe(false);
});

it('B5-70 removes item/anomaly declarations while retaining the frozen effective trait tags', () => {
  const state = battle(['irelia']), original = state.units[0];
  const holder: CombatUnit = {...original, sources: [...original.sources!,
    {key: 'item', source: {ownerId: original.id, sourceKind: 'item', sourceDefinitionId: 'warmog', sourceInstanceId: 'item-1', effectIndex: 0}, effect: {kind: 'statFlat', stat: 'maxHp', amount: 600}},
    {key: 'anomaly', source: {ownerId: original.id, sourceKind: 'anomaly', sourceDefinitionId: 'giant-sized', sourceInstanceId: 'anomaly', effectIndex: 0}, effect: {kind: 'statPercentBps', stat: 'maxHp', bps: 5000}},
  ]};
  const m = holder.mechanics!.find(m => m.mechanic === 'rebelResurgence')!;
  const copy = createRebelCopy(holder, m, 0, holder.cell, 1, state.strategy?.traits);
  expect(copy.maxHp).toBe(300);
  expect(copy.sources!.some(s => s.source.sourceKind === 'item' || s.source.sourceKind === 'anomaly')).toBe(false);
  expect(copy.rebelCopy?.traits).toEqual(expect.arrayContaining(['rebel', 'sentinel']));
  const explicit = [{team: 'player' as const, traitId: 'rebel', count: 1, tier: 0, memberDefinitionIds: ['irelia'], memberUnitIds: [holder.id, 'other'], targetUnitIds: [holder.id]}];
  expect(shareAugmentTraits(copy, {id: 'other', definitionId: 'lux', team: 'player'}, explicit)).toBe(true);
});

it('B5-70 consumes exactly five original deaths, copy deaths do not consume quota or recurse, and B5-63 counts them', () => {
  const originals = ['irelia', 'akali', 'sett', 'vex', 'ezreal', 'illaoi'];
  let state = battle(originals, 1, ['ghost-of-friends-past']);
  const clone = structuredClone(state);
  for (const u of clone.units.filter(u => u.team === 'player')) Object.assign(u, {hp: 0});
  const first = stepCombat(clone); state = first.state;
  const expected = rebelCopyDeaths(first.events, originals.map((definitionId, i) => ({id: `ally-${i}`, definitionId, team: 'player', traits: ['rebel']})));
  expect(state.batch5RebelSummons?.map(({ownerId, team, ordinal}) => ({ownerId, team, ordinal}))).toEqual(expected);
  expect(expected).toHaveLength(5);
  const copies = state.units.filter(u => u.rebelCopy);
  expect(copies).toHaveLength(5);
  for (const copy of copies) {
    const owner = clone.units.find(u => u.id === copy.rebelCopy!.ownerId)!;
    expect(copy.cell).toEqual(owner.cell);
  }
  const next = structuredClone(state);
  for (const copy of next.units.filter(u => u.rebelCopy)) Object.assign(copy, {hp: 0});
  const second = stepCombat(next); state = second.state;
  expect(state.batch5RebelSummons).toHaveLength(5);
  expect(second.events.filter(e => e.type === 'unitSpawned' && e.source.definitionId === 'rebel-resurgence')).toHaveLength(0);
  const samples = augmentDeathsFromEvents([...first.events, ...second.events]);
  expect(samples.filter(d => d.championCopy)).toHaveLength(5);
  expect(samples.filter(d => d.championCopy).every(d => !d.ordinaryHero)).toBe(true);
  const base = createMatch(1);
  const historyState = {...base, round: 2, augments: [{definitionId: 'ghost-of-friends-past', choiceId: 'ghost', acquiredRound: 1}],
    augmentHistory: {version: 'augment-history-v1' as const, seatId: 'solo', facts: [], proof: {kind: 'server' as const}}};
  const withFacts = appendAugmentFact({...historyState, round: 1}, {kind: 'deaths', battleId: 'rebel-test', completeThroughTick: state.tick, deaths: samples});
  const grown = {...withFacts, round: 2};
  expect(ghostFriendsGrowth(grown)).toEqual(expectedGrowth(grown));
  expect(ghostFriendsGrowth(grown)).toEqual({healthFlat: 25, attackDamageBps: 160, abilityPower: 4});
});

it('B5-70 nearest free cell is deterministic when the original cell is occupied', () => {
  const state = battle(['irelia']), roster = structuredClone(state.units) as S13Unit[];
  const holder = roster.find(u => u.id === 'ally-0')!; holder.alive = false; holder.hp = 0;
  roster.push({...structuredClone(roster.find(u => u.id === 'opponent')!), id: 'blocker', cell: {...holder.cell}});
  const events: CombatEvent[] = [{type: 'death', tick: 1, unitId: holder.id}];
  const ctx = {units: roster, tick: 1, events, board: state.board, combatId: state.combatId, packets: [], heals: []} as unknown as AbilityContext;
  const receipts = summonRebelCopies(ctx, state, roster, [...events]);
  const copy = roster.find(u => u.id === receipts![0].copyId)!;
  expect(copy.cell).toEqual({col: 0, row: 3});
});

it('B5-70 copy death between original deaths leaves the remaining quota available', () => {
  let state = battle(['irelia', 'akali']);
  const first = structuredClone(state);
  Object.assign(first.units.find(u => u.id === 'ally-0')!, {hp: 0});
  state = stepCombat(first).state;
  expect(state.batch5RebelSummons).toHaveLength(1);
  const copyDeath = structuredClone(state);
  Object.assign(copyDeath.units.find(u => u.rebelCopy)!, {hp: 0});
  state = stepCombat(copyDeath).state;
  expect(state.batch5RebelSummons).toHaveLength(1);
  const second = structuredClone(state);
  Object.assign(second.units.find(u => u.id === 'ally-1')!, {hp: 0});
  state = stepCombat(second).state;
  expect(state.batch5RebelSummons?.map(r => r.ownerId)).toEqual(['ally-0', 'ally-1']);
  expect(state.units.filter(u => u.rebelCopy)).toHaveLength(2);
  expect(battle(['irelia']).batch5RebelSummons).toBeUndefined();
});

it('B5-70 a completely occupied board consumes the death trigger without an invalid spawn', () => {
  const state = battle(['irelia']), holder = structuredClone(state.units[0]) as S13Unit;
  holder.hp = 0; holder.alive = false;
  const template = state.units.find(u => u.id === 'opponent')!;
  const occupied = Array.from({length: state.board.rows}, (_, row) => Array.from({length: state.board.columns}, (_, col) =>
    ({...structuredClone(template), id: `occupied-${row}-${col}`, cell: {col, row}} as S13Unit))).flat();
  const roster = [holder, ...occupied], events: CombatEvent[] = [{type: 'death', tick: 1, unitId: holder.id}];
  const ctx = {units: roster, tick: 1, events, board: state.board, combatId: state.combatId} as unknown as AbilityContext;
  const receipts = summonRebelCopies(ctx, state, roster, [...events]);
  expect(receipts).toEqual([{ownerId: holder.id, team: 'player', tick: 1, eventSeq: state.nextEventSeq!, ordinal: 0, copyId: null}]);
  expect(events.filter(e => e.type === 'unitSpawned')).toHaveLength(0);
});

it('B5-70 copy death can trigger Climb the Ladder using inherited traits', () => {
  const state = battle(['irelia', 'akali'], 1, ['climb-the-ladder-ii']);
  const units = structuredClone(state.units) as S13Unit[], holder = units.find(u => u.id === 'ally-0')!, ally = units.find(u => u.id === 'ally-1')!;
  const copy = createRebelCopy(holder, holder.mechanics!.find(m => m.mechanic === 'rebelResurgence')!, 0, holder.cell, 1, state.strategy?.traits) as S13Unit;
  copy.alive = false; copy.hp = 0;
  const ctx = {units: [...units, copy], tick: 2, events: [], board: state.board, combatId: state.combatId, packets: [], heals: []} as unknown as AbilityContext;
  for (const unit of ctx.units) unit.mechanismState = {...unit.mechanismState!, sampledAtTick: 2};
  const before = readCombatStats(ally, {units, tick: 2});
  settleAugmentDeaths(ctx, [copy], state.strategy?.traits);
  const after = readCombatStats(ally, {units: ctx.units, tick: 2});
  expect(after.abilityPower).toBe(before.abilityPower + 5);
  expect(after.attackDamage).toBeGreaterThan(before.attackDamage);
});

it('B5-70 inherits an already-triggered Rebel pulse without granting it again to the team', () => {
  let state = battle(['irelia', 'akali', 'vex']);
  const low = structuredClone(state);
  Object.assign(low.units.find(u => u.id === 'ally-0')!, {hp: 1});
  state = stepCombat(low).state;
  expect(state.units.find(u => u.id === 'ally-1')!.batch5RebelPulseAtTick).toBe(1);
  if (!state.units.some(u => u.rebelCopy)) {
    const killed = structuredClone(state);
    Object.assign(killed.units.find(u => u.id === 'ally-0')!, {hp: 0});
    state = stepCombat(killed).state;
  }
  const copy = state.units.find(u => u.rebelCopy)!;
  expect(copy).toBeDefined(); expect(copy.g22?.rebelTriggered).toBe(true);
  expect(readCombatStats(copy, state).abilityPower).toBe(120);
  const ally = state.units.find(u => u.id === 'ally-1')!;
  const before = readCombatStats(ally, state).abilityPower;
  state = stepCombat(state).state;
  expect(readCombatStats(state.units.find(u => u.id === ally.id)!, state).abilityPower).toBe(before);
});
