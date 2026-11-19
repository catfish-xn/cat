import { describe, expect, it } from 'vitest';
import { ownSeconds, withOwnLife } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

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
