import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES, MADDIE_HIT_SCALE } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { hexDistance, withFlightSeconds } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { hexDistance as rulesHexDistance } from '../src/simulation/board';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Maddie's volley: each shot is drawn from the rules' projectile events: its flight from the launch, its hit on the landing.
const damage = (eventSeq: number, tick: number, targetId: string, sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick, eventSeq, sourceId: 'md', targetId, damageType: 'physical', sourceKind, delivery, raw: 50, actual: 50 } as unknown as DisplayCombatEvent);
const launched = (eventSeq: number, tick: number, targetId: string, arrivalTick: number): DisplayCombatEvent =>
  ({ type: 'abilityProjectileLaunched', tick, eventSeq, sourceId: 'md', targetId, arrivalTick, skill: 'maddie-shot', ordinal: 0, actionSeq: 1, count: 6 } as unknown as DisplayCombatEvent);
const landed = (eventSeq: number, tick: number, targetId: string, hit: boolean): DisplayCombatEvent =>
  ({ type: 'abilityProjectileLanded', tick, eventSeq, sourceId: 'md', targetId, skill: 'maddie-shot', ordinal: 0, actionSeq: 1, count: 6, hit } as unknown as DisplayCombatEvent);
const definitions: Record<string, string> = { md: 'maddie', f1: 'amumu' };

describe('Maddie\'s shots follow the rules\' projectile events', () => {
  it('a launch flies for the rule\'s flight, a landing that hit plays the hit, one on a dead target none; damage plans none', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([launched(1, 5, 'f1', 11), landed(2, 11, 'f1', true), landed(3, 14, 'f1', false),
      damage(4, 11, 'f1'), damage(5, 12, 'f1', 'attack', 'basic-attack')]);
    expect(plans.map(p => p.extra.map(x => [x.skill, x.targets, x.flightSeconds]))).toEqual([
      [['maddie-shot-flight', ['f1'], expect.closeTo(0.3, 5)]], [['maddie-shot-land', ['f1'], undefined]], [], [], []]);
  });
  it('her shot\'s hit draws at MADDIE_HIT_SCALE and her shot itself keeps its size', () => {
    expect(CUE_EXTRA_SKILLS['maddie-shot-land']!.find(c => c.system === 'b1b77889')!.scale).toBe(MADDIE_HIT_SCALE);
    expect(MADDIE_HIT_SCALE).toBeGreaterThan(0); expect(MADDIE_HIT_SCALE).toBeLessThan(1);
    expect(CUE_EXTRA_SKILLS['maddie-shot-flight']!.find(c => c.system === 'f0aa0d95')!.scale).toBeUndefined();
  });
  it('her cast plays nothing (no fallback to the old placeholder cast effect)', () => {
    const cast = { type: 'cast', sourceId: 'md', eventSeq: 1, tick: 1, actionSeq: 1, completed: true, actualManaSpent: 60, refundedMana: 0,
      targetIds: ['f1'], completionCell: { col: 0, row: 0 } } as DisplayCombatEvent;
    expect(createBatch1VfxEvents(id => definitions[id]).batch([cast])[0]!.noCastEffect).toBe(true);
  });
  it('the flight takes the rule\'s time; the hit plays at its landing; her cast list no longer plays them', () => {
    const [shot] = CUE_EXTRA_SKILLS['maddie-shot-flight']!, [hit] = CUE_EXTRA_SKILLS['maddie-shot-land']!;
    const flown = withFlightSeconds(shot!, 0.4);
    expect(flown.travelSeconds).toBeCloseTo(0.4);
    expect(flown.duration).toBeCloseTo(0.4 + shot!.duration - shot!.travelSeconds!);
    expect(withFlightSeconds(hit!, 0.4)).toBe(hit);
    expect(hit!.delay).toBe(0);
    expect(CUE_OVERRIDES.maddie!.some(c => (c.action ?? 'cast') === 'cast')).toBe(false);
    for (const key of ['maddie-shot-flight', 'maddie-shot-land']) expect(mapSkillTimeline(CUE_EXTRA_SKILLS[key]!, 'md', ['f1']).unsupported).toEqual([]);
  });
  it('real combat: six shots launched, each landing that hit with its damage on the same tick', () => {
    const units = realUnits({ unit: 'maddie', star: 2, form: null, foe: 'amumu', dist: 4, nfoes: 2, foestar: 1 } as any);
    const defs: Record<string, string> = Object.fromEntries(units.map((u: any) => [u.id, u.definitionId]));
    const batch = createBatch1VfxEvents(id => defs[id]); const flights: number[] = [], lands: number[] = [], hits: number[] = [];
    runRealCombat(units, 260, (_s, shown) => {
      for (const e of shown as any[]) if (e.type === 'packetDamage' && e.sourceId === 'me' && e.delivery === 'ability-direct') hits.push(e.tick);
      for (const p of batch.batch(shown)) for (const x of p.extra) {
        if (x.skill === 'maddie-shot-flight') flights.push((p.event as any).tick);
        if (x.skill === 'maddie-shot-land') lands.push((p.event as any).tick);
      }
    });
    expect(flights.slice(0, 6)).toHaveLength(6);
    expect(lands).toEqual(hits);
  });
  it('the local hex distance is the rules\' one on every pair of cells of a 7 × 8 board', () => {
    const cells = Array.from({ length: 8 }, (_, row) => Array.from({ length: 7 }, (_, col) => ({ col, row }))).flat();
    const off = cells.flatMap(a => cells.filter(b => hexDistance(a, b) !== rulesHexDistance(a, b)).map(b => [a, b]));
    expect(off).toEqual([]);
  });
});
