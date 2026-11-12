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
