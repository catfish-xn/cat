import { describe, expect, it } from 'vitest';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';
import { HERO_STYLE, TRAIT_SHAPES, getHeroIdentity, heroEmblemSvg, EMBLEM_POINTS } from '../src/presentation/hero-identity';
import { THEME, costColor } from '../src/presentation/theme';

const heroes = Object.values(M5_UNIT_DEFINITIONS).filter(definition => !definition.id.startsWith('neutral'));
const rgb = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
const lum = (hex: string) => { const [r, g, b] = rgb(hex).map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('M7 hero identity (G01)', () => {
  it('covers exactly the 19 purchasable S13 heroes', () => {
    expect(heroes).toHaveLength(19);
    expect(Object.keys(HERO_STYLE).sort()).toEqual(heroes.map(hero => hero.id).sort());
  });
  it('short names are unique two-character Chinese labels', () => {
    const shorts = heroes.map(hero => getHeroIdentity(hero.id).short);
    expect(new Set(shorts).size).toBe(19);
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
      expect(identity.shape).toBe(TRAIT_SHAPES[hero.traits[0]]);
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
});
