import { describe, expect, it, vi } from 'vitest';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { createBatch2VfxBridge } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withFlightSeconds, type LtkPlayOptions } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Cassiopeia's comet follows the rules' own projectile ('cassiopeia-bolt'): it leaves on the launch and flies to the arrival
// tick, the tick her damage lands; its hit plays on a landing that hit. Her cast itself plays nothing.
function bridge() {
  const play = vi.fn((_champion: string, _source: string, _targets: readonly string[], _action: string, _context: LtkPlayOptions) => true);
  const host = { unit: (_id: string) => ({ definitionId: 'cassiopeia', form: 'back', alive: true, starLevel: 2 }), board: () => null, play };
  return { bridge: createBatch2VfxBridge(host as never), play };
}
const launched = { type: 'abilityProjectileLaunched', tick: 110, sourceId: 'cass', targetId: 'foe', arrivalTick: 118, skill: 'cassiopeia-bolt', ordinal: 0, actionSeq: 4, count: 1 } as const;
const landed = (hit: boolean) => ({ type: 'abilityProjectileLanded', tick: 118, sourceId: 'cass', targetId: 'foe', skill: 'cassiopeia-bolt', ordinal: 0, actionSeq: 4, count: 1, hit }) as const;

describe("Cassiopeia's comet from the rules' projectile", () => {
  it('leaves on the launch and flies the rules\' flight', () => {
    const { bridge: b, play } = bridge();
    b.event(launched as never, true);
    expect(play.mock.calls).toHaveLength(1);
    expect(play.mock.calls[0]!.slice(0, 4)).toEqual(['cassiopeia', 'cass', ['foe'], 'passive']);
    expect(play.mock.calls[0]![4]).toMatchObject({ skill: 'cassiopeia-bolt' });
    expect(play.mock.calls[0]![4].flightSeconds).toBeCloseTo(8 * 0.05, 10);
  });
  it('its hit plays on a landing that hit, never on a miss or in catch-up', () => {
    const { bridge: b, play } = bridge();
    b.event(landed(false) as never, true);
    b.event(landed(true) as never, false);
    b.event(launched as never, false);
    expect(play).not.toHaveBeenCalled();
    b.event(landed(true) as never, true);
    expect(play.mock.calls[0]!.slice(0, 4)).toEqual(['cassiopeia', 'cass', ['foe'], 'passive']);
    expect(play.mock.calls[0]![4]).toMatchObject({ skill: 'cassiopeia-bolt-hit' });
  });
  it('the comet leaves at once and lands when the flight ends; the hit starts on the landing', () => {
    const shot = CUE_EXTRA_SKILLS['cassiopeia-bolt']!, hit = CUE_EXTRA_SKILLS['cassiopeia-bolt-hit']!;
    const flown = withFlightSeconds(shot[0]!, 0.6);
    expect(flown.travelSeconds).toBe(0.6);
    expect(hit[0]!.delay).toBe(0);
    expect(mapSkillTimeline([...shot, ...hit], 'cass', ['foe']).unsupported).toEqual([]);
  });
  it('her cast plays no effect of its own (she still turns to her target)', () => {
    const plans = createBatch1VfxEvents(id => (id === 'cass' ? 'cassiopeia' : 'amumu')).batch([
      { type: 'cast', tick: 100, eventSeq: 1, sourceId: 'cass', actionSeq: 4, targetIds: ['foe'] } as never]);
    expect(plans[0]!.noCastEffect).toBe(true);
    expect(plans[0]!.skipCast).toBeUndefined();
  });
});
