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
    const v = effect.values, pct = (key: string) => `${v[key] / 100}%`;
    const descriptions: Record<string, string> = {
      rageblade: `每次普攻叠加 ${pct('attackSpeedBps')} 攻速`, damageAmp: `伤害增幅 ${pct('bps')}`,
      extraAttackMana: `每次普攻额外 ${v.amount} 法力${v.backRowOnly ? '（最后一排）' : ''}`,
      archangel: `每 ${v.periodTicks * .05} 秒增加 ${v.abilityPower} 法强`, dragonClaw: `每 ${v.periodTicks * .05} 秒治疗 ${pct('healMaxHpBps')} 最大生命`,
      gargoyle: `每个以持有者为目标的敌人增加 ${v.resistPerEnemy} 双抗`, gunblade: `实际伤害的 ${pct('selfHealBps')} 自疗、${pct('allyHealBps')} 治疗最低生命比例友军`,
      artillery: `每 ${v.everyN} 次普攻造成 ${pct('adBps')} 攻击力 范围物理伤害`, sniper: `每格距离增加 ${pct('damageBpsPerHex')} 伤害`,
      watcher: `减伤 ${pct('reductionBps')}；生命超过 ${pct('thresholdBps')} 时为 ${pct('healthyReductionBps')}`,
      acquisitionGold: `立即获得 ${v.amount} 金币`, glassCannon: `最后一排初始生命 ${pct('startingHealthBps')}、伤害增加 ${pct('damageAmpBps')}`,
      pumpingUp: `每轮增加 ${pct('attackSpeedBpsPerRound')} 攻速`, investment: `每点利息永久增加 ${v.healthPerInterest} 生命`,
      bulkyBuddies: `相邻双人组获得 ${v.health} 生命，触发 ${pct('shieldMaxHpBps')} 最大生命护盾，持续 ${v.durationTicks * .05} 秒`,
      titanic: `普攻附加 ${pct('adBps')} 攻击力 物理伤害，命中目标及相邻格`, mageArmor: `获得最终法强 ${pct('apBps')} 的双抗`, killStreak: `击杀后存活获得 ${v.mana} 法力`,
      // G2 traits: values exactly as authored in TRAIT_DEFINITIONS (bps → %, ticks → seconds), see MATCH_CONTRACT G2-2.
      automata: `造成伤害积累水晶，满 ${v.crystals} 个时对目标造成 ${v.damage} 魔法伤害 + 期间伤害的 ${pct('conversionBps')}`,
      firelight: `每 ${v.periodTicks * .05} 秒冲刺，治疗期间所受伤害的 ${pct('healBps')}${v.attackSpeedBps ? `，冲刺时攻速 +${pct('attackSpeedBps')}` : ''}`,
      family: `最大法力 -${pct('manaReductionBps')}，减伤 ${pct('damageReductionBps')}`,
      rebel: `我方损失 ${pct('thresholdBps')} 生命后：攻速 +${pct('attackSpeedBps')} 持续 ${v.durationTicks * .05} 秒，攻击力/法强 +${pct('adApBps')}`
        + `${v.bonusHpBps ? `、最大生命 +${pct('bonusHpBps')}` : ''}${v.stunTicks ? `，眩晕全部敌人 ${v.stunTicks * .05} 秒` : ''}`,
      enforcer: `开战获得 ${pct('shieldBps')} 最大生命护盾；生命最高的 ${v.wanted} 名敌人被通缉，通缉目标阵亡时攻速 +${pct('attackSpeedBps')}`,
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

/** Describe authored benefits by audience; merge additive flat stats for the member total. */
export function describeTraitTier(definition: TraitDefinition,
  tier: TraitTier): string {
  const text = (effects: readonly Effect[]) => effects.map(describeEffect).join('；') || '无';
  const combined: Effect[] = [];
  for (const effect of [...tier.effects, ...(tier.memberEffects ?? [])]) {
    const index = effect.kind === 'statFlat' ? combined.findIndex(value => value.kind === 'statFlat' && value.stat === effect.stat) : -1;
    const prior = combined[index];
    if (index >= 0 && prior.kind === 'statFlat' && effect.kind === 'statFlat') combined[index] = { ...prior, amount: prior.amount + effect.amount };
    else combined.push(effect);
  }
  return `${tier.threshold}：${definition.target === 'team' ? '全队收益' : '职业成员收益'}：${text(tier.effects)}`
    + (tier.memberEffects?.length ? `；职业成员额外收益：${text(tier.memberEffects)}；职业成员最终合计：${text(combined)}` : '');
}

