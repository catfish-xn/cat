import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents, isIreliaShield } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Irelia's stance and swipe follow her shield's own end (shieldLayerChanged depleted or expired), not fixed times.
const key = (holder: string, def = 'irelia-ability') => JSON.stringify(['c', holder, 'ability', def, holder, 0, null, holder, 'source']);
const shield = (reason: string, holder: string, tick: number, def?: string): DisplayCombatEvent =>
  ({ type: 'shieldLayerChanged', tick, eventSeq: tick, reason, key: key(holder, def), targetId: holder, remaining: 0 } as DisplayCombatEvent);
const cast = (sourceId: string, tick: number): DisplayCombatEvent => ({ type: 'cast', sourceId, eventSeq: tick, tick, actionSeq: tick, completed: true,
  actualManaSpent: 50, refundedMana: 0, targetIds: [sourceId], completionCell: { col: 0, row: 0 } } as DisplayCombatEvent);
const definitions: Record<string, string> = { ire: 'irelia', lux: 'lux', foe: 'amumu' };
const SWIPE = { champion: 'irelia', sourceId: 'ire', targets: [], action: 'passive', skill: 'irelia-swipe' };

describe('Irelia: the stance and the swipe follow her shield, not fixed times', () => {
  it('reads her ability shield key only', () => {
    expect(isIreliaShield(key('ire'), 'ire')).toBe(true);
    expect(isIreliaShield(key('ire'), 'lux')).toBe(false);
    expect(isIreliaShield(key('ire', 'lux-ability'), 'ire')).toBe(false);
    expect(isIreliaShield('not json', 'ire')).toBe(false);
  });

  it('the cast list keeps the stance for at most the shield time; the swipe is no longer on it', () => {
    expect(CUE_OVERRIDES.irelia!.filter(c => c.action === 'cast').map(c => [c.system, c.duration])).toEqual([['67665513', 3]]);
    expect(CUE_EXTRA_SKILLS['irelia-swipe']!.map(c => [c.system, c.action, c.delay])).toEqual([['08b7a939', 'passive', 0]]);
  });

  it('emptied early or run out: the stance stops and the swipe plays at that end, either way', () => {
    for (const reason of ['depleted', 'expired']) {
      const plans = createBatch1VfxEvents(id => definitions[id]).batch([cast('ire', 10), shield('granted', 'ire', 10), shield(reason, 'ire', 44)]);
      expect(plans[0]!.skipCast).toBeUndefined();
      expect(plans[2]!.stopCast).toBe('ire');
      expect(plans[2]!.extra).toEqual([SWIPE]);
    }
  });

  it('nothing on other shields, other reasons, or a shield that is not hers', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([shield('absorbed', 'ire', 5), shield('decayed', 'ire', 6),
      shield('depleted', 'lux', 7), shield('depleted', 'ire', 8, 'loris-ability'), shield('death-cleanup', 'ire', 9)]);
    expect(plans.flatMap(p => p.extra)).toEqual([]);
    expect(plans.some(p => p.stopCast)).toBe(false);
  });

  it('a cast that grants her no shield (Blade Dance) draws no stance', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([cast('ire', 10)]);
    expect(plans[0]!.skipCast).toBe(true);
  });

  it('in real combats the swipe is planned where the shield ends: early when emptied, later when she takes little', () => {
    const at = (foestar: number, nfoes: number) => {
      const units = realUnits({ unit: 'irelia', star: 1, form: null, foe: 'amumu', dist: 2, nfoes, foestar });
      const events: DisplayCombatEvent[][] = [];
      const run = runRealCombat(units, 80, (_s, shown) => { events.push(shown as DisplayCombatEvent[]); });
      const defs = Object.fromEntries(units.map(u => [u.id, u.definitionId as string]));
      const plans = createBatch1VfxEvents(id => defs[id]).batch(events.flat());
      const swipe = plans.find(p => p.extra.some(fx => fx.skill === 'irelia-swipe'));
      const end = events.flat().find(e => e.type === 'shieldLayerChanged' && (e.reason === 'depleted' || e.reason === 'expired') && e.targetId === 'me');
      expect(swipe?.event).toBe(end);
      expect(plans.find(p => p.event.type === 'cast' && (p.event as { sourceId: string }).sourceId === 'me')?.skipCast).toBeUndefined();
      return ((end as { tick: number }).tick - run.castIndex) / 20;
    };
    const early = at(2, 2), late = at(1, 1);
    expect(early).toBeLessThan(2);
    expect(late).toBeGreaterThan(early);
  });
});
