import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
// @ts-expect-error Offline JavaScript tooling has no declaration file.
import { abilityEntry, mapAbilities, mergeAbilityManifest } from '../scripts/assets3d/ability-icons.mjs';
// @ts-expect-error Offline JavaScript tooling has no declaration file.
import { fnv1a } from '../scripts/assets3d/bin.mjs';

const field = (hash: number, value: unknown) => ({ hash, value });
const character = (name: string, client: number) => ({ hash: fnv1a(name), type: fnv1a('TFTCharacterRecord'), fields: [
  field(fnv1a('mCharacterName'), name), field(0xe4e7426c, { kind: 'link', hash: client }),
] });
const definitions = { hero: { abilityId: 'hero-spell' }, missing: { abilityId: 'missing-spell' }, override: { abilityId: 'override-spell' }, noAbility: { abilityId: 'none' } };
const abilities = { 'hero-spell': {}, 'missing-spell': {}, 'override-spell': { icon: 'synthetic/direct.tex' } };

describe('14.24 ability mapping and UI delta merge (synthetic data only)', () => {
  it('follows the requested character client link, selects its ability field and reports missing references', () => {
    const document = { entries: [character('TFT13_Internal', 7), character('TFT13_Missing', 99),
      { hash: 8, fields: [field(0xdf0ad83b, 'synthetic/wrong-hero.tex')] },
      { hash: 7, fields: [field(3670089172, 'synthetic/portrait.tex'), field(0xdf0ad83b, 'synthetic/ability.tex')] },
    ] };
    const result = mapAbilities(definitions, abilities, Object.keys(definitions), { hero: { sourceName: 'tft13_internal' } }, document);
    expect(result).toEqual([
      { id: 'hero-spell', championId: 'hero', character: 'tft13_internal', source: 'synthetic/ability.tex' },
      { id: 'missing-spell', championId: 'missing', character: 'tft13_missing', source: null, reason: 'character-ability-icon-missing' },
      { id: 'override-spell', championId: 'override', character: 'tft13_override', source: 'synthetic/direct.tex' },
    ]);
    expect(mapAbilities(definitions, abilities, ['hero'], {}, document)[0].reason).toBe('character-record-missing');
  });

  it('hashes exact synthetic payload bytes, preserves unrelated live metadata, and merges idempotently', () => {
    const bytes = Buffer.from([0, 1, 2, 255]), entry = abilityEntry('hero-spell', 'synthetic/ability.tex', bytes);
    expect(entry).toMatchObject({ kind: 'ability', id: 'hero-spell', path: 'assets/s13/abilities/hero-spell.png', bytes: 4,
      sha256: createHash('sha256').update(bytes).digest('hex') });
    const base = { schemaVersion: 1, patch: '14.24', extra: { keep: true }, assets: [{ kind: 'augment', id: 'keep', path: 'synthetic/augment.png' }],
      unavailable: [{ kind: 'trait', id: 'keep-missing' }, { kind: 'ability', id: 'hero-spell' }] };
    const snapshot = structuredClone(base), specs = [{ id: 'hero-spell' }, { id: 'missing-spell' }];
    const missing = [{ kind: 'ability', id: 'missing-spell', reason: 'character-record-missing' }];
    const merged = mergeAbilityManifest(base, specs, [entry], missing);
    expect(base).toEqual(snapshot);
    expect(merged.assets).toEqual([...base.assets, entry]);
    expect(merged.unavailable).toEqual([base.unavailable[0], ...missing]);
    expect(merged.extra).toEqual(base.extra);
    expect(mergeAbilityManifest(merged, specs, [entry], missing)).toEqual(merged);
    expect(() => mergeAbilityManifest(base, specs, [entry], [])).toThrow('incomplete-ability-results');
    expect(() => mergeAbilityManifest(base, specs, [entry, entry], missing)).toThrow('invalid-ability-entry');
    expect(() => abilityEntry('../escape', 'synthetic', bytes)).toThrow('unsafe-ability-id');
  });
});
