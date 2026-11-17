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
import { submeshVisibilityEvents, submeshPatchPlan, appendSubmeshes } from '../scripts/assets3d/submesh-patch.mjs';
import { assertManifest } from '../src/rendering3d/contracts';

/** A two-submesh SKN (Body, Chain; one triangle each) on a one-joint rig, in the layout inspectSkn reads. */
function fixtures() {
  const submeshes = ['Body', 'Chain'], header = 12 + submeshes.length * 80, indexOffset = header + 20 + 40, vertices = 6;
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
  return { mesh, rig, body: png(255), chain: png(128) };
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
      clip('X_SpellChain', [{ frame: 8, hide: ['Chain'] }, { show: ['chain'] }, { show: ['chain'] }]),
      clip('X_Idle', [{ show: ['Wings'] }]),
    ), ['Body', 'Chain']);
    expect(events).toEqual({ x_spellchain: [{ frame: 0, show: ['Chain'], hide: [] }, { frame: 8, show: [], hide: ['Chain'] }] });
    expect(unresolved).toEqual({ x_idle: [fnv1a('Wings').toString(16).padStart(8, '0')] });
  });

  it('appends only hidden submeshes an exported clip shows, and says why each other one is left out', () => {
    const events = { x_spellchain: [{ frame: 0, show: ['Chain'], hide: [] }], x_attackchains: [{ frame: 0, show: ['Chain', 'Toy'], hide: [] }] };
    expect(submeshPatchPlan({ hidden: ['chain', 'Toy', 'Recall'], submeshes: ['Body', 'Chain', 'Toy'], events, exportedClips: ['x_spellchain'] })).toEqual({
      append: [{ name: 'Chain', shownIn: ['x_spellchain'], alsoShownInMissing: ['x_attackchains'] }],
      skipped: [{ name: 'Toy', reason: 'shown-only-in-missing-clips', clips: ['x_attackchains'] }, { name: 'Recall', reason: 'not-in-mesh' }],
    });
    expect(submeshPatchPlan({ hidden: ['Chain'], submeshes: ['Body', 'Chain'], events: {}, exportedClips: [] }).skipped).toEqual([{ name: 'Chain', reason: 'never-shown' }]);
  });

  it('nothing to append returns the very same bytes', () => {
    const f = fixtures(), glb = makeModel(f.mesh, f.rig, [], { Body: f.body }, { hiddenSubmeshes: ['Chain'] }).glb;
    expect(appendSubmeshes(glb, f.mesh, [])).toBe(glb);
  });

  it('appends the hidden submesh on the model\'s own vertex buffers, leaving every prior byte where it was', () => {
    const f = fixtures();
    const before = makeModel(f.mesh, f.rig, [], { Body: f.body }, { hiddenSubmeshes: ['Chain'] }).glb;
    const after = appendSubmeshes(before, f.mesh, ['Chain'], { Chain: f.chain });
    expect(validateModel(after).passed).toBe(true);
    const a = readGlb(before), b = readGlb(after);
    expect(b.binary.subarray(0, a.binary.length).equals(a.binary)).toBe(true);
    expect(b.document.materials.map((m: { name: string }) => m.name)).toEqual(['Body', 'Chain']);
    const [body, chain] = b.document.meshes[0].primitives;
    expect(chain.attributes).toEqual(body.attributes);
    // The appended primitive draws the Chain triangle with makeModel's winding, as the model built with it shown does.
    const full = readGlb(makeModel(f.mesh, f.rig, [], { Body: f.body, Chain: f.chain }).glb);
    const indices = (g: typeof b, p: { indices: number }) => { const acc = g.document.accessors[p.indices], view = g.document.bufferViews[acc.bufferView];
      return [...new Uint16Array(g.binary.buffer.slice(g.binary.byteOffset + (view.byteOffset ?? 0), g.binary.byteOffset + (view.byteOffset ?? 0) + view.byteLength))]; };
    expect(indices(b, chain)).toEqual(indices(full, full.document.meshes[0].primitives[1]));
    expect(() => appendSubmeshes(after, f.mesh, ['Chain'], { Chain: f.chain })).toThrow('submesh-patch-already-present:Chain');
    expect(() => appendSubmeshes(before, f.mesh, ['Wings'], {})).toThrow('submesh-patch-missing-submesh:Wings');
    expect(() => appendSubmeshes(before, f.mesh, ['Chain'], {})).toThrow('missing-material-texture:Chain');
  });

  it('refuses a model whose vertex buffers do not hold every submesh', () => {
    const f = fixtures(), other = fixtures();
    other.mesh.writeUInt32LE(5, 12 + 2 * 80 + 8);
    const before = makeModel(f.mesh, f.rig, [], { Body: f.body }, { hiddenSubmeshes: ['Chain'] }).glb;
    expect(() => appendSubmeshes(before, other.mesh, ['Chain'], { Chain: f.chain })).toThrow();
  });
  it('the manifest contract takes the patch\'s submeshVisibility and refuses malformed ones', () => {
    const manifest = (submeshVisibility: unknown) => ({ schemaVersion: 1, models: { x: { path: 'models/x/model.glb', submeshVisibility } } });
    expect(() => assertManifest(manifest({ initiallyHidden: ['Chain'], events: { x_spellchain: [{ frame: 0, show: ['Chain'], hide: [] }] } }))).not.toThrow();
    expect(() => assertManifest(manifest({ events: { death: [{ frame: 0, show: [], hide: ['Weapon'] }] } }))).not.toThrow();
    for (const bad of [[], { initiallyHidden: [''] }, { events: { x: [] } }, { events: { x: [{ frame: -1, show: [], hide: [] }] } }, { events: { x: [{ frame: 0, show: [1], hide: [] }] } }])
      expect(() => assertManifest(manifest(bad))).toThrow('invalid-submesh-visibility');
  });
});
