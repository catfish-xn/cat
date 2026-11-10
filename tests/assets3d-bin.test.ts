import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error Pure Node utility.
import { parseBin, fnv1a, binField } from '../scripts/assets3d/bin.mjs';
// @ts-expect-error Pure Node utility.
import { skinBindings, animationClips, selectAnimations, canonicalAsset, clipRangeFor } from '../scripts/assets3d/bin-bindings.mjs';
// @ts-expect-error Pure Node utility.
import { makeManifest, resolveUnitClipRanges, resolveUnitFormAnimations } from '../scripts/assets3d/build.mjs';
import { assertManifest } from '../src/rendering3d/contracts';
// @ts-expect-error Pure Node utility.
import { writeGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Pure Node utility.
import { characterForPath, propertyReferences } from '../scripts/assets3d/plan-fetch.mjs';
// @ts-expect-error Pure Node utility.
import { stageClipRanges } from '../scripts/assets3d/stage-clip-ranges.mjs';
// @ts-expect-error Pure Node utility.
import { stageFormAnimations } from '../scripts/assets3d/stage-form-animations.mjs';
// @ts-expect-error Pure Node utility.
import { mapStagesToSequence, mergeAdjacentSegments, planGraphAction, planHeroVariant } from '../scripts/assets3d/stage-anim-sequences.mjs';

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
  it('checks initial/dynamic material differences using invented names and paths', async () => {
    const fixture = JSON.parse(await readFile(new URL('../scripts/assets3d/fixtures/step2-bindings.json', import.meta.url), 'utf8')) as Record<string, {
      mesh: string; skeleton: string; texture: string; material: string; hidden: string;
      overrides: { submesh: string; texture?: string; material?: string }[];
      materials: { name: string; samplers: { name: string; texture: string }[] }[];
      animations: Record<string, string>;
    }>;
    const map = JSON.parse(await readFile(new URL('../scripts/assets3d/unit-map.example.json', import.meta.url), 'utf8'));
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
        if (binding.hidden.includes(name)) { expect(binding.textures).not.toHaveProperty(name); continue; }
        const expected = canonicalAsset(config.base + '/' + path), actual = canonicalAsset(binding.textures[name]);
        if (id === 'vi') {
          expect(actual).toBe('synthetic/initial.tex');
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
    expect(result.textures).toEqual({ Body: 'body.tex', Weapon: 'body.tex' });
    expect(result.hidden).toEqual(['Torch']); expect(result.mesh).toBe('mesh.skn');
    expect(() => skinBindings([document(skin)], ['Body'])).toThrow('missing-static-material');
    const diffuse = material.fields[0].value as unknown[]; diffuse.pop();
    expect(() => skinBindings([document(skin, material)], ['Body'])).toThrow('missing-material-diffuse');
  });
  it('uses graph aliases, skips non-atomic sequences, reports ambiguous or missing actions, and avoids spell hit as hit', async () => {
    const rules = JSON.parse(await readFile(new URL('../scripts/assets3d/unit-map.example.json', import.meta.url), 'utf8')).$animationRules;
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
  it('reads StartFrame and EndFrame from AtomicClipData when present and defaults to null', () => {
    const graph = obj('AnimationGraphData', {
      mClipDataMap: {
        entries: [
          [
            { hash: fnv1a('Spell1') },
            obj('AtomicClipData', {
              StartFrame: 4,
              EndFrame: 20,
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'synthetic_spell.anm' }),
            }),
          ],
          [
            { hash: fnv1a('Idle1') },
            obj('AtomicClipData', {
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'synthetic_idle.anm' }),
            }),
          ],
        ],
      },
    });
    const clips = animationClips([document(graph)]);
    expect(clips).toEqual([
      {
        hash: fnv1a('Spell1'),
        type: fnv1a('AtomicClipData'),
        atomic: true,
        flags: 0,
        path: 'synthetic_spell.anm',
        startFrame: 4,
        endFrame: 20,
      },
      {
        hash: fnv1a('Idle1'),
        type: fnv1a('AtomicClipData'),
        atomic: true,
        flags: 0,
        path: 'synthetic_idle.anm',
        startFrame: null,
        endFrame: null,
      },
    ]);
  });
  it('resolves shared-anm clip ranges by selected graphHashes or deduplication and reports ambiguous ranges', () => {
    const graph = obj('AnimationGraphData', {
      mClipDataMap: {
        entries: [
          [
            { hash: fnv1a('ClipA') },
            obj('AtomicClipData', {
              StartFrame: 5,
              EndFrame: 28,
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'synthetic_shared.anm' }),
            }),
          ],
          [
            { hash: fnv1a('ClipB') },
            obj('AtomicClipData', {
              StartFrame: 36,
              EndFrame: 69,
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'synthetic_shared.anm' }),
            }),
          ],
        ],
      },
    });
    const clips = animationClips([document(graph)]);
    const hashA = fnv1a('ClipA').toString(16);
    const hashB = fnv1a('ClipB').toString(16);

    expect(clipRangeFor(clips, 'synthetic_shared', [hashA])).toEqual({ startFrame: 5, endFrame: 28 });
    expect(clipRangeFor(clips, 'synthetic_shared', [hashB])).toEqual({ startFrame: 36, endFrame: 69 });
    expect(clipRangeFor(clips, 'synthetic_shared')).toEqual({
      skip: 'ambiguous-clip-range',
      candidates: [
        { hash: hashA, startFrame: 5, endFrame: 28 },
        { hash: hashB, startFrame: 36, endFrame: 69 },
      ],
    });

    const sameRangeClips = [
      { ...clips[0], startFrame: 5, endFrame: 28 },
      { ...clips[1], startFrame: 5, endFrame: 28 },
    ];
    expect(clipRangeFor(sameRangeClips, 'synthetic_shared')).toEqual({ startFrame: 5, endFrame: 28 });

    const noRangeClips = [
      { ...clips[0], startFrame: null, endFrame: null },
      { ...clips[1], startFrame: null, endFrame: null },
    ];
    expect(clipRangeFor(noRangeClips, 'synthetic_shared')).toBeNull();

    const namedGraph = obj('AnimationGraphData', {
      mClipDataMap: {
        entries: [
          [
            'Spell1_Bar',
            obj('AtomicClipData', {
              StartFrame: 10,
              EndFrame: 32,
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'TFT13_Foo_Spell1_Bar.anm' }),
            }),
          ],
          [
            'Spell1_Other',
            obj('AtomicClipData', {
              StartFrame: 123,
              EndFrame: 142,
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'TFT13_Foo_Spell1_Bar.anm' }),
            }),
          ],
        ],
      },
    });
    const namedClips = animationClips([document(namedGraph)]);
    expect(clipRangeFor(namedClips, 'tft13_foo_spell1_bar')).toEqual({ startFrame: 10, endFrame: 32 });

    const nullNamedClips = [
      { ...namedClips[0], startFrame: null, endFrame: null },
      namedClips[1],
    ];
    expect(clipRangeFor(nullNamedClips, 'tft13_foo_spell1_bar')).toBeNull();

    const unmatchedNamedClips = [
      { ...namedClips[0], hash: fnv1a('Spell1_Unrelated') },
      namedClips[1],
    ];
    expect(clipRangeFor(unmatchedNamedClips, 'tft13_foo_spell1_bar')).toEqual({
      skip: 'ambiguous-clip-range',
      candidates: [
        { hash: fnv1a('Spell1_Unrelated').toString(16), startFrame: 10, endFrame: 32 },
        { hash: fnv1a('Spell1_Other').toString(16), startFrame: 123, endFrame: 142 },
      ],
    });
  });
  it('writes clipRanges only for cast-referenced clips and records non-cast ranged clips as non-cast-action skips', async () => {
    const rules = JSON.parse(await readFile(new URL('../scripts/assets3d/unit-map.example.json', import.meta.url), 'utf8')).$animationRules;
    const graph = obj('AnimationGraphData', {
      mClipDataMap: {
        entries: [
          [
            { hash: fnv1a('Attack1') },
            obj('AtomicClipData', {
              EndFrame: 9,
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'unit_attack1.anm' }),
            }),
          ],
          [
            { hash: fnv1a('Spell1') },
            obj('AtomicClipData', {
              StartFrame: 6,
              EndFrame: 24,
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'unit_spell1.anm' }),
            }),
          ],
          [
            { hash: fnv1a('Spell1_Out') },
            obj('AtomicClipData', {
              EndFrame: 15,
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'unit_spell1_out.anm' }),
            }),
          ],
        ],
      },
    });
    const clips = animationClips([document(graph)]);
    const selected = selectAnimations(clips, rules);
    const animation = {
      ...selected,
      files: { ...selected.files, unit_spell1_out: 'unit_spell1_out.anm' },
    };
    const built = resolveUnitClipRanges(animation, clips, [], {
      castSequence: { main: 'unit_spell1', out: 'unit_spell1_out' },
    });
    expect(built.clipRanges).toEqual({
      unit_spell1: [6 / 30, 24 / 30],
      unit_spell1_out: [0, 15 / 30],
    });
    expect(built.clipRanges).not.toHaveProperty('unit_attack1');
    expect(built.clipRangeSkips).toEqual([
      { name: 'unit_attack1', reason: 'non-cast-action', startFrame: null, endFrame: 9 },
    ]);

    const local = fileURLToPath(new URL('../assets3d-local/', import.meta.url));
    await mkdir(local, { recursive: true });
    const dir = await mkdtemp(join(local, 'clip-ranges-cast-only-'));
    try {
      const assets = join(dir, 'assets');
      const extracted = join(dir, 'extracted');
      const outPath = join(dir, 'out-manifest.json');
      await mkdir(join(assets, 'models/synthetic_unit'), { recursive: true });
      await mkdir(join(extracted, 'data/characters/synthetic_unit/skins'), { recursive: true });
      const glb = writeGlb(
        {
          asset: { version: '2.0' },
          animations: [{ name: 'unit_attack1' }, { name: 'unit_spell1' }, { name: 'unit_spell1_out' }],
        },
        Buffer.alloc(0),
      );
      await writeFile(join(assets, 'models/synthetic_unit/model.glb'), glb);
      await writeFile(
        join(assets, 'manifest.json'),
        JSON.stringify({
          schemaVersion: 1,
          models: {
            synthetic_unit: {
              path: 'models/synthetic_unit/model.glb',
              animations: { attack: 'unit_attack1', cast: 'unit_spell1' },
              castSequence: { main: 'unit_spell1', out: 'unit_spell1_out' },
            },
          },
        }),
      );
      const skin0 = prop(
        'SkinCharacterDataProperties',
        field(
          'skinMeshProperties',
          0x83,
          embed('SkinMeshDataProperties', field('simpleSkin', 16, str('synthetic.skn')), field('skeleton', 16, str('synthetic.skl'))),
        ),
        field(
          'skinAnimationProperties',
          0x83,
          embed('SkinAnimationProperties', field('animationGraphData', 0x84, u32(fnv1a('synthetic_graph')))),
        ),
      );
      const rootBin = Buffer.concat([
        Buffer.from('PROP'),
        u32(3),
        u32(0),
        u32(1),
        u32(fnv1a('AnimationGraphData')),
        block(
          Buffer.concat([
            u32(fnv1a('synthetic_graph')),
            fields(
              field(
                'mClipDataMap',
                0x86,
                map(
                  17,
                  0x82,
                  Buffer.concat([
                    u32(fnv1a('Attack1')),
                    embed('AtomicClipData', field('EndFrame', 7, u32(9)), field('mAnimationFilePath', 16, str('unit_attack1.anm'))),
                  ]),
                  Buffer.concat([
                    u32(fnv1a('Spell1')),
                    embed(
                      'AtomicClipData',
                      field('StartFrame', 7, u32(6)),
                      field('EndFrame', 7, u32(24)),
                      field('mAnimationFilePath', 16, str('unit_spell1.anm')),
                    ),
                  ]),
                  Buffer.concat([
                    u32(fnv1a('Spell1_Out')),
                    embed('AtomicClipData', field('EndFrame', 7, u32(15)), field('mAnimationFilePath', 16, str('unit_spell1_out.anm'))),
                  ]),
                ),
              ),
            ),
          ]),
        ),
      ]);
      await writeFile(join(extracted, 'data/characters/synthetic_unit/skins/skin0.bin'), skin0);
      await writeFile(join(extracted, 'data/characters/synthetic_unit/skins/root.bin'), rootBin);
      await writeFile(join(extracted, 'unit_attack1.anm'), Buffer.alloc(0));
      await writeFile(join(extracted, 'unit_spell1.anm'), Buffer.alloc(0));
      await writeFile(join(extracted, 'unit_spell1_out.anm'), Buffer.alloc(0));

      const staged = await stageClipRanges({ assets, extracted, out: outPath });
      expect(staged.manifest.models.synthetic_unit.clipRanges).toEqual({
        unit_spell1: [6 / 30, 24 / 30],
        unit_spell1_out: [0, 15 / 30],
      });
      expect(staged.manifest.models.synthetic_unit.clipRanges).not.toHaveProperty('unit_attack1');
      expect(staged.skippedClips).toEqual([
        expect.objectContaining({
          id: 'synthetic_unit',
          clipName: 'unit_attack1',
          reason: 'non-cast-action',
          startFrame: null,
          endFrame: 9,
          refs: ['attack'],
        }),
      ]);

      await writeFile(
        join(assets, 'manifest.json'),
        JSON.stringify({
          schemaVersion: 1,
          models: {
            synthetic_unit: {
              path: 'models/synthetic_unit/model.glb',
              animations: { attack: 'unit_spell1', cast: 'unit_spell1' },
            },
          },
        }),
      );
      const sharedStaged = await stageClipRanges({ assets, extracted, out: outPath });
      expect(sharedStaged.manifest.models.synthetic_unit.clipRanges).toEqual({
        unit_spell1: [6 / 30, 24 / 30],
      });
      expect(sharedStaged.rows).toEqual([
        expect.objectContaining({
          id: 'synthetic_unit',
          clipName: 'unit_spell1',
          refs: ['attack', 'cast'],
          sharedNonCast: ['attack'],
        }),
      ]);
      expect(sharedStaged.markdown).toContain('attack, cast (施法优先)');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('owns extensionless character PROP dependencies in cost-filtered extraction plans', () => {
    expect(characterForPath('characters/demo_unit')).toBe('demo_unit');
    expect(propertyReferences(prop('Example', field('texture', 16, str('assets/shared/body.tex'))))).toEqual(['assets/shared/body.tex']);
    expect(propertyReferences(prop('Example', field('mesh', 16, str('assets/shared/triangle.sco'))))).toEqual(['assets/shared/triangle.sco']);
    expect(characterForPath('data/characters/demo_unit/skins/skin0.bin')).toBe('demo_unit');
    expect(characterForPath('assets/characters/demo_unit/skins/base/vi.tex')).toBe('demo_unit');
    expect(characterForPath('characters/demo_unit_extra')).toBe('demo_unit_extra');
    expect(canonicalAsset('ASSETS/Test.TFT_Set13.tex')).toBe('assets/test.tex');
  });
  it('resolves unit map formAnimations into exported animation.files and manifest models without trimming form attacks', async () => {
    const rules = JSON.parse(await readFile(new URL('../scripts/assets3d/unit-map.example.json', import.meta.url), 'utf8')).$animationRules;
    const graph = obj('AnimationGraphData', {
      mClipDataMap: {
        entries: [
          [
            { hash: fnv1a('Idle1_Ranged') },
            obj('AtomicClipData', {
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'synthetic_idle_ranged.anm' }),
            }),
          ],
          [
            { hash: fnv1a('Idle1_Melee') },
            obj('AtomicClipData', {
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'synthetic_idle_melee.anm' }),
            }),
          ],
          [
            { hash: fnv1a('Attack1') },
            obj('AtomicClipData', {
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'synthetic_attack_melee.anm' }),
            }),
          ],
          [
            { hash: fnv1a('Attack1_Ranged') },
            obj('AtomicClipData', {
              EndFrame: 18,
              mAnimationResourceData: obj('Resource', { mAnimationFilePath: 'synthetic_attack_ranged.anm' }),
            }),
          ],
        ],
      },
    });
    const clips = animationClips([document(graph)]);
    const animation = selectAnimations(clips, rules, {
      idle: 'synthetic_idle_ranged',
      attack: 'synthetic_attack_melee',
    });
    const config = {
      formAnimations: {
        front: { idle: 'synthetic_idle_melee', attack: 'synthetic_attack_melee', move: 'missing_move_melee' },
        back: { idle: 'synthetic_idle_ranged', attack: 'synthetic_attack_ranged' },
      },
    };
    const { formAnimations, formAnimationSkips } = resolveUnitFormAnimations(animation, clips, config);
    expect(formAnimations).toEqual({
      front: { idle: 'synthetic_idle_melee', attack: 'synthetic_attack_melee' },
      back: { idle: 'synthetic_idle_ranged', attack: 'synthetic_attack_ranged' },
    });
    expect(animation.files).toMatchObject({
      synthetic_idle_ranged: 'synthetic_idle_ranged.anm',
      synthetic_idle_melee: 'synthetic_idle_melee.anm',
      synthetic_attack_melee: 'synthetic_attack_melee.anm',
      synthetic_attack_ranged: 'synthetic_attack_ranged.anm',
    });
    expect(formAnimationSkips).toEqual([
      {
        form: 'front',
        action: 'move',
        requested: 'missing_move_melee',
        reason: 'missing-form-animation',
      },
    ]);
    const { clipRanges, clipRangeSkips } = resolveUnitClipRanges(animation, clips, [], config);
    expect(clipRanges).toEqual({});
    expect(clipRangeSkips).toContainEqual({
      name: 'synthetic_attack_ranged',
      reason: 'non-cast-action',
      startFrame: null,
      endFrame: 18,
    });
    const manifest = makeManifest(
      {
        synthetic_unit: {
          path: 'models/synthetic_unit/model.glb',
          animations: animation.mapped,
          ...(Object.keys(formAnimations).length ? { formAnimations } : {}),
        },
      },
      {},
      assertManifest,
    );
    expect(manifest.models.synthetic_unit.formAnimations).toEqual(formAnimations);
  });
  it('stages formAnimations and appends missing clips from an uncompressed donor glb without touching the input root', async () => {
    const local = fileURLToPath(new URL('../assets3d-local/', import.meta.url));
    await mkdir(local, { recursive: true });
    const dir = await mkdtemp(join(local, 'form-animations-stage-'));
    try {
      const assets = join(dir, 'assets');
      const outDir = join(dir, 'out');
      const donorPath = join(dir, 'donor.glb');
      const badDonorPath = join(dir, 'bad-donor.glb');
      await mkdir(join(assets, 'models/synthetic_unit'), { recursive: true });

      const sampleBinary = Buffer.alloc(16);
      const makeClipDoc = (nodeName: string, clipNames: string[]) => ({
        asset: { version: '2.0' },
        nodes: [{ name: nodeName }],
        buffers: [{ byteLength: sampleBinary.length }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 8 }, { buffer: 0, byteOffset: 8, byteLength: 8 }],
        accessors: [
          { bufferView: 0, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
          { bufferView: 1, componentType: 5126, count: 2, type: 'SCALAR' },
        ],
        animations: clipNames.map(name => ({
          name,
          samplers: [{ input: 0, output: 1 }],
          channels: [{ sampler: 0, target: { node: 0, path: 'weights' } }],
        })),
      });

      const baseGlb = writeGlb(makeClipDoc('RootJoint', ['idle_ranged', 'attack_melee']), sampleBinary);
      const donorGlb = writeGlb(
        makeClipDoc('RootJoint', ['idle_ranged', 'idle_melee', 'attack_melee', 'attack_ranged']),
        sampleBinary,
      );
      const badDonorGlb = writeGlb(
        makeClipDoc('DifferentJoint', ['idle_ranged', 'idle_melee', 'attack_melee', 'attack_ranged']),
        sampleBinary,
      );
      await writeFile(join(assets, 'models/synthetic_unit/model.glb'), baseGlb);
      await writeFile(donorPath, donorGlb);
      await writeFile(badDonorPath, badDonorGlb);
      await writeFile(
        join(assets, 'manifest.json'),
        JSON.stringify({
          schemaVersion: 1,
          models: {
            synthetic_unit: {
              path: 'models/synthetic_unit/model.glb',
              animations: { idle: 'idle_ranged', attack: 'attack_melee' },
            },
          },
        }),
      );

      const formAnimations = {
        back: { idle: 'idle_ranged', attack: 'attack_ranged' },
        front: { idle: 'idle_melee', attack: 'attack_melee' },
      };
      const result = await stageFormAnimations({
        assets,
        model: 'synthetic_unit',
        donor: donorPath,
        formAnimations: JSON.stringify(formAnimations),
        outDir,
      });
      expect(result.beforeClips).toEqual(['idle_ranged', 'attack_melee']);
      expect(result.afterClips).toEqual(['idle_ranged', 'attack_melee', 'idle_melee', 'attack_ranged']);
      expect(result.addedClips).toEqual(['idle_melee', 'attack_ranged']);
      expect(result.manifest.models.synthetic_unit.formAnimations).toEqual(formAnimations);

      await expect(
        stageFormAnimations({
          assets,
          model: 'synthetic_unit',
          donor: badDonorPath,
          formAnimations,
          outDir: join(dir, 'out-bad'),
        }),
      ).rejects.toThrow('cast-rig-mismatch');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('plans cast and attack sequences from synthetic animation graphs (adjacent merge, 2/3/4 stages, Parallel layers, untrimmed attacks, >4 and castVariants skips)', () => {
    const atomic = (clipName: string, startFrame: number | null = null, endFrame: number | null = null, lastFrame = 60, fps = 30) => ({
      kind: 'Atomic',
      keyName: clipName,
      clipName,
      startFrame,
      endFrame,
      effectiveStartFrame: startFrame ?? 0,
      effectiveEndFrame: endFrame ?? lastFrame,
      lastFrame,
      fps,
    });

    // 1. Sequencer adjacent segment merge vs non-adjacent clipSegments
    const mergedSeq = mergeAdjacentSegments([
      atomic('clip_intro', 0, 14, 30),
      atomic('clip_out', 0, 19, 50),
      atomic('clip_out', 20, 50, 50),
    ]);
    expect(mergedSeq).toHaveLength(2);
    expect(mergedSeq[0]).toMatchObject({ clipName: 'clip_intro', startFrame: 0, endFrame: 14 });
    expect(mergedSeq[1]).toMatchObject({ clipName: 'clip_out', startFrame: null, endFrame: null, isWholeClip: true });

    const adjacentPlan = planGraphAction(
      {
        kind: 'Sequencer',
        keyName: 'Spell',
        children: [
          atomic('clip_intro', 0, 14, 30),
          atomic('clip_out', 0, 19, 50),
          atomic('clip_out', 20, 50, 50),
        ],
      },
      { action: 'cast', entry: {} },
    );
    expect(adjacentPlan).toMatchObject({
      status: 'ok',
      castSequence: { in: 'clip_intro', main: 'clip_out' },
      clipRanges: { clip_intro: [0, 14 / 30] },
      clipSegments: {},
    });

    const splitSameClipPlan = planGraphAction(
      {
        kind: 'Sequencer',
        keyName: 'Spell',
        children: [
          atomic('combo_clip', 0, 12, 90),
          atomic('combo_clip', 24, 84, 90),
        ],
      },
      { action: 'cast', entry: {} },
    );
    expect(splitSameClipPlan).toMatchObject({
      status: 'ok',
      castSequence: { in: 'combo_clip@0-12', main: 'combo_clip@24-84' },
      clipRanges: {},
      clipSegments: {
        'combo_clip@0-12': ['combo_clip', 0, 0.4],
        'combo_clip@24-84': ['combo_clip', 0.8, 2.8],
      },
    });

    // 2. 2/3/4 stage mapping
    expect(mapStagesToSequence(['s1'])).toEqual({ sequence: { main: 's1' }, skipReason: null });
    expect(mapStagesToSequence(['s1', 's2'])).toEqual({ sequence: { in: 's1', main: 's2' }, skipReason: null });
    expect(mapStagesToSequence(['s1', 's2', 's3'])).toEqual({ sequence: { in: 's1', main: 's2', out: 's3' }, skipReason: null });
    expect(mapStagesToSequence(['s1', 's2', 's3', 's4'])).toEqual({
      sequence: { in: 's1', hold: 's2', main: 's3', out: 's4' },
      skipReason: null,
    });

    // 3. Parallel -> layers
    const parallelPlan = planGraphAction(
      {
        kind: 'Parallel',
        keyName: 'Spell',
        children: [
          atomic('body_cast', 0, 24, 60),
          atomic('overlay_fx', 6, 45, 60),
        ],
      },
      { action: 'cast', entry: {} },
    );
    expect(parallelPlan).toMatchObject({
      status: 'ok',
      castSequence: { main: 'body_cast', layers: ['overlay_fx'] },
      clipRanges: {
        body_cast: [0, 0.8],
        overlay_fx: [0.2, 1.5],
      },
    });

    // 4. Attack segments are untrimmed (#581)
    const attackPlan = planGraphAction(
      {
        kind: 'Sequencer',
        keyName: 'Attack1',
        children: [
          atomic('atk_start', 0, 9, 30),
          atomic('atk_hit', 0, 15, 45),
          atomic('atk_hit', 15, 45, 45),
          atomic('atk_end', 3, 21, 30),
        ],
      },
      { action: 'attack', entry: {} },
    );
    expect(attackPlan).toMatchObject({
      status: 'ok',
      attackSequence: { in: 'atk_start', main: 'atk_hit', out: 'atk_end' },
    });
    expect(attackPlan).not.toHaveProperty('clipRanges');
    expect(attackPlan).not.toHaveProperty('clipSegments');

    // 5. >4 segments skipped
    const fiveStagePlan = planGraphAction(
      {
        kind: 'Sequencer',
        keyName: 'Spell',
        children: [atomic('a'), atomic('b'), atomic('c'), atomic('d'), atomic('e')],
      },
      { action: 'cast', entry: {} },
    );
    expect(fiveStagePlan).toEqual({ status: 'skipped', reason: '段数>4 (5段)' });

    // 6. castVariants skipped
    const variantPlan = planGraphAction(
      atomic('spell_main'),
      {
        action: 'cast',
        entry: { castVariants: { rotate: ['spell_a', 'spell_b'] } },
      },
    );
    expect(variantPlan).toEqual({ status: 'skipped', reason: '需人工 (castVariants)' });
  });

  it('plans castVariants.hero from the original hero SpellObject graph node', () => {
    const atomic = (clipName: string, startFrame: number | null = null, endFrame: number | null = null, lastFrame = 84, fps = 30) => ({
      kind: 'Atomic', keyName: clipName, clipName, startFrame, endFrame,
      effectiveStartFrame: startFrame ?? 0, effectiveEndFrame: endFrame ?? lastFrame, lastFrame, fps,
    });
    const entry = {
      animations: { cast: 'champ_spell' },
      castSequence: { main: 'champ_spell' },
      castVariants: { hero: { main: 'champ_spellhero' } },
    };

    // Hero spell plays the same whole clip as the default cast: drop the variant entirely.
    const same = planHeroVariant(atomic('champ_spell'), { entry });
    expect(same).toMatchObject({ status: 'ok', changed: true, heroSequence: { main: 'champ_spell' }, requiredClips: ['champ_spell'] });
    expect(same.castVariants).toBeUndefined();

    // Other variants are kept when the hero variant is dropped.
    const withStar3 = planHeroVariant(atomic('champ_spell'), {
      entry: { ...entry, castVariants: { ...entry.castVariants, star3: { main: 'champ_spell3' } } },
    });
    expect(withStar3.castVariants).toEqual({ star3: { main: 'champ_spell3' } });

    // A different original hero clip replaces the hand-picked one.
    const other = planHeroVariant(atomic('champ_spell_alt'), { entry });
    expect(other).toMatchObject({ status: 'ok', changed: true, castVariants: { hero: { main: 'champ_spell_alt' } } });

    // Already matching: unchanged.
    expect(planHeroVariant(atomic('champ_spellhero'), { entry })).toMatchObject({ status: 'ok', changed: false, castVariants: entry.castVariants });

    // Unresolved hero animation (empty mAnimationName), no hero variant, trimmed clips and range conflicts stay manual.
    expect(planHeroVariant(null, { entry })).toEqual({ status: 'skipped', reason: '未解析' });
    expect(planHeroVariant(atomic('champ_spell'), { entry: { castSequence: { main: 'champ_spell' } } }))
      .toEqual({ status: 'skipped', reason: '无 castVariants.hero' });
    expect(planHeroVariant(atomic('champ_spell', 5, 40), { entry }))
      .toEqual({ status: 'skipped', reason: '需人工 (hero 片段带帧区间)' });
    expect(planHeroVariant(atomic('champ_spell'), { entry: { ...entry, clipRanges: { champ_spell: [0, 1] } } }))
      .toEqual({ status: 'skipped', reason: '需人工 (hero 整段与 clipRanges 冲突: champ_spell)' });
  });
});
