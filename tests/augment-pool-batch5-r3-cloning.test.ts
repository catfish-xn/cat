import { expect, it } from 'vitest';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { readCombatStrategyInputs } from '../src/simulation/combat-input';
import { deployMatchUnit, rerollAugment, selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { compileBattle, restoreBattleInput, startTwoSidedCombat } from '../src/simulation/two-sided-battle';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { r3Opening, rewardPlan } from './fixtures/m5/augment-rewards-oracle.cjs';
import { accepted, reachRound } from './match-helpers';

export function acquireCloning(): MatchState {
  let s = reachRound('2-1', false, 12);
  const c = s.pendingChoice!;
  s = accepted(rerollAugment(s, c.choiceId, c.generation, 0));
  s = accepted(rerollAugment(s, c.choiceId, s.pendingChoice!.generation, 1));
  expect(s.pendingChoice!.offers).toContain('cloning-facility');
  return accepted(selectChoice(s, c.choiceId, s.pendingChoice!.generation, 'cloning-facility'));
}

it('B5-74 is gold at all three nodes and both independent pools agree', () => {
  for (const node of ['2-1', '3-2', '4-2']) {
    const filter = { node, fieldedTraits: [], blocked: [] };
    expect(augmentOfferAllowed('cloning-facility', [], filter)).toBe(true);
    expect(augmentCandidates('gold', [], [], null, filter)).toContain('cloning-facility');
    expect(augmentPool('gold', [], [], `round:${node}:augment`)).toContain('cloning-facility');
    expect(augmentCandidates('silver', [], [], null, filter)).not.toContain('cloning-facility');
    expect(augmentCandidates('gold', [{ definitionId: 'cloning-facility', choiceId: 'owned', acquiredRound: 4 }], [], null, filter)).not.toContain('cloning-facility');
  }
});

it('real reroll, selection, deployment and start create exactly one temporary copy; save restores and rejects tampering', () => {
  let s = acquireCloning();
  const owner = s.preparation.units.find(u => u.team === 'player')!;
  s = accepted(deployMatchUnit(s, owner.id, { kind: 'board', cell: { col: 3, row: 6 } }));
  const before = s, result = startMatchCombat(s);
  s = accepted(result);
  if (!result.ok) throw new Error(result.reason);
  const copy = s.combat!.units.find(u => u.itemSummon?.kind === 'cloning-facility')!;
  expect(copy).toBeDefined();
  const expected = r3Opening(readCombatStrategyInputs(before), s.combat!.units)[0];
  expect({ ...copy, ownerId: copy.itemSummon?.ownerId }).toMatchObject(expected);
  expect(copy.sources?.some(x => x.source.sourceKind === 'item' || x.source.sourceKind === 'anomaly')).toBe(false);
  expect(result.events.filter(e => e.type === 'unitSpawned' && e.unitId === copy.id)).toHaveLength(1);
  expect(s.preparation).toEqual(before.preparation); expect(s.items).toEqual(before.items);
  expect(s.resourceProvenance).toEqual(before.resourceProvenance);
  expect(rewardPlan(s, {})).toEqual({ gifts: [], gold: [] });
  for (let tick = 0; tick < 4; tick++) s = stepMatch(s).state;
  for (const input of [s, JSON.stringify(s), serializeMatch(s)]) {
    const restored = restoreMatch(input); expect(restored).toEqual(s); expect(stepMatch(restored)).toEqual(stepMatch(s));
  }
  for (const mutate of [
    (x: any) => { x.combat.units.find((u: any) => u.id === copy.id).maxHp++; },
    (x: any) => { x.combat.units.find((u: any) => u.id === copy.id).maxMana++; },
    (x: any) => { x.combat.units.find((u: any) => u.id === copy.id).starLevel = 3; },
    (x: any) => { x.combat.units.find((u: any) => u.id === copy.id).itemSummon.healthBps = 10000; },
    (x: any) => { x.combat.strategy.traits.find((t: any) => t.team === 'player').count++; },
    (x: any) => { x.combat.units = x.combat.units.filter((u: any) => u.id !== copy.id); },
  ]) {
    const bad = structuredClone(s); mutate(bad);
    expect(() => restoreMatch(bad)).toThrow(); expect(() => restoreMatch(JSON.stringify(bad))).toThrow();
  }
});

it('keeps same star and form, counts the copy, has no equipment/growth/anomaly, and samples fully buffed opening health', () => {
  const base = acquireCloning();
  const s: MatchState = { ...base, preparation: { ...base.preparation, units: [
    { id: 'unit-1', definitionId: 'tristana', starLevel: 2, team: 'player', location: { kind: 'board', cell: { col: 3, row: 6 } } },
    { id: 'unit-2', definitionId: 'darius', starLevel: 1, team: 'enemy', location: { kind: 'board', cell: { col: 3, row: 1 } } },
  ] }, items: [{ id: 'item-1', definitionId: 'warmog', location: { kind: 'unit', unitId: 'unit-1', slot: 0 } }],
    persistentGrowth: [{ unitId: 'unit-1', attackDamageBps: 1250 }],
    anomalyBinding: { unitId: 'unit-1', definitionId: 'giant-sized', choiceId: 'test-anomaly', boundRound: 4 } };
  const strategy = buildStrategySnapshot(s), combat = createCombatWithEvents(s.preparation, strategy, 'numeric', 42).state;
  const owner = combat.units.find(u => u.id === 'unit-1')!, copy = combat.units.find(u => u.itemSummon?.kind === 'cloning-facility')!;
  // Tristana2: 990 base +600 Warmog +1000 anomaly, times 1.12, then copy times .70.
  expect(owner.maxHp).toBe(2900); expect(copy.maxHp).toBe(2030);
  // Counted copy activates Artillerist 2 (+10% AD); permanent +12.5% belongs to the owner only.
  expect(copy.maxMana).toBe(72); expect(copy.attackDamage).toBe(69); expect(owner.attackDamage).toBe(77);
  expect(copy.starLevel).toBe(2);
  expect(copy.sources?.some(x => ['item', 'anomaly'].includes(x.source.sourceKind) || x.source.sourceDefinitionId === 'tristana-ability')).toBe(false);
  expect(strategy.traits.find(t => t.team === 'player' && t.traitId === 'artillerist')).toMatchObject({ count: 2, tier: 2 });
  expect(copy.mechanics?.some(m => m.source.sourceKind === 'trait' && m.source.definitionId === 'artillerist')).toBe(true);
  let later = combat; for (let n = 0; n < 20 && later.status === 'running'; n++) later = stepCombat(later).state;
  expect(later.units.find(u => u.id === copy.id)!.maxHp).toBe(2030);
});

it('two-sided compilation mirrors each owner local clone cell and authenticates all derived fields', () => {
  let s = acquireCloning(); const owner = s.preparation.units.find(u => u.team === 'player')!;
  s = accepted(deployMatchUnit(s, owner.id, { kind: 'board', cell: { col: 3, row: 6 } }));
  const input = compileBattle(snapshotForBattle(s, 'A'), snapshotForBattle(s, 'B'), 42);
  expect(restoreBattleInput(JSON.stringify(input))).toEqual(input);
  const combat = startTwoSidedCombat(input), copies = combat.units.filter(u => u.itemSummon?.kind === 'cloning-facility');
  expect(copies).toHaveLength(2);
  expect(copies.map(u => [u.team, u.cell])).toEqual([['player', { col: 2, row: 5 }], ['enemy', { col: 2, row: 2 }]]);
  expect(new Set(combat.units.map(u => u.cell.col + ':' + u.cell.row)).size).toBe(combat.units.length);
  for (const mutate of [
    (x: any) => { x.strategy.units.find((u: any) => u.itemSummon?.kind === 'cloning-facility').stats.health++; },
    (x: any) => { x.strategy.traits.find((t: any) => t.team === 'player').count++; },
    (x: any) => { x.preparation.units.find((u: any) => u.id === copies[0].id).location.cell.col++; },
  ]) { const bad = structuredClone(input); mutate(bad); expect(() => restoreBattleInput(bad)).toThrow(); }
});

it('retains the promoted fourth rank without copying the anomaly declaration or permanent ownership', () => {
  const base = acquireCloning();
  const input = { ...readCombatStrategyInputs(base),
    preparation: { ...base.preparation, units: [
      { id: 'unit-1', definitionId: 'violet', starLevel: 3 as const, team: 'player' as const, location: { kind: 'board' as const, cell: { col: 3, row: 6 } } },
      { id: 'unit-2', definitionId: 'darius', starLevel: 1 as const, team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: 3, row: 1 } } },
    ] }, items: [], d14Combat: { unitId: 'unit-1', anomalyId: 'ultimate-hero' as const, phase: 'promoted' as const },
    anomalyBinding: { unitId: 'unit-1', definitionId: 'ultimate-hero', choiceId: 'anomaly', boundRound: 4 },
  };
  const strategy = buildStrategySnapshot(input), copy = strategy.units.find(u => u.itemSummon?.kind === 'cloning-facility')!;
  const owner = strategy.units.find(u => u.unitId === 'unit-1')!;
  expect(copy.effectiveStarLevel).toBe(4); expect(copy.ability).toEqual(owner.ability);
  expect(copy.itemSummon!.unit.starLevel).toBe(3);
  expect(copy.sources.some(s => s.source.sourceKind === 'anomaly')).toBe(false);
});

it('retains the source ranged form even when the only vacant clone cell lies in the front row', () => {
  const base = acquireCloning();
  const units = Array.from({ length: 28 }, (_, i) => ({ id: `unit-${i+1}`, definitionId: i === 17 ? 'jayce' : 'vander',
    starLevel: 2 as const, team: 'player' as const, location: { kind: 'board' as const, cell: { col: i % 7, row: 4 + Math.floor(i/7) } } })).filter(u => u.id !== 'unit-1');
  const input = { ...readCombatStrategyInputs(base), preparation: { ...base.preparation, units }, items: [] };
  const combat = createCombatWithEvents(input.preparation, buildStrategySnapshot(input), 'form-no-space', 42).state;
  const copy = combat.units.find(u => u.itemSummon?.kind === 'cloning-facility')!;
  expect(copy.cell).toEqual({ col: 0, row: 4 }); expect(copy.form).toBe('ranged');
  expect(copy.ability).toMatchObject({ championId: 'jayce-ranged' });
  expect(new Set(combat.units.map(u => u.cell.col+':'+u.cell.row)).size).toBe(combat.units.length);
});

it('samples Cloning Facility HP after an equipped Garen broadcasts opening health', () => {
  const base = acquireCloning(), input = { ...readCombatStrategyInputs(base),
    preparation: { ...base.preparation, units: [
      { id: 'unit-1', definitionId: 'lux', starLevel: 2 as const, team: 'player' as const, location: { kind: 'board' as const, cell: { col: 3, row: 6 } } },
      { id: 'unit-2', definitionId: 'garen', starLevel: 1 as const, team: 'player' as const, location: { kind: 'board' as const, cell: { col: 2, row: 6 } } },
      { id: 'unit-3', definitionId: 'darius', starLevel: 1 as const, team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: 3, row: 1 } } },
    ] }, items: [{ id: 'item-1', definitionId: 'warmog', location: { kind: 'unit' as const, unitId: 'unit-2', slot: 0 } }],
  };
  const combat = createCombatWithEvents(input.preparation, buildStrategySnapshot(input), 'garen-cloning', 42).state;
  // Garen is the sole Emissary: floor((1000+600)*1.12)=1792, sharing floor(1792*.12)=215 to Lux2 (900 HP).
  expect(combat.units.find(u => u.id === 'unit-1')!.maxHp).toBe(1115);
  expect(combat.units.find(u => u.itemSummon?.kind === 'cloning-facility')!.maxHp).toBe(780);
});
