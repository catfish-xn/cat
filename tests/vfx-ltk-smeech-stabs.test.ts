import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES, SMEECH_STAB_SWING } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

const DEFS: Record<string, string> = { s: 'smeech', a: 'amumu', b: 'amumu' };
let seq = 0;
const cast = (tick: number) => ({ type: 'cast', tick, eventSeq: ++seq, sourceId: 's', targetIds: [], actionSeq: tick, completed: true }) as unknown as DisplayCombatEvent;
const stab = (tick: number, targetId: string, sourceKind = 'ability', delivery = 'ability-direct') =>
  ({ type: 'packetDamage', tick, eventSeq: ++seq, sourceId: 's', targetId, damageType: 'physical', sourceKind, delivery }) as unknown as DisplayCombatEvent;
const skills = (planner: ReturnType<typeof createBatch1VfxEvents>, events: DisplayCombatEvent[]) =>
  planner.batch(events).flatMap(plan => plan.extra.filter(fx => fx.champion === 'smeech').map(fx => `${fx.skill}>${fx.targets.join()}`));

describe('Smeech\'s stabs draw his swings and their hit (his cast names no target; Fable 11-19 A)', () => {
  it('each stab plays his stab slash and the hit on the enemy stabbed; a new enemy also gets the leap\'s trail', () => {
    const planner = createBatch1VfxEvents(id => DEFS[id]);
    expect(skills(planner, [cast(10), stab(10, 'a')])).toEqual(['smeech-leap>a', 'smeech-stab>a']);
    expect(skills(planner, [stab(17, 'a')])).toEqual(['smeech-stab>a']);
    expect(skills(planner, [stab(24, 'a')])).toEqual(['smeech-stab>a']);
    // The target died; he leaps to the next one.
    expect(skills(planner, [stab(38, 'b')])).toEqual(['smeech-leap>b', 'smeech-stab>b']);
    expect(skills(planner, [stab(45, 'b')])).toEqual(['smeech-stab>b']);
    // A new cast draws the leap again, even on the same enemy.
    expect(skills(planner, [cast(100), stab(100, 'b')])).toEqual(['smeech-leap>b', 'smeech-stab>b']);
    // His basic attacks draw none of it.
    expect(skills(planner, [stab(120, 'b', 'attack', 'basic-attack')])).toEqual([]);
  });

  it('his cast keeps only its launch and trail; the swings, their hit and the leap trail live in the stab branches', () => {
    const castSystems = CUE_OVERRIDES.smeech!.filter(cue => cue.action === 'cast').map(cue => cue.system);
    expect(castSystems).toEqual(['17b8eb5c', '5cde9f59']);
    // Only the thin vertical slash of his skill's stab clips; his other swings belong to his attack clips.
    expect(CUE_EXTRA_SKILLS['smeech-stab']!.map(cue => [cue.system, cue.event])).toEqual([[SMEECH_STAB_SWING, 'cast-start'], ['9acdae50', 'hit']]);
    expect(Object.keys(CUE_EXTRA_SKILLS).filter(key => key.startsWith('smeech-stab'))).toEqual(['smeech-stab']);
    expect(CUE_EXTRA_SKILLS['smeech-leap']!.map(cue => [cue.system, cue.event])).toEqual([['a664114c', 'projectile']]);
  });

  it('his attack draws the horizontal swing of the attack clip we play, at the attack rank', async () => {
    const { effectImportance } = await import('../src/rendering/three-mode/effect-budget');
    const swing = CUE_OVERRIDES.smeech!.find(cue => cue.system === '343e410d')!;
    expect([swing.action, swing.event]).toEqual(['attack', 'cast-start']);
    expect(effectImportance(swing)).toBe('attack');
  });
});
