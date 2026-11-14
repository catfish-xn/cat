import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh } from 'three';
import { BODY_TO_FX, CHAMPION_SOURCE_SCALE, fitModel } from '../src/rendering/three-mode/model-fit';
import { ARENA_UNIT_SCALE, FX_SOURCE_SCALE, SKILL_FX_SIZE, cueSize } from '../src/rendering/three-mode/vfx-ltk/fx-size';
import { sevikaSkills } from '../src/rendering/three-mode/vfx-ltk/champions/sevika';

// Synthetic box bodies, made-up sizes.
const body = (height: number) => { const root = new Group(); root.add(new Mesh(new BoxGeometry(20, height, 20))); return root; };

describe('champion bodies at the arena scale', () => {
  it('draws a body at the arena League-unit scale, the one coefficient', () => {
    expect(CHAMPION_SOURCE_SCALE).toBe(ARENA_UNIT_SCALE);
    expect(fitModel(body(200), { height: 92, unitScale: 1.5, sourceScale: CHAMPION_SOURCE_SCALE })).toBeCloseTo(200 * 1.5 * ARENA_UNIT_SCALE, 6);
    const before = fitModel(body(200), { height: 92, unitScale: 1.5, sourceScale: FX_SOURCE_SCALE });
    expect(fitModel(body(200), { height: 92, unitScale: 1.5, sourceScale: CHAMPION_SOURCE_SCALE }) / before).toBeCloseTo(BODY_TO_FX, 9);
  });

  it('keeps a body-sized cue and an arena-sized cue the same size (BODY_TO_FX equals SKILL_FX_SIZE)', () => {
    expect(BODY_TO_FX).toBeCloseTo(SKILL_FX_SIZE, 12);
    expect(cueSize({ bone: 'R_Weapon', event: 'cast-start' })).toBe(BODY_TO_FX);
    expect(cueSize({ bone: 'C_Buffbone_Glb_Chest_Loc', event: 'hit' })).toBe(SKILL_FX_SIZE);
    expect(cueSize({ bone: 'R_Weapon', event: 'projectile' })).toBe(SKILL_FX_SIZE); // a missile leaves the weapon
  });

  it('does not shrink Sevika\'s claw-held flame cone twice', () => {
    for (const id of ['sevika-flamethrower', 'sevika-blue-flamethrower'] as const)
      for (const cue of sevikaSkills[id]!.filter(c => c.bone === 'L_ClampB')) expect(cue.scale ?? 1).toBe(1);
  });
});

describe('carousel, scout stage and legends (off by default, Fable 11-12)', () => {
  it('keep their FX_SCALE bodies and the fixed legend baseline until switched on', async () => {
    const fit = await import('../src/rendering/three-mode/model-fit');
    expect(fit.STAGE_ARENA_SCALE).toBe(false);
    expect(fit.STAGE_SOURCE_SCALE).toBe(FX_SOURCE_SCALE);
    expect(fit.STAGE_BODY_FACTOR).toBe(1);
  });

  it('shrinks body-hugging hand sizes with the body and keeps range sizes in cells', async () => {
    const { CUE_OVERRIDES } = await import('../src/rendering/three-mode/vfx-ltk/cue-overrides');
    const { measuredAtFxScale, measuredOnBody } = await import('../src/rendering/three-mode/vfx-ltk/fx-size');
    expect(measuredOnBody(1)).toBeCloseTo(measuredAtFxScale(1) * BODY_TO_FX);
    const scaleOf = (champion: string, system: string) => CUE_OVERRIDES[champion]!.filter(cue => cue.system === system).map(cue => cue.scale);
    // Hugging a body: Lux's shield, Zyra's chest hit on each rooted target, Nunu's per-target splash.
    expect(scaleOf('lux', '44c9516a')).toEqual([measuredOnBody(1), measuredOnBody(1)]);
    expect(scaleOf('zyra', '9d413df0')).toEqual([measuredOnBody(1), measuredOnBody(1)]);
    expect(scaleOf('nunu', '5dfd387b')).toEqual([measuredOnBody(0.7)]);
    // Ranges measured in cells: unchanged.
    expect(scaleOf('nunu', '78d04f27')).toEqual([measuredAtFxScale(0.43)]);
    expect(scaleOf('nunu', '8c256426')).toEqual([measuredAtFxScale(0.43)]);
    expect(scaleOf('irelia', '08b7a939')).toEqual([measuredAtFxScale(1)]);
    expect(scaleOf('garen', '5bbccb8c')).toEqual([measuredAtFxScale(0.45)]);
  });
});
