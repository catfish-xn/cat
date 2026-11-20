import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES, DRAVEN_AXE } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { effectImportance } from '../src/rendering/three-mode/effect-budget';

let seq = 0;
const cast = (tick: number) => ({ type: 'cast', tick, eventSeq: ++seq, sourceId: 'd', targetIds: ['d'], actionSeq: tick, completed: true }) as unknown as DisplayCombatEvent;
const attack = (tick: number) => ({ type: 'attack', tick, eventSeq: ++seq, attackerId: 'd', targetId: 'e' }) as unknown as DisplayCombatEvent;
const landed = (tick: number, hit = true) => ({ type: 'attackLanded', tick, eventSeq: ++seq, attackerId: 'd', targetId: 'e', hit }) as unknown as DisplayCombatEvent;
const defs: Record<string, string> = { d: 'draven', e: 'amumu' };

describe('Draven\'s axes: each hand in turn, and back to his hand after they land', () => {
  it('his empowered attacks alternate hands; plain attacks before his first cast stay plain', () => {
    const planner = createBatch1VfxEvents(id => defs[id]);
    const plans = planner.batch([attack(1), cast(2), attack(3), attack(4), attack(5), attack(6)]);
    expect(plans.map(p => p.variant)).toEqual([undefined, undefined, 'empowered', 'empowered-alt', 'empowered', 'empowered-alt']);
  });

  it('a landed empowered axe flies back from the enemy to him; a miss or a plain attack does not', () => {
    const planner = createBatch1VfxEvents(id => defs[id]);
    const back = (events: DisplayCombatEvent[]) => planner.batch(events).flatMap(p => p.extra.filter(fx => fx.skill === 'draven-return')
      .map(fx => `${fx.sourceId}>${fx.targets.join()}`));
    expect(back([attack(1), landed(4)])).toEqual([]);
    expect(back([cast(10), attack(12), landed(15)])).toEqual(['e>d']);
    expect(back([attack(20), landed(23, false)])).toEqual([]);
  });

  it('the other hand\'s axe has the same hit; the axe flying back is decoration on its own arc', () => {
    const cues = CUE_OVERRIDES.draven!;
    const alt = cues.filter(cue => cue.variant === 'empowered-alt').map(cue => [cue.system, cue.event]);
    expect(alt).toEqual([['5a268f4e', 'projectile'], ['5e3986cd', 'hit']]);
    const [back] = CUE_EXTRA_SKILLS['draven-return']!;
    expect(back!.system).toBe(DRAVEN_AXE);
    expect(back!.arc).toBeDefined();
    expect(effectImportance(back!)).toBe('decorative');
  });
});
