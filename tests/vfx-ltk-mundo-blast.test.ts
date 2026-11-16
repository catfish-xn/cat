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

describe('Dr. Mundo\'s beam, blast body and zaps follow his damage', () => {
  it('the blast on the last pulse\'s tick: the first hit is the pulse, the rest the blast', () => {
    expect(plan([[damage(1, 30, 'f1')], [damage(2, 50, 'f1'), damage(3, 50, 'f1'), damage(4, 50, 'f2')]])).toEqual([
      [['drmundo-beam', 'f1']],
      [['drmundo-beam', 'f1'], ['drmundo-zap', 'f1'], ['drmundo-zap-body', 'mundo'], ['drmundo-zap', 'f2']],
    ]);
  });
  it('the blast on its own tick, less than a second after the last pulse: no beam then', () => {
    expect(plan([[damage(1, 30, 'f1')], [damage(2, 50, 'f1')], [damage(3, 55, 'f1'), damage(4, 55, 'f2')]])).toEqual([
      [['drmundo-beam', 'f1']], [['drmundo-beam', 'f1']],
      [['drmundo-zap', 'f1'], ['drmundo-zap-body', 'mundo'], ['drmundo-zap', 'f2']],
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
