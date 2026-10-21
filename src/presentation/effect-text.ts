/**
 * Display text for content effects (moved from strategy-panel.ts so the trait column and hover cards share it).
 * Reads authored Effect values only; describes them, never evaluates them.
 */
import type { Effect, TraitDefinition, TraitTier } from '../simulation/strategy-types';
import { displayUnitName } from '../rendering/display-names';

export const TERM: Readonly<Record<string,string>> = {
  health:'生命', maxHp:'最大生命', attack:'攻击力', attackDamage:'攻击力', armor:'护甲', magicResist:'魔抗', abilityPower:'法强', initialMana:'初始法力', maxMana:'最大法力', attackRange:'射程',
  attackSpeed:'攻速', attackSpeedBps:'攻速', range:'射程', stun:'眩晕', damageReduction:'减伤', armorReduction:'护甲削减', resistanceFlat:'双抗', channel:'引导', redirect:'伤害分担',
  combatStart:'开战时', onAttack:'普攻时', onCast:'施法时', onHpLoss:'损失生命时', physical:'物理', magic:'魔法',
  ability:'技能', trait:'羁绊', item:'装备', augment:'强化', anomaly:'异常', enemyGrowth:'敌方成长',
};
export const term = (value: string) => TERM[value] ?? value;

export function describeEffect(effect: Effect): string {
  if (effect.kind === 'mechanic') {
    // v15 D11: `d11Fill` only marks the wired D11 program; the player text is the definition's description (D11-DISPLAY).
    if (effect.mechanic === 'd11Fill') return '';
    // The program marker has no standalone benefit; trait-text describes its rules.
    if (effect.mechanic === 'g23Trait') return '';
    const v = effect.values, pct = (key: string) => `${v[key] / 100}%`;
    const descriptions: Record<string, string> = {
      rageblade: `每次普攻叠加 ${pct('attackSpeedBps')} 攻速`, damageAmp: `伤害增幅 ${pct('bps')}`,
      extraAttackMana: `每次普攻额外 ${v.amount} 法力${v.backRowOnly ? '（最后一排）' : ''}`,
      archangel: `每 ${v.periodTicks * .05} 秒增加 ${v.abilityPower} 法强`, dragonClaw: `每 ${v.periodTicks * .05} 秒治疗 ${pct('healMaxHpBps')} 最大生命`,
      gargoyle: `每个以持有者为目标的敌人增加 ${v.resistPerEnemy} 双抗`, gunblade: `实际伤害的 ${pct('selfHealBps')} 自疗、${pct('allyHealBps')} 治疗最低生命比例友军`,
      artillery: `每 ${v.everyN} 次普攻造成 ${pct('adBps')} 攻击力 范围物理伤害`, sniper: `每格距离增加 ${pct('damageBpsPerHex')} 伤害`,
      watcher: `减伤 ${pct('reductionBps')}；生命超过 ${pct('thresholdBps')} 时为 ${pct('healthyReductionBps')}`,
      quickstriker: `按当前目标已损失生命比例，攻速从 +${pct('minBps')} 线性提高至 +${pct('maxBps')}`
        + (v.shield ? `；当前目标阵亡时（包括队友击杀）获得 ${v.shield} 护盾，持续 ${v.durationTicks * .05} 秒` : ''),
      visionary: `法力获取 +${pct('manaBps')}`
        + (v.allyHealingBps ? `；技能造成的实际生命伤害的 ${pct('allyHealingBps')} 治疗生命比例最低的其他友军` : ''),
      acquisitionGold: `立即获得 ${v.amount} 金币`, glassCannon: `最后一排初始生命 ${pct('startingHealthBps')}、伤害增加 ${pct('damageAmpBps')}`,
      pumpingUp: `每轮增加 ${pct('attackSpeedBpsPerRound')} 攻速`, investment: `每点利息永久增加 ${v.healthPerInterest} 生命`,
      bulkyBuddies: `相邻双人组获得 ${v.health} 生命，触发 ${pct('shieldMaxHpBps')} 最大生命护盾，持续 ${v.durationTicks * .05} 秒`,
      // W4 augments: values exactly as authored in AUGMENT_DEFINITIONS (Centi → /100), wording per MATCH_CONTRACT augment section.
      mentorship: `开战时与更高费友军相邻：攻速 +${pct('attackSpeedBps')}、生命 +${v.health}`,
      itemCollector: `全队生命 +${v.baseHealth}；全队每穿戴一种不同装备，再 +${v.healthPerItem} 生命、+${pct('adBpsPerItem')} 攻击力、+${v.apCentiPerItem / 100} 法强`,
      bronzeForLife: `每个铜级羁绊使全队伤害增幅 +${pct('damageAmpBps')}${v.durabilityBps ? `、伤害减免 +${pct('durabilityBps')}` : ''}`,
      littleBuddies: `每个上场的 1/2 费友军使 4/5 费友军生命 +${v.health}、攻速 +${pct('attackSpeedBps')}`,
      backup: `开战时后两排至少 ${v.minimum} 名友军：全队攻速 +${pct('attackSpeedBps')}`,
      lineup: `开战时前两排每有 1 名友军，全队护甲和魔抗 +${v.resistCentiPerUnit / 100}`,
      findCenter: `开战时位于中心格的友军：伤害增幅 +${pct('damageAmpBps')}、最大生命 +${pct('healthBps')}`,
      builtDifferent: `未激活任何羁绊的单位，按阶段 2/3/4/5+ 获得 ${v.health2}/${v.health3}/${v.health4}/${v.health5} 生命、`
        + `${v.speed2 / 100}/${v.speed3 / 100}/${v.speed4 / 100}/${v.speed5 / 100}% 攻速`,
      blisteringStrikes: `普攻使目标灼烧 ${v.durationTicks * .05} 秒（每秒 ${pct('burnBpsPerSecond')} 最大生命）并重伤 ${pct('woundBps')}`,
      clockworkAccelerator: `战斗中每 ${v.periodTicks * .05} 秒全队攻速 +${pct('attackSpeedBps')}`,
      loneHero: `最后存活的友军：攻速 +${pct('attackSpeedBps')}、伤害减免 +${pct('durabilityBps')}`,
      climbLadder: `友军阵亡时，与其共享羁绊的存活友军 +${pct('adBps')} 攻击力、+${v.abilityPower} 法强、+${v.armor} 护甲、+${v.magicResist} 魔抗`,
      inspiringEpitaph: `友军阵亡时，最近的友军获得 ${pct('shieldMaxHpBps')} 最大生命护盾（持续本场）和可叠加的 +${pct('attackSpeedBps')} 攻速`,
      titanic:`普攻附加 ${pct('adBps')} 攻击力 物理伤害，命中目标及相邻格`, mageArmor: `获得最终法强 ${pct('apBps')} 的双抗`, killStreak: `击杀后存活获得 ${v.mana} 法力`,
      // G2 traits: values exactly as authored in TRAIT_DEFINITIONS (bps → %, ticks → seconds), see MATCH_CONTRACT G2-2.
      automata: `造成伤害积累水晶，满 ${v.crystals} 个时对目标造成 ${v.damage} 魔法伤害 + 期间伤害的 ${pct('conversionBps')}`,
      firelight: `每 ${v.periodTicks * .05} 秒治疗期间所受伤害的 ${pct('healBps')}`,
      family: `最大法力 -${pct('manaReductionBps')}，减伤 ${pct('damageReductionBps')}`,
      rebel: `我方损失 ${pct('thresholdBps')} 生命后：攻速 +${pct('attackSpeedBps')} 持续 ${v.durationTicks * .05} 秒，攻击力/法强 +${pct('adApBps')}`
        + `${v.bonusHpBps ? `、最大生命 +${pct('bonusHpBps')}` : ''}${v.stunTicks ? `，眩晕全部敌人 ${v.stunTicks * .05} 秒` : ''}`,
      enforcer: `开战获得 ${pct('shieldBps')} 最大生命护盾；${v.wanted >= 99 ? '全部敌人' : `生命最高的 ${v.wanted} 名敌人`}被通缉，通缉目标阵亡时攻速 +${pct('attackSpeedBps')}`,
      academy: `赞助装备每件提供 ${pct('sponsoredBps')} 生命与伤害增幅；学院成员持有时加倍并额外 +${pct('memberBaseBps')}`,
      scrap: `开战时最多 ${v.conversions} 件散件临时合成完整装备；全队每件散件提供 ${v.shieldPerComponent} 护盾，持续 ${v.durationTicks * .05} 秒`,
      emissary: `恰好 1 名（该外交官的加成）或 4 名（全部加成）外交官时生效：${displayUnitName('ambessa')} 每场胜利 +${v.armorPerWin} 双抗；${displayUnitName('garen')} 开战使自身与左右友军获得其 ${pct('healthBps')} 生命；`
        + `${displayUnitName('nami')} 友军普攻额外 ${v.mana} 法力；${displayUnitName('tristana')} 每星级攻速 +${pct('starSpeedBps')}`,
    };
    return descriptions[effect.mechanic] ?? effect.mechanic;
  }
  if (effect.kind === 'statFlat') return `${term(effect.stat)} +${effect.amount}`;
  if (effect.kind === 'statPercentBps') return `${term(effect.stat)} +${effect.bps / 100}%`;
  if (effect.kind === 'attackSpeedBps') return `攻速 +${effect.bps / 100}%`;
  const action = effect.action;
  const result = action.kind === 'grantShield' ? `护盾 ${action.amount} / ${action.durationTicks * 50 / 1000}s`
    : action.kind === 'gainMana' ? `法力 +${action.amount}` : `${term(action.damageType)}伤害 ${action.amount}`;
  return `${term(effect.hook)}${effect.everyN > 1 ? ` 每${effect.everyN}次` : ''} → ${result}`;
}

/** Delayed mechanics must remain visible alongside the executable tier benefits. */
export function traitTierLimitations(traitId: string, threshold: number): string {
  const notes: string[] = [];
  if (traitId === 'quickstriker') notes.push('移速与冲刺暂未实装');
  if (traitId === 'firelight') notes.push('冲刺、无限射程与攻速爆发暂未实装');
  if (traitId === 'family' && threshold >= 5) notes.push('抢劫奖励暂未实装');
  if (traitId === 'scrap' && threshold >= 6) notes.push(`幸运装备${threshold >= 9 ? '与光明转换' : ''}暂未实装`);
  if (traitId === 'enforcer' && threshold >= 10) notes.push('没收装备暂未实装');
  if (traitId === 'rebel' && threshold >= 10) notes.push('开场及每 12 秒烟雾信号暂未实装');
  if (traitId === 'black-rose' && threshold >= 4) notes.push('黑色玫瑰成员增伤暂未实装');
  if (traitId === 'black-rose' && threshold >= 7) notes.push('赛恩阵亡复活暂未实装');
  if (traitId === 'experiment') notes.push('试验品纹章的分身实验加成暂未实装');
  if (traitId === 'dominator') notes.push('按实际耗蓝增长暂未实装');
  if (traitId === 'emissary') notes.push('实际共享生命暂未实装');
  return notes.length ? `；${notes.join('；')}` : '';
}

/** Describe authored benefits by audience; merge additive flat stats for the member total. */
export function describeTraitTier(definition: TraitDefinition,
  tier: TraitTier): string {
  const text = (effects: readonly Effect[]) => effects.map(describeEffect).filter(Boolean).join('；') || '无';
  const combined: Effect[] = [];
  for (const effect of [...tier.effects, ...(tier.memberEffects ?? [])]) {
    const index = effect.kind === 'statFlat' ? combined.findIndex(value => value.kind === 'statFlat' && value.stat === effect.stat) : -1;
    const prior = combined[index];
    if (index >= 0 && prior.kind === 'statFlat' && effect.kind === 'statFlat') combined[index] = { ...prior, amount: prior.amount + effect.amount };
    else combined.push(effect);
  }
  return `${tier.threshold}：${definition.target === 'team' ? '全队收益' : '职业成员收益'}：${text(tier.effects)}`
    + (tier.memberEffects?.length ? `；职业成员额外收益：${text(tier.memberEffects)}；职业成员最终合计：${text(combined)}` : '')
    + traitTierLimitations(definition.id, tier.threshold);
}

