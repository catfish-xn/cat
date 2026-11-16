import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Nunu's hit splash (R_hit_tar, 5dfd387b) plays on each enemy his blast strikes. His cast names no targets, so as a cast hit
// cue it never played; it now follows the blast's damage: the tick an enemy takes two of his ability's direct packets.
const SPLASH = '5dfd387b';
const damage = (sourceId: string, tick: number, eventSeq: number, targetId: string, definitionId = 'nunu-ability', sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick, eventSeq, sourceId, targetId, damageType: 'magic', sourceKind, definitionId, delivery, hit: true, hpDamage: 50, absorbed: 0 } as unknown as DisplayCombatEvent);
const definitions: Record<string, string> = { nu: 'nunu', vi: 'vi', foe: 'amumu', foe2: 'amumu' };
const splash = (target: string) => ({ champion: 'nunu', sourceId: 'nu', targets: [target], action: 'passive', skill: 'nunu-blast-hit', snapshotTargets: true });

describe('Nunu\'s hit splash follows his blast\'s damage', () => {
  it('plays once per enemy on the tick that enemy takes two of his ability packets (on the second one)', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([
      damage('nu', 10, 1, 'foe'), damage('nu', 10, 2, 'foe2'),
      damage('nu', 20, 3, 'foe'), damage('nu', 20, 4, 'foe'), damage('nu', 20, 5, 'foe2'), damage('nu', 20, 6, 'foe2'),
    ]);
    expect(plans.map(plan => plan.extra)).toEqual([[], [], [], [splash('foe')], [], [splash('foe2')]]);
  });

  it('another source\'s packet, his attack or an item proc in the same tick on the same enemy never counts', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([
      damage('nu', 30, 1, 'foe'), damage('vi', 30, 2, 'foe', 'vi-ability'),
      damage('nu', 40, 3, 'foe2'), damage('nu', 40, 4, 'foe2', 'nunu-ability', 'attack', 'basic-attack'),
      damage('nu', 50, 5, 'foe'), damage('nu', 50, 6, 'foe', 'some-item', 'item', 'item-direct'),
      // One packet on each of two enemies is a damage tick, not the blast.
      damage('nu', 60, 7, 'foe'), damage('nu', 60, 8, 'foe2'),
    ]);
    expect(plans.every(plan => plan.extra.length === 0)).toBe(true);
  });

  it('the splash is a display branch at the blast, no longer a cast hit cue that waited for targets the cast never names', () => {
    expect(CUE_EXTRA_SKILLS['nunu-blast-hit']!.map(c => [c.system, c.action, c.event])).toEqual([[SPLASH, 'passive', 'hit']]);
    expect(CUE_OVERRIDES.nunu!.some(c => c.system === SPLASH)).toBe(false);
  });

  it('a real combat (Nunu 2 stars, two foes in range): one splash per enemy, on the tick of his last damage, after the cast', () => {
    const units = realUnits({ unit: 'nunu', star: 2, form: null, foe: 'amumu', dist: 3, nfoes: 2, foestar: 3 });
    const shown: DisplayCombatEvent[][] = [];
    runRealCombat(units, 120, (_state, events) => { shown.push(events as DisplayCombatEvent[]); }, 1, { kind: 'cast' });
    const vfx = createBatch1VfxEvents(id => (id === 'me' ? 'nunu' : 'amumu'));
    const splashes: { tick: number; target: string }[] = [];
    const castTicks: number[] = [];
    for (const batch of shown) for (const plan of vfx.batch(batch)) {
      if (plan.event.type === 'cast' && plan.event.sourceId === 'me') castTicks.push(plan.event.tick);
      for (const extra of plan.extra) if (extra.skill === 'nunu-blast-hit') splashes.push({ tick: (plan.event as { tick: number }).tick, target: extra.targets[0]! });
    }
    expect(castTicks.length).toBeGreaterThan(0);
    // The first cast's span only: from it to his next cast (or the run's end).
    const [castTick, nextCast = Infinity] = castTicks;
    const inFirst = (tick: number) => tick > castTick! && tick < nextCast;
    const packets = shown.flat().filter((e: any) => e.type === 'packetDamage' && e.sourceId === 'me' && e.delivery === 'ability-direct' && inFirst(e.tick)) as any[];
    const lastByTarget = new Map<string, number>();
    for (const p of packets) lastByTarget.set(p.targetId, Math.max(lastByTarget.get(p.targetId) ?? -1, p.tick));
    const firstCast = splashes.filter(s => inFirst(s.tick));
    expect(firstCast.length).toBeGreaterThan(0);
    expect(firstCast.length).toBe(lastByTarget.size);
    expect(new Set(firstCast.map(s => s.target)).size).toBe(firstCast.length);
    for (const s of firstCast) expect(s.tick).toBe(lastByTarget.get(s.target));
  });
});
