【完成】
- 审计分支 `claude/v24-integration`，235 个可进入候选池的增幅按 apiName 均匹配本地官方 14.24 zh_cn 档案。
- 19 个缺失的名称与说明加入懒加载块；6 个组合增幅名称补全官方“羁绊：”前缀；规则与数值未更改。
- 名称修正表（修改前为文本块加载完成后的实际显示）：

| id | 修改前 | 修改后 |
| --- | --- | --- |
| long-distance-pals | 强化名称加载中… | 天涯若比邻 |
| category-five | 强化名称加载中… | 五级飓风 |
| overheal | 强化名称加载中… | 过量治疗 |
| sated-spellweaver | 强化名称加载中… | 满意的织法者 |
| caretakers-ally | 强化名称加载中… | 游神的盟友 |
| lategame-specialist | 强化名称加载中… | 后期专家 |
| caretakers-favor | 强化名称加载中… | 游神的眷顾 |
| birthday-presents | 强化名称加载中… | 生日礼物 |
| caretakers-chosen | 强化名称加载中… | 游神的神选 |
| called-shot | 强化名称加载中… | 进攻宣告 |
| crafted-crafting | 强化名称加载中… | 精心打造 |
| a-change-of-fate | 强化名称加载中… | 扭转命运 |
| clear-mind | 强化名称加载中… | 清晰头脑 |
| cluttered-mind | 强化名称加载中… | 纷乱头脑 |
| slammin | 强化名称加载中… | 物尽其用 |
| slammin-plus | 强化名称加载中… | 物尽其用+ |
| patience-is-a-virtue | 强化名称加载中… | 耐心是一种美德 |
| invested-plus | 强化名称加载中… | 投资+ |
| invested-plus-plus | 强化名称加载中… | 投资++ |
| mentorship | 军事管制 | 羁绊：军事管制 |
| reunion | 重新联合 | 羁绊：重新联合 |
| geniuses | 天才 | 羁绊：天才 |
| menaces | 危险人物 | 羁绊：危险人物 |
| unlikely-duo | 意外搭档 | 羁绊：意外搭档 |
| sisters | 姐妹 | 羁绊：姐妹 |

- 完整池名称比对测试通过，缺少外部档案时自动跳过；增加常驻回归测试。
- 内容摘要 `fnv1a32-utf16:db662e0b`、回放摘要 `fnv1a32-utf16:18c876b2` 均与原值相同；`scripts/tests/production-size.test.ts` 已与原值一致，无需改动。v24 epoch 无需重新录制。
- 验证：类型检查、生产构建、相关 Vitest 测试及摘要检查通过。
【未完成】
- 官方说明逐字对照仍有 22 条差异：mentorship、reunion、geniuses、menaces、unlikely-duo、sisters、all-for-one-i、trifecta-i、spirit-link、blinding-speed、portable-forge、radiant-relics、going-long、hedge-fund、investment-strategy-ii、defense-call、placebo、manaflow-i、glass-cannon-i、pumping-up-i、investment-strategy-i、bulky-buddies-i。其中有项目自定义执行说明或与规则实现不同的表述；为遵守不改玩法及数值的要求，保留原说明。
- 32 个增幅没有独立说明，客户端显示效果行：firesale、rigged-shop-plus、reinfourcement、prismatic-ticket、subscription-service、starry-night、starry-night-plus、dual-purpose、manaflow-ii、glass-cannon-ii、pumping-up-ii、pumping-up-iii、bulky-buddies-ii、bulky-buddies-iii、placebo-plus、mentorship-i、mentorship-ii、item-collector-i、item-collector-ii、bronze-for-life-i、bronze-for-life-ii、little-buddies、backup、lineup、find-your-center、built-different、blistering-strikes、clockwork-accelerator、lone-hero、climb-the-ladder-i、climb-the-ladder-ii、inspiring-epitaph。
【需要我决定】
- 无。
【风险】
- 比对外部档案的全池测试在档案不存在时会跳过；常驻回归测试仍覆盖关键例子。现有少数自定义说明与官方原文有差异。
【下一步】
- 在含档案的环境继续运行全池测试；如需统一历史自定义说明，请先逐项确认应以官方规则还是本项目实际规则为准。
