import { describe, expect, it, vi } from 'vitest';
import { AdditiveBlending, BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, PerspectiveCamera, Quaternion, ShaderMaterial, Texture, Vector3 } from 'three';
import { loadParticleEffect, parseParticleDocument, ParticleEffect, type ParticleDocumentV2,
  type ParticleEmitterV2 } from '../src/rendering3d';

// Entirely synthetic fixtures. No production source JSON or reference asset reads.
const quad = (changes: Record<string, unknown> = {}) => ({ kind: 'quad', emission: { mode: 'burst', count: 1 }, lifetime: 2, ...changes });
const doc = (...emitters: unknown[]) => ({ schemaVersion: 2, limits: { maxParticles: 20, maxDuration: 10 }, emitters });
const mesh = (e: ParticleEffect, i = 0) => e.object.children[i] as Mesh<import('three').BufferGeometry, ShaderMaterial>;
const manifest = { schemaVersion: 1 as const, models: {}, effects: { effect: { path: 'fx/effect.json' } } };

describe('strict particle v2 contract', () => {
  it('exports a discriminated document, clones inputs and accepts an explicitly bounded empty v2', () => {
    const input = doc(quad());
    const output = parseParticleDocument(input);
    expect(output).toEqual(input); expect(output).not.toBe(input);
    if (output.schemaVersion !== 2) throw new Error('v2 expected');
    const typed: ParticleDocumentV2 = output;
    const typedEmitter: ParticleEmitterV2 = typed.emitters[0];
    expect(typedEmitter.emission.mode).toBe('burst');
    expect(parseParticleDocument(doc())).toEqual(doc());
    expect(() => parseParticleDocument({ schemaVersion: 2, emitters: [] })).toThrow('$.limits');
  });
  it.each([
    quad({ position: [4, -5, 6], size0: 3, rotation0: -90 }),
    quad({ size0: [2, 3, 0], rotation0: [90, 180, 270] }),
    quad({ size0: { min: 1, max: 3 }, rotation0: { min: -180, max: 180 } }),
    quad({ size0: { min: [1, 2, 0], max: [4, 6, 2] }, rotation0: { min: [-20, 0, 4], max: [20, 0, 40] } }),
    quad({ emission: { mode: 'continuous', rate: 3.5, duration: 4, burst: 2 } }),
    quad({ emission: { mode: 'continuous', rate: 2, duration: 4, loop: false } }),
    quad({ emission: { mode: 'continuous', rate: 4, loop: true }, lifetime: 'infinite' }),
    quad({ kind: 'mesh', mesh: 'meshes/synthetic.glb', texture: 'textures/synthetic.png', blend: 'multiply' }),
    quad({ kind: 'ray', direction: [0, 1, 0], size0: [5, 70, 0] }),
    quad({ kind: 'arbitraryQuad', rotation0: [90, 0, 0] }),
    quad({ kind: 'trail', trail: { width: [{ time: 0, value: 8 }, { time: 1, value: 0 }], lifetime: 0.5, segments: 8, uvMode: 'stretch' } }),
    quad({ kind: 'trail', trail: { width: [{ time: 0, value: 2 }], lifetime: 1, segments: 2, uvMode: 'repeat', tileLength: 20 } }),
    quad({ kind: 'screenDistortion', distortion: { normalMap: 'normal.png', strength: 0.5 } }),
  ])('accepts v2 feature %#', e => { expect(parseParticleDocument(doc(e))).toEqual(doc(e)); });

  it.each([
    { limits: undefined }, { limits: {} }, { limits: { maxParticles: 0, maxDuration: 10 } },
    { limits: { maxParticles: 10001, maxDuration: 10 } }, { limits: { maxParticles: 1.5, maxDuration: 10 } },
    { limits: { maxParticles: 10, maxDuration: 0 } }, { limits: { maxParticles: 10, maxDuration: Infinity } },
    { limits: { maxParticles: 10, maxDuration: 3601 } }, { limits: { maxParticles: 10, maxDuration: 5, typo: 2 } },
    { emitters: [null] }, { emitters: new Array(1025).fill(quad()) }, { extra: true },
  ])('rejects invalid document/budgets %# before resource resolution', change => {
    const texture = vi.fn(), geometry = vi.fn();
    expect(() => new ParticleEffect({ ...doc(quad()), ...change }, { texture, mesh: geometry })).toThrow();
    expect(texture).not.toHaveBeenCalled(); expect(geometry).not.toHaveBeenCalled();
  });
  it.each([
    { count: 1 }, { birthScale0: 2 }, { position: [1, 2] }, { position: [1, NaN, 2] }, { position: null },
    { size0: -1 }, { size0: [1, -1, 0] }, { size0: [1, 2] }, { size0: Infinity },
    { size0: { min: 4, max: 2 } }, { size0: { min: 1, max: [2, 3, 4] } },
    { size0: { min: [1, 0, 0], max: [0, 1, 1] } }, { size0: { min: 1, max: 2, random: true } },
    { rotation0: [0, Infinity, 0] }, { rotation0: { min: 3, max: 2 } }, { rotation0: { min: 0 } },
    { lifetime: -1 }, { lifetime: 0 }, { lifetime: 3601 }, { lifetime: 'infinite' },
    { emission: { mode: 'burst', count: 1.1 } }, { emission: { mode: 'burst', count: 10001 } },
    { emission: { mode: 'burst', count: 1, rate: 3 } },
    { emission: { mode: 'continuous', rate: 0, duration: 2 } },
    { emission: { mode: 'continuous', rate: 10001, duration: 2 } },
    { emission: { mode: 'continuous', rate: 3 } },
    { emission: { mode: 'continuous', rate: 3, duration: 0 } },
    { emission: { mode: 'continuous', rate: 3, duration: 1, loop: true } },
    { emission: { mode: 'continuous', rate: 3, loop: 1 } },
    { emission: { mode: 'continuous', rate: 3, loop: true, burst: -1 } },
    { emission: { mode: 'continuous', rate: 3, duration: 1 }, lifetime: 'infinite' },
    { emission: { mode: 'continuous', rate: 3, loop: true, typo: 1 } },
    { kind: 'sprite' }, { kind: 'ray', direction: [0, 0, 0] }, { kind: 'ray' },
    { kind: 'arbitraryQuad', direction: [0, 1, 0] },
    { kind: 'mesh' }, { kind: 'mesh', mesh: '../mesh.glb' }, { kind: 'mesh', mesh: '/mesh.glb' },
    { kind: 'mesh', mesh: 'https://invalid/mesh.glb' }, { kind: 'mesh', mesh: 'mesh.sco' },
    { kind: 'mesh', mesh: 'mesh%2egl b.glb' }, { kind: 'mesh', mesh: 'mesh.glb?x=1' },
    { kind: 'mesh', mesh: 'folder\\mesh.glb' }, { kind: 'mesh', mesh: 'mesh.glb', material: {} },
    { kind: 'trail', trail: { width: [], lifetime: 1, segments: 2, uvMode: 'stretch' } },
    { kind: 'trail', trail: { lifetime: 1, segments: 2, uvMode: 'stretch' } },
    { kind: 'trail', trail: { width: [{ time: 0, value: -1 }], lifetime: 1, segments: 2, uvMode: 'stretch' } },
    { kind: 'trail', trail: { width: [{ time: 0, value: 1 }], lifetime: 0, segments: 2, uvMode: 'stretch' } },
    { kind: 'trail', trail: { width: [{ time: 0, value: 1 }], lifetime: 1, segments: 257, uvMode: 'stretch' } },
    { kind: 'trail', trail: { width: [{ time: 0, value: 1 }], lifetime: 1, segments: 1, uvMode: 'stretch' } },
    { kind: 'trail', trail: { width: [{ time: 0, value: 1 }], lifetime: 1, segments: 2, uvMode: 'repeat' } },
    { kind: 'trail', trail: { width: [{ time: 0, value: 1 }], lifetime: 1, segments: 2, uvMode: 'stretch', tileLength: 2 } },
    { kind: 'screenDistortion', distortion: { normalMap: '../n.png', strength: 1 } },
    { kind: 'screenDistortion', distortion: { normalMap: 'n.png', strength: 2 } },
    { kind: 'screenDistortion', distortion: { normalMap: 'n.png', strength: 1, pass: 1 } },
    { shape: { kind: 'point', extra: true } }, { frames: { columns: 1, rows: 1, fps: 3, extra: 0 } },
    { opacity: [{ time: 0, value: 1.1 }] }, { color: [{ time: 0, value: [0, 0, 2] }] },
    { size: [{ time: 0, value: [1, 2, 3] }] }, { dissolve: [{ time: 0, value: 0, random: true }] },
  ])('rejects unsupported/invalid feature %# with a location', change => {
    expect(() => parseParticleDocument(doc(quad(change)))).toThrow(/(?:invalid-|unsupported-).*:\$\.emitters\[0\]/);
  });
  it('validates known unsupported v2 kinds strictly while v1 keeps them opaque', () => {
    expect(() => parseParticleDocument(doc(quad({ kind: 'screenDistortion', extra: 1 })))).toThrow('unsupported-particle-field');
    expect(parseParticleDocument({ schemaVersion: 1, emitters: [{ kind: 'screenDistortion', extra: 1 }] })).toBeDefined();
    for (const field of ['position', 'size0', 'rotation0', 'emission']) {
      expect(() => parseParticleDocument({ schemaVersion: 1, emitters: [{ kind: 'sprite', count: 1, lifetime: 1, [field]: 1 }] })).toThrow('unsupported-particle-field');
    }
  });
});

describe('particle v2 interpreter', () => {
  it('finishes an empty burst immediately even with a delay', () => {
    const effect = new ParticleEffect(doc(quad({ delay: 3, emission: { mode: 'burst', count: 0 } })));
    expect(effect.finished).toBe(true); expect(effect.particleCount).toBe(0); effect.dispose();
  });
  it('advances continuous emissions at exact rate, with delay and one initial burst', () => {
    const effect = new ParticleEffect(doc(quad({ delay: 1, lifetime: 5, emission: { mode: 'continuous', rate: 4, duration: 1, burst: 2 } })));
    expect(effect.particleCount).toBe(0); expect(effect.finished).toBe(false);
    effect.update(1); expect(effect.particleCount).toBe(2);
    effect.update(0.24); expect(effect.particleCount).toBe(2);
    effect.update(0.01); expect(effect.particleCount).toBe(3);
    effect.update(0.75); expect(effect.particleCount).toBe(6);
    effect.update(1); expect(effect.particleCount).toBe(6);
    effect.update(4); expect(effect.particleCount).toBe(0); expect(effect.finished).toBe(true); effect.dispose();
  });
  it('does not emit at time zero without initial burst and never accumulates dt rounding drift', () => {
    const input = doc(quad({ lifetime: 3, emission: { mode: 'continuous', rate: 8, duration: 2 } }));
    const a = new ParticleEffect(input), b = new ParticleEffect(input);
    expect(a.particleCount).toBe(0);
    a.update(2); for (let i = 0; i < 16; i++) b.update(0.125);
    expect(a.particleCount).toBe(16); expect(b.particleCount).toBe(16);
    expect(a.object.children.map(p => p.position.toArray())).toEqual(b.object.children.map(p => p.position.toArray()));
    a.dispose(); b.dispose();
    const decimal = new ParticleEffect(doc(quad({ emission: { mode: 'continuous', rate: 10, duration: 1 } })));
    for (let i = 0; i < 10; i++) decimal.update(0.1);
    expect(decimal.particleCount).toBe(10); decimal.dispose();
  });
  it('includes the last duration birth despite division rounding, across update sizes', () => {
    const input = { ...doc(quad({ lifetime: 10, emission: { mode: 'continuous', rate: 2.8, duration: 7.5 } })),
      limits: { maxParticles: 32, maxDuration: 10 } };
    for (const steps of [[7.5], new Array<number>(15).fill(0.5)]) {
      const effect = new ParticleEffect(input);
      try {
        for (const dt of steps) effect.update(dt);
        expect(effect.particleCount).toBe(21); expect(effect.droppedParticles).toBe(0);
        effect.update(0.1); expect(effect.particleCount).toBe(21);
      } finally { effect.dispose(); }
    }
  });
  it('reclaims a rounded lifetime boundary before checking capacity for the next birth', () => {
    const effect = new ParticleEffect({ ...doc(quad({ lifetime: 0.2,
      emission: { mode: 'continuous', rate: 10, loop: true } })), limits: { maxParticles: 2, maxDuration: 10 } });
    try {
      for (let i = 0; i < 3; i++) effect.update(0.1);
      expect(effect.particleCount).toBe(2); expect(effect.droppedParticles).toBe(0);
    } finally { effect.dispose(); }
  });
  it.each([
    { rate: 2.8, duration: 0.3571428571428571, expected: 1 }, // First birth is one rounding step past duration.
    { rate: 10000, duration: 0.0001 * (1 - 32 * Number.EPSILON), expected: 0 }, // Outside relative tolerance even at small times.
  ])('checks the first duration boundary relative to its time scale: $rate', ({ rate, duration, expected }) => {
    const effect = new ParticleEffect(doc(quad({ emission: { mode: 'continuous', rate, duration } })));
    try {
      expect(effect.particleCount).toBe(0);
      effect.update(1 / rate);
      expect(effect.particleCount).toBe(expected); expect(effect.droppedParticles).toBe(0);
    } finally { effect.dispose(); }
  });
  it('expires before spawning at the same time, caps live counts and drops without backlog', () => {
    const input = { ...doc(quad({ lifetime: 0.5, emission: { mode: 'continuous', rate: 10, loop: true, burst: 3 } })), limits: { maxParticles: 2, maxDuration: 2 } };
    const effect = new ParticleEffect(input);
    expect(effect.particleCount).toBe(2); expect(effect.droppedParticles).toBe(1);
    for (let i = 0; i < 7; i++) { effect.update(0.25); expect(effect.particleCount).toBeLessThanOrEqual(2); }
    expect(effect.droppedParticles).toBeGreaterThan(1);
    effect.update(0.25); expect(effect.particleCount).toBe(0); expect(effect.finished).toBe(true);
    effect.update(2000); expect(effect.particleCount).toBe(0); effect.dispose();
  });
  it('bounds infinite lifetime, curves stay at birth and host limits only lower document limits', () => {
    const input = doc(quad({ lifetime: 'infinite', emission: { mode: 'continuous', rate: 10, loop: true, burst: 2 },
      size: [{ time: 0, value: 2 }, { time: 1, value: 0 }] }));
    const effect = new ParticleEffect(input, { maxParticles: 1, maxDuration: 1 });
    expect(effect.particleCount).toBe(1); effect.update(0.5); expect(mesh(effect).scale.x).toBe(2);
    effect.update(0.5); expect(effect.finished).toBe(true); expect(effect.object.children).toHaveLength(0); effect.dispose();
    for (const options of [{ maxDuration: Infinity }, { maxDuration: 0 }, { maxDuration: NaN }, { maxParticles: 1.5 }, { scale: -1 }]) {
      expect(() => new ParticleEffect(input, options)).toThrow('invalid-particle-options');
    }
  });
  it('bounds total attempted births even for a huge dt, without allocating dropped particles', () => {
    const effect = new ParticleEffect({ ...doc(quad({ lifetime: 'infinite', emission: { mode: 'continuous', rate: 10000, loop: true } })),
      limits: { maxParticles: 1, maxDuration: 100 } });
    effect.update(50);
    expect(effect.particleCount).toBe(1); expect(effect.droppedParticles).toBe(99999);
    expect(effect.skippedReasons).toContainEqual({ emitterIndex: 0, kind: 'quad', reason: 'total-birth-attempt-budget-exceeded' });
    effect.dispose();
  });
  it('applies League-unit position, nonuniform birth size, scalar rotation and shared curves', () => {
    const effect = new ParticleEffect(doc(quad({ position: [4, 5, 6], size0: [2, 3, 4], rotation0: 90,
      velocity: [2, 0, 0], gravity: [0, -2, 0], blend: 'additive', texture: 't.png',
      size: [{ time: 0, value: 1 }, { time: 1, value: 3 }], color: [{ time: 0, value: [1, 0, 0] }],
      opacity: [{ time: 0, value: 0.5 }], dissolve: [{ time: 0, value: 0.25 }], frames: { columns: 2, rows: 2, fps: 1 } })));
    effect.update(1);
    expect(mesh(effect).position.toArray()).toEqual([6, 4, 6]); expect(mesh(effect).scale.toArray()).toEqual([4, 6, 8]);
    expect(new Vector3(1, 0, 0).applyQuaternion(mesh(effect).quaternion).y).toBeCloseTo(1);
    expect(mesh(effect).material.blending).toBe(AdditiveBlending);
    expect(mesh(effect).material.uniforms.opacity.value).toBe(0.5); expect(mesh(effect).material.uniforms.dissolve.value).toBe(0.25);
    expect(mesh(effect).material.uniforms.frame.value).toBe(1); expect(effect.object.scale.x).toBe(0.6); effect.dispose();
  });
  it('draws scalar ranges once and vector ranges independently, with a local reproducible RNG', () => {
    const input = doc(quad({ size0: { min: [1, 2, 3], max: [3, 6, 9] }, rotation0: { min: 0, max: 180 } }));
    const random = vi.fn(() => 0.5), effect = new ParticleEffect(input, { random });
    expect(mesh(effect).scale.toArray()).toEqual([2, 4, 6]); expect(random).toHaveBeenCalledTimes(4);
    effect.update(0.5); expect(random).toHaveBeenCalledTimes(4); effect.dispose();
    const scalar = new ParticleEffect(doc(quad({ size0: { min: 1, max: 3 } })), { random: () => 0.25 });
    expect(mesh(scalar).scale.toArray()).toEqual([1.5, 1.5, 1.5]); scalar.dispose();
    const a = new ParticleEffect(input), b = new ParticleEffect(input);
    expect(mesh(a).scale.toArray()).toEqual(mesh(b).scale.toArray()); a.dispose(); b.dispose();
    expect(() => new ParticleEffect(input, { random: () => 1 })).toThrow('invalid-random');
  });
  it('samples v2 shape/drag analytically across update sizes', () => {
    const input = doc(quad({ shape: { kind: 'box', halfExtents: [1, 2, 3] }, position: [10, 0, 0], drag: 2,
      velocity: [2, 3, 0], gravity: [0, -2, 0] }), quad({ shape: { kind: 'sphere', radius: 2 } }));
    const a = new ParticleEffect(input), b = new ParticleEffect(input);
    expect(mesh(a).position.x).toBeGreaterThanOrEqual(9); expect(mesh(a, 1).position.length()).toBeLessThanOrEqual(2);
    a.update(1); for (let i = 0; i < 4; i++) b.update(0.25);
    expect(mesh(a).position.distanceTo(mesh(b).position)).toBeLessThan(1e-10); a.dispose(); b.dispose();
  });
  it('billboards quads below a rotated parent, preserves arbitraryQuad orientation and directs anchored rays', () => {
    const effect = new ParticleEffect(doc(quad(), quad({ kind: 'arbitraryQuad', rotation0: [90, 0, 0] }),
      quad({ kind: 'ray', direction: [1, 0, 0], size0: [2, 10, 0] })));
    const parent = new Group(), camera = new PerspectiveCamera();
    parent.rotation.set(0.2, 0.3, 0.4); parent.add(effect.object); camera.position.set(3, 4, 5); camera.lookAt(new Vector3());
    const arbitraryBefore = mesh(effect, 1).quaternion.clone();
    effect.update(0, camera);
    expect(mesh(effect).getWorldQuaternion(new Quaternion()).angleTo(camera.getWorldQuaternion(new Quaternion()))).toBeLessThan(1e-7);
    expect(mesh(effect, 1).quaternion.angleTo(arbitraryBefore)).toBeLessThan(1e-7);
    expect(new Vector3(0, 1, 0).applyQuaternion(mesh(effect, 2).quaternion).distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-7);
    mesh(effect, 2).geometry.computeBoundingBox(); expect(mesh(effect, 2).geometry.boundingBox!.min.y).toBe(0);
    effect.dispose();
  });
  it('renders mesh resources with emitter materials, borrows input geometry and releases own materials', () => {
    const geometry = new BoxGeometry(), texture = new Texture();
    const gd = vi.spyOn(geometry, 'dispose'), td = vi.spyOn(texture, 'dispose');
    const effect = new ParticleEffect(doc(quad({ kind: 'mesh', mesh: 'synthetic.glb', texture: 't.png', size0: [1, 2, 3] })),
      { mesh: () => geometry, texture: () => texture });
    expect(mesh(effect).geometry).toBe(geometry); expect(mesh(effect).material.uniforms.map.value).toBe(texture);
    const md = vi.spyOn(mesh(effect).material, 'dispose');
    effect.dispose(); effect.dispose(); expect(md).toHaveBeenCalledTimes(1);
    expect(gd).not.toHaveBeenCalled(); expect(td).not.toHaveBeenCalled(); geometry.dispose(); texture.dispose();
  });
  it.each(['stretch', 'repeat'])('builds bounded camera-facing trail ribbons and %s UVs following attachment motion', uvMode => {
    const effect = new ParticleEffect(doc(quad({ kind: 'trail', lifetime: 0.5, size0: 2,
      trail: { width: [{ time: 0, value: 2 }, { time: 1, value: 0 }], lifetime: 1, segments: 3, uvMode,
        ...(uvMode === 'repeat' ? { tileLength: 2 } : {}) } })), { scale: 1 });
    const parent = new Group(); parent.add(effect.object);
    const particle = mesh(effect), gd = vi.spyOn(particle.geometry, 'dispose'), md = vi.spyOn(particle.material, 'dispose');
    for (let i = 1; i <= 4; i++) { parent.position.x = i; effect.update(0.125); }
    expect(particle.geometry.getAttribute('position').count).toBe(8);
    expect(particle.geometry.drawRange.count).toBe(18);
    expect(particle.geometry.getAttribute('position').getX(0)).toBeCloseTo(-3);
    expect(particle.geometry.getAttribute('uv').getX(6)).toBeCloseTo(uvMode === 'stretch' ? 1 : 1.5);
    expect(particle.material.uniforms.repeatU.value).toBe(uvMode === 'repeat');
    expect(particle.material.fragmentShader).toContain('repeatU?fract(vUv.x):vUv.x');
    // Tail remains after head lifetime, then retires and frees both owned resources.
    effect.update(0.5); expect(effect.particleCount).toBe(1);
    effect.update(0.5); expect(effect.particleCount).toBe(0); expect(effect.finished).toBe(true);
    expect(gd).toHaveBeenCalledTimes(1); expect(md).toHaveBeenCalledTimes(1);
    effect.dispose(); expect(gd).toHaveBeenCalledTimes(1);
  });
  it('counts unsupported emitters with reasons and never requests their textures', () => {
    const texture = vi.fn(), effect = new ParticleEffect(doc(
      quad({ kind: 'mesh', mesh: 'missing.glb', texture: 'unused.png' }),
      quad({ kind: 'screenDistortion', distortion: { normalMap: 'unused.png', strength: 0.2 } })), { texture });
    expect(effect.skipped).toEqual({ mesh: 1, trail: 0, screenDistortion: 1 });
    expect(effect.skippedReasons).toEqual([
      { emitterIndex: 0, kind: 'mesh', reason: 'mesh-resource-unavailable' },
      { emitterIndex: 1, kind: 'screenDistortion', reason: 'screen-distortion-requires-scene-color' },
    ]);
    expect(effect.finished).toBe(true); expect(texture).not.toHaveBeenCalled(); effect.dispose();
  });
  it('starts trail history after the host positions and attaches the effect', () => {
    const effect = new ParticleEffect(doc(quad({ kind: 'trail',
      trail: { width: [{ time: 0, value: 1 }], lifetime: 1, segments: 2, uvMode: 'stretch' } })), { scale: 1 });
    const parent = new Group(); parent.position.x = 100; parent.add(effect.object);
    effect.update(0); expect(mesh(effect).geometry.drawRange.count).toBe(0);
    parent.position.x = 101; effect.update(0.1);
    expect(mesh(effect).geometry.drawRange.count).toBe(6);
    expect(mesh(effect).geometry.getAttribute('position').getX(0)).toBeCloseTo(-1); effect.dispose();
  });
  it('releases retired/replaced particles, all live materials and owned shared geometry exactly once', () => {
    const effect = new ParticleEffect(doc(quad({ lifetime: 0.5, emission: { mode: 'continuous', rate: 2, loop: true, burst: 1 } })));
    const first = mesh(effect), md = vi.spyOn(first.material, 'dispose'), gd = vi.spyOn(first.geometry, 'dispose');
    effect.update(0.5); expect(md).toHaveBeenCalledTimes(1); expect(gd).not.toHaveBeenCalled();
    const next = vi.spyOn(mesh(effect).material, 'dispose');
    const parent = new Group(); parent.add(effect.object);
    effect.dispose(); effect.dispose(); effect.update(1);
    expect(next).toHaveBeenCalledTimes(1); expect(gd).toHaveBeenCalledTimes(1); expect(parent.children).toHaveLength(0);
    expect(effect.particleCount).toBe(0); expect(effect.finished).toBe(true);
  });
  it('cleans live particles if a later runtime resolver or RNG throws', () => {
    const texture = vi.fn().mockReturnValueOnce(new Texture()).mockImplementationOnce(() => { throw new Error('resolver-failed'); });
    const effect = new ParticleEffect(doc(quad({ texture: 't.png', emission: { mode: 'continuous', rate: 1, loop: true, burst: 1 } })), { texture });
    const dispose = vi.spyOn(mesh(effect).material, 'dispose');
    expect(() => effect.update(1)).toThrow('resolver-failed'); expect(dispose).toHaveBeenCalledTimes(1);
    expect(effect.particleCount).toBe(0);
    expect(() => effect.update(1)).not.toThrow();
    const valid = new ParticleEffect(doc(quad()));
    expect(() => valid.update(NaN)).toThrow('invalid-delta'); expect(() => valid.update(-1)).toThrow('invalid-delta'); valid.dispose();
  });
});

describe('v2 lazy resource loading', () => {
  it('deduplicates root-relative meshes/textures and disposes loaded resources exactly once', async () => {
    const input = doc(quad({ kind: 'mesh', mesh: 'g/a.glb', texture: 't.png' }), quad({ kind: 'mesh', mesh: 'g/a.glb', texture: 't.png' }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(input));
    const geometry = new BoxGeometry(), texture = new Texture(), gd = vi.spyOn(geometry, 'dispose'), td = vi.spyOn(texture, 'dispose');
    const readMesh = vi.fn(async () => geometry), readTexture = vi.fn(async () => texture);
    try {
      const effect = await loadParticleEffect(manifest, 'effect', { root: '/local/', readMesh, readTexture });
      expect(fetchMock).toHaveBeenCalledWith('/local/fx/effect.json'); expect(readMesh).toHaveBeenCalledExactlyOnceWith('/local/g/a.glb');
      expect(readTexture).toHaveBeenCalledExactlyOnceWith('/local/t.png'); expect(effect.particleCount).toBe(2);
      effect.dispose(); effect.dispose(); expect(gd).toHaveBeenCalledTimes(1); expect(td).toHaveBeenCalledTimes(1);
    } finally { fetchMock.mockRestore(); }
  });
  it('skips unloaded meshes and distortion without initiating any dependent texture reads', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(doc(quad({ kind: 'mesh', mesh: 'a.glb', texture: 'unused.png' }),
      quad({ kind: 'screenDistortion', distortion: { normalMap: 'unused.png', strength: 1 } }))));
    const readTexture = vi.fn();
    try {
      const effect = await loadParticleEffect(manifest, 'effect', { readTexture });
      expect(effect.skipped.mesh).toBe(1); expect(effect.skipped.screenDistortion).toBe(1); expect(readTexture).not.toHaveBeenCalled(); effect.dispose();
    } finally { fetchMock.mockRestore(); }
  });
  it.each(['missing position', 'empty position', 'invalid result', 'rejection', 'throw', 'no reader'])
  ('skips an unavailable mesh (%s) before textures and shared particle allocation', async failure => {
    const geometry = new BufferGeometry();
    if (failure === 'empty position') geometry.setAttribute('position', new Float32BufferAttribute([], 3));
    const gd = vi.spyOn(geometry, 'dispose');
    const readMesh = vi.fn((): Promise<BufferGeometry> => {
      if (failure === 'throw') throw new Error('synthetic-mesh-failed');
      if (failure === 'rejection') return Promise.reject(new Error('synthetic-mesh-failed'));
      return Promise.resolve(failure === 'invalid result' ? new Group() as unknown as BufferGeometry : geometry);
    });
    const texture = new Texture(), td = vi.spyOn(texture, 'dispose');
    const readTexture = vi.fn(async (url: string) => {
      if (url.endsWith('/unused.png')) throw new Error('synthetic-texture-failed');
      return texture;
    });
    const effect = await loadParticleEffect(manifest, 'effect', {
      root: '/synthetic/', maxParticles: 1,
      readJson: async () => doc(quad({ kind: 'mesh', mesh: 'unavailable.glb', texture: 'unused.png' }),
        quad({ texture: 'visible.png', position: [7, 0, 0] })),
      readTexture, ...(failure === 'no reader' ? {} : { readMesh }),
    });
    try {
      expect(effect.skipped.mesh).toBe(1);
      const code = { 'missing position': 'missing-position', 'empty position': 'empty-geometry', 'invalid result': 'not-buffer-geometry',
        rejection: 'synthetic-mesh-failed', throw: 'synthetic-mesh-failed', 'no reader': 'no-mesh-reader' }[failure];
      expect(effect.skippedReasons).toContainEqual({ emitterIndex: 0, kind: 'mesh', reason: `mesh-resource-unavailable:${code}` });
      expect(effect.particleCount).toBe(1); expect(effect.droppedParticles).toBe(0);
      expect(mesh(effect).visible).toBe(true); expect(mesh(effect).position.x).toBe(7);
      expect(mesh(effect).geometry.getAttribute('position').count).toBeGreaterThan(0);
      expect(mesh(effect).material.uniforms.map.value).toBe(texture);
      expect(mesh(effect).material.uniforms.opacity.value).toBe(1);
      expect(readTexture).toHaveBeenCalledExactlyOnceWith('/synthetic/visible.png');
      effect.update(0.5); expect(effect.particleCount).toBe(1); expect(mesh(effect).visible).toBe(true);
    } finally { effect.dispose(); effect.dispose(); }
    expect(td).toHaveBeenCalledTimes(1);
    expect(gd).toHaveBeenCalledTimes(['missing position', 'empty position'].includes(failure) ? 1 : 0);
    if (!['missing position', 'empty position'].includes(failure)) geometry.dispose();
  });
  it('deduplicates failed mesh reads but counts every skipped emitter and preserves valid meshes', async () => {
    const geometry = new BoxGeometry(), gd = vi.spyOn(geometry, 'dispose');
    const readMesh = vi.fn(async (url: string) => {
      if (url.endsWith('/unavailable.glb')) throw new Error('synthetic-mesh-failed');
      return geometry;
    });
    const effect = await loadParticleEffect(manifest, 'effect', { maxParticles: 1, readMesh,
      readJson: async () => doc(quad({ kind: 'mesh', mesh: 'unavailable.glb' }),
        quad({ kind: 'mesh', mesh: 'unavailable.glb' }), quad({ kind: 'mesh', mesh: 'valid.glb' })),
    });
    try {
      expect(readMesh).toHaveBeenCalledTimes(2); expect(effect.skipped.mesh).toBe(2);
      expect(effect.particleCount).toBe(1); expect(effect.droppedParticles).toBe(0);
      expect(mesh(effect).geometry).toBe(geometry);
    } finally { effect.dispose(); }
    expect(gd).toHaveBeenCalledTimes(1);
  });
  it.each(['texture', 'constructor'])('cleans already loaded resources when %s fails', async failure => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(doc(
      quad({ kind: 'mesh', mesh: 'a.glb', texture: 'a.png', size0: { min: 1, max: 2 } }), quad({ kind: 'mesh', mesh: 'b.glb', texture: 'b.png' }))));
    const geometry = new BoxGeometry(), texture = new Texture(), gd = vi.spyOn(geometry, 'dispose'), td = vi.spyOn(texture, 'dispose');
    const readMesh = vi.fn().mockResolvedValueOnce(geometry);
    readMesh.mockResolvedValueOnce(geometry);
    const readTexture = vi.fn().mockResolvedValueOnce(texture);
    if (failure === 'texture') readTexture.mockRejectedValueOnce(new Error('failed')); else readTexture.mockResolvedValueOnce(texture);
    try {
      await expect(loadParticleEffect(manifest, 'effect', { readMesh, readTexture, ...(failure === 'constructor' ? { random: () => NaN } : {}) })).rejects.toThrow();
      expect(gd).toHaveBeenCalledTimes(1); expect(td).toHaveBeenCalledTimes(1);
    } finally { fetchMock.mockRestore(); }
  });
  it('rejects the whole v2 document before loading valid earlier resources', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(doc(quad({ kind: 'mesh', mesh: 'a.glb' }), quad({ typo: 1 }))));
    const readMesh = vi.fn(), readTexture = vi.fn();
    try {
      await expect(loadParticleEffect(manifest, 'effect', { readMesh, readTexture })).rejects.toThrow('unsupported-particle-field:$.emitters[1].typo');
      expect(readMesh).not.toHaveBeenCalled(); expect(readTexture).not.toHaveBeenCalled();
    } finally { fetchMock.mockRestore(); }
  });
});
