import { describe, expect, it } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { BIG_THREE_STAR_COST, FIVE_COST_THREE_STAR_SCALE, STAR_BODY_SCALE, fitModel, starBodyScale, starBodyScaleOf, useUnitCost } from '../src/rendering/three-mode/model-fit';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { readFileSync } from 'node:fs';
import { unitCostOf } from '../src/rendering/three-mode/unit-cost';

/** A plain 10-unit-tall body standing on y=0 in its own units (no skin, no grounding calibration). */
function body() {
  const geometry = new BoxGeometry(4, 10, 4).translate(0, 5, 0), material = new MeshBasicMaterial();
  const group = new Group(); group.add(new Mesh(geometry, material));
  return { group, dispose() { geometry.dispose(); material.dispose(); } };
}
const drawn = (group: Group) => { group.updateMatrixWorld(true); return new Box3().setFromObject(group); };

describe('2026-11-03 star-level body size', () => {
  it('measures 2★ at 1.18× and 3★ (and a promoted 4) at 1.33× the 1-star size', () => {
    expect(STAR_BODY_SCALE).toEqual({ 1: 1, 2: 1.18, 3: 1.33 });
    expect(starBodyScale(1)).toBe(1); expect(starBodyScale(2)).toBe(1.18);
    expect(starBodyScale(3)).toBe(1.33); expect(starBodyScale(4)).toBe(1.33);
  });

  it('a starred official-scale body is 1.18× / 1.33× as tall with its feet still on y=0', () => {
    const heights: number[] = [];
    for (const level of [1, 2, 3]) {
      const toy = body();
      try {
        const height = fitModel(toy.group, { height: 92, width: 110, sourceScale: 0.44, unitScale: 0.9 * starBodyScale(level) });
        const box = drawn(toy.group);
        expect(box.min.y).toBeCloseTo(0, 6);
        expect(box.max.y - box.min.y).toBeCloseTo(height, 6);
        heights.push(height);
      } finally { toy.dispose(); }
    }
    expect(heights[0]).toBeCloseTo(10 * 0.44 * 0.9, 6);
    expect(heights[1]! / heights[0]!).toBeCloseTo(1.18, 6);
    expect(heights[2]! / heights[0]!).toBeCloseTo(1.33, 6);
  });

  it('draws a five-cost three-star about 1.42 times its two-star; four-cost three-stars and five-cost two-stars keep the old sizes', () => {
    expect(BIG_THREE_STAR_COST).toBe(5);
    expect(FIVE_COST_THREE_STAR_SCALE).toBeCloseTo(STAR_BODY_SCALE[2]! * 1.42, 10);
    expect(starBodyScale(3, 5)).toBe(FIVE_COST_THREE_STAR_SCALE);
    expect(starBodyScale(4, 5)).toBe(FIVE_COST_THREE_STAR_SCALE);
    expect(starBodyScale(3, 6)).toBe(FIVE_COST_THREE_STAR_SCALE);
    // One sizing for every cost would turn one of these red.
    expect(starBodyScale(3, 4)).toBe(1.33);
    expect(starBodyScale(2, 5)).toBe(1.18);
    expect(starBodyScale(1, 5)).toBe(1);
    expect(starBodyScale(3)).toBe(1.33);
  });

  it('takes a definition\'s cost from the injected lookup the host fills from the unit data', () => {
    useUnitCost(id => UNIT_DEFINITIONS[id]?.cost ?? 1);
    try {
      expect(UNIT_DEFINITIONS.jinx!.cost).toBe(5); expect(UNIT_DEFINITIONS.malzahar!.cost).toBe(5);
      expect(starBodyScaleOf('jinx', 3)).toBe(FIVE_COST_THREE_STAR_SCALE);
      expect(starBodyScaleOf('malzahar', 2)).toBe(1.18);
      const fourCost = Object.values(UNIT_DEFINITIONS).find(definition => definition.cost === 4)!;
      expect(starBodyScaleOf(fourCost.id, 3)).toBe(1.33);
      expect(starBodyScaleOf('not-a-unit', 3)).toBe(1.33);
    } finally { useUnitCost(() => 1); }
  });

  it('the recording page injects the game\'s own cost lookup before it mounts, so its five-cost three-stars draw 1.42x too', () => {
    expect(unitCostOf('jinx')).toBe(5); expect(unitCostOf('malzahar')).toBe(5); expect(unitCostOf('not-a-unit')).toBe(1);
    // Both hosts that mount the renderer hand it this same lookup: the game's loader and the castcmp recording page.
    const loader = readFileSync('src/rendering/three-mode/three-loader.ts', 'utf8'), harness = readFileSync('dev/castcmp/harness.ts', 'utf8');
    expect(loader).toContain("import { unitCostOf } from './unit-cost';");
    expect(loader).toMatch(/useUnitCost\?\.\(unitCostOf\)/);
    expect(harness).toContain("import { unitCostOf } from '../../src/rendering/three-mode/unit-cost';");
    const injected = harness.indexOf('mod.useUnitCost(unitCostOf)'), mounted = harness.indexOf('mod.mountRenderer3d(');
    expect(injected).toBeGreaterThan(-1); expect(mounted).toBeGreaterThan(injected);
    useUnitCost(unitCostOf);
    try {
      expect(starBodyScaleOf('jinx', 3) / starBodyScaleOf('jinx', 2)).toBeCloseTo(1.42, 9);
      expect(starBodyScaleOf('malzahar', 3) / starBodyScaleOf('malzahar', 2)).toBeCloseTo(1.42, 9);
    } finally { useUnitCost(() => 1); }
  });
});
