import { describe, expect, it } from 'vitest';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { traitSummary, traitTierText } from '../src/presentation/trait-text';
import { describeTraitTier } from '../src/presentation/effect-text';

describe('trait rule text', () => {
  it.each(Object.keys(TRAIT_DEFINITIONS))('%s has a filled summary and readable tier rows', id => {
    const definition = TRAIT_DEFINITIONS[id];
    for (const tier of definition.tiers) {
      const summary = traitSummary(id, tier.threshold), row = traitTierText(definition, tier);
      expect(summary).toBeTruthy(); expect(summary).not.toMatch(/@|<|%i:/);
      expect(row.startsWith(`${tier.threshold}：`)).toBe(true);
      expect(row).not.toMatch(/@|<|%i:|g23Trait|visionary|[a-z]{4,}/);
    }
  });
  it('fills tier rows from the rules source and drops clauses a tier has no value for', () => {
    const ambusher = TRAIT_DEFINITIONS.ambusher, quick = TRAIT_DEFINITIONS.quickstriker;
    expect(traitTierText(ambusher, ambusher.tiers[0])).toBe('2：暴击几率 +25%，暴击伤害 +10%');
    expect(traitTierText(ambusher, ambusher.tiers.at(-1)!)).toContain('伤害减免 15%');
    expect(traitTierText(quick, quick.tiers[0])).not.toContain('护盾');
    expect(traitTierText(quick, quick.tiers.at(-1)!)).toContain('200 护盾');
    expect(traitTierText(quick, quick.tiers[0])).toContain('当前目标已损失生命比例');
    expect(traitTierText(quick, quick.tiers[0])).not.toContain('自身生命');
  });
  it('keeps the authored-effect wording for traits without a row template', () => {
    expect(traitTierText(TRAIT_DEFINITIONS.sentinel, TRAIT_DEFINITIONS.sentinel.tiers[0])).toContain('职业成员最终合计');
  });
  const row = (id: string, threshold: number) => {
    const definition = TRAIT_DEFINITIONS[id];
    return traitTierText(definition, definition.tiers.find(t => t.threshold === threshold)!);
  };
  it.each([
    ['automata',6,['护甲 +140','魔抗 +140','1100','25%']],
    ['sorcerer',8,['其他友军法强 +10','法师最终法强 +125','25%','3 秒','下一战斗帧']],
    ['visionary',8,['100%','20%','实际生命伤害','其他友军']],
    ['sniper',4,['18%']], ['sniper',6,['36%','距离 +5']],
    ['academy',6,['9%','5%']],
    ['chem-baron',7,['30 微光','100','65 微光','+15','+220']],
    ['firelight',4,['6 秒','40%']],
    ['enforcer',8,['40%','50%','5 名','30%']],
    ['enforcer',10,['100%','150%','全部敌人','30%']],
    ['family',4,['30%','20%']], ['family',5,['40%','20%']],
    ['scrap',9,['60 护盾','20 秒']],
    ['artillerist',6,['60%','4 次','250%']],
    ['rebel',10,['50%','30%','2 秒','60%']],
    ['pit-fighter',8,['15%','40%','50%','2 秒','80%']],
    ['experiment',7,['3 个','+300','100%']],
    ['black-rose',7,['继承 5 档','星级成长']],
    ['conqueror',9,['100%','20 层']],
    ['quickstriker',4,['40%','100%','目标阵亡','队友击杀','200 护盾','3 秒']],
  ] as const)('%s %i describes the executable v18 tier', (id, threshold, parts) => {
    for (const part of parts) expect(row(id,threshold)).toContain(part);
  });
  it.each([
    ['family',5,'抢劫奖励'],['scrap',6,'幸运装备'],['scrap',9,'光明转换'],
    ['enforcer',10,'没收装备'],['rebel',10,'烟雾信号'],['black-rose',7,'复活'],
    ['firelight',4,'攻速爆发'],['quickstriker',4,'移速与冲刺'],['experiment',7,'分身实验加成'],
    ['dominator',6,'按实际耗蓝增长'],['emissary',4,'实际共享生命'],
  ] as const)('%s %i explicitly marks delayed %s', (id, threshold, mechanism) => {
    expect(row(id,threshold)).toMatch(new RegExp(`${mechanism}[^；]*暂未实装`));
    const definition=TRAIT_DEFINITIONS[id],tier=definition.tiers.find(t=>t.threshold===threshold)!;
    expect(describeTraitTier(definition,tier)).toContain('暂未实装');
  });
  it('shows corrected mechanics in summaries and direct authored-effect descriptions', () => {
    expect(traitSummary('conqueror',9)).toContain('5%');
    expect(traitSummary('pit-fighter',8)).toContain('2 秒内逐战斗帧');
    expect(traitSummary('pit-fighter',8)).not.toContain('立即治疗');
    expect(traitSummary('quickstriker',4)).not.toContain('自身生命');
    expect(row('sorcerer',8)).not.toContain('+110');
    expect(row('dominator',6)).toContain('最大法力值 65%');
    for(const id of ['quickstriker','visionary']) {
      const definition=TRAIT_DEFINITIONS[id];
      for(const tier of definition.tiers) expect(describeTraitTier(definition,tier)).not.toMatch(/NaN|undefined|g23Trait|quickstriker|visionary/);
    }
  });
});
