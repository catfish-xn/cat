import { describe, expect, it } from 'vitest';
import * as rc from '../dev/castcmp/real-combat';
import { createBatch1VfxEvents, type Batch1Visual } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { RENNI_LIFT_TICKS, RENNI_SLAM_AFTER_STUN_TICKS } from '../src/simulation/cast-windup';

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

describe('Renni: Q_tar and the final slam play from her lift and set-down events', () => {
  it.each([1, 2, 3])('%i star: one grab on the lifted enemy when she lifts it, one slam on the enemies her closing splash strikes', star => {
    const { events, castTick, plays } = renniCombat(star);
    const carry = events.flat().filter((e: any) => e.type === 'carryChanged' && e.holderId === 'me');
    const up = carry.find((e: any) => e.carried), down = carry.find((e: any) => !e.carried);
    expect(up.tick).toBe(castTick + RENNI_LIFT_TICKS);
    const grabs = plays.filter(p => p.visual.skill === 'renni-grab'), slams = plays.filter(p => p.visual.skill === 'renni-slam');
    expect(grabs.map(p => [p.tick, p.visual.targets])).toEqual([[up.tick, [up.targetId]]]);
    expect(slams).toHaveLength(1);
    const slam = slams[0]!;
    // The slam is the tick the rule's closing splash lands, RENNI_SLAM_AFTER_STUN_TICKS after the set-down.
    expect(slam.tick).toBe(down.tick + RENNI_SLAM_AFTER_STUN_TICKS);
    const struck = events[slam.tick].filter((e: any) => e.type === 'packetDamage' && e.sourceId === 'me' && e.delivery === 'ability-direct').map((e: any) => e.targetId);
    expect(struck).toContain(up.targetId);
    expect(slam.visual.targets[0]).toBe(up.targetId);
    expect(new Set(slam.visual.targets)).toEqual(new Set(struck));
    // Nothing of hers strikes between the set-down and the slam.
    for (let t = down.tick + 1; t < slam.tick; t++)
      expect(events[t].filter((e: any) => e.type === 'packetDamage' && e.sourceId === 'me' && e.delivery === 'ability-direct')).toEqual([]);
  });
  it('the branches name Q_tar, FinalSlam_Impact and FinalSlam_Tar only', () => {
    expect(CUE_EXTRA_SKILLS['renni-grab']!.map(c => c.system)).toEqual(['be12cd52']);
    expect(CUE_EXTRA_SKILLS['renni-slam']!.map(c => c.system)).toEqual(['2f79da6f', '32bd44a4']);
    expect(Object.values(CUE_EXTRA_SKILLS).flat().some(c => c.system === '0aaf8a76')).toBe(false);
  });
  it('the grab follows her lift, not a stun; the slam is her first strike after the set-down, not the set-down tick', () => {
    const ids = new Map([['r', 'renni'], ['x', 'amumu'], ['y', 'amumu'], ['s', 'sett']]);
    const planner = createBatch1VfxEvents(id => ids.get(id));
    let seq = 0;
    const ev = (e: Record<string, unknown>) => ({ ...e, eventSeq: ++seq }) as never;
    const packet = (tick: number, targetId: string) => ev({ type: 'packetDamage', tick, sourceId: 'r', targetId, damageType: 'physical', hit: true,
      hpDamage: 10, absorbed: 0, critical: false, killingPacket: false, sourceKind: 'ability', delivery: 'ability-direct' });
    const carry = (tick: number, carried: boolean) => ev({ type: 'carryChanged', tick, holderId: 'r', targetId: 'y', carried });
    const plays = (batch: never[]) => planner.batch(batch).flatMap(p => p.extra);
    // Tick 5: Renni casts while Sett stuns x: nothing plays yet.
    expect(plays([ev({ type: 'cast', tick: 5, sourceId: 'r', targetIds: [], completed: true }),
      ev({ type: 'statusChanged', tick: 5, targetId: 'x', kind: 'stun', reason: 'applied', effectiveMagnitudeBps: 0 })])).toEqual([]);
    expect(plays([carry(13, true), ev({ type: 'statusChanged', tick: 13, targetId: 'y', kind: 'stun', reason: 'applied', effectiveMagnitudeBps: 0 })])
      .map(v => [v.skill, v.targets])).toEqual([['renni-grab', ['y']]]);
    expect(plays([packet(14, 'y'), packet(14, 'y')])).toEqual([]);
    expect(plays([packet(43, 'y'), carry(43, false)])).toEqual([]);
    expect(plays([packet(45, 'x'), packet(45, 'y')]).map(v => [v.skill, v.targets])).toEqual([['renni-slam', ['y', 'x']]]);
  });
});
