import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { nameHash } from '../src/rendering/three-mode/vfx-ltk/binHash';
import { constant, num, struct, syntheticSystem, vec } from './vfx-ltk-synthetic';
import { ribbonBuffers, strand, writeTrail, type TrailBuild } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/ribbon';
import { plainUvLayer } from '../src/rendering/three-mode/vfx-ltk/engine/model/model';
import { TRAIL_SMOOTHING } from '../src/rendering/three-mode/vfx-ltk/engine/model/enums';

// A straight strand along z, every point's width 5 and its side along x at `length` (the particle frame's scale).
function ribs(view: TrailBuild['view'], length: number): number[] {
  const held = strand(8), points = 4;
  (held as { count: number }).count = points;
  for (let at = 0; at < points; at += 1) {
    held.position.set([0, 0, at * 10], at * 3);
    held.width[at] = 5;
    held.side.set([length, 0, 0], at * 3);
    held.color.set([1, 1, 1, 1], at * 4);
    held.tiling.set([0, 0], at * 2);
  }
  const build: TrailBuild = { view, wake: false, smoothing: TRAIL_SMOOTHING.off, reach: 0, cutoff: 0,
    layers: { base: plainUvLayer(), mult: null } } as unknown as TrailBuild;
  const { arrays } = ribbonBuffers(points * 2) as unknown as { arrays: { position: Float32Array } };
  const cursor = { vertex: 0, index: 0 };
  writeTrail(held, build, arrays as never, cursor as never);
  const out: number[] = [];
  for (let rib = 0; rib < cursor.vertex / 2; rib += 1) {
    const a = arrays.position.subarray(rib * 6, rib * 6 + 3), b = arrays.position.subarray(rib * 6 + 3, rib * 6 + 6);
    out.push(Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!));
  }
  return out;
}

describe('vfx-ltk trail width (ribbon.ts writeTrail)', () => {
  it('an arbitrary trail is as wide as its own scale on both sides, whatever the system transform scales its frame by', () => {
    // A system transform that scales the particle's frame gives the side that length (made-up scales here).
    for (const length of [1, 1.5, 2, 0.3]) {
      const widths = ribs(null, length);
      expect(widths).toHaveLength(4);
      for (const width of widths) expect(width).toBeCloseTo(10, 6);
    }
  });

  it('a side of nothing still draws nothing', () => {
    for (const width of ribs(null, 0)) expect(width).toBe(0);
  });

  it('a camera-facing trail was never scaled by it either', () => {
    for (const width of ribs([0, 1, 0], 2)) expect(width).toBeCloseTo(10, 6);
  });
});

// Through the runtime: two systems alike but for a scaled system transform, each one arbitrary trail flown from caster
// to target. The strand must come out as wide in both (Gangplank's 80ab2d1b and 20cd67dc are such scaled systems live).
const built: any[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => { const fx = real.createLtkParticles(prepared, options); built.push(fx); return fx; } };
});

function trailSystem(scale: number) {
  const system = syntheticSystem({ primitive: struct('VfxPrimitiveArbitraryTrail', {}), birthVelocity: constant(vec(0, 0, 0)),
    birthScale0: constant(vec(10, 1, 1)), rate: constant(num(60)), lifetime: num(0.5), particleLifetime: constant(num(1)) });
  (system.root as { fields: unknown[] }).fields.push({ hash: nameHash('transform'), name: 'transform',
    value: { type: 'matrix', values: [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1] } });
  return system;
}

describe('vfx-ltk trail width through the runtime', () => {
  it('a scaled system transform leaves an arbitrary trail as wide as the same system unscaled', async () => {
    built.length = 0;
    const flight = (system: string): TimelineCue => ({ system, event: 'projectile', delay: 0, duration: 0.6, travelSeconds: 0.6 });
    const index = { version: 1, systems: { scaled: 'systems/scaled.json', plain: 'systems/plain.json' }, assets: { 'synthetic.tex': 'texture.png' },
      skills: { gangplank: [flight('scaled'), flight('plain')] } };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : trailSystem(url.includes('scaled') ? 1.5 : 1),
      readTexture: async () => new Texture() });
    const scene = new Scene(), units = new Map(['caster', 'target'].map((id, i) => {
      const root = new Group(); root.position.set(0, 0, i * 120); scene.add(root); root.updateMatrixWorld();
      return [id, { root, body: null, alive: true }];
    }));
    const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
    await runtime.warm('gangplank');
    expect(runtime.play('gangplank', 'caster', ['target'])).toBe(true);
    for (let t = 0; t < 0.4; t += 1 / 60) runtime.update(1 / 60, new Camera());
    const widths = (['scaled', 'plain'] as const).map(name => {
      const fx = built.find(entry => entry.object.userData.ltkSystem === name);
      const draw = fx.draws.find((d: any) => d.object.geometry?.index);
      const pos = draw.object.geometry.attributes.position;
      return Math.hypot(pos.getX(0) - pos.getX(1), pos.getY(0) - pos.getY(1), pos.getZ(0) - pos.getZ(1));
    });
    expect(widths[1]).toBeGreaterThan(0);
    expect(widths[0]).toBeCloseTo(widths[1]!, 6);
    runtime.dispose();
  });
});
