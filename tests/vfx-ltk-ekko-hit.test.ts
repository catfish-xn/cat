import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// Ekko's hits on the enemies follow his skill's damage; R_Mark on him plays for a fitted time.
const damage = (eventSeq: number, tick: number, targetId: string, sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick, eventSeq, sourceId: 'ek', targetId, damageType: 'magic', sourceKind, delivery, raw: 50, actual: 50 } as unknown as DisplayCombatEvent);
const definitions: Record<string, string> = { ek: 'ekko', f1: 'amumu', f2: 'amumu' };

describe('Ekko\'s hits follow his damage', () => {
  it('once per tick on every enemy hit; attacks plan none', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([damage(1, 5, 'f1'), damage(2, 5, 'f2'), damage(3, 9, 'f1', 'attack', 'basic-attack')]);
    expect(plans.map(p => p.extra.filter(x => x.skill === 'ekko-hit').map(x => x.targets))).toEqual([[['f1', 'f2']], [], []]);
  });
  it('the hits have no delay; his cast list keeps only R_Mark on him, longer than the export\'s 0.5 s', () => {
    expect(CUE_EXTRA_SKILLS['ekko-hit']!.map(c => [c.system, c.delay])).toEqual([['5af49b76', 0], ['970252f2', 0], ['dda9e01c', 0]]);
    const cast = CUE_OVERRIDES.ekko!.filter(c => (c.action ?? 'cast') === 'cast');
    expect(cast.map(c => c.system)).toEqual(['006b32b1']);
    expect(cast[0]!.duration).toBeGreaterThan(0.5);
  });
});
