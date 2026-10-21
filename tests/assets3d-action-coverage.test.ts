import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
// @ts-expect-error Pure Node utility.
import { selectAnimations } from '../scripts/assets3d/bin-bindings.mjs';
// @ts-expect-error Pure Node utility.
import { fnv1a } from '../scripts/assets3d/bin.mjs';

const map = JSON.parse(await readFile(new URL('../scripts/assets3d/unit-map.example.json', import.meta.url), 'utf8'));
const rules = map.$animationRules;
const clip = (name: string, alias = name) => ({ hash: fnv1a(alias), atomic: true, flags: 0, path: `${name}.anm` });

describe('source-grounded cast and hit coverage', () => {
  it('selects entry segments over exits, sustained poses, attacks and later phases', () => {
    for (const [names, expected] of [
      [['hero_spell1_in', 'hero_spell1_out'], 'hero_spell1_in'],
      [['hero_spell_start', 'hero_spell_loop', 'hero_spell_end'], 'hero_spell_start'],
      [['hero_spell_intro', 'hero_spell_finish_in'], 'hero_spell_intro'],
      [['hero_spell_first', 'hero_spell_shoot', 'hero_spell_shoot_90'], 'hero_spell_first'],
      [['hero_spell2_in', 'hero_spell3_in'], 'hero_spell2_in'],
      [['hero_spell1_activate', 'hero_spell4_activate'], 'hero_spell1_activate'],
      [['hero_spell_3', 'hero_spell_out'], 'hero_spell_3'],
      [['spellup', 'spellout'], 'spellup'],
      [['hero_spell_brace', 'hero_spell_brace_loop'], 'hero_spell_brace'],
      [['hero_spell3', 'hero_spell3_front_start', 'hero_spell3_back_start'], 'hero_spell3'],
      [['hero_spell1a'], 'hero_spell1a'], [['hero_ability'], 'hero_ability'],
      [['hero_cast_primary'], 'hero_cast_primary'], [['hero_channel'], 'hero_channel'],
      [['hero_ult_start'], 'hero_ult_start'],
    ] as [string[], string][]) expect(selectAnimations(names.map(n => clip(n)), rules).mapped.cast).toBe(expected);
  });
  it('reports absence and ambiguity instead of inventing an action', () => {
    const absent = selectAnimations(['idle1', 'run', 'attack1', 'death'].map(n => clip(n)), rules);
    expect(absent.mapped.cast).toBeUndefined(); expect(absent.mapped.hit).toBeUndefined();
    expect(absent.decisions.cast.sourceStatus).toBe('no-source-action');
    expect(absent.decisions.hit.sourceStatus).toBe('no-source-action');
    const ambiguous = selectAnimations(['a_spell1', 'b_spell1'].map(n => clip(n)), rules);
    expect(ambiguous.mapped.cast).toBeUndefined();
    expect(ambiguous.decisions.cast).toMatchObject({ reason: 'ambiguous-action', sourceStatus: 'undetermined' });
    const sustained = selectAnimations(['hero_spell4_idle', 'hero_spell4_run'].map(n => clip(n)), rules);
    expect(sustained.mapped.cast).toBeUndefined(); expect(sustained.decisions.cast.sourceStatus).toBe('undetermined');
    const nonAtomic = selectAnimations([{ ...clip('spell1', 'Spell1'), atomic: false, path: null }], rules);
    expect(nonAtomic.decisions.cast.sourceStatus).toBe('undetermined');
  });
  it('maps genuine reactions but rejects attack hits, spell hits and Knockup aliases reusing death ANM', () => {
    for (const name of ['hero_hit', 'hero_hurt', 'hero_flinch', 'hero_knockup'])
      expect(selectAnimations([clip(name)], rules).mapped.hit).toBe(name);
    for (const name of ['hero_spell1_hit', 'hero_spellfist_hit', 'hero_attack1_hit', 'hero_ability_hit', 'hero_cast_hit']) {
      expect(selectAnimations([clip(name)], rules).mapped.hit).toBeUndefined();
      expect(selectAnimations([clip(name, 'Hit')], rules).mapped.hit).toBeUndefined();
    }
    const knocked = selectAnimations([clip('hero_death', 'Knockup')], rules);
    expect(knocked.mapped.hit).toBeUndefined(); expect(knocked.decisions.hit.sourceStatus).toBe('no-source-action');
  });
  it('honors explicit unit selections only when that actual eligible atomic file exists', () => {
    const clips = ['demo_spell1_spin', 'demo_spell1_catch'].map(n => clip(n));
    expect(selectAnimations(clips, rules).mapped.cast).toBeUndefined();
    const selected = selectAnimations(clips, rules, map.draven.animations);
    expect(selected.mapped.cast).toBe('demo_spell1_spin');
    expect(selected.decisions.cast.method).toBe('unit-explicit');
    expect(map.draven.animationNotes.cast).toContain('Demo_Spell1_Catch');
    const missing = selectAnimations(clips, rules, { cast: 'not_in_graph' });
    expect(missing.mapped.cast).toBeUndefined(); expect(missing.decisions.cast.sourceStatus).toBe('undetermined');
    expect(selectAnimations([clip('hero_death')], rules, { hit: 'hero_death' }).mapped.hit).toBeUndefined();
  });
});
