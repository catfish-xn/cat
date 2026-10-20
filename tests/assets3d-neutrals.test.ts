import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertManifest } from '../src/rendering3d/contracts';
// @ts-expect-error Offline Node pipeline.
import { NEUTRAL_CONFIG, NEUTRAL_ACTION_RULES, parseNeutralConfig } from '../scripts/assets3d/neutral-config.mjs';
// @ts-expect-error Offline Node pipeline.
import { animationGraphClosure, neutralManifest } from '../scripts/assets3d/neutrals.mjs';
// @ts-expect-error Offline Node pipeline.
import { selectAnimations } from '../scripts/assets3d/bin-bindings.mjs';
// @ts-expect-error Offline Node pipeline.
import { fnv1a } from '../scripts/assets3d/bin.mjs';

const fake = () => [{ sourceName: 'sample_beast', ids: ['sample-large', 'sample-small'], height: 50 }];
const clip = (alias: string, file: string) => ({ hash: fnv1a(alias), atomic: true, flags: 0, path: `assets/sample/${file}.anm` });
describe('offline non-champion entry', () => {
  it('parses independent IDs and rejects ambiguous or unsafe configuration', () => {
    const input = fake(), parsed = parseNeutralConfig(input);
    expect(parsed).toEqual([{ ...input[0], animations: {} }]);
    parsed[0].ids.push('sample-extra'); expect(input[0].ids).toHaveLength(2);
    for (const value of [[], null, [{ ...fake()[0], height: 0 }], [...fake(), ...fake()],
      [{ ...fake()[0], sourceName: '../sample' }], [{ ...fake()[0], ids: ['sample-large', 'sample-large'] }]])
      expect(() => parseNeutralConfig(value)).toThrow();
    expect(() => parseNeutralConfig([{ ...fake()[0], animations: { spawn: 'sample_spawn' } }])).toThrow('invalid-neutral-animation');
  });
  it('maps standard neutral actions and preserves the original clip names', () => {
    const selected = selectAnimations([
      clip('Idle', 'sample_idle'), clip('Run', 'sample_run'), clip('Attack1', 'sample_attack1'),
      clip('Attack2', 'sample_attack2'), clip('Death', 'sample_death'), clip('Spawn', 'sample_spawn'),
    ], NEUTRAL_ACTION_RULES);
    expect(selected.mapped).toEqual({ idle: 'sample_idle', move: 'sample_run', attack: 'sample_attack1', cast: 'sample_attack2', death: 'sample_death' });
    expect(selectAnimations([clip('Spawn', 'sample_spawn')], NEUTRAL_ACTION_RULES).mapped.cast).toBe('sample_spawn');
    const shared = selectAnimations([clip('Unrelated', 'shared_breath')], { attack: NEUTRAL_ACTION_RULES.attack }, { attack: 'shared_breath' });
    expect(shared.mapped.attack).toBe('shared_breath');
    expect(selectAnimations([clip('Idle', 'sample_idle'), clip('Idle', 'other_idle')], NEUTRAL_ACTION_RULES).mapped.idle).toBeUndefined();
  });
  it('follows animation BIN links recursively, deduplicates cycles and fails missing dependencies', async () => {
    const docs: Record<string, { linked: string[]; entries: never[]; patches: never[] }> = {
      'data/sample/skin.bin': { linked: ['data/sample/animations/first.bin'], entries: [], patches: [] },
      'data/sample/animations/first.bin': { linked: ['data/shared/animations/second.bin'], entries: [], patches: [] },
      'data/shared/animations/second.bin': { linked: ['data/sample/animations/first.bin'], entries: [], patches: [] },
    };
    const seen: string[] = [];
    const load = async (p: string) => { seen.push(p); if (!docs[p]) throw new Error('missing-sample'); return docs[p]; };
    expect(await animationGraphClosure(['data/sample/skin.bin'], load)).toHaveLength(3);
    expect(seen).toHaveLength(3);
    await expect(animationGraphClosure(['data/sample/skin.bin'], load, 2)).rejects.toThrow('closure-budget');
    delete docs['data/shared/animations/second.bin'];
    await expect(animationGraphClosure(['data/sample/skin.bin'], load)).rejects.toThrow('missing-sample');
    docs['data/sample/skin.bin'].patches = [1] as never[];
    await expect(animationGraphClosure(['data/sample/skin.bin'], load)).rejects.toThrow('unsupported-binding-bin-patches');
  });
  it('emits the champion manifest schema for synthetic non-champion IDs', () => {
    const config = parseNeutralConfig(fake())[0];
    const manifest = neutralManifest([{ config, animations: { idle: 'sample_idle' } }], assertManifest);
    expect(manifest).toEqual({ schemaVersion: 1, effects: {}, models: {
      'sample-large': { path: 'models/sample-large/model.glb', animations: { idle: 'sample_idle' } },
      'sample-small': { path: 'models/sample-small/model.glb', animations: { idle: 'sample_idle' } },
    } });
    expect(() => neutralManifest([{ config, animations: { spawn: 'sample_spawn' } }], assertManifest)).toThrow('invalid-animation-map');
    expect(() => neutralManifest([{ config }, { config }], assertManifest)).toThrow('duplicate-neutral-id');
  });
  it('covers every project definition and every encounter without champion IDs', () => {
    // The real source is read as contract evidence; fixture data above stays synthetic.
    const definitions = readFileSync(new URL('../src/simulation/content/neutrals.ts', import.meta.url), 'utf8');
    const encounters = readFileSync(new URL('../src/simulation/content/neutral-encounters.ts', import.meta.url), 'utf8');
    const ids = [...definitions.matchAll(/neutral\('([^']+)'/g)].map(m => m[1]).sort();
    const configured = parseNeutralConfig(NEUTRAL_CONFIG).flatMap((c: { ids: string[] }) => c.ids).sort();
    expect(configured).toEqual(ids);
    const deployed = [...new Set([...encounters.matchAll(/slot\('[^']+', '([^']+)'/g)].map(m => m[1]))].sort();
    expect(configured).toEqual(deployed);
  });
});
