import { Camera, Group, type Mesh, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, unitAnchor, unitJoints } from '../src/rendering/three-mode/vfx-ltk/particles';
import { createLtkRuntime, type LtkPlayOptions, type VfxUnit } from '../src/rendering/three-mode/vfx-ltk/runtime';
import type { TimelineAction, TimelineCue, TimelineVariant } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { constant, num, syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';

const longLived = () => syntheticSystem({ rate: constant(num(60)), lifetime: num(5), particleLifetime: constant(num(5)), particleLinger: num(5) });

function drawnStrength(scene: Scene): number {
  const fxObject = scene.children.find(child => child.name === 'ltk-vfx');
  const drawMesh = fxObject?.children[0] as Mesh | undefined;
  const color = drawMesh?.geometry.getAttribute('color');
  return color ? color.getX(0) * color.getW(0) : 0;
}

async function runCue(
  cue: TimelineCue,
  steps: number,
  options?: TimelineVariant | LtkPlayOptions,
  action: TimelineAction = cue.action ?? 'cast',
) {
  const library = createVfxLibrary('/root/', {
    readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'textures/sample.png' }, skills: { jinx: [cue] } }
      : longLived(),
    readTexture: async () => new Texture(),
  });
  await library.load('sample');
  const units = new Map<string, VfxUnit>([
    ['caster', { root: new Group(), body: new Group(), alive: true }],
    ['target', { root: new Group(), body: new Group(), alive: true }],
  ]);
  units.get('caster')!.root.add(units.get('caster')!.body!);
  units.get('target')!.root.position.set(4, 0, 0);
  units.get('target')!.root.add(units.get('target')!.body!);
  units.get('target')!.root.updateMatrixWorld(true);
  const scene = new Scene(), camera = new Camera();
  const runtime = createLtkRuntime(library, scene, id => units.get(id));
  expect(runtime.play('jinx', 'caster', ['target'], action, options)).toBe(true);
  const alpha: number[] = [];
  for (let step = 0; step < steps; step++) {
    runtime.update(0.01, camera);
    alpha.push(drawnStrength(scene));
  }
  runtime.dispose(); library.dispose();
  return alpha;
}

describe('universal tail fallback fade-out for LTK cues', () => {
  it('fades a 1.0 s cast cue over its last 0.25 s without stopping emission', async () => {
    const cue: TimelineCue = { system: 'sample', action: 'cast', event: 'cast-start', delay: 0, duration: 1.0 };
    const alpha = await runCue(cue, 99);
    // 0.70 s (step 69) and 0.75 s (step 74) are at full strength (0.5 * 1.0 = 0.5).
    expect(alpha[69]).toBeCloseTo(0.5, 5);
    expect(alpha[74]).toBeCloseTo(0.5, 5);
    // Mid-tail (0.87 s / 0.88 s) has eased down, and the last frame before 1.0 s (0.99 s, step 98) is below 30% of 0.75 s.
    expect(alpha[87]).toBeLessThan(alpha[74]);
    expect(alpha[98]).toBeLessThan(alpha[74] * 0.3);
    expect(alpha[98]).toBeGreaterThan(0);
  });

  it('never starts the tail fade before a hand-set stop near the end (a deliberate cut)', async () => {
    const cue: TimelineCue = { system: 'sample', action: 'cast', event: 'cast-start', delay: 0, duration: 2.2, stopAfter: 2.1 };
    const alpha = await runCue(cue, 219);
    // A plain tail fade would start at 1.95 s; with the stop at 2.1 s the cue is still at full strength at 2.05 s.
    expect(alpha[204]).toBeCloseTo(0.5, 5);
    expect(alpha[218]).toBeLessThan(alpha[204] * 0.3);
  });

  it('uses duration / 4 (0.1 s) as the fade window for a short 0.4 s cue', async () => {
    const cue: TimelineCue = { system: 'sample', action: 'cast', event: 'cast-start', delay: 0, duration: 0.4 };
    const alpha = await runCue(cue, 39);
    // Fade starts at 0.4 - 0.1 = 0.30 s (step 29), not at 0.4 - 0.25 = 0.15 s.
    expect(alpha[19]).toBeCloseTo(0.5, 5);
    expect(alpha[29]).toBeCloseTo(0.5, 5);
    // Halfway through the 0.1 s window (0.35 s, step 34) is near half strength; last frame (0.39 s, step 38) is below 30%.
    expect(alpha[34] / alpha[29]).toBeCloseTo(0.5, 1);
    expect(alpha[38]).toBeLessThan(alpha[29] * 0.3);
  });

  it('leaves projectile cues and plain attack cues unfaded at the tail while fading empowered attacks', async () => {
    const library = createVfxLibrary('/root/', {
      readJson: async url => url.endsWith('index.json') ? syntheticIndex() : longLived(),
      readTexture: async () => new Texture(),
    });
    const system = await library.load('sample');
    const root = new Group(), body = new Group(); root.add(body);
    const unfadedFx = createLtkParticles(system, {
      anchor: unitAnchor(root, body), target: null, joints: unitJoints(root, body), duration: 1.0, seed: 1,
    });
    const camera = new Camera(), unfaded: number[] = [];
    for (let step = 0; step < 99; step++) {
      unfadedFx.update(0.01, camera);
      const color = unfadedFx.draws[0].object.geometry.getAttribute('color');
      unfaded.push(color.getX(0) * color.getW(0));
    }
    unfadedFx.dispose(); library.dispose();

    const projectile = await runCue(
      { system: 'sample', action: 'cast', event: 'projectile', delay: 0, duration: 1.0, travelSeconds: 0.5 },
      99,
    );
    const plainAttack = await runCue(
      { system: 'sample', action: 'attack', event: 'hit', delay: 0, duration: 1.0 },
      99,
      undefined,
      'attack',
    );
    const empoweredAttack = await runCue(
      { system: 'sample', action: 'attack', variant: 'empowered', event: 'hit', delay: 0, duration: 1.0 },
      99,
      'empowered',
      'attack',
    );

    expect(projectile[98]).toBeCloseTo(unfaded[98], 5);
    expect(plainAttack[98]).toBeCloseTo(unfaded[98], 5);
    expect(empoweredAttack[74]).toBeCloseTo(0.5, 5);
    expect(empoweredAttack[98]).toBeLessThan(empoweredAttack[74] * 0.3);
  });

  it('does not add a tail fallback fade to persistent cues unless they specify fadeOut', async () => {
    const persistentBoard = await runCue(
      { system: 'sample', action: 'cast', event: 'cast-start', location: 'board', delay: 0, duration: 1.0 },
      99,
      { board: [0, 0, 0], persistAcrossPhase: true },
    );
    expect(persistentBoard[69]).toBeCloseTo(0.5, 5);
    expect(persistentBoard[98]).toBeCloseTo(persistentBoard[69], 5);

    const persistentFadeOut = await runCue(
      { system: 'sample', action: 'cast', event: 'cast-start', location: 'board', delay: 0, duration: 1.0, stopAfter: 0.6, fadeOut: true },
      99,
      { board: [0, 0, 0], persistAcrossPhase: true },
    );
    expect(persistentFadeOut[59]).toBeCloseTo(0.5, 5);
    expect(persistentFadeOut[79] / persistentFadeOut[59]).toBeCloseTo(0.5, 1);
    expect(persistentFadeOut[98]).toBeLessThan(persistentFadeOut[59] * 0.1);
  });

  it('still fades fadeOut cues from stopAfter rather than the 0.25 s tail, and copies fadeFrom on reuse', async () => {
    const fadeOutCue: TimelineCue = { system: 'sample', action: 'cast', event: 'hit', delay: 0, duration: 1.4, stopAfter: 0.8, fadeOut: true };
    const alpha = await runCue(fadeOutCue, 139);
    expect(alpha[79]).toBeCloseTo(0.5, 5);
    // At 1.10 s (step 109), a tail-only fade (starting at 1.15 s) would still be 1.0, but fadeOut from 0.8 s is at 0.5.
    expect(alpha[109] / alpha[79]).toBeCloseTo(0.5, 1);
    expect(alpha[138]).toBeLessThan(alpha[79] * 0.01);

    // Verify reuse() updates fadeFrom when a parked system is replayed with a different cue.
    const library = createVfxLibrary('/root/', {
      readJson: async url => url.endsWith('index.json')
        ? {
          version: 1,
          systems: { sample: 'systems/sample.json' },
          assets: { 'synthetic.tex': 'textures/sample.png' },
          skills: {
            jinx: [
              { system: 'sample', action: 'attack', event: 'hit', delay: 0, duration: 0.4 },
              { system: 'sample', action: 'cast', event: 'hit', delay: 0, duration: 0.4 },
            ],
          },
        }
        : longLived(),
      readTexture: async () => new Texture(),
    });
    await library.load('sample');
    const unit: VfxUnit = { root: new Group(), body: new Group(), alive: true };
    unit.root.add(unit.body!);
    const scene = new Scene(), camera = new Camera();
    const runtime = createLtkRuntime(library, scene, () => unit);
    // First play: plain attack (fadeFrom = undefined), runs to completion and parks in spareFx.
    expect(runtime.play('jinx', 'caster', ['caster'], 'attack')).toBe(true);
    for (let step = 0; step < 40; step++) runtime.update(0.01, camera);
    expect(runtime.active).toBe(0);
    // Second play: cast (fadeFrom = 0.3), reuses the parked fx from spareFx.
    expect(runtime.play('jinx', 'caster', ['caster'], 'cast')).toBe(true);
    const reusedAlpha: number[] = [];
    for (let step = 0; step < 39; step++) {
      runtime.update(0.01, camera);
      reusedAlpha.push(drawnStrength(scene));
    }
    expect(reusedAlpha[29]).toBeCloseTo(0.5, 5);
    expect(reusedAlpha[38]).toBeLessThan(reusedAlpha[29] * 0.3);
    runtime.dispose(); library.dispose();
  });
});
