import { describe, expect, it, vi } from 'vitest';
import { AdditiveBlending, Color, Group, Mesh, MultiplyBlending, NormalBlending, PerspectiveCamera, ShaderMaterial, Texture, Vector3 } from 'three';
import { loadParticleEffect, parseParticleDocument, ParticleEffect, sampleCurve } from '../src/rendering3d/particles';
import type { ParticleDocument, ParticleEmitter } from '../src/rendering3d/contracts';
const emitter = (changes: Partial<ParticleEmitter> = {}): ParticleEmitter => ({ kind: 'sprite', count: 1, lifetime: 2, ...changes });
const document = (...emitters: ParticleEmitter[]): ParticleDocument => ({ schemaVersion: 1, emitters });
const mesh = (effect: ParticleEffect, index = 0) => effect.object.children[index] as Mesh<import('three').PlaneGeometry, ShaderMaterial>;
describe('normalized 3D particle interpreter', () => {
  it('interpolates and clamps normalized curves', () => {
    const curve = [{ time: 0.25, value: 1 }, { time: 0.75, value: 3 }];
    expect(sampleCurve(curve, 0, 0)).toBe(1); expect(sampleCurve(curve, 0.5, 0)).toBe(2); expect(sampleCurve(curve, 1, 0)).toBe(3);
    expect(sampleCurve(undefined, 0, 7)).toBe(7);
  });
  it('honors delay, count, lifetime and default/configured spatial scale', () => {
    const effect = new ParticleEffect(document(emitter({ count: 2, delay: 1 })));
    expect(effect.object.scale.x).toBe(0.6); expect(effect.object.children).toHaveLength(2);
    expect(mesh(effect).visible).toBe(false); effect.update(1); expect(mesh(effect).visible).toBe(true);
    effect.update(2); expect(mesh(effect).visible).toBe(false); expect(effect.finished).toBe(true);
    effect.dispose();
    const custom = new ParticleEffect(document(emitter()), { scale: 2 }); expect(custom.object.scale.x).toBe(2); custom.dispose();
  });
  it('applies texture, linear RGB/opacity/size/dissolve curves and atlas frames', () => {
    const texture = new Texture(), textureDispose = vi.spyOn(texture, 'dispose');
    const effect = new ParticleEffect(document(emitter({ texture: 'p.png', frames: { columns: 2, rows: 2, fps: 3 },
      color: [{ time: 0, value: [1, 0, 0] }, { time: 1, value: [0, 0, 1] }], opacity: [{ time: 0, value: 1 }, { time: 1, value: 0 }],
      size: [{ time: 0, value: 2 }, { time: 1, value: 0 }], dissolve: [{ time: 0, value: 0 }, { time: 1, value: 1 }] })), { texture: () => texture });
    effect.update(1);
    const p = mesh(effect), uniforms = p.material.uniforms;
    expect(uniforms.map.value).toBe(texture); expect(uniforms.hasMap.value).toBe(true);
    expect(uniforms.tint.value).toEqual(new Color(0.5, 0, 0.5)); expect(uniforms.opacity.value).toBe(0.5);
    expect(p.scale.x).toBe(1); expect(uniforms.dissolve.value).toBe(0.5); expect(uniforms.frame.value).toBe(3);
    expect(uniforms.tiles.value).toEqual([2, 2]);
    expect(p.material.fragmentShader).toContain('discard'); expect(p.material.fragmentShader).toContain('texture2D');
    effect.dispose(); expect(textureDispose).not.toHaveBeenCalled(); texture.dispose();
  });
  it('loops atlas frames or clamps at the last frame', () => {
    const effect = new ParticleEffect(document(emitter({ lifetime: 10, frames: { columns: 2, rows: 2, fps: 2, loop: true } }),
      emitter({ lifetime: 10, frames: { columns: 2, rows: 2, fps: 2 } })));
    effect.update(3); expect(mesh(effect).material.uniforms.frame.value).toBe(2); expect(mesh(effect, 1).material.uniforms.frame.value).toBe(3); effect.dispose();
  });
  it('integrates velocity and gravity with zero drag', () => {
    const effect = new ParticleEffect(document(emitter({ velocity: [2, 0, 0], gravity: [0, -2, 0] })));
    effect.update(1); expect(mesh(effect).position.toArray()).toEqual([2, -1, 0]); effect.dispose();
  });
  it('integrates drag consistently across step sizes and starts age after delay', () => {
    const doc = document(emitter({ lifetime: 5, delay: 1, velocity: [2, 3, 0], gravity: [0, -2, 0], drag: 2 }));
    const a = new ParticleEffect(doc), b = new ParticleEffect(doc);
    a.update(2); for (let i = 0; i < 8; i++) b.update(0.25);
    expect(mesh(a).position.distanceTo(mesh(b).position)).toBeLessThan(1e-10);
    const factor = (1 - Math.exp(-2)) / 2;
    expect(mesh(a).position.x).toBeCloseTo(2 * factor); expect(mesh(a).position.y).toBeCloseTo(3 * factor - (1 - factor));
    a.dispose(); b.dispose();
  });
  it('samples bounded box/sphere shapes deterministically without global RNG', () => {
    const doc = document(emitter({ count: 10, shape: { kind: 'sphere', radius: 2 } }), emitter({ count: 10, shape: { kind: 'box', halfExtents: [1, 2, 3] } }));
    const a = new ParticleEffect(doc), b = new ParticleEffect(doc);
    expect(a.object.children.map(p => p.position.toArray())).toEqual(b.object.children.map(p => p.position.toArray()));
    for (let i = 0; i < 10; i++) expect(mesh(a, i).position.length()).toBeLessThanOrEqual(2);
    for (let i = 10; i < 20; i++) { const p = mesh(a, i).position; expect(Math.abs(p.x)).toBeLessThanOrEqual(1); expect(Math.abs(p.y)).toBeLessThanOrEqual(2); expect(Math.abs(p.z)).toBeLessThanOrEqual(3); }
    a.dispose(); b.dispose();
  });
  it('sets blend modes and counts unsupported emitters without allocating particles for them', () => {
    const effect = new ParticleEffect(document(emitter({ blend: 'normal' }), emitter({ blend: 'additive' }), emitter({ blend: 'multiply' }),
      emitter({ kind: 'mesh', count: 900000 }), emitter({ kind: 'trail' }), emitter({ kind: 'screenDistortion' })));
    expect(effect.skipped).toEqual({ mesh: 1, trail: 1, screenDistortion: 1 }); expect(effect.object.children).toHaveLength(3);
    expect(effect.object.children.map(p => (p as Mesh<never, ShaderMaterial>).material.blending)).toEqual([NormalBlending, AdditiveBlending, MultiplyBlending]); effect.dispose();
  });
  it('faces the camera even below a rotated effect parent', () => {
    const effect = new ParticleEffect(document(emitter())), parent = new Group(), camera = new PerspectiveCamera();
    parent.rotation.set(0.2, 0.3, 0.4); parent.add(effect.object); effect.object.rotation.y = 0.7;
    camera.position.set(3, 4, 5); camera.lookAt(new Vector3());
    effect.update(0, camera);
    const expected = camera.getWorldQuaternion(camera.quaternion.clone()), actual = mesh(effect).getWorldQuaternion(camera.quaternion.clone());
    expect(actual.angleTo(expected)).toBeLessThan(1e-7); effect.dispose();
  });
  it('disposes owned geometry/materials once, detaches, and tolerates repeated cleanup', () => {
    const effect = new ParticleEffect(document(emitter())), parent = new Group(); parent.add(effect.object);
    const geometryDispose = vi.spyOn(mesh(effect).geometry, 'dispose'), materialDispose = vi.spyOn(mesh(effect).material, 'dispose');
    effect.dispose(); effect.dispose(); effect.update(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1); expect(materialDispose).toHaveBeenCalledTimes(1); expect(parent.children).toHaveLength(0);
  });
  it('rejects malformed versions, parameters, curves and excessive allocation', () => {
    expect(() => parseParticleDocument({ schemaVersion: 2, emitters: [] })).toThrow();
    const invalid = [ { count: -1 }, { count: 0.5 }, { lifetime: 0 }, { delay: -1 }, { velocity: [NaN, 0, 0] }, { drag: -1 },
      { gravity: [0, 0] }, { size: [{ time: 0.8, value: 1 }, { time: 0.2, value: 2 }] }, { opacity: [{ time: 0, value: 2 }] },
      { color: [{ time: 0, value: [2, 0, 0] }] }, { frames: { columns: 0, rows: 1, fps: 1 } }, { shape: { kind: 'sphere', radius: -1 } },
      { texture: '../p.png' }, { blend: 'invalid' }, { kind: 'unknown' } ];
    for (const changes of invalid) expect(() => new ParticleEffect(document(emitter(changes as Partial<ParticleEmitter>)))).toThrow();
    expect(() => new ParticleEffect(document(emitter({ count: 5 })), { maxParticles: 4 })).toThrow('particle-budget-exceeded');
    expect(() => new ParticleEffect(document(emitter()), { scale: 0 })).toThrow();
    const effect = new ParticleEffect(document(emitter())); expect(() => effect.update(NaN)).toThrow(); effect.dispose();
  });
  it('loads manifest JSON/textures under the configured root, caches repeated texture paths and owns cleanup', async () => {
    const doc = document(emitter({ texture: 't.png' }), emitter({ texture: 't.png' }), emitter({ kind: 'mesh', texture: 'ignored.png' }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(doc)), texture = new Texture();
    const readTexture = vi.fn(async () => texture), dispose = vi.spyOn(texture, 'dispose');
    try {
      const effect = await loadParticleEffect({ schemaVersion: 1, models: {}, effects: { spell: { path: 'effects/spell.json' } } }, 'spell', { root: '/local/', readTexture });
      expect(fetchMock).toHaveBeenCalledWith('/local/effects/spell.json'); expect(readTexture).toHaveBeenCalledExactlyOnceWith('/local/t.png');
      effect.dispose(); effect.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
    } finally { fetchMock.mockRestore(); }
  });
  it('rejects unknown document fields instead of dropping semantics', () => {
    expect(() => parseParticleDocument({ ...document(emitter()), origin: [1, 2, 3] }))
      .toThrow('unsupported-particle-field:$.origin');
    expect(() => parseParticleDocument({ ...document(emitter()), metadata: {} }))
      .toThrow('unsupported-particle-field:$.metadata');
  });
  it.each([
    ['origin', [1, 2, 3]], ['emission', { mode: 'continuous', rate: 2 }],
    ['sizeVector', { birth: [2, 3, 4] }], ['birthScale0', [2, 3, 4]], ['scale0', []],
    ['single', true], ['birthProbability', [0.25, 0.75]], ['renderType', 'Ray'], ['typo', false], ['unknown', undefined],
  ])('rejects unsupported sprite field %s with its location', (key, value) => {
    expect(() => parseParticleDocument({ schemaVersion: 1, emitters: [{ ...emitter(), [key as string]: value }] }))
      .toThrow(`unsupported-particle-field:$.emitters[0].${key}`);
  });
  it.each([
    [{ shape: { kind: 'point', radius: 1 } }, 'shape.radius'],
    [{ shape: { kind: 'sphere', radius: 1, origin: [1, 2, 3] } }, 'shape.origin'],
    [{ shape: { kind: 'box', halfExtents: [1, 1, 1], jitter: 1 } }, 'shape.jitter'],
    [{ frames: { columns: 2, rows: 2, fps: 1, startFrame: 1 } }, 'frames.startFrame'],
    [{ size: [{ time: 0, value: 1, probability: [] }] }, 'size[0].probability'],
    [{ color: [{ time: 0, value: [1, 1, 1], interpolation: 'step' }] }, 'color[0].interpolation'],
    [{ opacity: [{ time: 0, value: 1, random: true }] }, 'opacity[0].random'],
    [{ dissolve: [{ time: 0, value: 0, seed: 1 }] }, 'dissolve[0].seed'],
  ])('rejects unhandled nested sprite data at %s', (changes, fieldPath) => {
    expect(() => parseParticleDocument({ schemaVersion: 1, emitters: [{ ...emitter(), ...changes }] }))
      .toThrow(`unsupported-particle-field:$.emitters[0].${fieldPath}`);
  });
  it.each([[2, 3], [2, 3, 4]])('rejects a vector size key value %s instead of flattening it', (...size) => {
    expect(() => parseParticleDocument({ schemaVersion: 1, emitters: [{ ...emitter(), size: [{ time: 0, value: size }] }] }))
      .toThrow('invalid-curve:$.emitters[0].size[0].value');
  });
  it.each([
    [null, 'invalid-particle-document:$'],
    [[], 'invalid-particle-document:$'],
    [{ schemaVersion: 1, emitters: {} }, 'invalid-particle-document:$'],
    [{ schemaVersion: 1, emitters: [[]] }, 'invalid-emitter-kind:$.emitters[0]'],
    [{ schemaVersion: 1, emitters: [{ ...emitter(), shape: null }] }, 'invalid-shape:$.emitters[0].shape'],
    [{ schemaVersion: 1, emitters: [{ ...emitter(), shape: false }] }, 'invalid-shape:$.emitters[0].shape'],
    [{ schemaVersion: 1, emitters: [{ ...emitter(), frames: null }] }, 'invalid-frames:$.emitters[0].frames'],
    [{ schemaVersion: 1, emitters: [{ ...emitter(), frames: [] }] }, 'invalid-frames:$.emitters[0].frames'],
    [{ schemaVersion: 1, emitters: [{ ...emitter(), frames: { columns: 1, rows: 1, fps: 1, loop: null } }] }, 'invalid-frames:$.emitters[0].frames.loop'],
  ])('rejects malformed document or nested record %# with a field path', (value, reason) => {
    expect(() => parseParticleDocument(value)).toThrow(reason as string);
  });
  it('rejects sentinel negative lifetime without inferring an infinite or replacement lifetime', () => {
    expect(() => parseParticleDocument(document(emitter({ lifetime: -1 }))))
      .toThrow('invalid-emitter-timing:$.emitters[0].lifetime');
  });
  it.each(['ArbitraryQuad', 'Ray'])('rejects unsupported kind %s rather than rendering a billboard', kind => {
    expect(() => parseParticleDocument({ schemaVersion: 1, emitters: [{ ...emitter(), kind }] }))
      .toThrow('invalid-emitter-kind:$.emitters[0].kind');
  });
  it('keeps the three known unsupported kinds opaque and counted, without resolving their textures', () => {
    const texture = vi.fn();
    const effect = new ParticleEffect({ schemaVersion: 1, emitters: ['mesh', 'trail', 'screenDistortion'].map(kind => ({
      kind, lifetime: -1, origin: [1, 2, 3], emission: { mode: 'continuous' }, texture: 'unused.png',
    })) }, { texture });
    expect(effect.skipped).toEqual({ mesh: 1, trail: 1, screenDistortion: 1 });
    expect(effect.object.children).toHaveLength(0); expect(texture).not.toHaveBeenCalled(); effect.dispose();
  });
  it('rejects the entire document before resolving any texture when a later sprite has unsupported data', async () => {
    const value = { schemaVersion: 1, emitters: [emitter({ texture: 'synthetic.png' }), { ...emitter(), origin: [1, 2, 3] }] };
    const readTexture = vi.fn(async () => new Texture()), directTexture = vi.fn();
    expect(() => new ParticleEffect(value, { texture: directTexture })).toThrow('unsupported-particle-field:$.emitters[1].origin');
    expect(directTexture).not.toHaveBeenCalled();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(value));
    try {
      await expect(loadParticleEffect({ schemaVersion: 1, models: {}, effects: { x: { path: 'x.json' } } }, 'x', { readTexture }))
        .rejects.toThrow('unsupported-particle-field:$.emitters[1].origin');
      expect(readTexture).not.toHaveBeenCalled();
    } finally { fetchMock.mockRestore(); }
  });
  it('cleans already loaded textures if a later texture load fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(document(emitter({ texture: 'a.png' }), emitter({ texture: 'b.png' })))), texture = new Texture();
    const dispose = vi.spyOn(texture, 'dispose'), readTexture = vi.fn().mockResolvedValueOnce(texture).mockRejectedValueOnce(new Error('texture-failed'));
    try {
      await expect(loadParticleEffect({ schemaVersion: 1, models: {}, effects: { x: { path: 'x.json' } } }, 'x', { readTexture })).rejects.toThrow('texture-failed');
      expect(dispose).toHaveBeenCalledTimes(1);
    } finally { fetchMock.mockRestore(); }
  });
});
