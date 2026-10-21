import { describe, expect, it } from 'vitest';
// @ts-expect-error Offline Node module.
import { boardRoot, compactChunks, stemMatches, sceneEntryClosure, placedPropReferences, resolveBoardReference, boardPlanJson } from '../scripts/assets3d/boards-plan.mjs';
// @ts-expect-error Offline Node module.
import { fnv1a } from '../scripts/assets3d/bin.mjs';
// @ts-expect-error Offline Node module.
import { boardAlignment } from '../scripts/assets3d/boards-build.mjs';
// @ts-expect-error Offline Node module.
import { verifyBoardPackage } from '../scripts/assets3d/boards-package.mjs';
// @ts-expect-error Offline Node module.
import { readBoardGeometry, boardRangeGlb } from '../scripts/assets3d/boards-geometry.mjs';
// @ts-expect-error Offline Node module.
import { combineBoardGeometry } from '../scripts/assets3d/boards-pack-geometry.mjs';
// @ts-expect-error Offline Node module.
import { decodeBoardTexture } from '../scripts/assets3d/boards-texture.mjs';
// @ts-expect-error Offline Node module.
import { encodePng } from '../scripts/assets3d/texture.mjs';
// @ts-expect-error Offline Node module.
import { readGlb } from '../scripts/assets3d/glb.mjs';
import { createHash } from 'node:crypto';

function syntheticGeometry(version: number) {
  const parts: Buffer[] = [];
  const u = (v: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); parts.push(b); };
  const f = (v: number) => { const b = Buffer.alloc(4); b.writeFloatLE(v); parts.push(b); };
  const text = (s: string) => { u(s.length); parts.push(Buffer.from(s)); };
  parts.push(Buffer.from('OEGM')); u(version);
  if (version === 17) u(0); else { text(''); text(''); }
  u(2);
  for (const [usage, format] of [[0, 2], [7, 7]]) {
    u(0); u(1);
    for (let i = 0; i < 15; i++) { u(i ? 0 : usage); u(i ? 3 : format); }
  }
  u(2);
  parts.push(Buffer.from([255])); u(36);
  for (const v of [0, 0, 0, 1, 0, 0, 0, 0, 1]) f(v);
  parts.push(Buffer.from([255])); u(12); parts.push(Buffer.alloc(12));
  u(1); parts.push(Buffer.from([255])); u(6); parts.push(Buffer.from([0, 0, 1, 0, 2, 0]));
  u(1); u(3); u(2); u(0); u(0); u(1); u(3); u(0);
  parts.push(Buffer.from([255])); if (version === 17) u(0);
  u(1); u(0); text('fake/paper-garden'); u(0); u(3); u(0); u(2);
  parts.push(Buffer.from([0]));
  for (const v of [0, 0, 0, 1, 0, 1]) f(v);
  for (let i = 0; i < 16; i++) f(i % 5 === 0 ? 1 : 0);
  if (version === 17) u(0); else parts.push(Buffer.alloc(2));
  for (let i = 0; i < 3; i++) { text(''); for (let j = 0; j < 4; j++) f(0); }
  return Buffer.concat(parts);
}

describe('offline board planning with synthetic inputs', () => {
  it.each([13, 17])('reads bounded split-stream geometry profile %i', version => {
    const bytes = syntheticGeometry(version), geometry = readBoardGeometry(bytes);
    expect(geometry.meshes).toHaveLength(1);
    expect(geometry.meshes[0].vertices.map((v: {p: number[]}) => v.p)).toEqual([[0, 0, 0], [1, 0, 0], [0, 0, 1]]);
    expect(geometry.ignoredSpatialBytes).toBe(0);
    expect(() => readBoardGeometry(bytes.subarray(0, bytes.length - 1))).toThrow();
    const bad = Buffer.from(bytes); bad.writeUInt32LE(15, 4);
    expect(() => readBoardGeometry(bad)).toThrow('unsupported-board-mapgeo-version');
  });
  it('packs static nodes and shares identical textures without losing vertex colours', () => {
    const mesh = readBoardGeometry(syntheticGeometry(13)).meshes[0];
    mesh.vertices.forEach((v: {color: number[]}) => { v.color = [1, 0, 0, 1]; });
    const png = encodePng({width: 1, height: 1, rgba: Buffer.from([255, 0, 0, 255])});
    const bytes = boardRangeGlb(mesh, mesh.ranges[0], png, {origin: [0, 0, 0]}).glb;
    const packed = combineBoardGeometry([{id: 'paper', bytes}, {id: 'pond', bytes}]);
    const glb = readGlb(packed.glb).document;
    expect(glb.images).toHaveLength(1);
    expect(glb.nodes.map((n: {name: string}) => n.name)).toEqual(['paper', 'pond']);
    expect(glb.meshes.every((m: {primitives: {attributes: Record<string, number>}[]}) => '_SOURCE_COLOR' in m.primitives[0].attributes)).toBe(true);
  });
  it('aligns all cells of an authored odd-row grid to the runtime grid', () => {
    const a = boardAlignment([0, 0, 0], [13, 0, 14], {radius: 2, origin: {x: 10, y: 20}});
    for (let row = 0; row < 8; row++) for (let col = 0; col < 7; col++) {
      const x = (col + (row % 2) / 2) * 4, z = row * 4;
      expect(-x * a.scale[0] + a.offset[0]).toBeCloseTo(10 + Math.sqrt(3) * 2 * (6 - col + ((7 - row) % 2) / 2));
      expect(z * a.scale[2] + a.offset[2]).toBeCloseTo(20 + 3 * (7 - row));
    }
  });
  it('indexes every root-owned payload and rejects missing, foreign or changed references', () => {
    const manifest = {boardKey: 'board-paper', boards: {'board-paper': {path: 'scene.json'}}, models: {'board-paper': {path: 'models/paper.glb'}}, effects: {mist: {path: 'effects/mist.json'}}};
    const effects = {mist: {emitters: [{texture: 'textures/mist.png', mesh: 'meshes/mist.glb'}]}};
    const files = new Map(['scene.json', 'models/paper.glb', 'effects/mist.json', 'textures/mist.png', 'meshes/mist.glb'].map(p => [p, Buffer.from('synthetic')]));
    const precache = {files: [...files].map(([path, b]) => ({path, bytes: b.length, sha256: createHash('sha256').update(b).digest('hex')}))};
    expect(verifyBoardPackage(manifest, precache, files, effects).files).toBe(5);
    expect(() => verifyBoardPackage(manifest, {files: precache.files.slice(1)}, files, effects)).toThrow('incomplete-board-precache');
    expect(() => verifyBoardPackage({...manifest, boardKey: 'board-other'}, precache, files, effects)).toThrow('invalid-board-manifest-key');
    expect(() => verifyBoardPackage(manifest, precache, new Map([...files, ['textures/mist.png', Buffer.from('changed')]]), effects)).toThrow('board-precache-mismatch');
    expect(() => verifyBoardPackage(manifest, precache, files, {mist: {emitters: [{texture: '../default/mist.png'}]}})).toThrow('unsafe-board-reference');
  });
  it('decodes explicit four-bit alpha instead of treating BC2 as BC1 transparency', () => {
    const b = Buffer.alloc(144); b.write('DDS '); b.writeUInt32LE(124, 4); b.writeUInt32LE(4, 12); b.writeUInt32LE(4, 16); b.writeUInt32LE(32, 76); b.write('DXT3', 84);
    b.fill(255, 128, 136); b[128] = 0;
    const decoded = decodeBoardTexture(b);
    expect(decoded.rgba[3]).toBe(0); expect(decoded.rgba[7]).toBe(0); expect(decoded.rgba[11]).toBe(255);
    expect(() => decodeBoardTexture(b.subarray(0, 140))).toThrow('truncated-asset');
  });
  it('records nested uint64 values without truncating their decimal digits', () => {
    expect(JSON.parse(boardPlanJson({ objects: [{ value: 10000000000000000000n }] })))
      .toEqual({ objects: [{ value: '10000000000000000000' }] });
  });
  it('keeps the default and every optional board in independent roots', () => {
    const keys = ['board-default', 'board-paper-garden', 'board-silver-pond'];
    const roots = keys.map(boardRoot);
    expect(roots).toEqual(['default', 'extra/board-paper-garden', 'extra/board-silver-pond']);
    expect(new Set(roots).size).toBe(keys.length);
    for (const key of ['../escape', 'board-../escape', 'board-Garden', 'board-', 'board-a/b'])
      expect(() => boardRoot(key)).toThrow('invalid-board-key');
  });
  it('keeps every missing chunk once with exact download-plan fields', () => {
    const a = { id: 'chunk-a', bundleId: 'bundle-a', offset: 100, size: 10, targetSize: 20, fileOffset: 0 };
    const b = { id: 'chunk-b', bundleId: 'bundle-b', offset: 200, size: 20, targetSize: 40 };
    expect(compactChunks([b, a, a])).toEqual([
      { id: 'chunk-a', bundleId: 'bundle-a', offset: 100, size: 10, targetSize: 20 }, b,
    ]);
  });
  it('matches whole scene tokens instead of incidental filename substrings', () => {
    expect(stemMatches('fake/scenes/paper-garden.mesh', ['paper-garden'])).toBe(true);
    expect(stemMatches('fake/scenes/paper-garden-large.mesh', ['paper-garden'])).toBe(false);
    expect(stemMatches('fake/scenes/notpaper-garden.mesh', ['paper-garden'])).toBe(false);
  });
  it('discovers nested placed props whose model filenames are absent from the scene', () => {
    const field = (name: string, value: unknown) => ({ hash: fnv1a(name), value });
    const prop = (skin?: number) => ({ type: fnv1a('MapAnimatedProp'), fields: [
      field('PropName', 'PaperBird'), ...(skin === undefined ? [] : [field('SkinID', skin)]),
    ] });
    expect(placedPropReferences([{ nested: [prop(), prop(2), prop(2)] }])).toEqual([
      'data/characters/paperbird/skins/skin0.bin', 'data/characters/paperbird/skins/skin2.bin',
    ]);
    expect(() => placedPropReferences([prop(-1)])).toThrow('invalid-placed-prop');
  });
  it('prefers an exact prop document and bounds consolidated skin matching', () => {
    const ref = 'data/characters/paperbird/skins/skin2.bin';
    const exact = { path: ref };
    const combined = { path: 'data/paperbird_skins_root_skins_skin2_skins_skin3.bin' };
    const unrelated = { path: 'data/paperbird_skins_skin20.bin' };
    const other = { path: 'data/otherbird_skins_skin2.bin' };
    expect(resolveBoardReference(ref, new Map([[ref, [exact]]]), [combined])).toEqual([exact]);
    expect(resolveBoardReference(ref, new Map(), [combined, unrelated, other])).toEqual([combined]);
    expect(resolveBoardReference('fake/missing.tex', new Map(), [combined])).toEqual([]);
  });
  it('traverses typed scene links through cycles without importing unrelated scenes', () => {
    const entries = [
      { hash: 10, value: { kind: 'link', hash: 20 } },
      { hash: 20, value: [{ kind: 'link', hash: 10 }, { kind: 'hash', hash: 30 }] },
      { hash: 30, texture: 'fake/materials/default/noise.tex' },
      { hash: 40, texture: 'fake/materials/default/other.tex' },
    ];
    const names = new Map([[10, 'fake/scenes/paper-garden/root'], [30, 'fake/scenes/paper-garden-large/root']]);
    expect(sceneEntryClosure(entries, names, [], ['fake/scenes/paper-garden'])).toEqual(entries.slice(0, 2));
    expect(sceneEntryClosure(entries, names, [], ['fake/scenes/absent'])).toEqual([]);
  });
});
