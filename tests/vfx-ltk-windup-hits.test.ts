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
  it('Trundle: the bite hit sits at the wind-up in his cast list', () => {
    expect(CUE_OVERRIDES.trundle!.find(c => c.system === '8bb9f6ab')).toMatchObject({ event: 'hit', delay: CAST_WINDUP_TICKS.trundle / 20 });
  });
  it('real combat: the landing plan comes on the damage tick, CAST_WINDUP_TICKS after the cast', () => {
    for (const [unit, foes] of [['sett', 2], ['zyra', 2]] as const) {
      const units = realUnits({ unit, star: 1, form: null, foe: 'amumu', dist: unit === 'zyra' ? 4 : 1, nfoes: foes, foestar: 2 } as any);
      const defs: Record<string, string> = Object.fromEntries(units.map((u: any) => [u.id, u.definitionId]));
      const batch = createBatch1VfxEvents(id => defs[id]);
      let castTick = -1, landTick = -1;
      runRealCombat(units, 40, (_s, shown) => {
        for (const e of shown) if (e.type === 'cast' && e.sourceId === 'me' && castTick < 0) castTick = e.tick;
        for (const p of batch.batch(shown)) if (p.extra.some(x => x.sourceId === 'me' && /slam|vines/.test(x.skill)) && landTick < 0) landTick = (p.event as any).tick;
      });
      expect(castTick, unit).toBeGreaterThan(0);
      expect(landTick - castTick, unit).toBe(CAST_WINDUP_TICKS[unit]);
    }
  });
});
