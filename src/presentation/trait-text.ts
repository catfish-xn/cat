/**
 * Trait rule text for the trait hover card and the trait tab: one summary paragraph per trait and, where the authored
 * effects cannot be worded by `describeTraitTier` (G2-3 program markers carry no standalone wording), one row
 * template per tier. Wording follows the 14.24 zh_cn client trait text; every number is filled in from the rules' own
 * runtime tier values and authored effects (`@Key@`, `@Key*100@` for a fraction shown as a percent).
 */
import { G23_TRAIT_SOURCE } from '../simulation/content/g2-3-trait-runtime';
import { G23_POLICY } from '../simulation/content/g2-3-policy';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import type { TraitDefinition, TraitTier } from '../simulation/strategy-types';
import { describeTraitTier, traitTierLimitations } from './effect-text';
import { fillAbilityTemplate } from './ability-text';

/** `tier`: one row template for every tier, or one per threshold. */
interface TraitText { readonly summary: string; readonly tier?: string | Readonly<Record<number, string>> }
const TRAIT_TEXT: Readonly<Record<string, TraitText>> = {
  automata: { summary: '造成伤害时获得 1 颗水晶，攒满 @TriggerNumCrystals@ 颗时震击当前目标，造成魔法伤害 + 上次震击以来已造成伤害的 @ConversionDamagePct*100@%，然后重置。同时获得护甲和魔抗。' },
  sorcerer: { summary: '全队获得 @TeamAP@ 法强，法师获得更多法强。', tier: '其他友军法强 +@TeamAP@；法师最终法强 +@BaseAP@；法师技能命中使目标伤害输出降低 @DamageDecrease*100@%，下一战斗帧生效，持续 @DamageDecreaseDuration@ 秒' },
  scrap: { summary: '开战时，极客携带的散件临时合成为完整装备。我方每持有 1 件散件（含已合成装备里的散件），极客获得护盾，持续 @ShieldDuration@ 秒。' },
  artillerist: { summary: '每攻击 @NumOfAttacks@ 次发射 1 枚火箭，对目标附近造成 @PercentDamage*100@% 攻击力的伤害。同时获得攻击力。', tier: '攻击力 +@AD*100@%；每 @NumOfAttacks@ 次普攻造成 @PercentDamage*100@% 攻击力的范围物理伤害' },
  emissary: { summary: '只在恰好拥有 1 名或 4 名不同的外交官时激活。加成：安蓓萨，每场胜利全队 +@AmbessaArmor@ 护甲和魔抗；盖伦，开战时盖伦和左右友军获得其 @GarenHealthPercent*100@% 最大生命；娜美，友军每次普攻额外 @NamiMana@ 法力；崔丝塔娜，友军每星级 +@StarAS*100@% 攻速。',
    tier: { 1: '获得该外交官的加成', 4: '获得全部加成；外交官最大生命 +@BonusHealth@、伤害增幅 @SelfishDamageAmp*100@%' } },
  sentinel: { summary: '全队获得护甲和魔抗，哨兵获得三倍。' },
  family: { summary: '家人们彼此支持：缩减最大法力值，并获得额外加成。' },
  ambusher: { summary: '伏击专家的技能伤害可以暴击，并获得额外暴击几率和暴击伤害。', tier: '暴击几率 +@CritChance*100@%，暴击伤害 +@CritDamage*100@%；伤害减免 @DamageReductionPct*100@%' },
  visionary: { summary: '先知每次获得法力值时，额外获得一部分法力值。', tier: '法力获取 +@EnlightenedBonusMana*100@%；技能造成的实际生命伤害的 @AllyHealing*100@% 治疗生命比例最低的其他友军（不含自身和铁匠铺，排除普攻及装备派生伤害）' },
  sniper: { summary: '狙神对越远的目标造成越高的伤害。', tier: '每格距离 +@PercentDamageIncrease@% 伤害；攻击距离 +@BonusHexRangeIncrease@' },
  conqueror: { summary: '铁血征服者参与击杀后提供征服层数，层数攒够就打开一个战利品宝箱。铁血征服者获得攻击力和法强，每打开 1 个宝箱，这个加成再提高 @PercentIncreasePerChest*100@%。', tier: '攻击力和法强 +@ADAPBase*100@%；每次击杀 @StacksPerKill@ 层征服' },
  'high-roller': { summary: '塞薇卡施放技能时随机放入 1 个金克丝改件，并获得 @Durability*100@% 伤害减免，持续 @Duration@ 秒。', tier: '改件：火箭（@Bonus1NumRockets@ 枚，每枚 @Bonus1RocketDamage@ 物理伤害）、护盾（@Bonus2ShieldAmount@，持续 @Bonus2ShieldDuration@ 秒）、硬币（@Bonus4Gold@ 金币）、三倍（强化随到的那个技能）' },
  academy: { summary: '皮城学院每局赞助 3 件装备。赞助装备提供额外生命和伤害增幅；由皮城学院弈子携带时加成翻倍，并额外 +@BaseValues*100@%。' },
  'chem-baron': { summary: '每个玩家对战回合后获得微光，连败至少 @MinStreakLength@ 场时获得更多；野怪回合也获得微光，我方每阵亡 1 名再多一些。每攒满 @ShimmerBreakpoint@ 微光，黑市提供只有炼金男爵能用的非法装备；每跳过一次黑市，炼金男爵英雄获得最大生命值。', tier: '对战回合 @ShimmerPerCombat@ 微光（连败时 @ShimmerPerCombatStreaking@）；野怪回合 @ShimmerPerRound_PVE@ 微光，我方每阵亡 1 名 +@ShimmerPerDeath_PVE@；每跳过一次黑市，炼金男爵英雄最大生命 +@HealthPerSkip@' },
  rebel: { summary: '蓝发小队获得 @MaxHealthIncrease*100@% 最大生命值。我方队伍损失 @PercentHealthTrigger*100@% 生命后放出烟雾信号：蓝发小队获得 @BurstAS*100@% 攻速，持续 @BurstDuration@ 秒，并获得持续到战斗结束的攻击力和法强。' },
  dominator: { summary: '开战时统领获得护盾，持续 @ShieldDuration@ 秒。统领施放技能时，按最大法力值获得可叠加的法强。', tier: '护盾 @ShieldAmount@；每次施法获得最大法力值 @APPercent*100@% 的法强' },
  'pit-fighter': { summary: '搏击手获得 @OmnivampPercent*100@% 全能吸血，并造成额外真实伤害。每场战斗一次：生命降到 @HealthThreshold*100@% 时，在 @Duration@ 秒内逐战斗帧治疗一部分最大生命值，受重伤影响，阵亡后停止。', tier: '全能吸血 @OmnivampPercent*100@%；额外 @TrueDamagePercent*100@% 真实伤害；生命降到 @HealthThreshold*100@% 时，在 @Duration@ 秒内持续治疗触发时最大生命的 @HealPercent*100@%' },
  enforcer: { summary: '开战时执法官获得护盾和伤害增幅，生命值最高的敌人被通缉。被通缉的敌人阵亡时，执法官获得攻速。' },
  firelight: { summary: '野火帮每隔 @Duration@ 秒治疗自身，数额为期间所受伤害的一部分。冲刺、无限射程与攻速爆发暂未实装。' },
  experiment: { summary: '你的棋盘上出现试验格。开战时，站在试验格上的试验品获得所有站在试验格上的试验品的加成，外加最大生命值。', tier: '@NumLaboratory@ 个试验格；最大生命 +@MaxHealth@；试验品加成提高 @ExperimentBonusIncrease*100@%' },
  bruiser: { summary: '全队获得 @TeamFlatHealth@ 最大生命值，格斗家获得更多生命值。' },
  'junker-king': { summary: '每 @NumRounds1Star@ 回合开启一次武器库，可为你最强的兰博的机甲购买永久升级。', tier: '每 @NumRounds1Star@ 回合开启武器库' },
  'black-rose': { summary: '召唤一个被束缚的赛恩。黑色玫瑰弈子施放 @NumCastsToUnlock@ 次技能后，或赛恩生命跌破 @PercentHealthUnlock*100@% 时，他会挣脱束缚。黑色玫瑰弈子的星级越高，赛恩越强。',
    tier: { 3: '召唤被束缚的赛恩，挣脱时获得护盾并眩晕相邻敌人', 4: '赛恩变得更强', 5: '赛恩挣脱束缚时回满生命', 7: '继承 5 档已实现的赛恩召唤、星级成长与挣脱效果' } },
  quickstriker: { summary: '迅击战士按当前目标已损失生命比例获得线性提高的攻速。4 档当前目标阵亡时获得护盾，包括队友击杀。移速与冲刺暂未实装。', tier: '按当前目标已损失生命比例，攻速从 +@MinBonusAS*100@% 线性提高至 +@MaxBonusAS*100@%；当前目标阵亡时（包括队友击杀）获得 @ShieldAmount@ 护盾，持续 @ShieldDuration@ 秒' },
  watcher: { summary: '监察获得伤害减免，生命值高于 @HealthBreakpoint*100@% 时减免提高。' },
};
type SourceTier = { readonly threshold: number; readonly values: Readonly<Record<string, number | null | undefined>> };
const SOURCES = G23_TRAIT_SOURCE as Readonly<Record<string, { readonly tiers: readonly SourceTier[] }>>;
function tierValues(traitId: string, threshold: number): Record<string, number> | null {
  const tiers = Object.hasOwn(SOURCES, traitId) ? SOURCES[traitId].tiers : undefined;
  const tier = tiers?.find(t => t.threshold === threshold) ?? tiers?.[0];
  if (!tier) return null;
  // v18 keeps archival columns intact. Display the executable overrides from the
  // authored effects/policy instead of repeating old archive values or UI constants.
  const authored = TRAIT_DEFINITIONS[traitId]?.tiers.find(t => t.threshold === tier.threshold);
  const effects = [...(authored?.effects ?? []), ...(authored?.memberEffects ?? [])];
  const effective: Record<string, number | null | undefined> = { ...tier.values };
  if (traitId === 'sorcerer') effective.BaseAP = effects.reduce((sum, effect) => sum + (effect.kind === 'statFlat' && effect.stat === 'abilityPower' ? effect.amount : 0), 0);
  if (traitId === 'sniper') {
    const sniper = effects.find(effect => effect.kind === 'mechanic' && effect.mechanic === 'sniper');
    if (sniper?.kind === 'mechanic') effective.PercentDamageIncrease = sniper.values.damageBpsPerHex / 100;
  }
  if (traitId === 'conqueror') effective.PercentIncreasePerChest = G23_POLICY.conqueror.growthPerChestBps / 10000;
  const values: Record<string, number> = {};
  for (const [key, value] of Object.entries(effective)) if (typeof value === 'number') { values[key] = value; values[`${key}*100`] = value * 100; }
  return values;
}
/** Template filled with `values`; a clause (split on `；`) whose token has no value in this tier is dropped. */
function fill(template: string, values: Record<string, number>): string {
  return template.split('；').map(part => fillAbilityTemplate(part, values)).filter(part => !part.unknown.length).map(part => part.text).join('；');
}

/** Summary paragraph of a trait, numbers from tier `threshold` (else its first tier); null when no text is written. */
export function traitSummary(traitId: string, threshold = 0): string | null {
  const text = Object.hasOwn(TRAIT_TEXT, traitId) ? TRAIT_TEXT[traitId] : undefined, values = tierValues(traitId, threshold);
  return text && values ? fill(text.summary, values) : text?.summary ?? null;
}
/** One tier line: the row template with this tier's values, else the authored-effect wording. */
export function traitTierText(definition: TraitDefinition, tier: TraitTier): string {
  const rows = Object.hasOwn(TRAIT_TEXT, definition.id) ? TRAIT_TEXT[definition.id].tier : undefined;
  const template = typeof rows === 'string' ? rows : rows?.[tier.threshold];
  const values = template ? tierValues(definition.id, tier.threshold) : null;
  const row = template && values ? fill(template, values) : '';
  return row ? `${tier.threshold}：${row}${traitTierLimitations(definition.id, tier.threshold)}` : describeTraitTier(definition, tier);
}
