import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES, MADDIE_SHOT_MIN_TICKS, MADDIE_SHOT_TICKS_PER_HEX } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { flightTicksFor, withFlight } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { BOARD_CELL } from '../src/rendering/three-mode/vfx-ltk/fx-size';
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
  it('a shot flies 2 ticks a cell, at least 4 (fitted; to import the rules\' constant once it lands)', () => {
    // To be replaced by src/simulation/cast-windup.ts maddieShotFlightTicks once the rules carry it (L2).
    expect([MADDIE_SHOT_TICKS_PER_HEX, MADDIE_SHOT_MIN_TICKS]).toEqual([2, 4]);
    expect([0.5, 1, 2, 3, 4, 5].map(cells => flightTicksFor(cells, MADDIE_SHOT_TICKS_PER_HEX, MADDIE_SHOT_MIN_TICKS))).toEqual([4, 4, 4, 6, 8, 10]);
    const [shot, hit] = CUE_EXTRA_SKILLS['maddie-shot']!;
    const from = [0, 0, 0] as const, to = [4 * BOARD_CELL, 0, 0] as const;
    const flown = withFlight(shot!, from, to), landed = withFlight(hit!, from, to);
    expect(flown.travelSeconds).toBeCloseTo(0.4);
    expect(flown.duration).toBeCloseTo(0.4 + shot!.duration - shot!.travelSeconds!);
    expect(landed.delay).toBeCloseTo(0.4);
  });
});
