import { describe, expect, it } from 'vitest';
import { BATCH1_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/batch1-timelines';
import { CUE_ADDITIONS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Kog'Maw's skill flight (b9318ef6) leaves and lands with each basic attack's own projectile, so it arrives on the skill
// hit (633e1b82) that already plays as the attack lands.
describe("Kog'Maw's skill flight on every basic attack", () => {
  const attack = BATCH1_TIMELINES.kogmaw.filter(c => c.action === 'attack');
  const missile = attack.find(c => c.event === 'projectile')!, skillHit = attack.find(c => c.system === '633e1b82')!;
  const flight = CUE_ADDITIONS.kogmaw!.find(c => c.system === 'b9318ef6')!;
  it('leaves with the attack projectile, from the same bone, and lands on the skill hit', () => {
    expect(flight).toMatchObject({ action: 'attack', event: 'projectile', delay: missile.delay, travelSeconds: missile.travelSeconds, bone: missile.bone, targetBone: missile.targetBone });
    expect(flight.delay + flight.travelSeconds!).toBeCloseTo(skillHit.delay, 6);
    expect(flight.variant).toBeUndefined();
  });
  it('is added to the exported list, which keeps every exported cue', () => {
    const systems = new Set<string>([...BATCH1_TIMELINES.kogmaw.map(c => c.system), 'b9318ef6']);
    const index = { version: 1, systems: Object.fromEntries([...systems].map(id => [id, `systems/${id}.json`])), assets: {}, skills: { kogmaw: BATCH1_TIMELINES.kogmaw } };
    const out = (withCueOverrides(index as never) as unknown as { skills: Record<string, TimelineCue[]> }).skills.kogmaw!;
    for (const cue of BATCH1_TIMELINES.kogmaw) expect(out.some(c => c.system === cue.system && c.event === cue.event)).toBe(true);
    expect(out.filter(c => c.system === 'b9318ef6')).toHaveLength(1);
  });
});
