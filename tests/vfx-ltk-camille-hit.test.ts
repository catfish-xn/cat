import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// Camille's hit (Q_tar) plays when her kick's damage lands, the variant her adaptive damage type picks (user 2026-11-15).
const damage = (sourceId: string, eventSeq: number, targetId: string, damageType: string, sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick: eventSeq, eventSeq, sourceId, targetId, damageType, sourceKind, delivery, raw: 100, actual: 90 } as unknown as DisplayCombatEvent);
const cast = (sourceId: string, eventSeq: number, targetIds: string[]): DisplayCombatEvent => ({ type: 'cast', sourceId, eventSeq, tick: eventSeq,
  actionSeq: eventSeq, completed: true, actualManaSpent: 60, refundedMana: 0, targetIds, completionCell: { col: 0, row: 0 } });
const definitions: Record<string, string> = { cam: 'camille', vi: 'vi', foe: 'amumu' };
const PHYSICAL = '69b207a4', MAGIC = 'aff93381';

describe('Camille\'s hit follows her kick\'s damage, by damage type', () => {
  it('physical plays 69b207a4, magic plays aff93381; her cast, attacks and other units\' damage plan nothing', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([
      cast('cam', 1, ['foe']),
      damage('cam', 2, 'foe', 'physical'),
      damage('cam', 3, 'foe', 'magic'),
      damage('cam', 4, 'foe', 'physical', 'attack', 'basic-attack'),
      damage('vi', 5, 'foe', 'physical'),
    ]);
    expect(plans.map(plan => plan.extra)).toEqual([[],
      [{ champion: 'camille', sourceId: 'cam', targets: ['foe'], action: 'passive', skill: 'camille-q-physical' }],
      [{ champion: 'camille', sourceId: 'cam', targets: ['foe'], action: 'passive', skill: 'camille-q-magic' }],
      [], []]);
  });

  it('the two variants hit the target with no delay; her cast list no longer plays Q_tar at a fixed time', () => {
    expect(CUE_EXTRA_SKILLS['camille-q-physical']!.map(c => [c.system, c.event, c.delay])).toEqual([[PHYSICAL, 'hit', 0]]);
    expect(CUE_EXTRA_SKILLS['camille-q-magic']!.map(c => [c.system, c.event, c.delay])).toEqual([[MAGIC, 'hit', 0]]);
    expect(CUE_OVERRIDES.camille!.some(c => c.system === PHYSICAL || c.system === MAGIC)).toBe(false);
    expect(CUE_OVERRIDES.camille!.filter(c => (c.action ?? 'cast') === 'cast').length).toBeGreaterThan(0);
  });
});
