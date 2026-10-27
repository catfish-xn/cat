/** Explicit draw lifetimes replacing the upstream R3F scheduler; the board owns the renderer and clock. */
import { BufferGeometry, Mesh, ShaderMaterial, type Camera } from 'three';
export interface DrawFrameState { camera: Camera; gl: { info: { render: { frame: number } } } }
export interface ParticleDraw { object: Mesh; material: ShaderMaterial; update(state: DrawFrameState): void; dispose(): void }
export function makePair(material: ShaderMaterial) { return { solid: new Mesh(new BufferGeometry(), material) }; }
export function showPair(pair: ReturnType<typeof makePair>, visible: boolean) { pair.solid.visible = visible; }
export function drawLifetime() {
  const releases: (() => void)[] = [], frames: ((state: DrawFrameState) => void)[] = [];
  return {
    memo<T>(read: () => T, _deps?: readonly unknown[]): T { return read(); },
    cleanup(effect: () => (() => void), _deps?: readonly unknown[]) { releases.push(effect()); },
    eachFrame(frame: (state: DrawFrameState) => void) { frames.push(frame); },
    finish(pair: ReturnType<typeof makePair>, geometry: BufferGeometry, material: ShaderMaterial, rank: number): ParticleDraw {
      if (pair.solid.geometry !== geometry) pair.solid.geometry.dispose(); pair.solid.geometry = geometry;
      pair.solid.renderOrder = rank; pair.solid.frustumCulled = false;
      let closed = false;
      return { object: pair.solid, material,
        update(state) { if (!closed) for (const frame of frames) frame(state); },
        dispose() { if (closed) return; closed = true; pair.solid.removeFromParent(); for (const release of releases) release(); material.dispose(); },
      };
    },
  };
}
