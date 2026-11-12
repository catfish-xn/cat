import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FAR, FAR_MARGIN, farToCover } from '../src/rendering/three-mode/camera-far';

describe('farToCover', () => {
  it('keeps the default far plane when nothing is drawn', () => {
    expect(farToCover(new Vector3(0, 700, 800), new Box3())).toBe(DEFAULT_FAR);
  });
  it('keeps the default for a box well inside it', () => {
    expect(farToCover(new Vector3(0, 700, 800), new Box3(new Vector3(-400, 0, -400), new Vector3(400, 50, 400)))).toBe(DEFAULT_FAR);
  });
  it('reaches the farthest corner of a skybox below the board, with the margin', () => {
    // Made-up numbers: a wide box well below the eye, as a skybox would be.
    const eye = new Vector3(100, 600, 800);
    const box = new Box3(new Vector3(-6000, -5000, -7000), new Vector3(7000, -50, 8000));
    const corner = Math.hypot(7000 - 100, -5000 - 600, -7000 - 800); // the farthest of the eight
    const far = farToCover(eye, box);
    expect(far).toBe(Math.ceil(corner * FAR_MARGIN));
    expect(far).toBeGreaterThan(corner);
    expect(far).toBeLessThan(corner * 1.21);
  });
});
