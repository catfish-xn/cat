import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
// @ts-expect-error Pure Node utility.
import { parseBin, fnv1a, binField } from '../scripts/assets3d/bin.mjs';
// @ts-expect-error Pure Node utility.
import { skinBindings, animationClips, selectAnimations, canonicalAsset } from '../scripts/assets3d/bin-bindings.mjs';
// @ts-expect-error Pure Node utility.
import { characterForPath, propertyReferences } from '../scripts/assets3d/plan-fetch.mjs';

const u8 = (n: number) => Buffer.from([n]);
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const str = (s: string) => Buffer.concat([u16(Buffer.byteLength(s)), Buffer.from(s)]);
const block = (b: Buffer) => Buffer.concat([u32(b.length), b]);
const field = (name: string, type: number, b: Buffer) => Buffer.concat([u32(fnv1a(name)), u8(type), b]);
const fields = (...f: Buffer[]) => Buffer.concat([u16(f.length), ...f]);
const embed = (name: string, ...f: Buffer[]) => Buffer.concat([u32(fnv1a(name)), block(fields(...f))]);
const list = (type: number, ...b: Buffer[]) => Buffer.concat([u8(type), block(Buffer.concat([u32(b.length), ...b]))]);
const map = (kt: number, vt: number, ...pairs: Buffer[]) => Buffer.concat([u8(kt), u8(vt), block(Buffer.concat([u32(pairs.length), ...pairs]))]);
const prop = (type: string, ...f: Buffer[]) => Buffer.concat([Buffer.from('PROP'), u32(3), u32(0), u32(1), u32(fnv1a(type)), block(Buffer.concat([u32(fnv1a('entry')), fields(...f)]))]);
const obj = (type: string, values: Record<string, unknown>) => ({ type: fnv1a(type), fields: Object.entries(values).map(([k, v]) => ({ hash: fnv1a(k), value: v })) });
const document = (...entries: unknown[]) => ({ entries, patches: [] });
const link = (name: string) => ({ kind: 'link', hash: fnv1a(name) });

describe('bounded PROP/PTCH parser', () => {
  const sample = () => prop('Example', field('skin', 0x83, embed('Mesh',
    field('names', 0x80, list(16, str('Body'), str('Weapon'))),
    field('clips', 0x86, map(17, 0x82, Buffer.concat([u32(fnv1a('Idle1')), embed('AtomicClipData', field('path', 16, str('idle.anm')))]))),
    field('maybe', 0x85, Buffer.concat([u8(17), u8(1), u32(fnv1a('yes'))])),
    field('reference', 0x84, u32(fnv1a('material'))))));
  it('reads embed, pointer, list/list2, hash, link, map, option and preserves unknown hashes', () => {
    const parsed = parseBin(sample()), skin = binField(parsed.entries[0], 'skin');
    expect(parsed.version).toBe(3); expect(binField(skin, 'names')).toEqual(['Body', 'Weapon']);
    expect(binField(skin, 'clips').entries[0][0]).toEqual({ kind: 'hash', hash: fnv1a('Idle1') });
    expect(binField(binField(skin, 'clips').entries[0][1], 'path')).toBe('idle.anm');
    expect(binField(skin, 'reference')).toEqual(link('material'));
    expect(parseBin(prop('Example', field('list2', 0x81, list(7, u32(42))))).entries[0].fields[0].value).toEqual([42]);
    expect(fnv1a('SkinMeshProperties')).toBe(fnv1a('skinmeshproperties'));
  });
  it('parses PTCH records with explicit patch data (binding rejects unapplied patches)', () => {
    const patchValue = Buffer.concat([u8(16), str('skin.texture'), str('new.tex')]);
    const bytes = Buffer.concat([Buffer.from('PTCH'), u32(1), u32(0), sample(), u32(1), u32(fnv1a('entry')), block(patchValue)]);
    const parsed = parseBin(bytes);
    expect(parsed.patch).toBe(true); expect(parsed.patches[0]).toMatchObject({ path: 'skin.texture', value: 'new.tex' });
    expect(() => skinBindings([parsed], ['Body'])).toThrow('unsupported-binding-bin-patches');
  });
  it('enforces byte/depth/count/value/string budgets and every enclosing length', () => {
    for (const limits of [{ maxBytes: 4 }, { maxDepth: 0 }, { maxCount: 0 }, { maxValues: 1 }, { maxStringBytes: 4 }])
      expect(() => parseBin(sample(), limits)).toThrow(/budget/);
    const truncated = sample().subarray(0, -1); expect(() => parseBin(truncated)).toThrow(/truncated/);
    const oversized = sample(); oversized.writeUInt32LE(0xffffffff, 20); expect(() => parseBin(oversized)).toThrow(/truncated/);
    expect(() => parseBin(Buffer.concat([sample(), u8(0)]))).toThrow('bin-trailing-bytes');
    expect(() => parseBin(prop('Example', field('bad', 0x99, Buffer.alloc(0))))).toThrow('unknown-bin-type:0x99');
    expect(() => parseBin(prop('Example', field('emptyUnknownList', 0x80, list(0x99))))).toThrow('unknown-bin-type:0x99');
    expect(() => parseBin(prop('Example', field('badOption', 0x85, Buffer.from([1, 2]))))).toThrow('invalid-bin-option');
    const longBlock = sample(); longBlock.writeUInt32LE(longBlock.readUInt32LE(20) + 1, 20);
    expect(() => parseBin(Buffer.concat([longBlock, u8(0)]))).toThrow('bin-length-mismatch');
  });
  it('reads scalar, vector, color, null pointer, file hash and integer precision', () => {
    const path = Buffer.alloc(8); path.writeBigUInt64LE(0xffffffffffffffffn);
    const f = Buffer.alloc(12); [1, 2, 3].forEach((v, i) => f.writeFloatLE(v, i * 4));
    const p = parseBin(prop('Example', field('vec', 12, f), field('color', 15, Buffer.from([0, 1, 128, 255])),
      field('path', 18, path), field('uint64', 9, path), field('null', 0x82, u32(0)), field('none', 0, Buffer.alloc(6))));
    expect(binField(p.entries[0], 'vec')).toEqual([1, 2, 3]);
    expect(binField(p.entries[0], 'path')).toEqual({ kind: 'path', hash: 0xffffffffffffffffn });
    expect(binField(p.entries[0], 'uint64')).toBe(0xffffffffffffffffn); expect(binField(p.entries[0], 'null')).toBeNull();
  });
});

describe('initial material and action binding', () => {
  it('replays the names/path-only real BIN fixture against step2, exposing the Vi initial/dynamic material difference', async () => {
    const fixture = JSON.parse(await readFile(new URL('../scripts/assets3d/fixtures/step2-bindings.json', import.meta.url), 'utf8')) as Record<string, {
      mesh: string; skeleton: string; texture: string; material: string; hidden: string;
      overrides: { submesh: string; texture?: string; material?: string }[];
      materials: { name: string; samplers: { name: string; texture: string }[] }[];
      animations: Record<string, string>;
    }>;
    const map = JSON.parse(await readFile(new URL('../scripts/assets3d/unit-map.json', import.meta.url), 'utf8'));
    for (const id of ['jinx', 'vi']) {
      const f = fixture[id], config = map[id];
      const materials = f.materials.map(m => ({ ...obj('StaticMaterialDef', { name: m.name,
        samplerValues: m.samplers.map(s => obj('Sampler', { samplerName: s.name, textureName: s.texture })) }), hash: fnv1a(m.name) }));
      const skin = obj('TftSkinCharacterDataProperties', { skinMeshProperties: obj('Mesh', {
        simpleSkin: f.mesh, skeleton: f.skeleton, texture: f.texture, material: link(f.material), initialSubmeshToHide: f.hidden,
        materialOverride: f.overrides.map(o => obj('Override', { submesh: o.submesh, texture: o.texture, material: o.material ? link(o.material) : undefined }))
      }) });
      const binding = skinBindings([document(skin, ...materials)], Object.keys(config.textures));
      for (const [name, path] of Object.entries(config.textures) as [string, string][]) {
        const expected = canonicalAsset(config.base + '/' + path), actual = canonicalAsset(binding.textures[name]);
        if (id === 'vi') {
          expect(actual).toBe('assets/characters/tft13_vi/skins/base/tft13_vi_base_tx_cm.tex');
          expect(actual).not.toBe(expected);
          expect(f.materials.find(m => m.name.endsWith('/RebelStatus'))?.samplers.some(s => canonicalAsset(s.texture) === expected)).toBe(true);
        } else expect(actual).toBe(expected);
      }
      expect(binding.hidden).toEqual(id === 'jinx' ? ['Torch'] : []);
      const graph = obj('AnimationGraphData', { mClipDataMap: { entries: Object.entries(f.animations).map(([action, path]) =>
        [{ hash: fnv1a(action) }, obj('AtomicClipData', { mAnimationResourceData: obj('Resource', { mAnimationFilePath: path }) })]) } });
      expect(selectAnimations(animationClips([document(graph)]), map.$animationRules, config.animations).mapped).toEqual(config.animations);
    }
    function onlyStrings(value: unknown): boolean {
      return typeof value === 'string' || (value !== null && typeof value === 'object' && Object.values(value).every(onlyStrings));
    }
    expect(onlyStrings(fixture)).toBe(true);
  });

  it('resolves default and override StaticMaterialDef across bins; applies direct texture and hidden names', () => {
    const material = { ...obj('StaticMaterialDef', { samplerValues: [obj('Sampler', { samplerName: 'Light_Mask', textureName: 'mask.tex' }),
      obj('Sampler', { samplerName: 'Diffuse_Texture', textureName: 'body.tex' })] }), hash: fnv1a('body') };
    const skin = obj('TftSkinCharacterDataProperties', { skinMeshProperties: obj('Mesh', { simpleSkin: 'mesh.skn', skeleton: 'rig.skl',
      texture: 'template.tex', material: link('body'), initialSubmeshToHide: 'Torch Hat', materialOverride: [
        obj('Override', { submesh: 'Torch', texture: 'torch.tex' }), obj('Override', { submesh: 'Weapon', material: link('body') })] }) });
    const result = skinBindings([document(skin), document(material)], ['Body', 'Torch', 'Weapon']);
    expect(result.textures).toEqual({ Body: 'body.tex', Torch: 'torch.tex', Weapon: 'body.tex' });
    expect(result.hidden).toEqual(['Torch']); expect(result.mesh).toBe('mesh.skn');
    expect(() => skinBindings([document(skin)], ['Body'])).toThrow('missing-static-material');
    const diffuse = material.fields[0].value as unknown[]; diffuse.pop();
    expect(() => skinBindings([document(skin, material)], ['Body'])).toThrow('missing-material-diffuse');
  });
  it('uses graph aliases, skips non-atomic sequences, reports ambiguous or missing actions, and avoids spell hit as hit', async () => {
    const rules = JSON.parse(await readFile(new URL('../scripts/assets3d/unit-map.json', import.meta.url), 'utf8')).$animationRules;
    const atomic = (name: string, path: string) => [{ hash: fnv1a(name) }, obj('AtomicClipData', { mFlags: 2,
      mAnimationResourceData: obj('Resource', { mAnimationFilePath: path }) })];
    const graph = obj('AnimationGraphData', { mClipDataMap: { entries: [atomic('Idle1', 'unit_idle1.anm'),
      atomic('Run_Base', 'unit_run.anm'), atomic('OtherIdle', 'unit_idle2.anm'), atomic('Attack1', 'unit_attack1.anm'),
      atomic('Spell4_Hit', 'unit_spell4_hit.anm'), [{ hash: fnv1a('Death') }, obj('SequencerClipData', {})]] } });
    const clips = animationClips([document(graph)]), selected = selectAnimations(clips, rules);
    expect(selected.mapped).toEqual({ idle: 'unit_idle1', move: 'unit_run', attack: 'unit_attack1', cast: 'unit_spell4_hit' });
    expect(selected.decisions.hit.reason).toBe('missing-atomic-action'); expect(selected.decisions.death.reason).toBe('missing-atomic-action');
    const ambiguous = selectAnimations([{ atomic: true, hash: 1, path: 'a_spell.anm' }, { atomic: true, hash: 2, path: 'b_spell.anm' }], rules);
    expect(ambiguous.decisions.cast.reason).toBe('ambiguous-action'); expect(ambiguous.mapped.cast).toBeUndefined();
    expect(selectAnimations(clips, rules, { idle: 'unit_idle2' }).mapped.idle).toBe('unit_idle2');
  });
  it('owns extensionless character PROP dependencies in cost-filtered extraction plans', () => {
    expect(characterForPath('characters/tft13_vi')).toBe('tft13_vi');
    expect(propertyReferences(prop('Example', field('texture', 16, str('assets/shared/body.tex'))))).toEqual(['assets/shared/body.tex']);
    expect(characterForPath('data/characters/tft13_vi/skins/skin0.bin')).toBe('tft13_vi');
    expect(characterForPath('assets/characters/tft13_vi/skins/base/vi.tex')).toBe('tft13_vi');
    expect(characterForPath('characters/tft13_vi_extra')).toBe('tft13_vi_extra');
    expect(canonicalAsset('ASSETS/Test.TFT_Set13.tex')).toBe('assets/test.tex');
  });
});
