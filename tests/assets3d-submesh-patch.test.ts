import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
// @ts-expect-error Offline Node script.
import { buildAssetRoot } from '../scripts/assets3d/build-asset-root.mjs';
// @ts-expect-error Pure Node build utility.
import { makeModel, validateModel } from '../scripts/assets3d/model.mjs';
// @ts-expect-error Pure Node build utility.
import { readGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Pure Node build utility.
import { encodePng } from '../scripts/assets3d/texture.mjs';
// @ts-expect-error Pure Node build utility.
import { fnv1a } from '../scripts/assets3d/bin.mjs';
// @ts-expect-error Pure Node build utility.
import { submeshVisibilityEvents, submeshPatchPlan, appendSubmeshes, patchModel, TIMED_FORM_SUBMESHES } from '../scripts/assets3d/submesh-patch.mjs';
// @ts-expect-error Pure Node build utility.
import { graftSubmeshes } from '../scripts/assets3d/submesh-graft.mjs';
// @ts-expect-error Offline Node script.
import { compressModelGlb } from '../scripts/assets3d/compress.mjs';
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

  it('appends a hidden submesh no carried clip shows when the unit\'s timed form names it', () => {
    const events = { x_attackprops: [{ frame: 0, show: ['Toy'], hide: [] }] };
    expect(submeshPatchPlan({ hidden: ['Wings', 'Toy', 'Prop'], submeshes: ['Body', 'Wings', 'Toy', 'Prop'], events, exportedClips: [], timedForm: ['wings', 'Toy', 'Gone'] })).toEqual({
      append: [{ name: 'Wings', shownBy: 'timed-form' }, { name: 'Toy', shownBy: 'timed-form', alsoShownInMissing: ['x_attackprops'] }],
      skipped: [{ name: 'Prop', reason: 'never-shown' }],
    });
    // Only a hidden submesh is appended: a timed-form name the mesh shows from the start or lacks adds nothing.
    expect(submeshPatchPlan({ hidden: [], submeshes: ['Body', 'Wings'], events: {}, exportedClips: [], timedForm: ['Wings'] })).toEqual({ append: [], skipped: [] });
    expect(TIMED_FORM_SUBMESHES).toEqual({ swain: ['wings'] });
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
  const patched = async (appendGeometry: boolean, clips = graph(clip('X_SpellProp', [{ show: ['Prop'] }, { frame: 9, hide: ['Prop'] }])), extra = {}) => {
    const f = fixtures(), before = makeModel(f.mesh, f.rig, [{ name: 'x_spellprop', bytes: anm() }], { Body: f.body }, { hiddenSubmeshes: ['Prop'] }).glb;
    const result = await patchModel({ before, entry: { path: 'models/x/model.glb' }, skn: f.mesh, docs: skinDocs(),
      graphEntries: clips, appendGeometry, ...extra,
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

  it('switch on, no clip shows it: the timed form\'s submesh is appended and initially hidden, by unit id', async () => {
    const { data, entry, report } = await patched(true, [], { timedForm: ['Prop'] });
    expect(readGlb(data).document.materials.map((m: { name: string }) => m.name)).toEqual(['Body', 'Prop']);
    expect(entry.submeshVisibility).toEqual({ initiallyHidden: ['Prop'] });
    expect(report).toMatchObject({ changed: true, appended: [{ name: 'Prop', shownBy: 'timed-form' }] });
    // Without a timed form (an id the table does not name, an inherited key included) it stays out.
    for (const id of ['x', 'constructor']) expect((await patched(true, [], { id })).report).toMatchObject({ changed: false, skipped: [{ name: 'Prop', reason: 'never-shown' }] });
  });

  it('grafts the appended submesh into an already compressed model, clips and body left as they were', async () => {
    const f = fixtures(), clips = [{ name: 'x_spellprop', bytes: anm() }];
    const plain = makeModel(f.mesh, f.rig, clips, { Body: f.body }, { hiddenSubmeshes: ['Prop'] }).glb;
    const compressed = await compressModelGlb(plain), rebuilt = appendSubmeshes(plain, f.mesh, ['Prop'], { Prop: f.prop });
    const { data, report } = await graftSubmeshes({ compressed, rebuilt, names: ['Prop'] });
    // The compressed GLB has a fallback buffer readGlb does not take: read its JSON chunk directly.
    const out = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString('utf8'));
    expect(out.extensionsUsed).toContain('EXT_meshopt_compression');
    expect(out.materials.map((m: { name: string }) => m.name)).toEqual(['Body', 'Prop']);
    expect(out.meshes[0].primitives).toHaveLength(2);
    expect(report).toMatchObject({ grafted: [{ name: 'Prop', vertices: 3, triangles: 1 }], clips: 1 });
    expect(report.maxDistance.Body).toBeLessThan(0.01);
    expect(report.maxDistance.Prop).toBeLessThan(0.01);
    // Same inputs, same bytes; a second graft of the same submesh is refused.
    expect((await graftSubmeshes({ compressed, rebuilt, names: ['Prop'] })).data.equals(data)).toBe(true);
    await expect(graftSubmeshes({ compressed: data, rebuilt, names: ['Prop'] })).rejects.toThrow('submesh-graft-already-present:Prop');
    await expect(graftSubmeshes({ compressed, rebuilt, names: ['Wings'] })).rejects.toThrow('submesh-graft-missing-primitive:Wings');
  }, 30000);

  it('the merge entry runs it from an extraction cache: models stay byte for byte, the manifest gets the events', async () => {
    const root = await mkdtemp(join(tmpdir(), 'submesh-merge-'));
    try {
      const put = async (path: string, data: string | Buffer) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), data); };
      const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
      const f = fixtures(), model = makeModel(f.mesh, f.rig, [{ name: 'x_spellprop', bytes: anm() }], { Body: f.body }, { hiddenSubmeshes: ['Prop'] }).glb;
      await put('input/manifest.json', JSON.stringify({ schemaVersion: 1, models: { x: { path: 'models/x/model.glb' } } }));
      await put('input/models/x/model.glb', model);
      // The extraction cache: the mesh and the skin bin (holding the animation graph too), each recorded in extraction.json.
      const files: Record<string, Buffer> = {
        'assets/characters/x/skins/base/x.skn': f.mesh,
        'data/characters/x/skins/skin0.bin': prop([
          { hash: 1, type: 'SkinCharacterDataProperties', fields: [
            field('skinMeshProperties', embed('SkinMeshDataProperties', [
              field('simpleSkin', str('x.skn')), field('skeleton', str('x.skl')), field('texture', str('body.tex')),
              field('initialSubmeshToHide', str('Prop')),
              field('materialOverride', list(0x83, [embed('SkinMeshDataProperties_MaterialOverride', [field('texture', str('prop.tex')), field('submesh', str('Prop'))])])),
            ])),
            field('skinAnimationProperties', embed('SkinAnimationProperties', [field('animationGraphData', [0x84, u32(77)])])),
          ] },
          { hash: 77, type: 'AnimationGraphData', fields: [
            field('mClipDataMap', map(17, 0x82, [[u32(fnv1a('Spell')), embed('AtomicClipData', [
              field('mAnimationResourceData', embed('AnimationResourceData', [field('mAnimationFilePath', str('ASSETS/Characters/X/Skins/Base/Animations/X_SpellProp.TFT_Set13.anm'))], 0x82)),
              field('mEventDataMap', map(17, 0x82, [[u32(1), embed('SubmeshVisibilityEventData', [
                field('mStartFrame', [10, f32(4)]), field('mShowSubmeshList', list(17, [u32(fnv1a('Prop'))])),
              ], 0x82)[1]]])),
            ], 0x82)[1]]])),
          ] },
        ]),
      };
      for (const [path, bytes] of Object.entries(files)) await put(`cache/extracted/${path}`, bytes);
      await put('cache/extraction.json', JSON.stringify({ files: Object.entries(files).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha(bytes) })) }));
      await put('unit-map.json', JSON.stringify({ $animationRules: { idle: 1, move: 1, attack: 1, cast: 1, hit: 1, death: 1 },
        x: { sourceName: 'x', base: 'assets/characters/x/skins/base', mesh: 'x.skn' } }));
      vi.stubEnv('ASSETS3D_UNIT_MAP', join(root, 'unit-map.json'));
      await buildAssetRoot({ roots: [join(root, 'input')], out: join(root, 'out'), submeshSource: join(root, 'cache') });
      const manifest = JSON.parse(await readFile(join(root, 'out/manifest.json'), 'utf8'));
      expect(manifest.models.x.submeshVisibility).toEqual({ events: { x_spellprop: [{ frame: 4, show: ['Prop'], hide: [] }] } });
      expect(sha(await readFile(join(root, 'out', manifest.models.x.path)))).toBe(sha(model));
      const report = JSON.parse(await readFile(join(root, 'out/merge-report.json'), 'utf8')).submeshPatch;
      expect(report).toMatchObject({ applied: true, geometry: false, changed: [], models: { x: { changed: false, wouldAppend: [{ name: 'Prop' }] } } });
      // Without an extraction cache the merge stops and says how to go on.
      await expect(buildAssetRoot({ roots: [join(root, 'input')], out: join(root, 'out2'), submeshSource: join(root, 'none') }))
        .rejects.toThrow(/submesh-source-missing.*--no-submesh-patch/);
    } finally { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); }
  });
});

// A minimal binary PROP writer for the cache fixture: each value is [type, encoded bytes] in parseBin's layout.
type Bin = [number, Buffer];
function u32(n: number) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; }
function u16(n: number) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function f32(n: number) { const b = Buffer.alloc(4); b.writeFloatLE(n); return b; }
const sized = (b: Buffer) => Buffer.concat([u32(b.length), b]);
const fieldList = (fields: Buffer[]) => Buffer.concat([u16(fields.length), ...fields]);
function field(name: string, [type, bytes]: Bin) { return Buffer.concat([u32(fnv1a(name)), Buffer.from([type]), bytes]); }
function str(s: string): Bin { const b = Buffer.from(s, 'utf8'); return [16, Buffer.concat([u16(b.length), b])]; }
function embed(type: string, fields: Buffer[], kind = 0x83): Bin { return [kind, Buffer.concat([u32(fnv1a(type)), sized(fieldList(fields))])]; }
function list(itemType: number, items: (Buffer | Bin)[]): Bin {
  return [0x80, Buffer.concat([Buffer.from([itemType]), sized(Buffer.concat([u32(items.length), ...items.map(i => Buffer.isBuffer(i) ? i : i[1])]))])];
}
function map(keyType: number, valueType: number, pairs: [Buffer, Buffer][]): Bin {
  return [0x86, Buffer.concat([Buffer.from([keyType, valueType]), sized(Buffer.concat([u32(pairs.length), ...pairs.flat()]))])];
}
function prop(entries: { hash: number; type: string; fields: Buffer[] }[]) {
  return Buffer.concat([Buffer.from('PROP'), u32(3), u32(0), u32(entries.length), ...entries.map(e => u32(fnv1a(e.type))),
    ...entries.map(e => sized(Buffer.concat([u32(e.hash), fieldList(e.fields)])))]);
}

