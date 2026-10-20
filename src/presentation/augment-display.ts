/**
 * Player-facing augment names and icons. Content keeps its own `name` (the 24 W4 augments
 * carry the English client name there, and two first-tier names predate the client wording);
 * the UI shows the 14.24 zh_CN client name for every augment (user decision 2026-10-16).
 */
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { S13_AUGMENT_ASSETS } from './s13-augment-asset-manifest';
import { d11ChoiceDisplay } from '../simulation/d11-display';

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
 * The first six augments were authored with a player-facing description; the W4 batch's
 * `description` is an implementation note, so the choice card shows only the effect text.
 */
const AUTHORED_DESCRIPTION = new Set(['placebo', 'manaflow-i', 'glass-cannon-i', 'pumping-up-i', 'investment-strategy-i', 'bulky-buddies-i']);
/**
 * Player text of an augment: the authored description of the first six, and (v15 D11-DISPLAY) the rules' own display
 * description of 一费奉献 I / 三项赛 I / 灵魂连接 (d11ChoiceDisplay, the same text the private view's d11Display carries).
 */
export const augmentPlayerDescription = (id: string): string | null => AUTHORED_DESCRIPTION.has(id) ? AUGMENT_DEFINITIONS[id]?.description ?? null
  : d11ChoiceDisplay(id)?.description ?? null;

/** Augment offer tier as the rules name it (pendingChoice.augmentTier); the in-game 银色/金色/彩色 wording. */
export const AUGMENT_TIER_TEXT: Readonly<Record<import('../simulation/augment-offers').AugmentTier, string>> = {
  silver: '银色', gold: '金色', prismatic: '彩色',
};
