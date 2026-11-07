/**
 * G2-3 player-facing names and icons (user decision 2026-10-16: the UI always shows the 14.24 zh_CN client name;
 * content keeps its own `name`). Tables are keyed by the client apiName (s13-g23-manifest.ts). G2-3 content ids are
 * not fixed yet, so a content id is bridged to its apiName here, and every lookup falls back to the content name when
 * nothing matches — an unmatched id never breaks a label, it just keeps the content wording.
 *
 * Bridge, in order:
 *  1. Heroes: the candidate ids Codex listed in docs/evidence/g2-3/RECONCILIATION.md (renata … swain).
 *  2. Any kind: the id spelled from the apiName (`TFT13_GoopBuff_HardenedMind` → itself, `tft13_goopbuff_hardenedmind`,
 *     `hardenedmind`, `hardened-mind`).
 *  3. Traits / anomalies: the existing content convention, id = English client name in lower case, words joined by
 *     `-` (`titanic-strikes`, `mage-armor`, `kill-streak` already follow it) or joined without separator.
 *  4. Units: the content definition's `name` equals the English client name (G2-1/G2-2 heroes are authored that way);
 *     items: the content definition's `apiName`.
 */
import { UNIT_DEFINITIONS } from '../simulation/units';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';
import { G23_ANOMALY_SOURCE } from '../simulation/content/g2-3-anomaly-source';
import { S13_P3_SOURCE } from '../simulation/content/s13-p3-source';
import { D11_FILL_SOURCE } from '../simulation/content/d11-fill-source';
import { fillAbilityTemplate } from './ability-text';
import { ITEM_DEFINITIONS } from '../simulation/content/g2-3-item-registry';
import { portableAnomalyId } from '../simulation/content/augment-pool-batch5-r2';
import { G23_ANOMALIES, G23_CHAMPIONS, S13_EXTRA_ANOMALIES, G23_ICONS, G23_LOOT, G23_RADIANT_ITEMS, G23_TRAITS, G24_SUPPORT_ITEMS, g23IconPath, type G23IconKind, type G23Name } from './s13-g23-manifest';

const BASE = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const iconIndex = new Set(Object.entries(G23_ICONS).flatMap(([kind, apiNames]) => apiNames.map(apiName => `${kind}:${apiName}`)));
const assetUrl = (kind: G23IconKind, apiName: string | undefined): string | null =>
  apiName && iconIndex.has(`${kind}:${apiName}`) ? `${BASE}${g23IconPath(kind, apiName)}` : null;

/** Candidate content ids from RECONCILIATION.md (`候选ID`). Swain's id is already `swain` in content. */
export const G23_HERO_IDS: Readonly<Record<string, string>> = Object.freeze({
  renata: 'TFT13_RenataGlasc', silco: 'TFT13_Silco', drmundo: 'TFT13_DrMundo', cassiopeia: 'TFT13_Cassiopeia', elise: 'TFT13_Elise',
  jayce: 'TFT13_Jayce', smeech: 'TFT13_Gremlin', sevika: 'TFT13_Lieutenant', renni: 'TFT13_Chainsaw', nunu: 'TFT13_NunuWillump',
  gangplank: 'TFT13_Gangplank', swain: 'TFT13_Swain',
});

/** Client trait lists (en_us.json TFTSet13, origin first as in the shop) for the 12 G2-3 heroes. */
export const G23_HERO_TRAITS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  TFT13_RenataGlasc: ['Chem-Baron', 'Visionary'], TFT13_Cassiopeia: ['Black Rose', 'Dominator'], TFT13_NunuWillump: ['Experiment', 'Bruiser', 'Visionary'],
  TFT13_Chainsaw: ['Chem-Baron', 'Bruiser'], TFT13_Gremlin: ['Chem-Baron', 'Ambusher'], TFT13_DrMundo: ['Experiment', 'Dominator'],
  TFT13_Elise: ['Black Rose', 'Form Swapper', 'Bruiser'], TFT13_Silco: ['Chem-Baron', 'Dominator'], TFT13_Lieutenant: ['High Roller', 'Chem-Baron', 'Pit Fighter'],
  TFT13_Swain: ['Conqueror', 'Form Swapper', 'Sorcerer'], TFT13_Jayce: ['Academy', 'Form Swapper'], TFT13_Gangplank: ['Scrap', 'Form Swapper', 'Pit Fighter'],
});

/**
 * Emblem short names and colors for the 12 heroes (presentation only, used until the portrait loads or if it fails).
 * Colors keep the G2-2 rule: RGB distance >= 52 from every other hero color and >= 4.6 contrast with their ink.
 */
export const G23_HERO_STYLE: Readonly<Record<string, { short: string; color: string }>> = Object.freeze({
  TFT13_RenataGlasc: { short: '烈娜', color: '#10a0a0' }, TFT13_Cassiopeia: { short: '卡西', color: '#40e858' }, TFT13_NunuWillump: { short: '努努', color: '#1058b8' },
  TFT13_Chainsaw: { short: '荏妮', color: '#705810' }, TFT13_Gremlin: { short: '史密', color: '#58b810' }, TFT13_DrMundo: { short: '蒙多', color: '#8840a0' },
  TFT13_Elise: { short: '伊莉', color: '#b828b8' }, TFT13_Silco: { short: '希尔', color: '#587070' }, TFT13_Lieutenant: { short: '塞薇', color: '#a08888' },
  TFT13_Swain: { short: '斯维', color: '#2810b8' }, TFT13_Jayce: { short: '杰斯', color: '#10d0b8' }, TFT13_Gangplank: { short: '普朗', color: '#10d058' },
});

const lower = (value: string) => value.toLowerCase();
/** Ids spelled from an apiName: as is, lower case, and without the `TFTn_` / `TFTn_GoopBuff_` prefix (joined or kebab-case). */
const apiForms = (apiName: string) => {
  const bare = apiName.replace(/^TFT\d*_(GoopBuff_)?/, '');
  return [apiName, lower(apiName), lower(bare), lower(bare.replace(/([a-z0-9])([A-Z])/g, '$1-$2'))];
};
const nameForms = (en: string) => {
  const words = lower(en).replace(/[^a-z0-9 -]/g, '').split(/[\s-]+/).filter(Boolean);
  return [words.join('-'), words.join('')];
};
function bridge<T extends G23Name>(rows: readonly T[], forms: (row: T) => readonly string[]): ReadonlyMap<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) for (const form of forms(row)) if (!map.has(form)) map.set(form, row);
  return map;
}

const HEROES = G23_CHAMPIONS.filter(row => !row.summon), SUMMONS = G23_CHAMPIONS.filter(row => row.summon);
const CHAMPION_BY_API = new Map(G23_CHAMPIONS.map(row => [row.apiName, row]));
const CHAMPION_BY_ID = bridge(G23_CHAMPIONS, row => apiForms(row.apiName));
const CHAMPION_BY_EN = new Map(G23_CHAMPIONS.map(row => [row.en, row]));
const TRAIT_BY_ID = bridge(G23_TRAITS, row => [...apiForms(row.apiName), ...nameForms(row.en)]);
const TRAIT_BY_EN = new Map(G23_TRAITS.map(row => [row.en, row]));
const ALL_ANOMALIES = [...G23_ANOMALIES, ...S13_EXTRA_ANOMALIES];
const ANOMALY_BY_ID = bridge(ALL_ANOMALIES, row => [...apiForms(row.apiName), ...nameForms(row.en)]);
const ANOMALY_BY_ZH = new Map(ALL_ANOMALIES.map(row => [row.zh, row]));
const RADIANT_BY_BASE = new Map(G23_RADIANT_ITEMS.map(row => [row.base, row]));
const LOOT_API_NAMES = new Set(G23_LOOT.map(row => row.apiName));
const ITEM_NAMES = new Map<string, G23Name>([...G23_RADIANT_ITEMS, ...G23_LOOT, ...G24_SUPPORT_ITEMS].map(row => [row.apiName, row]));

/** Summons the rules create with their own ids (v20 危险人物's 畸变体 reuses Silco's monstrosity portrait). */
const G23_SUMMON_IDS: Readonly<Record<string, string>> = Object.freeze({ 'v20-silco-minion': 'TFT13_Silco_Monstrosity' });
/** apiName of a G2-3 hero or summon by content id; undefined for everything else. */
export function g23ChampionApiName(id: string): string | undefined {
  if (Object.hasOwn(G23_HERO_IDS, id)) return G23_HERO_IDS[id];
  if (Object.hasOwn(G23_SUMMON_IDS, id)) return G23_SUMMON_IDS[id];
  // Ranged form definitions (`elise-ranged`, g2-3-forms.ts) carry the hero's client name.
  if (id.endsWith('-ranged') && Object.hasOwn(G23_HERO_IDS, id.slice(0, -7))) return G23_HERO_IDS[id.slice(0, -7)];
  const direct = CHAMPION_BY_ID.get(id) ?? CHAMPION_BY_ID.get(lower(id));
  if (direct) return direct.apiName;
  const en = UNIT_DEFINITIONS[id]?.name;
  return en ? CHAMPION_BY_EN.get(en)?.apiName : undefined;
}
export function g23TraitApiName(id: string): string | undefined {
  return (TRAIT_BY_ID.get(id) ?? TRAIT_BY_ID.get(lower(id)))?.apiName;
}
export function g23AnomalyApiName(id: string): string | undefined {
  const row = ANOMALY_BY_ID.get(id) ?? ANOMALY_BY_ID.get(lower(id));
  if (row) return row.apiName;
  const name = Object.hasOwn(ANOMALY_DEFINITIONS, id) ? ANOMALY_DEFINITIONS[id].name : undefined;
  const zh = name ? ANOMALY_BY_ZH.get(name)?.apiName : undefined;
  if (zh) return zh;
  // v15 D11 anomalies (贪财化身, 猎头者) keep their client api name in the D11 source table.
  const d11 = (D11_FILL_SOURCE as Readonly<Record<string, { readonly kind: string; readonly apiName: string }>>)[id];
  return d11?.kind === 'anomaly' ? d11.apiName : undefined;
}

/** zh_CN client name of a G2-3 hero/summon content id; undefined when not a G2-3 unit or the client has no string. */
/** zh_cn name of a 14.24 champion apiName (reward tables name champions by apiName). */
export const g23ChampionNameByApi = (api: string): string | undefined => CHAMPION_BY_API.get(api)?.zh ?? undefined;
export const g23UnitName = (id: string): string | undefined => CHAMPION_BY_API.get(g23ChampionApiName(id) ?? '')?.zh ?? undefined;
export const g23TraitName = (id: string): string | undefined => {
  const api = g23TraitApiName(id);
  return api ? G23_TRAITS.find(row => row.apiName === api)?.zh ?? undefined : undefined;
};
/** zh_CN client name by English client trait name (HERO_S13_TRAITS uses English names). */
export const g23TraitNameByEn = (en: string): string | undefined => TRAIT_BY_EN.get(en)?.zh ?? undefined;
/** Content trait id carrying an English client trait name, when content has one (bridge rules 2–3). */
export function contentTraitIdByEn(en: string): string | undefined {
  const row = TRAIT_BY_EN.get(en);
  return row ? Object.keys(TRAIT_DEFINITIONS).find(id => g23TraitApiName(id) === row.apiName) : undefined;
}
export const g23HeroTraits = (id: string): readonly string[] | undefined => G23_HERO_TRAITS[g23ChampionApiName(id) ?? ''];
export const g23HeroStyle = (id: string): { short: string; color: string } | undefined => G23_HERO_STYLE[g23ChampionApiName(id) ?? ''];

/** Anomaly label: client name, else the content name. */
export function anomalyDisplayName(id: string): string {
  const api = g23AnomalyApiName(id);
  return (api ? ALL_ANOMALIES.find(row => row.apiName === api)?.zh : undefined)
    ?? (Object.hasOwn(ANOMALY_DEFINITIONS, id) ? ANOMALY_DEFINITIONS[id].name : undefined) ?? '未知异常';
}
/**
 * Anomaly player text: the 14.24 zh_cn client description with the source values filled in (`@Key*100@` is the source
 * fraction shown as a percent, as the client does), else the content description. The content `description` of G2-3
 * anomalies is the English client string and stays as it is (it is part of the content digest).
 */
export function anomalyPlayerDescription(id: string): string {
  const sources: Readonly<Record<string, { readonly zhDescription: string; readonly values: Readonly<Record<string, number>> }>> = G23_ANOMALY_SOURCE;
  const p3Sources: Readonly<Record<string, { readonly description: string; readonly values: Readonly<Record<string, number>> }>> = S13_P3_SOURCE;
  const source = Object.hasOwn(sources, id) ? sources[id]
    : Object.hasOwn(ANOMALY_DEFINITIONS, id) && Object.hasOwn(p3Sources, id)
      ? { zhDescription: p3Sources[id].description, values: p3Sources[id].values } : undefined;
  if (!source) return Object.hasOwn(ANOMALY_DEFINITIONS, id) ? ANOMALY_DEFINITIONS[id].description : '';
  const values: Record<string, number> = {};
  for (const [key, value] of Object.entries(source.values)) { values[key] = value; values[`${key}*100`] = value * 100; }
  // `%i:scale…%` are inline stat icons next to the stat's own word; dropped so the word is not repeated.
  return fillAbilityTemplate(source.zhDescription.replace(/%i:[A-Za-z]+%/g, ''), values).text;
}
/** The client shows every anomaly with the one shared anomaly icon (no per-anomaly icon exists in 14.24). */
export const anomalyIconUrl = (): string | null => assetUrl('anomalies', 'TFT13_GoopItem_Icon');
export function anomalyIconHtml(size: number, className = 'anomaly-icon'): string {
  const url = anomalyIconUrl();
  return url ? `<img class="${className}" src="${url}" width="${size}" height="${size}" alt="" draggable="false" loading="lazy" decoding="async">` : '';
}

/**
 * Item label: client name for the G2-3 radiant and reward items and the G2-4b support items (matched by the content
 * `apiName`), else the content name. Existing items keep their content names, which already follow the client.
 */
export function itemDisplayName(id: string): string {
  const definition = Object.hasOwn(ITEM_DEFINITIONS, id) ? ITEM_DEFINITIONS[id] : undefined;
  const anomaly = definition && portableAnomalyId(id);
  if (anomaly) return `便携异常点：${anomalyDisplayName(anomaly)}`;
  return (definition?.apiName ? ITEM_NAMES.get(definition.apiName)?.zh : undefined) ?? definition?.name ?? id;
}
/**
 * Radiant (光明) version of a completed item, for content that marks an item instance as radiant instead of giving it
 * its own item id. Accepts a content item id or a base apiName.
 */
export function radiantItem(baseIdOrApiName: string): { readonly apiName: string; readonly name: string; readonly iconUrl: string | null } | null {
  const base = Object.hasOwn(ITEM_DEFINITIONS, baseIdOrApiName) ? ITEM_DEFINITIONS[baseIdOrApiName].apiName : baseIdOrApiName;
  const row = base ? RADIANT_BY_BASE.get(base) : undefined;
  return row ? { apiName: row.apiName, name: row.zh ?? row.en, iconUrl: assetUrl('items', row.apiName) } : null;
}
/** Name and icon of a Conqueror chest reward, Chem-Baron item (black market, shimmer) or Junker King upgrade by client apiName. */
export function lootEntry(apiName: string): { readonly name: string; readonly iconUrl: string | null } | null {
  const row = ITEM_NAMES.get(apiName);
  if (!row || !LOOT_API_NAMES.has(apiName)) return null;
  // Thief's Gloves is already bundled as a regular item icon (thiefs-gloves), so callers use that one.
  return { name: row.zh ?? row.en, iconUrl: assetUrl('loot', apiName) };
}
/** Shared gold coin icon for black market gold rewards (TFT_Assist_Gold_N, named N金币 in the client). */
export const lootGoldIconUrl = (): string | null => assetUrl('loot', 'TFT_Assist_Gold');

/** Icon for a content id of a G2-3 hero/summon, trait or item (G2-4b artifacts and support items included); null when not bundled. */
export function g23IconUrl(kind: 'champion' | 'trait' | 'item', id: string): string | null {
  if (kind === 'champion') return assetUrl('champions', g23ChampionApiName(id));
  if (kind === 'trait') return assetUrl('traits', g23TraitApiName(id));
  // 14.24 TFT13_AnotherAnomaly_Item uses the same GoopItem art as the chosen anomaly.
  // Resolve the instance variant here so DOM, Phaser and the 3D overhead share it.
  if (Object.hasOwn(ITEM_DEFINITIONS, id) && portableAnomalyId(id)) return anomalyIconUrl();
  const apiName = Object.hasOwn(ITEM_DEFINITIONS, id) ? ITEM_DEFINITIONS[id].apiName : undefined;
  return assetUrl('items', apiName) ?? assetUrl('loot', apiName) ?? assetUrl('artifact-items', apiName) ?? assetUrl('support', apiName);
}
/** Content unit ids that resolve to a bundled G2-3 portrait (for the board texture loader). */
export function g23ChampionAssets(): readonly { readonly id: string; readonly path: string }[] {
  const list: { id: string; path: string }[] = [];
  for (const id of [...Object.keys(UNIT_DEFINITIONS), ...Object.keys(G23_SUMMON_IDS)]) {
    const apiName = g23ChampionApiName(id);
    if (apiName && iconIndex.has(`champions:${apiName}`)) list.push({ id, path: g23IconPath('champions', apiName) });
  }
  return list;
}
export const G23_HERO_API_NAMES: readonly string[] = HEROES.map(row => row.apiName);
export const G23_SUMMON_API_NAMES: readonly string[] = SUMMONS.map(row => row.apiName);
