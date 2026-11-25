import { Camera, Group, type Mesh, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { outlivesStop } from '../src/rendering/three-mode/vfx-ltk/particles';
import { createLtkRuntime, type VfxUnit } from '../src/rendering/three-mode/vfx-ltk/runtime';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { constant, num, syntheticSystem } from './vfx-ltk-synthetic';

// A cue that plays out past its end (TimelineCue.playOut) still fades, like a plain cue, the emitters whose particles go at
// the stop; the emitters whose particles outlive it keep full strength and finish their own lives (Garen's landing burst).
// Synthetic system (made-up numbers): two long-lived emitters, one with a particle linger and one without.
function twoEmitters() {
  const lingering = syntheticSystem({ emitterName: { type: 'string', value: 'outlives' }, rate: constant(num(60)), lifetime: num(5),
    particleLifetime: constant(num(5)), particleLinger: num(5) });
  const cut = syntheticSystem({ emitterName: { type: 'string', value: 'goes' }, rate: constant(num(60)), lifetime: num(5),
    particleLifetime: constant(num(5)) });
  type Root = { fields: { name: string; value: { items: unknown[] } }[] };
  const items = (system: typeof lingering) => (system.root as unknown as Root).fields.find(field => field.name === 'complexEmitterDefinitionData')!.value.items;
  items(lingering).push(...items(cut));
  return lingering;
}

async function strengths(cue: TimelineCue, steps: number) {
  const library = createVfxLibrary('/root/', {
    readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'textures/sample.png' }, skills: { garen: [cue] } }
      : twoEmitters(),
    readTexture: async () => new Texture(),
  });
  await library.load('sample');
  const caster: VfxUnit = { root: new Group(), body: new Group(), alive: true }; caster.root.add(caster.body!);
  const scene = new Scene(), camera = new Camera();
  const runtime = createLtkRuntime(library, scene, id => id === 'caster' ? caster : undefined);
  expect(runtime.play('garen', 'caster', [], 'cast')).toBe(true);
  const seen: Record<string, number>[] = [];
  for (let step = 0; step < steps; step++) {
    runtime.update(0.01, camera);
    const fx = scene.children.find(child => child.name === 'ltk-vfx');
    const row: Record<string, number> = {};
    for (const child of fx?.children ?? []) {
      const color = (child as Mesh).geometry?.getAttribute('color');
      row[child.name.split('#')[0]!] = color && (child as Mesh).geometry.drawRange.count !== 0 ? color.getX(0) * color.getW(0) : 0;
    }
    seen.push(row);
  }
  runtime.dispose(); library.dispose();
  return seen;
}

describe('a cue that plays out keeps the usual tail fade on emitters that go at the stop', () => {
  it('fades the emitter without a linger over the last 0.25 s as before; the lingering one stays at full strength', async () => {
    const seen = await strengths({ system: 'sample', action: 'cast', event: 'cast-start', delay: 0, duration: 1, playOut: 1 }, 99);
    // Both at full strength before the tail (0.70 s).
    expect(seen[69]!.goes).toBeCloseTo(seen[69]!.outlives!, 5);
    expect(seen[69]!.goes).toBeGreaterThan(0);
    // In the tail the emitter that goes at the stop eases down, nearly gone by the end; the lingering one does not.
    expect(seen[87]!.goes).toBeLessThan(seen[69]!.goes!);
    expect(seen[98]!.goes).toBeLessThan(seen[69]!.goes! * 0.3);
    expect(seen[98]!.outlives).toBeCloseTo(seen[69]!.outlives!, 5);
  });
  it('counts as outliving the stop an emitter with a linger, and one whose linger type leaves its particles alone', async () => {
    const emitterOf = async (fields: Parameters<typeof syntheticSystem>[0]) => {
      const library = createVfxLibrary('/root/', {
        readJson: async url => url.endsWith('index.json')
          ? { version: 1, systems: { sample: 'systems/sample.json' }, assets: { 'synthetic.tex': 'textures/sample.png' }, skills: {} }
          : syntheticSystem(fields),
        readTexture: async () => new Texture(),
      });
      const emitter = (await library.load('sample')).model.emitters[0]!;
      library.dispose();
      return emitter;
    };
    expect(outlivesStop(await emitterOf({}))).toBe(false);
    expect(outlivesStop(await emitterOf({ particleLinger: num(5) }))).toBe(true);
    // The engine's 'none' linger type keeps each particle's own lifetime through a stop (integrate.ts settle).
    expect(outlivesStop(await emitterOf({ particleLingerType: num(3) }))).toBe(true);
  });
});
