import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES, MADDIE_HIT_SCALE, MADDIE_SHOT_MIN_TICKS, MADDIE_SHOT_TICKS_PER_HEX } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { flightCells, flightTicksFor, hexDistance, withFlightSeconds } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { maddieShotFlightTicks } from '../src/simulation/cast-windup';
import { hexDistance as rulesHexDistance } from '../src/simulation/board';
import { hexCenter } from '../src/rendering3d/picking';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Maddie's volley: each shot leaves on the rules' launch of it and flies the rules' flight; its hit plays with its damage.
const damage = (eventSeq: number, tick: number, targetId: string, sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick, eventSeq, sourceId: 'md', targetId, damageType: 'physical', sourceKind, delivery, raw: 50, actual: 50 } as unknown as DisplayCombatEvent);
const launched = (eventSeq: number, tick: number, targetId: string, arrivalTick: number): DisplayCombatEvent =>
  ({ type: 'abilityProjectileLaunched', tick, eventSeq, sourceId: 'md', targetId, arrivalTick, skill: 'maddie-shot', ordinal: 0, actionSeq: 1, count: 6 } as unknown as DisplayCombatEvent);
const definitions: Record<string, string> = { md: 'maddie', f1: 'amumu' };

describe('Maddie\'s shots follow the rules\' launch and landing', () => {
  it('one shot per rules launch, with the rules\' flight; one hit per ability damage packet; attacks plan none', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([launched(1, 5, 'f1', 11), damage(2, 11, 'f1'), launched(3, 6, 'f1', 14),
      damage(4, 14, 'f1'), damage(5, 15, 'f1', 'attack', 'basic-attack')]);
    expect(plans.map(p => p.extra.map(x => [x.skill, x.targets, x.flightSeconds]))).toEqual([
      [['maddie-shot', ['f1'], 6 * 0.05]], [['maddie-hit', ['f1'], undefined]], [['maddie-shot', ['f1'], 8 * 0.05]], [['maddie-hit', ['f1'], undefined]], []]);
  });
  it('her shot\'s hit draws at MADDIE_HIT_SCALE and her shot itself keeps its size', () => {
    expect(CUE_EXTRA_SKILLS['maddie-hit']!.find(c => c.system === 'b1b77889')!.scale).toBe(MADDIE_HIT_SCALE);
    expect(MADDIE_HIT_SCALE).toBeGreaterThan(0); expect(MADDIE_HIT_SCALE).toBeLessThan(1);
    expect(CUE_EXTRA_SKILLS['maddie-shot']!.find(c => c.system === 'f0aa0d95')!.scale).toBeUndefined();
  });
  it('her cast plays nothing (no fallback to the old placeholder cast effect)', () => {
    const cast = { type: 'cast', sourceId: 'md', eventSeq: 1, tick: 1, actionSeq: 1, completed: true, actualManaSpent: 60, refundedMana: 0,
      targetIds: ['f1'], completionCell: { col: 0, row: 0 } } as DisplayCombatEvent;
    expect(createBatch1VfxEvents(id => definitions[id]).batch([cast])[0]!.noCastEffect).toBe(true);
  });
  it('the shot flies exactly the rules\' flight and the hit plays at once with its damage; her cast list no longer plays them', () => {
    const [shot] = CUE_EXTRA_SKILLS['maddie-shot']!, [hit] = CUE_EXTRA_SKILLS['maddie-hit']!;
    expect(CUE_EXTRA_SKILLS['maddie-shot']!.map(c => c.event)).toEqual(['projectile']); expect(CUE_EXTRA_SKILLS['maddie-hit']!.map(c => c.event)).toEqual(['hit']);
    // No flight of its own by distance: the rules' (LtkPlayOptions.flightSeconds) times it.
    expect(shot!.flightTicks).toBeUndefined(); expect(hit!.flightTicks).toBeUndefined();
    expect([shot!.delay, hit!.delay]).toEqual([0, 0]);
    const flown = withFlightSeconds(shot!, 0.4);
    expect(flown.travelSeconds).toBeCloseTo(0.4); expect(flown.duration).toBeCloseTo(0.4 + shot!.duration - shot!.travelSeconds!);
    expect(CUE_OVERRIDES.maddie!.some(c => (c.action ?? 'cast') === 'cast')).toBe(false);
    for (const skill of ['maddie-shot', 'maddie-hit']) expect(mapSkillTimeline(CUE_EXTRA_SKILLS[skill]!, 'md', ['f1']).unsupported).toEqual([]);
  });
  it('real combat: six shots, each drawn reaching its enemy on the tick its damage lands (within 2 ticks), its hit on that tick', () => {
    const units = realUnits({ unit: 'maddie', star: 2, form: null, foe: 'amumu', dist: 4, nfoes: 2, foestar: 1 } as any);
    const defs: Record<string, string> = Object.fromEntries(units.map((u: any) => [u.id, u.definitionId]));
    const batch = createBatch1VfxEvents(id => defs[id]); let cast = -1; const reach: number[] = [], hits: number[] = [], hitPlays: number[] = [];
    runRealCombat(units, 260, (_s, shown) => {
      for (const e of shown as any[]) {
        if (e.type === 'cast' && e.sourceId === 'me' && cast < 0) cast = e.tick;
        if (cast >= 0 && e.type === 'packetDamage' && e.sourceId === 'me' && e.delivery === 'ability-direct') hits.push(e.tick - cast);
      }
      for (const p of batch.batch(shown)) for (const x of p.extra) if (cast >= 0) {
        if (x.skill === 'maddie-shot') reach.push((p.event as any).tick + x.flightSeconds! / 0.05 - cast);
        if (x.skill === 'maddie-hit') hitPlays.push((p.event as any).tick - cast);
      }
    });
    expect(cast).toBeGreaterThan(0);
    expect(reach.slice(0, 6)).toHaveLength(6); expect(hits.slice(0, 6)).toHaveLength(6);
    reach.slice(0, 6).forEach((at, i) => expect(Math.abs(at - hits[i]!), `shot ${i + 1}`).toBeLessThanOrEqual(2));
    expect(hitPlays).toEqual(hits);
  });
  it('the rules\' flight is 2 ticks a cell by hex distance, at least 4 (the render\'s copy stays equal); the runtime counts cells as the rules do', () => {
    // The renderer reads each shot's flight from the rules' event now; its copy of the constants only stays pinned equal.
    expect([MADDIE_SHOT_TICKS_PER_HEX, MADDIE_SHOT_MIN_TICKS]).toEqual([2, 4]);
    expect([0, 1, 2, 3, 4, 5].map(maddieShotFlightTicks)).toEqual([4, 4, 4, 6, 8, 10]);
    expect([0, 1, 2, 3, 4, 5].map(cells => flightTicksFor(cells, MADDIE_SHOT_TICKS_PER_HEX, MADDIE_SHOT_MIN_TICKS))).toEqual([4, 4, 4, 6, 8, 10]);
    const board = { columns: 7, rows: 8, radius: 34, origin: { x: 0, y: 0 } };
    const at = (col: number, row: number) => { const c = hexCenter({ col, row }, board); return [c.x, 0, c.z] as const; };
    // Straight along a row, and on a slant: 4 cells either way, as the rules count them (8 ticks).
    expect(flightCells(at(1, 3), at(5, 3), board)).toBe(4);
    expect(flightCells(at(2, 4), at(4, 0), board)).toBe(rulesHexDistance({ col: 2, row: 4 }, { col: 4, row: 0 }));
    expect(flightCells(at(2, 4), at(4, 0), board)).toBe(4);
  });
  it('the local hex distance is the rules\' one on every pair of cells of a 7 × 8 board', () => {
    const cells = Array.from({ length: 8 }, (_, row) => Array.from({ length: 7 }, (_, col) => ({ col, row }))).flat();
    const off = cells.flatMap(a => cells.filter(b => hexDistance(a, b) !== rulesHexDistance(a, b)).map(b => [a, b]));
    expect(off).toEqual([]);
  });
});

// Her basic attack follows the rules' shot like the other ranged heroes (#749): no fixed flight in her override; the wind-up's
// launch plays only her shot, leaving now and landing (with its hit) on the arrival.
import { landingCues } from '../src/rendering/three-mode/vfx-ltk/runtime';
describe('Maddie basic attack: rules landing', () => {
  it('her attack projectile has no fixed travelSeconds and lands on the arrival', () => {
    const attack = CUE_OVERRIDES.maddie!.filter(c => c.action === 'attack');
    expect(attack.find(c => c.event === 'projectile')!.travelSeconds).toBeUndefined();
    const launch = landingCues(attack, { seconds: 0.4, phase: 'launch' });
    expect(launch.map(c => [c.event, c.delay])).toEqual([['projectile', 0], ['hit', 0.4]]);
    expect(launch.find(c => c.event === 'projectile')!.travelSeconds).toBe(0.4);
  });
});
