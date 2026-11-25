import { describe, expect, it, vi } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch2VfxBridge } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// Sevika's rocket mod (draft): each rocket plays from the rules' own events, its flight as it leaves and its explosion where
// it lands, instead of one flight and one explosion on a fixed delay from her cast.
function bridge() {
  const play = vi.fn((..._args: unknown[]) => true);
  const host = { unit: () => ({ definitionId: 'sevika', form: 'front' as const, alive: true, starLevel: 2 }), board: () => null, play };
  return { b: createBatch2VfxBridge(host as never), play };
}
const skill = (call: unknown[]) => (call[4] as { skill: string }).skill;
const launched = (tick: number, ordinal: number, arrivalTick: number): DisplayCombatEvent => ({ type: 'abilityProjectileLaunched', tick, eventSeq: tick, sourceId: 's',
  targetId: 't', arrivalTick, skill: 'sevika-rocket', ordinal, actionSeq: 1, count: 3 } as unknown as DisplayCombatEvent);
const landed = (tick: number, ordinal: number, hit = true): DisplayCombatEvent => ({ type: 'abilityProjectileLanded', tick, eventSeq: tick, sourceId: 's', targetId: 't',
  skill: 'sevika-rocket', ordinal, actionSeq: 1, count: 3, hit } as unknown as DisplayCombatEvent);

describe('Sevika\'s rocket mod, rocket by rocket', () => {
  it('her cast no longer plays the rocket mod; shield and coin still start with the slot machine\'s stop', () => {
    for (const [outcome, expected] of [['rocket', ['sevika-slots']], ['shield', ['sevika-shield']]] as const) {
      const { b, play } = bridge();
      const cast = { type: 'cast', eventSeq: 1, tick: 0, sourceId: 's', actionSeq: 1, targetIds: ['t'], completed: true, actualManaSpent: 0, refundedMana: 0, completionCell: { col: 0, row: 0 } } as DisplayCombatEvent;
      const roll = { type: 'castOutcome', eventSeq: 2, tick: 0, unitId: 's', abilityKey: 'sevika-ability', outcome, subOutcomes: [], castVariant: { actionSeq: 1, move: 'chomp', channelTicks: 0, enhanced: false, heroAugmentIds: [] } } as DisplayCombatEvent;
      b.begin([cast, roll]); b.action('cast', 's', ['t'], cast as never);
      const skills = play.mock.calls.map(skill);
      expect(skills.includes('sevika-rocket')).toBe(false);
      for (const name of expected) expect(skills).toContain(name);
    }
  });
  it('each rocket flies the rules\' own flight as it leaves and explodes where it lands; one that lands on nothing does not explode', () => {
    const { b, play } = bridge();
    for (const e of [launched(30, 0, 36), launched(31, 1, 37), landed(36, 0), landed(37, 1, false)]) b.event(e, true);
    expect(play.mock.calls.map(skill)).toEqual(['sevika-rocket-fire', 'sevika-rocket-fire', 'sevika-rocket-boom']);
    expect((play.mock.calls[0]![4] as { flightSeconds: number }).flightSeconds).toBeCloseTo(6 * 0.05, 9);
  });
  it('both branches stay well under the per-skill cue limit', () => {
    for (const name of ['sevika-rocket-fire', 'sevika-rocket-boom']) expect(CUE_EXTRA_SKILLS[name]!.length).toBeLessThanOrEqual(12);
  });
});
