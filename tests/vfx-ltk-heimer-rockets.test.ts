import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents, HEIMER_ROCKETS_PER_TICK } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Heimerdinger draws one rocket per damage packet; repeats at one enemy leave in order so they do not draw as one.
const damage = (eventSeq: number, targetId: string, sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick: 9, eventSeq, sourceId: 'h', targetId, damageType: 'magic', sourceKind, delivery, raw: 50, actual: 50 } as unknown as DisplayCombatEvent);
const definitions: Record<string, string> = { h: 'heimerdinger', f1: 'amumu', f2: 'amumu' };
const rockets = (events: DisplayCombatEvent[]) => createBatch1VfxEvents(id => definitions[id]).batch(events)
  .flatMap(p => p.extra.filter(x => x.skill?.startsWith('heimerdinger-rocket')).map(x => [x.skill, x.targets[0]]));

describe('Heimerdinger: a rocket per damage packet', () => {
  it('five rockets at two enemies: five rockets, the repeats staggered', () => {
    expect(rockets(['f1', 'f2', 'f1', 'f1', 'f2'].map((id, i) => damage(i + 1, id)))).toEqual([
      ['heimerdinger-rocket-0', 'f1'], ['heimerdinger-rocket-0', 'f2'], ['heimerdinger-rocket-1', 'f1'],
      ['heimerdinger-rocket-2', 'f1'], ['heimerdinger-rocket-1', 'f2']]);
  });
  it(`at most ${HEIMER_ROCKETS_PER_TICK} a tick; attacks plan none`, () => {
    expect(rockets(Array.from({ length: 12 }, (_, i) => damage(i + 1, i % 2 ? 'f1' : 'f2')))).toHaveLength(HEIMER_ROCKETS_PER_TICK);
    expect(rockets([damage(1, 'f1', 'attack', 'basic-attack')])).toEqual([]);
  });
  it('the rockets leave in order and each lands with its hit; his cast list keeps only the launch flash', () => {
    const at = (k: number) => CUE_EXTRA_SKILLS[`heimerdinger-rocket-${k}`]!;
    for (let k = 0; k < 4; k++) {
      const [rocket, hit] = at(k);
      expect(rocket!.system).toBe('c8d6ee2e'); expect(hit!.system).toBe('07c9833a');
      expect(hit!.delay).toBeCloseTo(rocket!.delay + rocket!.travelSeconds!);
      if (k) expect(rocket!.delay).toBeGreaterThan(at(k - 1)[0]!.delay);
      expect(mapSkillTimeline(at(k), 'h', ['f1']).unsupported).toEqual([]);
    }
    expect(CUE_OVERRIDES.heimerdinger!.filter(c => (c.action ?? 'cast') === 'cast').map(c => c.system)).toEqual(['c44d51d0']);
  });
});
