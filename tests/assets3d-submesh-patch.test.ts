import { describe, expect, it } from 'vitest';
// @ts-expect-error Pure Node build utility.
import { makeModel, validateModel } from '../scripts/assets3d/model.mjs';
// @ts-expect-error Pure Node build utility.
import { readGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Pure Node build utility.
import { encodePng } from '../scripts/assets3d/texture.mjs';
// @ts-expect-error Pure Node build utility.
import { fnv1a } from '../scripts/assets3d/bin.mjs';
// @ts-expect-error Pure Node build utility.
import { submeshVisibilityEvents, submeshPatchPlan, appendSubmeshes, patchModel } from '../scripts/assets3d/submesh-patch.mjs';
import { assertManifest } from '../src/rendering3d/contracts';

/** A two-submesh SKN (Body, Prop; one triangle each) on a one-joint rig, in the layout inspectSkn reads. */
function fixtures() {
  const submeshes = ['Body', 'Prop'], header = 12 + submeshes.length * 80, indexOffset = header + 20 + 40, vertices = 6;
  const mesh = Buffer.alloc(indexOffset + 6 * 2 + vertices * 52);
  mesh.writeUInt32LE(0x00112233); mesh.writeUInt16LE(4, 4); mesh.writeUInt32LE(submeshes.length, 8);
  submeshes.forEach((name, i) => {
    const at = 12 + i * 80; mesh.write(name, at);
    mesh.writeUInt32LE(i * 3, at + 64); mesh.writeUInt32LE(3, at + 68); mesh.writeUInt32LE(i * 3, at + 72); mesh.writeUInt32LE(3, at + 76);
  });
  mesh.writeUInt32LE(6, header + 4); mesh.writeUInt32LE(vertices, header + 8); mesh.writeUInt32LE(52, header + 12);
  [0, 1, 2, 3, 4, 5].forEach((n, i) => mesh.writeUInt16LE(n, indexOffset + i * 2));
  [[1, 3, 1], [3, 3, 1], [1, 5, 1], [5, 3, 1], [7, 3, 1], [5, 5, 1]].forEach((p, i) => {
    const o = indexOffset + 12 + i * 52;
    p.forEach((v, k) => mesh.writeFloatLE(v, o + k * 4));
    mesh.writeFloatLE(1, o + 16); mesh.writeFloatLE(1, o + 36);
  });
  const rig = Buffer.alloc(171);
  rig.writeUInt32LE(rig.length); rig.writeUInt32LE(0x22fd4fc3, 4); rig.writeUInt16LE(1, 14); rig.writeUInt32LE(1, 16);
  rig.writeInt32LE(64, 20); rig.writeInt32LE(164, 28); rig.writeInt16LE(-1, 68); rig.writeUInt32LE(123, 72);
  [1, 3, 1, 1, 1, 1, 0, 0, 0, 1, -1, -3, -1, 1, 1, 1, 0, 0, 0, 1].forEach((v, i) => rig.writeFloatLE(v, 80 + i * 4));
  rig.writeInt32LE(6, 160); rig.write('root\0', 166);
  const png = (r: number) => encodePng({ width: 1, height: 1, rgba: Buffer.from([r, 0, 0, 255]) });
  return { mesh, rig, body: png(255), prop: png(128) };
}

/** A two-frame clip on the rig's one joint (same layout as the model conversion tests' fixture). */
function anm() {
  const b = Buffer.alloc(134);
  b.write('r3d2anmd'); b.writeUInt32LE(5, 8); b.writeUInt32LE(1, 28); b.writeUInt32LE(2, 32); b.writeFloatLE(0.5, 36);
  b.writeUInt32LE(106, 40); b.writeUInt32LE(64, 52); b.writeUInt32LE(100, 56); b.writeUInt32LE(110, 60);
  [1, 1, 1, 1, 3, 1, 2, 4, 1].forEach((v, i) => b.writeFloatLE(v, 76 + i * 4));
  b.writeUIntLE(3 * 2 ** 45 + 16383 * 2 ** 30 + 16383 * 2 ** 15 + 16383, 112, 6);
  b.writeUInt32LE(123, 118); b.writeUInt16LE(1, 122); b.writeUInt16LE(2, 128);
  return b;
}

/** One clip in the parsed-BIN shape animationClips reads, with SubmeshVisibilityEventData events. */
const clip = (anm: string, events: { frame?: number; show?: string[]; hide?: string[] }[]) => [0, {
  type: fnv1a('AtomicClipData'), fields: [
    { hash: fnv1a('mAnimationResourceData'), value: { fields: [{ hash: fnv1a('mAnimationFilePath'), value: `ASSETS/Characters/X/Skins/Base/Animations/${anm}.TFT_Set13.anm` }] } },
    { hash: fnv1a('mEventDataMap'), value: { entries: events.map((e, i) => [i, { type: fnv1a('SubmeshVisibilityEventData'), fields: [
      ...(e.frame === undefined ? [] : [{ hash: fnv1a('mStartFrame'), value: e.frame }]),
      ...(e.show ? [{ hash: fnv1a('mShowSubmeshList'), value: e.show.map(fnv1a) }] : []),
      ...(e.hide ? [{ hash: fnv1a('mHideSubmeshList'), value: e.hide.map(fnv1a) }] : []),
    ] }]) } },
  ] }];
const graph = (...clips: ReturnType<typeof clip>[]) => [{ fields: [{ hash: fnv1a('mClipDataMap'), value: { entries: clips } }] }];

describe('submesh patch', () => {
  it('reads each clip\'s show and hide events by submesh name, frame-sorted, without repeats or guessed names', () => {
    const { events, unresolved } = submeshVisibilityEvents(graph(
      clip('X_SpellProp', [{ frame: 8, hide: ['Prop'] }, { show: ['prop'] }, { show: ['prop'] }]),
      clip('X_Idle', [{ show: ['Wings'] }]),
    ), ['Body', 'Prop']);
    expect(events).toEqual({ x_spellprop: [{ frame: 0, show: ['Prop'], hide: [] }, { frame: 8, show: [], hide: ['Prop'] }] });
    expect(unresolved).toEqual({ x_idle: [fnv1a('Wings').toString(16).padStart(8, '0')] });
  });

  it('appends only hidden submeshes an exported clip shows, and says why each other one is left out', () => {
    const events = { x_spellprop: [{ frame: 0, show: ['Prop'], hide: [] }], x_attackprops: [{ frame: 0, show: ['Prop', 'Toy'], hide: [] }] };
    expect(submeshPatchPlan({ hidden: ['prop', 'Toy', 'Recall'], submeshes: ['Body', 'Prop', 'Toy'], events, exportedClips: ['x_spellprop'] })).toEqual({
      append: [{ name: 'Prop', shownIn: ['x_spellprop'], alsoShownInMissing: ['x_attackprops'] }],
      skipped: [{ name: 'Toy', reason: 'shown-only-in-missing-clips', clips: ['x_attackprops'] }, { name: 'Recall', reason: 'not-in-mesh' }],
    });
    expect(submeshPatchPlan({ hidden: ['Prop'], submeshes: ['Body', 'Prop'], events: {}, exportedClips: [] }).skipped).toEqual([{ name: 'Prop', reason: 'never-shown' }]);
  });

  it('nothing to append returns the very same bytes', () => {
    const f = fixtures(), glb = makeModel(f.mesh, f.rig, [], { Body: f.body }, { hiddenSubmeshes: ['Prop'] }).glb;
    expect(appendSubmeshes(glb, f.mesh, [])).toBe(glb);
  });

  it('appends the hidden submesh on the model\'s own vertex buffers, leaving every prior byte where it was', () => {
    const f = fixtures();
    const before = makeModel(f.mesh, f.rig, [], { Body: f.body }, { hiddenSubmeshes: ['Prop'] }).glb;
    const after = appendSubmeshes(before, f.mesh, ['Prop'], { Prop: f.prop });
    expect(validateModel(after).passed).toBe(true);
    const a = readGlb(before), b = readGlb(after);
    expect(b.binary.subarray(0, a.binary.length).equals(a.binary)).toBe(true);
    expect(b.document.materials.map((m: { name: string }) => m.name)).toEqual(['Body', 'Prop']);
    const [body, prop] = b.document.meshes[0].primitives;
    expect(prop.attributes).toEqual(body.attributes);
    // The appended primitive draws the Prop triangle with makeModel's winding, as the model built with it shown does.
    const full = readGlb(makeModel(f.mesh, f.rig, [], { Body: f.body, Prop: f.prop }).glb);
    const indices = (g: typeof b, p: { indices: number }) => { const acc = g.document.accessors[p.indices], view = g.document.bufferViews[acc.bufferView];
      return [...new Uint16Array(g.binary.buffer.slice(g.binary.byteOffset + (view.byteOffset ?? 0), g.binary.byteOffset + (view.byteOffset ?? 0) + view.byteLength))]; };
    expect(indices(b, prop)).toEqual(indices(full, full.document.meshes[0].primitives[1]));
    expect(() => appendSubmeshes(after, f.mesh, ['Prop'], { Prop: f.prop })).toThrow('submesh-patch-already-present:Prop');
    expect(() => appendSubmeshes(before, f.mesh, ['Wings'], {})).toThrow('submesh-patch-missing-submesh:Wings');
    expect(() => appendSubmeshes(before, f.mesh, ['Prop'], {})).toThrow('missing-material-texture:Prop');
  });

  it('refuses a model whose vertex buffers do not hold every submesh', () => {
    const f = fixtures(), other = fixtures();
    other.mesh.writeUInt32LE(5, 12 + 2 * 80 + 8);
    const before = makeModel(f.mesh, f.rig, [], { Body: f.body }, { hiddenSubmeshes: ['Prop'] }).glb;
    expect(() => appendSubmeshes(before, other.mesh, ['Prop'], { Prop: f.prop })).toThrow();
  });
  it('the manifest contract takes the patch\'s submeshVisibility and refuses malformed ones', () => {
    const manifest = (submeshVisibility: unknown) => ({ schemaVersion: 1, models: { x: { path: 'models/x/model.glb', submeshVisibility } } });
    expect(() => assertManifest(manifest({ initiallyHidden: ['Prop'], events: { x_spellprop: [{ frame: 0, show: ['Prop'], hide: [] }] } }))).not.toThrow();
    expect(() => assertManifest(manifest({ events: { death: [{ frame: 0, show: [], hide: ['Weapon'] }] } }))).not.toThrow();
    for (const bad of [[], { initiallyHidden: [''] }, { events: { x: [] } }, { events: { x: [{ frame: -1, show: [], hide: [] }] } }, { events: { x: [{ frame: 0, show: [1], hide: [] }] } }])
      expect(() => assertManifest(manifest(bad))).toThrow('invalid-submesh-visibility');
  });
  // Parsed skin data (the shape skinBindings reads): a mesh whose Prop submesh starts hidden, with its own diffuse.
  const skinDocs = () => [{ linked: [], patches: [], entries: [{ hash: 1, type: fnv1a('SkinCharacterDataProperties'), fields: [
    { hash: fnv1a('skinMeshProperties'), value: { fields: [
      { hash: fnv1a('simpleSkin'), value: 'x.skn' }, { hash: fnv1a('skeleton'), value: 'x.skl' }, { hash: fnv1a('texture'), value: 'body.tex' },
      { hash: fnv1a('initialSubmeshToHide'), value: 'Prop' },
      { hash: fnv1a('materialOverride'), value: [{ fields: [{ hash: fnv1a('texture'), value: 'prop.tex' }, { hash: fnv1a('submesh'), value: 'Prop' }] }] },
    ] } },
    { hash: fnv1a('skinAnimationProperties'), value: { fields: [{ hash: fnv1a('animationGraphData'), value: { hash: 77 } }] } },
  ] }] }];
  const patched = async (appendGeometry: boolean) => {
    const f = fixtures(), before = makeModel(f.mesh, f.rig, [{ name: 'x_spellprop', bytes: anm() }], { Body: f.body }, { hiddenSubmeshes: ['Prop'] }).glb;
    const result = await patchModel({ before, entry: { path: 'models/x/model.glb' }, skn: f.mesh, docs: skinDocs(),
      graphEntries: graph(clip('X_SpellProp', [{ show: ['Prop'] }, { frame: 9, hide: ['Prop'] }])), appendGeometry,
      texture: async (path: string) => { expect(path).toBe('prop.tex'); return f.prop; } });
    return { before, ...result };
  };
  it('switch off (the default): the model stays byte for byte, the manifest gets the clip\'s events only', async () => {
    const { before, data, entry, report } = await patched(false);
    expect(data).toBe(before);
    expect(entry.submeshVisibility).toEqual({ events: { x_spellprop: [{ frame: 0, show: ['Prop'], hide: [] }, { frame: 9, show: [], hide: ['Prop'] }] } });
    expect(report).toMatchObject({ changed: false, appended: [], wouldAppend: [{ name: 'Prop', shownIn: ['x_spellprop'] }] });
    // Nothing the old renderer would draw all the time: the model has no Prop primitive or material.
    expect(readGlb(data).document.materials.map((m: { name: string }) => m.name)).toEqual(['Body']);
  });
  it('switch on: the shown hidden submesh is appended and listed as initially hidden', async () => {
    const { before, data, entry, report } = await patched(true);
    expect(data).not.toBe(before);
    expect(readGlb(data).document.materials.map((m: { name: string }) => m.name)).toEqual(['Body', 'Prop']);
    expect(entry.submeshVisibility.initiallyHidden).toEqual(['Prop']);
    expect(report).toMatchObject({ changed: true, appended: [{ name: 'Prop', shownIn: ['x_spellprop'] }] });
  });
});
