import { describe, expect, it } from 'vitest';
import * as rc from '../dev/castcmp/real-combat';
import { createBatch1VfxEvents, type Batch1Visual } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// A real Renni combat (castcmp's start: strategy snapshot and combat-start hooks), replayed through the event planner one
// tick per batch, as the replay hands the renderer whole steps.
function renniCombat(star: number) {
  const units = rc.realUnits({ unit: 'renni', star, form: null, foe: 'amumu', dist: 1, nfoes: 2, foestar: 2 } as never);
  const events: any[][] = [];
  const run = rc.runRealCombat(units, 60, (_s, shown) => { events.push(shown); });
  const ids = new Map(units.map((u: any) => [u.id, u.definitionId]));
  const planner = createBatch1VfxEvents(id => ids.get(id));
  const plays: { tick: number; visual: Batch1Visual }[] = [];
  events.forEach((batch, tick) => { for (const plan of planner.batch(batch)) for (const visual of plan.extra) if (visual.champion === 'renni') plays.push({ tick, visual }); });
  return { events, castTick: run.castIndex, plays };
}

describe('Renni: Q_tar and the final slam play from her grab and slam events', () => {
  it.each([1, 2, 3])('%i star: one grab on the stunned enemy at the cast, one slam on it and its neighbours when the slam lands', star => {
    const { events, castTick, plays } = renniCombat(star);
    const stun = events[castTick].find((e: any) => e.type === 'statusChanged' && e.kind === 'stun' && e.reason === 'applied');
    const grabs = plays.filter(p => p.visual.skill === 'renni-grab'), slams = plays.filter(p => p.visual.skill === 'renni-slam');
    expect(grabs.map(p => [p.tick, p.visual.targets])).toEqual([[castTick, [stun.targetId]]]);
    expect(slams).toHaveLength(1);
    const slam = slams[0]!;
    // The slam is the tick the rule's closing splash lands: the stunned enemy is struck twice, every other struck enemy once.
    const struck = events[slam.tick].filter((e: any) => e.type === 'packetDamage' && e.sourceId === 'me' && e.delivery === 'ability-direct').map((e: any) => e.targetId);
    expect(struck.filter((id: string) => id === stun.targetId)).toHaveLength(2);
    expect(slam.visual.targets[0]).toBe(stun.targetId);
    expect(new Set(slam.visual.targets)).toEqual(new Set(struck));
    expect(slam.tick).toBeGreaterThan(castTick);
    // No maul before it struck the held enemy twice.
    for (let t = castTick + 1; t < slam.tick; t++)
      expect(events[t].filter((e: any) => e.type === 'packetDamage' && e.sourceId === 'me' && e.delivery === 'ability-direct' && e.targetId === stun.targetId).length).toBeLessThan(2);
  });

  it('the branches name the three exported systems and leave out the empty FinalSlam_Cas', () => {
    expect(CUE_EXTRA_SKILLS['renni-grab']!.map(c => c.system)).toEqual(['be12cd52']);
    expect(CUE_EXTRA_SKILLS['renni-slam']!.map(c => c.system)).toEqual(['2f79da6f', '32bd44a4']);
    expect(Object.values(CUE_EXTRA_SKILLS).flat().some(c => c.system === '0aaf8a76')).toBe(false);
  });
});
