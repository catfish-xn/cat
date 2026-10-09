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
