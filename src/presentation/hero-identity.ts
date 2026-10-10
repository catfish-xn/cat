/**
 * Code-drawn hero identities (M7 P0-A). No bitmap assets: each hero = own color +
 * profession emblem shape + unique two-character Chinese short name. Shared by the
 * board, bench, shop, panels and replay so the same hero always looks the same.
 */
import { UNIT_DEFINITIONS } from '../simulation/units';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { NEUTRAL_DEFINITIONS } from '../simulation/content/neutrals';
import { displayUnitName } from '../rendering/display-names';
import { toNumber } from './theme';

export type EmblemShape = 'shield' | 'burst' | 'reticle' | 'lens' | 'hexstar' | 'hexagon';
export interface HeroIdentity {
  readonly id: string; readonly name: string; readonly short: string; readonly color: string; readonly colorNumber: number;
  readonly ink: string; readonly inkNumber: number; readonly shape: EmblemShape; readonly traitName: string; readonly cost: number;
  /** Neutral monsters have no shop cost or profession; their adapter cost=1 is a type placeholder only. */
  readonly neutral: boolean;
}

/** One muted color per monster family (presentation only). */
const FAMILY_COLOR: Readonly<Record<string, string>> = Object.freeze({
  minion: '#7d8a96', krug: '#8a6a4f', wolf: '#56708f', razorbeak: '#a85a48', 'elder-dragon': '#6a4fae', 'rift-herald': '#8a3f9e',
});

/** Profession → emblem shape. Unopened/neutral units use the plain hexagon. */
export const TRAIT_SHAPES: Readonly<Record<string, EmblemShape>> = Object.freeze({
  sentinel: 'shield', artillerist: 'burst', sniper: 'reticle', watcher: 'lens', sorcerer: 'hexstar',
});

/** The 19 purchasable S13 heroes. Colors are checked for pairwise distinctness in tests. */
export const HERO_STYLE: Readonly<Record<string, { short: string; color: string }>> = Object.freeze({
  irelia: { short: '艾瑞', color: '#7fb3e0' }, maddie: { short: '麦迪', color: '#e07fa8' }, darius: { short: '德莱', color: '#c0504d' },
  lux: { short: '拉克', color: '#fff4b0' }, zyra: { short: '婕拉', color: '#6fbf5a' }, tristana: { short: '崔丝', color: '#ff9f40' },
  urgot: { short: '厄加', color: '#7a9a3a' }, rell: { short: '芮尔', color: '#b8bfcc' }, leona: { short: '蕾欧', color: '#ffd166' },
  vander: { short: '范德', color: '#9a7a4a' }, kogmaw: { short: '克格', color: '#b6e03c' }, scar: { short: '斯卡', color: '#3fd69a' },
  ezreal: { short: '伊泽', color: '#5aa9ff' }, loris: { short: '洛里', color: '#7d86b8' }, nami: { short: '娜美', color: '#2fa3d6' },
  corki: { short: '库奇', color: '#e0703a' }, garen: { short: '盖伦', color: '#4f6fd0' }, zoe: { short: '佐伊', color: '#d58cff' },
  caitlyn: { short: '凯特', color: '#c99a6b' },
});

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const hexColor = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
const cache = new Map<string, HeroIdentity>();

export function getHeroIdentity(definitionId: string): HeroIdentity {
  const cached = cache.get(definitionId);
  if (cached) return cached;
  // Monsters classify from the authoritative neutral catalog (same source as the preview), never the cost-1 adapter.
  const monster = Object.hasOwn(NEUTRAL_DEFINITIONS, definitionId) ? NEUTRAL_DEFINITIONS[definitionId] : undefined, neutral = Boolean(monster);
  const definition = neutral ? undefined : UNIT_DEFINITIONS[definitionId];
  const style = HERO_STYLE[definitionId];
  const traitId = definition?.traits.find(id => TRAIT_SHAPES[id]) ?? definition?.traits[0];
  const color = style?.color ?? (monster ? FAMILY_COLOR[monster.monsterFamily] : undefined) ?? hexColor(definition?.color ?? 0x8899aa);
  const name = displayUnitName(definitionId);
  // Pick whichever ink has the higher WCAG contrast against the hero color.
  const ink = (luminance(color) + 0.05) / (luminance('#0b151f') + 0.05) >= 1.05 / (luminance(color) + 0.05) ? '#0b151f' : '#ffffff';
  const identity: HeroIdentity = Object.freeze({
    id: definitionId, name, short: style?.short ?? (neutral ? name.replace('峡谷', '').slice(0, 2) : definition?.symbol ?? name.slice(0, 2)), color, colorNumber: toNumber(color), ink, inkNumber: toNumber(ink),
    shape: (traitId && TRAIT_SHAPES[traitId]) || 'hexagon', traitName: neutral ? '野怪' : traitId ? TRAIT_DEFINITIONS[traitId]?.name ?? '本版本未开放' : '中立',
    cost: neutral ? 0 : definition?.cost ?? 1, neutral,
  });
  cache.set(definitionId, identity);
  return identity;
}

/**
 * Full S13 trait list per hero from the archived 14.24 client data
 * (src/simulation/content/source/s13-14.24.json). Only the five classes are playable in
 * this slice; origins and other classes are shown for identity and marked unopened.
 */
export const HERO_S13_TRAITS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  irelia: ['Rebel', 'Sentinel'], maddie: ['Enforcer', 'Sniper'], darius: ['Conqueror', 'Watcher'], lux: ['Academy', 'Sorcerer'],
  zyra: ['Experiment', 'Sorcerer'], tristana: ['Emissary', 'Artillerist'], urgot: ['Experiment', 'Pit Fighter', 'Artillerist'],
  rell: ['Conqueror', 'Sentinel', 'Visionary'], leona: ['Academy', 'Sentinel'], vander: ['Family', 'Watcher'], kogmaw: ['Automata', 'Sniper'],
  scar: ['Firelight', 'Watcher'], ezreal: ['Academy', 'Rebel', 'Artillerist'], loris: ['Enforcer', 'Sentinel'], nami: ['Emissary', 'Sorcerer'],
  corki: ['Scrap', 'Artillerist'], garen: ['Emissary', 'Watcher'], zoe: ['Rebel', 'Sorcerer'], caitlyn: ['Enforcer', 'Sniper'],
});
/**
 * Chinese client names for S13 双城之战2. Checked 2026-10-06 against the official 国服 14.23/14.24
 * TFT patch notes on lol.qq.com (e.g. 【铁血征服者】) and CN coverage of in-client trait text.
 * The client string table (CommunityDragon zh_cn.json) was unreachable at the time; recheck when it is.
 */
export const S13_TRAIT_ZH: Readonly<Record<string, string>> = Object.freeze({
  Sentinel: '哨兵', Artillerist: '炮手', Sniper: '狙神', Watcher: '监察', Sorcerer: '法师',
  Academy: '皮城学院', Automata: '海克斯机械', Conqueror: '铁血征服者', Emissary: '外交官', Enforcer: '执法官', Experiment: '试验品',
  Family: '家人', Firelight: '野火帮', Rebel: '蓝发小队', Scrap: '极客', 'Pit Fighter': '搏击手', Visionary: '先知',
});
const OPEN_TRAITS = new Set(['Sentinel', 'Artillerist', 'Sniper', 'Watcher', 'Sorcerer']);
export interface HeroTraitLabel { readonly name: string; readonly open: boolean }
/** Origin first, then classes, as in the TFT shop; unopened traits flagged. */
export function heroTraitLabels(definitionId: string): HeroTraitLabel[] {
  return (HERO_S13_TRAITS[definitionId] ?? []).map(id => ({ name: S13_TRAIT_ZH[id] ?? id, open: OPEN_TRAITS.has(id) }));
}
/** Opened profession names only (compact displays). */
export function heroTraitNames(definitionId: string): string[] {
  return (UNIT_DEFINITIONS[definitionId]?.traits ?? []).map(id => TRAIT_DEFINITIONS[id]?.name ?? '').filter(Boolean);
}

function star(points: number, outer: number, inner: number, rotation = -Math.PI / 2): [number, number][] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const radius = i % 2 ? inner : outer, angle = rotation + (i * Math.PI) / points;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}
/** Emblem outlines in a unit box [-1,1]², drawn identically by Phaser and SVG. */
export const EMBLEM_POINTS: Readonly<Record<EmblemShape, readonly (readonly [number, number])[]>> = Object.freeze({
  shield: [[-0.78, -0.82], [0.78, -0.82], [0.78, 0.12], [0, 0.95], [-0.78, 0.12]],
  burst: star(8, 1, 0.66),
  reticle: star(4, 1, 0.24),
  lens: [...Array.from({ length: 9 }, (_, i) => { const t = Math.PI * (i / 8); return [-Math.cos(t), -Math.sin(t) * 0.62] as [number, number]; }),
    ...Array.from({ length: 7 }, (_, i) => { const t = Math.PI * ((i + 1) / 8); return [Math.cos(t), Math.sin(t) * 0.62] as [number, number]; })],
  hexstar: star(6, 1, 0.56),
  hexagon: star(3, 0.92, 0.92, -Math.PI / 2),
});

/** Inline SVG emblem chip for DOM panels (shop, roster, choices). */
export function heroEmblemSvg(definitionId: string, size = 36): string {
  const identity = getHeroIdentity(definitionId);
  const points = EMBLEM_POINTS[identity.shape].map(([x, y]) => `${(50 + x * 30).toFixed(1)},${(50 + y * 30).toFixed(1)}`).join(' ');
  return `<svg class="hero-emblem" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">`
    + `<circle cx="50" cy="50" r="47" fill="${identity.color}" stroke="#0b151f" stroke-width="4"/>`
    + `<polygon points="${points}" fill="none" stroke="${identity.ink}" stroke-opacity=".35" stroke-width="6" stroke-linejoin="round"/>`
    + `<text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-size="27" font-weight="700" fill="${identity.ink}">${identity.short}</text></svg>`;
}
