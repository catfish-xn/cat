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
import { readAugmentText, augmentTextPlaceholder } from './augment-text-loader';
import { describeEffect } from './effect-text';
import { rootAugmentIconUrl } from './s13-assets';
import { d11ChoiceDisplay } from '../simulation/d11-display';
import { V20_TRAITS, TEAMUP_IDS } from '../simulation/content/v20-traits';
import { getHeroIdentity } from './hero-identity';
import { traitSummary } from './trait-text';

const BASE = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';


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
  mentorship: '羁绊：军事管制', reunion: '羁绊：重新联合', geniuses: '羁绊：天才',
  menaces: '羁绊：危险人物', 'unlikely-duo': '羁绊：意外搭档', sisters: '羁绊：姐妹',
});

export const augmentDisplayName = (id: string): string => {
  const name = AUGMENT_ZH[id] ?? AUGMENT_DEFINITIONS[id]?.name;
  if (name !== id) return name ?? '未知强化';
  const data = readAugmentText();
  return data?.AUGMENT_POOL_TEXT[id]?.name ?? data?.AUGMENT_EXTRA_TEXT[id]?.name ?? '强化名称加载中…';
};

/** Bundled icon, else one the 3D asset root's ui-assets.json carries (kind `augment`), else null. */
export function augmentIconUrl(id: string): string | null {
  const path = readAugmentText()?.S13_AUGMENT_ASSETS.find(asset => asset.id === id)?.path;
  return path ? `${BASE}${path}` : rootAugmentIconUrl(id);
}

/** Inline icon markup for DOM labels; empty when not bundled (the text name remains). */
export function augmentIconHtml(id: string, size: number, className = 'augment-icon'): string {
  const url = augmentIconUrl(id);
  return url ? `<img class="${className}" data-augment="${id}" src="${url}" width="${size}" height="${size}" alt="" draggable="false" loading="lazy" decoding="async">` : '';
}

/**
 * Inline icon, or (no bundled icon) a small lettered badge in the icon's place, for icon-only rows such as the owned
 * augment strip, where an empty string would leave a bare name among the icons.
 */
export function augmentIconOrBadgeHtml(id: string, size: number): string {
  return augmentIconHtml(id, size) || `<span class="augment-icon augment-badge" data-augment="${id}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.5)}px" aria-hidden="true">${[...augmentDisplayName(id)][0] ?? '?'}</span>`;
}

/** Team-up augments (v19 姐妹, v20 关系): the two champions they grant, by repo unit id. */
const TEAMUP_PARTNERS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  sisters: ['vi', 'jinx'], ...Object.fromEntries(TEAMUP_IDS.map(id => [id, V20_TRAITS[id].partners])),
});
/** What a team-up augment grants, then its trait's official zh_cn text (with the project's 魔改 note) once both are on the board. */
function teamupDescription(id: string): string | null {
  const partners = TEAMUP_PARTNERS[id], text = Object.hasOwn(TEAMUP_PARTNERS, id) ? traitSummary(id) : null;
  if (!partners || !text) return null;
  const [a, b] = partners.map(unit => `【${getHeroIdentity(unit).name}】`);
  return `获得${a}和${b}。两者同时在场时激活【${augmentDisplayName(id)}】：${text}`;
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
  const AUGMENT_ZH_TEMPLATES = readAugmentText()?.AUGMENT_ZH_TEMPLATES;
  if (!AUGMENT_ZH_TEMPLATES) return null;
  const sources: Readonly<Record<string, { readonly values: Readonly<Record<string, number>> }>> = S13_P3_SOURCE;
  if (!Object.hasOwn(AUGMENT_ZH_TEMPLATES, id) || !Object.hasOwn(sources, id)) return null;
  const values: Record<string, number> = {};
  for (const [key, value] of Object.entries(sources[id].values)) { values[key.toLowerCase()] = value; values[`${key.toLowerCase()}*100`] = value * 100; }
  return fillAbilityTemplate(AUGMENT_ZH_TEMPLATES[id].replace(/@[^@<>\s]+@/g, token => token.toLowerCase()), values).text;
}
// v15 D11 choices use the rules' display text; other augments retain the P2/P3 player descriptions.
export const augmentPlayerDescription = (id: string): string | null => {
  const data = readAugmentText();
  if (!data) return augmentTextPlaceholder();
  if (Object.hasOwn(data.AUGMENT_POOL_TEXT, id)) return data.AUGMENT_POOL_TEXT[id].description;
  if (Object.hasOwn(data.AUGMENT_EXTRA_TEXT, id)) return data.AUGMENT_EXTRA_TEXT[id].description;
  return d11ChoiceDisplay(id)?.description ?? p3Description(id) ?? teamupDescription(id) ?? (AUTHORED_DESCRIPTION.has(id) ? AUGMENT_DEFINITIONS[id]?.description ?? null : null);
};
/**
 * Effect lines of an augment for its card. Mechanics with no display text (they would print an internal code such as
 * `s13P2Augment`) are left out when the augment has a player description, which already says what they do; so is the
 * one-off gold (`acquisitionGold`), which every such description already states (对冲基金, 安慰剂: no gold twice).
 */
export function augmentEffectText(id: string): string {
  const effects: readonly Effect[] = AUGMENT_DEFINITIONS[id]?.effects ?? [], described = augmentPlayerDescription(id) !== null;
  return effects.filter(effect => !(described && effect.kind === 'mechanic' && (describeEffect(effect) === effect.mechanic || effect.mechanic === 'acquisitionGold'))).map(describeEffect).join('；');
}

/**
 * The choice card's two text areas, as the original card sets them: the effect description, then the extra notes in
 * their own block (the project's 魔改执行 note of a team-up, and the effect lines once a description already says what the
 * augment does). Without a description the effect lines are the description. Formatting only: the text is the same.
 */
export function augmentCardSections(id: string): { readonly body: string; readonly extra: readonly string[] } {
  const description = augmentPlayerDescription(id), effects = augmentEffectText(id);
  if (!description) return { body: effects, extra: [] };
  const cut = description.indexOf(' 魔改执行：');
  const body = cut < 0 ? description : description.slice(0, cut), note = cut < 0 ? '' : description.slice(cut + 1);
  return { body, extra: [note, effects].filter(Boolean) };
}

/** Augment offer tier as the rules name it (pendingChoice.augmentTier); the in-game 银色/金色/彩色 wording. */
export const AUGMENT_TIER_TEXT: Readonly<Record<import('../simulation/augment-offers').AugmentTier, string>> = {
  silver: '银色', gold: '金色', prismatic: '彩色',
};
