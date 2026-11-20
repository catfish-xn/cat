import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents, PROJECTILE_VISUALS } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES, LUX_SELF_SHIELD_TICKS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withFlightSeconds } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { LUX_SELF_SHIELD_TICKS as RULES_LUX_SELF_SHIELD_TICKS } from '../src/simulation/cast-windup';
import { ABILITY_PROJECTILE_OWNER } from '../src/simulation/ability-projectile';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

const definitions: Record<string, string> = { lx: 'lux', al: 'amumu', mk: 'mordekaiser' };
const launched = (sourceId: string, skill: string, tick: number, targetId: string, arrivalTick: number): DisplayCombatEvent =>
  ({ type: 'abilityProjectileLaunched', tick, eventSeq: tick, sourceId, targetId, arrivalTick, skill, ordinal: 0, actionSeq: 1, count: 1 } as unknown as DisplayCombatEvent);
const landed = (sourceId: string, skill: string, tick: number, targetId: string, hit: boolean): DisplayCombatEvent =>
  ({ type: 'abilityProjectileLanded', tick, eventSeq: tick + 100, sourceId, targetId, skill, ordinal: 0, actionSeq: 1, count: 1, hit } as unknown as DisplayCombatEvent);

describe('landing batch rendering: skill projectiles follow the rules\' launch and landing events', () => {
  it("Lux's shield on herself lands LUX_SELF_SHIELD_TICKS after her cast, the rules' own value", () => {
    expect(LUX_SELF_SHIELD_TICKS).toBe(RULES_LUX_SELF_SHIELD_TICKS);
    const self = CUE_OVERRIDES.lux!.filter(c => c.system === '44c9516a');
    expect(self.map(c => [c.action, c.variant, c.event, c.delay])).toEqual([['cast', 'self', 'cast-start', LUX_SELF_SHIELD_TICKS * 0.05]]);
    // On an ally her cast plays neither the shield's flight nor its bubble: the events do.
    expect(CUE_OVERRIDES.lux!.some(c => c.action === 'cast' && c.variant === undefined && ['f2d605de', '44c9516a'].includes(c.system))).toBe(false);
  });
  it("Lux's shield on an ally: flight on the launch for the rule's flight, bubble on a landing that hit", () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([launched('lx', 'lux-shield', 10, 'al', 16), landed('lx', 'lux-shield', 16, 'al', true)]);
    expect(plans.map(p => p.extra.map(x => [x.champion, x.skill, x.targets, x.flightSeconds]))).toEqual([
      [['lux', 'lux-shield-flight', ['al'], expect.closeTo(0.3, 5)]], [['lux', 'lux-shield-land', ['al'], undefined]]]);
    expect(CUE_EXTRA_SKILLS['lux-shield-land']![0]).toMatchObject({ system: '44c9516a', event: 'hit', delay: 0, livingTarget: true });
    expect(CUE_EXTRA_SKILLS['lux-shield-flight']![0]).toMatchObject({ system: 'f2d605de', event: 'projectile' });
  });
  it("Mordekaiser's claw plays only its landing (its ground band stays on his cast), and only on a hit", () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([launched('mk', 'mordekaiser-claw', 4, 'al', 27),
      landed('mk', 'mordekaiser-claw', 27, 'al', true), landed('mk', 'mordekaiser-claw', 27, 'al', false)]);
    expect(plans.map(p => p.extra.map(x => x.skill))).toEqual([[], ['mordekaiser-claw-land'], []]);
  });
  it('every rules projectile skill has an owner here, the rules\' own', () => {
    for (const [skill, owner] of Object.entries(ABILITY_PROJECTILE_OWNER)) if (PROJECTILE_VISUALS.has(skill)) expect(PROJECTILE_VISUALS.get(skill)!.owner).toBe(owner);
    for (const [skill, visual] of PROJECTILE_VISUALS) {
      if (visual.flight) expect(CUE_EXTRA_SKILLS[`${skill}-flight`]?.length).toBeGreaterThan(0);
      if (skill !== 'mordekaiser-claw' && visual.land) expect(CUE_EXTRA_SKILLS[`${skill}-land`]?.length).toBeGreaterThan(0);
    }
  });
  it('withFlightSeconds: a projectile flies the given time, a spanFlight cue lasts it plus its own tail, others are untouched', () => {
    const shot: TimelineCue = { system: 's', event: 'projectile', delay: 0, duration: 0.5, travelSeconds: 0.3 };
    const band: TimelineCue = { system: 'b', event: 'cast-start', delay: 0, duration: 0.2, spanFlight: true };
    const hit: TimelineCue = { system: 'h', event: 'hit', delay: 0, duration: 1 };
    expect(withFlightSeconds(shot, 1)).toMatchObject({ travelSeconds: 1, duration: 1.2 });
    expect(withFlightSeconds(band, 1).duration).toBeCloseTo(1.2);
    expect(withFlightSeconds(hit, 1)).toBe(hit);
  });
});
