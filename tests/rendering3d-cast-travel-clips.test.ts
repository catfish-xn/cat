import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAST_TRAVEL_CLIPS, castMovesBars, missingCastTravelClips } from '../src/rendering/three-mode/overhead-follow';

// #657: the cast clips whose travel the bars follow, listed by model and clip name (our own judgement, not original data).
describe('cast clips that move the bars', () => {
  it('is the reviewed list: Ambessa both branches, Smeech, Sevika punch branch only, Mel unchanged', () => {
    expect(CAST_TRAVEL_CLIPS).toEqual({
      ambessa: ['tft13_ambessa_spellfist_dash', 'tft13_ambessa_spellfist_throw', 'tft13_ambessa_spellchain_strike'],
      smeech: ['spell'],
      sevika: ['spell2_dash', 'spell2_punch', 'spell2_slam'],
      mel: ['spell1_dash.tft_set13_evolved', 'spell1_blast.tft_set13_evolved'],
    });
  });

  it('a cast moves the bars when any of its clips is listed for its model, and only then', () => {
    expect(castMovesBars('sevika', ['spell2_dash', 'spell2_punch', 'spell2_slam'])).toBe(true);
    expect(castMovesBars('sevika', ['spell1_activate', 'spell1_loop'])).toBe(false); // branch one
    expect(castMovesBars('sevika', ['spell3'])).toBe(false);
    expect(castMovesBars('smeech', ['spell'])).toBe(true);
    expect(castMovesBars('ziggs', ['spell'])).toBe(false); // same clip name, unlisted model
    for (const id of ['warwick', 'vi', 'rell', 'renni', 'leblanc', 'trundle', 'jinx', 'twitch']) expect(castMovesBars(id, ['spell'])).toBe(false);
    expect(castMovesBars('ambessa', undefined)).toBe(false);
    expect(castMovesBars(null, ['spell'])).toBe(false);
  });

  it('names the listed clips a loaded model lacks', () => {
    expect(missingCastTravelClips('sevika', [{ name: 'spell2_dash' }, { name: 'spell2_slam' }])).toEqual(['spell2_punch']);
    expect(missingCastTravelClips('ziggs', [])).toEqual([]);
  });

  // Every listed clip must be one the manifest plays on a cast of that model, so a renamed clip fails here. The manifest
  // lives in the asset root, not the repository: set ASSETS3D_ROOT to the asset root to run this check.
  const root = process.env.ASSETS3D_ROOT, manifestPath = root ? join(root, 'manifest.json') : '';
  it.skipIf(!root || !existsSync(manifestPath))('every listed clip is a cast clip of its model in the asset manifest', () => {
    type Sequence = string | { in?: string; hold?: string; main?: string | string[]; out?: string; layers?: string[] };
    const models = JSON.parse(readFileSync(manifestPath, 'utf8')).models as Record<string, { animations?: { cast?: string | null };
      castSequence?: Sequence; castVariants?: { rotate?: Sequence[]; branch?: Record<string, Sequence> } & Record<string, Sequence> }>;
    const clipsOf = (s: Sequence | undefined): string[] => !s ? [] : typeof s === 'string' ? [s]
      : [s.in, s.hold, ...(Array.isArray(s.main) ? s.main : [s.main]), s.out, ...(s.layers ?? [])].filter((c): c is string => !!c);
    for (const [id, listed] of Object.entries(CAST_TRAVEL_CLIPS)) {
      const model = models[id];
      expect(model, id).toBeDefined();
      const v = model!.castVariants ?? {};
      const cast = new Set([model!.animations?.cast ?? '', ...clipsOf(model!.castSequence), ...['star3', 'hero', 'front', 'back'].flatMap(k => clipsOf(v[k])),
        ...(v.rotate ?? []).flatMap(clipsOf), ...Object.values(v.branch ?? {}).flatMap(clipsOf)]);
      for (const clip of listed) expect(cast.has(clip), `${id} ${clip}`).toBe(true);
    }
  });
});
