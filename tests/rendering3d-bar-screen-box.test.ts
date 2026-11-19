import { describe, expect, it } from 'vitest';
import { Group, OrthographicCamera, PerspectiveCamera, Sprite, Vector3 } from 'three';
import { spritesScreenBox } from '../src/rendering/three-mode/description-pick';

// Combat floats keep clear of overhead bars by their drawn boxes: a sprite turns to the camera, so its box on screen is its
// camera-facing quad, not its world plane.
const area = { left: 0, top: 0, width: 800, height: 600 };
describe('spritesScreenBox', () => {
  it('boxes a camera-facing sprite as it is drawn, under a tilted camera', () => {
    const camera = new OrthographicCamera(-400, 400, 300, -300, 0.1, 5000);
    camera.position.set(0, 600, 600); camera.lookAt(new Vector3(0, 0, 0)); camera.updateMatrixWorld();
    const group = new Group(), bar = new Sprite(); bar.scale.set(80, 20, 1); group.add(bar); group.updateMatrixWorld(true);
    const box = spritesScreenBox([bar], camera, area)!;
    // Orthographic and camera-facing: exactly its scale in pixels, centred on the projected position.
    expect(box.right - box.left).toBeCloseTo(80, 5); expect(box.bottom - box.top).toBeCloseTo(20, 5);
    expect((box.left + box.right) / 2).toBeCloseTo(400, 5); expect((box.top + box.bottom) / 2).toBeCloseTo(300, 5);
  });
  it('skips hidden sprites (or a hidden parent) and unites the visible ones', () => {
    const camera = new PerspectiveCamera(50, 800 / 600, 1, 5000); camera.position.set(0, 0, 500); camera.updateMatrixWorld();
    const parent = new Group(), a = new Sprite(), b = new Sprite(); a.position.x = -100; b.position.x = 100; parent.add(a, b); parent.updateMatrixWorld(true);
    expect(spritesScreenBox([a, b], camera, area)!.right).toBeGreaterThan(400);
    b.visible = false; expect(spritesScreenBox([a, b], camera, area)!.right).toBeLessThan(400);
    parent.visible = false; expect(spritesScreenBox([a, b], camera, area)).toBeUndefined();
  });
});
