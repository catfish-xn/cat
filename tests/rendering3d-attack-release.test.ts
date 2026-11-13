import { describe, expect, it } from 'vitest';
import { AnimationClip, Camera, Group, NumberKeyframeTrack, Scene, Texture, type Mesh } from 'three';
import { UnitAnimationMixer } from '../src/rendering3d/animation-mixer';
import { UnitActionState, type AnimationEvent } from '../src/rendering3d/animation-state';
import { assertManifest, attackReleaseSeconds, type AttackRelease } from '../src/rendering3d/contracts';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, type LtkPlayOptions, type VfxUnit } from '../src/rendering/three-mode/vfx-ltk/runtime';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { constant, num, syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';

// Synthetic values only (not any champion's data): a 1 s swing whose release frame sits at 0.8 s.
const RELEASE: AttackRelease = { clipSeconds: 0.8, windupRatio: 0.2, baseIntervalSeconds: 1.25 };

function fixture(release?: AttackRelease) {
  const root = new Group();
  const clips = [['rest', 2], ['swing', 1]].map(([name, duration], i) =>
    new AnimationClip(String(name), Number(duration), [new NumberKeyframeTrack('.position[x]', [0, Number(duration)], [i, i + 1])]));
  const mixer = new UnitAnimationMixer(root, clips, { idle: 'rest', attack: 'swing' }, release ? { attackRelease: release } : {});
  return { clips, mixer, swing: () => mixer.mixer.clipAction(clips[1]) };
}
const attack: AnimationEvent = { type: 'attack', tick: 1, attackerId: 'a', targetId: 'b' } as unknown as AnimationEvent;

describe('attack release timing (AttackRelease)', () => {
  it('without the manifest field plays exactly as before', () => {
    const f = fixture();
    expect(f.mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: 1 })).toEqual({ clips: ['swing'], durationSeconds: 0.9 });
    expect(f.mixer.resolvePlayback('attack', 0, {})).toEqual({ clips: ['swing'], durationSeconds: 1 });
  });

  it('lands the release frame at windupRatio of the interval, then plays the rest at 1x', () => {
    const f = fixture(RELEASE);
    const playback = f.mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: 1 })!;
    expect(playback.release!.atSeconds).toBeCloseTo(0.2);
    expect(playback.release!.headSpeed).toBeCloseTo(4);
    expect(playback.release!.tailSpeed).toBe(1);
    expect(playback.durationSeconds).toBeCloseTo(0.4);
    const state = new UnitActionState('a', { resolvePlayback: action => f.mixer.resolvePlayback(action, 0, { attackIntervalSeconds: 1 }) });
    f.mixer.apply(state.output); state.consume(attack); f.mixer.apply(state.output);
    f.mixer.update(0.1); expect(f.swing().time).toBeCloseTo(0.4);
    f.mixer.update(0.1); expect(f.swing().time).toBeCloseTo(0.8);
    f.mixer.update(0.1); expect(f.swing().time).toBeCloseTo(0.9);
    // One update across the release splits at it.
    const g = fixture(RELEASE), other = new UnitActionState('a', { resolvePlayback: action => g.mixer.resolvePlayback(action, 0, { attackIntervalSeconds: 1 }) });
    g.mixer.apply(other.output); other.consume(attack); g.mixer.apply(other.output);
    g.mixer.update(0.25); expect(g.swing().time).toBeCloseTo(0.85);
  });

  it('uses the base interval before a second attack is seen, and speeds the tail only when the next swing would cut it', () => {
    const f = fixture(RELEASE);
    expect(f.mixer.resolvePlayback('attack', 0, {})!.release!.atSeconds).toBeCloseTo(0.25);
    expect(attackReleaseSeconds(RELEASE, undefined)).toBeCloseTo(0.25);
    expect(attackReleaseSeconds(undefined, 1)).toBeUndefined();
    const fast = f.mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: 0.2 })!;
    // 0.2 s interval: release at 0.04 s, 0.14 s left before 90% of the interval for the 0.2 s tail.
    expect(fast.release!.tailSpeed).toBeCloseTo(0.2 / 0.14);
    expect(fast.durationSeconds).toBeCloseTo(0.18);
  });

  it('keeps the crossfade into a sped-up head within half of it', () => {
    const f = fixture(RELEASE), state = new UnitActionState('a', { resolvePlayback: action => f.mixer.resolvePlayback(action, 0, { attackIntervalSeconds: 0.5 }) });
    f.mixer.apply(state.output); state.consume(attack); f.mixer.apply(state.output);
    expect(state.output.blendSeconds).toBeGreaterThan(0.05);
    f.mixer.update(0.05); // release at 0.1 s: the 0.05 s crossfade is over
    expect(f.swing().getEffectiveWeight()).toBeCloseTo(1);
  });

  it('drops the two-speed timing when another action interrupts the swing', () => {
    const f = fixture(RELEASE), state = new UnitActionState('a', { resolvePlayback: action => f.mixer.resolvePlayback(action, 0, { attackIntervalSeconds: 1 }) });
    f.mixer.apply(state.output); state.consume(attack); f.mixer.apply(state.output);
    f.mixer.update(0.1);
    f.mixer.apply({ state: 'idle', previous: 'attack', blendSeconds: 0, loop: true, revision: 99 });
    const rest = f.mixer.mixer.clipAction(f.clips[0]);
    f.mixer.update(0.3);
    expect(rest.getEffectiveTimeScale()).toBe(1);
    expect(rest.time).toBeCloseTo(0.3);
  });

  it('ignores a release frame outside the clip', () => {
    const f = fixture({ ...RELEASE, clipSeconds: 1.5 });
    expect(f.mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: 1 })).toEqual({ clips: ['swing'], durationSeconds: 0.9 });
  });

  it('validates the manifest field', () => {
    const manifest = (attackRelease: unknown) => ({ schemaVersion: 1, models: { a: { path: 'a.glb', attackRelease } } });
    expect(() => assertManifest(manifest(RELEASE))).not.toThrow();
    for (const bad of [{ ...RELEASE, windupRatio: 0 }, { ...RELEASE, windupRatio: 1.2 }, { ...RELEASE, clipSeconds: -1 },
      { ...RELEASE, baseIntervalSeconds: Number.NaN }, { ...RELEASE, extra: 1 }, null, [1]])
      expect(() => assertManifest(manifest(bad))).toThrow('invalid-attack-release');
  });
});

describe('attack cues follow the release (releaseShift)', () => {
  const longLived = () => syntheticSystem({ rate: constant(num(60)), lifetime: num(5), particleLifetime: constant(num(5)), particleLinger: num(5) });
  async function firstDrawnStep(cues: TimelineCue[], options?: LtkPlayOptions | 'empowered') {
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
    expect(runtime.play('jinx', 'caster', ['target'], 'attack', options)).toBe(true);
    let first = -1;
    for (let step = 0; step < 100 && first < 0; step++) {
      runtime.update(0.01, camera);
      const mesh = scene.children.find(child => child.name === 'ltk-vfx')?.children[0] as Mesh | undefined;
      if (mesh?.geometry.getAttribute('color')) first = step;
    }
    runtime.dispose(); library.dispose();
    return first;
  }
  const hit: TimelineCue = { system: 'sample', action: 'attack', event: 'hit', delay: 0.5, duration: 1 };

  it('moves an attack cue earlier by the shift, and leaves it alone without one', async () => {
    const plain = await firstDrawnStep([hit]);
    const shifted = await firstDrawnStep([hit], { releaseShift: -0.3 });
    expect(plain).toBeGreaterThanOrEqual(48);
    expect(shifted).toBeGreaterThanOrEqual(18);
    expect(shifted).toBeLessThan(plain - 25);
  });

  it('never moves a cue before the swing starts, holds a large shift to 2 s and rejects a non-number', async () => {
    expect(await firstDrawnStep([hit], { releaseShift: -1 })).toBeLessThan(5);
    expect(await firstDrawnStep([{ ...hit, delay: 0 }], { releaseShift: 5 })).toBe(-1); // 2 s later: past the 1 s probe window
    const library = createVfxLibrary('/root/', { readJson: async () => ({ version: 1, systems: {}, assets: {}, skills: { jinx: [hit] } }), readTexture: async () => new Texture() });
    const runtime = createLtkRuntime(library, new Scene(), () => undefined);
    expect(runtime.play('jinx', 'caster', ['target'], 'attack', { releaseShift: Number.NaN })).toBe(false);
    runtime.dispose(); library.dispose();
  });

  it('keeps the variant choice with the options object', async () => {
    const empowered: TimelineCue = { ...hit, delay: 0.5, variant: 'empowered' };
    const plain = await firstDrawnStep([empowered], 'empowered' as never);
    expect(await firstDrawnStep([empowered], { variant: 'empowered', releaseShift: -0.3 })).toBeLessThan(plain - 25);
  });
});
