import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_OVERRIDES, DISABLED_EMITTERS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { effectImportance } from '../src/rendering/three-mode/effect-budget';

let seq = 0;
const ev = (e: Record<string, unknown>) => ({ eventSeq: ++seq, ...e }) as unknown as DisplayCombatEvent;
const cast = (tick: number) => ev({ type: 'cast', tick, sourceId: 'm', targetIds: ['a', 'b'], actionSeq: tick, completed: true });
const attack = (tick: number) => ev({ type: 'attack', tick, attackerId: 'm', targetId: 'a' });
const ended = (tick: number) => ev({ type: 'abilityEffectEnded', tick, unitId: 'm', effect: 'mordekaiser-empower', targetIds: [] });

describe('Mordekaiser\'s grasp and empowered mace (Fable 11-19)', () => {
  it('his attacks are empowered from his cast until the rules end his empowered time', () => {
    const planner = createBatch1VfxEvents(id => ({ m: 'mordekaiser', a: 'amumu', b: 'amumu' } as Record<string, string>)[id]);
    const variants = planner.batch([attack(1), cast(2), attack(5), attack(30), ended(200), attack(210)]).map(p => p.variant);
    expect(variants).toEqual([undefined, undefined, 'empowered', 'empowered', undefined, undefined]);
  });

  it('the grasp plays out whole as the skill\'s body, its pit and walls held off; its shockwave and flash hit each enemy struck', () => {
    const cues = CUE_OVERRIDES.mordekaiser!;
    const grasp = cues.find(cue => cue.system === 'a7c49a29')!;
    expect(grasp.stopAfter).toBeUndefined();
    expect(effectImportance(grasp)).toBe('body');
    expect(DISABLED_EMITTERS['a7c49a29']).toEqual(['Stencil_Cap', 'Mesh_Edge', 'Stencil_Gradient', 'Mesh_Edge_Red', 'Mesh_Edge_Dark', 'Stencil_InnerDarkness', 'Mesh_Walls_Red', 'Mesh_Walls_Dark']);
    for (const system of ['38c1db88', 'ed3f2170']) {
      const cue = cues.find(c => c.system === system)!;
      expect([cue.action, cue.event]).toEqual(['cast', 'hit']);
      expect(effectImportance(cue)).toBe('critical');
    }
    // A play selects cues by variant: a plain attack plays the plain hit, an empowered one only the empowered list, which
    // carries the same hit once (else empowered attacks would show none).
    for (const variant of [undefined, 'empowered'] as const)
      expect(cues.filter(cue => cue.action === 'attack' && cue.variant === variant && cue.system === '0f2af66b')).toHaveLength(1);
    for (const system of ['21bee60f', '04ae533c']) {
      const mace = cues.filter(cue => cue.system === system);
      expect(mace.map(cue => [cue.action, cue.variant])).toEqual([['attack', 'empowered']]);
      expect(effectImportance(mace[0]!)).toBe('decorative');
    }
  });
});

describe('Mordekaiser\'s attack swing (Fable 11-19)', () => {
  it('his attack draws the swing of the attack clip we play, at the attack rank, facing the way he faces', async () => {
    const { unitAnchor } = await import('../src/rendering/three-mode/vfx-ltk/particles');
    const { Group } = await import('three');
    const swing = CUE_OVERRIDES.mordekaiser!.find(cue => cue.system === '867941e7')!;
    expect([swing.action, swing.variant, swing.event]).toEqual(['attack', undefined, 'cast-start']);
    expect(effectImportance(swing)).toBe('attack');
    // Its layout locator only lends its place (his points backward): the swing faces the way the unit faces.
    const root = new Group(), body = new Group(), layout = new Group();
    layout.name = 'C_Buffbone_Glb_Layout_Loc'; layout.rotation.y = Math.PI; body.add(layout); root.add(body);
    const basis = (bone?: string) => [...unitAnchor(root, body, bone).basisInto(0, new Float32Array(9))].map(n => Math.round(n) || 0);
    expect(basis(swing.bone)).toEqual(basis());
  });
});
