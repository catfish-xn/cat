import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES, MADDIE_SHOT_MIN_TICKS, MADDIE_SHOT_TICKS_PER_HEX } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { flightCells, flightTicksFor, hexDistance, withFlight } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { hexDistance as rulesHexDistance } from '../src/simulation/board';
import { hexCenter } from '../src/rendering3d/picking';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Maddie's volley: each shot is drawn with its own damage, not at one estimated time after her cast.
const damage = (eventSeq: number, tick: number, targetId: string, sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick, eventSeq, sourceId: 'md', targetId, damageType: 'physical', sourceKind, delivery, raw: 50, actual: 50 } as unknown as DisplayCombatEvent);
const definitions: Record<string, string> = { md: 'maddie', f1: 'amumu' };

describe('Maddie\'s shots follow their damage', () => {
  it('one shot per damage packet; attacks plan none', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([damage(1, 5, 'f1'), damage(2, 9, 'f1'), damage(3, 12, 'f1', 'attack', 'basic-attack')]);
    expect(plans.map(p => p.extra.filter(x => x.skill === 'maddie-shot').map(x => x.targets))).toEqual([[['f1']], [['f1']], []]);
  });
  it('her cast plays nothing (no fallback to the old placeholder cast effect)', () => {
    const cast = { type: 'cast', sourceId: 'md', eventSeq: 1, tick: 1, actionSeq: 1, completed: true, actualManaSpent: 60, refundedMana: 0,
      targetIds: ['f1'], completionCell: { col: 0, row: 0 } } as DisplayCombatEvent;
    expect(createBatch1VfxEvents(id => definitions[id]).batch([cast])[0]!.noCastEffect).toBe(true);
  });
  it('the shot lands with its hit; her cast list no longer plays them', () => {
    const [shot, hit] = CUE_EXTRA_SKILLS['maddie-shot']!;
    // Both are timed by the same flight by distance: the hit's delay counts from the landing.
    expect(shot!.flightTicks).toEqual({ perCell: MADDIE_SHOT_TICKS_PER_HEX, min: MADDIE_SHOT_MIN_TICKS });
    expect(hit!.flightTicks).toEqual(shot!.flightTicks);
    expect(hit!.delay).toBe(0);
    expect(CUE_OVERRIDES.maddie!.some(c => (c.action ?? 'cast') === 'cast')).toBe(false);
    expect(mapSkillTimeline(CUE_EXTRA_SKILLS['maddie-shot']!, 'md', ['f1']).unsupported).toEqual([]);
  });
  it('real combat: six shots, on the ticks her damage lands', () => {
    const units = realUnits({ unit: 'maddie', star: 2, form: null, foe: 'amumu', dist: 4, nfoes: 2, foestar: 1 } as any);
    const defs: Record<string, string> = Object.fromEntries(units.map((u: any) => [u.id, u.definitionId]));
    const batch = createBatch1VfxEvents(id => defs[id]); let cast = -1; const shots: number[] = [], hits: number[] = [];
    runRealCombat(units, 260, (_s, shown) => {
      for (const e of shown as any[]) {
        if (e.type === 'cast' && e.sourceId === 'me' && cast < 0) cast = e.tick;
        if (cast >= 0 && e.type === 'packetDamage' && e.sourceId === 'me' && e.delivery === 'ability-direct') hits.push(e.tick - cast);
      }
      for (const p of batch.batch(shown)) for (const x of p.extra) if (x.skill === 'maddie-shot' && cast >= 0) shots.push((p.event as any).tick - cast);
    });
    expect(cast).toBeGreaterThan(0);
    expect(shots).toEqual(hits);
    expect(shots.slice(0, 6)).toHaveLength(6);
  });
  it('a shot flies 2 ticks a cell by the rules\' hex distance, at least 4 (fitted; to read the rules\' event once it carries the flight)', () => {
    // Local until the rules' display event carries each shot's flight (arrivalTick, L2): then the renderer reads it and this goes.
    expect([MADDIE_SHOT_TICKS_PER_HEX, MADDIE_SHOT_MIN_TICKS]).toEqual([2, 4]);
    expect([0, 1, 2, 3, 4, 5].map(cells => flightTicksFor(cells, MADDIE_SHOT_TICKS_PER_HEX, MADDIE_SHOT_MIN_TICKS))).toEqual([4, 4, 4, 6, 8, 10]);
    const board = { columns: 7, radius: 34, origin: { x: 0, y: 0 } };
    const at = (col: number, row: number) => { const c = hexCenter({ col, row }, board); return [c.x, 0, c.z] as const; };
    // Straight along a row, and on a slant: 4 cells either way, as the rules count them (8 ticks).
    expect(flightCells(at(1, 3), at(5, 3), board)).toBe(4);
    expect(flightCells(at(2, 4), at(4, 0), board)).toBe(rulesHexDistance({ col: 2, row: 4 }, { col: 4, row: 0 }));
    expect(flightCells(at(2, 4), at(4, 0), board)).toBe(4);
    const [shot, hit] = CUE_EXTRA_SKILLS['maddie-shot']!;
    const flown = withFlight(shot!, flightCells(at(2, 4), at(4, 0), board)), landed = withFlight(hit!, flightCells(at(2, 4), at(4, 0), board));
    expect(flown.travelSeconds).toBeCloseTo(0.4);
    expect(flown.duration).toBeCloseTo(0.4 + shot!.duration - shot!.travelSeconds!);
    expect(landed.delay).toBeCloseTo(0.4);
    // Caster or target gone: the hit still waits the shortest flight instead of landing at once.
    expect(withFlight(hit!, null).delay).toBeCloseTo(0.2);
  });
  it('the local hex distance is the rules\' one', () => {
    for (const [a, b] of [[{ col: 0, row: 0 }, { col: 6, row: 7 }], [{ col: 3, row: 1 }, { col: 2, row: 6 }], [{ col: 5, row: 2 }, { col: 1, row: 5 }]] as const)
      expect(hexDistance(a, b)).toBe(rulesHexDistance(a, b));
  });
});
