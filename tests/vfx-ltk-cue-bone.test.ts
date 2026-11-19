import { Group, Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { findCueBone, missingLocatorLift, unitAnchor } from '../src/rendering/three-mode/vfx-ltk/particles';
import { hitFlashSpot } from '../src/rendering/three-mode/unit-control';
import { FX_SCALE } from '../src/rendering/three-mode/vfx-ltk/particles';

// A cue's torso bone the target's skeleton lacks fell to the target's feet. A torso bone the skeleton lacks now takes the
// skeleton's own torso place, generically, never per champion.
const skeleton = (...names: [string, number][]) => {
  const body = new Group();
  for (const [name, y] of names) { const bone = new Object3D(); bone.name = name; bone.position.set(0, y, 0); body.add(bone); }
  body.updateMatrixWorld(true); return body;
};

describe('cue bones a skeleton lacks', () => {
  it('finds the named bone by name without case; a spine or chest bone it lacks takes its own chest, centre or spine, in that order', () => {
    const full = skeleton(['Spine', 30], ['C_BUFFBONE_GLB_CHEST_LOC', 50], ['C_Buffbone_Glb_Center_Loc', 40]);
    expect(findCueBone(full, 'spine')).toEqual({ node: full.children[0], standIn: false });
    const noSpine = skeleton(['C_BUFFBONE_GLB_CHEST_LOC', 50], ['C_Buffbone_Glb_Center_Loc', 40], ['Spine2', 35]);
    expect(findCueBone(noSpine, 'Spine')).toEqual({ node: noSpine.children[0], standIn: true });
    const centreOnly = skeleton(['Buffbone_Glb_Center_Loc', 40], ['Spine1', 30]);
    expect(findCueBone(centreOnly, 'Spine')!.node.name).toBe('Buffbone_Glb_Center_Loc');
    // A missing chest or centre locator is not stood in for: it keeps its height share (missingLocatorLift), as before.
    expect(findCueBone(skeleton(['Spine1', 30]), 'C_Buffbone_Glb_Chest_Loc')).toBeUndefined();
    expect(findCueBone(skeleton(['Spine1', 30]), 'C_Buffbone_Glb_Center_Loc')).toBeUndefined();
    // Not a torso bone: no stand-in (a weapon or the ground stays as before).
    expect(findCueBone(noSpine, 'Weapon')).toBeUndefined();
    expect(findCueBone(noSpine, 'BUFFBONE_GLB_GROUND_LOC')).toBeUndefined();
    expect(findCueBone(null, 'Spine')).toBeUndefined();
  });

  it('an anchor on a missing Spine sits on the stand-in; with no torso bone at all it lifts like a missing chest', () => {
    const root = new Group(), body = skeleton(['C_BUFFBONE_GLB_CHEST_LOC', 50]); root.add(body); root.updateMatrixWorld(true);
    expect(unitAnchor(root, body, 'Spine').originAt(0)[1]).toBeCloseTo(50 / FX_SCALE);
    expect(missingLocatorLift('Spine', 100)).toBe(60);
    expect(missingLocatorLift('Spine2', 100)).toBe(60);
    expect(missingLocatorLift('Weapon', 100)).toBe(0);
  });

  it("a hit flash goes on the chest locator; without one, over the unit's spot at the fallback height", () => {
    const out = new Vector3(), spot = new Vector3(10, 0, 20);
    const chest = skeleton(['Spine', 30], ['C_Buffbone_Glb_Chest_Loc', 55]);
    expect(hitFlashSpot(chest, spot, 33, out).toArray()).toEqual([0, 55, 0]);
    expect(hitFlashSpot(skeleton(['Spine2', 44]), spot, 33, out).toArray()).toEqual([10, 33, 20]);
    expect(hitFlashSpot(skeleton(['Weapon', 70]), spot, 33, out).toArray()).toEqual([10, 33, 20]);
    expect(hitFlashSpot(null, spot, 33, out).toArray()).toEqual([10, 33, 20]);
    // The lookup is kept per body.
    const cache = new WeakMap<object, Object3D | null>(), body = skeleton(['C_Buffbone_Glb_Chest_Loc', 55]);
    hitFlashSpot(body, spot, 33, out, cache);
    expect(cache.get(body)?.name).toBe('C_Buffbone_Glb_Chest_Loc');
  });
});
