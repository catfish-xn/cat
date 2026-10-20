/**
 * Player-facing augment names and icons. Content keeps its own `name` (the 24 W4 augments
 * carry the English client name there, and two first-tier names predate the client wording);
 * the UI shows the 14.24 zh_CN client name for every augment (user decision 2026-10-16).
 */
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { S13_P2_SOURCE } from '../simulation/content/s13-augments-p2-source';
import { S13_P3_SOURCE } from '../simulation/content/s13-p3-source';
import type { Effect } from '../simulation/strategy-types';
import { fillAbilityTemplate } from './ability-text';
import { AUGMENT_ZH_TEMPLATES } from './augment-zh';
import { describeEffect } from './effect-text';
import { S13_AUGMENT_ASSETS } from './s13-augment-asset-manifest';

const BASE = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const ICONS = new Map(S13_AUGMENT_ASSETS.map(asset => [asset.id, asset.path]));

/** zh_CN client names (cdragon 14.24 zh_cn.json), keyed by repo augment id. */
export const AUGMENT_ZH: Readonly<Record<string, string>> = Object.freeze({
  'manaflow-ii': '法力流 II', 'glass-cannon-ii': '玻璃大炮 II',
  'pumping-up-i': '打气 I', 'pumping-up-ii': '打气 II', 'pumping-up-iii': '打气 III',
  'bulky-buddies-i': '巨大伙伴 I', 'bulky-buddies-ii': '巨大伙伴 II', 'bulky-buddies-iii': '巨大伙伴 III',
  'placebo-plus': '安慰剂+', 'mentorship-i': '导师制 I', 'mentorship-ii': '导师制 II',
  'item-collector-i': '装备收集器 I', 'item-collector-ii': '装备收集器 II',
  'bronze-for-life-i': '终身黄铜 I', 'bronze-for-life-ii': '终身黄铜 II',
  'little-buddies': '小伙伴', backup: '后援', lineup: '列队', 'find-your-center': 'C位的觉悟',
  'built-different': '卓尔不群', 'blistering-strikes': '酷热打击', 'clockwork-accelerator': '发条增速器',
  'lone-hero': '孤胆英雄', 'climb-the-ladder-i': '攀登天梯 I', 'climb-the-ladder-ii': '攀登天梯 II',
  'inspiring-epitaph': '激昂墓志铭',
});

export const augmentDisplayName = (id: string): string => AUGMENT_ZH[id] ?? AUGMENT_DEFINITIONS[id]?.name ?? '未知强化';

export function augmentIconUrl(id: string): string | null {
  const path = ICONS.get(id);
  return path ? `${BASE}${path}` : null;
}

/** Inline icon markup for DOM labels; empty when not bundled (the text name remains). */
export function augmentIconHtml(id: string, size: number, className = 'augment-icon'): string {
  const url = augmentIconUrl(id);
  return url ? `<img class="${className}" data-augment="${id}" src="${url}" width="${size}" height="${size}" alt="" draggable="false" loading="lazy" decoding="async">` : '';
}

/**
 * Augments whose content `description` is player text: the first six authored ones, the economy/acquisition batch, and the
 * P2 batch (14.24 zh_cn client text with its source values already written in). The W4 batch's `description` is an
 * implementation note, so the choice card shows only the effect text for those.
 */
const AUTHORED_DESCRIPTION = new Set(['placebo', 'manaflow-i', 'glass-cannon-i', 'pumping-up-i', 'investment-strategy-i', 'bulky-buddies-i',
  'blinding-speed', 'portable-forge', 'radiant-relics', 'going-long', 'hedge-fund', 'investment-strategy-ii', ...Object.keys(S13_P2_SOURCE)]);
/**
 * P3 augments: the zh_cn client template (`augment-zh.ts`) filled with the rules' source values. Tokens match keys
 * case-insensitively as the client does; `@Key*100@` is the source fraction shown as a percent. Formatting only.
 */
function p3Description(id: string): string | null {
  const sources: Readonly<Record<string, { readonly values: Readonly<Record<string, number>> }>> = S13_P3_SOURCE;
  if (!Object.hasOwn(AUGMENT_ZH_TEMPLATES, id) || !Object.hasOwn(sources, id)) return null;
  const values: Record<string, number> = {};
  for (const [key, value] of Object.entries(sources[id].values)) { values[key.toLowerCase()] = value; values[`${key.toLowerCase()}*100`] = value * 100; }
  return fillAbilityTemplate(AUGMENT_ZH_TEMPLATES[id].replace(/@[^@<>\s]+@/g, token => token.toLowerCase()), values).text;
}
export const augmentPlayerDescription = (id: string): string | null =>
  p3Description(id) ?? (AUTHORED_DESCRIPTION.has(id) ? AUGMENT_DEFINITIONS[id]?.description ?? null : null);
/**
 * Effect lines of an augment for its card. Mechanics with no display text (they would print an internal code such as
 * `s13P2Augment`) are left out when the augment has a player description, which already says what they do.
 */
export function augmentEffectText(id: string): string {
  const effects: readonly Effect[] = AUGMENT_DEFINITIONS[id]?.effects ?? [], described = augmentPlayerDescription(id) !== null;
  return effects.filter(effect => !(described && effect.kind === 'mechanic' && describeEffect(effect) === effect.mechanic)).map(describeEffect).join('；');
}

/** Augment offer tier as the rules name it (pendingChoice.augmentTier); the in-game 银色/金色/彩色 wording. */
export const AUGMENT_TIER_TEXT: Readonly<Record<import('../simulation/augment-offers').AugmentTier, string>> = {
  silver: '银色', gold: '金色', prismatic: '彩色',
};
