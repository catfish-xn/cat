import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { traitDisplayValues, traitSummary, traitTierText } from '../src/presentation/trait-text';
import { CURRENT_TRAIT_OFFICIAL_TEXT as TRAIT_OFFICIAL_TEXT } from '../src/presentation/trait-text';
import { describeTraitTier } from '../src/presentation/effect-text';
import { TEAMUP_IDS } from '../src/simulation/content/v20-traits';
import { V20_OFFICIAL_TRAIT_TEXT, V20_TEAMUP_DISPLAY_SOURCE } from '../src/simulation/content/v20-trait-text';

const row = (id: string, threshold: number) => {
  const definition = TRAIT_DEFINITIONS[id];
  return traitTierText(definition, definition.tiers.find(t => t.threshold === threshold)!);
};
const archive = (name: string) => JSON.parse(gunzipSync(readFileSync(`src/simulation/content/source/s13-14.24b/raw/${name}.json.gz`)).toString());

describe('14.24 official trait text with executable values', () => {
  it('covers exactly the 35 active traits and 94 tiers; preserves every archived Chinese description', () => {
    const zh = archive('zh_cn.tft.stringtable').entries;
    // Source coverage is independent of presentation integration. The per-trait
    // rendering checks below must still fail until Claude connects the new data.
    const officialText = { ...TRAIT_OFFICIAL_TEXT, ...V20_OFFICIAL_TRAIT_TEXT };
    expect(Object.keys(officialText).sort()).toEqual(Object.keys(TRAIT_DEFINITIONS).sort());
    expect(Object.keys(TRAIT_DEFINITIONS)).toHaveLength(35);
    expect(Object.values(TRAIT_DEFINITIONS).reduce((n, d) => n + d.tiers.length, 0)).toBe(94);
    for (const [id, source] of Object.entries(officialText)) {
      const original = zh[`tft_trait_description_${source.apiName.toLowerCase()}`];
      if (id === 'high-roller') {
        expect(original).toBeUndefined();
        expect(source.locale).toBe('en_us');
      } else {
        expect(source.locale).toBe('zh_cn');
        expect(source.description).toBe(original);
      }
    }
  });
  it.each(TEAMUP_IDS)('%s preserves the archived official trait API, Chinese clauses and tier values', id => {
    const source = V20_OFFICIAL_TRAIT_TEXT[id];
    const archived = archive('en_us').setData.find((set: { mutator: string }) => set.mutator === 'TFTSet13')
      .traits.find((trait: { apiName: string }) => trait.apiName === source.apiName);
    expect(archived, `Missing archived trait: ${source.apiName}`).toBeDefined();
    expect(source.description).toBe(archive('zh_cn.tft.stringtable').entries[`tft_trait_description_${source.apiName.toLowerCase()}`]);
    expect(source.description).not.toBe('');
    const tiers = V20_TEAMUP_DISPLAY_SOURCE[id].tiers;
    expect(tiers.map(tier => tier.threshold)).toEqual(TRAIT_DEFINITIONS[id].tiers.map(tier => tier.threshold));
    expect(tiers.map(tier => tier.threshold)).toEqual(archived.effects.map((effect: { minUnits: number }) => effect.minUnits));
    for (const [index, tier] of tiers.entries()) {
      for (const [name, value] of Object.entries(tier.values)) {
        expect(value).toBeCloseTo(archived.effects[index].variables[name], 6);
      }
      for (const [, token] of source.description.matchAll(/@([^@]+)@/g)) {
        expect(Object.hasOwn(tier.values, token.replace(/\*100$/, '')), `Missing ${id} display token: ${token}`).toBe(true);
      }
    }
  });
  it.each(Object.keys(TRAIT_DEFINITIONS))('%s fills all official rows, icons and summaries without losing clauses', id => {
    const definition = TRAIT_DEFINITIONS[id];
    for (const tier of definition.tiers) {
      const summary = traitSummary(id, tier.threshold), text = row(id, tier.threshold);
      expect(summary).toBeTruthy();
      expect(text.startsWith(`(${tier.threshold}) `)).toBe(true);
      expect(`${summary}\n${text}`.replaceAll('下一 tick 冲刺', '下一刻冲刺')).not.toMatch(/@|<|%i:|NaN|undefined|[a-z]{4,}/);
    }
  });
  it('uses official team/member wording and the current total AP rather than the replaced custom prose', () => {
    expect(traitSummary('sorcerer')).toBe('你的队伍获得10法术强度。【法师】们获得更多法术强度。');
    expect(traitSummary('sentinel')).toBe('你的队伍获得护甲和魔抗。【哨兵】们获得三倍。');
    for (const [threshold, value] of [[2, 20], [4, 50], [6, 95], [8, 125]]) expect(row('sorcerer', threshold)).toContain(`(${threshold}) ${value} 法术强度`);
    for (const [threshold, value] of [[2, 12], [4, 25], [6, 42]]) expect(row('sentinel', threshold)).toBe(`(${threshold}) ${value} 护甲和魔抗`);
    expect(row('sorcerer', 8)).toContain('技能会对其目标造成持续3秒的25%伤害削减');
  });
  it.each([
    ['automata', 6, ['1100伤害', '140 护甲和魔抗']],
    ['visionary', 8, ['100% 法力值', '技能会治疗一名友军，数额相当于该技能的20%已造成伤害']],
    ['sniper', 4, ['每格18%伤害']], ['sniper', 6, ['每格36%伤害', '额外的5攻击距离']],
    ['academy', 6, ['9% 生命值 伤害增幅']], ['academy', 3, ['2%', '获得1件赞助装备。']],
    ['chem-baron', 7, ['30或100', '220 生命值']],
    ['firelight', 4, ['40%已承受伤害']],
    ['enforcer', 8, ['5个敌人被通缉', '40% 生命值', '50% 伤害增幅']],
    ['enforcer', 10, ['所有敌人都被通缉', '100% 生命值', '150% 伤害增幅']],
    ['family', 4, ['30%缩减', '20% 攻击速度']], ['family', 5, ['40%缩减', '去上城搞钱！']],
    ['scrap', 9, ['生成光明版装备！', '60护盾值']],
    ['artillerist', 6, ['70% 攻击力', '每攻击4次', '双倍伤害']],
    ['rebel', 7, ['45% 攻击力和法术强度', '15% 生命值', '晕眩所有敌人2秒']],
    ['rebel', 10, ['战斗开始时以及之后的每 12秒触发']],
    ['pit-fighter', 8, ['40%真实伤害', '80% 生命值']],
    ['experiment', 5, ['3个【试验格】', '300 生命值']], ['experiment', 7, ['加成提升100%！']],
    ['black-rose', 3, ['施放5次技能', '65%生命值']],
    ['conqueror', 9, ['100% 攻击力和法术强度', '20x【征服】层数']],
    ['quickstriker', 4, ['40-100% 攻击速度', '在目标阵亡时', '持续3秒的200护盾值']],
    ['dominator', 6, ['700护盾值', '65% 法术强度']],
    ['bruiser', 6, ['80% 生命值']], ['watcher', 6, ['35%或50% 伤害减免']],
    ['ambusher', 2, ['25% 暴击几率；10% 暴击伤害']],
    ['ambusher', 5, ['55% 暴击几率；25% 暴击伤害', '15%伤害减免']],
  ] as const)('%s %i retains official key clauses with current values', (id, threshold, parts) => {
    for (const part of parts) expect(row(id, threshold)).toContain(part);
  });
  it.each([
    ['scrap', 6, '所有基础装备和成装都会成为幸运装备！'],
    ['scrap', 9, '生成光明版装备！'], ['enforcer', 10, '没收敌人的所有装备！'],
  ] as const)('%s %i appends the marker to the original deferred clause', (id, threshold, clause) => {
    expect(row(id, threshold)).toContain(`${clause}（暂未实装）`);
  });
  it.each([
    ['quickstriker', '移速 ×1.5；4 档当前目标阵亡后下一 tick 冲刺至新目标旁合法格（魔改执行）。'],
    ['firelight', '魔改执行：每 6 秒冲刺，1 秒窗口内无限射程，攻速 +350%（工程取值），按实际承伤回复，撤离到 2 格内落点。'],
  ] as const)('%s replaces deferred markers with execution notes in summaries and tier rows', (id, note) => {
    const definition = TRAIT_DEFINITIONS[id];
    for (const tier of definition.tiers) {
      for (const text of [traitSummary(id, tier.threshold), row(id, tier.threshold)]) {
        expect(text).not.toContain('暂未实装');
        expect(text).toContain(note);
      }
      expect(describeTraitTier(definition, tier)).not.toContain('暂未实装');
    }
    expect(row(id, 4)).toContain(id === 'quickstriker'
      ? '【迅击战士】们会冲刺至一个新目标'
      : '在冲刺时，获得巨额爆发攻速加成。');
  });
  it('keeps summary clauses verbatim without hiding implemented benefits', () => {
    expect(traitSummary('quickstriker', 4)).toContain('【迅击战士】移动得更快且获得攻击速度');
    expect(traitSummary('firelight', 4)).toContain('他们会进行一次无限距离的攻击并治疗自身');
    expect(traitSummary('dominator', 6)).toContain('会基于已消耗的法力值获得可叠加的法术强度。');
    expect(traitSummary('dominator', 6)).not.toContain('暂未实装');
    expect(traitSummary('emissary', 4)).toContain('获得他的12%最大生命值。');
    expect(traitSummary('emissary', 4)).not.toContain('暂未实装');
    expect(row('rebel', 10)).not.toContain('暂未实装');
    expect(row('black-rose', 4)).not.toContain('暂未实装');
    expect(row('black-rose', 7)).not.toContain('暂未实装');
    expect(traitSummary('emissary', 4)).toContain('【娜美】： 己方弈子的每次普攻提供2额外法力值。');
    expect(traitSummary('black-rose', 7)).toBe('【黑色玫瑰】弈子们的每个星级都会提升【赛恩】的强度');
  });
  it('translates the complete English High Roller text, including all four mods and all numeric tokens', () => {
    const original = archive('en_us').setData.find((s: { mutator: string }) => s.mutator === 'TFTSet13').traits.find((t: { apiName: string }) => t.apiName === 'TFT13_HighRoller').desc;
    const tokens = (text: string) => [...text.matchAll(/@([^@]+)@/g)].map(m => m[1]).sort();
    expect(tokens(TRAIT_OFFICIAL_TEXT['high-roller'].description)).toEqual(tokens(original));
    const text = traitSummary('high-roller', 1)!;
    for (const clause of ['持续1.5秒的80%伤害减免', '发射8枚火箭，每枚造成100物理伤害', '持续4秒的500护盾值', '获得3金币', '三倍：强化她抽取到的技能！']) expect(text).toContain(clause);
  });
  it('keeps the corrected executable numbers and official continuous-healing phrase', () => {
    expect(traitSummary('conqueror', 9)).toContain('这个加成就会提升5%');
    expect(traitSummary('pit-fighter', 8)).toContain('在2秒里持续治疗自身');
    expect(traitSummary('artillerist', 6)).toContain('造成250%攻击力的伤害');
    expect(traitSummary('academy', 6)).toContain('额外的5%生命值和伤害增幅');
    expect(traitDisplayValues('sorcerer', 8)?.BaseAP).toBe(125);
    expect(traitDisplayValues('enforcer', 10)?.['PercentMaxHealthShield*100*100']).toBe(100);
    for (const id of ['quickstriker', 'visionary']) for (const tier of TRAIT_DEFINITIONS[id].tiers) expect(describeTraitTier(TRAIT_DEFINITIONS[id], tier)).not.toMatch(/NaN|undefined|g23Trait|quickstriker|visionary/);
  });
  it('returns null for unknown trait summaries', () => {
    expect(traitSummary('not-a-trait')).toBeNull();
    expect(traitSummary('__proto__')).toBeNull();
  });
});
