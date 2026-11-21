import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Powder's target burst and explosion play when her blast's damage lands, not at fixed times after her cast.
const damage = (eventSeq: number, tick: number, targetId: string, sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick, eventSeq, sourceId: 'pw', targetId, damageType: 'magic', sourceKind, delivery, raw: 50, actual: 50 } as unknown as DisplayCombatEvent);
const definitions: Record<string, string> = { pw: 'powder', f1: 'amumu', f2: 'amumu' };

describe('Powder\'s blast follows its damage', () => {
  it('once per tick, on every enemy hit; attacks and her burn plan nothing', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([damage(1, 5, 'f1'), damage(2, 5, 'f2'),
      damage(3, 6, 'f1', 'attack', 'basic-attack'), damage(4, 25, 'f1', 'ability', 'ability-periodic')]);
    expect(plans.map(p => p.extra.filter(x => x.skill === 'powder-blast').map(x => x.targets))).toEqual([[['f1', 'f2']], [], [], []]);
  });
  it('her cast plays nothing (no fallback to the old placeholder cast effect)', () => {
    const cast = { type: 'cast', sourceId: 'pw', eventSeq: 1, tick: 1, actionSeq: 1, completed: true, actualManaSpent: 60, refundedMana: 0,
      targetIds: ['f1'], completionCell: { col: 0, row: 0 } } as DisplayCombatEvent;
    expect(createBatch1VfxEvents(id => definitions[id]).batch([cast])[0]!.noCastEffect).toBe(true);
  });
  it('the target burst on each enemy at the damage; the explosion once, on the monkey\'s cell; her cast list plays neither', () => {
    expect(CUE_EXTRA_SKILLS['powder-blast']!.map(c => [c.system, c.event, c.delay])).toEqual([['8747b362', 'hit', 0]]);
    expect(CUE_OVERRIDES.powder!.some(c => (c.action ?? 'cast') === 'cast')).toBe(false);
    expect(mapSkillTimeline(CUE_EXTRA_SKILLS['powder-blast']!, 'pw', ['f1', 'f2']).spawns).toHaveLength(2);
    const arrive = mapSkillTimeline(CUE_EXTRA_SKILLS['powder-arrive']!, 'pw', [], [10, 0, 20]).spawns;
    expect(arrive.map(c => [c.system, c.point])).toEqual([['805215e2', [10, 0, 20]]]);
  });
});
