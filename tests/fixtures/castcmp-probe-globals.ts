/* installProbes (dev/castcmp/probes.ts) patches Set.prototype.add/delete and three's Object3D.prototype.add and
 * Camera.prototype.updateMatrixWorld for the page it runs in. The fast project shares workers between files
 * (isolate: false), so a probe test must put them back: the patched updateMatrixWorld reads `document`, and a later
 * file in the same worker that updates a camera (tests/rendering3d-bar-screen-box.test.ts) then throws. */
import { Camera, Object3D } from 'three';
import { afterAll } from 'vitest';

export function restoreProbeGlobalsAfterAll(): void {
  const saved = { setAdd: Set.prototype.add, setDelete: Set.prototype.delete,
    objectAdd: Object3D.prototype.add, cameraUpdate: Camera.prototype.updateMatrixWorld };
  afterAll(async () => {
    // The three patches are applied once its dynamic import settles; let that happen before restoring.
    await import('three'); await new Promise(resolve => setTimeout(resolve, 0));
    Set.prototype.add = saved.setAdd; Set.prototype.delete = saved.setDelete;
    Object3D.prototype.add = saved.objectAdd; Camera.prototype.updateMatrixWorld = saved.cameraUpdate;
  });
}
