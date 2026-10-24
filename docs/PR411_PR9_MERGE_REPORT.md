# PR #411 合并 PR9 复核报告（2026-10-23）

合并代码修复、指定测试和性能复测已完成；v21 verify **尚未达到 15/15**。正式命令第 4 步因 herald manifest 内嵌旧源码指纹失败。独立继续检查余下步骤后，15 个分项中 **13 通过、2 失败**，两个失败均为同一 manifest 的源码元数据差异。录像、轨迹、夹具和历史证据仍保持原字节。更新 manifest 的例外已向用户提出，尚未获得确认，因此没有应用候选更新，也没有修改校验脚本或断言。

工作目录 `/home/aiapps/workspcae/cat-yield`，分支 `codex/yieldable-battle-setup`；HEAD `7c9de6e381eadc405ae37650437015e352bab3e5`，MERGE_HEAD / 本地 PR9 `263e0cb846335101c8fa2e3f133cc9555e30e107`。全程离线，使用已有 node_modules 软链；未执行 git add / commit，索引仍显示原五个 UU，工作区冲突标记已全部清除。

## 冲突与自动合并复核

| 文件 | 合并结果 |
| --- | --- |
| `docs/MATCH_CONTRACT.md` | 同时保留 #411 可让出开流合同和 PR9 的收入延后完整合同，不删除任何条款。 |
| `src/server-entry/index.ts` | 保留 `drainSetup` 及 PvP 生成器导出，同时保留 PR9 战斗装备、开局奇遇、进度读取与共享批次类型导出。 |
| `src/simulation/combat.ts` | 并存 `drainSetup` 与 `installBattleEquipmentBatch` 导入；同步创建 drain 同一生成器；PR9 的下一 tick 安装待处理装备保持不变。 |
| `src/simulation/match.ts` | 并存生成器帮助导入与 PR9 收入、装备、奇遇、锻造等导入；保留 PR9 全部业务实现，开流同步入口继续 drain 同一生成器。 |
| `src/simulation/strategy-snapshot.ts` | 同步和生成器签名均增加并透传 PR9 `equipmentBasis`；生成器保留冻结羁绊、单位非装备来源逻辑及原顺序。 |
| `src/simulation/two-sided-battle.ts`（自动合并遗漏） | PR9 的 `queueEquipment` 仍调用 `compileSide`。补回同步薄适配 `drainSetup(compileSideSteps(...))`，保持同一实现与原调用顺序，不复制规则。 |

`docs/COMBAT_CONTRACT.md` 同步第四参数与内部同步适配约定。新增一项 `equipmentBasis` 回归，覆盖非空与空冻结羁绊、同步/切片 JSON 字节及输入不变；原有断言未删除或放宽。没有新增规则、数值、RNG 操作、服务器时钟调用或 CI 改动。

初轮 typecheck 暴露 `compileSide` 缺失，修复后最终退出码 0；修复前仍在执行的测试/verify 已中断，最终数字均来自修复后的完整测试。首次进度汇报曾过早判断 typecheck 通过，已当场更正，原失败日志保留。

## v21 指纹与字节审计

通过外部 `refresh-source-digests.cjs` 使用现有 v21 审计的源文件清单和 SHA-256 口径生成，未手填 hash。四份文件仅 `sourceDigests` 变化，其余字段与 MERGE_HEAD 深度相等：

| `docs/evidence/v21-opening-encounters/` 文件 | 变化的源码条目 |
| --- | ---: |
| `battle-start-audit.json` | 11 |
| `input-fixture-audit.json` | 9 |
| `live-reveal-audit.json` | 9 |
| `release-audit.json` | 9 |

共同的 9 个条目：`combat.ts`、`content/freeze.ts`、`content/index.ts`、`g2-3-match-progress.ts`、`match.ts`、新增 `setup-work.ts`、`strategy-snapshot.ts`、`two-sided-battle.ts`、`two-sided-snapshot.ts`，均位于 `src/simulation/`。开战审计还更新 #411 已有的 `src/server/room/room.ts` 和 `two-sided-resolver.ts` 指纹。本轮没有另改服务器文件。

另外两份自动生成的审计结果变化：`consumer-byte-audit.json` 由原 `scripts/audit-encounters-pr9-adaptations.cjs` 生成，反映 #411 的测试差异；`epoch-verification.json` 由原 verify 命令生成，如实记录第 4 步失败。没有手改录制结果。

最终字节审计：**437 个 fixture/版本基线文件、1 个服务器开战夹具不变，v20 的 17 个证据文件与 HEAD 字节相等**。旧 epoch 历史检查通过。当前 content digest `fnv1a32-utf16:35273c97`、loot replay digest `fnv1a32-utf16:ef359464` 与 PR9 相同，未改版本号。

正式命令：`node scripts/verify-v21-opening-encounters-epoch.cjs`，exit=1，前三步通过，第四步 `record-herald` 失败。对余下原命令逐项执行（仍保留每项的真实退出码）后，另有 `check-herald` 失败，其余全通过。**这是 13/15 分项通过，不是正式总命令 15/15。**

两次 herald 检查均已完成五份 raw、轨迹逐字节比较和生产恢复验证，失败点只在 `tests/fixtures/v21-opening-encounters-herald-raw/manifest.json` 的 `sources` / `sourceSha256`。候选文件及差异已生成在下述证据目录，9 个源文件条目改变，其他 manifest 字段严格相等。需要用户允许这个明确的元数据例外，才能更新它并重跑原完整 verify；本报告不将无答复视为同意。

## 测试

最终 **13 文件、295 项通过、0 失败**，702.88 秒；其中用户指定范围 12 文件/278 项，另加战斗装备第 2 阶段 17 项，覆盖此次自动合并修复。`npm run typecheck` 最终 exit=0。未跑全套。

| 文件 | 通过 |
| --- | ---: |
| `tests/server/net/settlement-queue.test.ts` | 7 |
| `tests/g2-4a-crown-history.test.ts` | 56 |
| `tests/opening-encounters-pr5.test.ts` | 31 |
| `tests/server/battle-start-slices.test.ts` | 11 |
| `tests/rendering3d-isolation.test.ts` | 1 |
| `tests/battle-equipment-phase2.test.ts` | 17 |
| `tests/opening-encounters.test.ts` | 6 |
| `tests/opening-encounters-pr2.test.ts` | 31 |
| `tests/opening-encounters-integration.test.ts` | 46 |
| `tests/yieldable-battle-setup.test.ts` | 11 |
| `tests/opening-encounters-pr6.test.ts` | 42 |
| `tests/opening-encounters-trainer-golems.test.ts` | 35 |
| `tests/battle-history-equip-slot.test.ts` | 1 |

执行：`npm test -- tests/yieldable-battle-setup.test.ts tests/server/battle-start-slices.test.ts tests/server/net/settlement-queue.test.ts tests/battle-history-equip-slot.test.ts tests/g2-4a-crown-history.test.ts tests/rendering3d-isolation.test.ts tests/opening-encounters*.test.ts tests/battle-equipment-phase2.test.ts --configLoader runner --maxWorkers=1 --no-file-parallelism --isolate --reporter=verbose`。

## 最长开战片复测

沿用原 `redo-probe-implemented.ts`、`redo-build-implemented.cjs`：外部副本仅改证据路径，以及基线源码引用从 HEAD 改为 MERGE_HEAD。使用相同公开操作策略、seed=20261012 重新自然推进 v21 并保存独立快照，未套用 v20 旧身份、修改阵容或重写原证据。计时采用原事件循环模式、PLAIN=1 无生产函数插桩，`sliceTicks=100`、`sliceMs=20`，每轮 7 次，覆盖准备至原子发布的全部 callback。

| 回合 | PR9 最长片（含预热，ms） | 合并后最长片（含预热，ms） | 合并后剔除首轮最长片（ms） | 存活席 |
| --- | ---: | ---: | ---: | ---: |
| 2-6 | 38.70 | 14.82 | 6.66 | 8 |
| 4-6 | 70.27 | 22.33 | 22.33 | 7 |
| 5-3 | 48.48 | 13.74 | 10.32 | 4 |

**21/21 样本（含 3 个预热）最长片 ≤50ms，最大全部样本 22.33ms；21/21 tick0 与 tick1 SHA-256 均等于独立编译的 PR9 基线，fault 全部为 null。** 哈希覆盖完整 room state、frozenInputs、initial、frames、terminal、ledger、mapping。4-6 保留 7 席镜像场景，部署数量 7/8/8/8/9/8/7。

Node v22.23.4，32 个可用 CPU。测试、typecheck、verify 及补充检查全部退出后才计时。2026-10-23 14:54:01–14:54:14（Asia/Taipei），PR9 基线 load average（1/5/15 分钟）2.85/3.86/3.76 → 2.70/3.82/3.75；合并后 2.70/3.82/3.75 → 2.57/3.77/3.73。只复测这一批，没有挑选重跑结果。

## 风险与交接

协作生成器仍有单步 clone、枚举、combatStart、GC 和系统调度不可抢占的区间；本机 ≤50ms 不是跨硬件硬实时保证，也不代表总 CPU 等幅下降。v21 正式 verify 仍被夹具内源码指纹约束阻塞，不建议将其报告为完成。用户决定是否允许仅更新 herald manifest 源码元数据；原始录像和轨迹继续逐字节保留。确认后应更新消费者字节审计并重跑原 verify，最后由用户 git add / commit。

完整日志与可复现脚本位于 `/home/aiapps/workspcae/perf-1022/battle-start/yield/pr9-merge/`：`tests-final.log`、`typecheck-fixed.log`、`verify-herald-failure.log`、`herald-source-failure.log`、`combined-verification.json`、`source-digest-changes.json`、`final-audit.json`、`performance.log`、`performance-summary.json`、`performance.sh`、`proposed-herald-manifest.json`、`proposed-herald-manifest-diff.json`。原 `redo-*` 历史证据未覆盖。
