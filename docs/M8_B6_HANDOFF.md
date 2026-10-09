# M8 B6 第一阶段交接：显式日程与开场经济（隔离纯模块）

分支：`feat/m8-b6`，从 `feat/m8-b0-baseline@10a8367` 切出。B5 在 `feat/m8-b5`（`3b8444c`，`[wip]`）上并行，两条线互不读取对方未合并的代码。
执行者：第二条 Codex 线。用户手动启动。
工作方式与 B5 相同：每阶段自检、`[wip]` 提交并推送后再继续；不开正式 PR、不合并、不 rebase/force push。需要 CI 时只开指向 `feat/m8-b0-baseline` 的草稿 PR。

**送审由用户本人负责。** 执行者不自行送审，也不把代码转给其他审计方。第一阶段完成并推送后立即停下，按 AGENTS.md 格式汇报，等用户送审和答复。审计意见由用户转回后再修复；修复完成后同样停下，等用户确认。未经用户明确指示，不开始第二阶段。

## 0. 一句话目标

把已批准的 M8B OPENING 和 38 轮显式日程做成**新增的纯数据与纯函数模块，并附独立测试向量**。现有运行行为一行都不改。正式接入 Match、存档和 digest 的工作留到 B5 签收合并后的第二阶段。

第一阶段的硬性验收标准是：相对基线，`src/` 下只有**新增**文件；现有全部测试（包括 `tests/fixtures/m5/full-match-golden.json`）原样通过。

## 1. 开工前必读

| 文件 | 读什么 |
| --- | --- |
| `docs/M8_DEPENDENCY_MAP.md` §3、§6、§7 | B6 范围，共享文件单一 owner 原则，第二线禁改主线文件 |
| `docs/M8B_OPENING.md` 全文 | 1-1 初始化、1-2～1-4 逐步账本、§3.1 收入与失败规则、§4 语义节点、§5 手算预算 |
| `docs/M8B_ENCOUNTERS.md` 遭遇表 | 只取 8 个 PvE 轮次对应的 `encounterId`；怪物定义、站位、机制属于 B7，本阶段不做 |
| `docs/M8B_LOOT.md` 约 L250 | 8 个 PvE roundId 的顺序：1-2、1-3、1-4、2-7、3-7、4-7、5-7、6-7 |
| `src/simulation/m8/contracts.ts` `RoundDefinition` | 冻结字段：roundId / ordinal / stage / subround / kind / isFinal / encounterId / displayName |
| `docs/M8_UI_CONTRACT.md` L55 | stage/subround/displayName 由目录提供；补给轮 encounterId=null |
| `docs/M8_RULES.md` L168–170 | 38 推进轮 / 33 战；UI 和收据不得从旧 round 推算阶段 |
| `docs/M8B_CONTRACT_ADDENDUM.md` IF-ROUND 行、§9 | B6 的接口职责与恢复约束（恢复部分属于第二阶段） |
| `src/simulation/round-schedule.ts`、`match-rules.ts`、`economy.ts`、`progression.ts` | **只读**，了解旧 35 轮公式和旧经济，不修改 |

## 2. 本阶段交付（只新增文件）

文件名沿用依赖图 §3 的计划命名。实施时如需调整位置，先在本文件记录理由，并且不得扩大范围。

### 2.1 `src/simulation/content/round-catalog.ts`：显式日程目录

- 导出完整 38 条 `RoundDefinition[]`，用 `freezeContent` 冻结，直接使用冻结类型 `RoundDefinition`，不另造同名类型。
- 结构：阶段 1 为 1-2、1-3、1-4，三条均为 `pve`；阶段 2～6 每阶段 7 轮，`.4` 为 `supply`，`.7` 为 `pve`，其余为 `pvp`。
- 推导结果必须满足：ordinal 从 1 连续到 38；战斗数 = 38 − 5 个补给轮 = 33；`isFinal` 仅 6-7 为 true。
- 8 个 PvE 轮的 `encounterId` 按 ENCOUNTERS 表填写：`minions-a-v1`、`minions-b-v1`、`minions-c-v1`、`krugs-v1`、`wolves-v1`、`razorbeaks-v1`、`elder-dragon-v1`、`rift-herald-v1`。补给轮填 `null`。PvP 轮见 §5 待决项。
- 同文件导出按 roundId 挂载的语义节点表：强化 2-1、3-2、4-2，异常 4-6，补给 2-4～6-4 共五次。**不包含**旧 `r1-component-1/2` 起手事件；进入 2-1 不再发旧起手包。
- 旧 x-7 的 `reward`/`component` 事件属于 B8 掉落范畴，本阶段不迁移，也不在新表中仿造。在文档中注明归属即可。

### 2.2 `src/simulation/opening-economy.ts`：阶段 1 经济纯函数

- 初始化常量：0G、等级 1、0XP、100HP；初始单位 `irelia`，一星，实例 `unit-1`，坐标 `(col=1,row=4)`，下一永久英雄序号为 2。只导出常量，不创建 Match。
- 结算函数：输入 roundId、战斗结果和当前 gold/level/xp，输出本轮基础金币、自然 XP、扣血等增量，形式为纯数据。
  - 1-2 / 1-3 / 1-4：基础金币 2 / 3 / 5，胜负都发；自然 XP 2 / 2 / 0。
  - 阶段 1 不计利息、不发胜利金币、不更新连胜连败；PvE 失败或平局固定扣 3HP，胜利扣 0。
  - 2-1 起：返回"沿用现有规则"的标记，或直接委托现有只读函数。不得在本模块内复制一份旧经济公式。
- XP 累计调用现有 `progression.ts`，只能 import，不能修改。
- 函数中不得出现掉落相关逻辑（麦迪、拉克丝、组件授予属于 B8），也不得出现"失败后在 2-1 补足"的逻辑。

### 2.3 `src/simulation/round-selectors.ts`：纯查询

- 提供按 ordinal 或 roundId 查 `RoundDefinition` 的函数，以及"下一轮"查询。输入非法时抛错或返回 null，二选一后在文档中写明。
- **不实现**冻结签名 `readRoundInfo(state: Match)`，因为 Match 里还没有 `m8.round` 字段，那是第二阶段的接线。本阶段函数命名要与它区分开，避免 UI 误用。

### 2.4 测试（新增文件，期望值手写）

期望值必须由人对照文档手写，不能先跑实现再把结果抄成期望。

- `tests/m8-b6-round-catalog.test.ts`
  - 共 38 条，roundId 唯一，ordinal 连续，33 场战斗，5 个补给轮；
  - 8 个 PvE 轮的位置和 encounterId 逐项比对；
  - 仅 6-7 为 isFinal；
  - 强化在 2-1/3-2/4-2，异常在 4-6，补给在 2-4～6-4；
  - 新表中不存在任何旧起手事件；目录对象深冻结。
- `tests/m8-b6-opening-economy.test.ts`
  - OPENING §3 全清基准逐步核对：0G/1级 → 2G/2级0XP → 5G/3级0XP → 10G/3级0XP；
  - 1-4 不发 XP；阶段 1 失败照发 2/3/5G 且扣 3HP；阶段 1 连胜计数不变、无利息；
  - §5 基础金币总额：0 + 10 + 35×5 = 185G；
  - 同一输入重复调用结果一致，且不修改输入对象。

### 2.5 文档

`docs/M8_B6_HANDOFF.md`（即本文件）由执行者继续追加：阶段记录、自检结果、§5 待决项的建议值。格式参照 `docs/M8_B5_HANDOFF.md`。

## 3. 禁改清单（本阶段一律不碰）

**B5 正在修改或主线独占的文件：**
`match.ts`、`match-types.ts`、`strategy-types.ts`、`strategy-snapshot.ts`、`serialization.ts`、`m8/restore.ts`、`content/index.ts`、`content/source-manifest.ts`、任何版本常量或 CONTENT_DIGEST、`inventory.ts`、`upgrades.ts`、`rewards.ts`、`effects.ts`、`item-*.ts`、`equipment-policy.ts`、`temporary-equipment.ts`、`combat-*.ts`、`content/items-*.ts`。

**旧日程与经济（第二阶段才改，改了会动 golden）：**
`round-schedule.ts`、`match-rules.ts`、`economy.ts`、`progression.ts`、`round-enemies.ts`、`validate-content.ts`。

**fixture 与已有测试：**
`tests/fixtures/**`（尤其 `m5/full-match-golden*.json`），以及所有已有测试文件。

**冻结合同：**
`src/simulation/m8/{contracts,ui-contracts,equipment}.ts`、`docs/M8_RULES.md`、`docs/M8_UI_CONTRACT.md`、`docs/MATCH_CONTRACT.md`、G12 及其测试。

**全局与配置：**
`AGENTS.md`、`package.json`、lock 文件、`.github/`、CI、bundle 与堆门禁及基线文件、`scripts/` 中已有脚本、`src/m6/`、`src/persistence/`、`src/replay/`。

**界面（归 Claude）：**
`src/rendering/`、`src/presentation/`、`src/main.ts` 等。

依赖方向限制：现有模块**不得 import** 本阶段新增的模块。新模块只允许 import 冻结类型和现有只读函数或常量。这样新代码不会进入打包结果，bundle 预算不受影响。

如果实施中发现确需修改上述任何文件，立即停下，写进本文件的【需要我决定】，等待用户答复，不得自行绕过。

## 4. 本阶段验收

1. `git diff --name-status 10a8367...HEAD` 只出现 `A`（新增）行，且路径限于 §2 列出的文件。
2. `npm run typecheck` 通过。
3. 新增定向测试通过；全量 `npm test` 通过，`full-match-golden.json` 未变化。
4. `grep` 证明现有 `src/` 文件中没有任何对新模块的 import。
5. 按 AGENTS.md 汇报格式收尾（15 行以内），在【下一步】中写明"等待用户送审"，然后停止工作。

## 5. 待决项：执行者给出建议值，由用户批准

这些在已签收文档中找不到明确规定。执行者需先在仓库全文 grep 确认确实没有定义，再提出建议值，作为"项目约定"成批交用户批准。批准前可以用建议值继续开发，但测试中要标注 `provisional`。

| 编号 | 问题 | 建议（供参考） |
| --- | --- | --- |
| B6-Q1 | `roundId` 字符串格式 | 与文档"项目轮次"一致，用 `"1-2"`…`"6-7"`。它会进入掉落 ID、遭遇实例 ID 和 TG 组合键的 canonical tuple，一旦批准不再改动 |
| B6-Q2 | `displayName` 格式 | 例如 `"1-2"`，或带中文前缀，由用户定；UI 只展示不推算 |
| B6-Q3 | PvP 轮的 `encounterId` | 建议填 `null`。B7 只覆盖 8 场 PvE，PvP 对手仍走现有 `round-enemies.ts` |
| B6-Q4 | 非法 ordinal/roundId 查询的行为 | 抛 `RangeError`，与现有 `requireRound` 风格一致；或返回 null |

## 6. 第二阶段预告（本阶段不做，仅列出以免遗漏）

前提：B5 签收并合入 `feat/m8-b0-baseline`，B6 第一阶段 rebase 到新基线后由用户确认。负责人由用户指定，接线期间按依赖图 §6 由单一 owner 修改 `match.ts`。

- 用新目录替换 `round-schedule.ts` 的旧 35 轮公式和 `getStageRound`，删除旧起手事件。
- 新局初始化改为 1-1 → 直接进入 1-2 准备期，不新增可保存的中间 phase。
- `M8MatchExtension.round` 与冻结签名 `readRoundInfo(state)`；首次准备期冻结事务（IF-ROUND）。
- 局部恢复：允许等级 1/2、38 轮、阶段 1 的 2/3/5G 与 2/2/0XP。33 战容量的完整切换仍属 B9，但本批的数据必须能保存往返。
- 同步更新 content digest 与规则修订号、golden 及其更新脚本；三次新开战前插 battle-seed，新轨迹不复用旧 golden 宣称一致。
- OPENING §5 列出的 B6 验收用例。完整开场收益链（麦迪、拉克丝、两组件）等 B8。

## 7. 第一阶段实施记录（2026-10-09）

状态：第一阶段隔离纯模块及所需自检已完成。代码 `[wip]` 提交 `54348a593c2e69cc7663f3022af225bb7553aee5` 已推送；仅用于CI的[草稿PR #18](https://github.com/catfish-xn/cat/pull/18)目标为 `feat/m8-b0-baseline`，Node22上原样 `npm test` 已通过。本次收尾补交接证据，不修改代码；补充记录推送后立即停止，送审仍由用户本人负责。本阶段不接入运行入口。

### 7.1 工作区与只读依据

- 从 `10a8367bead882c91e28769b400ad1b819b79980` 建立独立本地检出，分支 `feat/m8-b6`。原 B5 工作区不改动，不读取其未合并源码。
- 已读依赖图 §3/§6/§7、OPENING 全文、ENCOUNTERS §2 八行、LOOT L250 的八轮顺序、冻结 RoundDefinition、UI 合同轮次节和 RULES 轮次节；旧日程、经济与成长仅作只读依据。
- 引用修正：该基线的 ADDENDUM 没有 §9；恢复约束实际位于 §5.2 第9项，已连同 §8.2 IF-ROUND 阅读。原交接正文保留，冻结文档不改。
- `docs/M8_B5_HANDOFF.md` 不在此基线中；遵守双线隔离，不从 B5 未合并分支取该文档，采用本交接阶段记录及 AGENTS.md 五栏收尾格式。
- 六个交付路径均沿用本交接 §2，不调整位置，不修改现有文件。

### 7.2 本批导出与后续接入边界

| 文件 | 导出/行为 | 接入约束 |
| --- | --- | --- |
| `content/round-catalog.ts` | `ROUND_CATALOG: readonly RoundDefinition[]`，38 条完整字面量；`ROUND_SEMANTIC_NODES` 按 roundId 锚定强化、异常、补给 | 均递归冻结；语义节点是只读数组，不是可执行 ScheduleEvent，不分配新事件 ID |
| `opening-economy.ts` | `OPENING_INITIAL_STATE`；`planOpeningEconomy(input): OpeningEconomyPlan` | 输入为 roundId/result/gold/level/xp/streak；阶段1输出收入、自然XP、请求扣血、原样复制的连胜/败和现有 grantXp 结果 |
| `round-selectors.ts` | `getCatalogRoundByOrdinal`、`getCatalogRoundById`、`getNextCatalogRound(roundId)` | 返回冻结目录引用；非法输入抛 RangeError；合法终轮的下一轮为 null |

阶段1胜、败、平局均给2/3/5G与2/2/0XP；不付利息、胜利或连胜/败金币，不推进连胜/败。`playerDamage` 是请求扣血增量：胜利0，失败/平局3；没有输入HP，不在这里改变HP或判断终局，第二阶段由既有提交方扣血并按0下限截断。自然XP统一调用现有 `grantXp`，保持主动买XP后的合法等级/XP与上限处理。

2-1起先验证目录轮次及结果是否与战斗/补给匹配，再仅返回 `{kind:'existing-rules',roundId}`；其金币、等级、XP和连胜/败的完整验证、计算交给既有经济入口，本模块不复制旧经济公式。

旧x-7的 `reward`/`component` 迁移和所有PvE掉落、麦迪/拉克丝及组件授予归B8，本批新表没有这些事件。Match初始化、首次准备期冻结事务、一次结算收据、`readRoundInfo(state)`、恢复和digest均留第二阶段。纯函数重复计算得到相同计划，不等于已经实现Match的重复提交保护。

### 7.3 待决项目约定：建议值与仓库检索证据

已用 `git grep -n -E 'roundId|displayName|encounterId|requireRound' 10a8367` 搜索基线全部受版本控制的文件（94行匹配），包含源码、测试、fixture和档案；没有从B5分支读取定义。未找到下列四项的已批准规范。测试明确标注 `provisional`，不将建议记为已批准。

| 编号 | 本批建议/暂用值 | 依据及其他选项 |
| --- | --- | --- |
| B6-Q1 | roundId用精确字符串 `"1-2"`…`"6-7"`，不含前缀/空格/前导零 | ENCOUNTERS/LOOT采用该项目轮次文本；`tests/m8-contracts.test.ts` L71–72 的 `r-6-7` 仅为类型示例，没有格式约束；可选带 `r-` 前缀，但建议避免新增映射。批准后作为canonical tuple的一部分固定 |
| B6-Q2 | displayName同目录项目轮次，如 `"1-2"` | UI合同只规定从目录读取，未指定格式；可选 `"第1阶段 · 第2轮"`，建议先用简洁文本，UI不用ordinal计算 |
| B6-Q3 | PvP encounterId为null | 冻结字段允许null，仅补给轮强制null，PvP未明定；可选独立PvP遭遇ID体系，但B7仅定义8场PvE，建议继续从旧敌军模块处理PvP |
| B6-Q4 | 非法ordinal/roundId抛RangeError | 旧 `round-schedule.ts` 的 requireRound使用RangeError；可选非法查询返回null。建议区分非法输入与合法终轮无后继，后者仍返回null |

【需要我决定】请用户将B6-Q1～Q4作为项目约定成批批准，或指定替代值；本批暂用值可供审阅，但未获批准。

### 7.4 自检与验收记录

- 新增测试先写手算期望，再写纯模块；未运行实现采集期望，未调用生产查询/公式生成期望目录或开场账本。
- `npm run typecheck`：通过。
- `npm test -- tests/m8-b6-round-catalog.test.ts tests/m8-b6-opening-economy.test.ts`：2文件/57项通过。
- `npm test` 首轮：96文件/1226项，94文件/1220项通过；6项仅因既有超时失败（M5 replay三项180秒，M6 integration三项120秒），无数值或状态断言失败；本轮耗时749.08秒。
- `npm test -- --maxWorkers=2`：复测的M6 integration仍有3项跨过既有120秒超时（120.200/148.126/120.525秒），故以SIGINT停止这次已失败运行，退出130，不计为通过。仅停止此工作区的Vitest进程，未影响其他工作。
- `npm test -- --maxWorkers=1`：M5 replay的mage/sniper-caitlyn仍因既有180秒阈值失败（181.564/189.589秒），故以SIGINT停止已失败运行，退出130；无断言失败，不计为全量通过。
- 本机Node24.21.0/npm11.19.0；仓库 `.github/workflows/ci.yml` 固定Node22，且全量使用原样 `npm test`。不把版本差异当作已证实根因，不修改测试、超时值、配置或门禁。按本交接开头允许的CI路径，用草稿PR取得Node22全量结果，已通过。
- [CI #116](https://github.com/catfish-xn/cat/actions/runs/37878392040)，代码提交 `54348a5`：`test-and-build-sample1` [job 113652139358](https://github.com/catfish-xn/cat/actions/runs/37878392040/job/113652139358) 的第5步 `Run node scripts/ci-m5-step.cjs tests npm test` 已为 `completed/success`，证明Node22中原样完整单测通过；不把本机超时记为通过。
- CI构建/其他浏览器、堆和性能作业的完整结论在本记录收尾时尚未齐备，不将单测通过宣称为整条CI通过。最终后继提交只补本文，运行代码与CI所测 `54348a5` 一致；自动触发的后继CI也不提前宣称通过。
- 基础金币预算以实际阶段1计划累计10G，后续目录35轮复用现有每轮5G常量，手写总期望185G；未宣称完整新日程已接入运行。
- golden文件的基线与工作区Git blob均为 `f5dde0137b9c7fe114afc47bffe6b7e17da2881f`。
- `git diff --name-status 10a8367`：仅本交接§2的6个A；既有文件修改/删除为0。
- 对基线的141个 `src` 文件逐个运行rg扫描，新模块名称命中为0；新增模块之间仅有目录常量和纯查询依赖。
- `git diff --cached --check`：通过（用户粘贴文本的CRLF已在新增交接文档中统一为LF）。

### 7.5 本阶段收尾

【完成】隔离目录、开场经济、纯查询及独立向量已实现；类型检查、57项定向测试和Node22 CI原样全量单测通过。
【未完成】第二阶段Match/恢复/digest接线尚未授权，本阶段不做；完整CI其他作业结论尚未齐备。
【需要我决定】B6-Q1～Q4建议值待用户批准。
【风险】本机Node24的旧长对局出现超时，CI Node22全量已通过；四项约定仍为provisional；一次授予/结算及完整奖励链仍待第二阶段/B8联调验收。
【下一步】本交接记录以 `[wip]` 补充提交推送后立即停下，等待用户送审；审计意见由用户转回，未经用户明确指示不开始第二阶段。

## 8. 用户转回复审与完整CI确认（2026-10-09）

本节更新§7收尾时的历史快照，不回写旧快照，也不改变已复审代码。

### 8.1 复审结论与当前状态

- 用户转回复审报告，固定审计范围为 `10a8367 → 66e7295`；代码审计通过，阻塞0项、应修0项，无需代码修复。报告独立复跑了2文件/57项定向测试及typecheck，全部通过。
- 报告所述CI尚未完成是2026-10-09 11:35:34（Asia/Taipei）的快照。用户明确确认此后完整CI已跑完且通过；执行者再次核验[CI #117](https://github.com/catfish-xn/cat/actions/runs/37879223090)：头提交 `66e72953ad06be641c370791d0b8e321f076b6f2`，整体 `completed/success`，12个必需作业全部成功，warmup-experiment/heap-diagnostics两个可选诊断按条件跳过。
- 完整CI覆盖全量单测、构建、headless/性能、dev/preview三路线、两类输入、M6 retention、M7 presentation及compare-evidence。本机旧长对局超时的根因仍未确定；不因CI通过就认定Node24是根因。
- `66e7295` 相对 `54348a5` 仅更新本交接文档。本次也只追加交接与复审记录，不修改src、测试、fixture、配置、冻结合同或版本。
- 代码复审与完整CI均已通过；用户本轮另行明确答复“批准这四项建议值”，Q1～Q4现已获得用户本人批准，第一阶段通过条件齐备。第二阶段尚未获明确开工授权，不接线、不合并、不rebase。

### 8.2 第二阶段接入检查项（复审S1～S3）

| 编号 | 第二阶段必须检查的内容 | 第一阶段归属 |
| --- | --- | --- |
| S1 | 统一从新目录读取stage/subround/kind/isFinal；不得将新ordinal=4交给旧公式而解释为2-4补给，或让36～38触发旧35轮上限。明确38个推进轮含补给、33战另按kind过滤；统一Match.round、m8.round.ordinal与历史记录映射 | 接入建议，不是本阶段缺陷 |
| S2 | 与开场接线同步调整恢复约束：允许等级1/2、1-4的0XP、ordinal36～38；按同版本roundId目录及经济核验历史，覆盖三场开场准备期/战中/结算与进入2-1的保存往返，恢复不重发资源、不消费RNG | 接入建议，不是本阶段缺陷 |
| S3 | digest完整覆盖2/3/5G、2/2/0XP、初始化数据和语义节点；接入时采用函数与digest共用的冻结参数数据或等效完整覆盖方案，并更新规则修订号 | 接入建议，不是本阶段缺陷；本批旧digest保持隔离 |

Q项接入注意：批准后roundId作为canonical tuple的身份元素固定，不随ordinal或显示文本改变；displayName可与身份独立演进；PvP和补给均可能encounterId=null，必须以kind判断是否战斗；非法查询RangeError与合法终轮无后继null保持区分。

### 8.3 用户已批准的项目约定与停点

用户于本轮明确批准四项建议值，现将其固定为项目约定：

| 编号 | 已批准值 | 后续约束 |
| --- | --- | --- |
| Q1 | roundId精确采用 `"1-2"`…`"6-7"` | 身份固定，不随ordinal/文案改变，不追加r-前缀；用于canonical JSON tuple |
| Q2 | displayName采用 `"1-2"`…`"6-7"` | UI读取目录；显示字段与roundId身份独立，今后改文案不能改身份键 |
| Q3 | PvP encounterId=null | 按kind判断战斗，不能把null等同补给；补给轮仍为null，PvE保持8个已批准遭遇ID |
| Q4 | 非法ordinal/roundId查询抛RangeError | 合法终轮 `getNextCatalogRound('6-7')` 仍返回null，区别于非法输入 |

本节是最新批准状态。§5/§7及已复审源码、测试中的provisional说明反映批准前开发状态；本次保持复审代码不动，批准记录解除四项待决条件，不将审计方同意误记为批准依据。

【完成】代码复审通过（0阻塞/0应修）；`66e7295`完整CI #117通过；用户明确批准Q1～Q4，第一阶段通过条件齐备。
【未完成】第二阶段尚未授权，不开始Match/恢复/digest接线。
【需要我决定】本阶段无剩余待决项，Q1～Q4已获用户批准。
【风险】新旧ordinal、开场恢复约束及digest覆盖风险已列入第二阶段S1～S3；本机旧长测超时根因未确定。
【下一步】本记录以 `[wip]` 提交并推送后停止，等待用户对第二阶段的明确安排；不自行送审、合并或进入第二阶段。

## 9. 第二阶段接线（2026-10-09，用户已明确授权）

最新授权覆盖原§3/§6的第二阶段停点：B5基线通过merge进入本分支，不rebase；B6独占Match、日程、开场经济、round-enemies、serialization、content/index及开发修订/digest。B7并行线仅交新增内容/编译器与测试，正式接线待B6合并后串行进行。冻结合同、G12、U3视觉代码、CI配置和门禁仍不修改。

### 9.1 检查点一：目录、开场、准备事务及局部恢复

- `round-schedule.ts`由已批准38条目录及roundId语义节点编译，移除旧起手包和旧x-7奖励；强化2-1/3-2/4-2，异常4-6，五次补给。旧x-7掉落归B8，未通过假组件/英雄补齐。
- 新局直接进入1-2准备期：0G/1级/0XP/100HP，刀妹unit-1位于(1,4)，nextUnitSerial=2。三场阶段1结算与恢复共用冻结2/3/5G、2/2/0XP参数；利息/胜金/连胜金币为0，败平固定3HP；2-1起调用既有经济。
- Match新增可编辑适配字段`m8.round`与`m8.encounterPlan`，类型分别取冻结M8MatchExtension；准备记录一次冻结目录身份和当前敌阵。`readRoundInfo`直接读取本事务轮次，历史新增roundId，旧roundDefinitionId仍与它严格一致。
- **阶段1怪物待B7接入**：明确使用现有一个neutral-stage-2作为开发占位；所有PvE准备记录标记`pending-b7-b8`，encounterPlan=null。该记录证明准备事务已接线，不代表完整遭遇/掉落计划已经实现；B7/B8须在同一事务中接入正式编译与完整预抽计划。
- 恢复严格比对同版本目录、冻结准备记录、占位敌阵、历史roundId及实际经济计划；不会调用敌阵生成函数、刷新商店或消耗RNG。TG轮次范围与身份由目录提供，允许1/2级和36～38。
- 新开发修订`m8-b6-round-opening-v1`进入digest。digest覆盖实际初始化、冻结开场经济参数、目录、语义节点、准备政策与38轮敌阵投影；正式M8 schema/rules迁移留B9。
- Node22.23.3定向验证：`npm test -- tests/m8-b6-round-catalog.test.ts tests/m8-b6-opening-economy.test.ts tests/m8-b6-match-wiring.test.ts`，3文件/71项通过。涵盖三开场准备/战中/结算往返、真实失利与运营不回填、重复命令、锁店、2-1选择、恢复不重生成、篡改拒绝。
- 此检查点未迁移旧测试及独立oracle/golden，也未运行全量；不能据定向通过宣称整条CI通过。完整麦迪/拉克丝/组件收益链归B8；完整33战应用/历史容量归B9，均未修改或签收。

### 9.2 检查点二：旧断言迁移、XP链加固与新轨迹

- [逐项旧/新断言及输入账本](evidence/m8-b6/assertion-migration.md)以`7c24d513c627d34ece6ff355c44077fc5c621e1a`为比较基线，列出121个旧测试diff片段及各自理由，并集中写出OPENING手算值。没有新增skip/todo；公开路线原胜利、成型、15组件要求保留，B9容量不改。
- 新的真实命令helper可到达指定roundId；种子42在2-1用公开商店付费购买麦迪/拉克丝，专供多持有者测试，不冒充B8奖励。纯命令经济旧向量明确命名`economyFixture`，显式保留原单元测试输入，不作为起手资源证据；IF-GRANT装备微型fixture同样单独标记。
- 额外只读复核发现两处严格性缺口并已加固：恢复校验逐轮累计XP不能回退、准备期增量只能由4XP购买达到（允许等级9截断）；恢复后保留m8深冻结。对应拒绝降级、篡改历史和1-4凭空+2XP向量已添加。
- 战斗快照的敌方装备改读预编译冻结投影；恢复后段PvP不再间接调用敌阵生成。新增强阵容领域fixture真实推进全部38轮，验证36～38准备/战中/结算往返、33战及6-7终点；该fixture不证明正常获取、平衡或B9应用容量。
- 首次全量诊断已在明确失败后以SIGINT停止，退出130，未完成全量。固定工作树哈希、命令、时间及原始gzip日志见[诊断记录](evidence/m8-b6/first-full-diagnostic.md)，不把跳过或未结束用例记为通过。
- `oracle.cjs`手写38轮ID及1/2级商店/XP规则，结算含历史roundId与开场2/3/5G、2/2/0XP；不调用生产日程/结算推导期望。路线原阶段策略阈值改为按稳定roundId定位，tick上界按战斗kind数量推导。
- 原当前golden字节保留为`tests/fixtures/m5/full-match-golden.pre-m8-b6.json`。新增透明更新器`scripts/update-m8-b6-golden.cjs`已实际运行；四路线独立经济/资源/RNG账本通过，均到6-7胜利、33战，但成型战斗均0、组件授予均5。结果见[实际路线摘要](evidence/m8-b6/route-observations.json)。新golden只记录轨迹，未将0成型/5组件改成成功门槛。
- **B8待办**：阶段1指定英雄/两组件及后续PvE掉落；当前公开路线完整成型/15组件门禁预期仍失败。**B9待办**：应用/存储/历史原30战容量到33战的正式切换；本批不改其实现或门禁。
- 冻结合同、G12专属用例、U3动态UI和CI配置/阈值/测量方法均未修改。此处只是实施检查点，尚未全量终验或独立Pro签收。
- 检查点二最终定向合跑：Node22.23.3 `npm run typecheck`通过；26文件/484项全部通过，实际日志为`docs/evidence/m8-b6/checkpoint2-targeted.log.gz`；`git diff --check`通过。该26文件集合未包含四条公开路线与M6完整集成，不等同全量通过。

### 9.3 检查点三：固定提交全量失败证据与范围内修复

- 对固定`b0367db8e3ac63ec9925a3b1e560b7b2b6216d81`以Node22.23.3完整运行`npm test`：102文件中97通过/5失败，1312项中1287通过/10失败/15项因beforeAll失败未执行；实际耗时446.02秒、退出1。运行起止源码diff均为空，未在运行中修改源码或测试。[完整分组摘要](evidence/m8-b6/full-b0367db-summary.json)、[原始日志](evidence/m8-b6/full-b0367db.log.gz)保留真实失败；同提交`npm run build`退出0，[构建日志](evidence/m8-b6/build-b0367db.log.gz)。
- GitHub [CI138单测原始作业](https://github.com/catfish-xn/cat/actions/runs/37903167497/job/113730234865)确认同一1287/10/15分组，并非本地偶发。[M7 presentation](https://github.com/catfish-xn/cat/actions/runs/37903167497/job/113730234592)原帮助关闭后D快捷键因0G失败；[input-preview](https://github.com/catfish-xn/cat/actions/runs/37903167497/job/113730234926)原起手资源操作实际报insufficient-gold。
- 两项B6自身问题已在本检查点修复：runtime-import通过真实开场与2-1付费三英雄准备获取statuses，15条篡改拒绝测试真实执行；新增完整目录领域fixture改为九名三星凯特琳与明确输入的27件死亡之刃，减少无关战斗计算，保留38轮/33战及36～38准备、战中、结算恢复全部断言，不调高5秒超时。这不是正常获取或B8收益证据。两文件定向31项通过；完整目录用例单文件实测约1.73秒，最终全量并发表现仍待新提交验证。
- 纯旧脚本锚点及M6 replay寻找战后choice的旧7场上界已迁移（按目录到2-7且保留必须出现奖励的断言）：headless终点由目录末项推导；M7帮助覆盖奖励目标仍为原语义2-7。帮助快捷键测试先通过两场公开空阵让负到1-4，手算2+3=5G，再验证帮助拦截与关闭后D扣2G；独立firstBattle/reduced-motion场景不变。逐项旧/新值、理由和新fixture说明追加到[账本A122～A126/N001](evidence/m8-b6/assertion-migration.md)。
- `npm run test:headless`本地实际退出1，前两条路线到目录末轮后，原`formedBattles>=3`断言仍失败；没有改成型门槛、采样、时钟、RSS或重复次数。[日志](evidence/m8-b6/checkpoint3-headless-anchor.log.gz)。M7脚本`node --check`通过；本地Chromium在launch阶段遭`socket() Operation not permitted`，正常调用与获准的原样重试均在页面断言前退出1，见[首次日志](evidence/m8-b6/checkpoint3-m7-presentation.log.gz)与[原样重试日志](evidence/m8-b6/checkpoint3-m7-presentation-escalated.log.gz)，不记作页面验证通过。
- **保留的跨阶段阻塞**：B8对应4条公开路线成型失败、M6 replay缺战后choice，以及输入脚本缺原起手组件/三英雄链。当前2-4仅一次补给，无法合法取得原输入测量所需两组件；推进到3-4会改动原首次战斗测量场景，本批不这样规避。B9对应4条M6完整集成的33战超过既有30战档案容量；30战/90快照实现与门禁保持原样。M7后续2-7战后choice覆盖也仍需B8，不替换成别的模态来放过。
- 本检查点不重跑旧失败SHA刷绿；下一次完整验证针对修复后的新提交。当前并非完整CI通过或独立审计签收，阶段1怪物仍待B7接入。
- 本检查点最后复核：typecheck通过、两项B6相关文件31/31通过，日志`checkpoint3-targeted.log.gz`；M6 replay按目录检索至2-7后仍为7通过/1失败（缺战后choice），日志`checkpoint3-after-choice.log.gz`，进一步确认该保留断言需要B8。headless原始manifest另存`checkpoint3-headless-manifest.json`，其起止sourceFingerprint一致；未将未完成的24 seeds测量宣称通过。

### 9.4 新授权验收边界与检查点四（2026-10-09）

- 用户明确更新B6通过标准：B8/B9依赖断言不能删除，改为明确跳过、注明批次并逐项列清单供审计；清单以外所有检查必须通过。该授权替代此前“保留失败但不skip”的实施停点，不改写历史结果。最终证据包绑定固定SHA，包含相对feat/m8-b0-baseline完整差异、改动全文/测试及CI链接或日志；不含密钥/令牌/环境配置，后续改动需重新送审。
- 固定`61b680ec531ba07a21d40c910e7b3cdbb5aa00b4`原样全量完成：102文件99通过/3失败，1312项1303通过/9失败/**0跳过**，433.10秒；build通过。运行期间源码/测试/脚本diff起止为空。[摘要](evidence/m8-b6/full-61b680e-summary.json)、[单测日志](evidence/m8-b6/full-61b680e.log.gz)、[构建日志](evidence/m8-b6/build-61b680e.log.gz)。[CI140单测](https://github.com/catfish-xn/cat/actions/runs/37905614966/job/113738227990)同样1303/9/0，实际532.77秒。该9失败永远保留为这次历史失败，不能回写成新标准下通过。
- B6自身runtime-import的15项与新增完整38轮恢复用例已在本地固定SHA和CI140真实执行通过；没有增加超时。[CI140 M7](https://github.com/catfish-xn/cat/actions/runs/37905614966/job/113738228072)已通过帮助/reduced-motion/双激活/回放，实际失败准确落在2-7战后choice（B8）。[input-dev](https://github.com/catfish-xn/cat/actions/runs/37905614966/job/113738228127)最早0G重抽准备失败，不能整体归B8。
- [显式跳过清单](evidence/m8-b6/deferred-assertions.md)逐项记录文件/行号/测试或skip ID/归属/依赖/恢复条件。Vitest拆为4个B8路线子用例、4个B9完整envelope子用例、1个B8战后choice用例；正常四路线、逐战回放、合法prefix缺战拒绝、冻结引用继续。脚本仅对列明callback记录`SKIPPED [B8/B9]`和manifest.skipped，不把跳过项标passed，不跳整任务。
- 新`scripts/b6-public-preparation.cjs`只通过原生公共UI动作真实获金/供给，未注入资源或改时钟。快捷键、普通模态、单件拖拽/旋转/命中、布局焦点、随机/固定种子重抽仍执行；首战观察单独重开至1-2，只跳明确缺B8的羊刀链/动态AS。领域适配器单测证明准备命令合法和2/3/5G，不代替浏览器证据。新增条目详见[账本A127～A135](evidence/m8-b6/assertion-migration.md)。
- 当前定向：四路线4通过/4个授权B8跳过；准备helper与replay合跑15通过/1个授权B8跳过。M6逐战集成仍在运行，浏览器验证继续只使用GitHub CI；本机socket限制不再重试。
- CI140三条browser路线另有实际normal-time battle timeout，当前只读等待最后round/failure-state定位，尚未归属、未改75秒超时、未添加路线整体跳过。该未定问题仍阻止本检查点宣称清单外全绿。
- 检查点四补充：M6逐战集成定向3通过/4个授权B9跳过/1失败；解开容量短路后cannon原“路线实际卖出起手过渡棋”断言暴露缺B8英雄链，已只把相邻两条独立拆为第10个明确跳过，保留所有其他回放；该最新拆分尚待复验，原失败日志`checkpoint4-integration.log.gz`保留。
- [CI140 browser原始证据](evidence/m8-b6/ci140-browser/README.md)已定位B9：6-5第31战后错误“战斗历史超过冻结边界”，最终6-6tick0、31个记录、未暂停，导致原75秒正常时间等待超时。相关manifest/progress/failure-state/server原件gzip归档。此新发现尚未改脚本跳过，下一检查点精确处理容量外尾段及比较，不增加timeout，不跳整browser任务。

### 9.5 检查点五：B9浏览器尾段与透明比较（待CI）

- 已按用户明确批准的边界保留前30场实际浏览器战斗、6-4补给、6-5准备及全部先前命令/事件/回放/生命周期覆盖。只把6-5、6-6、6-7和完整应用终态逐项B9跳过，原代码保留；不再触发已知第31战应用异常，也不改75秒超时。manifest和stdout明确`fullApplicationRoutePassed:false`，领域33战路线与浏览器未执行尾段严格区分。
- 比较器继续比较完整领域route的initial/final/ledger/actions/rounds及真实前段browser snapshot。仅双方完全一致且精确为6-5/6-6/6-7的快照读取/比较callback标B9 skipped；新增严格校验30场身份、所有boundary前命令checkpoint、boundary state hash和完整skip集合，未知省略仍失败。touch两模式相同处理；输入只能出现已列5个B8 skip。未改CI、SHA/sourceFingerprint/版本/clean-tree/错误门禁或测量阈值。
- 新边界/准备元数据单测9/9通过；cannon完整33战逐tick回放及此前被短路的39/40/41prefix、暂停、缺战负例定向真实通过（1通过，8个因`-t`筛选未执行，不能把该8项称为批准skip统计）。日志`checkpoint5-boundary.log.gz`与`checkpoint5-cannon-integration.log.gz`。
- 清单统一为10个Vitest依赖skip，更新[完整清单](evidence/m8-b6/deferred-assertions.md)及账本A136～A137。新浏览器边界尚待新SHA CI实际验证，未宣称整线绿。
- **性能准备阻塞待批准**：`verify-m6-performance.cjs`后续完整导入/满载导入实际依赖B9、15装备输入依赖B8；只跳最终断言不足以启动其余测量。涉及repository层合法领域payload前置与独立测量callback拆分，已交由用户决定，当前未修改该文件或full-load helper，也未改测量法。其他已授权工作继续。
- 检查点五补充：`npm run test:headless`原样24 seeds完整执行，09:03:53～09:06:42 UTC退出0，仅seed42成型断言记录1项B8 skipped；全部路线实际胜利到6-7，原样时钟/RSS/事件账本测量保留。属d7daccc+本检查点WIP诊断，起止源码/测试/脚本diff哈希同为`f62775fae249317e811f2e2c8dc553c3eb9d14fd27aed5fd16447022220fa83b`，不是固定新SHA终验；原日志和manifest归档`checkpoint5-headless*`。
- `compare-m6-evidence.cjs`仅应用分组同步消费已列8个上游B8/B9 skip并保留原通过断言callback；所有容量内phase/G04/ROOT04/存储/布局/回放仍必通过，任何未知skip失败。性能分组仍原样未改，等待用户最终决定；不是整文件/整job跳过。
- 性能准备依赖已完整集中为[待决定范围](evidence/m8-b6/performance-pending-scope.md)：列8项测量中4项受完整导入准备影响、独立可继续4项、full-load覆盖/导入、原12次activation精确冷DB序列及聚合消费要求。替代准备只能标诊断，不冒充原门禁；本检查点仍未实施该待决部分。
- [CI141（d7daccc）](https://github.com/catfish-xn/cat/actions/runs/37908217035)的M7 presentation和M6 retention已成功；本检查点新增浏览器尾段及比较适配不在该SHA，仍需其后固定提交验证。

### 9.6 生成报告范围修正

- `compare-m6-evidence.cjs`生成的JSON/Markdown/stdout全部明确B6非跳过范围；附每个manifest的skipped批次/原因、浏览器已执行前段与未执行尾段，以及`fullApplicationRoutePassed:false`。移除错误的“新规则/golden不变、全部正常应用路线通过”当前态断言；附带旧M6文档仍保留，明确属于旧SHA历史，不被本次结论背书。
- 该修正只影响报告结论和元数据，没有修改待批准的M6性能测量/验证分组。模块性能依赖仍暂停等待用户决定。


### 9.7 检查点七：已批准性能边界与真实30战导入覆盖（浏览器待CI）

- 用户2026-10-09批准严格性能方案，并补充要求评估≤30战真实完整导入；恢复跟踪[issue #23](https://github.com/catfish-xn/cat/issues/23)。B9合入并放开导入容量后必须恢复原完整测量、原样本原则和阈值，经CI及独立审计才关闭。≤30战覆盖不能替代该恢复。批准状态覆盖§9.5/9.6的历史待批停点；[完整方案](evidence/m8-b6/performance-pending-scope.md)保留历史并明确最新状态。
- [CI144固定693f019的input-dev](https://github.com/catfish-xn/cat/actions/runs/37910007217/job/113752621538)已实际通过原生input、touch-route、五viewport、storage33检查和stats17检查，随后在旧性能终轮35断言以38!==35失败；不是新领域错误。现终轮/战数由目录推导，helper的原18/28策略锚点对应4-4/5-7，见账本A140～A143。
- 精确B9 skip原capture/write/activation/completeImport四项，原callback/12次activation顺序、冷DB首次null及门槛保留，无额外预热或假样本。full-load15装备覆盖归B8；完整fullLoadRoundTrip归B9；current-prefix仅实际超容量才跳。其余四测量和3次预热+30次模块生命周期保留。清单/聚合器拒绝未知skip、假actual或passed。
- 五条原策略仍真实生成并参与原最大负载选择。新增独立≤30战覆盖在第30战刚结算现场保存完整状态与全部历史，未截断33战终态。真实Node评估全部为6-3结算，最大sniper20,780,416字节，完整validateFile(validateBattleCollection)8744.80ms且对象相等；full-load实际最多5装备，所以15装备仍明确待B8。另固定693f019 cannon独立验证14,773,941字节/6074.62ms，字节差异来自runId，不冒称同一payload。
- 新独立浏览器boundedCompleteImport在原独立测量/生命周期之后执行：冷DB完整exportFile→validateFile→候选MatchSession/BattleHistory→原生activate，3次max仍30000ms；全对象/输入不变/IDB读回比较在计时外。明确只覆盖30战6-3结算，不覆盖原33战6-7终态或15装备最大负载，notEquivalentToFullPayload=true。该新门禁尚待CI，Node耗时不是浏览器/IDB性能通过证据。
- 本检查点Node22定向2文件14项通过、typecheck及脚本语法/diff检查通过。[诊断清单](evidence/m8-b6/checkpoint7-bounded-feasibility.json)与checkpoint7-*.log.gz保存真实日志。这是693f019加当前WIP的可行性诊断，不作为固定新SHA终验；本机Chromium限制不再重试。独立Pro审计与最终CI由root安排，未自签收。
- 新集成baseline已到f90e438933f341938c238980e1249d8904468c53（其他线H1 warn-only）；本worktree未自行合入或覆盖。root后续处理共享脚本整合并保留H1新政策，整合后须重新固定SHA/CI/审计。阶段1怪物仍待B7接入，B8内容与B9完整应用容量均未签收。


### 9.8 最新baseline纯合并与U3准备适配（独立提交）

- 用户批准最新baseline同步进B6后，fetch核准`adf24b4ef6f5ec65b3abd59adc050ad2b6b82880`，已用纯merge `e86b0ac07b53a799f80b25da6009366217cb7a5f`引入H1 warn-only与U3，parents为88efdc4/adf24b4，tree为1589b35ae29b652193fcd3a3f0df7d8c75570e01。未rebase，未把B6合回baseline。
- 文本冲突0；两自动合并共享脚本的行段、双方意图与保留结果逐一写入[合并核对账本](evidence/m8-b6/baseline-merge-ledger.md)。H1真实heap元数据/告警政策、监听器/RAF检查，以及B6精确B8/B9 skip均保留。baseline的视觉/样式/CI、H1 helper与测试全文未改。
- 纯merge tree定向4文件37项通过，typecheck通过，日志checkpoint8-merge-*.log.gz。新增U3job已带入；先前旧HEAD缺脚本的MODULE_NOT_FOUND属于baseline推进后的集成缺口，不以重跑旧SHA规避。
- 之后单独适配U3测试脚本前置：真实公开空阵三场获2+3+5G/2+2+0XP，到原2-1，原首offer策略后公开购买麦迪/拉克丝，最终3级/8G/三英雄，再执行原部署和原7物品fixture。未伪造B8奖励；原10场交互/断言全部逐字保留，没有UI改动或新skip，逐项说明见账本A144。
- 直接执行同一setup源码的Node诊断确认五种准备empty/tg/occupied/full/unique均合法，记录脚本sha256并确认原10段交互源码未变。完整可复现诊断代码/日志已入包。该诊断不是Chromium原生输入，真正U3/性能/整套CI及独立审计仍待最新固定SHA。


### 9.9 CI150比较器观察时刻错误与严格修复

- 固定ac76255的12个主CI作业全部成功，包含U3十场原生交互与新独立30战真实导入；[compare-evidence](https://github.com/catfish-xn/cat/actions/runs/37917616047/job/113784136193)确实失败，不能宣称全绿。根因是B6新增边界校验把Start的即时tick0 hash错当成浏览器正常等待整场结算后的checkpoint；不是哈希算法、乱序、配错产物或flaky。
- 修复仅在比较器中按原观察时刻核对：Start对应唯一同轮round.after的完整状态hash，并核对声明的round.stateHash；非Start仍action.afterHash。边界/所有前段命令/精确尾3战/未知skip拒绝全部保留，无生产、浏览器行为、CI或阈值变更。
- [证据目录](evidence/m8-b6/ci150-comparison/README.md)保存原失败摘录、官方ZIP来源/SHA256、关键原manifest/command、修正后的全M5比较日志及可复現负例代码。八份ZIP均核准SHA/CRC；三路线dev/preview和touch合计1226checkpoint（240 Start、986非Start）真实全部比对，32例篡改/漏记录全部拒绝，4文件37定向与typecheck通过。
- 该本机比较使用“修复WIP脚本 + 固定ac76255原浏览器产物”，不是修复新SHA验收。新提交须再跑CI并重新打包送审；未合入后来B3 baseline0411ad6。
- 性能历史实录也保存：CI148 firstSeek第三样本2271ms失败保留，不能称偶发；CI150同脚本三样本740/729/969.3ms通过，独立30战完整导入5669.7/5521.4/5761.3ms且原生IDB读回相等。硬件不同，当前无证据定性前次失败因果；没有额外预热、丢样本、调阈值或新增skip。


### 9.10 JS gzip增量与U5余量（固定受测ac76255，非假想整合）

- 按用户要求附[独立只读体积证据](evidence/m8-b6/js-gzip-20261009/README.md)，包括五份真实build日志、工具版本、逐产物SHA256、原始JSON、测量/文本残留探针代码。沿用现有`m7-budget.cjs`的每个JS分别gzip level9求和与1.15倍阈值，没有改门禁或做打包优化。
- 同工具链实测：0411ad6基线479197B，B6受测ac76255为480808B，raw-head增量1611B；整数有效门槛488477B，B6剩余7669B（约7.489KiB），041基线原余量9280B。该剩余可供U5规划，**不是给U5/B7的已批准预算分配**。
- B6尚未合入0411ad6的B3改动，所以上述是两个实际head的比较，不是假想合并后增量；B7正式接线、B3同步及U5后必须重测。B7隔离内容当前相对自身5bd基线生产增量0B，因为尚未接入；相对041的负差不能当作优化节省。
- 当前比较器修复只改脚本/测试/文档，`src`及构建输入相对受测ac无改动；仍明确该报告测的是ac，不冒称修复新SHA已测。root保存新SHA后体积专员将重新构建绑定，最终审计包附新关联证据。
- 只读探针发现英文技能文本/来源metadata由运行时content digest保留、既有__CAT_DEBUG__存在；未量化可删除节省，未删除内容或改digest/调试支撑，不擅自扩成瘦包优化。


### 9.11 用户批准B3 041同步与单一golden冲突解决

- 因9e与最新baseline的golden冲突阻止新PR CI，用户明确批准将0411ad65c1933e87df840042f38cfe1ce834d127同步进B6，并按两项已批准语义解决冲突。第一父9e0b354，第二父0411ad6；未rebase，未把B6合回baseline。
- 唯一冲突为golden四路线digest/rounds及末尾note。完整原冲突、stage blob、双方意图和逐段解决见[账本](evidence/m8-b6/b3-sync/README.md)。B3生产执行器/14项测试原样引入，B6新目录/开场/恢复源码保持；不能取旧30战theirs，也不能保留旧B6 digest忽略B3。
- 9e的33战golden已逐字备份，SHA256为1adf09af7b7508277599703677a9d3fdc7d87b46799384671fbbcd7694204395。新严格更新器实际跑四路线，638命令、132场完整事件哈希、132场仅digest归一化的完整状态哈希全部与9e相等，其他版本/真实获取观察也相等，才写入统一digest c1704f5d和派生stateHash。没有重新接受行为差异，原B6宽松轨迹记录器未用于此次同步。
- 同一合并代码10文件135项定向真实通过，含B3/B6/G12/H1；build/typecheck通过，日志已保存。最新固定merge SHA后仍要新CI、新体积构建绑定和完整包独立审计；§9.10的480808B只是同步前9e/ac历史数值，不能继续冒称同步后最终体积。
