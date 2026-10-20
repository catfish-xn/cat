# D11：独立内容包，等待集成方接线

基线：`origin/multiplayer` @ `a0d42c592cbd48fb075175e5f61818dabfe1b320`，2026-10-20 经 `ls-remote` 与 fetch 核实。指定远端分支原先不存在，从此提交新建 `codex/content-augments-anomalies-fill`，PR #231 保持草稿。初次仅审计提交之后，调度方明确允许继续交付独立新增文件包，并补充任务入口记载：注册表、digest、版本和当前夹具最后由集成方处理。未再把未提供额外规则附件作为停止理由。

**交付：3 个强化的独立编译/发放包，2 个异常的独立计算/收据机制。尚未生产接线。** 当前生产计数仍为强化 **57**、异常 **52**，CONTENT_DIGEST 仍为 `fnv1a32-utf16:ea6b11b6`。未来接入 3 个强化后可达到 60；两个异常机制亦需完整接线后才能计入，不能声称当前已到 54 或 57。

## 新增清单与逐项来源

全部来源是仓库保留的 14.24 raw；源文件 SHA256 见 `preflight.json` 和 `candidate-reconciliation.json`。独立来源模块 `src/simulation/content/d11-fill-source.ts` 保存各项字段、官方中文 stringtable key 和标准池指针；测试直接解压 raw 逐字段对账，不以本模块自证。

| 新增独立条目 | raw 身份 / 指针 | 主效果与交付状态 |
| --- | --- | --- |
| 一费奉献 I（银） | `TFT_Augment_AllForOneI` / `{f5b94eaa}` | 获得 2 个 1 费；场上独特 1 费英雄每种给全队 2% 最大生命、1.5% 增伤。独立编译与发放可用。 |
| 三项赛 I（金） | `TFT_Augment_Trifecta1` / `{1d0f1cc4}` | 获得 2 个 3 费；开战随机至多 3 个 3 费各 +250 生命、18% 攻速。独立编译与发放可用。 |
| 灵魂连接（金） | `TFT_Augment_SpiritLink1` / `{4cb3bb7d}` | 每 100 tick 自疗 5% 最大生命，每失去 10 玩家生命增加 0.5 个百分点。生成既有 M8 periodic/heal 程序。 |
| 贪财化身 | `TFT13_GoopBuff_AvariceIncarnate` / `{af3697d1}` | 一次 +5 金币；实时金币样本给 15% + 每 2 金币 1 个百分点，总计上限 40%。交付实时计算、一次性金币接口及单次样本战斗程序；战中经济/伤害接线未完成。 |
| 猎头者 | `TFT13_GoopBuff_Headhunter` / `{950ff929}` | 15% 攻速起，每击杀一个敌方英雄永久 +1 个百分点。交付击杀收据归并、重复拒绝与攻速投影；战中击杀/结算/恢复接线未完成。只处理标准模式，未启用狂暴模式的翻倍。 |

强化准入：`en_us.json.gz.setData[mutator === TFTSet13_Evolved].augments` 与基础 `TFTSet13.augments` 均包含以上 3 个 API ID。等级通过 map22 `ItemTags` 核验：银 `{d11fd6d5}`，金 `{ce1fd21c}`，不根据图标文件名猜等级。数值同时来自 `en_us.items[].effects`，中文来自 `zh_cn.tft.stringtable.json.gz.entries`。

异常准入：`map22.bin.json.gz[Maps/Shipping/Map22/Sets/TFTSet13_Evolved][{e6c62bd9}]` 指向 `{cc0b6cb2}`，基础 TFTSet13 指向 `{e6ddca72}`；两池的 `{9a7587b2}` 条目通过 `{16c534fd}` 指向上述异常记录。这 5 个真正缺失候选均未被显式设零权重，精确条目保存在 `candidate-reconciliation.json`。这只是准入证据，未改变任何抽取概率。

去重：逐项比较生产 ID、raw API ID、G23/P2/P3/P4 来源映射与 SOURCE_MANIFEST，测试核实新增 5 个定义均未注册。特别排除旧别名：MagicMind=魔法专家、HardenedMind=防御专家、SharpenedMind=物理专家、AllForOne=友谊之力、ShouldertheBurden=防御型护盾。最初按英文别名得到的候选已撤回，没有把这些已有内容重复实现。强化 I 与 II 是不同 raw API 身份，不覆盖既有 II 级。

## 模块接口与数值验证

- `content/d11-fill.ts`：`D11_FILL_ACTIVATION='unwired-awaiting-integration'`，独立定义类型刻意不含生产 `effects` 字段，无法直接当作完整 ChoiceDefinition 注册。需显式调用下列编译 API，不留空效果占位。
- `d11-fill.ts::compileD11Augment(id, board, playerHp, openingRngState)`：返回各单位 effects / ItemProgram 与下一 RNG 状态、词数。编译应发生在 `resolveEffects` 之前；程序按源实例绑定。三项赛使用调用方明确传入的开战流，按 ID 排序后部分 Fisher-Yates，至多消费 3 个词；没有擅自接入或消耗现有生产流。
- `d11GiftPlan` / `drainD11Gifts`：按种子、席位、choiceId、definitionId 派生独立计划，既有 `grantMechanicUnit` 完成共享池政策、合星、满备战席延后及唯一收据。重试不换英雄、不推进四条生产 RNG；缺池由调用方 UnitLootPolicy 按英雄费用补金币。调用方必须先提交真实强化选择，再在同一权威事务内提交礼物。
- `d11AvariceDamageAmpBps(liveGold)` 必须在伤害/属性采样时读实时金币；**禁止开战冻结后冒充实时效果**。`grantD11AvariceGold` 通过已有金币收据重复拒绝。`compileD11Anomaly` 只编译一个明确事实样本，集成方必须在金币/击杀变化时刷新，不是完整自动监听器。
- `recordD11HeadhunterKills` 使用真实 combatId/eventSeq 去重，排除友军、召唤物与助攻；复活后再次死亡以不同事件计数。相同战斗再次提交保持原 journal 引用，冲突事实拒绝。journal 可 JSON 往返，但这不等同于生产恢复边界已接受；集成方须从可信战斗账本重建验证，不能信任存档自报计数。

独立测试包括：一费奉献 2 种独特 1 费得 4% HP 与 3% 实际攻击增伤；三项赛选 3 个不同英雄和 250HP/1800Bps；灵魂连接第 99 tick 不治疗、第 100 tick 对 500HP 分别治疗 25/27/37/50；贪财化身 0/1/2/49/50/100 金币对 100 原始攻击得 115/115/116/139/140/140 伤害；猎头者实际引擎击杀后 1600Bps、跨战斗投影及复活/重放边界。礼物覆盖一次性、满备战席重试、缺池补金币，未改旧测试。

显式项目约定：灵魂连接以开战时的 100-玩家生命取完整十点组，增量按最大生命百分点解释；三项赛排序和 RNG 词分配、独立礼物种子命名空间、贪财化身总增伤上限解释、击杀按事件身份计数均在代码和测试可见。raw 未提供 Lua 脚本体，不把这些离散执行细节声称为原版脚本精确复现。既有 P1 贪财原型仅作为历史上下文，未恢复其生产注册。

## 剩余 3 个异常：具体必要变更

| 未实现候选 | 标准池 / raw 证据 | 最小缺口；未越界处理 |
| --- | --- | --- |
| 终极英雄 | `{cf1ee294}`，`NumRounds=3`，3 星 1 费变 4 星，两标准池均有引用 | `unit-types.ts::StarLevel` 仅 1\|2\|3，`unit-stats.ts::STAR_PERCENT` 会拒绝 4；还需英雄技能的 4 星数值、合星/出售/恢复边界。不能只新增一个“变4星请求”就算效果完成。 |
| 进入未知 | `{711fd99c}`，消失 3 回合，回来 +50%AD、50AP，排除 AnotherAnomaly | `UnitLocation` 仅 board/bench；现有回合生命周期没有离场保留共享池拷贝、装备、绑定并安全归位的权威收据/槽位。需 match/单位获取/换轮/恢复接线，缺位不可擅自卖出或退池。 |
| 名片 | `{b577dcbe}`，获得匹配持有者非唯一羁绊的 1 个纹章；两标准池正准入 | 生产 `content/g2-3-item-registry.ts::ITEM_DEFINITIONS` 没有 S13 羁绊纹章项。`traits/effective-membership.ts` 能接受显式 emblem 投影，但没有可直接用的物品→原生非唯一羁绊映射与授予/装备/恢复链。不能拿名称含 Crest 的神器替代。 |

对已写的 5 项，生产激活至少需现有 `content/augments.ts` / `content/anomalies.ts` / `content/augment-policy.ts` 注册；`strategy-snapshot.ts` 接编译和程序绑定；获取/战中采样/击杀/结算/恢复权威入口接机制及事实验证。`content/index.ts::CONTENT_DIGEST` 输入含目录、等级与版本，正式集成时由集成方统一处理身份和夹具。本 PR 不修改这些文件，不声称模块导入即生效。

## 权重研究：权重改动待用户确认

维持现有等权，未形成具体可激活权重提案。查过 [Riot 官方 14.24 含 B 补丁](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)、归档 map22 的 augment/table/tier/odds/chance/probability/weight 字段、现有 `docs/AUGMENT_TIER_V14_IMPLEMENTATION.md` 和 policy。

官方 6% Prismatic First、4% Prismatic Last 是开局奇遇概率，不能当作每个强化节点的等级分布。归档有 TFT3/5/6/7/8/9、教程及 PvE 的 `AugmentArmoryConfiguration_Table`，原字段、指针与直接引用检索保存在 `preflight.json`；尚未建立到 S13 标准模式和奇遇覆盖的完整选择链，不能可靠采用。旧赛季前缀本身既不能证明有效也不能证明无效。等级身份和标准池成员数也不能替代概率。14.24b 的 Built Different 既有覆盖保持，测试明确核验。

## 验收与边界

最终相关回归：15 个完整文件，265/265 通过、0 失败，Vitest 7.10 秒；命令、shell 耗时与 tsc 测量见 `final-validation.json`，日志见 `standalone-and-regression-tests.txt`。其中新增独立包 27 项，另有原有 238 项。只跑内容/强化/异常及 tsc，未跑全套、未改时限或门槛、未删跳测试。初次审计基线日志在原 validation.json/targeted-tests.txt 保留，勿混为最终结果。

当前运行时 57/52、digest 不变在独立 source 测试中严格断言。未做生产完整对局/保存恢复或八人实时经济验证；这些是未接线的实质限制，不能用独立测试替代。工作树相对原基线只有新增文件；未改旧条目、版本、digest、权重、既有夹具或注册文件。仅用云端仓库和 /tmp，无本机、素材、D7、TASKS.md 操作，不合并、不改写历史。任务结果由父会话写回。
