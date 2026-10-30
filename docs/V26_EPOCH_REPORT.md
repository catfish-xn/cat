# v26-neutrals-1424 纪元录制报告

【纪元】rulesVersion `s13-g2-3-v26-neutrals-1424`，contentVersion `s13-14.24b-g2-3-v26-neutrals-1424`；schema/save/replay/command 12/8/8/7，NET6。content digest `fnv1a32-utf16:f671ab88 → 9dc693dd`，loot digest `36ebfac2 → a56b2c4a`（`node scripts/update-content-identities.cjs --write`，独立摘要对比见 `docs/evidence/v26-neutrals-1424/digest-comparison.json`）。

【基线】历史保全基线为 `e9384c02fe352c7da3e672d2f1a2eb61754e1f5b`：multiplayer 上 PR #483 的合并提交，即已发布 v25 的最后状态（最后一次 v25 重录 e39def9a 之后），也是 v26 集成合并 795ca7f9 带入的 multiplayer 父提交。对应 v25 当时选用的 100589ca（multiplayer 上 v24 集成 PR #456 的合并提交）。e9384c02 之后 v26 集成没有改动任何 v25 及更早证据、脚本或归档源，check-history 逐字节核对 596 个历史文件和受保护 Herald manifest。

【工具】按 fd52c5d7 的结构新增：`scripts/record-v26-neutrals-1424-{battle-start,release,inputs,live-reveal,transfer}.cjs`、`scripts/record-chest-trial-v26.cjs`、`scripts/v26-neutrals-1424-fixture-audit.cjs`、`scripts/v26-neutrals-1424-route.cjs(.d.cts)`、`scripts/v26-epoch-report.cjs`、`scripts/verify-v26-neutrals-1424-epoch.cjs`（串行，15 步）、`scripts/verify-v26-epoch-parallel.cjs`、`scripts/audit-v26-neutrals-1424-adaptations.cjs`、`scripts/compare-v26-neutrals-1424-digests.cjs`、`scripts/tests/v26-epoch-report.test.ts`、`tests/fixtures/record-v26-neutrals-1424-herald.cjs`、`tests/fixtures/v26-neutrals-1424-herald-support/generate.ts`、`tests/fixtures/v26-neutrals-1424-chest-trial.ts`。v25 脚本与证据未改；`scripts/verify-m8-herald-fixtures.cjs` 的 CURRENT 指向 v26 Herald 录制器（v24→v25 时同样做法）。

【live-reveal 漂移】v25 录制器在 4-7 razorbeaks 死亡顺序上的 deepStrictEqual 失败是真实战斗漂移，不是缺陷。取 e9384c02 上 v25 同步掉落路线（种子 2634，Lux/Nami 交换后）的完整准备状态，只按各提交当前规则重建 4-7 敌方单位后重放：

| 提交 | 变更 | 4-7 死亡（单位@tick） |
| --- | --- | --- |
| e9384c02 | v25 | r00@52 r01@55 r02@94 r03@110 r04@110 r05@127（与 v25 证据一致） |
| 795ca7f9 | 14.24 野怪恢复 568eeea4：六只鸟变五只、数值变化 | r00@110 r01@110 r02@137 r03@178 r04@195 |
| d6a75a4e | targeting-p0 28fd974a | r02@102 r01@110 r03@137 r04@140 r00@178 |
| 0ebf828f / 3ce71065 / c684c3ec | anomaly-ui、d5-register、pve-loot-carryover | 同上，无变化 |
| 8106acee | targeting-p1：等距目标抽 lcg32、硬控期间保持目标 | r02@76 r01@137 r03@137 r04@140 r00@178 |
| 34cfbfbb / cc10a365 | 近战寻路 | 同上，无变化 |
| 927d3045 | p1：死亡单位不再消耗目标预判随机数 | r02@76 r03@137 r01@140 r04@140 r00@178 |
| c64a756a / bb9c02a0 | targeting-pathing 合并后 / 当前 | 同 927d3045 |

每一步都对应已合并的规则变更，且重放具有确定性。v26 的公开路线已在 v26 集成中改为种子 15972（同步）、54239（装备 Loris 部分击杀）和 1-4 小兵（无掉落来源）。`record-v26-neutrals-1424-live-reveal.cjs` 录制的正是 `tests/m8-b8-live-reveal.test.ts` 当前断言的内容：r04@40/446；r02、r03 在 tick 127 同批死亡（1226/1227，揭示 [1226,1226,1227]）；r00、r01 作为终局批次在 tick 165 死亡（1504/1505）；Loris 在 (6,7) 只击杀 r04@520（2 张收据、1 个单位出生），在 (0,6) 只击杀 r01@353（1 张收据、1 件物品出生）；1-4 无掉落来源死亡时揭示数为 0。上面的漂移表写在审计的 `drift` 字段里。断言没有放宽。

【C19 输入】v25 归档的 seed-9 最小输入在 targeting-p1（8106acee）下，Ezreal 直到 tick 200 才进入 Sunfire 范围，因此“两个首次附着都在 tick 40”的义务不再成立。只调整 battleSeed 无法恢复（前 3000 个种子均不满足）。v26 inputs 录制器只为 Ezreal 重新选择棋盘格：按与原格 (4,7) 的距离排序，取第一个仍满足原不变量（从 60 开始，每个存活的 20 tick 区间恰好一次燃烧），且 Ezreal 为 6 跳、Garen 为 15 跳的格子，结果为 (4,5)。其余编译字节和 battleSeed 都来自归档输入，搜索过程记录在 `input-fixture-audit.json` 的 `c19.placementSearch`。`tests/c19-missed-pulse.test.ts` 的录制检查点从 164/346 更新为 160/344；6/15 跳、302 原始伤害、tick 200 的第二来源等断言不变，10/10 通过。

【其他种子】宝箱试验按原规则搜索到种子 22496（v25 为 585）；转移路线仍为种子 4；Herald 仍为种子 65；房间开场仍为 20261013，round 23 棋盘数为 [8,7,8,7,8,8,7]。

【录制】`node scripts/verify-v26-epoch-parallel.cjs --write --jobs=6` 与不带 `--write` 的 check 运行结果见 `docs/evidence/v26-neutrals-1424/epoch-verification.json`。Herald 单步约 113 分钟（v25 约 5 分钟），原因是 v26 的 `serializeMatch` 在后期状态上约 10 秒（e9384c02 上约 85 毫秒），剖析显示时间都花在序列化时的战斗重放上。这是 v26 源码的性能回归，不属于纪元录制本身，见下方消费者超时。
