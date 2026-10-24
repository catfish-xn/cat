import { readTooltipText, tooltipTextPlaceholder } from './tooltip-text-loader';
/**
 * Player text for the reward-only items outside the 44-item base catalogue: 炼金男爵「微光装备」(TFT13_Crime_*), radiant,
 * artifact, support and mechanism items. Names stay the 14.24 zh_cn client names (itemDisplayName); the effect lines below
 * are short project-written Chinese, with every number read from the runtime source values already in the rules.
 * Display only: what a fight actually does is the rules' item program.
 */
import { G23_SPECIAL_ITEM_SOURCE } from '../simulation/content/g2-3-special-item-runtime';
import type { Effect, ItemDefinition } from '../simulation/strategy-types';

type Values = Readonly<Record<string, number | null>>;
const pct = (v: number | null | undefined) => `${Math.round((v ?? 0) * 100)}%`;
const num = (v: number | null | undefined) => String(Math.round((v ?? 0) * 10) / 10);
const FAMILIES = new Set(["ChemGrips", "MageGuard", "MiningGauntlet", "DestabilizedChemtank", "ExecutionersVorpalblade", "FleshRipper", "PiltovenHexplating", "ShimmerBloom", "UnleashedToxins", "VirulentVirus", "VoltaicSaber", "DimensionalHeirloom"]);

const SOURCE_STATS: readonly (readonly [string, string, (value: number) => string])[] = [
  ['Health', '生命', num], ['AD', '攻击力', pct], ['AP', '法强', num], ['AS', '攻速', value => `${num(value)}%`],
  ['Armor', '护甲', num], ['MagicResist', '魔抗', num], ['Mana', '法力', num], ['CritChance', '暴击率', value => `${num(value)}%`],
  ['StatOmnivamp', '全能吸血', pct],
];
const STAT_NAMES: Readonly<Record<string, string>> = { maxHp: '生命', attackDamage: '攻击力', armor: '护甲', magicResist: '魔抗', initialMana: '法力', abilityAmount: '技能数值', abilityPower: '法强' };

/** `TFT13_Crime_<Tier>_<Family>` → its family and whether it is the 完美 (prismatic) tier; null for any other id. */
export function shimmerFamily(apiName: string): { readonly family: string; readonly perfected: boolean } | null {
  const match = /^TFT13_Crime_(Bronze|Silver|Gold|Prismatic|OmegaPrismatic)_([A-Za-z]+)$/.exec(apiName);
  return match && FAMILIES.has(match[2]) ? { family: match[2], perfected: match[1] === 'Prismatic' } : null;
}

/** 微光装备 lines: stats, effect, the 完美加成, then the Chem-Baron-only rule and what the rules settle today. */
export function shimmerItemLines(apiName: string): readonly string[] | null {
  const shimmer = shimmerFamily(apiName), source = (G23_SPECIAL_ITEM_SOURCE as Readonly<Record<string, { readonly values: Values }>>)[apiName];
  if (!shimmer || !source) return null;
  const data = readTooltipText();
  if (!data) return [tooltipTextPlaceholder().replace('强化', '装备')];
  const v = source.values, stats = SOURCE_STATS.filter(([key]) => v[key]).map(([key, name, format]) => `${name} +${format(v[key]!)}`);
  const [effect, bonus] = data.SHIMMER_FAMILIES[shimmer.family](v);
  return [...(stats.length ? [stats.join(' · ')] : []), effect, ...(shimmer.perfected && bonus ? [`完美加成：${bonus}`] : []),
    '仅限炼金男爵英雄装备。', '当前版本只结算属性加成，特殊效果待实装。'];
}

const effectLine = (effect: Effect): string | null => effect.kind === 'statFlat' ? `${STAT_NAMES[effect.stat] ?? effect.stat} +${effect.amount}`
  : effect.kind === 'statPercentBps' ? `${STAT_NAMES[effect.stat] ?? effect.stat} +${effect.bps / 100}%` : effect.kind === 'attackSpeedBps' ? `攻速 +${effect.bps / 100}%` : null;
/** The registry's G2-3 note line is an implementation pointer, not player text. */
const isImplementationNote = (line: string) => line.startsWith('有限奖励装备');

/** Player lines for any item outside the base catalogue: 微光装备 text, else its stat effects and its own player lines. */
export function specialItemLines(definition: ItemDefinition, radiantOfName?: string): readonly string[] {
  const shimmer = shimmerItemLines(definition.apiName ?? definition.id);
  if (shimmer) return shimmer;
  const stats = definition.effects.map(effectLine).filter((line): line is string => line !== null);
  return [...(radiantOfName ? [`「${radiantOfName}」的光明版本。`] : []), ...(stats.length ? [stats.join(' · ')] : []),
    ...(definition.effectDescriptions ?? []).filter(line => !isImplementationNote(line))];
}
