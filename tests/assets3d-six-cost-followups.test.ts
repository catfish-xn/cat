import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
// @ts-expect-error Pure Node utility.
import { skinBindings, selectAnimations } from '../scripts/assets3d/bin-bindings.mjs';
// @ts-expect-error Pure Node utility.
import { fnv1a } from '../scripts/assets3d/bin.mjs';

const obj = (type: string, values: Record<string, unknown>) => ({ type: fnv1a(type), fields: Object.entries(values).map(([k, value]) => ({ hash: fnv1a(k), value })) });
const material = (samplers: [string, string][]) => ({ ...obj('StaticMaterialDef', { samplerValues: samplers.map(([samplerName, textureName]) => obj('Sampler', { samplerName, textureName })) }), hash: fnv1a('cape') });
const skin = (hidden: string | string[] = 'EMPOWERED') => obj('SkinCharacterDataProperties', { skinMeshProperties: obj('Mesh', {
  texture: 'synthetic/body.tex', initialSubmeshToHide: hidden,
  materialOverride: [obj('Override', { submesh: 'Cape', material: { hash: fnv1a('cape') } }), obj('Override', { submesh: 'Empowered', material: { hash: fnv1a('missing') } })],
}) });
const bindings = (m: unknown, hidden?: string | string[]) => skinBindings([{ entries: [skin(hidden), m], patches: [] }], ['Body', 'Cape', 'Empowered']);

describe('six-cost converter followups (synthetic inputs only)', () => {
  it('resolves static hold diffuse and skips hidden material resolution case-insensitively', () => {
    for (const hidden of ['EMPOWERED', ['empowered']]) {
      const result = bindings(material([['DiffuseHold_Texture', 'synthetic/cape.tex']]), hidden);
      expect(result.textures).toEqual({ Body: 'synthetic/body.tex', Cape: 'synthetic/cape.tex' });
      expect(result.hidden).toEqual(['Empowered']);
    }
  });
  it('retains standard diffuse precedence and rejects missing or ambiguous visible textures', () => {
    expect(bindings(material([['DiffuseHold_Texture', 'synthetic/hold.tex'], ['Diffuse_Texture', 'synthetic/base.tex']])).textures.Cape).toBe('synthetic/base.tex');
    expect(() => bindings(material([['DiffuseHold_Texture', 'a.tex'], ['diffusehold_texture', 'b.tex']]))).toThrow('ambiguous-material-diffuse');
    expect(() => bindings(material([]))).toThrow('missing-material-diffuse');
    expect(() => bindings(material([['DiffuseHold_Texture', 'a.tex']]), '')).toThrow('missing-static-material');
  });
  it('reproduces death aliases, then disables hit without suppressing death or other heroes', async () => {
    const map = JSON.parse(await readFile(new URL('../scripts/assets3d/unit-map.json', import.meta.url), 'utf8'));
    for (const unit of ['warwick', 'viktor']) {
      const path = `synthetic/${unit}_death.tft_set13_evolved.anm`;
      const clips = ['Knockup', 'Death', 'Hit'].map(name => ({ atomic: true, hash: fnv1a(name), path, flags: 0 }));
      // The evolved suffix leaves a dot after death, bypassing the existing
      // underscore-delimited filename exclusion even though aliases resolve.
      const original = selectAnimations(clips, map.$animationRules);
      expect(original.mapped.hit).toBe(original.mapped.death);
      expect(map[unit].animations.hit).toBeNull();
      const result = selectAnimations(clips, map.$animationRules, map[unit].animations);
      expect(result.mapped).not.toHaveProperty('hit');
      expect(result.mapped.death).toBe(original.mapped.death);
      expect(result.files).toHaveProperty(`${unit}_death.tft_set13_evolved`, path);
      expect(result.decisions.hit.reason).toBe('unit-disabled-action');
    }
    const name = map.mel.animations.hit;
    expect(selectAnimations([{ atomic: true, hash: fnv1a('Hit'), path: `synthetic/${name}.anm` }], map.$animationRules, map.mel.animations).mapped.hit).toBe(name);
  });
});
