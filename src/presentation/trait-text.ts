/** Archived 14.24 client wording, filled with executable rule values; no rule evaluation. */
import { G23_TRAIT_SOURCE } from '../simulation/content/g2-3-trait-runtime';
import { G23_POLICY } from '../simulation/content/g2-3-policy';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import type { TraitDefinition, TraitTier } from '../simulation/strategy-types';
import { describeTraitTier } from './effect-text';
import { fillAbilityTemplate } from './ability-text';
import { TRAIT_OFFICIAL_TEXT } from './trait-official-text';

type SourceTier = { readonly threshold: number; readonly values: Readonly<Record<string, number | null | undefined>> };
const SOURCES = G23_TRAIT_SOURCE as Readonly<Record<string, { readonly tiers: readonly SourceTier[] }>>;
export function traitDisplayValues(traitId: string, threshold: number): Record<string, number> | null {
  const tiers = Object.hasOwn(SOURCES, traitId) ? SOURCES[traitId].tiers : undefined;
  const tier = tiers?.find(t => t.threshold === threshold) ?? tiers?.[0];
  if (!tier) return null;
  const authored = TRAIT_DEFINITIONS[traitId]?.tiers.find(t => t.threshold === tier.threshold);
  const effects = [...(authored?.effects ?? []), ...(authored?.memberEffects ?? [])];
  const effective: Record<string, number | null | undefined> = { ...tier.values, MinUnits: tier.threshold };
  if (traitId === 'sorcerer') {
    const ap = (entries: TraitTier['effects']) => entries.reduce((sum, effect) => sum + (effect.kind === 'statFlat' && effect.stat === 'abilityPower' ? effect.amount : 0), 0);
    effective.TeamAP = ap(authored?.effects ?? []);
    effective.BaseAP = effective.TeamAP + ap(authored?.memberEffects ?? []);
  }
  if (traitId === 'sniper') {
    const sniper = effects.find(effect => effect.kind === 'mechanic' && effect.mechanic === 'sniper');
    if (sniper?.kind === 'mechanic') effective.PercentDamageIncrease = sniper.values.damageBpsPerHex / 100;
  }
  if (traitId === 'conqueror') effective.PercentIncreasePerChest = G23_POLICY.conqueror.growthPerChestBps / 10000;
  const values: Record<string, number> = {};
  for (const [key, value] of Object.entries(effective)) if (typeof value === 'number') {
    values[key] = value;
    values[`${key}*100`] = value * 100;
  }
  // The archived Enforcer tooltip multiplies a fraction by 100 twice. Match the
  // executable shield fraction, without modifying either the archive or rules.
  if (traitId === 'enforcer') values['PercentMaxHealthShield*100*100'] = values['PercentMaxHealthShield*100'];
  return values;
}

const ICONS: Readonly<Record<string, string>> = {
  scaleAP: '法术强度', scaleAD: '攻击力', scaleHealth: '生命值', scaleArmor: '护甲', scaleMR: '魔抗',
  scaleAS: '攻击速度', scaleMana: '法力值', scaleDA: '伤害增幅', scaleDR: '伤害减免',
  scaleCrit: '暴击几率', scaleCritMult: '暴击伤害',
};
function fill(template: string, values: Record<string, number>): string {
  const icons = template.replace(/(?:%i:[A-Za-z]+%)+/g, run => [...run.matchAll(/%i:([A-Za-z]+)%/g)]
    .map(([, icon]) => ICONS[icon] ?? '').filter(Boolean).join('和'));
  // Missing data remains visible to verification; never silently drop official clauses.
  return fillAbilityTemplate(icons, values).text;
}

/** Preserve the exact official clause and append the requested implementation marker. */
function annotate(id: string, text: string): string {
  const mark = (clause: string) => { text = text.replace(clause, `${clause}（暂未实装）`); };
  if (id === 'family') mark('去上城搞钱！在战斗后，获得搞钱进度，并且每个存活的【家人】都会使这个进度提升！');
  if (id === 'scrap') {
    mark('所有基础装备和成装都会成为幸运装备！');
    mark('生成光明版装备！');
  }
  if (id === 'enforcer') mark('没收敌人的所有装备！');
  if (id === 'rebel') text = text.replace(/烟雾信号会在战斗开始时以及之后的每 \d+秒触发。/, '$&（暂未实装）');
  if (id === 'black-rose') {
    mark('【黑色玫瑰】弈子们会对敌人造成更多伤害');
    mark('当【赛恩】阵亡时，他会带着超越死亡的能量重获生命！');
  }
  if (id === 'firelight') {
    mark('【野火帮】们就会冲刺');
    mark('他们会进行一次无限距离的攻击');
    mark('在冲刺时，获得巨额爆发攻速加成。');
  }
  if (id === 'quickstriker') {
    mark('【迅击战士】移动得更快');
    mark('【迅击战士】们会冲刺至一个新目标');
  }
  if (id === 'artillerist') mark('发射一枚造成双倍伤害的火箭。');
  if (id === 'dominator') mark('会基于已消耗的法力值获得可叠加的法术强度');
  if (id === 'emissary') text = text.replace(/【盖伦】：[^\n]+/, '$&（暂未实装）');
  return text;
}

function parts(id: string): { summary: string; rows: string[]; expanded: boolean } | null {
  const source = Object.hasOwn(TRAIT_OFFICIAL_TEXT, id) ? TRAIT_OFFICIAL_TEXT[id] : undefined;
  if (!source) return null;
  const rows = [...source.description.matchAll(/<(row|expandRow)>([\s\S]*?)<\/\1>/g)];
  const summary = source.description
    .replace(/<(row|expandRow)>[\s\S]*?<\/\1>/g, '')
    // Client inspection counters have no match-independent value. Retain static
    // <rules> text, notably Black Rose's star-level explanation.
    .replace(/<rules>[^<]*@[^<]*<\/rules>/g, '')
    .replace(/\(@TFTUnitProperty[^@]+@\/7\)/g, '');
  return { summary, rows: rows.map(row => row[2]), expanded: rows[0]?.[1] === 'expandRow' };
}

/** Official summary, including auxiliary official paragraphs; first tier when inactive. */
export function traitSummary(traitId: string, threshold = 0): string | null {
  const text = parts(traitId), values = traitDisplayValues(traitId, threshold);
  return text && values ? annotate(traitId, fill(text.summary, values)) : null;
}

/** Official tier line; expandRow repeats once for each executable tier. */
export function traitTierText(definition: TraitDefinition, tier: TraitTier): string {
  const text = parts(definition.id), values = traitDisplayValues(definition.id, tier.threshold);
  if (!text || !values) return describeTraitTier(definition, tier);
  const index = definition.tiers.findIndex(candidate => candidate.threshold === tier.threshold);
  const template = text.expanded ? text.rows[0] : text.rows[index];
  // Single-tier traits without <row> use their complete official description.
  return annotate(definition.id, fill(template ?? `(@MinUnits@) ${text.summary}`, values));
}
