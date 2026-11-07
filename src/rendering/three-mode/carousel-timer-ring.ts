import { DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, type Camera } from 'three';
import type { ParticleEffect } from '../../rendering3d';

export const CAROUSEL_TIMER_EFFECT = 'carousel-shareddraft-releasetimerring-6s';
const SEGMENTS = 128;
/** Fallback ring radius when `radius` is the legacy 0.72-cell logical size (see carousel-stage seat timer). */
const FALLBACK_RADIUS_SCALE = 0.45 / 0.72;

/** Authoritative release countdown at a locked seat: optional 6s particle ring; thin procedural arc when that asset is absent or fails to load. */
export function createCarouselTimerRing(radius: number, sourceScale: number,
  loadEffect?: (id: string, seconds: number) => Promise<ParticleEffect>) {
  const object = new Group(); object.name = 'render3d-carousel-timer'; object.visible = false;
  let trackGeometry: RingGeometry | null = null;
  let arcGeometry: RingGeometry | null = null;
  let trackMaterial: MeshBasicMaterial | null = null;
  let arcMaterial: MeshBasicMaterial | null = null;
  const addFallback = () => {
    if (arcGeometry) return;
    const fallbackRadius = radius * FALLBACK_RADIUS_SCALE;
    trackGeometry = new RingGeometry(fallbackRadius * 0.89, fallbackRadius, SEGMENTS);
    arcGeometry = trackGeometry.clone();
    trackMaterial = new MeshBasicMaterial({ color: '#203847', side: DoubleSide, transparent: true, opacity: 0.85 });
    arcMaterial = new MeshBasicMaterial({ color: '#7fd8cf', side: DoubleSide, transparent: true, opacity: 0.95 });
    const track = new Mesh(trackGeometry, trackMaterial), arc = new Mesh(arcGeometry, arcMaterial);
    track.rotation.x = arc.rotation.x = -Math.PI / 2; arc.rotation.z = Math.PI / 2; arc.position.y = 0.2;
    object.add(track, arc);
  };
  if (!loadEffect) addFallback();
  let effect: ParticleEffect | null = null, pending = false, requested = false, disposed = false;
  return {
    object,
    /** `spanMs` is the interval between this release batch and its predecessor in the server view. */
    update(remainingMs: number, spanMs: number, seconds: number, camera: Camera) {
      if (disposed) return;
      object.visible = Number.isFinite(remainingMs) && remainingMs > 0 && spanMs > 0;
      const fraction = object.visible ? Math.min(1, remainingMs / spanMs) : 0;
      if (arcGeometry) arcGeometry.setDrawRange(0, Math.ceil(fraction * SEGMENTS) * 6);
      object.userData.remainingMs = remainingMs; object.userData.fraction = fraction;
      if (!object.visible) { effect?.dispose(); effect = null; requested = false; return; }
      if (loadEffect && remainingMs <= 6000 && !requested && !pending) {
        pending = requested = true;
        void loadEffect(CAROUSEL_TIMER_EFFECT, 6).then(fx => {
          pending = false;
          if (disposed || !object.visible) { fx.dispose(); return; }
          effect = fx; fx.object.scale.setScalar(sourceScale); object.add(fx.object);
        }).catch(() => { pending = false; if (!disposed) addFallback(); });
      }
      effect?.update(seconds, camera);
      if (effect?.finished) { effect.dispose(); effect = null; }
    },
    dispose() {
      if (disposed) return;
      disposed = true; effect?.dispose(); effect = null;
      object.removeFromParent(); object.clear();
      trackGeometry?.dispose(); arcGeometry?.dispose(); trackMaterial?.dispose(); arcMaterial?.dispose();
    },
  };
}
