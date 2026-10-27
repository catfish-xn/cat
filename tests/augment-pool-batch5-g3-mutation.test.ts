import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUGMENT_BATCH5_G3 } from '../src/simulation/content/augment-pool-batch5-g3';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { mutationSacrificeCell } from '../src/simulation/augment-pool-batch5-g3-mutation';
import { g23Laboratories } from '../src/simulation/g2-3-experiment';
import { readG23MechanismState } from '../src/simulation/g2-3-view';
import { mutationLaboratoryExpected, mutationLabsExpected } from './fixtures/m5/augment-rewards-oracle.cjs';
import type { MatchState } from '../src/simulation/match-types';
import type { Unit } from '../src/simulation/unit-types';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { ITEM_DEFINITIONS } from '../src/simulation/content';

const native = ['zyra', 'urgot', 'nunu', 'drmundo', 'twitch', 'warwick'];
function army(tier: number, donor = 'zyra'): MatchState {
  const state = createMatch(42), labs = mutationLabsExpected(42, tier), sacrifice = { col: 3, row: 6 };
  const used = new Set([...labs, sacrifice].map(c => `${c.col}:${c.row}`));
  const rest = Array.from({ length: 28 }, (_, i) => ({ col: i % 7, row: 4 + Math.floor(i / 7) })).filter(c => !used.has(`${c.col}:${c.row}`));
  const names = [donor, ...native.filter(n => n !== donor).slice(0, tier - 1)];
  if (tier === 7) names.push('darius');
  const units: Unit[] = names.map((name, index) => ({ id: index ? `p${index}` : 'sacrifice', definitionId: name, team: 'player', starLevel: 1,
    location: { kind: 'board', cell: index === 0 ? sacrifice : labs[index - 1] ?? rest[index] } }));
  units.push({ id: 'enemy', definitionId: 'garen', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 6, row: 0 } } });
  return { ...state, level: 9, preparation: { ...state.preparation, units },
    items: tier === 7 ? [{ id: 'emblem', definitionId: 'TFT13_Item_ExperimentEmblemItem', location: { kind: 'unit', unitId: 'p6', slot: 0 } }] : [],
    augments: [{ definitionId: 'natural-selection', choiceId: 'test', acquiredRound: 1 }] };
}
const lab = (u: { mechanics?: readonly { mechanic: string; values: Readonly<Record<string, number>> }[] }) => u.mechanics?.find(m => m.mechanic === 'g23Experiment');

describe('B5-71 物竞天择', () => {
  it.skipIf(!existsSync(RESEARCH_FILE))('matches the 14.24 source', () => {
    const source = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')).find((r: any) => r.apiName === 'TFT13_Augment_Experiment');
    const row = AUGMENT_BATCH5_G3['natural-selection']; expect(row.source.values).toEqual(source.effects); expect(row.description).toBe(source.description_zh_cn);
  });
  it('keeps the 2-1 ban and trait/mutual-exclusion filters at later nodes', () => {
    for (const node of ['2-1', '3-2', '4-2']) for (const fieldedTraits of [[], ['experiment']]) {
      const allowed = node !== '2-1' && fieldedTraits.length > 0, filter = { node, fieldedTraits, blocked: [] };
      expect(augmentOfferAllowed('natural-selection', [], filter)).toBe(allowed);
      expect(augmentCandidates('gold', [], [], null, filter).includes('natural-selection')).toBe(allowed);
      expect(augmentOfferAllowed('natural-selection', [{ definitionId: 'built-different', choiceId: 'old', acquiredRound: 4 }], filter)).toBe(false);
    }
  });
  it.each([3, 5, 7])('tier %i uses a fixed extra square, independent Laboratories, and donates only to Laboratory Experiments', tier => {
    const state = army(tier), before = structuredClone(state), snapshot = buildStrategySnapshot(state), labs = mutationLabsExpected(42, tier);
    expect(mutationSacrificeCell()).toEqual({ col: 3, row: 6 }); expect(mutationSacrificeCell('enemy')).toEqual({ col: 3, row: 1 });
    expect(g23Laboratories(42, 'player', tier, mutationSacrificeCell())).toEqual(labs);
    expect(labs).toHaveLength(tier >= 5 ? 3 : 2); expect(labs).not.toContainEqual(mutationSacrificeCell());
    expect(readG23MechanismState(state)).toMatchObject({ laboratories: labs, mutationSacrificeCell: { col: 3, row: 6 } });
    const normal = state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board' && labs.some(c => u.location.kind === 'board' && c.col === u.location.cell.col && c.row === u.location.cell.row)).map(u => u.definitionId);
    const expected = mutationLaboratoryExpected(tier, 'zyra', normal);
    for (const unit of snapshot.units.filter(u => lab(u))) expect(lab(unit)!.values).toEqual(expected.values);
    expect(snapshot.units.filter(u => lab(u))).toHaveLength(labs.length);
    const combat = createCombatWithEvents(state.preparation, snapshot, `mutation-${tier}`, 42);
    expect(combat.state.units.some(u => u.id === 'sacrifice')).toBe(false);
    expect(combat.events.some(e => e.type === 'death')).toBe(false); expect(state).toEqual(before);
    const without = buildStrategySnapshot({ ...state, augments: [] });
    for (const unit of combat.state.units.filter(u => u.team === 'player')) {
      // Compare the frozen HP basis directly: +1200 Bps belongs to members, never the enemy.
      expect(snapshot.units.find(u => u.unitId === unit.id)!.sources).toContainEqual(expect.objectContaining({ source: expect.objectContaining({ sourceDefinitionId: 'natural-selection' }), effect: { kind: 'statPercentBps', stat: 'maxHp', bps: 1200 } }));
      const basis = unit.maxHpBasis!;
      expect(unit.maxHp).toBe(Math.floor((basis.base + basis.flat) * (10000 + basis.bps) / 10000));
      expect(basis.bps).toBeGreaterThanOrEqual(1200);
    }
    expect(without.units.find(u => u.unitId === 'sacrifice')!.mechanics?.some(m => m.mechanic === 'mutationSacrifice')).toBe(false);
  });
  it.each(native)('%s donates its own bonus, including the 7-tier multiplier and Mundo HP', donor => {
    const state = army(7, donor), labs = mutationLabsExpected(42, 7), snapshot = buildStrategySnapshot(state);
    const normal = state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board' && labs.some(c => u.location.kind === 'board' && c.col === u.location.cell.col && c.row === u.location.cell.row)).map(u => u.definitionId);
    const expected = mutationLaboratoryExpected(7, donor, normal);
    for (const unit of snapshot.units.filter(u => lab(u))) {
      expect(lab(unit)!.values).toEqual(expected.values);
      expect(unit.sources.find(s => s.source.sourceKind === 'trait' && s.source.sourceDefinitionId === 'experiment' && s.effect.kind === 'statFlat')!.effect).toEqual({ kind: 'statFlat', stat: 'maxHp', amount: expected.healthFlat });
    }
  });
  it('can donate a duplicate native bonus again instead of deduplicating the sacrifice with a normal Laboratory', () => {
    const state = army(3), labs = mutationLabsExpected(42, 3);
    const duplicate: Unit = { id: 'duplicate', definitionId: 'zyra', team: 'player', starLevel: 1, location: { kind: 'board', cell: labs[0] } };
    const units = state.preparation.units.map(u => u.id === 'p1' ? { ...u, location: { kind: 'board' as const, cell: { col: 0, row: 4 } } } : u);
    const snapshot = buildStrategySnapshot({ ...state, preparation: { ...state.preparation, units: [...units, duplicate] } });
    expect(lab(snapshot.units.find(u => u.unitId === 'duplicate')!)!.values.zyra).toBe(10000);
  });
  it('empty square and non-Experiment have no sacrifice; non-Laboratory units receive only their own 12% HP', () => {
    for (const mode of ['empty', 'non-member']) {
      const state = army(5), units = mode === 'empty' ? state.preparation.units.filter(u => u.id !== 'sacrifice') : state.preparation.units.map(u => u.id === 'sacrifice' ? { ...u, definitionId: 'darius' } : u);
      const input = { ...state, preparation: { ...state.preparation, units } }, snapshot = buildStrategySnapshot(input), combat = createCombatWithEvents(input.preparation, snapshot, 'empty', 42);
      expect(snapshot.units.some(u => u.mechanics?.some(m => m.mechanic === 'mutationSacrifice'))).toBe(false);
      expect(combat.state.units.some(u => u.id === 'sacrifice')).toBe(mode === 'non-member');
      expect(snapshot.units.filter(u => lab(u)).every(u => lab(u)!.values.zyra === 0)).toBe(true);
      if (mode === 'non-member') expect(snapshot.units.find(u => u.unitId === 'sacrifice')!.sources.some(s => s.source.sourceDefinitionId === 'natural-selection')).toBe(false);
    }
  });
  it('keeps equipment/anomaly on the formal unit, suppresses their opening/clone/death effects, and shares emblem donation', () => {
    const state = army(3), items: MatchState['items'] = [
      { id: 'copy', definitionId: 'TFT13_Item_ExperimentEmblemItem', location: { kind: 'unit', unitId: 'sacrifice', slot: 0 } },
      { id: 'support', definitionId: 'TFT_Item_LocketOfTheIronSolari', location: { kind: 'unit', unitId: 'sacrifice', slot: 1 } },
      { id: 'portal', definitionId: 'TFT5_Item_ZzRotPortalRadiant', location: { kind: 'unit', unitId: 'sacrifice', slot: 2 } },
    ];
    for (const item of items) expect(ITEM_DEFINITIONS[item.definitionId]).toBeDefined();
    const input = { ...state, items, anomalyBinding: { unitId: 'sacrifice', definitionId: 'ultimate-hero', choiceId: 'anomaly', boundRound: 1 } }, before = structuredClone(input);
    const snapshot = buildStrategySnapshot(input), combat = createCombatWithEvents(input.preparation, snapshot, 'emblem', 42);
    expect(combat.state.units.some(u => u.id === 'sacrifice' || u.itemSummon?.ownerId === 'sacrifice')).toBe(false);
    expect(combat.state.units.filter(u => lab(u)).every(u => u.mechanics?.some(m => m.mechanic === 'g23ExperimentClone'))).toBe(true);
    expect(combat.state.units.flatMap(u => u.sources ?? []).some(s => s.source.sourceInstanceId === 'support' || s.source.sourceInstanceId === 'anomaly')).toBe(false);
    expect(stepCombat(combat.state).events.some(e => e.type === 'death' && e.unitId === 'sacrifice')).toBe(false);
    expect(input).toEqual(before);
  });
  it('sacrifices an emblem Jayce without creating his Forge or a death/clone event', () => {
    const state = army(3), input = { ...state, preparation: { ...state.preparation, units: state.preparation.units.map(u => u.id === 'sacrifice' ? { ...u, definitionId: 'jayce' } : u) },
      items: [{ id: 'emblem', definitionId: 'TFT13_Item_ExperimentEmblemItem', location: { kind: 'unit' as const, unitId: 'sacrifice', slot: 0 } }] };
    const start = createCombatWithEvents(input.preparation, buildStrategySnapshot(input), 'jayce-sacrifice', 42);
    expect(start.state.units.some(u => u.id === 'sacrifice' || u.definitionId === 'g23-forge' || u.itemSummon?.ownerId === 'sacrifice')).toBe(false);
    expect(start.events.some(e => e.type === 'death' || e.type === 'unitSpawned')).toBe(false);
  });
});
