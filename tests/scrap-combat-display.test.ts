import { describe, expect, it } from 'vitest';
import { createMatch, equipItem } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents } from '../src/simulation/combat';
import type { Unit } from '../src/simulation/unit-types';

function scrapSeat() {
  const base = createMatch(42);
  const units: Unit[] = ['trundle', 'powder'].map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId, team: 'player', starLevel: 1,
    location: { kind: 'board', cell: { col: i, row: 4 } } }));
  return { ...base, preparation: { ...base.preparation, units }, items: [{ id: 'item-1', definitionId: 'sword', location: { kind: 'unit' as const, unitId: 'unit-1', slot: 0 } }] };
}

describe('Scrap 2 combat-only conversion', () => {
  it('compiles sword into Bloodthirster and applies its stats and combat mechanics without changing assets', () => {
    const state = scrapSeat(), before = JSON.stringify(state);
    const strategy = buildStrategySnapshot(state), holder = strategy.units.find(u => u.unitId === 'unit-1')!;
    expect(strategy.traits.find(t => t.traitId === 'scrap' && t.team === 'player')?.tier).toBe(2);
    expect([...new Set(holder.sources.filter(s => s.source.sourceKind === 'item' && s.source.sourceInstanceId === 'item-1').map(s => s.source.sourceDefinitionId))]).toEqual(['bloodthirster']);
    const explicit = { ...state, items: state.items.map(i => ({ ...i, definitionId: 'bloodthirster' })) };
    const full = buildStrategySnapshot(explicit).units.find(u => u.unitId === 'unit-1')!;
    expect(holder.stats).toEqual(full.stats);
    expect(holder.itemPrograms).toEqual(full.itemPrograms);
    const combat = createCombatWithEvents(state.preparation, strategy, 'scrap-test', 42).state;
    const equipped = combat.units.find(u => u.id === 'unit-1')!;
    const plain = createCombatWithEvents(state.preparation, buildStrategySnapshot({ ...state, items: [] }), 'plain', 42).state.units.find(u => u.id === 'unit-1')!;
    expect(equipped.attackDamage).toBeGreaterThan(plain.attackDamage);
    expect(equipped.itemPrograms?.some(p => p.source.definitionId === 'bloodthirster')).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });
});

import { CombatStream } from '../src/server/room/combat-stream';
import { ScrapDisplay } from '../src/server/room/scrap-display';
import { compileBattle, snapshotForBattle } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { combatEquipmentDisplay } from '../src/presentation/battle-equipment';
import { gearText, NO_GEAR_EXTRAS } from '../src/presentation/equipment-feedback';
import { applyCombatReplayTick, toCombatViewState } from '../src/presentation/combat-display';
import { createUnitOverhead, DEFAULT_METER_COLORS } from '../src/rendering/three-mode/unit-overhead';
import { toCombatReplayFor, startReplaySpotCheck } from '../src/server/room/projection';
import type { RoomState } from '../src/server/room/types';
import { annotate } from '../src/presentation/trait-display-text';

function onlineSeat() {
  const state = scrapSeat(), round = getCatalogRoundById('4-1');
  return { ...state, level: 4, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...state.m8, round }, nextUnitSerial: 3, nextItemSerial: 2 };
}
const shown = (equipment: Parameters<typeof combatEquipmentDisplay>[0]) => combatEquipmentDisplay(equipment, ['sword'], NO_GEAR_EXTRAS);

describe('multiplayer Scrap display projection', () => {
  it('sends converted equipment to both player perspectives and 3D overhead/tooltip consumers, including reconnect keyframes', () => {
    const a = onlineSeat(), b = onlineSeat(), before = JSON.stringify([a, b]);
    const stream = new CombatStream({ battleId: 'scrap-online', roomId: 'test', round: a.round, roundId: a.roundDefinitionId, roundKind: 'pvp', roomRevision: 1,
      battleSeed: 42, maxSteps: 1201, seats: [{ seatId: 'A', state: a }, { seatId: 'B', state: b }], mirrorOf: null });
    for (const seatId of ['A', 'B']) {
      const view = stream.view(seatId)!;
      for (const unit of view.initial.units.filter(u => u.definitionId === 'trundle')) {
        const gear = shown(unit.equipment);
        expect(gear.equipped.concat(gear.extras.temporary)).toEqual(['bloodthirster']);
        expect(gearText(gear.equipped, gear.extras, id => id)).toBe('临时 bloodthirster');
        const overhead = createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture: async () => null });
        overhead.set(unit.team, undefined, gear.equipped.concat(gear.extras.temporary).map(id => ({ id, icon: null })));
        expect(overhead.object.getObjectByName('render3d-overhead-items')!.children.map(c => c.name)).toEqual(['render3d-overhead-item-bloodthirster']);
        overhead.dispose();
      }
    }
    for (let i = 0; i < 20 && !stream.done; i++) stream.advancePvp();
    const view = stream.view('B')!, keyframe = view.ticks.find(t => t.keyframe)?.keyframe;
    expect(keyframe).toBeDefined();
    expect(keyframe!.units.find(u => u.definitionId === 'trundle')!.equipment?.[0].definitionId).toBe('bloodthirster');
    const replayed = view.ticks.reduce(applyCombatReplayTick, view.initial);
    expect(replayed.units.find(u => u.definitionId === 'trundle')!.equipment?.[0].definitionId).toBe('bloodthirster');
    while (!stream.done) stream.advancePvp();
    const complete = toCombatReplayFor({ battles: [stream.result!] } as RoomState, 'B')!;
    expect(complete.replay.terminal).toEqual(stream.view('B')!.terminal);
    expect(complete.replay.initial).toEqual(stream.view('B')!.initial);
    expect(complete.replay.ticks).toEqual(stream.view('B')!.ticks);
    const audit = startReplaySpotCheck([stream.result!], 0, true)!;
    expect(audit.advance(1201)?.[0].firstDifference).toBeNull();
    expect(JSON.stringify([a, b])).toBe(before);
    expect(shown(undefined).equipped).toEqual(['sword']); // preparation fallback is unchanged
  }, 30_000);
  it('updates the display on the accepted effective tick and clears a previous conversion when its component is combined', () => {
    const a = onlineSeat(), input = compileBattle(snapshotForBattle(a, 'A'), snapshotForBattle(a, 'B'), 42, { battleId: 'display-input' });
    const display = ScrapDisplay.pvp(input, a.round), initial = toCombatViewState(createCombatWithEvents(input.preparation, input.strategy, 'display-input', 42).state);
    const id = input.mapping.find(m => m.kind === 'unit' && m.seatId === 'A' && m.originalId === 'unit-1')!.combatId;
    display.queue(1, 'A', { ...a, items: a.items.map(i => ({ ...i, definitionId: 'giant-slayer' })) });
    expect(display.state(initial).units.find(u => u.id === id)!.equipment?.[0].definitionId).toBe('bloodthirster');
    const frame = display.frame({ tick: 1, events: [] });
    expect(applyCombatReplayTick(display.state(initial), frame).units.find(u => u.id === id)!.equipment).toEqual([{ definitionId: 'giant-slayer', slot: 0, temporary: false }]);
  });
  it('uses the authoritative next tick when a player equips a component during multiplayer combat', () => {
    const base = onlineSeat();
    const a = { ...base, items: base.items.map(i => ({ ...i, location: { kind: 'inventory' as const } })) };
    const stream = new CombatStream({ battleId: 'scrap-equip', roomId: 'test', round: a.round, roundId: a.roundDefinitionId, roundKind: 'pvp', roomRevision: 1,
      battleSeed: 42, maxSteps: 1201, seats: [{ seatId: 'A', state: a }, { seatId: 'B', state: base }], mirrorOf: null });
    const id = stream.view('A')!.unitIds.find(i => i.originalId === 'unit-1')!.combatId;
    const equipped = equipItem(a, 'item-1', 'unit-1', 0); if (!equipped.ok) throw Error(equipped.reason);
    stream.queueEquipment({ kind: 'equipment', seq: 1, effectiveTick: 1, seatId: 'A', itemId: 'item-1', unitId: 'unit-1', slot: 0 }, a, equipped.state);
    expect(stream.view('A')!.initial.units.find(u => u.id === id)!.equipment).toBeUndefined();
    stream.advancePvp();
    const view = stream.view('A')!;
    const tick = view.ticks[1]!;
    expect(applyCombatReplayTick(view.initial, tick).units.find(u => u.id === id)!.equipment).toEqual([{ definitionId: 'bloodthirster', slot: 0, temporary: true }]);
    expect(equipped.state.items[0].definitionId).toBe('sword');
  });
  it('also projects Scrap in an online PvE battle without requiring an already-open input basis', () => {
    const state = scrapSeat(), strategy = buildStrategySnapshot(state), initial = toCombatViewState(createCombatWithEvents(state.preparation, strategy, 'pve', 42).state);
    expect(ScrapDisplay.pve(state, strategy, state.round).state(initial).units.find(u => u.id === 'unit-1')!.equipment).toEqual([{ definitionId: 'bloodthirster', slot: 0, temporary: true }]);
  });
  it('explains the conversion counts and preparation appearance in the Scrap tooltip', () => {
    expect(annotate('scrap', '')).toContain('2极客最多1个，4极客最多3个');
    expect(annotate('scrap', '')).toContain('备战阶段仍显示原散件');
  });
});
