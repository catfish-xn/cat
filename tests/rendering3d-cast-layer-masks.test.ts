import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, Group, NumberKeyframeTrack } from 'three';
import { UnitAnimationMixer } from '../src/rendering3d/animation-mixer';
import { assertManifest, type CastSequence } from '../src/rendering3d/contracts';

// Two bones; every clip drives both, as the converted glb clips do (a full skeleton per clip).
function rig(castSequence: CastSequence) {
  const root = new Group(), body = new Bone(), water = new Bone();
  body.name = 'Body'; water.name = 'Water'; root.add(body, water);
  const clip = (name: string, values: Record<'Body' | 'Water', [number, number]>) => new AnimationClip(name, 1, [
    new NumberKeyframeTrack('Body.position[x]', [0, 1], values.Body),
    new NumberKeyframeTrack('Water.position[x]', [0, 1], values.Water),
  ]);
  const clips = [
    clip('rest', { Body: [0, 0], Water: [0, 0] }),
    clip('cast', { Body: [0, 10], Water: [0, 0] }),
    clip('water', { Body: [0, 0], Water: [0, 20] }),
  ];
  const mixer = new UnitAnimationMixer(root, clips, { idle: 'rest', cast: 'cast' }, { castSequence });
  const start = () => {
    const playback = mixer.resolvePlayback('cast')!;
    mixer.apply({ state: 'cast', previous: 'idle', revision: 1, loop: false, blendSeconds: 0, playback });
  };
  return { body, water, mixer, start };
}

describe('parallel cast layers with original bone masks', () => {
  it('without masks still averages every clip on every bone (the old behaviour the masks replace)', () => {
    const r = rig({ main: 'cast', layers: ['water'] });
    r.start(); r.mixer.update(0.5);
    expect(r.body.position.x).toBeCloseTo(2.5);
    expect(r.water.position.x).toBeCloseTo(5);
    r.mixer.dispose();
  });

  it('a fully masked layer drives only its bones and leaves the main clip whole elsewhere (Nami)', () => {
    const r = rig({ main: 'cast', layers: ['water'], masks: { water: { Water: 1 } } });
    r.start(); r.mixer.update(0.5);
    expect(r.body.position.x).toBeCloseTo(5);
    expect(r.water.position.x).toBeCloseTo(10);
    r.mixer.update(0.5);
    expect(r.body.position.x).toBeCloseTo(10);
    expect(r.water.position.x).toBeCloseTo(20);
    r.mixer.dispose();
  });

  it('a partly weighted mask on the main clip blends it over the unmasked layer by that weight (Heimerdinger)', () => {
    const r = rig({ main: 'cast', layers: ['water'], masks: { cast: { Body: 0.4 } } });
    r.start(); r.mixer.update(1);
    // Body: 0.4 of the way from the layer (0) to the main clip (10); Water: the unmasked layer alone.
    expect(r.body.position.x).toBeCloseTo(4);
    expect(r.water.position.x).toBeCloseTo(20);
    r.mixer.dispose();
  });

  it('holds the layer pose after a sequence that ends on its parallel stage, then fades it with the next action', () => {
    const r = rig({ main: 'cast', layers: ['water'], masks: { water: { Water: 1 } } });
    r.start(); r.mixer.update(1.2);
    expect(r.water.position.x).toBeCloseTo(20);
    r.mixer.apply({ state: 'idle', previous: 'cast', revision: 2, loop: true, blendSeconds: 0.2 });
    r.mixer.update(0.1);
    expect(r.water.position.x).toBeGreaterThan(0);
    expect(r.water.position.x).toBeLessThan(20);
    r.mixer.update(0.2);
    expect(r.water.position.x).toBeCloseTo(0);
    r.mixer.dispose();
  });

  it('validates masks', () => {
    const manifest = (masks: unknown) => ({ schemaVersion: 1, models: { alpha: { path: 'alpha.glb',
      castSequence: { main: 'cast', layers: ['water'], masks } } } });
    expect(() => assertManifest(manifest({ water: { Water: 1, Hair: 0.5 } }))).not.toThrow();
    for (const bad of [[], {}, { water: {} }, { water: { Water: 1.5 } }, { water: { Water: -0.1 } }, { water: { '': 1 } }, { water: 1 }]) {
      expect(() => assertManifest(manifest(bad))).toThrow('invalid-cast-masks');
    }
    expect(() => assertManifest({ schemaVersion: 1, models: { alpha: { path: 'alpha.glb',
      attackSequence: { main: 'cast', layers: ['water'], masks: { water: {} } } } } })).toThrow('invalid-cast-masks');
  });
});
