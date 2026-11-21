import { describe, expect, it } from 'vitest';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRTextureBasisu } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
// @ts-expect-error -- plain ESM build script without types
import { appendSubmeshes, meshSpaceTransform, updatePrecache } from '../scripts/assets3d/submesh-append.mjs';
import { createHash } from 'node:crypto';

// Synthetic models: one skeleton of two joints. The grafted model stores its mesh at a third of the base's size and folds the
// factor into its inverse bind matrices (what mesh quantisation does when the new submesh widens the bounds).
const BODY = [0, 0, 0, 1, 0, 0, 0, 1, 0], WING = [2, 1, 0, 3, 1, 0, 2, 2, 0];
const ibmBase = [[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 1]];
const scaled = (m: number[], s: number) => m.map((v, i) => (i < 12 && i % 4 !== 3 ? v * s : v));

async function model(options: { factor: number; withWing: boolean; ibms?: number[][]; targets?: boolean }) {
  const doc = new Document(), buffer = doc.createBuffer();
  doc.createExtension(KHRTextureBasisu).setRequired(true);
  const joints = [doc.createNode('root'), doc.createNode('arm')]; joints[0]!.addChild(joints[1]!);
  const ibms = options.ibms ?? ibmBase.map(m => scaled(m, options.factor));
  const skin = doc.createSkin().addJoint(joints[0]!).addJoint(joints[1]!)
    .setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(new Float32Array(ibms.flat())).setBuffer(buffer));
  const texture = (name: string) => doc.createTexture(name).setImage(new Uint8Array([0xab, 0x4b, 0x54, 0x58, 1, 2, 3, 4])).setMimeType('image/ktx2');
  const prim = (points: number[], name: string) => {
    const p = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(points.map(v => v / options.factor))).setBuffer(buffer))
      .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])).setBuffer(buffer))
      .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2])).setBuffer(buffer))
      .setMaterial(doc.createMaterial(name).setBaseColorTexture(texture(name)));
    if (options.targets && name === 'wings') p.addTarget(doc.createPrimitiveTarget().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(9)).setBuffer(buffer)));
    return p;
  };
  const mesh = doc.createMesh('body').addPrimitive(prim(BODY, 'body'));
  if (options.withWing) mesh.addPrimitive(prim(WING, 'wings'));
  doc.createScene().addChild(joints[0]!).addChild(doc.createNode('unit').setMesh(mesh).setSkin(skin));
  return new NodeIO().registerExtensions([KHRTextureBasisu]).writeBinary(doc);
}

const parse = (bytes: Uint8Array) => {
  const b = Buffer.from(bytes), jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
  return { json, bin: b.subarray(20 + jl + 8, 20 + jl + 8 + b.readUInt32LE(20 + jl)) };
};

describe('assets3d submesh append', () => {
  it('keeps every base JSON entry and binary byte, and runs the same twice', async () => {
    await MeshoptDecoder.ready;
    const base = await model({ factor: 1, withWing: false }), grafted = await model({ factor: 3, withWing: true });
    const out = appendSubmeshes(base, grafted), again = appendSubmeshes(base, grafted);
    expect(Buffer.from(out).equals(Buffer.from(again))).toBe(true);
    const A = parse(base), O = parse(out);
    expect(O.json.accessors.slice(0, A.json.accessors.length)).toEqual(A.json.accessors);
    expect(O.json.bufferViews.slice(0, A.json.bufferViews.length)).toEqual(A.json.bufferViews);
    expect(O.json.skins).toEqual(A.json.skins);
    expect(O.json.meshes[0].primitives[0]).toEqual(A.json.meshes[0].primitives[0]);
    expect(O.bin.subarray(0, A.bin.length).equals(A.bin)).toBe(true);
    expect(O.json.meshes[0].primitives).toHaveLength(2);
  });
  it("moves the appended positions into the base's mesh space through the two skins' inverse bind matrices", async () => {
    await MeshoptDecoder.ready;
    const out = appendSubmeshes(await model({ factor: 1, withWing: false }), await model({ factor: 3, withWing: true }));
    const doc = await new NodeIO().registerExtensions([KHRTextureBasisu]).readBinary(out);
    const wing = doc.getRoot().listMeshes()[0]!.listPrimitives()[1]!.getAttribute('POSITION')!;
    const got = Array.from({ length: wing.getCount() }, (_, i) => wing.getElement(i, [])).flat();
    got.forEach((v, i) => expect(v).toBeCloseTo(WING[i]!, 5));
  });
  it('refuses skins whose inverse bind matrices disagree on one transform, or a non-uniform or mirroring one', () => {
    const disagree = [scaled(ibmBase[0]!, 3), scaled(ibmBase[1]!, 2)];
    expect(() => meshSpaceTransform(ibmBase.flat(), disagree.flat())).toThrow('submesh-append-ibm-disagree');
    const stretched = ibmBase.map(m => m.map((v, i) => (i === 0 ? v * 2 : v)));
    expect(() => meshSpaceTransform(ibmBase.flat(), stretched.flat())).toThrow('submesh-append-not-uniform-scale');
    const mirrored = ibmBase.map(m => scaled(m, -1));
    expect(() => meshSpaceTransform(ibmBase.flat(), mirrored.flat())).toThrow('submesh-append-not-positive-scale');
  });
  it('refuses an appended primitive with morph targets', async () => {
    await MeshoptDecoder.ready;
    const base = await model({ factor: 1, withWing: false }), grafted = await model({ factor: 3, withWing: true, targets: true });
    expect(() => appendSubmeshes(base, grafted)).toThrow('submesh-append-unsupported-primitive');
  });
  it("sets precache.json's entry for the model to the output's bytes and sha256, keeping the file's layout", () => {
    const text = JSON.stringify({ schemaVersion: 1, files: [{ path: 'a.glb', bytes: 1, sha256: 'x' }, { path: 'm/model.glb', bytes: 2, sha256: 'y' }] }, null, 2) + '\n';
    const bytes = new Uint8Array([1, 2, 3]), out = updatePrecache(text, 'm/model.glb', bytes);
    expect(JSON.parse(out).files).toEqual([{ path: 'a.glb', bytes: 1, sha256: 'x' },
      { path: 'm/model.glb', bytes: 3, sha256: createHash('sha256').update(bytes).digest('hex') }]);
    expect(out.endsWith(']\n}\n')).toBe(true);
    expect(() => updatePrecache(text, 'missing.glb', bytes)).toThrow('submesh-append-precache-missing');
  });
});
