/**
 * G2-3 prep: display data for a pending choice whose kind the strategy panel has no dedicated
 * renderer for (armory, black market and similar). It never decides legality or price; the
 * choice is sent through the same public choose command and the rules answer.
 *
 * Optional display fields are read from `choice.display` when the rules provide them; until a
 * contract names them every field is absent and the offer falls back to its definition name.
 */
import { ITEM_DEFINITIONS } from '../simulation/content/g2-3-item-registry';
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';
import { catalogEntry, itemDescriptions } from './item-codex';
import { itemDisplayName, lootEntry } from './g23-display';
import { G23_LOOT } from './s13-g23-manifest';
import { G24_FORGE_POOLS } from '../simulation/content/g2-4-forges';
import { augmentDisplayName, augmentEffectText, augmentPlayerDescription } from './augment-display';

export interface GenericChoiceOffer { readonly id: string; readonly name: string; readonly description: string; readonly price?: number; readonly iconUrl?: string }
export interface GenericChoiceExtras {
  readonly title?: string;
  /** `payload.prices` (armory): display only, the rules charge. */
  readonly prices?: Readonly<Record<string, number>>;
  readonly offers?: readonly GenericChoiceOffer[];
  readonly skip?: { readonly label?: string };
}

const KNOWN_KINDS: ReadonlySet<string> = new Set(['component', 'augment', 'anomaly']);
export const isKnownChoiceKind = (kind: string): boolean => KNOWN_KINDS.has(kind);
/** As in TFT, the Chem-Baron black market and the Junker King armory take the shop row's place instead of a popup. */
export const isShopChoiceKind = (kind: string): boolean => kind === 'blackMarket' || kind === 'armory';

const text = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);
const int = (value: unknown): number | undefined => (Number.isInteger(value) ? value as number : undefined);

/**
 * Anvil names. The rules' forge pools decide the heading (artifacts are `kind: 'completed'` in the catalogue, so the kind
 * alone cannot tell them from ordinary completed items); otherwise the item kind every offer shares; mixed or unknown
 * offers keep the plain client name. 成装锻造器 / 神器锻造器 / 辅助装锻造器 follow the user-set names (14.24 lists
 * TFT_ArmoryKeySupport as the support anvil).
 */
const FORGE_POOL_NAMES: readonly (readonly [readonly string[], string])[] = [
  [G24_FORGE_POOLS.TFT_ArmoryKeyOrnn, '神器锻造器'], [G24_FORGE_POOLS.TFT_ArmoryKeySupport, '辅助装锻造器'],
  [G24_FORGE_POOLS.TFT_ArmoryKeyCompleted, '成装锻造器'],
];
const FORGE_NAMES: Readonly<Record<string, string>> = { completed: '成装锻造器', artifact: '神器锻造器', support: '辅助装锻造器' };
function forgeName(offers: readonly unknown[]): string {
  const pooled = FORGE_POOL_NAMES.find(([pool]) => offers.length > 0 && offers.every(id => typeof id === 'string' && pool.includes(id)));
  if (pooled) return pooled[1];
  const kinds = new Set(offers.map(id => (typeof id === 'string' ? catalogEntry(id)?.kind : undefined)));
  const [kind] = kinds;
  return kinds.size === 1 && typeof kind === 'string' && Object.hasOwn(FORGE_NAMES, kind) ? FORGE_NAMES[kind] : '锻造器';
}
/** Popup heading for a mechanic kind the rules send without a display title. */
function defaultTitle(choice: object): string | undefined {
  const { kind, offers, payload } = choice as { kind?: unknown; offers?: unknown; payload?: { source?: unknown } };
  // v16: the 5-7 / 6-7 carriers' forges say where they came from.
  const epic = payload && typeof payload === 'object' && payload.source === 'epic-loot' ? '史诗奖励 · ' : '';
  if (kind === 'blackMarket') return '炼金男爵 · 黑市';
  if (kind === 'armory' && payload?.source === 'junker-king') return '机械公敌 · 升级';
  return kind === 'forge' && Array.isArray(offers) ? `${epic}${forgeName(offers)} · ${offers.length} 选 1` : undefined;
}
/** Timeout option meaning "skip" (black market): no offer is granted. */
export const SKIP_OPTION = '@skip';
/** The option the rules grant when the window times out (`payload.timeoutOption`), when the choice declares one. */
export function timeoutOption(choice: object): string | undefined {
  const payload = (choice as { payload?: unknown }).payload;
  return payload && typeof payload === 'object' ? text((payload as Record<string, unknown>).timeoutOption) : undefined;
}

/** `payload.prices` with integer values only; anything else is dropped. */
function payloadPrices(choice: object): Readonly<Record<string, number>> | undefined {
  const payload = (choice as { payload?: unknown }).payload;
  const prices = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).prices : undefined;
  if (!prices || typeof prices !== 'object') return undefined;
  const valid = Object.entries(prices as Record<string, unknown>).flatMap(([id, price]) => (int(price) === undefined ? [] : [[id, price as number] as const]));
  return valid.length ? Object.fromEntries(valid) : undefined;
}
/** Reads the optional `display` block defensively; malformed fields are dropped, never thrown. */
export function readChoiceExtras(choice: object): GenericChoiceExtras {
  const raw = (choice as { display?: unknown }).display, fallbackTitle = defaultTitle(choice), prices = payloadPrices(choice);
  if (!raw || typeof raw !== 'object') return { ...(fallbackTitle ? { title: fallbackTitle } : {}), ...(prices ? { prices } : {}) };
  const display = raw as Record<string, unknown>;
  const offers = Array.isArray(display.offers) ? display.offers.flatMap(entry => {
    if (!entry || typeof entry !== 'object') return [];
    const offer = entry as Record<string, unknown>, id = text(offer.id);
    if (!id) return [];
    const price = int(offer.price);
    return [{ id, name: text(offer.name) ?? id, description: text(offer.description) ?? '', ...(price === undefined ? {} : { price }) }];
  }) : undefined;
  const skip = display.skip && typeof display.skip === 'object' ? { label: text((display.skip as Record<string, unknown>).label) } : display.skip === true ? {} : undefined;
  return { title: text(display.title) ?? fallbackTitle, offers, skip, ...(prices ? { prices } : {}) };
}

/** Junker King armory upgrade ids → 14.24 apiNames, for their zh_cn names. */
const JUNKER_API: Readonly<Record<string, string>> = {
  flamethrower: 'TFT13_JunkerKing_Flamethrower', 'petricite-rod': 'TFT13_JunkerKing_PertriciteRod', 'repairing-microbots': 'TFT13_JunkerKing_RepairingMicrobots',
  'self-destruct': 'TFT13_JunkerKing_SelfDestructButton', tankbuster: 'TFT13_JunkerKing_Tankbuster', 'spare-parts': 'TFT13_JunkerKing_Pass',
  'finishing-touch': 'TFT13_JunkerKing_SuperPass', 'junkyard-titan': 'TFT13_JunkerKing_3Star',
};
const junkerName = (id: string): string | undefined => {
  const api = Object.hasOwn(JUNKER_API, id) ? JUNKER_API[id] : undefined;
  return api ? G23_LOOT.find(row => row.apiName === api)?.zh ?? undefined : undefined;
};
/**
 * What each upgrade does, written from the rules' own effects (g2-3-junker, combat-g2-3-junker); the amounts live inline in
 * the rules, so the lines name the effect only.
 */
const JUNKER_TEXT: Readonly<Record<string, string>> = {
  flamethrower: '每秒对相邻敌人造成魔法伤害，随法术强度提高。', 'petricite-rod': '定期对射程内最远的敌人持续造成魔法伤害，随法术强度提高。',
  'repairing-microbots': '定期按最大生命值比例回复生命。', 'self-destruct': '护甲和魔抗提高；阵亡时按自身双抗对附近敌人造成魔法伤害。',
  tankbuster: '定期对双抗最高的敌人造成真实伤害，随法术强度提高。', 'spare-parts': '兰博获得少量生命值和法术强度。',
  'finishing-touch': '兰博获得大量生命值和法术强度。', 'junkyard-titan': '3 星兰博获得全部升级，受到的伤害大幅降低。',
};
const junkerIcon = (id: string): string | undefined => (Object.hasOwn(JUNKER_API, id) ? lootEntry(JUNKER_API[id]!)?.iconUrl ?? undefined : undefined);
type Named = { readonly name?: string; readonly description?: string; readonly effectDescriptions?: readonly string[] };
/** Name and verbatim description of one offer id: the declared display entry, else any content definition, else the id. */
export function genericOffer(id: string, extras: GenericChoiceExtras): GenericChoiceOffer {
  const declared = extras.offers?.find(offer => offer.id === id);
  if (declared) return declared;
  const price = extras.prices && Object.hasOwn(extras.prices, id) ? { price: extras.prices[id]! } : {};
  const junker = junkerName(id);
  const iconUrl = junkerIcon(id);
  if (junker) return { id, name: junker, description: JUNKER_TEXT[id] ?? '', ...price, ...(iconUrl ? { iconUrl } : {}) };
  // Augments use the same zh name and player text as the augment choice card (the W4 `name`/`description` are English and implementation notes).
  if (Object.hasOwn(AUGMENT_DEFINITIONS, id)) {
    const description = [augmentPlayerDescription(id), augmentEffectText(id)].filter(Boolean).join(' ');
    return { id, name: augmentDisplayName(id), description, ...price };
  }
  const tables: readonly Readonly<Record<string, Named>>[] = [ITEM_DEFINITIONS, ANOMALY_DEFINITIONS];
  const definition = tables.map(table => (Object.hasOwn(table, id) ? table[id] : undefined)).find(Boolean);
  // Items use the 14.24 zh_cn name, like every other item surface; other content keeps its definition name.
  const name = Object.hasOwn(ITEM_DEFINITIONS, id) ? itemDisplayName(id) : definition?.name ?? catalogEntry(id)?.name ?? id;
  // Items carry their catalogue effect lines (the same text as the supply popup), so offers can be compared; items outside
  // the base catalogue (artifacts) show their own registry effect lines.
  const lines = itemDescriptions(id).length ? itemDescriptions(id) : definition?.effectDescriptions ?? [];
  return { id, name, description: definition?.description || lines.join('；'), ...price };
}
