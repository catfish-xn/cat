import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { augmentApiName } from '../src/simulation/augment-offers';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentCardSections, augmentDisplayName, augmentPlayerDescription } from '../src/presentation/augment-display';
import { AUGMENT_EXTRA_TEXT } from '../src/presentation/augment-pool-text';
import { loadAugmentText } from '../src/presentation/augment-text-loader';
import { loadTooltipText } from '../src/presentation/tooltip-text-loader';

const RESEARCH_FILE = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';

it.skipIf(!existsSync(RESEARCH_FILE))('shows the official 14.24 Chinese name for every augment in the pool', async () => {
  const archive = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')) as { apiName: string; name_zh_cn: string; description_zh_cn: string }[];
  const byApi = new Map(archive.map(row => [row.apiName, row]));
  await loadAugmentText();
  const ids = Object.keys(AUGMENT_DEFINITIONS).filter(id => AUGMENT_TIERS[id]);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) {
    const api = augmentApiName(id), source = byApi.get(api);
    expect(source?.name_zh_cn, `${id}: missing official name for ${api}`).toBeTruthy();
    expect(augmentDisplayName(id), `${id} (${api})`).toBe(source?.name_zh_cn);
    if (Object.hasOwn(AUGMENT_EXTRA_TEXT, id)) {
      expect(AUGMENT_EXTRA_TEXT[id].description, `${id} template`).toBe(source?.description_zh_cn);
      expect(augmentPlayerDescription(id), `${id} description`).toBe(source?.description_zh_cn.replace(/〔对局动态值〕/g, '未确定'));
    }
  }
});

it('loads the formerly missing batch text and shows the complete team-up names', async () => {
  await loadAugmentText();
  expect(augmentDisplayName('patience-is-a-virtue')).toBe('耐心是一种美德');
  expect(augmentPlayerDescription('patience-is-a-virtue')).toBe('每回合，如果你在上一回合未购买任何弈子，则会获得2次免费刷新。');
  expect(augmentDisplayName('sisters')).toBe('羁绊：姐妹');
  expect(Object.keys(AUGMENT_EXTRA_TEXT)).toHaveLength(19);
});

const auditedOfficialDescriptions: Readonly<Record<string, string>> = {
  "sisters": "获得【姐妹】羁绊。当【蔚】参与一次击杀后，【金克丝】会获得持续5秒的75%额外攻速。当【金克丝】参与一次击杀后，【蔚】会获得持续7秒的40%额外攻击力。\n\n获得1个【金克丝】和1个【蔚】。",
  "all-for-one-i": "你的场上每有一个独特的1费弈子，己方弈子们就会获得2%最大生命值和1.5%伤害增幅。获得2个1费。",
  "trifecta-i": "获得2个3费英雄。战斗开始时：3个随机3费英雄获得250生命值和18%攻击速度。",
  "blinding-speed": "获得1个【红霸符】、1个【鬼索的狂暴之刃】、1个【反曲之弓】和1个【装备拆卸器】。\n\n对你的物理C位非常有用！",
  "portable-forge": "从4件神器中选出1件。\n\n神器是可以提供独特效果的强力装备。",
  "radiant-relics": "从5件光明武器中选出1件。获得1个【装备拆卸器】。\n\n光明武器是各个成装的超级加强版。",
  "going-long": "你不再获得利息。即刻获得15金币。在你的回合开始时，获得4经验。\n\n利息是你每储存10金币时获得的额外金币。",
  "hedge-fund": "获得25金币。你的最大利息提升至10金币。\n\n利息是你每储存10金币时获得的额外金币。",
  "investment-strategy-ii": "获得5金币。你每获得1利息，己方弈子们的最大生命值就永久提高9。你的最大利息提升至7金币。",
  "investment-strategy-i": "你每获得1利息，己方弈子们的最大生命值就永久提高8。",
  "prismatic-ticket": "每当你的商店刷新时，你都有45%几率获得1次免费刷新。",
  "dual-purpose": "你在每回合首次购买经验值时，获得2金币。每当你购买经验值时，刷新你的商店。",
  "mentorship-i": "如果一个弈子在开始战斗时与一个更高费用的友军相邻，那么该弈子获得12%攻击速度和150生命值。",
  "mentorship-ii": "如果一个弈子在开始战斗时与一个更高费用的友军相邻，那么该弈子获得18%攻击速度和220生命值。",
  "little-buddies": "你的每个已登场的1费和2费弈子都会为你的4费和5费弈子们提供65生命值和7%攻击速度。",
  "backup": "如果开始战斗时至少有4个己方弈子在后两排，己方弈子们将获得10%攻击速度。",
  "lineup": "战斗开始时，己方在前两排每有一个弈子，己方弈子们就会获得2.5护甲和魔抗。",
  "blistering-strikes": "己方的攻击会在5秒里持续灼烧目标，造成相当于其5%最大生命值的伤害。攻击还会使目标获得的治疗效果降低33%。",
  "clockwork-accelerator": "你的弈子们在战斗中每过3秒就会获得10%攻击速度。",
  "lone-hero": "你最后一个存活的弈子获得140%攻击速度和35%伤害减免。",
  "climb-the-ladder-i": "每当一名友军阵亡，至少与其共享一个羁绊的己方弈子们会获得3法术强度、3%攻击力、3护甲和3魔抗。",
  "climb-the-ladder-ii": "每当一名友军阵亡，至少与其共享一个羁绊的己方弈子们会获得5法术强度、5%攻击力、5护甲和5魔抗。",
  "item-collector-i": "你的弈子们获得10生命值。你的弈子们每携带一件不同的装备，就会获得额外的2生命值、1攻击力和1法术强度。",
  "item-collector-ii": "你的弈子们获得20生命值。你的弈子们每携带一件不同的装备，就会获得额外的5生命值、1.5攻击力和1.5法术强度。"
};

it('shows the audited official descriptions through the lazy player and card display paths', async () => {
  await loadAugmentText();
  for (const [id, official] of Object.entries(auditedOfficialDescriptions)) {
    expect(augmentPlayerDescription(id), id).toBe(official);
    expect(augmentCardSections(id).body, id).toBe(official);
  }
});

it('retains descriptions for known project-specific rules and missing dynamic values', async () => {
  await Promise.all([loadAugmentText(), loadTooltipText()]);
  expect(augmentPlayerDescription('placebo')).toBe('获得时按阶段一次性获得金币：2阶段8、3阶段11、4阶段及以后15；全队获得1%攻速。');
  expect(augmentPlayerDescription('manaflow-i')).toBe('战斗开始时，你后2排的弈子的每次攻击都会获得2额外法力值。');
  expect(augmentPlayerDescription('manaflow-ii')).toBe('战斗开始时，你后2排的弈子的每次攻击都会获得4额外法力值。');
  expect(augmentPlayerDescription('glass-cannon-i')).toBe('在后排开始战斗的弈子，在战斗开始时的生命值为80%，但会获得12%的伤害增幅。');
  expect(augmentPlayerDescription('glass-cannon-ii')).toBe('在后排开始战斗的弈子，在战斗开始时的生命值为80%，但会获得20%的伤害增幅。');
  expect(augmentPlayerDescription('bulky-buddies-i')).toBe('开战时恰与一个友军相邻的单位获得100生命；该邻居死亡时，获得10%最大生命的10秒盾。');
  expect(augmentPlayerDescription('mentorship')).toContain('魔改执行：');
  expect(augmentPlayerDescription('starry-night')).toBe('你商店中的1费和2费弈子有几率成为2星。获得6金币。\n\n当前几率：未确定%\n几率随玩家等级提升。');
  expect(augmentPlayerDescription('bronze-for-life-i')).toBe('每个当前铜级羁绊全队3%增伤；不是所有最低阈值。');
  const allyTemplate = AUGMENT_EXTRA_TEXT['caretakers-ally'].description;
  expect(augmentPlayerDescription('caretakers-ally')).toBe(allyTemplate.replace('〔对局动态值〕', '未确定'));
  const ally = { values: [{ unit: 'zeri' }] };
  expect(augmentPlayerDescription('caretakers-ally', ally)).toBe(allyTemplate.replace('〔对局动态值〕', '泽丽'));
  expect(augmentCardSections('caretakers-ally', ally).body).toBe(allyTemplate.replace('〔对局动态值〕', '泽丽'));
  // These formerly missing cards now use the official archive prose; rules stay unchanged.
  expect(augmentPlayerDescription('built-different')).toBe('你的弈子们只要不具有任何已激活的羁绊，就会获得240-530生命值和45-60%攻击速度（基于当前阶段）。');
  expect(augmentPlayerDescription('placebo-plus')).toBe('获得15金币。你的弈子们获得1%攻击速度。');
});

it.skipIf(!existsSync(RESEARCH_FILE))('matches the audited descriptions to the independent 14.24 archive', async () => {
  const archive = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')) as { apiName: string; description_zh_cn: string }[];
  const byApi = new Map(archive.map(row => [row.apiName, row.description_zh_cn]));
  for (const [id, official] of Object.entries(auditedOfficialDescriptions)) {
    expect(official, id).toBe(byApi.get(augmentApiName(id)));
  }
});
