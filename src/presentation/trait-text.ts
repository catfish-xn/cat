/** Archived 14.24 client wording, filled with executable rule values; no rule evaluation. */
import { G23_TRAIT_SOURCE } from '../simulation/content/g2-3-trait-runtime';
import { G23_POLICY } from '../simulation/content/g2-3-policy';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import type { TraitDefinition, TraitTier } from '../simulation/strategy-types';
import { describeTraitTier } from './effect-text';
import { fillAbilityTemplate } from './ability-text';
import { V19_OFFICIAL_TRAIT_TEXT, V19_SISTERS_DISPLAY_SOURCE } from '../simulation/content/v19-trait-text';
import { V20_OFFICIAL_TRAIT_TEXT, V20_TEAMUP_DISPLAY_SOURCE } from '../simulation/content/v20-trait-text';
import { TRAIT_OFFICIAL_TEXT } from './trait-official-text';
import type { familyDisplay } from '../simulation/family-heist';

/** Append these supplied domain fields at the bottom of the Family tooltip; no counting or RNG in presentation. */
export function familyTraitFooter(display:ReturnType<typeof familyDisplay>):readonly string[] {
  return display?[display.progressText,display.policy]:[];
}

type SourceTier = { readonly threshold: number; readonly values: Readonly<Record<string, number | null | undefined>> };
const SIX_COST_TEXT = {
  'blood-hunter':{apiName:'TFT13_BloodHunter',locale:'zh_cn',description:'【沃里克】吞噬生命值低于@EnemyHealthPercentThreshold*100@%的敌人，为他自身回复@DevourHealing@生命值并获得@ManaPerKill@法力值。'},
  'machine-herald':{apiName:'TFT13_MachineHerald',locale:'zh_cn',description:'【维克托】的固定攻击速度为每秒@AS@次攻击，并将所有额外攻击力、攻击速度和法力值转化为法术强度。<br><br>【维克托】不使用法力值，而是每次攻击获得1混沌能量，并且会在@MaxMana@混沌能量时施放技能。'},
  'banished-mage':{apiName:'TFT13_MissMageTrait',locale:'zh_cn',description:'在你第一次即将被淘汰时，如果【梅尔】在本局游戏的玩家对战回合中施放过至少@MinimumCasts@次技能，那么她会救下你，让你继续存活。<br><br>在那之后，【梅尔】会永久获得@ProcDamageAmp*100@%伤害增幅。<br><br>@TFTUnitProperty.:TFT13_MissMageTrait_TrackerTRA@'},
};
export const CURRENT_TRAIT_OFFICIAL_TEXT:Readonly<Record<string,{readonly apiName:string;readonly locale:string;readonly description:string}>> = {...TRAIT_OFFICIAL_TEXT,...V19_OFFICIAL_TRAIT_TEXT,...V20_OFFICIAL_TRAIT_TEXT,...SIX_COST_TEXT};
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

/** Preserve the exact official clause and append the requested implementation marker. */
function annotate(id: string, text: string): string {
  const mark = (clause: string) => { text = text.replace(clause, `${clause}（暂未实装）`); };
  if (id === 'family') text += ' 家人5：16项等权随机任务；PvP按阶段推进，每战最多完成一次，余量结转；奖励以可部分领取的法球发放。训练假人替代：10金（魔改）。';
  if (id === 'machine-herald') text += ' 额外属性1:1转法强为魔改约定。';
  if (id === 'scrap') {
    mark('所有基础装备和成装都会成为幸运装备！');
    mark('生成光明版装备！');
  }
  if (id === 'enforcer') mark('没收敌人的所有装备！');
  if (id === 'black-rose') {
    mark('当【赛恩】阵亡时，他会带着超越死亡的能量重获生命！');
  }
  if (id === 'firelight') text += ' 魔改执行：每 6 秒冲刺，1 秒窗口内无限射程，攻速 +350%（工程取值），按实际承伤回复，撤离到 2 格内落点。';
  if (id === 'quickstriker') text += ' 移速 ×1.5；4 档当前目标阵亡后下一 tick 冲刺至新目标旁合法格（魔改执行）。';
  // Team-ups need the augment plus both named champions on the board; follow-ups land one tick later (project timing).
  if (id === 'mentorship') text += ' 魔改执行：开场冻结凯特琳攻击力的25%给安蓓萨；安蓓萨施法后下一刻凯特琳对同一目标追加一次225%攻击力的物理伤害。';
  if (id === 'reunion') text += ' 魔改执行：蔚施法后艾克发3道残影（各50%），艾克施法后蔚向目标所在行发地震波（150%）；只复制伤害。';
  if (id === 'geniuses') text += ' 魔改执行：黑默丁格施法后艾克发3道残影（各33%），艾克施法后黑默丁格发3枚导弹（各120%）；协同不会再触发协同。';
  if (id === 'menaces') text += ' 魔改执行：爆爆仍计入家人人数但不享受家人自身收益；开场冻结希尔科属性，猴子爆炸生成3个畸变体。';
  if (id === 'unlikely-duo') text += ' 魔改执行：施法给另一名伙伴10法力；钢臂非三重结果有10%升为三重。';
  return text;
}

function parts(id: string): { summary: string; rows: string[]; expanded: boolean } | null {
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
