# augment-pool batch 1 独立审查

审查对象：`review-augpool` @ `700a5e107256dd2f5269121deca5f1b8bf1a8ef9`；基线 `origin/claude/v22-integration` @ `4af5547d7168f078e6a0ad1f24c18a584e4f898f`。范围为 `git diff origin/claude/v22-integration...HEAD`，含前置能力和全部 64 项。审查者未编写本次实现。未修改 src/、tests/ 或 Git，也未提交。

结论：64 项的身份、等级、源常量、解析描述和可执行奖励数量/指定对象未发现抄录差异；但当前候选不能满足“没有见到新强化的 v22 对局保持原行为”：全局扩池立即生效，且运行时身份仍是旧身份。建议先处理以下两项 must-fix，再进入集成。

## must-fix

### M1 — 新规则仍公布旧摘要，v22/v23 身份碰撞

- 位置：`src/simulation/content/rules-manifest.ts:27`、`src/simulation/content/augments.ts:10`；关联未同步文件 `src/simulation/content/identity-constants.ts:3`、`src/simulation/m8/version.ts:12`。
- 增加 manifest 与 64 项定义后，实际摘要已变化，但运行时只导出已提交的常量，不会因 manifest 自动重算。只读调用现有 `recomputeContentDigest()` / `recomputeLootReplayDigest()` 得到：

| 身份 | 当前运行时常量 | 当前内容实际重算 |
|---|---|---|
| CONTENT_DIGEST | `fnv1a32-utf16:2ee7d9d2` | `fnv1a32-utf16:e9e9b43b` |
| LOOT_REPLAY_DIGEST | `fnv1a32-utf16:84b3b60c` | `fnv1a32-utf16:7b8ea5d5` |

- `M8_VERSION` 仍为 `s13-g2-3-v22-online-rules` / `s13-14.24b-g2-3-v22-online-rules`。候选与 v22 因而对外报告相同身份，却有不同候选池和恢复规则；旧存档可能先通过身份检查，再因强化历史不匹配而失败，回放/客户端兼容判断也不能提前识别规则不一致。
- 建议：本候选若可执行，应使用独立候选/v23 身份并同步生成摘要；若必须保留 v22 常量，应将新增实现隔离到不生效的候选模式。历史证据可以保留原字节，无需为此篡改旧 golden。
- 来源：本任务第 3 条；项目 AGENTS.md“不变量：内容或规则变化需同步版本号与内容 digest”；`scripts/content-digest.ts:58`、`scripts/loot-replay-digest.ts:18` 的实际摘要根。`docs/MATCH_CONTRACT.md:3` 的“摘要自然变化”与运行时机制不符；这是已知待办但仍是可执行候选的集成阻塞。

### M2 — 无版本开关的全局扩池改变了全为旧牌的对局

- 位置：`src/simulation/content/augments.ts:10`、`src/simulation/content/augment-policy.ts:87`；调用点 `src/simulation/augment-offers.ts:75`（后者未改，但立即消费全局扩池）。
- 独立从 Git 基线导出 src/ 至 `/tmp`，以相同正常 Match 命令推进至 2-1，seed **5**：

| 版本 | 2-1 候选 |
|---|---|
| v22 基线 | `menaces`, `shojin-spirit`, `portable-forge` |
| 当前候选 | `reunion`, `pyromaniac`, `not-today` |

- 当前三张仍全部属于旧 66 项，没有见到新强化，但结果已改变。对该基线状态执行 `current.restoreMatch(baseline.serializeMatch(oldState))`，抛出 **`Invalid augment offer history`**。50 个种子的 `createMatch(seed)` 初始状态逐字相同，问题在强化节点全局扩池后出现，并非新奖励管线消耗了商店 RNG。
- 这是扩池对固定种子抽样的直接影响，不应误称为奖励 RNG 串流；但仍违反本任务明确的 v22 隔离要求。仅更新摘要会修复 M1，不能保留旧模式的候选序列。建议明确 v22/v23 池及恢复路由，或仅在独立 v23 模式开放扩池；若产品决定接受所有新局候选改变，需要明确调整该验收条件，不能声称“没见新强化就完全不变”。
- 来源：本任务第 3 条；基线 `4af5547d` 的 `content/augments.ts`、`augment-offers.ts`、`choices.ts`；当前 `tests/s13-augments-p2-choice.test.ts:100` 与 `:120` 也已因扩池改用新 seed。

## should-fix

### S1 — 逐项“源参数”测试实际主要是同源互比

- 位置：`tests/augment-pool-batch1.test.ts:42`、`:45`。
- `AUGMENT_TIERS`、`AUGMENT_POOL_API_NAMES`、`AUGMENT_DEFINITIONS` 均直接从同一个 `AUGMENT_BATCH1` 派生。将表中 apiName、tier、gold 或随机奖励数量一起误填，当前这段测试仍可通过；`source.values` 未与执行字段逐项关联，也没有独立的 64 项奖励期待表。
- 本次审查独立读取研究 JSON，未发现已填数据错误；问题是“全部绑定源值”的回归保障不足。建议以独立、固定的来源摘录/期待表核对身份、常量与奖励计划，并保留来源索引，避免将实际实现作为自身 oracle。
- 来源：研究 `data/augments-14.24.json` 各 apiName 记录；classification.md 明细；本报告后面的独立逐项核对表。

### S2 — 明确区分有源奖励数值和未取证的抽样/支付语义

- 位置：`src/simulation/augment-gift-plan.ts:26`、`:35`、`:49`，`docs/MATCH_CONTRACT.md:5`、`:10`。
- 研究给出了“随机”、费用、份数、8/18 金与每回合 1 金，但未给出这些新增随机奖励的逐项权重、有放回独立性、学院赞助三选项等权概率，亦未给出天降金币结算相对利息/准备入口的精确时点。当前代码选择了现有项目池、等权有放回、学院现有池及延迟基础收入支付；合同已有披露，不能据此宣称这些语义已由 14.24 原始数据证明。
- 不判定这些约定数值错误；建议给这些项目约定增加可追溯的决定/沿用依据，验收结论限定为“奖励数值匹配、抽样和时点按项目约定”。下表 `U` 标明受抽样未知项影响的逐项记录；天降金币两项标 `T`。
- 来源：研究 README“四个边界”、`data/augments-14.24.json` 对应记录（仅文字与常量），classification.md:30、:56 等实现建议。分类建议明确准入 G24 completed，但未提供新增奖励的原服概率表。基础组件/辅助/成装/神器池及 4 选等已存在的项目约定不作为新增数值错误重复报告。

## nit

### N1 — 子流注释对插入 spec 的稳定性描述过强

- 位置：`src/simulation/augment-gift-plan.ts:20`、`:23`。
- 子流命名包含数组 `index`。增加已有 item spec 的 count 不影响另一 spec，这点已测；但在 unit spec 之前插入一个 item spec，会改变 unit spec 的 index，从而改变英雄抽样。建议把注释限定为“修改某 spec 的抽样数量不影响其他 spec”，或在确需支持插入稳定性时使用稳定 spec key。
- 来源：代码的 namespace 定义；`tests/augment-pool-batch1-prerequisites.test.ts:16` 只验证 count 变化。此项不表示当前会推进 v22 的 RNG。

## 前置能力审查结果与边界

- 随机隔离：新计划使用不可变 seed 与来源/座位/choice/spec 命名空间的本地 LCG；锻造器用独立 receiptId 派生。未发现推进现有商店、强化候选、战斗、奖励或重铸可变流的代码。学院只重建旧赞助列表，没有推进该状态的现有 RNG。M2 是候选池变化，须与 RNG 串流区分。
- 多锻造器：每个礼物有独立 receiptId、单位实例与固定四选；复用现有四类池，打开顺序不影响选项；现有 anvil 验证会核对出生、打开、选择/超时。生金神器三选池没有实现，相关 2 项已阻塞，不应计为已完成前置。
- 满席：单人英雄和锻造器失败不记收据，保留派生计划，后续 drain 重试；联机英雄先排法球，领取时走现有容量及共享池政策，锻造器不占池。未发现新丢奖/重发缺陷。单人待发与联机容量出售是已有政策差异，不是原版规则取证结论。
- 存档：新来源按拥有的强化、seed 和收据身份重建礼物，物品/消耗品必有收据，单位允许满席待发；anvil/物品/消耗品/单位来源另走现有账本验证。指定范围测试覆盖正常选择、恢复、改奖拒绝、XP、收入、复制器消费和双锻造器。版本碰撞问题见 M1/M2。
- 联机：源码沿用 rewardPolicy / reconcileHoldings；二/三星按 3/9 张入账，召唤物不入池。额外只读合成场景检查 `build-a-bud`、`two-trick`、`missed-connections`、`one-two-five`、`duo-queue`、`heroic-grab-bag`、`one-buff-two-buff`、`final-polish` 的发奖/可领取法球后，池守恒通过；这是局部管线检查，不冒充完整多人对局验收；额外尝试的公共联机路径探针在候选预搜索与实际节点不一致时返回 invalid-choice，未得到新的公共联机恢复结论，不列为产品缺陷。
- 本批没有新增开战静态属性奖励；64 项都由获得奖励/获得 XP/回合收入组成。未发现通过这些前置修改旧战斗属性运算的代码。

## 逐项核对表（覆盖全部 64 项）

来源缩写：`R` = `/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json`；`F` = 同目录 `selection-augment-fields.json`；`C` = `/home/aiapps/workspcae/perf-1022/augment-pool/classification.md`。每行的 `R:行` 是该 apiName 的外部记录，不是代码自带 source 的自证。代码行均指 `src/simulation/content/augment-pool-batch1.ts`。完整中英文描述、所有 effects 常量和 tier 已逐字段对比，64/64 完全相同；指定单位/装备与描述逐项核对。

出牌记号：`普通` = F 中无 AssociatedTraits、没有本批新增的阶段禁用；`羁绊 X` = 3-2/4-2 按现有已批准 v22 场上快照约定，2-1 不按阵容定制；徽/冕均与同羁绊另一级及 built-different（Traitless2）互斥。44 项关联羁绊映射及所有当前已入池对象之间的双向互斥已核对。F 中 Traitless1/3、WhatTheForge 等不在当前目录的历史对象未运行，不列作漏过滤。黑玫瑰两项按 R.source_notes 的官方 14.24 禁 2-1。

差异列 `无` 指未发现身份、奖励数值、指定对象、等级或已确认出牌规则不符；`U`/`T` 仅是 S2 的未取证语义，不是已证实数值错误。全局 M1/M2 适用于整个候选，不在 64 行重复。

| id / 中文名（代码行） | apiName | 等级 | 实际奖励（与 R 描述/常量核对） | 出牌规则 | 差异/证据缺口 | 来源 |
|---|---|---|---|---|---|---|
| `item-grab-bag-i` / 百宝袋 I（:14） | `TFT6_Augment_ItemGrabBag1` | 银 | 1件随机成装 | 普通 | U：抽样按项目约定 | R:1212；F:7068；C 同 apiName 行 |
| `one-two-five` / 一，二，五！（:35） | `TFT6_Augment_OneTwoFive` | 银 | 1件随机基础装备；1个随机5费（1星）；立即2金 | 普通 | U：抽样按项目约定 | R:1707；F:7174；C 同 apiName 行 |
| `band-of-thieves-i` / 窃贼帮派 I（:64） | `TFT7_Augment_BandOfThieves1` | 银 | 1×`thiefs-gloves` | 普通 | 无 | R:41；F:7904；C 同 apiName 行 |
| `teaming-up-i` / 成群结队 I（:84） | `TFT9_Augment_Commander_TeamingUp1` | 银 | 1件随机基础装备；2个随机3费（1星） | 普通 | U：抽样按项目约定 | R:2711；F:9037；C 同 apiName 行 |
| `iron-assets` / 黑铁资产（:111） | `TFT9_Augment_IronAssets` | 银 | 1×`TFT_ArmoryKeyComponent`；立即4金 | 普通 | 无 | R:1133；F:9488；C 同 apiName 行 |
| `missed-connections` / 别再错过（:132） | `TFT9_Augment_MissedConnections` | 银 | 每个1费各1个 | 普通 | 无 | R:1623；F:9691；C 同 apiName 行 |
| `ones-twos-three` / 一二二三（:150） | `TFT9_Augment_OneTwosThree` | 银 | 2个随机1费（1星）；2个随机2费（1星）；1个随机3费（1星） | 普通 | U：抽样按项目约定 | R:1748；F:9827；C 同 apiName 行 |
| `silver-spoon` / 银汤匙（:182） | `TFT9_Augment_SilverSpoon` | 银 | 10XP | 普通 | 无 | R:2378；F:10484；C 同 apiName 行 |
| `heroic-grab-bag` / 英勇福袋（:198） | `TFT10_Augment_HeroicGrabBag` | 金 | 2×`TFT_Consumable_ChampionDuplicator_III`；立即9金 | 普通 | 无 | R:5358；F:326；C 同 apiName 行 |
| `raining-gold` / 天降金币（:221） | `TFT11_Augment_RainingGold` | 金 | 立即8金；每回合1金 | 普通 | T：支付时点按项目约定 | R:6775；F:1187；C 同 apiName 行 |
| `raining-gold-plus` / 天降金币+（:239） | `TFT11_Augment_RainingGoldPlus` | 金 | 立即18金；每回合1金 | 普通 | T：支付时点按项目约定 | R:6818；F:1210；C 同 apiName 行 |
| `academy-crest` / 皮城学院之徽（:257） | `TFT13_Augment_AcademyCrest` | 金 | 1×`TFT13_Item_AcademyEmblemItem`；1×`leona` | 羁绊 academy；同羁绊徽冕/卓尔不群互斥 | 无 | R:3014；F:1765；C 同 apiName 行 |
| `ambusher-crest` / 伏击专家之徽（:279） | `TFT13_Augment_AmbusherCrest` | 金 | 1×`TFT13_Item_AmbusherEmblemItem`；1×`camille` | 羁绊 ambusher；同羁绊徽冕/卓尔不群互斥 | 无 | R:3231；F:1949；C 同 apiName 行 |
| `artillerist-crest` / 炮手之徽（:301） | `TFT13_Augment_ArtilleristCrest` | 金 | 1×`TFT13_Item_DemolitionistEmblemItem`；1×`tristana` | 羁绊 artillerist；同羁绊徽冕/卓尔不群互斥 | 无 | R:3354；F:2151；C 同 apiName 行 |
| `automata-crest` / 海克斯机械之徽（:323） | `TFT13_Augment_AutomataCrest` | 金 | 1×`TFT13_Item_AutomataEmblemItem`；1×`nocturne` | 羁绊 automata；同羁绊徽冕/卓尔不群互斥 | 无 | R:3397；F:2363；C 同 apiName 行 |
| `bruiser-crest` / 格斗家之徽（:345） | `TFT13_Augment_BruiserCrest` | 金 | 1×`TFT13_Item_BruiserEmblemItem`；1×`sett` | 羁绊 bruiser；同羁绊徽冕/卓尔不群互斥 | 无 | R:3748；F:2520；C 同 apiName 行 |
| `black-rose-crest` / 黑色玫瑰之徽（:367） | `TFT13_Augment_CabalCrest` | 金 | 1×`TFT13_Item_CabalEmblemItem` | 羁绊 black-rose；禁2-1；同羁绊徽冕/卓尔不群互斥 | 无 | R:3567；F:2687；C 同 apiName 行 |
| `chem-baron-crest` / 炼金男爵之徽（:385） | `TFT13_Augment_ChembaronCrest` | 金 | 1×`TFT13_Item_CrimeEmblemItem`；1×`renata` | 羁绊 chem-baron；同羁绊徽冕/卓尔不群互斥 | 无 | R:4065；F:2917；C 同 apiName 行 |
| `conqueror-crest` / 铁血征服者之徽（:407） | `TFT13_Augment_ConquerorCrest` | 金 | 1×`TFT13_Item_WarbandEmblemItem`；1×`rell` | 羁绊 conqueror；同羁绊徽冕/卓尔不群互斥 | 无 | R:4320；F:3078；C 同 apiName 行 |
| `dominator-crest` / 统领之徽（:429） | `TFT13_Augment_DominatorCrest` | 金 | 1×`TFT13_Item_InfusedEmblemItem`；1×`blitzcrank` | 羁绊 dominator；同羁绊徽冕/卓尔不群互斥 | 无 | R:4627；F:3239；C 同 apiName 行 |
| `enforcer-crest` / 执法官之徽（:451） | `TFT13_Augment_EnforcerCrest` | 金 | 1×`TFT13_Item_SquadEmblemItem` | 羁绊 enforcer；同羁绊徽冕/卓尔不群互斥 | 无 | R:4709；F:3404；C 同 apiName 行 |
| `experiment-crest` / 试验品之徽（:469） | `TFT13_Augment_ExperimentCrest` | 金 | 1×`TFT13_Item_ExperimentEmblemItem`；1×`urgot` | 羁绊 experiment；同羁绊徽冕/卓尔不群互斥 | 无 | R:4840；F:3575；C 同 apiName 行 |
| `family-crest` / 家人之徽（:491） | `TFT13_Augment_FamilyCrest` | 金 | 1×`TFT13_Item_FamilyEmblemItem`；1×`violet` | 羁绊 family；同羁绊徽冕/卓尔不群互斥 | 无 | R:4883；F:3738；C 同 apiName 行 |
| `firelight-crest` / 野火帮之徽（:513） | `TFT13_Augment_FirelightCrest` | 金 | 1×`TFT13_Item_HoverboardEmblemItem`；1×`zeri` | 羁绊 firelight；同羁绊徽冕/卓尔不群互斥 | 无 | R:4926；F:3903；C 同 apiName 行 |
| `pit-fighter-crest` / 搏击手之徽（:535） | `TFT13_Augment_PitFighterCrest` | 金 | 1×`TFT13_Item_PitFighterEmblemItem`；1×`urgot` | 羁绊 pit-fighter；同羁绊徽冕/卓尔不群互斥 | 无 | R:6478；F:4365；C 同 apiName 行 |
| `quickstriker-crest` / 迅击战士之徽（:557） | `TFT13_Augment_QuickstrikerCrest` | 金 | 1×`TFT13_Item_ChallengerEmblemItem`；1×`akali` | 羁绊 quickstriker；同羁绊徽冕/卓尔不群互斥 | 无 | R:6732；F:4596；C 同 apiName 行 |
| `rebel-crest` / 蓝发小队之徽（:579） | `TFT13_Augment_RebelCrest` | 金 | 1×`TFT13_Item_RebelEmblemItem`；1×`akali` | 羁绊 rebel；同羁绊徽冕/卓尔不群互斥 | 无 | R:6861；F:4753；C 同 apiName 行 |
| `scrap-crest` / 极客之徽（:601） | `TFT13_Augment_ScrapCrest` | 金 | 1×`TFT13_Item_ScrapEmblemItem`；1×`ziggs` | 羁绊 scrap；同羁绊徽冕/卓尔不群互斥 | 无 | R:7394；F:4916；C 同 apiName 行 |
| `sentinel-crest` / 哨兵之徽（:623） | `TFT13_Augment_SentinelCrest` | 金 | 1×`TFT13_Item_TitanEmblemItem`；1×`rell` | 羁绊 sentinel；同羁绊徽冕/卓尔不群互斥 | 无 | R:7437；F:5097；C 同 apiName 行 |
| `sniper-crest` / 狙神之徽（:645） | `TFT13_Augment_SniperCrest` | 金 | 1×`TFT13_Item_SniperEmblemItem`；1×`zeri` | 羁绊 sniper；同羁绊徽冕/卓尔不群互斥 | 无 | R:7663；F:5307；C 同 apiName 行 |
| `sorcerer-crest` / 法师之徽（:667） | `TFT13_Augment_SorcererCrest` | 金 | 1×`TFT13_Item_SorcererEmblemItem`；1×`vladimir` | 羁绊 sorcerer；同羁绊徽冕/卓尔不群互斥 | 无 | R:7747；F:5473；C 同 apiName 行 |
| `visionary-crest` / 先知之徽（:689） | `TFT13_Augment_VisionaryCrest` | 金 | 1×`TFT13_Item_InvokerEmblemItem`；1×`renata` | 羁绊 visionary；同羁绊徽冕/卓尔不群互斥 | 无 | R:9056；F:5735；C 同 apiName 行 |
| `watcher-crest` / 监察之徽（:711） | `TFT13_Augment_WatcherCrest` | 金 | 1×`TFT13_Item_WatcherEmblemItem`；1×`vander` | 羁绊 watcher；同羁绊徽冕/卓尔不群互斥 | 无 | R:9296；F:5967；C 同 apiName 行 |
| `big-grab-bag` / 大百宝袋（:733） | `TFT9_Augment_BigGrabBag` | 金 | 3件随机基础装备；1×`reforger`；立即2金 | 普通 | U：抽样按项目约定 | R:3527；F:8825；C 同 apiName 行 |
| `teaming-up-ii` / 成群结队 II（:761） | `TFT9_Augment_Commander_TeamingUp2` | 金 | 1件随机辅助装；2个随机4费（1星） | 普通 | U：抽样按项目约定 | R:8103；F:9085；C 同 apiName 行 |
| `support-cache` / 辅助宝库（:789） | `TFT9_Augment_SupportCache` | 金 | 1×`TFT_ArmoryKeySupport` | 普通 | 无 | R:8065；F:10534；C 同 apiName 行 |
| `duo-queue` / 双排（:809） | `TFT_Augment_DuoQueue` | 金 | 2个随机5费（1星）；2件相同基础装备 | 普通 | U：抽样按项目约定 | R:4670；F:13395；C 同 apiName 行 |
| `two-trick` / 两把刷子（:837） | `TFT_Augment_TwoTrick` | 金 | 1个随机2费（2星）；2个随机1费（2星） | 普通 | U：抽样按项目约定 | R:8938；F:18718；C 同 apiName 行 |
| `build-a-bud` / 来个好伙计！（:863） | `TFT11_Augment_Buildabud` | 彩 | 1个随机1费（3星）；立即8金 | 普通 | U：抽样按项目约定 | R:10250；F:672；C 同 apiName 行 |
| `radiant-refactor` / 光明重构器（:886） | `TFT11_Augment_RadiantRefactor` | 彩 | 1×`masterwork-upgrade`；1×`TFT_ArmoryKeyComponent` | 普通 | 无 | R:12351；F:1131；C 同 apiName 行 |
| `academy-crown` / 皮城学院之冕（:910） | `TFT13_Augment_AcademyCrown` | 彩 | 1×`TFT13_Item_AcademyEmblemItem`；1件随机学院赞助装备 | 羁绊 academy；同羁绊徽冕/卓尔不群互斥 | U：抽样按项目约定 | R:9567；F:1796；C 同 apiName 行 |
| `ambusher-crown` / 伏击专家之冕（:933） | `TFT13_Augment_AmbusherCrown` | 彩 | 1×`TFT13_Item_AmbusherEmblemItem`；1×`hand-of-justice`；1×`camille` | 羁绊 ambusher；同羁绊徽冕/卓尔不群互斥 | 无 | R:9610；F:1980；C 同 apiName 行 |
| `artillerist-crown` / 炮手之冕（:959） | `TFT13_Augment_ArtilleristCrown` | 彩 | 1×`TFT13_Item_DemolitionistEmblemItem`；1×`runaans-hurricane`；1×`tristana` | 羁绊 artillerist；同羁绊徽冕/卓尔不群互斥 | 无 | R:9817；F:2182；C 同 apiName 行 |
| `automata-crown` / 海克斯机械之冕（:985） | `TFT13_Augment_AutomataCrown` | 彩 | 1×`TFT13_Item_AutomataEmblemItem`；1×`guardbreaker`；1×`nocturne` | 羁绊 automata；同羁绊徽冕/卓尔不群互斥 | 无 | R:9904；F:2394；C 同 apiName 行 |
| `bruiser-crown` / 格斗家之冕（:1011） | `TFT13_Augment_BruiserCrown` | 彩 | 1×`TFT13_Item_BruiserEmblemItem`；1×`redemption`；1×`sett` | 羁绊 bruiser；同羁绊徽冕/卓尔不群互斥 | 无 | R:10207；F:2551；C 同 apiName 行 |
| `black-rose-crown` / 黑色玫瑰之冕（:1037） | `TFT13_Augment_CabalCrown` | 彩 | 1×`TFT13_Item_CabalEmblemItem`；1×`shojin` | 羁绊 black-rose；禁2-1；同羁绊徽冕/卓尔不群互斥 | 无 | R:10028；F:2720；C 同 apiName 行 |
| `chem-baron-crown` / 炼金男爵之冕（:1059） | `TFT13_Augment_ChembaronCrown` | 彩 | 1×`TFT13_Item_CrimeEmblemItem`；1×`nashors-tooth`；1×`smeech` | 羁绊 chem-baron；同羁绊徽冕/卓尔不群互斥 | 无 | R:10511；F:2948；C 同 apiName 行 |
| `conqueror-crown` / 铁血征服者之冕（:1085） | `TFT13_Augment_ConquerorCrown` | 彩 | 1×`TFT13_Item_WarbandEmblemItem`；1×`last-whisper`；1×`rell` | 羁绊 conqueror；同羁绊徽冕/卓尔不群互斥 | 无 | R:10554；F:3109；C 同 apiName 行 |
| `dominator-crown` / 统领之冕（:1111） | `TFT13_Augment_DominatorCrown` | 彩 | 1×`TFT13_Item_InfusedEmblemItem`；1×`protectors-vow`；1×`blitzcrank` | 羁绊 dominator；同羁绊徽冕/卓尔不群互斥 | 无 | R:10679；F:3270；C 同 apiName 行 |
| `enforcer-crown` / 执法官之冕（:1137） | `TFT13_Augment_EnforcerCrown` | 彩 | 1×`TFT13_Item_SquadEmblemItem`；1×`infinity-edge`；1×`maddie` | 羁绊 enforcer；同羁绊徽冕/卓尔不群互斥 | 无 | R:10761；F:3435；C 同 apiName 行 |
| `experiment-crown` / 试验品之冕（:1163） | `TFT13_Augment_ExperimentCrown` | 彩 | 1×`TFT13_Item_ExperimentEmblemItem`；1×`bloodthirster`；1×`urgot` | 羁绊 experiment；同羁绊徽冕/卓尔不群互斥 | 无 | R:10847；F:3606；C 同 apiName 行 |
| `family-crown` / 家人之冕（:1189） | `TFT13_Augment_FamilyCrown` | 彩 | 1×`TFT13_Item_FamilyEmblemItem`；1×`redemption`；1×`vander`；1×`violet` | 羁绊 family；同羁绊徽冕/卓尔不群互斥 | 无 | R:10890；F:3769；C 同 apiName 行 |
| `firelight-crown` / 野火帮之冕（:1219） | `TFT13_Augment_FirelightCrown` | 彩 | 1×`TFT13_Item_HoverboardEmblemItem`；1×`protectors-vow`；1×`scar` | 羁绊 firelight；同羁绊徽冕/卓尔不群互斥 | 无 | R:10971；F:3934；C 同 apiName 行 |
| `pit-fighter-crown` / 搏击手之冕（:1245） | `TFT13_Augment_PitFighterCrown` | 彩 | 1×`TFT13_Item_PitFighterEmblemItem`；1×`steraks-gage`；1×`gangplank` | 羁绊 pit-fighter；同羁绊徽冕/卓尔不群互斥 | 无 | R:12093；F:4396；C 同 apiName 行 |
| `quickstriker-crown` / 迅击战士之冕（:1271） | `TFT13_Augment_QuickstrikerCrown` | 彩 | 1×`TFT13_Item_ChallengerEmblemItem`；1×`rageblade`；1×`nocturne` | 羁绊 quickstriker；同羁绊徽冕/卓尔不群互斥 | 无 | R:12308；F:4627；C 同 apiName 行 |
| `rebel-crown` / 蓝发小队之冕（:1297） | `TFT13_Augment_RebelCrown` | 彩 | 1×`TFT13_Item_RebelEmblemItem`；1×`jeweled-gauntlet`；1×`akali` | 羁绊 rebel；同羁绊徽冕/卓尔不群互斥 | 无 | R:12427；F:4784；C 同 apiName 行 |
| `scrap-crown` / 极客之冕（:1323） | `TFT13_Augment_ScrapCrown` | 彩 | 1×`TFT13_Item_ScrapEmblemItem`；1×`ziggs`；2件随机基础装备 | 羁绊 scrap；同羁绊徽冕/卓尔不群互斥 | U：抽样按项目约定 | R:12507；F:4947；C 同 apiName 行 |
| `sentinel-crown` / 哨兵之冕（:1352） | `TFT13_Augment_SentinelCrown` | 彩 | 1×`TFT13_Item_TitanEmblemItem`；1×`crownguard`；1×`loris` | 羁绊 sentinel；同羁绊徽冕/卓尔不群互斥 | 无 | R:12552；F:5128；C 同 apiName 行 |
| `sniper-crown` / 狙神之冕（:1378） | `TFT13_Augment_SniperCrown` | 彩 | 1×`TFT13_Item_SniperEmblemItem`；1×`infinity-edge`；1×`zeri` | 羁绊 sniper；同羁绊徽冕/卓尔不群互斥 | 无 | R:12677；F:5338；C 同 apiName 行 |
| `sorcerer-crown` / 法师之冕（:1404） | `TFT13_Augment_SorcererCrown` | 彩 | 1×`TFT13_Item_SorcererEmblemItem`；1×`adaptive-helm`；1×`vladimir` | 羁绊 sorcerer；同羁绊徽冕/卓尔不群互斥 | 无 | R:12720；F:5504；C 同 apiName 行 |
| `visionary-crown` / 先知之冕（:1430） | `TFT13_Augment_VisionaryCrown` | 彩 | 1×`TFT13_Item_InvokerEmblemItem`；1×`shojin`；1×`renata` | 羁绊 visionary；同羁绊徽冕/卓尔不群互斥 | 无 | R:13354；F:5766；C 同 apiName 行 |
| `watcher-crown` / 监察之冕（:1456） | `TFT13_Augment_WatcherCrown` | 彩 | 1×`TFT13_Item_WatcherEmblemItem`；1×`steadfast-heart`；1×`scar` | 羁绊 watcher；同羁绊徽冕/卓尔不群互斥 | 无 | R:13567；F:5998；C 同 apiName 行 |
| `final-polish` / 最终润色（:1482） | `TFT_Augment_FinalPolish` | 彩 | 1×`TFT_ArmoryKeySupport`；1×`TFT_ArmoryKeyCompleted` | 普通 | 无 | R:10933；F:13632；C 同 apiName 行 |
| `one-buff-two-buff` / 1个霸符，2个霸符（:1504） | `TFT_Augment_OneBuffTwoBuff` | 彩 | 1×`red-buff`；1×`blue-buff`；1×`TFT_Consumable_NeekosHelp` | 普通 | 无 | R:11889；F:15871；C 同 apiName 行 |

## 不入池项与分类差异

分类批 1 的机器清单为 69 项；本次 64 项（银 8、金 30、彩 26）。以下 5 项未伪造奖励或混进池，且在 `AUGMENT_BATCH1_BLOCKED` 明示原因：`TFT_Augment_BranchingOut`、`TFT9_Augment_AllThatShimmers`、`TFT_Augment_AllThatShimmersPlus`、`TFT_Augment_Coronation`、`TFT_Augment_TacticiansKitchen`。这与交付报告的“完成 64、阻塞 5”一致，不把暂缓项算成 64 项实现错误；也不把分类的批次建议误读为已取得所有前置证据。

## 执行验证

- 按要求使用 `export PATH=$HOME/.local/bin:$PATH`。
- 首次 `npx vitest run tests/*augment*` 因共享只读 node_modules 下 `.vite-temp` 无法写入，在加载配置阶段退出，未运行测试。
- 改为 `npx vitest run --configLoader runner tests/*augment*`：**17 文件、549 测试全部通过**，14.05 秒。两个新增测试文件都已被该 glob 覆盖。
- 未运行完整测试套件、非 augment 测试、构建或 typecheck；摘要核对、基线候选对比与上述发奖场景通过 `/tmp` 只读审查脚本执行，未增加或修改测试文件。
- 没有发现可直接报告的 64 项奖励常量错误；未取证概率/时点如实保留为 S2。此次结果不等同于完整多人压力测试或全部存档变造空间的证明。
