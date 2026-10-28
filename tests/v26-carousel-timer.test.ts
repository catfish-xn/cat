import { describe, expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, type Mesh } from 'three';
import { CAROUSEL_TIMER_EFFECT, createCarouselTimerRing } from '../src/rendering/three-mode/carousel-timer-ring';
import { createCarouselStage } from '../src/rendering/three-mode/carousel-stage';
import type { ParticleEffect } from '../src/rendering3d';
import type { BoardCarousel } from '../src/rendering/board-feed';

const camera = new PerspectiveCamera();
const effect = () => ({ object: new Group(), finished: false, update: vi.fn(), dispose: vi.fn() }) as unknown as ParticleEffect;
describe('v26 carousel release ring', () => {
  it('shrinks by authoritative time, clamps at full, and hides at release or with an unknown deadline', () => {
    const ring = createCarouselTimerRing(40, 0.44);
    const arc = ring.object.children[1] as Mesh;
    ring.update(12_000, 6_000, 0, camera);
    expect(ring.object.visible).toBe(true); expect(arc.geometry.drawRange.count).toBe(128 * 6);
    ring.update(3_000, 6_000, 99, camera);
    expect(ring.object.userData.fraction).toBe(0.5); expect(arc.geometry.drawRange.count).toBe(64 * 6);
    ring.update(3_000, 6_000, 99, camera); expect(ring.object.userData.fraction).toBe(0.5); // frame count is irrelevant
    ring.update(0, 6_000, 0, camera); expect(ring.object.visible).toBe(false);
    ring.update(Infinity, Infinity, 0, camera); expect(ring.object.visible).toBe(false);
    const dispose = vi.spyOn(arc.geometry, 'dispose'); ring.dispose(); ring.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('keeps the fallback arc when the optional asset fails and disposes a late asset after leaving', async () => {
    const refused = vi.fn(async () => { throw Error('missing'); });
    const fallback = createCarouselTimerRing(40, 0.44, refused);
    fallback.update(4_000, 6_000, 0, camera); await Promise.resolve(); await Promise.resolve();
    fallback.update(3_000, 6_000, 0, camera);
    expect(refused).toHaveBeenCalledTimes(1); expect(fallback.object.visible).toBe(true); fallback.dispose();
    let resolve!: (fx: ParticleEffect) => void;
    const late = createCarouselTimerRing(40, 0.44, () => new Promise(done => { resolve = done; }));
    late.update(5_000, 6_000, 0, camera); late.dispose(); const fx = effect(); resolve(fx); await Promise.resolve();
    expect(fx.dispose).toHaveBeenCalledTimes(1);
  });
  it('uses a manifest effect only during its last six seconds, while the stage follows server release batches', async () => {
    let now = 0;
    const fx = effect(), loadEffect = vi.fn(async (_id: string, _seconds: number) => fx);
    const stage = createCarouselStage({ championHeight: 92, championWidth: 110, sourceScale: 0.44,
      legendModel: 'default', loadModel: null, hasModel: () => false, loadEffect,
      hasEffect: id => id === CAROUSEL_TIMER_EFFECT, starColor: () => '#fff', now: () => now });
    const view: BoardCarousel = { id: 'first', slots: [], elapsedMs: 0, at: 0,
      seats: [{ seatId: 'a', me: true, releaseAtMs: 6_000 }, { seatId: 'b', me: false, releaseAtMs: 12_000 }] };
    stage.show(view); await Promise.resolve();
    expect(loadEffect.mock.calls.filter(call => call[0] === CAROUSEL_TIMER_EFFECT)).toHaveLength(1);
    now = 3_000; stage.update(0);
    const timers = stage.scene.children.filter(child => child.name === 'render3d-carousel-timer');
    expect(timers.map(timer => timer.userData.fraction)).toEqual([0.5, 1]);
    now = 6_000; stage.update(0); await Promise.resolve();
    expect(timers.map(timer => timer.visible)).toEqual([false, true]);
    expect(loadEffect.mock.calls.filter(call => call[0] === CAROUSEL_TIMER_EFFECT)).toHaveLength(2);
    now = 9_000; stage.update(0); expect(timers[1].userData.fraction).toBe(0.5);
    stage.show(null); expect(stage.scene.children.filter(child => child.name === 'render3d-carousel-timer')).toHaveLength(0);
    expect(fx.dispose).toHaveBeenCalled(); stage.dispose();
  });
});
