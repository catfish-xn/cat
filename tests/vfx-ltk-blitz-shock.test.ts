import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Blitzcrank's shock arcs and bursts play when the shock's damage lands, not at fixed times after his cast (user 2026-11-15).
const damage = (sourceId: string, eventSeq: number, tick: number, targetId: string, sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick, eventSeq, sourceId, targetId, damageType: 'magic', sourceKind, delivery, raw: 40, actual: 40 } as unknown as DisplayCombatEvent);
const cast = (sourceId: string, eventSeq: number, targetIds: string[]): DisplayCombatEvent => ({ type: 'cast', sourceId, eventSeq, tick: eventSeq,
  actionSeq: eventSeq, completed: true, actualManaSpent: 60, refundedMana: 0, targetIds, completionCell: { col: 0, row: 0 } });
const definitions: Record<string, string> = { blitz: 'blitzcrank', cam: 'camille', f1: 'amumu', f2: 'amumu', f3: 'amumu' };
const ARCS = '9d35c42d', BURST = '065c16b8';

describe('Blitzcrank\'s shock visuals follow its damage', () => {
  it('one shock per tick, to every enemy hit that tick; his cast, attacks and other units\' damage plan nothing', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([
      cast('blitz', 1, ['f1', 'f2', 'f3']),
      damage('blitz', 2, 6, 'f1'), damage('blitz', 3, 6, 'f2'), damage('blitz', 4, 6, 'f3'),
      damage('blitz', 5, 7, 'f1', 'attack', 'basic-attack'),
      damage('cam', 6, 7, 'f1'),
    ]);
    expect(plans.map(plan => plan.extra.filter(x => x.skill === 'blitzcrank-shock'))).toEqual([[],
      [{ champion: 'blitzcrank', sourceId: 'blitz', targets: ['f1', 'f2', 'f3'], action: 'passive', skill: 'blitzcrank-shock' }],
      [], [], [], []]);
  });
  it('his cast list no longer plays the arcs or the burst; the shock plays both at once on each target', () => {
    expect(CUE_OVERRIDES.blitzcrank!.some(c => c.system === ARCS || c.system === BURST)).toBe(false);
    expect(CUE_EXTRA_SKILLS['blitzcrank-shock']!.map(c => [c.system, c.event, c.delay])).toEqual([[ARCS, 'link', 0], [BURST, 'hit', 0]]);
    const mapped = mapSkillTimeline(CUE_EXTRA_SKILLS['blitzcrank-shock']!, 'blitz', ['f1', 'f2', 'f3']);
    expect(mapped.unsupported).toEqual([]);
    expect(mapped.spawns.map(s => [s.system, s.targetId]).sort()).toEqual(
      [ARCS, BURST].flatMap(system => ['f1', 'f2', 'f3'].map(id => [system, id])).sort());
  });
});
