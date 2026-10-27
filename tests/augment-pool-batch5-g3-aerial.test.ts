import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUGMENT_BATCH5_G3 } from '../src/simulation/content/augment-pool-batch5-g3';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { ad, ap, type S13Unit } from '../src/simulation/combat-s13-state';
import { recordAerialMovement, startAerialDash } from '../src/simulation/augment-pool-batch5-g3-combat';
import { advanceG2Passives } from '../src/simulation/combat-g2';
import { relocate } from '../src/simulation/anomalies/shared';
import { knockAway } from '../src/simulation/combat-displacement';
import { aerialWarfareExpected } from './fixtures/m5/augment-rewards-oracle.cjs';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import type { MatchState } from '../src/simulation/match-types';
import { RESEARCH_FILE } from './augment-pool-source-expectations';

function fixture(): MatchState {
  const state = createMatch(42);
  return { ...state, augments: [{ definitionId: 'aerial-warfare', choiceId: 'test', acquiredRound: 1 }],
    preparation: { ...state.preparation, units: [
      { id: 'zeri', definitionId: 'zeri', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 7 } } },
      { id: 'scar', definitionId: 'scar', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 4 } } },
      { id: 'other', definitionId: 'garen', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 6, row: 7 } } },
      { id: 'enemy', definitionId: 'garen', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 0, row: 0 } } },
    ] } };
}
function context(): AbilityContext {
  const state = fixture(), combat = createCombatWithEvents(state.preparation, buildStrategySnapshot(state), 'g3', 42).state;
  return { tick: 1, combatId: combat.combatId, board: combat.board, units: structuredClone(combat.units) as S13Unit[], events: [], packets: [], heals: [], draw: () => 0 };
}

describe('B5-68 空战', () => {
  it.skipIf(!existsSync(RESEARCH_FILE))('uses the archived 14.24 source', () => {
    const source = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')).find((r: any) => r.apiName === 'TFT13_Augment_Firelight');
    const row = AUGMENT_BATCH5_G3['aerial-warfare'];
    expect(row.source.values).toEqual(source.effects); expect(row.description).toBe(source.description_zh_cn); expect(row.name).toBe(source.name_zh_cn);
  });
  it('preserves tailoring at all offer nodes', () => {
    for (const node of ['2-1', '3-2', '4-2']) {
      for (const fieldedTraits of [[], ['firelight']]) {
        const allowed = node === '2-1' || fieldedTraits.length > 0, filter = { node, fieldedTraits, blocked: [] };
        expect(augmentOfferAllowed('aerial-warfare', [], filter)).toBe(allowed);
        expect(augmentCandidates('gold', [], [], null, filter).includes('aerial-warfare')).toBe(allowed);
      }
    }
  });
  it('compiles for native and emblem Firelights below the trait threshold, excludes outsiders', () => {
    const state = fixture(), snapshot = buildStrategySnapshot(state);
    expect(snapshot.units.filter(u => u.mechanics?.some(m => m.mechanic === 'aerialWarfare')).map(u => u.unitId).sort()).toEqual(['scar', 'zeri']);
    const emblem = { id: 'emblem', definitionId: 'TFT13_Item_HoverboardEmblemItem', location: { kind: 'unit' as const, unitId: 'other', slot: 0 } };
    expect(buildStrategySnapshot({ ...state, items: [emblem] }).units.find(u => u.unitId === 'other')!.mechanics?.some(m => m.mechanic === 'aerialWarfare')).toBe(true);
    const one = { ...state, preparation: { ...state.preparation, units: state.preparation.units.filter(u => u.id !== 'scar') } };
    expect(buildStrategySnapshot(one).units.find(u => u.unitId === 'zeri')!.mechanics?.some(m => m.mechanic === 'aerialWarfare')).toBe(true);
  });
  it('adds 3% base AD and 3 AP per hex, caps only hex stacks at 99, and adds every 9%/9 dash', () => {
    const ctx = context(), unit = ctx.units.find(u => u.id === 'zeri')!, baseAttack = ad(unit), baseAp = ap(unit, 1);
    const moves: { from: { col: number; row: number }; to: { col: number; row: number } }[] = [];
    for (let index = 0; index < 60; index++) {
      const to = { col: index % 2 ? 3 : 5, row: 7 }; moves.push({ from: unit.cell, to });
      recordAerialMovement(ctx, unit, to); unit.cell = to;
    }
    for (let i = 0; i < 40; i++) startAerialDash(ctx, unit);
    const expected = aerialWarfareExpected(moves, 40);
    expect(unit.aerialWarfare).toEqual({ hexes: 99, dashes: 40 });
    expect(ad(unit)).toBe(Math.floor(baseAttack * (10000 + expected.adBps) / 10000));
    expect(ap(unit, 1)).toBe(baseAp + expected.ap);
    expect(expected).toEqual({ hexes: 99, adBps: 65700, ap: 657 });
    const outsider = ctx.units.find(u => u.id === 'other')!; recordAerialMovement(ctx, outsider, { col: 0, row: 7 }); startAerialDash(ctx, outsider);
    expect(outsider.aerialWarfare).toBeUndefined();
  });
  it('counts teleports and forced displacement immediately, while blocked and zero-distance moves add nothing', () => {
    const ctx = context(), unit = ctx.units.find(u => u.id === 'zeri')!;
    relocate(ctx, unit, { col: 5, row: 7 }); expect(unit.aerialWarfare).toEqual({ hexes: 2, dashes: 0 });
    relocate(ctx, unit, unit.cell); expect(unit.aerialWarfare!.hexes).toBe(2);
    ctx.units.find(u => u.id === 'other')!.cell = { col: 0, row: 7 };
    const enemy = ctx.units.find(u => u.id === 'enemy')!; enemy.cell = { col: 3, row: 7 };
    knockAway(ctx, enemy, unit, 2, 'sevika-knockback'); expect(unit.cell).toEqual({ col: 6, row: 7 }); expect(unit.aerialWarfare!.hexes).toBe(3);
  });
  it('rewards successive scheduled Firelight dash starts, including an immobile dash', () => {
    const ctx = context(), unit = ctx.units.find(u => u.id === 'zeri')!;
    for (const tick of [120, 240, 360]) { ctx.tick = tick; advanceG2Passives(ctx, () => tick); }
    expect(unit.aerialWarfare!.dashes).toBe(3);
    expect(ctx.events.filter(e => e.type === 'statChanged' && e.unitId === unit.id && e.source.definitionId === 'aerial-warfare').length).toBeGreaterThanOrEqual(6);
    const blocked = context(), holder = blocked.units.find(u => u.id === 'zeri')!, template = blocked.units.find(u => u.id === 'other')!;
    for (let row = 0; row < 8; row++) for (let col = 0; col < 7; col++) if (!blocked.units.some(u => u.cell.col === col && u.cell.row === row)) blocked.units.push({ ...structuredClone(template), id: `block-${col}-${row}`, cell: { col, row } });
    blocked.tick = 120; const before = { ...holder.cell }; advanceG2Passives(blocked, () => 1);
    expect(holder.cell).toEqual(before); expect(holder.aerialWarfare).toEqual({ hexes: 0, dashes: 1 });
    expect(blocked.events.some(e => e.type === 'movement' && e.unitId === holder.id)).toBe(false);
  });
  it('real walk steps keep the previous checkpoint immutable, reproduce after JSON, and start the next battle without stacks', () => {
    const state = fixture(), initial = createCombatWithEvents(state.preparation, buildStrategySnapshot(state), 'g3', 42).state, before = structuredClone(initial);
    const first = stepCombat(initial);
    expect(initial).toEqual(before); expect(first).toEqual(stepCombat(JSON.parse(JSON.stringify(initial))));
    expect(first.state.units.some(u => (u.aerialWarfare?.hexes ?? 0) > 0)).toBe(true);
    expect(createCombatWithEvents(state.preparation, buildStrategySnapshot(state), 'g3-next', 42).state.units.every(u => u.aerialWarfare === undefined)).toBe(true);
  });
});
