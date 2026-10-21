import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { describe, expect, it } from 'vitest';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';
import { HERO_STYLE, TRAIT_SHAPES, getHeroIdentity, heroEmblemSvg, EMBLEM_POINTS, HERO_S13_TRAITS, S13_TRAIT_ZH, S13_TRAIT_IDS, heroTraitTags } from '../src/presentation/hero-identity';
import { champions } from './fixtures/s13-source.cjs';
import { THEME, costColor } from '../src/presentation/theme';
import { heroPortraitHtml, s13AssetUrl } from '../src/presentation/s13-assets';
import { S13_ASSETS } from '../src/presentation/s13-asset-manifest';
import { g23ChampionAssets } from '../src/presentation/g23-display';

// Presentation ownership remains Claude's: preserve the 33 authored styles and test fallback for the new content.
// These six relationship traits require an augment; none is native to a hero.
const augmentOnlyTraits = ['sisters','mentorship','reunion','geniuses','menaces','unlikely-duo'];
const heroes = Object.values(M5_UNIT_DEFINITIONS).filter(definition => Object.hasOwn(HERO_STYLE, definition.id));
const rgb = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
const lum = (hex: string) => { const [r, g, b] = rgb(hex).map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('M7 hero identity (G01)', () => {
  it('preserves the 33 authored presentation styles', () => {
    expect(heroes).toHaveLength(33);
    expect(Object.keys(HERO_STYLE).sort()).toEqual(heroes.map(hero => hero.id).sort());
  });
  it('short names are unique two-character Chinese labels', () => {
    const shorts = heroes.map(hero => getHeroIdentity(hero.id).short);
    expect(new Set(shorts).size).toBe(33);
    for (const short of shorts) expect(short).toMatch(/^[一-鿿]{2}$/);
  });
  it('hero colors are pairwise distinguishable', () => {
    for (let i = 0; i < heroes.length; i++) for (let j = i + 1; j < heroes.length; j++) {
      const [a, b] = [getHeroIdentity(heroes[i].id).color, getHeroIdentity(heroes[j].id).color].map(rgb);
      const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      expect(distance, `${heroes[i].id}/${heroes[j].id}`).toBeGreaterThanOrEqual(45);
    }
  });
  it('emblem shape follows the opened profession and text keeps readable contrast', () => {
    for (const hero of heroes) {
      const identity = getHeroIdentity(hero.id);
      expect(identity.shape).toBe(TRAIT_SHAPES[hero.traits.find(id => TRAIT_SHAPES[id]) ?? ''] ?? 'hexagon');
      expect(contrast(identity.color, identity.ink), hero.id).toBeGreaterThanOrEqual(4.5);
      expect(heroEmblemSvg(hero.id)).toContain(identity.short);
    }
    expect(new Set(Object.values(TRAIT_SHAPES)).size).toBe(5);
    for (const points of Object.values(EMBLEM_POINTS)) for (const [x, y] of points) expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(1);
  });
  it('neutral and legacy units fall back without throwing', () => {
    expect(getHeroIdentity('neutral-stage-2').shape).toBe('hexagon');
    expect(getHeroIdentity('sentinel').short.length).toBeGreaterThan(0);
    expect(costColor(1)).toBe(THEME.cost[0]); expect(costColor(5)).toBe(THEME.cost[4]);
  });
  it('shows the real S13 origin and class traits from the archived 14.24 client data', () => {
    const archive = champions();
    for (const hero of heroes) {
      expect(HERO_S13_TRAITS[hero.id], hero.id).toEqual(archive[hero.id].traits);
      expect(archive[hero.id].cost, hero.id).toBe(hero.cost);
      for (const trait of archive[hero.id].traits) expect(S13_TRAIT_ZH[trait], trait).toBeTruthy();
      const open = heroTraitTags(hero.id).filter(label => label.open).map(label => label.name);
      const names:Record<string,string> = {...Object.fromEntries(Object.values(TRAIT_DEFINITIONS).map(t=>[t.id,t.name])),...Object.fromEntries(Object.entries(S13_TRAIT_IDS).map(([name,id])=>[id,S13_TRAIT_ZH[name]])), 'form-swapper':'双形战士'};
      expect(Object.keys(TRAIT_DEFINITIONS)).toHaveLength(35);
      expect(open.sort()).toEqual(hero.traits.filter(id => Object.hasOwn(TRAIT_DEFINITIONS, id)).map(id => names[id]).sort());
    }
  });
  it('v20: opens every native trait for all 63 heroes; relationship traits require augments', () => {
    const names:Record<string,string> = {...Object.fromEntries(Object.values(TRAIT_DEFINITIONS).map(t=>[t.id,t.name])),...Object.fromEntries(Object.entries(S13_TRAIT_IDS).map(([name,id])=>[id,S13_TRAIT_ZH[name]])), 'form-swapper':'双形战士'};
    const observed = new Set<string>();
    expect(Object.values(M5_UNIT_DEFINITIONS)).toHaveLength(63);
    for (const hero of Object.values(M5_UNIT_DEFINITIONS)) {
      const expected = hero.traits.filter(id => Object.hasOwn(TRAIT_DEFINITIONS, id));
      expected.forEach(id => observed.add(id));
      expect(heroTraitTags(hero.id).filter(tag => tag.open).map(tag => tag.name).sort(), hero.id)
        .toEqual(expected.map(id => names[id]).sort());
    }
    expect([...observed].sort()).toEqual(Object.keys(TRAIT_DEFINITIONS).filter(id=>!augmentOnlyTraits.includes(id)).sort()); // Augment-gated relationship traits are absent from the native roster.
  });
  it('falls back to the code-drawn emblem for any hero without a bundled official icon', () => {
    for (const hero of Object.values(M5_UNIT_DEFINITIONS)) {
      // G2-3 heroes take their portrait from the G2-3 icon manifest (s13-g23-manifest.ts) instead.
      const bundled = S13_ASSETS.some(asset => asset.kind === 'champion' && asset.id === hero.id) || g23ChampionAssets().some(asset => asset.id === hero.id);
      expect(s13AssetUrl('champion', hero.id) !== null).toBe(bundled);
      const html = heroPortraitHtml(hero.id, 34, heroEmblemSvg(hero.id, 34));
      expect(html.startsWith(bundled ? '<img' : '<svg')).toBe(true);
    }
    for (const asset of S13_ASSETS) expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
