import { describe, expect, it } from 'vitest';
import { AnimationClip, Camera, Group, NumberKeyframeTrack, Scene, Texture, type Mesh } from 'three';
import { UnitAnimationMixer } from '../src/rendering3d/animation-mixer';
import type { AttackRelease } from '../src/rendering3d/contracts';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, releaseDelay, type LtkPlayOptions, type VfxUnit } from '../src/rendering/three-mode/vfx-ltk/runtime';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { constant, num, syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';

/** releaseShift's own rule (#600), kept here to compare against: every cue moves by at − clip, held to ±2 s and ≥ 0. */
const shifted = (t: number, at: number, clip: number) => Math.max(0, t + Math.min(2, Math.max(-2, at - clip)));

describe('attack cue segment mapping (LtkPlayOptions.release)', () => {
  it('scales cues before the release frame and maps later ones by the tail speed', () => {
    // Synthetic swing: release frame at 0.8 s, retimed to land at 0.2 s, tail at 2×.
    expect(releaseDelay(0, 0.2, 0.8, 2)).toBe(0);
    expect(releaseDelay(0.4, 0.2, 0.8, 2)).toBeCloseTo(0.1);
    expect(releaseDelay(0.8, 0.2, 0.8, 2)).toBeCloseTo(0.2);
    expect(releaseDelay(1.0, 0.2, 0.8, 2)).toBeCloseTo(0.3);
    expect(releaseDelay(1.0, 0.2, 0.8, 1)).toBeCloseTo(0.4);
    // A slower swing moves cues later, still at most 2 s.
    expect(releaseDelay(0.4, 1.2, 0.8, 1)).toBeCloseTo(0.6);
    expect(releaseDelay(1, 9, 0.8, 1)).toBe(3);
    expect(releaseDelay(3, 0, 2.9, 1)).toBe(1);
  });

  it('keeps Malzahar item by item identical to releaseShift (no cue before release, tail at 1×)', () => {
    // Values as deployed with #600: attackRelease in the test server manifest, attack cues in tft13_malzahar's index.
    const release: AttackRelease = { clipSeconds: 0.8666666666666667, windupRatio: 0.1654, baseIntervalSeconds: 1.25 };
    const cues = [0.8666666666666667, 1.1666666666666667];
    const clip = new AnimationClip('tft13_malzahar_attack1', 1, [new NumberKeyframeTrack('.position[x]', [0, 1], [0, 1])]);
    const mixer = new UnitAnimationMixer(new Group(), [clip], { attack: clip.name }, { attackRelease: release });
    for (const t of cues) expect(t).toBeGreaterThanOrEqual(release.clipSeconds);
    for (let interval = 0.2; interval <= 3.0001; interval += 0.01) {
      const played = mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: interval })!.release!;
      expect(played.tailSpeed).toBe(1);
      for (const t of cues) expect(Object.is(releaseDelay(t, played.atSeconds, release.clipSeconds, played.tailSpeed), shifted(t, played.atSeconds, release.clipSeconds))).toBe(true);
    }
  });

  describe('through the runtime', () => {
    const longLived = () => syntheticSystem({ rate: constant(num(60)), lifetime: num(5), particleLifetime: constant(num(5)), particleLinger: num(5) });
    async function firstDrawnStep(cues: TimelineCue[], options?: LtkPlayOptions) {
      const library = createVfxLibrary('/root/', {
        readJson: async url => url.endsWith('index.json')
          ? { ...syntheticIndex(), version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'textures/sample.png' }, skills: { jinx: cues } }
          : longLived(),
        readTexture: async () => new Texture(),
      });
      await library.load('sample');
      const units = new Map<string, VfxUnit>([['caster', { root: new Group(), body: new Group(), alive: true }], ['target', { root: new Group(), body: new Group(), alive: true }]]);
      for (const unit of units.values()) unit.root.add(unit.body!);
      const scene = new Scene(), camera = new Camera(), runtime = createLtkRuntime(library, scene, id => units.get(id));
      expect(runtime.play('jinx', 'caster', ['target'], 0, 'attack', options)).toBe(true);
      let first = -1;
      for (let step = 0; step < 100 && first < 0; step++) {
        runtime.update(0.01, camera);
        const mesh = scene.children.find(child => child.name === 'ltk-vfx')?.children[0] as Mesh | undefined;
        if (mesh?.geometry.getAttribute('color')) first = step;
      }
      runtime.dispose(); library.dispose();
      return first;
    }
    const hit = (delay: number): TimelineCue => ({ system: 'sample', action: 'attack', event: 'hit', delay, duration: 1 });

    it('a post-release cue at 1× lands where releaseShift puts it', async () => {
      const viaShift = await firstDrawnStep([hit(0.9)], { releaseShift: 0.2 - 0.8 });
      expect(await firstDrawnStep([hit(0.9)], { release: { atSeconds: 0.2, clipSeconds: 0.8, tailSpeed: 1 } })).toBe(viaShift);
    });
    it('a pre-release cue is scaled with the sped-up head instead of being shifted to the start', async () => {
      const plain = await firstDrawnStep([hit(0.6)]);
      const mapped = await firstDrawnStep([hit(0.6)], { release: { atSeconds: 0.4, clipSeconds: 0.8, tailSpeed: 1 } });
      expect(plain).toBeGreaterThanOrEqual(58);
      expect(mapped).toBeGreaterThanOrEqual(28);
      expect(mapped).toBeLessThan(plain - 25);
      expect(await firstDrawnStep([hit(0.6)], { releaseShift: 0.4 - 0.8 })).toBeLessThan(mapped - 5);
    });
    it('rejects a non-number, negative or zero release', () => {
      const library = createVfxLibrary('/root/', { readJson: async () => ({ version: 1, systems: {}, assets: {}, skills: { jinx: [hit(0.5)] } }), readTexture: async () => new Texture() });
      const runtime = createLtkRuntime(library, new Scene(), () => undefined);
      for (const release of [{ atSeconds: Number.NaN, clipSeconds: 0.8, tailSpeed: 1 }, { atSeconds: 0.2, clipSeconds: 0, tailSpeed: 1 }, { atSeconds: 0.2, clipSeconds: 0.8, tailSpeed: 0 }, { atSeconds: -1, clipSeconds: 0.8, tailSpeed: 1 }])
        expect(runtime.play('jinx', 'caster', ['target'], 0, 'attack', { release })).toBe(false);
      runtime.dispose(); library.dispose();
    });
  });
});
