import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Dr. Mundo's beam follows his once-a-second damage; his closing blast plays the body on him and a zap on each enemy it hits.
const damage = (eventSeq: number, tick: number, targetId: string, sourceId = 'mundo', sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick, eventSeq, sourceId, targetId, damageType: 'magic', sourceKind, delivery, raw: 40, actual: 40 } as unknown as DisplayCombatEvent);
const definitions: Record<string, string> = { mundo: 'drmundo', f1: 'amumu', f2: 'amumu' };
const plan = (batches: DisplayCombatEvent[][]) => {
  const events = createBatch1VfxEvents(id => definitions[id]);
  return batches.map(batch => events.batch(batch).flatMap(p => p.extra.filter(x => x.skill?.startsWith('drmundo')).map(x => [x.skill, ...x.targets])));
};

const healEnd = (eventSeq: number, tick: number): DisplayCombatEvent =>
  ({ type: 'abilityEffectEnded', tick, eventSeq, unitId: 'mundo', effect: 'drmundo-heal', targetIds: [] } as unknown as DisplayCombatEvent);
const cast = (eventSeq: number, tick: number): DisplayCombatEvent => ({ type: 'cast', sourceId: 'mundo', eventSeq, tick, actionSeq: eventSeq,
  completed: true, actualManaSpent: 100, refundedMana: 0, targetIds: [], completionCell: { col: 0, row: 0 } } as DisplayCombatEvent);

describe('Dr. Mundo\'s beam, blast body and zaps follow his damage', () => {
  it('the blast on the heal\'s last tick: the pulse to his target, then the blast', () => {
    expect(plan([[cast(1, 0)], [damage(2, 30, 'f1')], [damage(3, 50, 'f1'), damage(4, 50, 'f1'), damage(5, 50, 'f2'), healEnd(6, 50)]])).toEqual([
      [], [['drmundo-beam', 'f1']],
      [['drmundo-beam', 'f1'], ['drmundo-zap', 'f1'], ['drmundo-zap-body', 'mundo'], ['drmundo-zap', 'f2']],
    ]);
  });
  it('his target dead before the end: no pulse then, every hit on that tick is the blast', () => {
    expect(plan([[cast(1, 0)], [damage(2, 30, 'f1')], [damage(3, 50, 'f2'), healEnd(4, 50)]])).toEqual([
      [], [['drmundo-beam', 'f1']], [['drmundo-zap', 'f2'], ['drmundo-zap-body', 'mundo']],
    ]);
    expect(plan([[cast(1, 0)], [damage(3, 50, 'f2'), damage(4, 50, 'f1'), healEnd(5, 50)]])).toEqual([
      [], [['drmundo-zap', 'f2'], ['drmundo-zap-body', 'mundo'], ['drmundo-zap', 'f1']],
    ]);
  });
  it('the blast on its own tick after the heal\'s end: blast only, and a new cast starts over', () => {
    expect(plan([[cast(1, 0)], [damage(2, 30, 'f1')], [damage(3, 50, 'f1'), healEnd(4, 50)], [damage(5, 55, 'f1'), damage(6, 55, 'f2')],
      [cast(7, 80)], [damage(8, 110, 'f2')]])).toEqual([
      [], [['drmundo-beam', 'f1']], [['drmundo-beam', 'f1']],
      [['drmundo-zap', 'f1'], ['drmundo-zap-body', 'mundo'], ['drmundo-zap', 'f2']], [], [['drmundo-beam', 'f2']],
    ]);
  });
  it('his attacks and other units\' damage plan nothing', () => {
    expect(plan([[damage(1, 30, 'f1', 'mundo', 'attack', 'basic-attack'), damage(2, 30, 'mundo', 'f1')]])).toEqual([[]]);
  });
  it('the three cues map onto their targets', () => {
    for (const [skill, targets] of [['drmundo-beam', ['f1']], ['drmundo-zap', ['f1']], ['drmundo-zap-body', ['mundo']]] as const) {
      const mapped = mapSkillTimeline(CUE_EXTRA_SKILLS[skill]!, 'mundo', targets);
      expect(mapped.unsupported, skill).toEqual([]);
      expect(mapped.spawns, skill).toHaveLength(1);
    }
  });
});
