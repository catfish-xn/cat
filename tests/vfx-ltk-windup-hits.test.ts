import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { CAST_WINDUP_TICKS } from '../src/simulation/cast-windup';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Cast wind-up (2026-11-16): Sett's slam and Zyra's vines play their hits when the damage lands, not at fixed times.
const damage = (sourceId: string, eventSeq: number, tick: number, targetId: string, sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick, eventSeq, sourceId, targetId, damageType: 'magic', sourceKind, delivery, raw: 40, actual: 40 } as unknown as DisplayCombatEvent);
const definitions: Record<string, string> = { sett: 'sett', zyra: 'zyra', f1: 'amumu', f2: 'amumu', f3: 'amumu' };
const skillsOf = (events: DisplayCombatEvent[]) => createBatch1VfxEvents(id => definitions[id]).batch(events).map(p => p.extra.map(x => [x.skill, x.targets]));

describe('wind-up hits follow the damage', () => {
  it('Sett: one slam per tick, single when one enemy is hit; attacks plan nothing', () => {
    expect(skillsOf([damage('sett', 1, 5, 'f1'), damage('sett', 2, 5, 'f2'), damage('sett', 3, 9, 'f1'), damage('sett', 4, 12, 'f1', 'attack', 'basic-attack')]))
      .toEqual([[['sett-slam', ['f1', 'f2']]], [], [['sett-slam-single', ['f1']]], []]);
  });
  it('Zyra: one landing per tick, her primary first', () => {
    expect(skillsOf([damage('zyra', 1, 7, 'f2'), damage('zyra', 2, 7, 'f1'), damage('zyra', 3, 7, 'f3')])).toEqual([[['zyra-vines', ['f2', 'f1', 'f3']]], [], []]);
  });
  it('Trundle: his cast plays nothing; the bite hit comes with the bite damage', () => {
    const cast = { type: 'cast', sourceId: 'trundle', eventSeq: 1, tick: 1, actionSeq: 1, completed: true, actualManaSpent: 60, refundedMana: 0,
      targetIds: ['f1'], completionCell: { col: 0, row: 0 } } as DisplayCombatEvent;
    const plans = createBatch1VfxEvents(id => ({ ...definitions, trundle: 'trundle' } as Record<string, string>)[id]).batch([cast, damage('trundle', 2, 5, 'f1')]);
    expect(plans[0]!.noCastEffect).toBe(true);
    expect(plans.map(p => p.extra.map(x => [x.skill, x.targets]))).toEqual([[], [['trundle-bite', ['f1']]]]);
    expect(CUE_OVERRIDES.trundle).toBeUndefined();
  });
  it('a caster dead during the wind-up: no landing damage, so no hit is planned', () => {
    for (const name of ['sett', 'trundle', 'zyra'] as const) {
      const units = realUnits({ unit: name, star: 1, form: null, foe: 'amumu', dist: name === 'zyra' ? 4 : 1, nfoes: 2, foestar: 2 } as any);
      const defs: Record<string, string> = Object.fromEntries(units.map((u: any) => [u.id, u.definitionId]));
      const batch = createBatch1VfxEvents(id => defs[id]);
      let cast = -1; const planned: string[] = [];
      runRealCombat(units, 40, (state, shown) => {
        for (const e of shown) if (e.type === 'cast' && e.sourceId === 'me' && cast < 0) { cast = e.tick; Object.assign(state.units.find((u: any) => u.id === 'me'), { hp: 0, alive: false }); }
        for (const p of batch.batch(shown)) for (const x of p.extra) if (x.sourceId === 'me') planned.push(x.skill);
      });
      expect(cast, name).toBeGreaterThan(0);
      expect(planned, name).toEqual([]);
    }
  });
  it('real combat: the landing plan comes on the damage tick, CAST_WINDUP_TICKS after the cast', () => {
    for (const [unit, foes] of [['sett', 2], ['zyra', 2]] as const) {
      const units = realUnits({ unit, star: 1, form: null, foe: 'amumu', dist: unit === 'zyra' ? 4 : 1, nfoes: foes, foestar: 2 } as any);
      const defs: Record<string, string> = Object.fromEntries(units.map((u: any) => [u.id, u.definitionId]));
      const batch = createBatch1VfxEvents(id => defs[id]);
      let castTick = -1, landTick = -1;
      runRealCombat(units, 40, (_s, shown) => {
        for (const e of shown) if (e.type === 'cast' && e.sourceId === 'me' && castTick < 0) castTick = e.tick;
        for (const p of batch.batch(shown)) if (p.extra.some(x => x.sourceId === 'me' && /slam|vines/.test(x.skill ?? '')) && landTick < 0) landTick = (p.event as any).tick;
      });
      expect(castTick, unit).toBeGreaterThan(0);
      expect(landTick - castTick, unit).toBe(CAST_WINDUP_TICKS[unit]);
    }
  });
});
