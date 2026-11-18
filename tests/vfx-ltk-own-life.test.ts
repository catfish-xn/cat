import { describe, expect, it } from 'vitest';
import { ownSeconds, withOwnLife } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { mapSkillTimeline, type TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Synthetic emitters only: the numbers here are made up, not read from any game file.
type Emitter = { disabled?: boolean; singleParticle: boolean; lifetime: number | null; timeBeforeFirstEmission: number;
  particleLifetime: { constant: number[]; keys: { values: number[] }[]; tables: { channel: number; single: number; keys: { values: number[] }[] }[] } };
const curve = (value: number, table?: number[]) => ({ constant: [value], keys: [],
  tables: table ? [{ channel: 0, single: 0, keys: table.map(v => ({ values: [v] })) }] : [] });
const system = (...emitters: Emitter[]) => ({ model: { emitters } }) as unknown as Parameters<typeof ownSeconds>[0];

describe('ownSeconds: how long a system plays on its own', () => {
  it('is the latest last particle: a stream emits to its end time, a single particle is born at its start', () => {
    expect(ownSeconds(system(
      { singleParticle: false, lifetime: 1.5, timeBeforeFirstEmission: 0, particleLifetime: curve(0.4) },
      { singleParticle: true, lifetime: null, timeBeforeFirstEmission: 0.2, particleLifetime: curve(1) }))).toBeCloseTo(1.9);
  });
  it('reads a particle life drawn from a probability table up to the table\'s most', () => {
    expect(ownSeconds(system({ singleParticle: true, lifetime: null, timeBeforeFirstEmission: 0, particleLifetime: curve(0.5, [1, 3]) }))).toBeCloseTo(1.5);
  });
  it('has no end for a looping stream, skips disabled emitters and stops at 10 s', () => {
    expect(ownSeconds(system({ singleParticle: false, lifetime: null, timeBeforeFirstEmission: 0, particleLifetime: curve(1) }))).toBeNull();
    expect(ownSeconds(system({ disabled: true, singleParticle: false, lifetime: null, timeBeforeFirstEmission: 0, particleLifetime: curve(1) },
      { singleParticle: false, lifetime: 1, timeBeforeFirstEmission: 0, particleLifetime: curve(1) }))).toBeCloseTo(2);
    expect(ownSeconds(system({ singleParticle: false, lifetime: 20, timeBeforeFirstEmission: 0, particleLifetime: curve(1) }))).toBe(10);
  });
  it('withOwnLife sets the duration only for an ownLife cue with a loaded system that ends', () => {
    const cue: TimelineCue = { system: 's', event: 'hit', delay: 0, duration: 1, ownLife: true };
    const ends = system({ singleParticle: false, lifetime: 2, timeBeforeFirstEmission: 0, particleLifetime: curve(1) });
    expect(withOwnLife(cue, ends).duration).toBeCloseTo(3);
    expect(withOwnLife(cue, undefined)).toBe(cue);
    expect(withOwnLife({ ...cue, ownLife: undefined }, ends).duration).toBe(1);
    expect(withOwnLife(cue, system({ singleParticle: false, lifetime: null, timeBeforeFirstEmission: 0, particleLifetime: curve(1) }))).toBe(cue);
  });
});

describe('C71 cues', () => {
  it("Nocturne's cleave disc and target strike play their own life, uncut", () => {
    for (const id of ['3e224f4a', '6fb6c5e5']) {
      const cue = CUE_OVERRIDES.nocturne!.find(c => c.system === id)!;
      expect(cue).toMatchObject({ action: 'attack', variant: 'empowered', ownLife: true });
      expect(cue.stopAfter).toBeUndefined();
    }
  });
  it("Ziggs's bomb leaves a bone his skeleton has, and its explosion is the primary target's, played to its own end", () => {
    const ziggs = CUE_OVERRIDES.ziggs!;
    expect(ziggs.find(c => c.system === '52963b0a')).toMatchObject({ bone: 'buffbone_glb_weapon_1' });
    expect(ziggs.find(c => c.system === '04c3cba0')).toMatchObject({ primary: true, ownLife: true });
  });
});

describe('cue bones that exist in the skeleton (11-18 bone scan)', () => {
  it("Mel's bolts leave her left hand's locator, not the L_Buffbone_Engine her skeleton lacks", () => {
    const bolt = CUE_OVERRIDES.mel!.find(c => c.system === 'fe407ac6')!;
    expect(bolt.bone).toBe('L_Buffbone_Glb_Hand_Loc');
  });
});

describe('Nocturne strike on every enemy his empowered swing bleeds (C71 option A)', () => {
  const defs: Record<string, string> = { n: 'nocturne', f1: 'amumu', f2: 'amumu', f3: 'amumu' };
  let seq = 0;
  const cast = (tick: number) => ({ type: 'cast', sourceId: 'n', eventSeq: ++seq, tick, actionSeq: seq, completed: true, actualManaSpent: 40, refundedMana: 0,
    targetIds: ['n'], completionCell: { col: 0, row: 0 } }) as unknown as DisplayCombatEvent;
  const attack = (tick: number, targetId: string) => ({ type: 'attack', eventSeq: ++seq, tick, attackerId: 'n', targetId }) as unknown as DisplayCombatEvent;
  const bleed = (tick: number, targetId: string) => ({ type: 'packetDamage', eventSeq: ++seq, tick, sourceId: 'n', targetId, damageType: 'physical',
    sourceKind: 'ability', delivery: 'ability-periodic', raw: 5, actual: 5 }) as unknown as DisplayCombatEvent;
  it('plays once on each other bled enemy at its first bleed tick, never on the swing target again, and again after the next swing', () => {
    const planner = createBatch1VfxEvents(id => defs[id]);
    const events = [cast(1), attack(10, 'f1'), bleed(15, 'f1'), bleed(15, 'f2'), bleed(15, 'f3'), bleed(20, 'f2'), bleed(20, 'f3'), attack(30, 'f2'), bleed(35, 'f2'), bleed(35, 'f3')];
    const played = planner.batch(events).map(p => p.extra.map(x => [x.skill, x.targets]));
    expect(played.flat()).toEqual([['nocturne-tar', ['f2']], ['nocturne-tar', ['f3']], ['nocturne-tar', ['f3']]]);
  });
  it('has the strike skill, played to its own end', () => {
    expect(CUE_EXTRA_SKILLS['nocturne-tar']).toEqual([expect.objectContaining({ system: '6fb6c5e5', event: 'hit', ownLife: true })]);
  });
});

describe('Ziggs split bombs: one row per bomb, from the primary target (C71)', () => {
  it('maps every receipt target after the first, repeats kept, each from the primary', () => {
    const cue: TimelineCue = { system: 'm', action: 'cast', event: 'projectile', everyReceipt: true, fromPrimary: true, delay: 0.8, duration: 0.5, travelSeconds: 0.5 };
    const { spawns } = mapSkillTimeline([cue], 'z', ['p', 'a', 'p', 'a']);
    expect(spawns.map(s => [s.targetId, s.fromId])).toEqual([['a', 'p'], ['p', 'p'], ['a', 'p']]);
    expect(mapSkillTimeline([{ ...cue, optional: true }], 'z', ['p']).spawns).toEqual([]);
  });
  it('the main bomb and its burst are the primary target\'s; the split bombs follow the main bomb\'s landing', () => {
    const ziggs = CUE_OVERRIDES.ziggs!;
    const main = ziggs.find(c => c.system === '52963b0a' && !c.everyReceipt)!, burst = ziggs.find(c => c.system === '04c3cba0' && !c.everyReceipt)!;
    const split = ziggs.find(c => c.system === '52963b0a' && c.everyReceipt)!, splitBurst = ziggs.find(c => c.system === '04c3cba0' && c.everyReceipt)!;
    expect(burst.delay).toBeCloseTo(main.delay + main.travelSeconds!);
    expect(split).toMatchObject({ fromPrimary: true, delay: burst.delay });
    expect(splitBurst.delay).toBeCloseTo(split.delay + split.travelSeconds!);
    // Our own display rhythm: a whole number of combat ticks.
    expect(Math.abs(split.travelSeconds! * 20 - Math.round(split.travelSeconds! * 20))).toBeLessThan(1e-9);
  });
});
