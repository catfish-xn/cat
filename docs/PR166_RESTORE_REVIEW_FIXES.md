# PR #166 恢复审查修复与性能验证

修复起点：`9c378dc3a618ed3a229668070f69eb29bcdc8c00`；性能基线：`multiplayer` 的 `d9cf5829549e275cd8322019933b971c6e1e1614`。

## 修复边界

- M1：从已经认证的开战输入、strategy 和 battle seed 隔离重建战斗，比较每个持有者的完整 `unit.tasks`，包含任务来源、kind、顺序、时钟、actionSeq、amount、ordinal/total 等全部字段。候选 kind 不再决定比较范围；真实诅咒旁新增 bleed 和其他英雄伪造 Maddie 延迟任务都会被拒绝。复用已有 sampled-stat 重建结果，避免同一次恢复重复重演。
- S1：壮实伙伴与赛恩的一次性标记核对重演的历史触发结果。Forge 当前存活不会抹去此前阵亡事实，也不会仅因 Forge 绑定就放行伪造标记。
- 不修改规则、数值、存档字段、内容或任何版本；content digest 保持 `fnv1a32-utf16:b58e35ae`。

## 回归证据

保留原有 10 项任务测试；新增“全部真实 curse + 追加 bleed”的 object/JSON 拒绝测试、Forge 阵亡后复活且伙伴仍活着的自然战斗正例，以及该伙伴提前标记/删除真实标记的 object/JSON 负例。Forge 正例由 seed 26 的公开获取路径、grant、部署、start/step 产生，无战斗字段补丁，并验证恢复后的逐 tick 状态和事件一致。

G-C01 从审计分支 `546d0868` 的 `tests/restore-audit/combat-accumulators.test.ts` 移植对应麦迪案例，改为 object/JSON 均拒绝；只移植本次对应案例。上述三个新案例放回独立 `9c378dc` 副本时全部失败：M1/G-C01 的篡改被接受，Forge 正例被 derived buddy trigger 拒绝。

最终限定验证：4 个文件、67 项全部通过，包含原 10 项任务测试；typecheck 通过。新增三个案例在 9c378dc 上失败为预期的反证结果。

限定验证命令（串行文件避免现有共享 fixture 临时文件名碰撞；初次并行运行曾遇到 ENOENT，未修改该共享测试基础设施）：

```sh
npm test -- tests/task-mechanism-restore.test.ts tests/explorer-bracer-restore.test.ts tests/m8-b7-match-wiring.test.ts tests/restore-audit/combat-accumulators.test.ts --no-file-parallelism
npm run typecheck
node scripts/measure-task-mechanism-restore.cjs d9cf582
```

## 相同莫甘娜/赛恩快照的单次存读档

Node v24.21.0；独立打包两个版本，同一组真实命令生成的合法快照，预热后基线/修复版本交替测量 9 次，报告毫秒中位数。`serializeMatch` 自身执行恢复验证，所以保存也有重演成本。未引入跨调用恢复缓存。与 d9cf582 的差值包含 9c378dc 已引入的莫甘娜/赛恩事实重建成本，属于 PR 整体对基线的比较，并非本次追加修复的单独增量。

| 场景 | 操作 | d9cf582 ms | 修复 ms | 增加 ms | 倍率 |
| --- | --- | ---: | ---: | ---: | ---: |
| Morgana tick20 | 保存 | 5.11 | 13.47 | +8.36 | 2.64× |
| Morgana tick20 | 对象恢复 | 4.78 | 9.32 | +4.54 | 1.95× |
| Morgana tick20 | JSON 恢复 | 2.53 | 8.63 | +6.10 | 3.41× |
| Morgana before curse | 保存 | 6.27 | 22.61 | +16.33 | 3.60× |
| Morgana before curse | 对象恢复 | 6.35 | 25.59 | +19.24 | 4.03× |
| Morgana before curse | JSON 恢复 | 2.51 | 20.44 | +17.93 | 8.14× |
| Morgana+Sion tick20 | 保存 | 5.52 | 14.15 | +8.63 | 2.56× |
| Morgana+Sion tick20 | 对象恢复 | 4.89 | 11.19 | +6.30 | 2.29× |
| Morgana+Sion tick20 | JSON 恢复 | 2.79 | 7.98 | +5.19 | 2.86× |
| Morgana+Sion before curse | 保存 | 5.25 | 31.95 | +26.71 | 6.09× |
| Morgana+Sion before curse | 对象恢复 | 5.00 | 26.62 | +21.63 | 5.33× |
| Morgana+Sion before curse | JSON 恢复 | 2.92 | 23.15 | +20.23 | 7.94× |

基线在真实诅咒存在时直接报 `Invalid Match save: task mechanism binding`，无法计算有效倍率：修复后莫甘娜第 89 tick 的保存/对象恢复/JSON 恢复为 18.69/17.23/19.54 ms；莫甘娜+赛恩第 89 tick 为 29.50/25.42/24.83 ms；赛恩已解缚的第 207 tick 为 71.52/71.83/64.28 ms。此处不把基线的快速拒绝当作成功读取进行比较。

完整重演成本随战斗 tick 增长；这些是当前机器的局部测量，不代表浏览器端性能门槛。

## B7 同文件耗时对照

相同机器和依赖，基线/修复版串行交替运行三轮；每轮单独启动进程，仅运行 `tests/m8-b7-match-wiring.test.ts --no-file-parallelism`，六次均为 30/30 通过。总耗时含进程启动、导入和公共对局夹具生成；测试耗时取 Vitest JSON 中各断言用时之和，两者均不能视为单次 restore 延迟。

| 轮次 | 基线总耗时 s | 修复总耗时 s | 基线测试耗时 s | 修复测试耗时 s |
| --- | ---: | ---: | ---: | ---: |
| 1 | 34.103 | 48.788 | 11.362 | 26.641 |
| 2 | 33.076 | 49.954 | 11.117 | 27.187 |
| 3 | 33.383 | 49.260 | 11.321 | 27.363 |
| 中位数 | 33.383 | 49.260 | 11.321 | 27.187 |

总耗时中位数增加 15.877 s（1.476 倍，+47.56%）；测试耗时中位数增加 15.866 s（2.402 倍，+140.15%）。增量包含 PR 原有事实重建和本次完整任务/历史标记校验；单次存读档成本见上一节。
