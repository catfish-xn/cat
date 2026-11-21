import { describe, expect, it, vi } from 'vitest';
import { createBatch2VfxBridge } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withFlightSeconds, type LtkPlayOptions } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Gangplank's ranged-form attack follows the rules' own launch and landing (attackLaunched / attackLanded): the shot leaves on
// the launch and lands on the arrival tick, the tick his damage lands; its hit plays on a landing that hit. An attack the rules
// settle at once (his melee form) has no launch and plays his own list, as does his cast.
function bridge() {
  const play = vi.fn((_champion: string, _source: string, _targets: readonly string[], _action: string, _context: LtkPlayOptions) => true);
  const host = { unit: (_id: string) => ({ definitionId: 'gangplank', form: 'back', alive: true, starLevel: 2 }), board: () => null, play };
  return { bridge: createBatch2VfxBridge(host as never), play };
}
const launched = { type: 'attackLaunched', tick: 100, attackerId: 'gp', targetId: 'foe', arrivalTick: 108, projectile: 'flight' } as const;
const attack = { type: 'attack', tick: 100, attackerId: 'gp', targetId: 'foe' } as const;
describe("Gangplank's ranged attack", () => {
  it("the shot leaves on the rules' launch and flies their flight; the attack itself plays nothing more", () => {
    const { bridge: b, play } = bridge();
    b.begin([attack, launched] as never);
    expect(b.action('attack', 'gp', ['foe'])).toBe(true);
    expect(play).not.toHaveBeenCalled();
    b.event(launched as never, true);
    expect(play.mock.calls).toHaveLength(1);
    expect(play.mock.calls[0]!.slice(0, 4)).toEqual(['gangplank', 'gp', ['foe'], 'passive']);
    expect(play.mock.calls[0]![4]).toMatchObject({ skill: 'gangplank-ranged-flight' });
    expect(play.mock.calls[0]![4].flightSeconds).toBeCloseTo(8 * 0.05, 10);
  });
  it('its hit plays on a landing that hit, never on a miss or in catch-up', () => {
    const { bridge: b, play } = bridge();
    b.event({ type: 'attackLanded', tick: 108, attackerId: 'gp', targetId: 'foe', hit: false } as never, true);
    b.event({ type: 'attackLanded', tick: 108, attackerId: 'gp', targetId: 'foe', hit: true } as never, false);
    b.event(launched as never, false);
    expect(play).not.toHaveBeenCalled();
    b.event({ type: 'attackLanded', tick: 108, attackerId: 'gp', targetId: 'foe', hit: true } as never, true);
    expect(play.mock.calls[0]!.slice(0, 4)).toEqual(['gangplank', 'gp', ['foe'], 'passive']);
    expect(play.mock.calls[0]![4]).toMatchObject({ skill: 'gangplank-ranged-land' });
  });
  it('an attack without a launch (melee form), and any cast, fall through to his own list', () => {
    const { bridge: b, play } = bridge();
    b.begin([attack] as never);
    expect(b.action('attack', 'gp', ['foe'])).toBeUndefined();
    expect(b.action('cast', 'gp', ['foe'], { type: 'cast', sourceId: 'gp', actionSeq: 1, tick: 1 } as never)).toBeUndefined();
    expect(play).not.toHaveBeenCalled();
  });
  it('the shot leaves at once from his hand and lands when the flight ends; the hit starts on the landing', () => {
    const shot = CUE_EXTRA_SKILLS['gangplank-ranged-flight']!, hit = CUE_EXTRA_SKILLS['gangplank-ranged-land']!;
    expect(shot).toHaveLength(1); expect(hit).toHaveLength(1);
    expect(shot[0]).toMatchObject({ system: 'bb62fca2', action: 'passive', event: 'projectile', bone: 'r_hand', delay: 0 });
    expect(hit[0]).toMatchObject({ system: '0f2af66b', action: 'passive', event: 'hit', delay: 0 });
    const flown = withFlightSeconds(shot[0]!, 0.4);
    expect(flown.travelSeconds).toBe(0.4); expect(flown.duration).toBeCloseTo(0.4, 10);
    expect(mapSkillTimeline([...shot, ...hit], 'gp', ['foe']).unsupported).toEqual([]);
  });
});
