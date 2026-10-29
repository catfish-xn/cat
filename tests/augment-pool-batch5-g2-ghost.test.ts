import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_G2 } from '../src/simulation/content/augment-pool-batch5-g2';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { ghostFriendsChampion, ghostFriendsReward, ghostFriendsRole } from '../src/simulation/augment-pool-batch5-g2';
import { settleGhostFriendsDeaths } from '../src/simulation/augment-pool-batch5-g2-combat';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { ghostFriendsDeathReward, validateGhostCombatInputs } from './fixtures/m5/augment-rewards-oracle.cjs';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import type { S13Unit } from '../src/simulation/combat-s13-state';
import { augmentDeathsFromEvents } from '../src/simulation/augment-death-samples';
import { createTrenchCopy, initializeBornUnits } from '../src/simulation/combat-g2-4b-trench';
import { M5_UNIT_IDS } from '../src/simulation/units';

it('B5-63 retains the archived numbers and only offers at 2-1', () => {
  const path = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
  const rows = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [{apiName:'TFT_Augment_GhostOfUnitsPast',effects:{HealthPerStack:5,ADPerStack:0.00800000037997961,APPerStack:1}}];
  expect(AUGMENT_BATCH5_G2['ghost-of-friends-past'].source.values).toEqual(rows.find((r: {apiName: string}) => r.apiName === 'TFT_Augment_GhostOfUnitsPast').effects);
  expect(AUGMENT_TIERS['ghost-of-friends-past']).toBe('prismatic');
  for (const node of ['2-1', '3-2', '4-2']) {
    const filter = { node, fieldedTraits: [], blocked: [] };
    expect(augmentOfferAllowed('ghost-of-friends-past', [], filter)).toBe(node === '2-1');
    expect(augmentCandidates('prismatic', [], [], null, filter)).toEqual(expect.arrayContaining(node === '2-1' ? ['ghost-of-friends-past'] : []));
    expect(augmentCandidates('prismatic', [], [], null, filter).includes('ghost-of-friends-past')).toBe(node === '2-1');
    expect(augmentPool('prismatic', [], [], `round:${node}:augment`, []).includes('ghost-of-friends-past')).toBe(node === '2-1');
  }
});

it.each(['irelia', 'garen', 'darius', 'corki', 'nocturne', 'smeech', 'akali', 'mordekaiser', 'lux', 'kogmaw', 'mel', 'viktor', 'warwick'])('B5-63 %s uses the approved role class', definitionId => {
  expect(ghostFriendsReward(ghostFriendsRole(definitionId))).toEqual(ghostFriendsDeathReward({ definitionId, ordinaryHero: true }));
});

it('B5-63 covers all 63 heroes and pins the six-cost roles to the retained 14.24 source', () => {
  for (const id of M5_UNIT_IDS) expect(ghostFriendsRole(id), id).not.toBe('other');
  const data = JSON.parse(gunzipSync(readFileSync(new URL('../src/simulation/content/source/s13-14.24b/raw/en_us.json.gz', import.meta.url))).toString());
  const source = data.setData.find((s: {mutator: string}) => s.mutator === 'TFTSet13_Evolved');
  for (const [id, apiName] of Object.entries({mel: 'TFT13_MissMage', viktor: 'TFT13_Viktor', warwick: 'TFT13_Warwick'}))
    expect(ghostFriendsRole(id)).toBe(source.champions.find((u: {apiName: string}) => u.apiName === apiName).role);
});

it('B5-63 tank priority, AP/AD classes, support fallback and frozen forms are explicit', () => {
  expect(ghostFriendsReward('APTank')).toEqual({healthFlat: 5, attackDamageBps: 0, abilityPower: 0});
  expect(ghostFriendsReward('ADTank')).toEqual({healthFlat: 5, attackDamageBps: 0, abilityPower: 0});
  expect(ghostFriendsReward('Support')).toEqual({healthFlat: 5, attackDamageBps: 0, abilityPower: 0});
  expect(ghostFriendsRole('swain', 'ranged')).toBe('APCaster');
  expect(ghostFriendsRole('swain', 'melee')).toBe('APTank');
  expect(ghostFriendsChampion({ definitionId: 'g23-sion' })).toBe(false);
  expect(ghostFriendsChampion({ definitionId: 'training-dummy' })).toBe(false);
});

function combat(revive = false) {
  const base = createMatch(6);
  const preparation = { ...base.preparation, units: [
    { id: 'tank', definitionId: 'irelia', team: 'player' as const, starLevel: 1 as const, location: {kind: 'board' as const, cell: {col: 0, row: 4}} },
    { id: 'ad', definitionId: 'darius', team: 'player' as const, starLevel: 1 as const, location: {kind: 'board' as const, cell: {col: 2, row: 4}} },
    { id: 'ap', definitionId: 'lux', team: 'player' as const, starLevel: 1 as const, location: {kind: 'board' as const, cell: {col: 4, row: 7}} },
    { id: 'enemy', definitionId: 'garen', team: 'enemy' as const, starLevel: 3 as const, location: {kind: 'board' as const, cell: {col: 0, row: 3}} },
  ] };
  const { resourceProvenance: _resources, ...strategyBase } = base;
  const inputs = { ...strategyBase, preparation, augments: [{definitionId: 'ghost-of-friends-past', choiceId: 'ghost', acquiredRound: 1}], ghostFriendsGrowth: {healthFlat: 0, attackDamageBps: 0, abilityPower: 0},
    ...(revive ? {anomalyBinding: {unitId: 'tank', definitionId: 'TFT13_GoopBuff_EvenInDeath', choiceId: 'last-chance', boundRound: 1}} : {}) };
  return createCombatWithEvents(preparation, buildStrategySnapshot(inputs), 'ghost-combat', 6).state;
}

it('B5-63 counts each real death after revival and applies HP, AD and AP in the current combat', () => {
  const state = combat(), units = structuredClone(state.units) as S13Unit[];
  const ctx = { units, tick: 1, events: [], board: state.board, combatId: state.combatId } as unknown as AbilityContext;
  const tank = units.find(u => u.id === 'tank')!, fighter = units.find(u => u.id === 'ad')!, mage = units.find(u => u.id === 'ap')!;
  const before = mage.maxHp;
  tank.hp = 0; tank.alive = false;
  settleGhostFriendsDeaths(ctx, [tank]);
  expect(mage.maxHp).toBe(before + 5); expect(tank.hp).toBe(0);
  tank.alive = true; tank.hp = 1; tank.hp = 0; tank.alive = false; ctx.tick = 2;
  settleGhostFriendsDeaths(ctx, [tank]);
  expect(mage.maxHp).toBe(before + 10);
  fighter.hp = 0; fighter.alive = false; settleGhostFriendsDeaths(ctx, [fighter]);
  mage.hp = 0; mage.alive = false; settleGhostFriendsDeaths(ctx, [mage]);
  expect(mage.ghostFriends).toEqual({ healthFlat: 10, attackDamageBps: 80, abilityPower: 1 });
  expect(tank.ghostFriends).toEqual(mage.ghostFriends);
});

it('B5-63 actual combat deaths grant once and repeated terminal steps grant nothing', () => {
  let state = combat(), deaths = 0;
  while (state.status === 'running') {
    const step = stepCombat(state); state = step.state;
    deaths += step.events.filter(e => e.type === 'death' && e.unitId === 'tank').length;
    if (deaths) {
      const mage = state.units.find(u => u.id === 'ap')!;
      expect(mage.ghostFriends?.healthFlat).toBeGreaterThanOrEqual(5);
      expect(readCombatStats(mage, state).abilityPower).toBeGreaterThanOrEqual(100);
    }
  }
  expect(deaths).toBe(1);
  expect(stepCombat(state)).toEqual({ state, events: [] });
  expect(stepCombat(state).state).toBe(state);
});

it('B5-63 real Last Chance revival and the later death each produce one sampled reward', () => {
  const opening = structuredClone(combat(true));
  Object.assign(opening.units.find(u => u.id === 'tank')!, {hp: 1});
  for (const [i, unit] of opening.units.filter(u => u.team === 'player' && u.id !== 'tank').entries()) Object.assign(unit, {cell: {col: 6, row: 6 + i}, moveCooldownTicks: 999, cooldownTicks: 999, mana: 0});
  const first = stepCombat(opening);
  expect(first.events.some(e => e.type === 'unitRevived' && e.unitId === 'tank'),JSON.stringify({events:first.events.map(e=>e.type),tank:first.state.units.find(u=>u.id==='tank')?.hp,anomaly:first.state.units.find(u=>u.id==='tank')?.mechanics?.filter(m=>m.source.sourceKind==='anomaly')})).toBe(true);
  expect(first.events.filter(e => e.type === 'death' && e.unitId === 'tank')).toHaveLength(1);
  expect(first.state.units.find(u => u.id === 'ap')!.ghostFriends?.healthFlat).toBe(5);
  const later = structuredClone(first.state);
  Object.assign(later.units.find(u => u.id === 'tank')!, {hp: 1, shield: 0, shieldLayers: []});
  Object.assign(later.units.find(u => u.id === 'enemy')!, {cooldownTicks: 0});
  const second = stepCombat(later);
  expect(second.events.filter(e => e.type === 'death' && e.unitId === 'tank')).toHaveLength(1);
  expect(second.state.units.find(u => u.id === 'ap')!.ghostFriends?.healthFlat).toBe(10);
  const samples = augmentDeathsFromEvents([...first.events, ...second.events]).filter(d => d.unitId === 'tank');
  expect(samples).toHaveLength(2); expect(samples[0].eventSeq).not.toBe(samples[1].eventSeq);
});

it('B5-63 independent M5 validation derives growth from deaths rather than matching production receipts', () => {
  const state = {round: 2, multiplayer: {seatId: 's0'}, augments: [{definitionId: 'ghost-of-friends-past', acquiredRound: 1}],
    augmentHistory: {facts: [{kind: 'deaths', round: 1, deaths: [
      {combatId: 'battle', eventSeq: 1, definitionId: 'irelia', unitId: 'same', ownerSeatId: 's0', ordinaryHero: true},
      {combatId: 'battle', eventSeq: 2, definitionId: 'irelia', unitId: 'same', ownerSeatId: 's0', ordinaryHero: true},
      {combatId: 'battle', eventSeq: 3, definitionId: 'darius', ownerSeatId: 's0', ordinaryHero: true},
      {combatId: 'battle', eventSeq: 4, definitionId: 'akali', ownerSeatId: 's0', ordinaryHero: false, championCopy: true},
      {combatId: 'battle', eventSeq: 5, definitionId: 'lux', ownerSeatId: 's1', ordinaryHero: true},
      {combatId: 'battle', eventSeq: 6, definitionId: 'g23-sion', ownerSeatId: 's0', ordinaryHero: false},
    ]}]},
    seatMechanics: {receipts: [{source: 'augment-pool-batch5-g2', healthFlat: 999}]},
    combatInputBasis: {inputs: {ghostFriendsGrowth: {healthFlat: 10, attackDamageBps: 80, abilityPower: 1}}}};
  expect(() => validateGhostCombatInputs(state)).not.toThrow();
  const forged = structuredClone(state); forged.combatInputBasis.inputs.ghostFriendsGrowth.healthFlat = 999;
  expect(() => validateGhostCombatInputs(forged)).toThrow('independent Ghost Friends');
});

it('B5-63 a later Trench champion copy inherits current combat AD/AP without doubling captured health', () => {
  const state = combat(), holder = structuredClone(state.units.find(u => u.id === 'tank')!) as S13Unit;
  holder.ghostFriends = {healthFlat: 15, attackDamageBps: 800, abilityPower: 7};
  holder.maxHp += 15; holder.hp += 15; holder.maxHpBasis = {...holder.maxHpBasis!, flat: holder.maxHpBasis!.flat + 15};
  const source = {ownerId: holder.id, sourceKind: 'item' as const, definitionId: 'TFT5_Item_TrickstersGloves', instanceId: 'coat', effectIndex: 0};
  const copy = createTrenchCopy(holder, {source, mechanic: 'g24Trench', values: {healthBps: 6000}}, 0, {col: 1, row: 4}, 1) as S13Unit;
  const hp = copy.maxHp, ctx = {units: [holder, copy], tick: 1, events: [], board: state.board, combatId: state.combatId, packets: [], heals: []} as unknown as AbilityContext;
  initializeBornUnits(ctx, [copy]);
  expect(copy.ghostFriends).toEqual(holder.ghostFriends);
  expect(copy.maxHp).toBe(hp);
  expect(readCombatStats(copy, {units: ctx.units, tick: 1})).toMatchObject({attackDamage: 48, abilityPower: 107});
});
