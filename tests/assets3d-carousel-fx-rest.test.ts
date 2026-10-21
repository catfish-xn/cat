import { describe, expect, it } from 'vitest';
import { parseParticleDocument } from '../src/rendering3d/particles';
// @ts-expect-error Offline Node converter.
import { convertParticleMesh } from '../scripts/assets3d/particle-mesh.mjs';
// @ts-expect-error Offline Node converter.
import { readGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Offline Node accessor reader.
import { readAccessor } from '../scripts/assets3d/model.mjs';
// @ts-expect-error Offline Node converter.
import { convertParticles } from '../scripts/assets3d/particles.mjs';

const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const floats = (...values: number[]) => {
  const b = Buffer.alloc(values.length * 4); values.forEach((n, i) => b.writeFloatLE(n, i * 4)); return b;
};
const scb = (colorFlag = 1) => {
  const header = Buffer.alloc(180); header.write('r3d2Mesh'); header.writeUInt16LE(3, 8); header.writeUInt16LE(2, 10);
  header.writeUInt32LE(3, 140); header.writeUInt32LE(1, 144); header.writeUInt32LE(2, 148); header.writeUInt32LE(colorFlag, 176);
  return Buffer.concat([header, floats(1, 0, 0, 0, 2, 0, 0, 0, 3),
    // Deliberately distinct BGRA channels and alpha, all generated here.
    Buffer.from([0, 0, 255, 255, 0, 255, 0, 0, 255, 0, 0, 128]),
    floats(4, 5, 6), u32(0), u32(1), u32(2), Buffer.alloc(64), floats(0, 1, 0, 0, 0, 1)]);
};
const sco = (metadata = 'PivotPoint=4 5 6\nVertexColors=1\n') => Buffer.from(
  `[ObjectBegin]\nName=generated\nCentralPoint=7 8 9\n${metadata}Verts=3\n1 0 0\n0 2 0\n0 0 3\n`
  + (metadata.includes('VertexColors=1') ? '255 0 0 255\n0 255 0 0\n0 0 255 128\n' : '')
  + 'Faces=1\n3 0 1 2 plain 0 0 1 0 0 1\n[ObjectEnd]\n');
const inspect = (bytes: Buffer, extension: string) => {
  const result = convertParticleMesh(bytes, extension), glb = readGlb(result.glb);
  const attrs = glb.document.meshes[0].primitives[0].attributes;
  const colorAccessor = glb.document.accessors[attrs.COLOR_0];
  // readAccessor returns raw integers; mirror GPU normalization for U8 colors.
  const colors = attrs.COLOR_0 === undefined ? undefined : readAccessor(glb, attrs.COLOR_0)
    .map((rgba: number[]) => rgba.map(n => colorAccessor.componentType === 5121 && colorAccessor.normalized ? Math.fround(n / 255) : n));
  return { result, glb, positions: readAccessor(glb, attrs.POSITION), colors };
};
const c = (constantValue: unknown) => ({ constantValue });
const emitter = (fields = {}) => ({ isSingleParticle: true, particleLifetime: c(2), ...fields });
const convert = (emitters: unknown[], system = {}, options = {}) => convertParticles({ generated: {
  __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: emitters, ...system,
} }, () => 'generated.png', parseParticleDocument, { particleMode: 'approximate', ...options });

describe('carousel remainder uses generic static mesh formats', () => {
  it.each(['.scb', '.sco'])('preserves reflected winding, RGBA seams and authored vertices in %s', ext => {
    const { result, glb, positions, colors } = inspect(ext === '.scb' ? scb() : sco(), ext);
    const colorAccessor = glb.document.accessors[glb.document.meshes[0].primitives[0].attributes.COLOR_0];
    expect(colorAccessor).toMatchObject({ componentType: 5121, normalized: true, type: 'VEC4', count: 3 });
    expect(positions).toEqual([[-1, 0, 0], [-0, 0, 3], [-0, 2, 0]]);
    expect(colors).toEqual([[1, 0, 0, 1], [0, 0, 1, Math.fround(128 / 255)], [0, 1, 0, 0]]);
    expect(result.report).toMatchObject({ vertexColors: true, locatorPolicy: 'metadata-only-preserve-authored-vertices' });
    expect(result.report.center).toEqual(ext === '.scb' ? [4, 5, 6] : [7, 8, 9]);
    expect(result.report.centralPoint).toEqual(result.report.center);
    if (ext === '.sco') {
      expect(result.report.pivot).toEqual([4, 5, 6]); expect(result.report.pivotPoint).toEqual([4, 5, 6]);
    }
  });
  it('reads SCO center-only and pivot-only variants without recentering', () => {
    for (const metadata of ['', 'PivotPoint=4 5 6\n', 'VertexColors=0\n', 'PivotPoint=4 5 6\nVertexColors=0\n']) {
      const { result, positions, colors } = inspect(sco(metadata), '.sco');
      expect(positions).toEqual([[-1, 0, 0], [-0, 0, 3], [-0, 2, 0]]); expect(colors).toBeUndefined();
      expect(result.report.pivot).toEqual(metadata.includes('PivotPoint') ? [4, 5, 6] : [7, 8, 9]);
    }
  });
  it('keeps malformed layouts and colors fail-closed with stable codes', () => {
    expect(() => convertParticleMesh(scb(2), '.scb')).toThrow('unsupported-scb-vertex-colors');
    for (const bytes of [scb().subarray(0, -1), Buffer.concat([scb(), u32(0)])])
      expect(() => convertParticleMesh(bytes, '.scb')).toThrow('invalid-scb-length');
    expect(() => convertParticleMesh(scb(), '.scb', { maxOutputBytes: 4100 })).toThrow('mesh-output-budget');
    for (const value of ['256', '-1', '1.5']) expect(() => convertParticleMesh(Buffer.from(sco().toString().replace('255 0 0 255', `${value} 0 0 255`)), '.sco'))
      .toThrow('invalid-sco-color');
    expect(() => convertParticleMesh(sco('PivotPoint=NaN 0 0\n'), '.sco')).toThrow('invalid-sco-number');
  });
});

describe('carousel remainder reports system semantics without resource exceptions', () => {
  it('omits a validated bound-object cap only in preview, without changing size or source', () => {
    const fields = emitter({ birthScale0: c([2, 2, 2]) });
    const original = structuredClone(fields);
    const result = convert([fields], { overrideScaleCap: 4 });
    expect(result.systems[0].document.emitters[0].size0).toEqual([2, 2, 2]);
    expect(result.systems[0].report[0].approximations).toContainEqual(expect.objectContaining({
      field: 'system.overrideScaleCap', handling: 'fixed-host-scale-omit-bound-object-scale-cap',
    }));
    expect(fields).toEqual(original);
    expect(convert([fields], { overrideScaleCap: 4 }, { particleMode: 'strict' }).systems[0].report[0].reason)
      .toBe('unmapped-system-field:overrideScaleCap');
    for (const cap of [-1, Infinity, '4', null]) expect(convert([fields], { overrideScaleCap: cap }).systems[0].report[0].reason)
      .toBe('invalid-approximate-system-scale-cap');
  });
  it('uses resource error codes and never calls a mesh lookup without a name', () => {
    const primitive = { __type: 'VfxPrimitiveMesh' };
    const lookup = (name: string) => { expect(typeof name).toBe('string'); return undefined; };
    const missing = convert([emitter({ primitive })], {}, { meshBounds: lookup, meshPath: lookup });
    expect(missing.systems[0].report[0]).toMatchObject({ status: 'skipped', reason: 'mesh-resource-unavailable' });
    const result = convert([emitter({ primitive: { ...primitive, mMesh: { mSimpleMeshName: 'generated.scb' } } })], {},
      { meshPath: lookup, meshReasons: new Map([['generated.scb', 'unsupported-scb-flags']]) });
    expect(result.systems[0].report[0]).toMatchObject({ status: 'skipped', reason: 'unsupported-scb-flags' });
  });
  it('retains unknown system fields, missing endpoints, secondary masks and subsystem chains as gaps', () => {
    expect(convert([emitter()], { '{12345678}': [] }).systems[0].report[0].reason).toBe('unmapped-system-field:{12345678}');
    for (const [fields, reason] of [
      [{ primitive: { __type: 'VfxPrimitiveBeam' } }, 'beam-endpoints-unavailable'],
      [{ childParticleSetDefinition: [] }, 'unexpressible-emitter:childParticleSetDefinition'],
      [{ texture: 'generated.tex', textureMult: {} }, 'unexpressible-emitter:opaque-base-requires-secondary-mask'],
    ] as const) {
      const result = convert([emitter(fields)], {}, { textureAlpha: () => false });
      expect(result.systems[0].document).toBeUndefined();
      expect(result.systems[0].report[0]).toMatchObject({ status: 'skipped', reason });
    }
  });
});
