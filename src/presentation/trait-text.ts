/** Archived 14.24 client wording, filled with executable rule values; no rule evaluation. */
import { G23_TRAIT_SOURCE } from '../simulation/content/g2-3-trait-runtime';
import { G23_POLICY } from '../simulation/content/g2-3-policy';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import type { TraitDefinition, TraitTier } from '../simulation/strategy-types';
import { describeTraitTier } from './effect-text';
import { fillAbilityTemplate } from './ability-text';
import { V19_SISTERS_DISPLAY_SOURCE } from '../simulation/content/v19-trait-text';
import { V20_TEAMUP_DISPLAY_SOURCE } from '../simulation/content/v20-trait-text';
import { readTooltipText, peekTooltipText, onTooltipTextChanged } from './tooltip-text-loader';
import type { familyDisplay } from '../simulation/family-heist';

/** Append these supplied domain fields at the bottom of the Family tooltip; no counting or RNG in presentation. */
export function familyTraitFooter(display:ReturnType<typeof familyDisplay>):readonly string[] {
  return display?[display.progressText,display.policy]:[];
}

type SourceTier = { readonly threshold: number; readonly values: Readonly<Record<string, number | null | undefined>> };

export let CURRENT_TRAIT_OFFICIAL_TEXT:Readonly<Record<string,{readonly apiName:string;readonly locale:string;readonly description:string}>> = { ...peekTooltipText()?.TRAIT_OFFICIAL_TEXT, ...peekTooltipText()?.EXTRA_TRAIT_TEXT, ...peekTooltipText()?.SIX_COST_TEXT };
onTooltipTextChanged(() => {
  const data = readTooltipText();
  if (data) CURRENT_TRAIT_OFFICIAL_TEXT = { ...data.TRAIT_OFFICIAL_TEXT, ...data.EXTRA_TRAIT_TEXT, ...data.SIX_COST_TEXT };
});
const SOURCES = {...G23_TRAIT_SOURCE,...V19_SISTERS_DISPLAY_SOURCE,...V20_TEAMUP_DISPLAY_SOURCE,
  'blood-hunter':{tiers:[{threshold:1,values:{EnemyHealthPercentThreshold:0.15,DevourHealing:400,ManaPerKill:50}}]},
  'machine-herald':{tiers:[{threshold:1,values:{AS:0.55,MaxMana:8}}]},
  'banished-mage':{tiers:[{threshold:1,values:{MinimumCasts:12,ProcDamageAmp:0.10}}]},
} as Readonly<Record<string, { readonly tiers: readonly SourceTier[] }>>;
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
  if (traitId === 'artillerist') {
    // 12/17 B: the runtime tier overrides the archived AD fraction (e.g. 6: 60% -> 70%).
    const ad = effects.find(effect => effect.kind === 'statPercentBps' && effect.stat === 'attackDamage');
    if (ad?.kind === 'statPercentBps') effective.AD = ad.bps / 10000;
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

/** Preserve the exact official clause and append the project execution notes. */
const annotate = (id: string, text: string): string => readTooltipText()?.annotate(id, text) ?? text;

function parts(id: string): { summary: string; rows: string[]; expanded: boolean } | null {
  readTooltipText();
  const source = Object.hasOwn(CURRENT_TRAIT_OFFICIAL_TEXT, id) ? (CURRENT_TRAIT_OFFICIAL_TEXT as Readonly<Record<string,{description:string}>>)[id] : undefined;
  if (!source) return null;
  const rows = [...source.description.matchAll(/<(row|expandRow)>([\s\S]*?)<\/\1>/g)];
  const summary = source.description
    .replace(/<(row|expandRow)>[\s\S]*?<\/\1>/g, '')
    // Client inspection counters have no match-independent value. Retain static
    // <rules> text, notably Black Rose's star-level explanation.
    .replace(/<rules>[^<]*@[^<]*<\/rules>/g, '')
    .replace(/@TFTUnitProperty\.[^@]*@/g, '')
    .replace(/\(@TFTUnitProperty[^@]+@\/7\)/g, '');
  return { summary, rows: rows.map(row => row[2]), expanded: rows[0]?.[1] === 'expandRow' };
}

/** Official summary, including auxiliary official paragraphs; first tier when inactive. */
export function traitSummary(traitId: string, threshold = 0): string | null {
  if (!readTooltipText()) return '羁绊说明加载中…';
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
