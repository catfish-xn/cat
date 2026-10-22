/**
 * Plain zh lines for one 铁血征服者 chest or 炼金男爵 black-market bundle, read from the rules' own reward table (the
 * source row the rules grant from); nothing is priced, rolled or written here. A random pool says what kind of thing
 * comes, a one-entry pool names it. Used by the conquest ladder hover and the black-market popup.
 */
import { ITEM_DEFINITIONS } from '../simulation/content/g2-3-item-registry';
import { G23_SPECIAL_ITEM_POOLS } from '../simulation/content/g2-3-special-item-runtime';
import { G23_POLICY } from '../simulation/content/g2-3-policy';
import { consumableName } from './orb-loot';
import { G23_HERO_IDS, g23ChampionNameByApi, itemDisplayName } from './g23-display';
import { UNIT_DEFINITIONS } from '../simulation/units';
import { getHeroIdentity } from './hero-identity';

const FORGES: Readonly<Record<string, string>> = { TFT_ArmoryKeyCompleted: '成装锻造器', TFT_ArmoryKeyOrnn: '神器装备锻造器', TFT_ArmoryKeySupport: '辅助装锻造器' };
const POOLS: Readonly<Record<string, string>> = { Tier0: '随机初级黑市装备', Tier1: '随机黑市装备', Tier2: '随机黑市装备 II', Tier3: '随机完美黑市装备', RADIANTITEMS_SET5: '随机光明装备' };
const TOOLS: Readonly<Record<string, string>> = { TFT_Consumable_ItemRemover: 'magnetic-remover', TFT_Consumable_ItemReroller: 'reforger' };
const COSTS: Readonly<Record<string, number>> = { TwoCostUnit: 2, ThreeCostUnit: 3, FourCostUnit: 4, FiveCostUnit: 5 };

function itemName(api: string): string {
  const pool = (G23_SPECIAL_ITEM_POOLS as Readonly<Record<string, readonly string[]>>)[api];
  if (pool?.length === 1) return itemName(pool[0]!);
  if (pool || POOLS[api]) return POOLS[api] ?? '随机装备';
  if (api === 'COMPONENT_NOSPAT') return '随机组件';
  if (Object.hasOwn(TOOLS, api)) return consumableName(TOOLS[api]!);
  const duplicator = (G23_POLICY.duplicators as Readonly<Record<string, { name: string }>>)[api];
  if (duplicator) return duplicator.name;
  const definition = Object.hasOwn(ITEM_DEFINITIONS, api) ? ITEM_DEFINITIONS[api] : Object.values(ITEM_DEFINITIONS).find(item => item.apiName === api);
  return definition ? itemDisplayName(definition.id) : api;
}
/** A shop hero's apiName (TFT13_Singed) is its unit id after the set prefix; set-13 extras have their own zh row. */
const heroName = (api: string) => g23ChampionNameByApi(api) ?? getHeroIdentity(api.slice(api.indexOf('_') + 1).toLowerCase()).name;
const list = (value: unknown): readonly string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []);
/** Repeated names fold into "名字 ×N", in first-seen order. */
export const counted = (names: readonly string[]) => [...new Set(names)].map(name => { const n = names.filter(other => other === name).length; return n > 1 ? `${name} ×${n}` : name; });

/**
 * One line per reward kind: gold, heroes, items, tools; unknown keys are left out rather than guessed. `first` names the
 * bundle's first item when it is already drawn (the black market offers it), in place of its random pool.
 */
export function g23RewardLines(reward: Readonly<Record<string, unknown>>, first?: string): string[] {
  const lines: string[] = [], items: string[] = [], heroes: string[] = [];
  const drawn = (api: string) => { const plain = !Object.hasOwn(TOOLS, api) && !Object.hasOwn(G23_POLICY.duplicators, api); const name = plain && first ? first : itemName(api); if (plain) first = undefined; return name; };
  let gold = 0;
  for (const [key, value] of Object.entries(reward)) {
    if (key === 'Gold') gold += Number(value) || 0;
    else if (key === 'GoldItems') for (const api of list(value)) gold += Number(api.slice(api.lastIndexOf('_') + 1)) || 0;
    else if (key === 'Remover') for (let n = 0; n < (Number(value) || 0); n++) items.push(consumableName('magnetic-remover'));
    else if (['Item', 'ExactItem', 'ItemByKey', 'Consumables'].includes(key)) for (const api of list(value)) items.push(drawn(api));
    else if (key === 'MeepTypeUnit') for (const api of list(value)) items.push(FORGES[api] ?? '锻造器');
    else if (key === 'TwoStarUnit') for (const cost of list(value)) heroes.push(`2 星 ${COSTS[cost] ?? '?'} 费英雄`);
    else if (Object.hasOwn(COSTS, key)) for (let n = 0; n < (Number(value) || 0); n++) heroes.push(`${COSTS[key]} 费英雄`);
    else if (key.startsWith('Champions')) {
      const star = /_(\d)Star$/.exec(key)?.[1] ?? '1';
      for (const api of list(value)) heroes.push(`${star} 星${heroName(api)}`);
    } else if (key === 'PlayerBuff') lines.push('此后装备转为光明装备');
  }
  if (gold) lines.unshift(`${gold} 金币`);
  if (heroes.length) lines.push(counted(heroes).join('、'));
  if (items.length) lines.push(counted(items).join('、'));
  return lines;
}

/** One picture of a bundle: a hero portrait with its stars, an item icon (null id: a random pool), or the gold in it. */
export type G23RewardIcon =
  | { readonly kind: 'hero'; readonly unitId: string | null; readonly star: number; readonly name: string }
  | { readonly kind: 'item'; readonly itemId: string | null; readonly name: string }
  | { readonly kind: 'gold'; readonly amount: number };

/** A shop hero's apiName (TFT13_Gremlin) to the repo unit id (smeech) when the repo has that hero. */
function heroUnitId(api: string): string | null {
  const id = Object.keys(G23_HERO_IDS).find(key => G23_HERO_IDS[key] === api) ?? api.slice(api.indexOf('_') + 1).toLowerCase();
  return Object.hasOwn(UNIT_DEFINITIONS, id) ? id : null;
}
function itemId(api: string): string | null {
  const pool = (G23_SPECIAL_ITEM_POOLS as Readonly<Record<string, readonly string[]>>)[api];
  if (pool?.length === 1) return itemId(pool[0]!);
  if (Object.hasOwn(ITEM_DEFINITIONS, api)) return api;
  return Object.values(ITEM_DEFINITIONS).find(item => item.apiName === api)?.id ?? null;
}

/**
 * The same reward table as `g23RewardLines`, as pictures for a black-market card: heroes first (TFT shows the champions
 * of a bundle up front), then items and tools, then the gold. Nothing is drawn: a random pool stays a pool.
 */
export function g23RewardIcons(reward: Readonly<Record<string, unknown>>): G23RewardIcon[] {
  const heroes: G23RewardIcon[] = [], items: G23RewardIcon[] = [];
  let gold = 0;
  const item = (api: string) => items.push({ kind: 'item', itemId: Object.hasOwn(TOOLS, api) || Object.hasOwn(G23_POLICY.duplicators, api) ? null : itemId(api), name: itemName(api) });
  for (const [key, value] of Object.entries(reward)) {
    if (key === 'Gold') gold += Number(value) || 0;
    else if (key === 'GoldItems') for (const api of list(value)) gold += Number(api.slice(api.lastIndexOf('_') + 1)) || 0;
    else if (key === 'Remover') for (let n = 0; n < (Number(value) || 0); n++) items.push({ kind: 'item', itemId: null, name: consumableName('magnetic-remover') });
    else if (['Item', 'ExactItem', 'ItemByKey', 'Consumables'].includes(key)) for (const api of list(value)) item(api);
    else if (key === 'MeepTypeUnit') for (const api of list(value)) items.push({ kind: 'item', itemId: null, name: FORGES[api] ?? '锻造器' });
    else if (key.startsWith('Champions')) {
      const star = Number(/_(\d)Star$/.exec(key)?.[1] ?? 1);
      for (const api of list(value)) heroes.push({ kind: 'hero', unitId: heroUnitId(api), star, name: heroName(api) });
    }
  }
  return [...heroes, ...items, ...(gold ? [{ kind: 'gold' as const, amount: gold }] : [])];
}
